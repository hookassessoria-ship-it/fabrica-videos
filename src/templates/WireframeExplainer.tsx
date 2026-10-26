import { Audio } from "@remotion/media";
import { useThree } from "@react-three/fiber";
import { Bloom, ChromaticAberration, EffectComposer } from "@react-three/postprocessing";
import { ThreeCanvas } from "@remotion/three";
import React, { useMemo } from "react";
import { AbsoluteFill, type CalculateMetadataFunction, interpolate, random, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { buildCollageTheme, CollageThemeProvider } from "../brand/collageTheme";
import { useBrandFonts } from "../brand/fonts";
import { narrationToCaptions } from "../components/captions/narrationToCaptions";
import { KineticCaptions } from "../components/kinetic/KineticCaptions";
import { applyCamera, cameraAt, type CamSpec } from "../components/wire/camera";
import { WIRE } from "../components/wire/theme";
import type { SceneWord } from "./collageLayers";
import { kineticTotalFrames, sceneDuration } from "./KineticExplainer";
import { type TimedElement, timeElements } from "./KineticShot";
import type { KElement, KineticExplainerProps, KShot, TransitionName } from "./kineticTypes";
import { retimeScenes } from "./retime";
import { buildSfxEvents, resolveNestedBeats, sfxLibrary, speechEnvelope, staticFileExists } from "./sfxMap";
import { FPS, HEIGHT, WIDTH } from "./timeline";
import { buildingSpecOf, inferStage, shotCamera, type StageCtx, tagsOf, WireShot3D, WireShotHtml } from "./WireShot";

// Holograma 3D: objetos em malha (branco + bordas ciano, glow), sala com chão de grade e
// paredes de hexágono, partículas, arcos de luz, câmera sempre em movimento. Usa os mesmos
// shots do KineticExplainer (a versão C reaproveita o roteiro, o áudio e as legendas da B):
// o palco 3D de cada shot vem de "wire" ou é deduzido dos elementos.

const resolveSrc = (src: string) => (/^https?:\/\//.test(src) ? src : staticFile(src));

// Cortes do holograma: glitch (RGB + tremida), zoom (punch de câmera com whoosh), flash.
type WireCut = "glitch" | "zoom" | "flash" | "cut";
const CUT_FROM: Partial<Record<TransitionName, WireCut>> = { glitch: "glitch", flash: "flash", invert: "glitch", cut: "cut" };
// Flash só quando pedido no JSON (num fundo escuro, ele vira um quadro cinza).
const POOL: WireCut[] = ["glitch", "zoom"];
const CUT_FRAMES: Record<WireCut, number> = { glitch: 4, zoom: 8, flash: 2, cut: 0 };
// O som do corte usa o mapeamento das transições do Kinetic.
const CUT_SFX: Record<WireCut, TransitionName> = { glitch: "glitch", zoom: "zoom", flash: "flash", cut: "cut" };

type Flat = { shot: KShot; sceneIndex: number; offsetInScene: number; startFrame: number; frames: number; cut: WireCut };

const flatten = (scenes: KineticExplainerProps["scenes"], fps: number, seed: string): Flat[] => {
  const out: Flat[] = [];
  let acc = 0;
  scenes.forEach((scene, sceneIndex) => {
    let off = 0;
    scene.shots.forEach((shot) => {
      const startFrame = Math.round(acc * fps);
      acc += shot.duration;
      const i = out.length;
      const asked = shot.transition && shot.transition !== "auto" ? (CUT_FROM[shot.transition] ?? "zoom") : undefined;
      const prev = out[i - 1]?.cut;
      const options = POOL.filter((c) => c !== prev);
      const cut = i === 0 ? "cut" : (asked ?? options[Math.floor(random(`${seed}-cut-${i}`) * options.length)]);
      out.push({ shot, sceneIndex, offsetInScene: off, startFrame, frames: Math.round(acc * fps) - startFrame, cut });
      off += shot.duration;
    });
  });
  return out;
};

// Câmera do shot ativo (mesma conta usada pelos rótulos HTML).
const CameraRig: React.FC<{ readonly spec: CamSpec; readonly frames: number }> = ({ spec, frames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  applyCamera(camera, cameraAt(spec, frame, frames, fps));
  return null;
};

// Fundo: domo com degradê azul-marinho (sem névoa).
const Backdrop: React.FC = () => {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: { c0: { value: new THREE.Color(WIRE.bg0) }, c1: { value: new THREE.Color(WIRE.bg1) } },
        vertexShader: "varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
        fragmentShader: "uniform vec3 c0; uniform vec3 c1; varying vec3 vP; void main(){ float t = smoothstep(-0.3, 0.6, vP.y); gl_FragColor = vec4(mix(c0, c1, t), 1.0); }",
      }),
    [],
  );
  return (
    <mesh material={mat} renderOrder={-1}>
      <sphereGeometry args={[200, 32, 16]} />
    </mesh>
  );
};

// Efeitos de pós: bloom sempre; aberração cromática forte nos cortes com glitch.
const Post: React.FC<{ readonly shots: Flat[] }> = ({ shots }) => {
  const frame = useCurrentFrame();
  let ab = 0.0006;
  for (const s of shots) {
    const k = frame - s.startFrame;
    if (s.cut === "glitch" && k >= 0 && k < CUT_FRAMES.glitch) {
      ab = 0.012 * (1 - k / CUT_FRAMES.glitch) + 0.002;
    }
  }
  const offset = useMemo(() => new THREE.Vector2(), []);
  offset.set(ab, ab * 0.6);
  return (
    <EffectComposer multisampling={0}>
      <Bloom intensity={1.25} luminanceThreshold={0.22} luminanceSmoothing={0.2} mipmapBlur radius={0.7} />
      <ChromaticAberration offset={offset} radialModulation={false} modulationOffset={0} />
    </EffectComposer>
  );
};

// Scanlines + vinheta + efeito do corte (tremida, faixa de glitch, flash).
const Overlay: React.FC<{ readonly shots: Flat[] }> = ({ shots }) => {
  const frame = useCurrentFrame();
  let flash = 0;
  let band = -1;
  let jx = 0;
  for (const s of shots) {
    const k = frame - s.startFrame;
    if (k < 0 || k >= Math.max(1, CUT_FRAMES[s.cut])) {
      continue;
    }
    if (s.cut === "flash") {
      flash = k === 0 ? 0.42 : 0.2;
    }
    if (s.cut === "glitch") {
      band = random(`band-${frame}`) * 1700;
      jx = (random(`jx-${frame}`) - 0.5) * 60;
    }
  }
  const flicker = 0.92 + 0.08 * random(`flick-${Math.floor(frame / 2)}`);
  return (
    <AbsoluteFill style={{ pointerEvents: "none", translate: `${jx}px 0` }}>
      <svg width={WIDTH} height={HEIGHT} style={{ position: "absolute", inset: 0, opacity: 0.09 * flicker }}>
        <defs>
          <pattern id="scan" width={4} height={4} patternUnits="userSpaceOnUse" y={(frame * 0.7) % 4}>
            <rect width={4} height={1.4} fill="#9FF6FF" />
          </pattern>
          <radialGradient id="vig" cx="50%" cy="45%" r="75%">
            <stop offset="55%" stopColor="#000" stopOpacity={0} />
            <stop offset="100%" stopColor="#000" stopOpacity={0.75} />
          </radialGradient>
        </defs>
        <rect width={WIDTH} height={HEIGHT} fill="url(#scan)" />
      </svg>
      <svg width={WIDTH} height={HEIGHT} style={{ position: "absolute", inset: 0 }}>
        <rect width={WIDTH} height={HEIGHT} fill="url(#vig)" />
      </svg>
      {/* linha de varredura descendo devagar */}
      <div style={{ position: "absolute", left: 0, right: 0, top: ((frame * 9) % 2300) - 200, height: 120, opacity: 0.08, background: `linear-gradient(180deg, transparent, ${WIRE.cyan}, transparent)` }} />
      {band >= 0 ? <div style={{ position: "absolute", left: 0, right: 0, top: band, height: 140, backgroundColor: WIRE.cyan, opacity: 0.18, mixBlendMode: "screen" }} /> : null}
      {flash > 0 ? <AbsoluteFill style={{ backgroundColor: "#DFFBFF", opacity: flash, mixBlendMode: "screen" }} /> : null}
    </AbsoluteFill>
  );
};

export const WireframeExplainer: React.FC<KineticExplainerProps> = ({ brand, scenes, audioSrc, captions, music, sfx, showCaptions = true, numberCheck = false, seed }) => {
  useBrandFonts(brand);
  const { fps, durationInFrames } = useVideoConfig();
  const theme = useMemo(() => buildCollageTheme(brand), [brand]);
  const shots = useMemo(() => flatten(scenes, fps, seed ?? `${brand.id}-wire`), [scenes, fps, seed, brand.id]);

  const sceneStarts = useMemo(() => {
    const starts: number[] = [];
    let acc = 0;
    scenes.forEach((s) => {
      starts.push(acc);
      acc += sceneDuration(s);
    });
    return starts;
  }, [scenes]);
  const words = useMemo(
    () =>
      captions && captions.length > 0
        ? captions
        : narrationToCaptions(scenes.map((s, i) => ({ narration: s.narration, startSec: sceneStarts[i], durationSec: sceneDuration(s) }))),
    [captions, scenes, sceneStarts],
  );
  const shotWords = useMemo(
    () =>
      shots.map((s): SceneWord[] => {
        const from = (sceneStarts[s.sceneIndex] + s.offsetInScene) * 1000;
        const sceneFrom = sceneStarts[s.sceneIndex] * 1000;
        const sceneTo = (sceneStarts[s.sceneIndex] + sceneDuration(scenes[s.sceneIndex])) * 1000;
        return words.filter((w) => w.startMs >= sceneFrom && w.startMs < sceneTo).map((w) => ({ text: w.text.trim(), start: (w.startMs - from) / 1000 }));
      }),
    [shots, words, sceneStarts, scenes],
  );
  const timedAll = useMemo(() => shots.map((s, i) => timeElements(s.shot, shotWords[i], fps)), [shots, shotWords, fps]);
  const ctxs = useMemo(
    () => shots.map((s, i): StageCtx => ({ shot: s.shot, stage: inferStage(s.shot), timed: timedAll[i], words: shotWords[i] })),
    [shots, timedAll, shotWords],
  );
  // Enquadramento automático de cada shot (calculado uma vez).
  const cams = useMemo(() => ctxs.map((c, i) => shotCamera(c, shots[i].frames, fps)), [ctxs, shots, fps]);

  const sfxEvents = useMemo(
    () =>
      buildSfxEvents(
        shots.map((s) => ({ startFrame: s.startFrame, transitionIn: CUT_SFX[s.cut], interrupt: s.shot.interrupt })),
        timedAll.map((els, i): TimedElement[] => [
          ...resolveNestedBeats(els, shotWords[i], shots[i].shot.id).map((t): TimedElement => {
            // Palavra-chave de impacto soa como texto "impact"; o prédio usa os tempos já
            // resolvidos (whoosh na subida rápida do elevador).
            if (t.el.type === "keyword" && (t.el.alert || t.el.impact)) {
              return { ...t, el: { ...t.el, type: "text", effect: "impact" } };
            }
            if (t.el.type === "building" && t.el.elevator) {
              return { ...t, el: { ...t.el, elevator: { ...t.el.elevator, moves: buildingSpecOf(ctxs[i]).elevator?.moves } } };
            }
            return t;
          }),
          // Cada etiqueta dos cabos entra com um pop.
          ...(ctxs[i].stage === "cables" ? tagsOf(ctxs[i]).map((tg): TimedElement => ({ el: { type: "icon", icon: "tag" } as KElement, at: tg.at, seed: "" })) : []),
        ]),
        fps,
        sfxLibrary(),
        sfx,
      ),
    [shots, timedAll, ctxs, shotWords, fps, sfx],
  );
  const speech = useMemo(() => speechEnvelope(captions && captions.length > 0 ? captions : [], fps, durationInFrames), [captions, fps, durationInFrames]);
  const duck = (f: number) => 1 - 0.65 * (speech[Math.min(speech.length - 1, Math.max(0, f))] ?? 0);
  const narration = audioSrc && (/^https?:\/\//.test(audioSrc) || staticFileExists(audioSrc)) ? audioSrc : null;
  const bgMusic = music?.src ?? (staticFileExists("audio/bg.mp3") ? "audio/bg.mp3" : null);
  const musicVolume = music?.volume ?? 0.06;

  return (
    <CollageThemeProvider value={theme}>
      <AbsoluteFill data-comp-root style={{ backgroundColor: WIRE.bg0 }}>
        {/* Na revisão automática o 3D não é desenhado: tudo que ela mede (rótulos, caixa do
            objeto, palavras) vem da conta da câmera e da camada HTML. */}
        {numberCheck ? null : (
          <ThreeCanvas width={WIDTH} height={HEIGHT} gl={{ antialias: true, alpha: false, preserveDrawingBuffer: true }} camera={{ fov: 40, near: 0.1, far: 400, position: [0, 1, 9] }}>
            <Backdrop />
            {shots.map((s, i) => (
              <Sequence key={s.shot.id} from={s.startFrame} durationInFrames={s.frames} layout="none" name={s.shot.id}>
                <CameraRig spec={cams[i]} frames={s.frames} />
                <WireShot3D ctx={ctxs[i]} seed={s.shot.id} cam={cams[i]} />
              </Sequence>
            ))}
            <Post shots={shots} />
          </ThreeCanvas>
        )}
        <Overlay shots={shots} />
        {shots.map((s, i) => (
          <Sequence key={s.shot.id} from={s.startFrame} durationInFrames={s.frames} name={`${s.shot.id} texto`}>
            <WireShotHtml ctx={ctxs[i]} cam={cams[i]} numberCheck={numberCheck} startFrame={s.startFrame} />
          </Sequence>
        ))}
        {showCaptions ? <KineticCaptions captions={words} accent={WIRE.cyan} activeText={WIRE.bg0} plate="rgba(2,8,18,0.72)" /> : null}
        {sfxEvents.map((e, i) => (
          <Sequence key={i} from={e.frame} durationInFrames={Math.round(fps * 2)} layout="none" name={`sfx ${e.kind}`}>
            <Audio src={resolveSrc(e.src)} volume={(f) => e.volume * duck(e.frame + f)} />
          </Sequence>
        ))}
        {narration ? <Audio src={resolveSrc(narration)} volume={1} /> : null}
        {bgMusic ? (
          <Audio
            src={resolveSrc(bgMusic)}
            loop
            volume={(f) =>
              interpolate(f, [0, fps * 1.5, durationInFrames - fps * 2, durationInFrames], [0, musicVolume, musicVolume, 0], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }) * (1 - 0.3 * (speech[f] ?? 0))
            }
          />
        ) : null}
      </AbsoluteFill>
    </CollageThemeProvider>
  );
};

export const calculateWireMetadata: CalculateMetadataFunction<KineticExplainerProps> = ({ props }) => {
  const scenes = retimeScenes(props.scenes, props.captions);
  return {
    fps: FPS,
    width: WIDTH,
    height: HEIGHT,
    durationInFrames: kineticTotalFrames(scenes, FPS),
    props: { ...props, scenes },
  };
};

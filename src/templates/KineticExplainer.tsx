import { Audio } from "@remotion/media";
import { linearTiming, TransitionSeries } from "@remotion/transitions";
import React, { useMemo } from "react";
import { AbsoluteFill, type CalculateMetadataFunction, interpolate, Sequence, staticFile, useVideoConfig } from "remotion";
import { buildCollageTheme, CollageThemeProvider } from "../brand/collageTheme";
import { useBrandFonts } from "../brand/fonts";
import { narrationToCaptions } from "../components/captions/narrationToCaptions";
import { FluidBackground, type PaletteStop, resolvePalette } from "../components/kinetic/FluidBackground";
import { KineticCaptions } from "../components/kinetic/KineticCaptions";
import { UrgentOverlay } from "../components/kinetic/UrgentBadge";
import { kineticTransition, pickTransitions, TRANSITION_FRAMES } from "../components/transitions/kineticTransitions";
import type { SceneWord } from "./collageLayers";
import type { KineticExplainerProps, KScene, KShot, TransitionName } from "./kineticTypes";
import { KineticShot, timeElements } from "./KineticShot";
import { retimeScenes } from "./retime";
import { applyLayoutVariant } from "./variant";
import { buildSfxEvents, resolveNestedBeats, sfxLibrary, speechEnvelope, staticFileExists } from "./sfxMap";
import { VISUAL } from "./safeZone";
import { FPS, HEIGHT, WIDTH } from "./timeline";

const resolveSrc = (src: string) => (/^https?:\/\//.test(src) ? src : staticFile(src));

export const sceneDuration = (scene: KScene) => scene.shots.reduce((s, sh) => s + sh.duration, 0);
export const kineticTotalFrames = (scenes: KScene[], fps: number) => Math.max(1, Math.round(scenes.reduce((s, sc) => s + sceneDuration(sc), 0) * fps));

type FlatShot = {
  shot: KShot;
  sceneIndex: number;
  // Início do shot dentro da cena (s) e no vídeo (frames).
  offsetInScene: number;
  startFrame: number;
  frames: number;
  transitionIn: TransitionName;
  transitionOut: number;
};

// Faixa vertical aproximada de cada texto grande do shot (título, ransom, recorte, número
// herói, palavra com foto).
const textBands = (shot: KShot): [number, number][] =>
  shot.elements.flatMap((el): [number, number][] => {
    const y = el.y ?? VISUAL.centerY;
    const half = (h: number): [number, number][] => [[y - h / 2, y + h / 2]];
    switch (el.type) {
      case "text":
        return (el.size ?? 110) >= 56 && !el.outline ? half((el.size ?? 110) * 1.1 * el.text.split("\n").length) : [];
      case "ransom":
        return half((el.size ?? 150) * 1.4);
      case "clipping":
        return half((el.size ?? 96) * (el.text.split("\n").length + 0.8) * 1.15);
      case "number":
        return half((el.size ?? 300) * 1.1);
      // gráficos contam como "texto": seus números não podem ficar sob um título grande
      case "bars":
        return half((el.height ?? 600) + 140);
      case "line":
        return half((el.height ?? 420) + 120);
      case "photo":
        return el.style === "mask" ? half(el.height ?? 360) : [];
      // número dentro do gelo e anos da linha do tempo também são números na tela
      case "ice":
        return el.value !== undefined ? half((el.size ?? 360) * 1.3) : [];
      case "timeline":
        return half(el.height ?? 980);
      default:
        return [];
    }
  });

const textBandsOverlap = (a: KShot, b: KShot) =>
  textBands(a).some(([a0, a1]) => textBands(b).some(([b0, b1]) => Math.min(a1, b1) - Math.max(a0, b0) > -40));

const flatten = (scenes: KScene[], fps: number, seed: string): FlatShot[] => {
  const list: Omit<FlatShot, "transitionIn" | "transitionOut">[] = [];
  let acc = 0;
  scenes.forEach((scene, sceneIndex) => {
    let off = 0;
    scene.shots.forEach((shot) => {
      const startFrame = Math.round(acc * fps);
      acc += shot.duration;
      list.push({ shot, sceneIndex, offsetInScene: off, startFrame, frames: Math.round(acc * fps) - startFrame });
      off += shot.duration;
    });
  });
  const conflicts = list.map((l, i) => i > 0 && textBandsOverlap(list[i - 1].shot, l.shot));
  const kinds = pickTransitions(
    list.map((l, i) => (i === 0 ? "cut" : l.shot.transition)),
    seed,
    conflicts,
  );
  return list.map((l, i) => {
    const next = list[i + 1];
    const wanted = next ? TRANSITION_FRAMES[kinds[i + 1]] : 0;
    const transitionOut = next ? Math.max(0, Math.min(wanted, l.frames - 2, next.frames - 2)) : 0;
    return { ...l, transitionIn: kinds[i], transitionOut };
  });
};

// Motion graphics premium: texto cinético, ícones, números, gráficos e fotos
// integradas sobre gradiente fluido; cortes curtos e transições variadas.
export const KineticExplainer: React.FC<KineticExplainerProps> = ({ brand, scenes, background, images, audioSrc, captions, music, sfx, showCaptions = true, numberCheck = false, seed, urgent }) => {
  useBrandFonts(brand);
  const { fps, durationInFrames } = useVideoConfig();
  const theme = useMemo(() => buildCollageTheme(brand), [brand]);
  const shots = useMemo(() => flatten(scenes, fps, seed ?? brand.id), [scenes, fps, seed, brand.id]);

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

  // Palavras relativas ao início de cada shot (pra "enterOnWord").
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

  const stops = useMemo((): PaletteStop[] => {
    let last = resolvePalette(background?.palette);
    return shots.map((s) => {
      if (s.shot.palette && !s.shot.interrupt) {
        last = resolvePalette(s.shot.palette);
      } else if (!s.shot.interrupt) {
        last = resolvePalette(background?.palette);
      }
      return { startFrame: s.startFrame, colors: last };
    });
  }, [shots, background?.palette]);

  const timedAll = useMemo(() => shots.map((s, i) => timeElements(s.shot, shotWords[i], fps)), [shots, shotWords, fps]);
  const impacts = useMemo(
    () => timedAll.flatMap((els, i) => els.map((e) => e.impact).filter((v): v is number => v !== undefined).map((v) => v + shots[i].startFrame)),
    [timedAll, shots],
  );
  // Efeitos sonoros automáticos (biblioteca public/sfx) + ducking: abaixam durante a fala.
  const sfxEvents = useMemo(
    () =>
      buildSfxEvents(
        shots.map((s) => ({ startFrame: s.startFrame, transitionIn: s.transitionIn, interrupt: s.shot.interrupt })),
        timedAll.map((t, i) => resolveNestedBeats(t, shotWords[i], shots[i].shot.id)),
        fps,
        sfxLibrary(),
        sfx,
      ),
    [shots, timedAll, shotWords, fps, sfx],
  );
  const speech = useMemo(() => speechEnvelope(captions && captions.length > 0 ? captions : [], fps, durationInFrames), [captions, fps, durationInFrames]);
  // Durante a fala os efeitos caem ~9 dB: nada compete com a voz.
  const duck = (f: number) => 1 - 0.65 * (speech[Math.min(speech.length - 1, Math.max(0, f))] ?? 0);
  const narration = audioSrc && (/^https?:\/\//.test(audioSrc) || staticFileExists(audioSrc)) ? audioSrc : null;
  // Trilha opcional: public/audio/bg.mp3 em loop, baixinha, com fade.
  const bgMusic = music?.src ?? (staticFileExists("audio/bg.mp3") ? "audio/bg.mp3" : null);
  const musicVolume = music?.volume ?? 0.06;

  return (
    <CollageThemeProvider value={theme}>
      <AbsoluteFill data-comp-root style={{ backgroundColor: "#000" }}>
        <svg width={0} height={0} style={{ position: "absolute" }}>
          <filter id="k-sharpen" colorInterpolationFilters="sRGB">
            <feConvolveMatrix order={3} kernelMatrix="0 -0.3 0 -0.3 2.2 -0.3 0 -0.3 0" preserveAlpha />
          </filter>
        </svg>
        <FluidBackground stops={stops} speed={background?.speed ?? 0.3} video={background?.video} impacts={impacts} />
        <TransitionSeries>
          {shots.map((s, i) => (
            <React.Fragment key={s.shot.id}>
              {i > 0 && shots[i - 1].transitionOut > 0 ? (
                <TransitionSeries.Transition presentation={kineticTransition(s.transitionIn, theme.c.accent, s.shot.id)} timing={linearTiming({ durationInFrames: shots[i - 1].transitionOut })} />
              ) : null}
              <TransitionSeries.Sequence name={s.shot.id} durationInFrames={s.frames + s.transitionOut}>
                <KineticShot shot={s.shot} sceneId={scenes[s.sceneIndex].id} words={shotWords[i]} images={images} numberCheck={numberCheck} startFrame={s.startFrame} />
              </TransitionSeries.Sequence>
            </React.Fragment>
          ))}
        </TransitionSeries>
        {showCaptions ? <KineticCaptions captions={words} /> : null}
        <UrgentOverlay spec={urgent} />
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

// Com narração gravada, os shots são reajustados pelos timestamps reais (retime.ts) e a
// duração do vídeo passa a seguir a fala (+1s no fim).
export const calculateKineticMetadata: CalculateMetadataFunction<KineticExplainerProps> = ({ props }) => {
  const scenes = retimeScenes(applyLayoutVariant(props.scenes, props.layout), props.captions);
  return {
    fps: FPS,
    width: WIDTH,
    height: HEIGHT,
    durationInFrames: kineticTotalFrames(scenes, FPS),
    props: { ...props, scenes },
  };
};

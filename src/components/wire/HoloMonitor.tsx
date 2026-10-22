import { useOffthreadVideoTexture } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import React, { useLayoutEffect, useMemo, useRef } from "react";
import { continueRender, delayRender, Easing, Freeze, interpolate, random, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import type { HoloIntro } from "../../templates/kineticTypes";
import { cameraAt, type CamSpec, threeCamera } from "./camera";
import { glow, HEIGHT, WIDTH, WIRE } from "./theme";

// Monitor holográfico da abertura da versão 3D: 2–3 trechos de filme seguidos num vidro ciano
// (scanlines, aberração cromática, glitch a cada corte), flutuando na frente da câmera, com a
// cena 3D apagada atrás. No fim do último trecho a imagem se desmancha em blocos que viram
// partículas (com a cor do próprio quadro) e a malha do monitor ondula, abre e some: a cena
// 3D aparece. Tudo fica preso à câmera (mesma conta dos shots), então o monitor não se mexe
// na tela nem nos cortes de câmera.

const DEFAULT_SRC = "clips/odisseia-trailer.mp4";

// Retângulo do monitor na tela (px): dentro da área do objeto dos shots com texto digitado
// (y 575–1215, x 60–960), abaixo da palavra-chave e do texto digitado.
export const HOLO_RECT = { cx: 515, cy: 900, w: 860, h: 430 };
const DEPTH = 3;
const VEIL_DEPTH = 3.6;
const VEIL = 0.72;
const TAIL = 10;
const POWER_ON = 7;
const CUT_GLITCH = 6;

// Recorte do quadro do trailer (16:9 com o filme em 2,39:1 no meio): tira as faixas pretas e
// corta as laterais pro formato do monitor.
const CONTENT = { y0: 46 / 360, h: 268 / 360, aspect: 640 / 268 };
const cropOf = (aspect: number, focusX = 0.5) => {
  const w = Math.min(1, aspect / CONTENT.aspect);
  return new THREE.Vector4(Math.min(1 - w, Math.max(0, focusX - w / 2)), CONTENT.y0, w, CONTENT.h);
};

export type HoloPlan = {
  src: string;
  clips: { from: number; startF: number; lenF: number }[];
  // Último quadro do último trecho (o monitor some aí) e início da dissolução.
  endF: number;
  dissolveF: number;
  label?: string;
};

export const holoPlan = (intro: HoloIntro, fps: number): HoloPlan => {
  let acc = 0;
  const clips = intro.clips.map((c) => {
    const lenF = Math.round(Math.min(2, Math.max(1, c.duration ?? 1.4)) * fps);
    const out = { from: c.from, startF: acc, lenF };
    acc += lenF;
    return out;
  });
  return { src: intro.src ?? DEFAULT_SRC, clips, endF: acc, dissolveF: Math.round((intro.dissolve ?? 1) * fps), label: intro.label };
};

// Estado do monitor num quadro (o rótulo HTML usa a mesma conta).
export const holoState = (plan: HoloPlan, frame: number) => {
  const on = interpolate(frame, [0, POWER_ON], [0.03, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.exp) });
  const dStart = plan.endF - plan.dissolveF;
  const p = interpolate(frame, [dStart, plan.endF], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  // Partículas terminam de voar no rabo (TAIL) depois do fim.
  const dissolve = interpolate(frame, [dStart, plan.endF, plan.endF + TAIL], [0, 1.05, 1.45], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  let glitch = random(`holo-g-${Math.floor(frame / 3)}`) > 0.84 ? 0.3 : 0.06;
  for (const c of plan.clips) {
    const k = frame - c.startF;
    if (k >= 0 && k < CUT_GLITCH) {
      glitch = Math.max(glitch, 1 - k / CUT_GLITCH);
    }
  }
  glitch = Math.max(glitch, p > 0 ? 0.25 + 0.5 * p : 0);
  const clipIndex = plan.clips.reduce((acc, c, i) => (frame >= c.startF ? i : acc), 0);
  return { on, p, dissolve, glitch, flash: interpolate(frame, [0, POWER_ON], [0.7, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }), clipIndex, visible: frame < plan.endF + TAIL };
};

// ---------------------------------------------------------------- shaders

const NOISE = /* glsl */ `
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
// Ordem da dissolução: manchas grandes + blocos (a imagem quebra em "pixels").
float dissolveKey(vec2 uv) { return 0.62 * vnoise(uv * vec2(9.0, 4.5)) + 0.38 * hash(floor(uv * vec2(96.0, 48.0))); }
`;

const SCREEN_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;

const SCREEN_FRAG = /* glsl */ `
uniform sampler2D uMap; uniform vec4 uCrop; uniform vec2 uRes; uniform vec3 uCyan;
uniform float uTime; uniform float uGlitch; uniform float uDissolve; uniform float uFlash; uniform float uOpacity;
varying vec2 vUv;
${NOISE}
void main() {
  vec2 uv = vUv;
  // glitch: faixas horizontais deslocadas
  float tg = floor(uTime * 14.0);
  float row = floor(uv.y * 28.0);
  float on = step(1.0 - 0.45 * uGlitch, hash(vec2(row, tg)));
  uv.x = clamp(uv.x + on * (hash(vec2(row * 1.7, tg + 3.0)) - 0.5) * 0.16 * uGlitch, 0.0, 1.0);
  vec2 t = uCrop.xy + uv * uCrop.zw;
  // aberração cromática leve (forte no glitch)
  float ca = 0.0022 + 0.011 * uGlitch;
  vec3 col = vec3(texture2D(uMap, t + vec2(ca, 0.0)).r, texture2D(uMap, t).g, texture2D(uMap, t - vec2(ca, 0.0)).b);
  float lum = pow(dot(col, vec3(0.299, 0.587, 0.114)), 1.2);
  vec3 holo = mix(uCyan * (0.06 + lum * 1.45), col, 0.3);
  // scanlines (~4 px) + faixa clara correndo
  float scan = 0.74 + 0.26 * step(0.5, fract(vUv.y * uRes.y / 4.0));
  float band = fract(uTime * 0.45);
  holo = holo * scan + uCyan * 0.22 * exp(-pow((vUv.y - band) * 16.0, 2.0));
  // vidro: vinheta e fio de borda
  vec2 e = min(vUv, 1.0 - vUv) * uRes;
  float d = min(e.x, e.y);
  holo *= 0.6 + 0.4 * smoothstep(0.0, 60.0, d);
  holo += uCyan * (1.0 - smoothstep(0.0, 5.0, d)) * 0.8;
  // dissolução: blocos somem com borda brilhante
  float k = dissolveKey(vUv);
  if (k < uDissolve) discard;
  float rim = (1.0 - smoothstep(0.0, 0.05, k - uDissolve)) * step(0.001, uDissolve);
  holo = mix(holo, uCyan * 2.4, rim);
  gl_FragColor = vec4(holo + vec3(uFlash), uOpacity);
}
`;

const PART_VERT = /* glsl */ `
attribute vec2 aUv; attribute float aSeed;
uniform sampler2D uMap; uniform vec4 uCrop; uniform vec2 uRes; uniform vec3 uCyan;
uniform float uDissolve; uniform float uSize; uniform float uRef;
varying vec3 vCol; varying float vA;
${NOISE}
void main() {
  float k = dissolveKey(aUv);
  float a = clamp((uDissolve - k) / 0.38, 0.0, 1.0);
  float e = 1.0 - (1.0 - a) * (1.0 - a);
  vec3 p = vec3((aUv - 0.5) * uRes, 0.0);
  vec2 dir = normalize((aUv - 0.5) * vec2(1.0, 1.7) + (vec2(hash(aUv * 7.13), hash(aUv * 3.31)) - 0.5) * 1.1);
  p.xy += dir * e * 520.0 * (0.35 + aSeed);
  p.y -= a * a * 300.0;
  p.z -= e * 2600.0 * (0.4 + aSeed);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float live = step(k, uDissolve);
  gl_PointSize = live * uSize * (0.55 + aSeed) * (1.0 - 0.4 * a) * (uRef / -mv.z);
  vec3 c = texture2D(uMap, uCrop.xy + aUv * uCrop.zw).rgb;
  float lum = dot(c, vec3(0.299, 0.587, 0.114));
  vCol = mix(uCyan * (0.5 + lum * 1.8), c * 1.4, 0.35);
  vA = live * (1.0 - a);
}
`;

const PART_FRAG = /* glsl */ `
varying vec3 vCol; varying float vA;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  if (vA < 0.01 || d > 0.5) discard;
  float s = 1.0 - smoothstep(0.1, 0.5, d);
  gl_FragColor = vec4(vCol * (0.7 + s), vA * s);
}
`;

const WIRE_VERT = /* glsl */ `
attribute vec2 aUv;
uniform vec2 uRes; uniform float uP; uniform float uTime;
varying vec2 vUv;
${NOISE}
void main() {
  vUv = aUv;
  vec3 p = vec3((aUv - 0.5) * uRes, 0.0);
  float n = vnoise(aUv * vec2(5.0, 3.0) + uTime * 0.6);
  p.xy *= 1.0 + 0.4 * uP;
  p.z += (n - 0.5) * 1100.0 * uP - uP * uP * 1400.0;
  p.y -= uP * uP * 260.0;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}
`;

const WIRE_FRAG = /* glsl */ `
uniform vec3 uCyan; uniform float uOpacity; uniform float uP;
varying vec2 vUv;
${NOISE}
void main() {
  if (dissolveKey(vUv) < uP * 1.3 - 0.45) discard;
  gl_FragColor = vec4(uCyan * 1.7, uOpacity);
}
`;

// Malha do monitor: linhas de grade subdivididas (pra poderem ondular).
const wireGeometry = (nx: number, ny: number, sub: number) => {
  const uvs: number[] = [];
  const seg = (u0: number, v0: number, u1: number, v1: number) => uvs.push(u0, v0, u1, v1);
  for (let j = 0; j <= ny; j++) {
    for (let s = 0; s < sub * 2; s++) {
      seg(s / (sub * 2), j / ny, (s + 1) / (sub * 2), j / ny);
    }
  }
  for (let i = 0; i <= nx; i++) {
    for (let s = 0; s < sub; s++) {
      seg(i / nx, s / sub, i / nx, (s + 1) / sub);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(new Array((uvs.length / 2) * 3).fill(0), 3));
  g.setAttribute("aUv", new THREE.Float32BufferAttribute(uvs, 2));
  return g;
};

// Partículas: uma por "pixel" de uma grade 144×72 do monitor.
const particleGeometry = (seed: string) => {
  const nx = 144;
  const ny = 72;
  const uv: number[] = [];
  const sd: number[] = [];
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      uv.push((i + 0.5) / nx, (j + 0.5) / ny);
      sd.push(random(`${seed}-${i}-${j}`));
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(new Array(nx * ny * 3).fill(0), 3));
  g.setAttribute("aUv", new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute("aSeed", new THREE.Float32BufferAttribute(sd, 1));
  return g;
};

const cyan = () => glow(WIRE.cyan, 1);

// ---------------------------------------------------------------- peças

type Look = ReturnType<typeof holoState>;

// Tela + partículas de um trecho (precisa estar dentro do <Sequence> que dá o tempo do filme).
// O quadro do filme chega depois do desenho do quadro do vídeo (o ThreeCanvas só redesenha
// quando o quadro muda): segura o quadro até a textura nova chegar e redesenha na hora. No
// rabo congelado a textura não muda, então não espera.
const ClipScreen: React.FC<{ readonly src: string; readonly look: Look; readonly time: number; readonly particles: boolean; readonly frame: number; readonly frozen: boolean }> = ({
  src,
  look,
  time,
  particles,
  frame,
  frozen,
}) => {
  const tex = useOffthreadVideoTexture({ src: staticFile(src) });
  const advance = useThree((st) => st.advance);
  const hold = useRef<number | null>(null);
  useLayoutEffect(() => {
    if (frozen) {
      return;
    }
    const h = delayRender(`monitor holográfico: quadro ${frame}`);
    hold.current = h;
    return () => {
      hold.current = null;
      continueRender(h);
    };
  }, [frame, frozen]);
  useLayoutEffect(() => {
    if (tex && hold.current !== null) {
      advance(performance.now());
      continueRender(hold.current);
      hold.current = null;
    }
  }, [tex, advance]);
  const { w, h } = HOLO_RECT;
  const screen = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthTest: false,
        depthWrite: false,
        uniforms: {
          uMap: { value: null },
          uCrop: { value: cropOf(w / h) },
          uRes: { value: new THREE.Vector2(w, h) },
          uCyan: { value: cyan() },
          uTime: { value: 0 },
          uGlitch: { value: 0 },
          uDissolve: { value: 0 },
          uFlash: { value: 0 },
          uOpacity: { value: 1 },
        },
        vertexShader: SCREEN_VERT,
        fragmentShader: SCREEN_FRAG,
      }),
    [w, h],
  );
  const parts = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthTest: false,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uMap: { value: null },
          uCrop: { value: cropOf(w / h) },
          uRes: { value: new THREE.Vector2(w, h) },
          uCyan: { value: cyan() },
          uDissolve: { value: 0 },
          uSize: { value: 9 },
          uRef: { value: DEPTH },
        },
        vertexShader: PART_VERT,
        fragmentShader: PART_FRAG,
      }),
    [w, h],
  );
  const pGeo = useMemo(() => particleGeometry("holo"), []);
  if (tex) {
    tex.colorSpace = THREE.SRGBColorSpace;
  }
  screen.uniforms.uMap.value = tex;
  screen.uniforms.uTime.value = time;
  screen.uniforms.uGlitch.value = look.glitch;
  screen.uniforms.uDissolve.value = look.dissolve;
  screen.uniforms.uFlash.value = look.flash;
  parts.uniforms.uMap.value = tex;
  parts.uniforms.uDissolve.value = look.dissolve;
  if (!tex) {
    return null;
  }
  return (
    <>
      <mesh material={screen} renderOrder={901}>
        <planeGeometry args={[w, h]} />
      </mesh>
      {particles && look.p > 0 ? <points geometry={pGeo} material={parts} renderOrder={903} frustumCulled={false} /> : null}
    </>
  );
};

// Moldura de HUD: fio fino em volta e cantoneiras grossas (abrem e somem na dissolução).
const Bezel: React.FC<{ readonly look: Look }> = ({ look }) => {
  const { w, h } = HOLO_RECT;
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color: glow(WIRE.cyan, 1.6), transparent: true, depthTest: false, depthWrite: false, toneMapped: false }), []);
  const thin = useMemo(() => new THREE.MeshBasicMaterial({ color: glow(WIRE.cyan, 1.1), transparent: true, depthTest: false, depthWrite: false, toneMapped: false }), []);
  mat.opacity = 1 - look.p;
  thin.opacity = 0.55 * (1 - look.p);
  const open = 1 + 0.25 * look.p;
  const pad = 22;
  const L = 70;
  const T = 7;
  const bars: [number, number, number, number][] = [];
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      const x = sx * (w / 2 + pad) * open;
      const y = sy * (h / 2 + pad) * open;
      bars.push([x - (sx * L) / 2, y, L, T], [x, y - (sy * L) / 2, T, L]);
    }
  }
  const edges: [number, number, number, number][] = [
    [0, h / 2 + pad, w + pad * 2, 2.5],
    [0, -h / 2 - pad, w + pad * 2, 2.5],
    [-w / 2 - pad, 0, 2.5, h + pad * 2],
    [w / 2 + pad, 0, 2.5, h + pad * 2],
  ];
  return (
    <>
      {edges.map(([x, y, bw, bh], i) => (
        <mesh key={`e${i}`} position={[x * open, y * open, 0]} material={thin} renderOrder={904}>
          <planeGeometry args={[bw, bh]} />
        </mesh>
      ))}
      {bars.map(([x, y, bw, bh], i) => (
        <mesh key={`b${i}`} position={[x, y, 0]} material={mat} renderOrder={904}>
          <planeGeometry args={[bw, bh]} />
        </mesh>
      ))}
    </>
  );
};

// Malha wireframe do monitor: aparece na dissolução, ondula em profundidade, abre e some.
const HoloWire: React.FC<{ readonly look: Look; readonly time: number }> = ({ look, time }) => {
  const { w, h } = HOLO_RECT;
  const geo = useMemo(() => wireGeometry(24, 12, 24), []);
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthTest: false,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { uRes: { value: new THREE.Vector2(w, h) }, uCyan: { value: cyan() }, uP: { value: 0 }, uTime: { value: 0 }, uOpacity: { value: 0 } },
        vertexShader: WIRE_VERT,
        fragmentShader: WIRE_FRAG,
      }),
    [w, h],
  );
  mat.uniforms.uP.value = Math.min(1, look.dissolve / 1.45);
  mat.uniforms.uTime.value = time;
  mat.uniforms.uOpacity.value = 0.9 * Math.sin(Math.PI * Math.min(1, look.dissolve / 1.45));
  if (look.p <= 0) {
    return null;
  }
  return <lineSegments geometry={geo} material={mat} renderOrder={902} frustumCulled={false} />;
};

// Véu escuro entre a cena 3D e o monitor (some na dissolução).
const Veil: React.FC<{ readonly opacity: number }> = ({ opacity }) => {
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color(WIRE.bg0), transparent: true, depthTest: false, depthWrite: false, toneMapped: false }), []);
  mat.opacity = opacity;
  return opacity > 0.001 ? (
    <mesh material={mat} renderOrder={900}>
      <planeGeometry args={[WIDTH * 1.4, HEIGHT * 1.4]} />
    </mesh>
  ) : null;
};

// ---------------------------------------------------------------- monitor

type ShotSpan = { readonly startFrame: number; readonly frames: number };

// Ponto da tela (px) -> mundo, numa profundidade fixa à frente da câmera; e px -> unidades.
const placeAt = (cam: THREE.PerspectiveCamera, fov: number, px: number, py: number, depth: number) => {
  const ndc = new THREE.Vector3((px / WIDTH) * 2 - 1, 1 - (py / HEIGHT) * 2, 0.5).unproject(cam);
  const dir = ndc.sub(cam.position).normalize();
  const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
  const position = cam.position.clone().add(dir.multiplyScalar(depth / dir.dot(fwd)));
  const k = (2 * depth * Math.tan(THREE.MathUtils.degToRad(fov / 2))) / HEIGHT;
  return { position, k };
};

export const HoloMonitor: React.FC<{ readonly intro: HoloIntro; readonly shots: ShotSpan[]; readonly cams: CamSpec[] }> = ({ intro, shots, cams }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const plan = useMemo(() => holoPlan(intro, fps), [intro, fps]);
  const look = holoState(plan, frame);
  if (!look.visible) {
    return null;
  }
  const i = Math.max(0, shots.findIndex((s) => frame >= s.startFrame && frame < s.startFrame + s.frames));
  const st = cameraAt(cams[i], frame - shots[i].startFrame, shots[i].frames, fps);
  const cam = threeCamera(st);
  const mon = placeAt(cam, st.fov, HOLO_RECT.cx, HOLO_RECT.cy, DEPTH);
  const veil = placeAt(cam, st.fov, WIDTH / 2, HEIGHT / 2, VEIL_DEPTH);
  const veilOpacity = VEIL * interpolate(frame, [plan.endF - plan.dissolveF, plan.endF], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const time = frame / fps;
  const last = plan.clips.length - 1;
  return (
    <>
      <group position={veil.position} quaternion={cam.quaternion} scale={veil.k}>
        <Veil opacity={veilOpacity} />
      </group>
      <group position={mon.position} quaternion={cam.quaternion} scale={[mon.k, mon.k * look.on, mon.k]}>
        {plan.clips.map((c, k) => {
          const fromF = Math.round(c.from * fps);
          const tail = k === last ? TAIL : 0;
          if (frame < c.startF || frame >= c.startF + c.lenF + tail) {
            return null;
          }
          // O tempo do filme vem do <Sequence> (começa em `from` quando o trecho entra); no rabo
          // depois do fim, o último quadro fica parado enquanto as partículas voam.
          return (
            <Sequence key={k} from={c.startF - fromF} durationInFrames={fromF + c.lenF + tail} layout="none">
              <Freeze frame={fromF + c.lenF - 1} active={frame >= c.startF + c.lenF}>
                <ClipScreen src={plan.src} look={look} time={time} particles={k === last} frame={frame} frozen={frame >= c.startF + c.lenF} />
              </Freeze>
            </Sequence>
          );
        })}
        <HoloWire look={look} time={time} />
        <Bezel look={look} />
      </group>
    </>
  );
};

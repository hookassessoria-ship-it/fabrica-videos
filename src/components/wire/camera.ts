import { Easing, interpolate } from "remotion";
import * as THREE from "three";
import { HEIGHT, WIDTH } from "./theme";

// Câmera virtual do holograma: sempre em movimento (órbita lenta, dolly, travelling) e com
// um "punch-in" nos primeiros quadros de cada shot. Determinística: a mesma conta é usada
// pelo three.js e pelos rótulos HTML projetados (números, anos), que ficam sempre colados
// no objeto 3D.
export type CamSpec = {
  // Ponto que a câmera olha.
  target?: [number, number, number];
  // Ângulo em volta do alvo (graus), do início ao fim do shot.
  orbit?: [number, number];
  // Distância até o alvo (dolly), do início ao fim.
  radius?: [number, number];
  // Altura relativa ao alvo, do início ao fim.
  height?: [number, number];
  // Deslocamento do alvo ao longo do shot (travelling), somado ao target.
  travel?: [number, number, number];
  fov?: number;
  // Deslocamento da imagem (px) pra o alvo aparecer no centro da área do objeto, não no
  // centro da tela (setViewOffset).
  shift?: [number, number];
};

export const DEFAULT_CAM: Required<CamSpec> = {
  target: [0, 0, 0],
  orbit: [-18, 18],
  radius: [9, 8],
  height: [1.2, 1.6],
  travel: [0, 0, 0],
  fov: 40,
  shift: [0, 0],
};

const ease = Easing.bezier(0.45, 0, 0.25, 1);

export type CamState = { position: THREE.Vector3; target: THREE.Vector3; fov: number; shift: [number, number] };

export const cameraAt = (spec: CamSpec | undefined, frame: number, frames: number, fps: number): CamState => {
  const c = { ...DEFAULT_CAM, ...(spec ?? {}) };
  const p = ease(Math.min(1, Math.max(0, frame / Math.max(1, frames))));
  const lerp = ([a, b]: [number, number]) => a + (b - a) * p;
  // Punch-in: começa 12% mais longe e assenta rápido.
  const punch = 1 + 0.12 * interpolate(frame, [0, 9], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  // Deriva lenta (nada parado).
  const t = frame / fps;
  const theta = THREE.MathUtils.degToRad(lerp(c.orbit) + Math.sin(t * 0.6) * 1.5);
  const r = lerp(c.radius) * punch;
  const target = new THREE.Vector3(...c.target).add(new THREE.Vector3(...c.travel).multiplyScalar(p));
  target.y += Math.sin(t * 0.9) * 0.05;
  const position = new THREE.Vector3(target.x + Math.sin(theta) * r, target.y + lerp(c.height) * punch, target.z + Math.cos(theta) * r);
  return { position, target, fov: c.fov, shift: c.shift };
};

// Aplica o estado numa câmera three.js (a do canvas ou uma avulsa, pra projetar pontos).
export const applyCamera = (cam: THREE.PerspectiveCamera, s: CamState) => {
  cam.fov = s.fov;
  cam.aspect = WIDTH / HEIGHT;
  cam.near = 0.1;
  cam.far = 400;
  cam.position.copy(s.position);
  cam.lookAt(s.target);
  cam.setViewOffset(WIDTH, HEIGHT, s.shift[0], s.shift[1], WIDTH, HEIGHT);
  cam.updateMatrixWorld();
  cam.updateProjectionMatrix();
  return cam;
};

export const threeCamera = (s: CamState) => applyCamera(new THREE.PerspectiveCamera(), s);

// Ponto 3D -> pixel no quadro 1080x1920 (e se está na frente da câmera).
export const project = (cam: THREE.PerspectiveCamera, p: [number, number, number] | THREE.Vector3) => {
  const v = (p instanceof THREE.Vector3 ? p.clone() : new THREE.Vector3(...p)).project(cam);
  return { x: ((v.x + 1) / 2) * WIDTH, y: ((1 - v.y) / 2) * HEIGHT, visible: v.z < 1 && v.z > -1 };
};

export type Rect = { x0: number; x1: number; y0: number; y1: number };

const corners = (b: THREE.Box3) => {
  const out: THREE.Vector3[] = [];
  for (const x of [b.min.x, b.max.x]) {
    for (const y of [b.min.y, b.max.y]) {
      for (const z of [b.min.z, b.max.z]) {
        out.push(new THREE.Vector3(x, y, z));
      }
    }
  }
  return out;
};

// Retângulo na tela que contém a caixa 3D vista por essa câmera.
export const projectBox = (cam: THREE.PerspectiveCamera, box: THREE.Box3) => {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  let visible = true;
  for (const c of corners(box)) {
    const p = project(cam, c);
    visible = visible && p.visible;
    x0 = Math.min(x0, p.x);
    x1 = Math.max(x1, p.x);
    y0 = Math.min(y0, p.y);
    y1 = Math.max(y1, p.y);
  }
  return { x0, x1, y0, y1, visible };
};

// Enquadramento automático: o alvo vai pro centro da caixa, a imagem é deslocada pra esse
// centro cair no meio do retângulo permitido, e a distância (raio e altura juntos) é a
// menor em que a caixa inteira cabe no retângulo em TODOS os quadros do shot (órbita,
// dolly e punch-in incluídos). Nada sai do quadro, nem cruza textos fora do retângulo.
export const fitCamera = (spec: CamSpec, box: THREE.Box3, rect: Rect, frames: number, fps: number): CamSpec => {
  const base = { ...DEFAULT_CAM, ...spec };
  const center = box.getCenter(new THREE.Vector3());
  const shift: [number, number] = [WIDTH / 2 - (rect.x0 + rect.x1) / 2, HEIGHT / 2 - (rect.y0 + rect.y1) / 2];
  const at = (m: number): CamSpec => ({
    ...base,
    target: [center.x, center.y, center.z],
    radius: [base.radius[0] * m, base.radius[1] * m],
    height: [base.height[0] * m, base.height[1] * m],
    shift,
  });
  const samples = Array.from({ length: Math.ceil(frames / 3) + 1 }, (_, i) => Math.min(frames - 1, i * 3));
  const fits = (m: number) =>
    samples.every((f) => {
      const r = projectBox(threeCamera(cameraAt(at(m), f, frames, fps)), box);
      return r.visible && r.x0 >= rect.x0 && r.x1 <= rect.x1 && r.y0 >= rect.y0 && r.y1 <= rect.y1;
    });
  let lo = 0.25;
  let hi = 8;
  if (fits(lo)) {
    return at(lo);
  }
  for (let i = 0; i < 22; i++) {
    const mid = (lo + hi) / 2;
    if (fits(mid)) {
      hi = mid;
    } else {
      lo = mid;
    }
  }
  return at(hi);
};

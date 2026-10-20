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
};

export const DEFAULT_CAM: Required<CamSpec> = {
  target: [0, 0, 0],
  orbit: [-18, 18],
  radius: [9, 8],
  height: [1.2, 1.6],
  travel: [0, 0, 0],
  fov: 40,
};

const ease = Easing.bezier(0.45, 0, 0.25, 1);

export type CamState = { position: THREE.Vector3; target: THREE.Vector3; fov: number };

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
  const position = new THREE.Vector3(target.x + Math.sin(theta) * r, target.y + lerp(c.height), target.z + Math.cos(theta) * r);
  return { position, target, fov: c.fov };
};

// Câmera three.js equivalente (pra projetar pontos 3D na tela).
export const threeCamera = (s: CamState) => {
  const cam = new THREE.PerspectiveCamera(s.fov, WIDTH / HEIGHT, 0.1, 400);
  cam.position.copy(s.position);
  cam.lookAt(s.target);
  cam.updateMatrixWorld();
  cam.updateProjectionMatrix();
  return cam;
};

// Ponto 3D -> pixel no quadro 1080x1920 (e se está na frente da câmera).
export const project = (cam: THREE.PerspectiveCamera, p: [number, number, number]) => {
  const v = new THREE.Vector3(...p).project(cam);
  return { x: ((v.x + 1) / 2) * WIDTH, y: ((1 - v.y) / 2) * HEIGHT, visible: v.z < 1 };
};

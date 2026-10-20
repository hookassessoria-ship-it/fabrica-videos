import { random, spring, useCurrentFrame } from "remotion";

// Movimento "stop-motion": posições só mudam a cada STOP_MOTION_STEP frames.
export const STOP_MOTION_STEP = 2;

export const stepFrame = (frame: number, step = STOP_MOTION_STEP) =>
  Math.floor(frame / step) * step;

export const useStopMotionFrame = (step = STOP_MOTION_STEP) =>
  stepFrame(useCurrentFrame(), step);

// Rotação fixa por elemento, derivada da semente (nunca Math.random).
export const seededRotation = (seed: string, max = 2) =>
  (random(`rot-${seed}`) * 2 - 1) * max;

export const seededRange = (seed: string, min: number, max: number) =>
  min + random(seed) * (max - min);

// Tremidinha de quem reposiciona o recorte a cada quadro.
export const handJitter = (seed: string, frame: number, amount: number) => {
  const step = stepFrame(frame);
  return {
    x: (random(`${seed}-jx-${step}`) - 0.5) * 2 * amount,
    y: (random(`${seed}-jy-${step}`) - 0.5) * 2 * amount,
    r: (random(`${seed}-jr-${step}`) - 0.5) * 2 * amount * 0.25,
  };
};

// Mola com leve quique, usada nas entradas.
export const BOUNCY = { damping: 11, stiffness: 150, mass: 0.8 } as const;
export const SOFT = { damping: 18, stiffness: 90, mass: 1 } as const;

export const popSpring = (
  frame: number,
  fps: number,
  delayFrames: number,
  config: { damping: number; stiffness: number; mass: number } = BOUNCY,
) => spring({ frame: frame - delayFrames, fps, config });

import { createContext, useContext } from "react";
import { Easing, interpolate, random, spring } from "remotion";

// Curvas premium: nada linear.
export const EASE = {
  outExpo: Easing.bezier(0.16, 1, 0.3, 1),
  inExpo: Easing.bezier(0.7, 0, 0.84, 0),
  inOutCubic: Easing.bezier(0.65, 0, 0.35, 1),
  outBack: Easing.bezier(0.34, 1.56, 0.64, 1),
  outQuart: Easing.bezier(0.25, 1, 0.5, 1),
};

// Molas: rápidas que desaceleram, com overshoot pequeno (snappy) ou maior (bouncy).
export const SPRING = {
  snappy: { damping: 14, stiffness: 230, mass: 0.7 },
  bouncy: { damping: 9, stiffness: 190, mass: 0.75 },
  soft: { damping: 18, stiffness: 120, mass: 1 },
  heavy: { damping: 11, stiffness: 140, mass: 1.3 },
} as const;

export type SpringName = keyof typeof SPRING;

export const springAt = (frame: number, fps: number, startFrame: number, name: SpringName = "snappy") =>
  spring({ frame: frame - startFrame, fps, config: SPRING[name] });

export const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

// Contagem (só no número herói): começa em 0, termina em no máximo 0,4s e depois fica
// exatamente no valor final. Gráficos de comparação não contam.
export const COUNT_MAX_S = 0.4;
export const countProgress = (frame: number, fps: number, startFrame: number, seconds = COUNT_MAX_S) =>
  interpolate(frame, [startFrame, startFrame + Math.max(1, Math.min(seconds, COUNT_MAX_S) * fps)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE.outExpo,
  });

// Micro-movimento contínuo: flutuação, rotação lenta e respiração de escala (1 -> ~1.02).
export const idle = (frame: number, fps: number, seed: string, amp = 6) => {
  const t = frame / fps;
  const ph = random(`idle-${seed}`) * Math.PI * 2;
  return {
    x: Math.cos(t * 0.9 + ph) * amp * 0.6,
    y: Math.sin(t * 1.25 + ph) * amp,
    r: Math.sin(t * 0.7 + ph * 1.3) * 0.8,
    s: 1 + (Math.sin(t * 1.6 + ph) * 0.5 + 0.5) * 0.02,
  };
};

// Contexto do shot: palavras (pra enterOnWord), cor do texto (interrupts) e câmera.
export type ShotContext = {
  // Cor padrão do texto (muda em interrupt branco).
  ink: string;
  // Deslocamento da câmera (parallax por profundidade).
  cam: { x: number; y: number };
  // Duração do shot em frames.
  frames: number;
  // Revisão automática (check-numbers): vídeos não são decodificados.
  check?: boolean;
};

const Ctx = createContext<ShotContext>({ ink: "#ffffff", cam: { x: 0, y: 0 }, frames: 60 });
export const ShotProvider = Ctx.Provider;
export const useShot = () => useContext(Ctx);

// Formata em pt-BR: 1.234,56
export const formatBR = (v: number, decimals: number) => {
  const [int, dec] = Math.abs(v).toFixed(decimals).split(".");
  const withDots = int.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${v < 0 ? "-" : ""}${withDots}${dec ? `,${dec}` : ""}`;
};

export const decimalsOf = (v: number) => (Number.isInteger(v) ? 0 : (String(v).split(".")[1]?.length ?? 1));

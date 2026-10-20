import React from "react";
import { interpolate, useVideoConfig } from "remotion";
import { BOUNCY, handJitter, popSpring, seededRotation, useStopMotionFrame } from "./motion";

type From = "below" | "above" | "left" | "right" | "none";

const DIR: Record<From, [number, number]> = {
  below: [0, 1],
  above: [0, -1],
  left: [-1, 0],
  right: [1, 0],
  none: [0, 0],
};

type PopProps = {
  readonly children: React.ReactNode;
  readonly seed: string;
  readonly x?: number;
  readonly y?: number;
  // Segundos (relativos à cena) em que o recorte entra.
  readonly at?: number;
  // Segundos em que sai (cai pra fora). Opcional.
  readonly exitAt?: number;
  readonly from?: From;
  readonly distance?: number;
  // Rotação extra além da rotação aleatória fixa (±maxTilt°).
  readonly rotate?: number;
  readonly maxTilt?: number;
  readonly scale?: number;
  readonly jitter?: number;
};

// Entrada de recorte: quique de mola, rotação fixa por semente,
// tremidinha de stop-motion. Tudo atualizado a cada 2 frames.
export const Pop: React.FC<PopProps> = ({
  children,
  seed,
  x = 0,
  y = 0,
  at = 0,
  exitAt,
  from = "below",
  distance = 90,
  rotate = 0,
  maxTilt = 2,
  scale = 1,
  jitter = 0.6,
}) => {
  const frame = useStopMotionFrame();
  const { fps } = useVideoConfig();
  const start = Math.round(at * fps);
  if (frame < start) {
    return null;
  }
  const s = popSpring(frame, fps, start, BOUNCY);
  const out = exitAt === undefined ? 0 : popSpring(frame, fps, Math.round(exitAt * fps), { damping: 20, stiffness: 120, mass: 1 });
  if (out > 0.98) {
    return null;
  }
  const [dx, dy] = DIR[from];
  const tilt = seededRotation(seed, maxTilt) + rotate;
  const sign = tilt >= 0 ? 1 : -1;
  const j = handJitter(seed, frame, jitter);
  const tx = x + dx * distance * (1 - s) + j.x;
  const ty = y + dy * distance * (1 - s) + j.y + out * 260;
  const r = tilt + (1 - s) * 7 * sign + j.r + out * 18 * sign;
  const sc = scale * interpolate(s, [0, 1], [0.6, 1]);
  const opacity = interpolate(s, [0, 0.2], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) * (1 - out);

  return (
    <g transform={`translate(${tx} ${ty}) rotate(${r}) scale(${sc})`} opacity={opacity}>
      {children}
    </g>
  );
};

// Posicionamento simples (sem animação), com a rotação fixa por semente.
export const Place: React.FC<{
  readonly children: React.ReactNode;
  readonly x?: number;
  readonly y?: number;
  readonly rotate?: number;
  readonly scale?: number;
  readonly seed?: string;
  readonly maxTilt?: number;
}> = ({ children, x = 0, y = 0, rotate = 0, scale = 1, seed, maxTilt = 2 }) => {
  const r = rotate + (seed ? seededRotation(seed, maxTilt) : 0);
  return <g transform={`translate(${x} ${y}) rotate(${r}) scale(${scale})`}>{children}</g>;
};

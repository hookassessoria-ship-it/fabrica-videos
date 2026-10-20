import React from "react";
import { interpolate, random, spring, useCurrentFrame, useVideoConfig } from "remotion";

// Mola com overshoot: o elemento "bate" e assenta.
export const LAND_SPRING = { damping: 11, stiffness: 170, mass: 0.9 } as const;
const MOVE_SPRING = { damping: 15, stiffness: 120, mass: 1 } as const;

export const seededTilt = (seed: string, max = 6) => (random(`tilt-${seed}`) * 2 - 1) * max;

export const useLand = (at: number) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const start = Math.round(at * fps);
  return { visible: frame >= start, s: spring({ frame: frame - start, fps, config: LAND_SPRING }) };
};

// Movimento depois da entrada (já resolvido em segundos da cena).
export type Move = { at: number; x?: number; y?: number; scale?: number; rotate?: number };

type LandProps = {
  readonly children: React.ReactNode;
  readonly seed: string;
  // Centro do elemento no quadro.
  readonly x: number;
  readonly y: number;
  readonly at?: number;
  readonly rotate?: number;
  readonly maxTilt?: number;
  readonly scale?: number;
  readonly moves?: Move[];
  // Flutuação (px) depois de assentar; 0 desliga.
  readonly float?: number;
  // Sombra: o elemento cai do ar (sombra grande) e assenta (sombra curta).
  readonly shadow?: boolean;
  readonly zIndex?: number;
  // "center" (padrão) ou "left" (x = borda esquerda).
  readonly anchor?: "center" | "left";
};

// Entrada de recorte colado: cai de cima, maior, gira e bate no lugar.
// Depois pode se mover (moves) e flutua de leve.
export const Land: React.FC<LandProps> = ({
  children,
  seed,
  x,
  y,
  at = 0,
  rotate,
  maxTilt = 6,
  scale = 1,
  moves = [],
  float = 4,
  shadow = true,
  zIndex,
  anchor = "center",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { visible, s } = useLand(at);
  if (!visible) {
    return null;
  }
  const tilt = rotate ?? seededTilt(seed, maxTilt);
  const sign = tilt >= 0 ? 1 : -1;
  const lift = interpolate(s, [0, 1], [1, 0]);

  let X = x;
  let Y = y;
  let S = scale;
  let R = tilt;
  let moving = 0;
  for (const m of moves) {
    const start = Math.round(m.at * fps);
    if (frame < start) {
      break;
    }
    const ms = spring({ frame: frame - start, fps, config: MOVE_SPRING });
    X += ((m.x ?? X) - X) * ms;
    Y += ((m.y ?? Y) - Y) * ms;
    S += ((m.scale ?? S) - S) * ms;
    R += ((m.rotate ?? R) - R) * ms;
    moving = Math.max(moving, 1 - Math.min(1, ms));
  }

  // Flutuação lenta, com fase própria por peça, entrando aos poucos depois do pouso.
  const t = (frame - at * fps) / fps;
  const phase = random(`float-${seed}`) * Math.PI * 2;
  const ramp = interpolate(frame - at * fps, [12, 36], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const fx = Math.cos(t * 1.1 + phase) * float * 0.5 * ramp;
  const fy = Math.sin(t * 1.5 + phase) * float * ramp;
  const fr = Math.sin(t * 1.3 + phase * 1.7) * 0.35 * ramp * (float > 0 ? 1 : 0);
  const air = Math.max(lift, moving * 0.35);

  return (
    <div
      style={{
        position: "absolute",
        left: X + fx,
        top: Y + fy,
        width: 0,
        height: 0,
        zIndex,
        translate: `0px ${-70 * lift}px`,
        scale: S * interpolate(s, [0, 1], [1.24, 1]),
        rotate: `${R + fr + lift * 10 * sign}deg`,
        opacity: interpolate(s, [0, 0.18], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          translate: anchor === "left" ? "0 -50%" : "-50% -50%",
          filter: shadow ? `drop-shadow(0px ${10 + 34 * air}px ${12 + 26 * air}px rgba(0,0,0,0.55))` : undefined,
        }}
      >
        {children}
      </div>
    </div>
  );
};

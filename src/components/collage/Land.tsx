import React from "react";
import { interpolate, random, spring, useCurrentFrame, useVideoConfig } from "remotion";

// Mola com overshoot: o elemento "bate" e assenta.
export const LAND_SPRING = { damping: 11, stiffness: 170, mass: 0.9 } as const;

export const seededTilt = (seed: string, max = 6) => (random(`tilt-${seed}`) * 2 - 1) * max;

export const useLand = (at: number) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const start = Math.round(at * fps);
  return { visible: frame >= start, s: spring({ frame: frame - start, fps, config: LAND_SPRING }) };
};

type LandProps = {
  readonly children: React.ReactNode;
  readonly seed: string;
  // Centro do elemento no quadro.
  readonly x: number;
  readonly y: number;
  readonly at?: number;
  readonly rotate?: number;
  readonly maxTilt?: number;
  // Sombra: o elemento cai do ar (sombra grande) e assenta (sombra curta).
  readonly shadow?: boolean;
  readonly zIndex?: number;
};

// Entrada de recorte colado: cai de cima, maior, gira e bate no lugar.
export const Land: React.FC<LandProps> = ({
  children,
  seed,
  x,
  y,
  at = 0,
  rotate,
  maxTilt = 6,
  shadow = true,
  zIndex,
}) => {
  const { visible, s } = useLand(at);
  if (!visible) {
    return null;
  }
  const tilt = rotate ?? seededTilt(seed, maxTilt);
  const sign = tilt >= 0 ? 1 : -1;
  const lift = interpolate(s, [0, 1], [1, 0]);
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: 0,
        height: 0,
        zIndex,
        translate: `0px ${-70 * lift}px`,
        scale: interpolate(s, [0, 1], [1.24, 1]),
        rotate: `${tilt + lift * 10 * sign}deg`,
        opacity: interpolate(s, [0, 0.18], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          translate: "-50% -50%",
          filter: shadow
            ? `drop-shadow(0px ${10 + 34 * Math.max(0, lift)}px ${12 + 26 * Math.max(0, lift)}px rgba(0,0,0,0.55))`
            : undefined,
        }}
      >
        {children}
      </div>
    </div>
  );
};

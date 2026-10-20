import React from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { EnterPreset } from "../../templates/kineticTypes";
import { clamp01, EASE, idle, springAt, useShot } from "./motion";

const DEPTH_PARALLAX = [0.35, 1, 1.7];

type PieceProps = {
  readonly children: React.ReactNode;
  readonly seed: string;
  readonly x: number;
  readonly y: number;
  // Segundos (do shot) em que entra.
  readonly at: number;
  readonly enter?: EnterPreset;
  readonly exitAt?: number;
  readonly depth?: 0 | 1 | 2;
  readonly scale?: number;
  readonly rotate?: number;
  readonly tilt?: boolean;
  readonly float?: number;
  readonly zIndex?: number;
};

// Entrada (com overshoot e assentamento) + micro-movimento contínuo + saída com antecipação.
// Tudo que entra rápido ganha blur proporcional à velocidade.
const enterState = (preset: EnterPreset, frame: number, fps: number, start: number) => {
  const f = frame - start;
  switch (preset) {
    case "pop": {
      const s = springAt(frame, fps, start, "bouncy");
      // squash & stretch logo depois de bater
      const sq = Math.exp(-f / 5) * Math.sin(f * 0.9) * 0.16;
      return { dx: 0, dy: 0, sx: s * (1 + sq), sy: s * (1 - sq), r: 0, o: clamp01(s * 4), blur: 0 };
    }
    case "zoom": {
      const p = interpolate(f, [0, 0.45 * fps], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE.outExpo });
      const sc = interpolate(p, [0, 1], [2.4, 1]);
      return { dx: 0, dy: 0, sx: sc, sy: sc, r: 0, o: clamp01(p * 3), blur: (1 - p) * 18 };
    }
    case "drop": {
      const s = springAt(frame, fps, start, "bouncy");
      return { dx: 0, dy: (1 - s) * -420, sx: 1, sy: 1, r: (1 - s) * -8, o: clamp01(s * 3), blur: 0 };
    }
    case "blur": {
      const p = interpolate(f, [0, 0.5 * fps], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE.outExpo });
      return { dx: 0, dy: 0, sx: 1.12 - 0.12 * p, sy: 1.12 - 0.12 * p, r: 0, o: p, blur: (1 - p) * 22 };
    }
    case "instant":
      return { dx: 0, dy: 0, sx: 1, sy: 1, r: 0, o: 1, blur: 0 };
    case "none": {
      const o = interpolate(f, [0, 4], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
      return { dx: 0, dy: 0, sx: 1, sy: 1, r: 0, o, blur: 0 };
    }
    default: {
      const s = springAt(frame, fps, start, "snappy");
      const dist = 260;
      const dir = { up: [0, 1], down: [0, -1], left: [1, 0], right: [-1, 0] }[preset] ?? [0, 1];
      return { dx: dir[0] * dist * (1 - s), dy: dir[1] * dist * (1 - s), sx: 1, sy: 1, r: 0, o: clamp01(s * 2.5), blur: 0 };
    }
  }
};

export const Piece: React.FC<PieceProps> = ({
  children,
  seed,
  x,
  y,
  at,
  enter = "up",
  exitAt,
  depth = 1,
  scale = 1,
  rotate = 0,
  tilt = false,
  float = 6,
  zIndex,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { cam } = useShot();
  const start = Math.round(at * fps);
  if (frame < start) {
    return null;
  }
  const e = enterState(enter, frame, fps, start);
  const prev = frame > start ? enterState(enter, frame - 1, fps, start) : e;
  // Blur proporcional à velocidade (motion blur aproximado).
  const speed = Math.hypot(e.dx - prev.dx, e.dy - prev.dy) + Math.abs(e.sx - prev.sx) * 400;
  let blur = e.blur + Math.min(16, speed * 0.12);

  // Saída: antecipação (encolhe/recua) e depois sai rápido, crescendo e desfocando.
  let ex = { s: 1, o: 1, dy: 0 };
  if (exitAt !== undefined) {
    const exitF = Math.round(exitAt * fps);
    const anticip = interpolate(frame, [exitF - 6, exitF], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE.inOutCubic });
    const out = interpolate(frame, [exitF, exitF + 8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE.inExpo });
    if (out >= 1) {
      return null;
    }
    ex = { s: 1 - 0.07 * anticip + out * 0.6, o: 1 - out, dy: -40 * out };
    blur += out * 16;
  }

  const id = idle(frame, fps, seed, float);
  const k = DEPTH_PARALLAX[depth];
  const tiltX = tilt ? Math.sin(frame / fps * 0.8 + x * 0.01) * 7 : 0;
  const tiltY = tilt ? Math.cos(frame / fps * 0.6 + y * 0.01) * 10 + (1 - Math.min(1, e.o)) * 30 : 0;

  return (
    <div
      style={{
        position: "absolute",
        left: x + e.dx + id.x + cam.x * k,
        top: y + e.dy + id.y + ex.dy + cam.y * k,
        width: 0,
        height: 0,
        zIndex,
        opacity: e.o * ex.o,
        perspective: tilt ? 1400 : undefined,
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          translate: "-50% -50%",
          transform: `${tilt ? `rotateX(${tiltX}deg) rotateY(${tiltY}deg) ` : ""}rotate(${rotate + e.r + id.r}deg) scale(${scale * e.sx * id.s * ex.s}, ${scale * e.sy * id.s * ex.s})`,
          filter: blur > 0.5 ? `blur(${blur.toFixed(1)}px)` : undefined,
        }}
      >
        {children}
      </div>
    </div>
  );
};

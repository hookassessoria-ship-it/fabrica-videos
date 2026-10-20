import React from "react";
import { interpolate, random, useCurrentFrame, useVideoConfig } from "remotion";
import { useCollageTheme } from "../../brand/collageTheme";
import { withAlpha } from "../../brand/color";
import { COUNT_MAX_S, countProgress, decimalsOf, EASE, formatBR, useShot } from "./motion";

type ParticlesProps = {
  readonly seed: string;
  // Segundo (do shot) da explosão.
  readonly at: number;
  readonly count?: number;
  readonly spread?: number;
  readonly kind?: "dots" | "sparks" | "confetti";
};

// Explosão de partículas no momento de impacto (determinística por seed).
export const Particles: React.FC<ParticlesProps> = ({ seed, at, count = 26, spread = 420, kind = "confetti" }) => {
  const { c } = useCollageTheme();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame - at * fps;
  const life = 0.9 * fps;
  if (t < 0 || t > life) {
    return null;
  }
  const p = EASE.outExpo(t / life);
  const colors = ["#ffffff", c.accent, c.cream, c.accentLight];
  return (
    <div style={{ position: "absolute", left: 0, top: 0, width: 0, height: 0, pointerEvents: "none" }}>
      {Array.from({ length: count }).map((_, i) => {
        const r = (k: string) => random(`${seed}-p${i}-${k}`);
        const ang = r("a") * Math.PI * 2;
        const dist = spread * (0.35 + r("d") * 0.65) * p;
        const x = Math.cos(ang) * dist;
        const y = Math.sin(ang) * dist + 160 * (t / life) ** 2;
        const size = 6 + r("s") * 12;
        const shape = kind === "dots" ? "dot" : kind === "sparks" ? "spark" : (["dot", "square", "spark"] as const)[Math.floor(r("k") * 3)];
        const o = 1 - (t / life) ** 1.6;
        const col = colors[Math.floor(r("c") * colors.length)];
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x,
              top: y,
              width: shape === "spark" ? size * 2.4 : size,
              height: shape === "spark" ? 3 : size,
              translate: "-50% -50%",
              rotate: shape === "spark" ? `${(ang * 180) / Math.PI}deg` : `${r("r") * 360 + t * 12}deg`,
              borderRadius: shape === "dot" ? "50%" : 2,
              backgroundColor: col,
              opacity: o,
              boxShadow: `0 0 10px ${withAlpha(col, 0.8)}`,
            }}
          />
        );
      })}
    </div>
  );
};

type BigNumberProps = {
  readonly seed: string;
  readonly value: number;
  readonly at: number;
  readonly decimals?: number;
  readonly prefix?: string;
  readonly suffix?: string;
  readonly size?: number;
  readonly duration?: number;
  readonly color?: "text" | "accent";
  readonly particles?: boolean;
  readonly label?: string;
};

// Número enorme contando, com unidade menor, brilho e partículas no fim.
export const BigNumber: React.FC<BigNumberProps> = ({
  seed,
  value,
  at,
  decimals,
  prefix = "",
  suffix = "",
  size = 300,
  duration = COUNT_MAX_S,
  color = "text",
  particles = true,
  label,
}) => {
  const { c, f } = useCollageTheme();
  const { ink } = useShot();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const start = at * fps;
  const count = Math.min(duration, COUNT_MAX_S);
  const end = start + count * fps;
  const p = countProgress(frame, fps, start, count);
  const d = decimals ?? decimalsOf(value);
  // Brilho que estoura no fim da contagem e assenta.
  const flash = interpolate(frame, [end - 2, end + 3, end + 18], [0, 1, 0.35], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const kick = interpolate(frame, [end - 1, end + 3, end + 10], [1, 1.08, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE.outQuart });
  const fill = color === "accent" ? c.accent : ink;
  return (
    <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center" }}>
      {label ? (
        <div style={{ fontFamily: f.mono, fontSize: size * 0.12, letterSpacing: 6, color: fill, opacity: 0.85, marginBottom: size * 0.02 }}>{label}</div>
      ) : null}
      <div
        data-bigtext="box"
        style={{
          display: "flex",
          alignItems: "flex-start",
          fontFamily: f.sans,
          fontWeight: 900,
          fontSize: size,
          lineHeight: 0.9,
          letterSpacing: "-0.05em",
          fontVariantNumeric: "tabular-nums",
          color: fill,
          scale: kick,
          textShadow: `0 0 ${20 + 60 * flash}px ${withAlpha(c.accent, 0.35 + 0.5 * flash)}, 0 8px 40px rgba(26,4,32,0.45)`,
        }}
      >
        <span data-num={0} data-counting={p < 1 ? 1 : undefined}>
          {prefix}
          {formatBR(p >= 1 ? value : value * p, d)}
        </span>
        <span style={{ fontSize: size * 0.42, marginTop: size * 0.08, marginLeft: size * 0.03, letterSpacing: "-0.02em" }}>{suffix}</span>
      </div>
      {particles ? (
        <div style={{ position: "absolute", left: "50%", top: "55%" }}>
          <Particles seed={`${seed}-burst`} at={at + count} count={30} spread={size * 1.6} />
        </div>
      ) : null}
    </div>
  );
};

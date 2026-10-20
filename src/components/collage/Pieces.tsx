import React from "react";
import { Easing, interpolate, random, useCurrentFrame, useVideoConfig } from "remotion";
import { useCollageTheme } from "../../brand/collageTheme";
import { PrintOverlay } from "./PrintOverlay";
import { roughPolygonPct } from "./torn";

// Formata em pt-BR: 1.234,5
const formatBR = (v: number, decimals: number) => {
  const [int, dec] = Math.abs(v).toFixed(decimals).split(".");
  const withDots = int.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${v < 0 ? "-" : ""}${withDots}${dec ? `,${dec}` : ""}`;
};

type CountUpProps = {
  readonly value: number;
  readonly at: number;
  readonly from?: number;
  readonly duration?: number;
  readonly decimals?: number;
  readonly prefix?: string;
  readonly suffix?: string;
  readonly size?: number;
  readonly color?: "text" | "accent" | "cream";
};

// Número grande (fonte display) contando de `from` até `value`, com contorno de adesivo.
export const CountUp: React.FC<CountUpProps> = ({
  value,
  at,
  from = 0,
  duration = 0.9,
  decimals,
  prefix = "",
  suffix = "",
  size = 220,
  color = "accent",
}) => {
  const { c, f } = useCollageTheme();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const d = decimals ?? (Number.isInteger(value) ? 0 : (String(value).split(".")[1]?.length ?? 1));
  const p = interpolate(frame, [at * fps, (at + duration) * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const fill = color === "accent" ? c.accent : color === "cream" ? c.cream : c.text;
  return (
    <div
      style={{
        fontFamily: f.display,
        fontSize: size,
        lineHeight: 0.9,
        color: fill,
        WebkitTextStroke: `${size * 0.07}px ${c.paperWhite}`,
        paintOrder: "stroke fill",
        whiteSpace: "nowrap",
        letterSpacing: 2,
      }}
    >
      {prefix}
      {formatBR(from + (value - from) * p, d)}
      {suffix}
    </div>
  );
};

// Etiqueta de preço de papel creme, com furo e barbante.
export const PriceTag: React.FC<{ readonly text: string; readonly sub?: string; readonly seed: string; readonly size?: number }> = ({
  text,
  sub,
  seed,
  size = 96,
}) => {
  const { c, f } = useCollageTheme();
  const h = Math.round(size * (sub ? 1.9 : 1.5));
  const w = Math.round(text.length * size * 0.52 + h * 0.65);
  const tip = h * 0.36;
  const j = (k: string) => (random(`${seed}-${k}`) - 0.5) * 6;
  const shape = `polygon(${tip + j("a")}px ${j("b")}px, ${w + j("c")}px ${j("d")}px, ${w + j("e")}px ${h + j("f")}px, ${tip + j("g")}px ${h + j("h")}px, ${j("i")}px ${h / 2}px)`;
  const holeX = tip * 0.72;
  return (
    <div style={{ position: "relative", width: w, height: h }}>
      <svg width={w} height={h} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
        <path
          d={`M${holeX} ${h / 2} C${-h * 0.4} ${h * 0.2}, ${-h * 0.6} ${h * 0.9}, ${-h * 0.9} ${h * 0.45}`}
          stroke={c.cream}
          strokeWidth={5}
          fill="none"
          strokeLinecap="round"
        />
      </svg>
      <div style={{ position: "absolute", inset: 0, backgroundColor: c.cream, clipPath: shape }}>
        <PrintOverlay halftone={0.1} grain={0.3} />
      </div>
      <div
        style={{
          position: "absolute",
          left: holeX - h * 0.07,
          top: h / 2 - h * 0.07,
          width: h * 0.14,
          height: h * 0.14,
          borderRadius: "50%",
          backgroundColor: c.background,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: tip * 1.1,
          right: 0,
          top: 0,
          bottom: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          color: c.ink,
        }}
      >
        {sub ? <div style={{ fontFamily: f.mono, fontWeight: 700, fontSize: size * 0.26, letterSpacing: 4 }}>{sub}</div> : null}
        <div style={{ fontFamily: f.display, fontSize: size, lineHeight: 1 }}>{text}</div>
      </div>
    </div>
  );
};

// Pedaço de fita adesiva semitransparente, solto na colagem.
export const TapePiece: React.FC<{ readonly seed: string; readonly width?: number }> = ({ seed, width = 190 }) => {
  const { c } = useCollageTheme();
  return (
    <div
      style={{
        width,
        height: width * 0.28,
        backgroundColor: c.tape,
        clipPath: roughPolygonPct(`${seed}-tape`, 3),
      }}
    />
  );
};

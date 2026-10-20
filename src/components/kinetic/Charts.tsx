import React from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { useCollageTheme } from "../../brand/collageTheme";
import { withAlpha } from "../../brand/color";
import type { BarDatum } from "../../templates/kineticTypes";
import { clamp01, decimalsOf, EASE, formatBR, springAt, useShot } from "./motion";

const BAR_STAGGER = 3;

type BarsProps = {
  readonly data: BarDatum[];
  readonly at: number;
  readonly width?: number;
  readonly height?: number;
  readonly max?: number;
  readonly unit?: string;
  // Match cut: o valor dessa barra começa enorme no centro (onde estava o número
  // grande do shot anterior) e voa até o topo da barra.
  readonly morphFrom?: number;
  // Posição (no gráfico) de onde o valor do morph sai.
  readonly morphOrigin?: { x: number; y: number; size: number };
  readonly bracket?: { from: number; to: number; label: string; at: number };
};

// Barras crescendo em cascata com overshoot; valores contam junto.
export const BarChart: React.FC<BarsProps> = ({ data, at, width = 880, height = 620, max, unit = "%", morphFrom, morphOrigin, bracket }) => {
  const { c, f } = useCollageTheme();
  const { ink } = useShot();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const start = Math.round(at * fps);
  const top = max ?? Math.max(...data.map((d) => d.value)) * 1.12;
  const slot = width / data.length;
  const bw = slot * 0.64;
  // Rótulo "4,31%" (~5 caracteres) cabe na largura da coluna.
  // Legível no celular: nunca abaixo de 34px.
  const valueSize = Math.max(34, Math.min(44, slot * 0.3));
  const base = interpolate(frame, [start, start + 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE.outExpo });

  return (
    <div style={{ position: "relative", width, height: height + 70 }}>
      <div
        style={{
          position: "absolute",
          left: -20,
          right: -20,
          top: height,
          height: 4,
          borderRadius: 4,
          backgroundColor: withAlpha(ink, 0.6),
          transformOrigin: "left center",
          scale: `${base} 1`,
        }}
      />
      {data.map((d, i) => {
        const s0 = start + 4 + i * BAR_STAGGER;
        const s = Math.max(0, springAt(frame, fps, s0, "bouncy"));
        const h = (d.value / top) * height * s;
        const x = i * slot + (slot - bw) / 2;
        // Sem contagem: o valor final aparece pronto, com pop, quando a barra termina de crescer.
        const labelStart = s0 + 11;
        const pop = frame < labelStart ? 0 : springAt(frame, fps, labelStart, "bouncy");
        const isMorph = morphFrom === i && morphOrigin;
        // Valor do morph: sai grande do centro e pousa no topo da barra.
        const mp = isMorph ? interpolate(frame, [start, start + 16], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE.inOutCubic }) : 1;
        const labelX = x + bw / 2;
        const labelY = height - h - valueSize * 0.9;
        const lx = isMorph ? morphOrigin.x + (labelX - morphOrigin.x) * mp : labelX;
        const ly = isMorph ? morphOrigin.y + (labelY - morphOrigin.y) * mp : labelY;
        const lsize = isMorph ? morphOrigin.size + (valueSize * 1.25 - morphOrigin.size) * mp : d.highlight ? valueSize * 1.25 : valueSize;
        const text = d.display ?? `${formatBR(d.value, decimalsOf(d.value))}${unit}`;
        return (
          <React.Fragment key={d.label}>
            <div
              style={{
                position: "absolute",
                left: x,
                top: height - h,
                width: bw,
                height: h,
                borderRadius: `${bw * 0.22}px ${bw * 0.22}px 6px 6px`,
                backgroundColor: d.highlight ? c.accent : withAlpha("#ffffff", 0.82),
                boxShadow: d.highlight ? `0 0 50px ${withAlpha(c.accent, 0.75)}, 0 20px 40px rgba(26,4,32,0.25)` : "0 18px 36px rgba(26,4,32,0.22)",
              }}
            />
            <div
              style={{
                position: "absolute",
                left: lx,
                top: ly,
                translate: "-50% -50%",
                fontFamily: f.sans,
                fontWeight: 900,
                fontSize: lsize,
                letterSpacing: "-0.04em",
                fontVariantNumeric: "tabular-nums",
                color: ink,
                opacity: isMorph ? 1 : clamp01(pop * 3),
                scale: isMorph ? 1 : Math.max(0, pop),
                whiteSpace: "nowrap",
                textShadow: "0 4px 18px rgba(26,4,32,0.4)",
              }}
              data-num={i}
              data-main={1}
            >
              {text}
            </div>
            <div
              style={{
                position: "absolute",
                left: x + bw / 2,
                top: height + 22,
                translate: "-50% 0",
                fontFamily: f.mono,
                fontSize: Math.min(28, slot * 0.24),
                color: ink,
                opacity: 0.85 * clamp01(s * 2),
              }}
            >
              {d.label}
            </div>
          </React.Fragment>
        );
      })}
      {bracket ? <Bracket {...bracket} data={data} top={top} height={height} slot={slot} /> : null}
    </div>
  );
};

// Chave desenhada sobre um intervalo de barras, com rótulo.
const Bracket: React.FC<{
  readonly from: number;
  readonly to: number;
  readonly label: string;
  readonly at: number;
  readonly data: BarDatum[];
  readonly top: number;
  readonly height: number;
  readonly slot: number;
}> = ({ from, to, label, at, data, top, height, slot }) => {
  const { c, f } = useCollageTheme();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = interpolate(frame, [at * fps, at * fps + 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE.outExpo });
  const s = springAt(frame, fps, Math.round(at * fps) + 8, "bouncy");
  if (p <= 0) {
    return null;
  }
  const peak = Math.max(...data.slice(from, to + 1).map((d) => d.value));
  const y = height - (peak / top) * height - 120;
  const x1 = from * slot + 10;
  const x2 = (to + 1) * slot - 10;
  const d = `M${x1} ${y + 24} L${x1} ${y} L${x2} ${y} L${x2} ${y + 24}`;
  return (
    <>
      <svg style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }} width={1} height={1}>
        <path d={d} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - p} stroke={c.accent} strokeWidth={8} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div
        style={{
          position: "absolute",
          left: (x1 + x2) / 2,
          top: y - 46,
          translate: "-50% -50%",
          scale: Math.max(0, s),
          padding: "10px 22px",
          borderRadius: 999,
          backgroundColor: c.accent,
          color: "#fff",
          fontFamily: f.sans,
          fontWeight: 900,
          fontSize: 40,
          letterSpacing: "-0.02em",
          whiteSpace: "nowrap",
          boxShadow: `0 0 30px ${withAlpha(c.accent, 0.6)}`,
        }}
      >
        {label}
      </div>
    </>
  );
};

// Linha que se desenha com ponto brilhante na ponta; valores aparecem quando a ponta passa.
export const LineChart: React.FC<{
  readonly points: number[];
  readonly at: number;
  readonly labels?: string[];
  readonly width?: number;
  readonly height?: number;
  readonly unit?: string;
}> = ({ points, at, labels = [], width = 820, height = 420, unit = "%" }) => {
  const { c, f } = useCollageTheme();
  const { ink } = useShot();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = interpolate(frame, [at * fps, at * fps + 1.1 * fps], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE.inOutCubic });
  const lo = Math.min(...points) * 0.8;
  const hi = Math.max(...points) * 1.15;
  const pts = points.map((v, i) => [(i / (points.length - 1)) * width, height - ((v - lo) / (hi - lo)) * height] as const);
  const d = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const seg = p * (pts.length - 1);
  const i0 = Math.min(pts.length - 2, Math.floor(seg));
  const tt = seg - i0;
  const tip = [pts[i0][0] + (pts[i0 + 1][0] - pts[i0][0]) * tt, pts[i0][1] + (pts[i0 + 1][1] - pts[i0][1]) * tt];
  const glow = 0.6 + Math.sin(frame / 4) * 0.4;
  return (
    <div style={{ position: "relative", width, height: height + 60 }}>
      <svg width={width} height={height} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
        <path d={d} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - p} stroke={ink} strokeWidth={9} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        {p > 0 ? (
          <>
            <circle cx={tip[0]} cy={tip[1]} r={26 * glow} fill={withAlpha(c.accent, 0.35)} />
            <circle cx={tip[0]} cy={tip[1]} r={13} fill={c.accent} stroke="#fff" strokeWidth={4} />
          </>
        ) : null}
      </svg>
      {pts.map(([x, y], i) => {
        const reached = seg >= i - 0.02;
        const s = reached ? springAt(frame, fps, Math.round(at * fps + (i / (pts.length - 1)) * 1.1 * fps), "bouncy") : 0;
        return (
          <React.Fragment key={i}>
            <div
              data-num={i}
              data-main={1}
              style={{ position: "absolute", left: x, top: y - 46, translate: "-50% -50%", scale: Math.max(0, s), fontFamily: f.sans, fontWeight: 900, fontSize: 38, color: ink, letterSpacing: "-0.03em", whiteSpace: "nowrap", textShadow: "0 4px 16px rgba(26,4,32,0.4)" }}
            >
              {formatBR(points[i], decimalsOf(points[i]))}
              {unit}
            </div>
            {labels[i] ? (
              <div style={{ position: "absolute", left: x, top: height + 26, translate: "-50% 0", fontFamily: f.mono, fontSize: 26, color: ink, opacity: 0.85 * Math.min(1, s) }}>{labels[i]}</div>
            ) : null}
          </React.Fragment>
        );
      })}
    </div>
  );
};

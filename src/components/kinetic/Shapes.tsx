import React from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { useCollageTheme } from "../../brand/collageTheme";
import { withAlpha } from "../../brand/color";
import { clamp01, EASE, springAt, useShot } from "./motion";

type ShapeProps = {
  readonly shape: "ring" | "circle" | "line" | "arrow" | "underline" | "bracket" | "cross" | "square";
  readonly at: number;
  readonly w?: number;
  readonly h?: number;
  // Para "line"/"arrow": deslocamento até a ponta (relativo ao início).
  readonly dx?: number;
  readonly dy?: number;
  readonly color?: string;
  readonly stroke?: number;
};

// Formas que se desenham (anéis, linhas, setas, sublinhados, chaves, cruzinhas)
// e depois seguem girando/respirando devagar.
export const Shape: React.FC<ShapeProps> = ({ shape, at, w = 300, h = 300, dx = 300, dy = 0, color, stroke = 8 }) => {
  const { c } = useCollageTheme();
  const { ink } = useShot();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const start = at * fps;
  const p = interpolate(frame, [start, start + 16], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE.outExpo });
  const t = (frame - start) / fps;
  const col = color ?? ink;
  const common = { stroke: col, strokeWidth: stroke, fill: "none", strokeLinecap: "round" as const, strokeLinejoin: "round" as const, pathLength: 1, strokeDasharray: 1, strokeDashoffset: 1 - p };
  switch (shape) {
    case "ring":
      return (
        <svg width={w} height={w} style={{ overflow: "visible", rotate: `${t * 30}deg` }}>
          <circle cx={w / 2} cy={w / 2} r={w / 2 - stroke} {...common} />
          <circle cx={w / 2} cy={w / 2} r={w / 2 - stroke * 3.5} stroke={withAlpha(col, 0.35)} strokeWidth={stroke * 0.5} fill="none" strokeDasharray="4 14" opacity={p} />
        </svg>
      );
    case "circle": {
      const s = springAt(frame, fps, Math.round(start), "bouncy");
      return <div style={{ width: w, height: w, borderRadius: "50%", backgroundColor: color ?? c.accent, scale: Math.max(0, s), boxShadow: `0 0 60px ${withAlpha(color ?? c.accent, 0.6)}` }} />;
    }
    case "square":
      return <div style={{ width: w, height: w, border: `${stroke}px solid ${col}`, borderRadius: w * 0.18, rotate: `${45 + t * 25}deg`, scale: p, opacity: 0.9 }} />;
    case "cross":
      return (
        <svg width={w} height={w} style={{ overflow: "visible", rotate: `${t * 60}deg` }}>
          <path d={`M${w / 2} 0 V${w} M0 ${w / 2} H${w}`} {...common} />
        </svg>
      );
    case "underline": {
      const d = Array.from({ length: 13 }, (_, i) => `${i === 0 ? "M" : "L"}${(w * i) / 12} ${Math.sin(i * 1.3) * 7}`).join(" ");
      return (
        <svg width={w} height={20} style={{ overflow: "visible" }}>
          <path d={d} {...common} stroke={color ?? c.accent} />
        </svg>
      );
    }
    case "bracket":
      return (
        <svg width={w} height={h} style={{ overflow: "visible" }}>
          <path d={`M0 ${h} V0 H${w} V${h}`} {...common} />
        </svg>
      );
    default: {
      // line / arrow (de 0,0 até dx,dy), com uma leve curva.
      const mx = dx / 2 - dy * 0.15;
      const my = dy / 2 + dx * 0.15;
      const ang = Math.atan2(dy - my, dx - mx);
      const L = 34;
      const head =
        shape === "arrow"
          ? `M${dx + Math.cos(ang + 2.5) * L} ${dy + Math.sin(ang + 2.5) * L} L${dx} ${dy} L${dx + Math.cos(ang - 2.5) * L} ${dy + Math.sin(ang - 2.5) * L}`
          : "";
      const headP = clamp01((p - 0.7) / 0.3);
      return (
        <svg width={1} height={1} style={{ overflow: "visible" }}>
          <path d={`M0 0 Q${mx} ${my} ${dx} ${dy}`} {...common} />
          {head ? <path d={head} {...common} strokeDashoffset={1 - headP} /> : null}
        </svg>
      );
    }
  }
};

// Medidores: termômetro enchendo, velocímetro com ponteiro balançando, barra de progresso.
export const Meter: React.FC<{ readonly kind: "thermometer" | "gauge" | "progress"; readonly value: number; readonly at: number; readonly label?: string; readonly size?: number }> = ({
  kind,
  value,
  at,
  label,
  size = 360,
}) => {
  const { c, f } = useCollageTheme();
  const { ink } = useShot();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const start = Math.round(at * fps);
  const s = Math.max(0, springAt(frame, fps, start + 4, "heavy"));
  const wobble = Math.sin((frame - start) / 3) * 0.015 * Math.min(1, (frame - start) / fps);
  const v = Math.max(0, value * s + wobble);
  const caption = label ? <div style={{ fontFamily: f.mono, fontSize: size * 0.08, color: ink, marginTop: 14, textAlign: "center", letterSpacing: 2 }}>{label}</div> : null;
  if (kind === "thermometer") {
    const tubeW = size * 0.2;
    const tubeH = size * 0.78;
    const bulb = size * 0.34;
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div style={{ position: "relative", width: bulb, height: tubeH + bulb * 0.8 }}>
          <div style={{ position: "absolute", left: (bulb - tubeW) / 2, top: 0, width: tubeW, height: tubeH, borderRadius: tubeW, backgroundColor: withAlpha("#ffffff", 0.2), border: `3px solid ${withAlpha("#ffffff", 0.6)}`, overflow: "hidden" }}>
            <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: `${Math.min(1.05, v) * 100}%`, backgroundColor: c.accent, boxShadow: `0 0 24px ${c.accent}` }} />
          </div>
          <div style={{ position: "absolute", left: 0, top: tubeH - bulb * 0.2, width: bulb, height: bulb, borderRadius: "50%", backgroundColor: c.accent, border: `3px solid ${withAlpha("#ffffff", 0.6)}`, boxShadow: `0 0 40px ${withAlpha(c.accent, 0.8)}` }} />
        </div>
        {caption}
      </div>
    );
  }
  if (kind === "gauge") {
    const r = size / 2;
    const ang = -90 + 180 * Math.min(1.05, v);
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <svg width={size} height={r + 20} style={{ overflow: "visible" }}>
          <path d={`M10 ${r} A${r - 10} ${r - 10} 0 0 1 ${size - 10} ${r}`} stroke={withAlpha("#ffffff", 0.3)} strokeWidth={22} fill="none" strokeLinecap="round" />
          <path d={`M10 ${r} A${r - 10} ${r - 10} 0 0 1 ${size - 10} ${r}`} stroke={c.accent} strokeWidth={22} fill="none" strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - Math.min(1, v)} />
          <g transform={`translate(${r} ${r}) rotate(${ang})`}>
            <line x1={0} y1={0} x2={0} y2={-(r - 40)} stroke="#fff" strokeWidth={8} strokeLinecap="round" />
            <circle r={16} fill="#fff" />
          </g>
        </svg>
        {caption}
      </div>
    );
  }
  return (
    <div style={{ width: size * 2, display: "flex", flexDirection: "column" }}>
      <div style={{ height: 30, borderRadius: 30, backgroundColor: withAlpha("#ffffff", 0.22), overflow: "hidden" }}>
        <div style={{ width: `${Math.min(1, v) * 100}%`, height: "100%", borderRadius: 30, backgroundColor: c.accent, boxShadow: `0 0 24px ${c.accent}` }} />
      </div>
      {caption}
    </div>
  );
};

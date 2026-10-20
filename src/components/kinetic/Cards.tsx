import React from "react";
import { interpolate, random, useCurrentFrame, useVideoConfig } from "remotion";
import { useCollageTheme } from "../../brand/collageTheme";
import { withAlpha } from "../../brand/color";
import { PrintOverlay } from "../collage/PrintOverlay";
import { tornOutline } from "../collage/torn";
import { AnimatedIcon } from "./AnimatedIcon";
import { clamp01, EASE, springAt } from "./motion";

type CardProps = {
  readonly seed: string;
  readonly at: number;
  readonly title: string;
  readonly subtitle?: string;
  readonly kicker?: string;
  readonly icon?: string;
  readonly width?: number;
  readonly height?: number;
  readonly tone?: "glass" | "dark" | "accent";
};

// Card de UI arredondado, vidro fosco com sombra suave; o conteúdo entra em cascata
// e um reflexo de luz atravessa o card de tempos em tempos.
export const GlassCard: React.FC<CardProps> = ({ seed, at, title, subtitle, kicker, icon, width = 420, height = 320, tone = "glass" }) => {
  const { c, f } = useCollageTheme();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const start = Math.round(at * fps);
  // Conteúdo em cascata; `alpha` = opacidade final do trecho.
  const part = (k: number, alpha = 1) => {
    const s = springAt(frame, fps, start + 4 + k * 3, "snappy");
    return { opacity: clamp01(s * 2) * alpha, translate: `0 ${(1 - s) * 30}px` };
  };
  const bg = tone === "accent" ? c.accent : tone === "dark" ? withAlpha("#0e0a1c", 0.7) : withAlpha("#ffffff", 0.17);
  const sweepT = ((frame - start) / fps + random(`sweep-${seed}`) * 2) % 2.6;
  const sweep = interpolate(sweepT, [0, 0.9], [-0.6, 1.6], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE.inOutCubic });
  // Título numa linha só: cabe na largura útil do card (Inter 900 ~0.6em por caractere).
  const titleSize = Math.min(110, (width - 80) / (Math.max(4, title.length) * 0.6));
  return (
    <div
      style={{
        position: "relative",
        width,
        height,
        borderRadius: 44,
        overflow: "hidden",
        backgroundColor: bg,
        border: `2px solid ${withAlpha("#ffffff", tone === "accent" ? 0.55 : 0.42)}`,
        boxShadow: `0 40px 80px ${withAlpha("#2a0630", 0.35)}, inset 0 2px 0 ${withAlpha("#ffffff", 0.45)}`,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "0 40px",
        color: "#fff",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: -40,
          bottom: -40,
          width: width * 0.35,
          left: `${sweep * 100}%`,
          rotate: "18deg",
          background: `linear-gradient(90deg, transparent, ${withAlpha("#ffffff", 0.22)}, transparent)`,
        }}
      />
      {icon ? (
        <div style={{ marginBottom: 14, ...part(0) }}>
          <AnimatedIcon icon={icon} seed={`${seed}-icon`} at={at + 0.15} preset="draw" size={64} container="none" color="#fff" />
        </div>
      ) : null}
      {kicker ? (
        <div style={{ fontFamily: f.mono, fontSize: 24, letterSpacing: 3, textTransform: "uppercase", ...part(1, 0.85) }}>{kicker}</div>
      ) : null}
      <div style={{ fontFamily: f.sans, fontWeight: 900, fontSize: titleSize, letterSpacing: "-0.045em", lineHeight: 1, marginTop: 6, whiteSpace: "nowrap", ...part(2) }}>{title}</div>
      {subtitle ? <div style={{ fontFamily: f.sans, fontWeight: 600, fontSize: 30, marginTop: 12, ...part(3, 0.9) }}>{subtitle}</div> : null}
    </div>
  );
};

// Manchete recortada de jornal: papel jornal, serifa pesada, borda rasgada.
export const Clipping: React.FC<{ readonly seed: string; readonly text: string; readonly sub?: string; readonly size?: number }> = ({ seed, text, sub, size = 96 }) => {
  const { c, f } = useCollageTheme();
  const serif = `"Playfair Display", Georgia, serif`;
  const lines = text.split("\n");
  const longest = Math.max(...lines.map((l) => l.length));
  const w = Math.round(longest * size * 0.56 + 90);
  const h = Math.round(lines.length * size * 1.08 + (sub ? size * 0.75 : 0) + 70);
  const outline = tornOutline(w, h, seed, { amp: 6, step: 9 });
  return (
    <div style={{ position: "relative", width: w, height: h }}>
      <div style={{ position: "absolute", inset: 0, backgroundColor: c.newsprint, clipPath: `path("${outline}")` }} />
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          color: c.ink,
          textAlign: "center",
        }}
      >
        {sub ? (
          <div style={{ fontFamily: f.mono, fontSize: size * 0.22, letterSpacing: 4, borderBottom: `3px solid ${c.ink}`, paddingBottom: 6, marginBottom: 10 }}>{sub}</div>
        ) : null}
        {lines.map((l, i) => (
          <div key={i} style={{ fontFamily: serif, fontWeight: 900, fontSize: size, lineHeight: 1.02, letterSpacing: "-0.01em" }}>
            {l}
          </div>
        ))}
      </div>
      <div style={{ position: "absolute", inset: 0, clipPath: `path("${outline}")` }}>
        <PrintOverlay halftone={0.12} grain={0.4} />
      </div>
    </div>
  );
};

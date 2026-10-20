import React from "react";
import { interpolate, random, useCurrentFrame, useVideoConfig } from "remotion";
import { useCollageTheme } from "../../brand/collageTheme";
import { useLand } from "./Land";
import { PrintOverlay } from "./PrintOverlay";
import { roughPolygonPct, tornOutline } from "./torn";

// ---------------------------------------------------------------- Ransom note

type RansomProps = {
  readonly text: string;
  readonly seed: string;
  readonly at?: number;
  // Altura média das letras.
  readonly size?: number;
  readonly maxWidth?: number;
};

// Cada letra num recorte diferente, com fontes, cores e tamanhos variando.
export const RansomText: React.FC<RansomProps> = ({ text, seed, at = 0, size, maxWidth = 820 }) => {
  const { c, ransomFamilies } = useCollageTheme();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const letters = [...text];
  const words = text.split(/\s+/).filter(Boolean);
  const longest = Math.max(1, ...words.map((w) => [...w].length));
  // Cada letra ocupa ~1.1x o tamanho (glifo + respiro do recorte). Quebra só entre
  // palavras: se a palavra mais longa não couber na largura, o tamanho diminui.
  const base = Math.min(size ?? Math.min(150, maxWidth / Math.max(1, letters.length) / 1.1), maxWidth / (longest * 1.0));
  const palettes = [
    { bg: c.cream, fg: c.ink },
    { bg: c.paperWhite, fg: c.ink },
    { bg: c.accent, fg: "#ffffff" },
    { bg: c.ink, fg: c.cream },
    { bg: c.newsprint, fg: c.ink },
    { bg: c.paperWhite, fg: c.accent },
  ];
  // Cada palavra completa em no máximo 3 quadros (as letras batem quase juntas);
  // a próxima palavra vem logo depois.
  const wordStarts = words.reduce<number[]>((acc, _, wi) => [...acc, wi === 0 ? 0 : acc[wi - 1] + 4], []);
  let i = -1;
  return (
    <div data-bigtext="union" style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", alignItems: "center", width: maxWidth, columnGap: base * 0.35, rowGap: base * 0.12 }}>
      {words.map((word, wi) => (
        <div key={wi} data-rword={word} style={{ display: "flex", flexWrap: "nowrap", alignItems: "center", gap: base * 0.04 }}>
          {[...word].map((ch, ci, arr) => {
            i += 1;
            const r = (k: string) => random(`${seed}-${i}-${k}`);
            const pal = palettes[Math.floor(r("p") * palettes.length)];
            const family = ransomFamilies[Math.floor(r("f") * ransomFamilies.length)];
            const sz = base * (0.8 + r("s") * 0.4);
            const start = Math.round(at * fps) + wordStarts[wi] + Math.round((ci / Math.max(1, arr.length - 1)) * 2);
            if (frame < start) {
              return <div key={i} style={{ width: sz * 0.72 }} />;
            }
            // Bate maior, encolhe um pouco além e assenta.
            const s = interpolate(frame - start, [0, 4, 7, 10], [1.5, 0.92, 1.03, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
            return (
              <div
                key={i}
                style={{
                  position: "relative",
                  padding: `${sz * (0.04 + r("py") * 0.06)}px ${sz * (0.08 + r("px") * 0.1)}px`,
                  backgroundColor: pal.bg,
                  color: pal.fg,
                  fontFamily: family,
                  fontWeight: 900,
                  fontSize: sz,
                  lineHeight: 1,
                  textTransform: r("c") > 0.75 ? "lowercase" : "none",
                  clipPath: roughPolygonPct(`${seed}-clip-${i}`, 3),
                  rotate: `${(r("r") - 0.5) * 18}deg`,
                  translate: `0px ${(r("y") - 0.5) * sz * 0.22}px`,
                  scale: s,
                  filter: "drop-shadow(0 6px 5px rgba(0,0,0,0.55))",
                }}
              >
                {ch}
                <PrintOverlay halftone={0.12} grain={0.35} />
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
};

// ---------------------------------------------------------------- Manchete em faixa de papel

export const HeadlineStrip: React.FC<{ readonly text: string; readonly seed: string; readonly size?: number }> = ({
  text,
  seed,
  size = 96,
}) => {
  const { c, f } = useCollageTheme();
  const w = Math.round(text.length * size * 0.47 + size * 0.9);
  const h = Math.round(size * 1.45);
  return (
    <div style={{ position: "relative", width: w, height: h }}>
      <div style={{ position: "absolute", inset: 0, backgroundColor: c.cream, clipPath: `path("${tornOutline(w, h, seed, { amp: 5, step: 9 })}")` }} />
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: f.display,
          fontSize: size,
          color: c.ink,
          letterSpacing: 1,
          lineHeight: 1,
          paddingTop: size * 0.06,
        }}
      >
        {text}
      </div>
      <div style={{ position: "absolute", inset: 0, clipPath: `path("${tornOutline(w, h, seed, { amp: 5, step: 9 })}")` }}>
        <PrintOverlay halftone={0.1} grain={0.35} />
      </div>
    </div>
  );
};

// ---------------------------------------------------------------- Rótulo mono (fonte de dado, datas)

// Texto digitado letra por letra, com marcador quadrado de acento.
export const MonoLabel: React.FC<{ readonly text: string; readonly at?: number; readonly size?: number }> = ({
  text,
  at = 0,
  size = 26,
}) => {
  const { c, f } = useCollageTheme();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const shown = Math.floor(interpolate(frame, [at * fps, (at + 0.03 * text.length) * fps], [0, text.length], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
  if (frame < at * fps) {
    return null;
  }
  const cursor = shown < text.length || Math.floor(frame / 15) % 2 === 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, fontFamily: f.mono, fontSize: size, color: c.text, letterSpacing: 1, whiteSpace: "nowrap" }}>
      <div style={{ width: size * 0.45, height: size * 0.45, backgroundColor: c.accent }} />
      <span style={{ opacity: 0.85 }}>{text.slice(0, shown)}</span>
      <div style={{ width: size * 0.5, height: size * 0.95, marginLeft: -8, backgroundColor: c.text, opacity: cursor ? 0.7 : 0 }} />
    </div>
  );
};

// ---------------------------------------------------------------- Anotação à mão

export const HandNote: React.FC<{ readonly text: string; readonly at?: number; readonly size?: number }> = ({ text, at = 0, size = 64 }) => {
  const { c, f } = useCollageTheme();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = interpolate(frame, [at * fps, (at + 0.05 * text.length + 0.1) * fps], [0, 100], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  if (p <= 0) {
    return null;
  }
  return (
    // Folga de 12% à direita: a letra cursiva final passa um pouco da caixa do texto.
    <div style={{ fontFamily: f.hand, fontWeight: 700, fontSize: size, color: c.text, whiteSpace: "nowrap", clipPath: `inset(-20% ${(100 - p) * 1.12 - 12}% -20% -5%)` }}>
      {text}
    </div>
  );
};

// ---------------------------------------------------------------- Chip (etiqueta de papel)

export const Chip: React.FC<{ readonly text: string; readonly seed: string; readonly size?: number }> = ({ text, seed, size = 34 }) => {
  const { c, f } = useCollageTheme();
  return (
    <div
      style={{
        padding: `${size * 0.25}px ${size * 0.5}px`,
        backgroundColor: c.accent,
        color: "#fff",
        fontFamily: f.sans,
        fontWeight: 800,
        fontSize: size,
        clipPath: roughPolygonPct(seed, 2),
        whiteSpace: "nowrap",
      }}
    >
      {text}
    </div>
  );
};

// ---------------------------------------------------------------- Marcas à mão (seta, círculo, sublinhado)

type MarkProps = {
  readonly kind: "arrow" | "circle" | "underline";
  readonly seed: string;
  readonly x: number;
  readonly y: number;
  readonly toX?: number;
  readonly toY?: number;
  readonly w?: number;
  readonly h?: number;
  readonly at?: number;
};

export const HandMark: React.FC<MarkProps> = ({ kind, seed, x, y, toX = x + 200, toY = y, w = 260, h = 110, at = 0 }) => {
  const { c } = useCollageTheme();
  const { visible } = useLand(at);
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = interpolate(frame, [at * fps, (at + 0.45) * fps], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  if (!visible) {
    return null;
  }
  const r = (k: string) => random(`${seed}-${k}`) - 0.5;
  let d = "";
  let head = "";
  if (kind === "arrow") {
    const mx = (x + toX) / 2 + (toY - y) * 0.25 + r("cx") * 30;
    const my = (y + toY) / 2 - (toX - x) * 0.25 + r("cy") * 30;
    d = `M${x} ${y} Q${mx} ${my} ${toX} ${toY}`;
    const ang = Math.atan2(toY - my, toX - mx);
    const L = 34;
    const a1 = ang + Math.PI * 0.82;
    const a2 = ang - Math.PI * 0.82;
    head = `M${toX + Math.cos(a1) * L} ${toY + Math.sin(a1) * L} L${toX} ${toY} L${toX + Math.cos(a2) * L} ${toY + Math.sin(a2) * L}`;
  } else if (kind === "circle") {
    const pts: string[] = [];
    const turns = 1.15;
    const steps = 48;
    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * turns * Math.PI * 2 - Math.PI * 0.6;
      const k = 1 + r(`k${Math.floor(i / 8)}`) * 0.08 + (i / steps) * 0.06;
      pts.push(`${(x + Math.cos(t) * (w / 2) * k).toFixed(1)} ${(y + Math.sin(t) * (h / 2) * k).toFixed(1)}`);
    }
    d = `M${pts.join(" L")}`;
  } else {
    const pts: string[] = [];
    for (let i = 0; i <= 12; i++) {
      pts.push(`${(x - w / 2 + (w * i) / 12).toFixed(1)} ${(y + Math.sin(i * 1.3) * 6 + r(`u${i}`) * 4).toFixed(1)}`);
    }
    d = `M${pts.join(" L")}`;
  }
  const stroke = { stroke: c.accent, strokeWidth: 8, fill: "none", strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <svg width={1080} height={1920} style={{ position: "absolute", left: 0, top: 0, overflow: "visible", filter: "drop-shadow(0 3px 2px rgba(0,0,0,0.5))" }}>
      <path d={d} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - Math.min(1, p * (head ? 1.25 : 1))} {...stroke} />
      {head ? <path d={head} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - Math.max(0, (p - 0.8) / 0.2)} {...stroke} /> : null}
    </svg>
  );
};


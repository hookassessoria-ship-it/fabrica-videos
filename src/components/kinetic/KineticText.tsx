import React from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { useCollageTheme } from "../../brand/collageTheme";
import { withAlpha } from "../../brand/color";
import type { FontRoleName, TextEffect, TextMode } from "../../templates/kineticTypes";
import { clamp01, EASE, springAt, useShot } from "./motion";

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9%]/g, "");

const STAGGER: Record<TextMode, number> = { word: 3, letter: 2, line: 5 };

type Props = {
  readonly text: string;
  readonly at: number;
  readonly mode?: TextMode;
  readonly effect?: TextEffect;
  readonly size?: number;
  readonly weight?: number;
  readonly font?: FontRoleName;
  readonly color?: string;
  readonly maxWidth?: number;
  readonly highlight?: string[];
  readonly plate?: boolean;
  readonly align?: "center" | "left";
};

// Tipografia cinética: palavra por palavra, letra por letra ou linha por linha,
// com escala, slide, máscara, blur-in, impacto ou digitação.
export const KineticText: React.FC<Props> = ({
  text,
  at,
  mode = "word",
  effect = "slide",
  size = 110,
  weight = 900,
  font = "sans",
  color,
  maxWidth = 880,
  highlight = [],
  plate = false,
  align = "center",
}) => {
  const { f, c } = useCollageTheme();
  const { ink } = useShot();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const start = Math.round(at * fps);
  const fill = color ?? ink;
  const lines = text.split("\n");
  const hi = new Set(highlight.map(norm));
  const family = f[font];
  // Texto claro sobre fundo claro precisa de sombra pra ler.
  const isDark = fill.toLowerCase() === "#ffffff" || fill === c.text;

  // Digitação: revela caractere a caractere, com cursor.
  if (effect === "type") {
    const shown = Math.max(0, Math.floor((frame - start) / 1.5));
    const blink = Math.floor(frame / 10) % 2 === 0 || shown < text.length;
    return (
      <div style={{ fontFamily: family, fontWeight: weight, fontSize: size, color: fill, width: "max-content", maxWidth, textAlign: align, lineHeight: 1.05, whiteSpace: "pre-wrap", textShadow: isDark ? "0 4px 20px rgba(26,4,32,0.45)" : undefined }}>
        {text.slice(0, shown)}
        <span style={{ display: "inline-block", width: size * 0.5, height: size * 0.9, marginLeft: 6, verticalAlign: "-0.12em", backgroundColor: c.accent, opacity: blink ? 1 : 0 }} />
      </div>
    );
  }

  // Impacto: o bloco inteiro entra enorme e bate no lugar (a câmera treme via "impact").
  const impactScale =
    effect === "impact"
      ? interpolate(frame - start, [0, 6, 9, 12], [2.6, 0.94, 1.03, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE.outExpo })
      : 1;

  let index = 0;
  const token = (content: string, key: string, isWord: boolean) => {
    const i = index++;
    const s0 = start + (effect === "impact" ? 0 : i * STAGGER[mode]);
    const f0 = frame - s0;
    if (f0 < 0) {
      return (
        <span key={key} style={{ display: "inline-block", opacity: 0 }}>
          {content}
        </span>
      );
    }
    let style: React.CSSProperties = {};
    let inner: React.CSSProperties | null = null;
    switch (effect) {
      case "scale": {
        const s = springAt(frame, fps, s0, "bouncy");
        style = { scale: 0.3 + 0.7 * s, opacity: clamp01(s * 3) };
        break;
      }
      case "mask": {
        const p = interpolate(f0, [0, 10], [0, 1], { extrapolateRight: "clamp", easing: EASE.outExpo });
        inner = { translate: `0 ${(1 - p) * 110}%` };
        break;
      }
      case "blur": {
        const p = interpolate(f0, [0, 12], [0, 1], { extrapolateRight: "clamp", easing: EASE.outExpo });
        style = { opacity: p, filter: `blur(${(1 - p) * 16}px)`, scale: 1.2 - 0.2 * p };
        break;
      }
      case "impact":
        break;
      default: {
        const s = springAt(frame, fps, s0, "snappy");
        const prev = springAt(frame - 1, fps, s0, "snappy");
        const v = Math.abs(s - prev) * size * 0.7;
        style = { translate: `0 ${(1 - s) * 0.7}em`, opacity: clamp01(s * 2.5), filter: v > 1 ? `blur(${Math.min(10, v * 0.25)}px)` : undefined };
      }
    }
    const marked = isWord && hi.has(norm(content));
    const markP = marked ? interpolate(frame - s0, [6, 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE.outExpo }) : 0;
    const body = (
      <span style={{ position: "relative", display: "inline-block", ...style }}>
        {marked ? (
          <span
            style={{
              position: "absolute",
              left: "-0.08em",
              right: "-0.08em",
              top: "0.12em",
              bottom: "0.02em",
              backgroundColor: c.accent,
              transformOrigin: "left center",
              scale: `${markP} 1`,
              borderRadius: "0.12em",
              zIndex: -1,
            }}
          />
        ) : null}
        {inner ? <span style={{ display: "inline-block", ...inner }}>{content}</span> : content}
      </span>
    );
    return inner ? (
      <span key={key} style={{ display: "inline-block", overflow: "hidden", verticalAlign: "top", paddingBottom: "0.08em" }}>
        {body}
      </span>
    ) : (
      <React.Fragment key={key}>{body}</React.Fragment>
    );
  };

  const renderLine = (line: string, li: number) => {
    if (mode === "line") {
      return <div key={li}>{token(line, `l${li}`, false)}</div>;
    }
    const words = line.split(" ").filter(Boolean);
    return (
      <div key={li} style={{ display: "flex", flexWrap: "wrap", justifyContent: align === "center" ? "center" : "flex-start", columnGap: "0.24em" }}>
        {words.map((w, wi) =>
          mode === "letter" ? (
            <span key={wi} style={{ display: "inline-flex" }}>
              {[...w].map((ch, ci) => token(ch, `${li}-${wi}-${ci}`, false))}
            </span>
          ) : (
            token(w, `${li}-${wi}`, true)
          ),
        )}
      </div>
    );
  };

  return (
    <div
      style={{
        position: "relative",
        isolation: "isolate",
        maxWidth,
        width: "max-content",
        fontFamily: family,
        fontWeight: weight,
        fontSize: size,
        lineHeight: 0.98,
        letterSpacing: font === "sans" ? "-0.04em" : font === "display" ? "0.01em" : undefined,
        color: fill,
        textAlign: align,
        scale: impactScale,
        textShadow: isDark ? `0 6px 30px ${withAlpha("#1a0420", 0.45)}, 0 2px 6px rgba(0,0,0,0.25)` : undefined,
        padding: plate ? "0.18em 0.32em" : undefined,
        borderRadius: plate ? 28 : undefined,
        backgroundColor: plate ? withAlpha("#0e0a1c", 0.62) : undefined,
      }}
    >
      {lines.map(renderLine)}
    </div>
  );
};

// Rótulo mono pequeno (fonte de dado, datas), com ponto de acento piscando.
export const MonoLabel: React.FC<{ readonly text: string; readonly at: number; readonly size?: number }> = ({ text, at, size = 26 }) => {
  const { f, c } = useCollageTheme();
  const { ink } = useShot();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const shown = Math.floor(interpolate(frame, [at * fps, at * fps + text.length * 0.9], [0, text.length], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
  const dot = 0.6 + Math.sin(frame / 6) * 0.4;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 18px",
        borderRadius: 999,
        backgroundColor: withAlpha("#0e0a1c", 0.45),
        border: `1.5px solid ${withAlpha("#ffffff", 0.25)}`,
        fontFamily: f.mono,
        fontSize: size,
        color: ink === c.text ? c.text : ink,
        letterSpacing: 1,
        whiteSpace: "nowrap",
      }}
    >
      <div style={{ width: size * 0.4, height: size * 0.4, borderRadius: "50%", backgroundColor: c.accent, opacity: dot, boxShadow: `0 0 12px ${c.accent}` }} />
      {text.slice(0, shown)}
    </div>
  );
};

import type { Caption } from "@remotion/captions";
import React, { useMemo } from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { useCollageTheme } from "../../brand/collageTheme";
import { withAlpha } from "../../brand/color";
import { CAPTIONS, SAFE } from "../../templates/safeZone";
import { toBlocks } from "../collage/CollageCaptions";
import { EASE, springAt } from "./motion";

const HOLD_MS = 250;

// Legendas em blocos de sentido sobre uma faixa escura (leitura garantida em fundo claro),
// com entrada sutil e a palavra falada destacada.
export const KineticCaptions: React.FC<{ readonly captions: Caption[]; readonly fontSize?: number; readonly accent?: string; readonly activeText?: string; readonly plate?: string }> = ({
  captions,
  fontSize = 56,
  accent,
  activeText = "#fff",
  plate,
}) => {
  const { c: theme, f } = useCollageTheme();
  const c = { ...theme, accent: accent ?? theme.accent };
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const blocks = useMemo(() => toBlocks(captions), [captions]);
  const t = (frame / fps) * 1000;
  const bi = blocks.findIndex((b, i) => {
    const next = blocks[i + 1];
    const end = next ? Math.min(next.startMs, b.endMs + HOLD_MS) : b.endMs + HOLD_MS;
    return t >= b.startMs && t < end;
  });
  if (bi === -1) {
    return null;
  }
  const block = blocks[bi];
  const startF = (block.startMs / 1000) * fps;
  const p = interpolate(frame, [startF, startF + 7], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE.outExpo });
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          left: SAFE.left + 20,
          width: CAPTIONS.width,
          top: CAPTIONS.centerY,
          display: "flex",
          justifyContent: "center",
          translate: `0 calc(-50% + ${(1 - p) * 22}px)`,
          opacity: p,
        }}
      >
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            columnGap: fontSize * 0.16,
            rowGap: fontSize * 0.04,
            padding: `${fontSize * 0.22}px ${fontSize * 0.42}px`,
            borderRadius: fontSize * 0.5,
            backgroundColor: plate ?? withAlpha("#0e0a1c", 0.62),
            boxShadow: "0 18px 40px rgba(14,4,24,0.35)",
            fontFamily: f.sans,
            fontWeight: 800,
            fontSize,
            lineHeight: 1.18,
            letterSpacing: "-0.02em",
            color: "#fff",
          }}
        >
          {block.words.map((w, i) => {
            const isLast = i === block.words.length - 1;
            const active = t >= w.startMs && (t < w.endMs || (isLast && t < w.endMs + HOLD_MS));
            // O destaque cobre a palavra inteira desde o 1º quadro (só a altura e a opacidade
            // animam): nunca destaca metade da palavra. Fica dentro da caixa da própria palavra
            // (padding interno), sem cobrir a vizinha.
            const s = active ? Math.min(1, springAt(frame, fps, Math.round((w.startMs / 1000) * fps), "snappy")) : 1;
            return (
              <span key={i} data-capword style={{ position: "relative", display: "inline-block", padding: "0 0.14em" }}>
                {active ? (
                  <span
                    data-hl
                    style={{
                      position: "absolute",
                      inset: 0,
                      borderRadius: "0.22em",
                      backgroundColor: c.accent,
                      scale: `1 ${0.7 + 0.3 * Math.max(0, s)}`,
                      opacity: Math.min(1, s * 2.5),
                      boxShadow: `0 0 20px ${withAlpha(c.accent, 0.6)}`,
                    }}
                  />
                ) : null}
                {/* a cor de texto da palavra ativa só troca quando o destaque já está forte */}
                <span data-captext style={{ position: "relative", color: active && s > 0.4 ? activeText : undefined }}>
                  {w.text.trim()}
                </span>
              </span>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};

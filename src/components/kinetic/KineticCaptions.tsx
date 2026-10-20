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
export const KineticCaptions: React.FC<{ readonly captions: Caption[]; readonly fontSize?: number }> = ({ captions, fontSize = 56 }) => {
  const { c, f } = useCollageTheme();
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
            columnGap: fontSize * 0.24,
            rowGap: fontSize * 0.04,
            padding: `${fontSize * 0.22}px ${fontSize * 0.42}px`,
            borderRadius: fontSize * 0.5,
            backgroundColor: withAlpha("#0e0a1c", 0.62),
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
            const s = active ? springAt(frame, fps, Math.round((w.startMs / 1000) * fps), "bouncy") : 1;
            return (
              <span key={i} style={{ position: "relative", display: "inline-block", padding: "0 0.12em" }}>
                {active ? (
                  <span style={{ position: "absolute", inset: "0.02em -0.02em", borderRadius: "0.22em", backgroundColor: c.accent, scale: Math.max(0, s), boxShadow: `0 0 24px ${withAlpha(c.accent, 0.7)}` }} />
                ) : null}
                <span style={{ position: "relative" }}>{w.text.trim()}</span>
              </span>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};

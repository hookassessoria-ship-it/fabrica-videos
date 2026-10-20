import type { Caption } from "@remotion/captions";
import React, { useMemo } from "react";
import { AbsoluteFill, interpolate, random, useCurrentFrame, useVideoConfig } from "remotion";
import { useCollageTheme } from "../../brand/collageTheme";
import { CAPTIONS, SAFE } from "../../templates/safeZone";
import { roughPolygonPct } from "./torn";

type Block = { startMs: number; endMs: number; words: Caption[] };

const END = /[.!?…]["”']?$/;

// Blocos de 3 a 5 palavras (e ~22 letras, pra caber numa linha), equilibrados dentro
// de cada frase (11 palavras -> 4+4+3).
export const toBlocks = (captions: Caption[], { max = 5, maxChars = 22 } = {}): Block[] => {
  const sentences: Caption[][] = [];
  let cur: Caption[] = [];
  for (const cap of captions) {
    cur.push(cap);
    if (cap.pageBreakAfter || END.test(cap.text.trim())) {
      sentences.push(cur);
      cur = [];
    }
  }
  if (cur.length) {
    sentences.push(cur);
  }
  const blocks: Block[] = [];
  for (const words of sentences) {
    const chars = words.reduce((n, w) => n + w.text.trim().length + 1, 0);
    const k = Math.min(words.length, Math.max(Math.ceil(words.length / max), Math.ceil(chars / maxChars)));
    let i = 0;
    for (let b = 0; b < k; b++) {
      const size = Math.round((words.length - i) / (k - b));
      const chunk = words.slice(i, i + size);
      i += size;
      blocks.push({ startMs: chunk[0].startMs, endMs: chunk[chunk.length - 1].endMs, words: chunk });
    }
  }
  return blocks;
};

const HOLD_MS = 300;

export const CollageCaptions: React.FC<{ readonly captions: Caption[]; readonly fontSize?: number }> = ({ captions, fontSize = 62 }) => {
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
  const pop = interpolate(t - block.startMs, [0, 90, 160], [0.86, 1.04, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          left: SAFE.left + 20,
          width: CAPTIONS.width,
          top: CAPTIONS.centerY,
          translate: "0 -50%",
          scale: pop,
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          alignItems: "center",
          columnGap: fontSize * 0.22,
          rowGap: fontSize * 0.06,
          fontFamily: f.sans,
          fontWeight: 800,
          fontSize,
          lineHeight: 1.15,
          letterSpacing: -0.5,
        }}
      >
        {block.words.map((w, i) => {
          const isLast = i === block.words.length - 1;
          const active = t >= w.startMs && (t < w.endMs || (isLast && t < w.endMs + HOLD_MS));
          return (
            <span
              key={i}
              style={{
                position: "relative",
                display: "inline-block",
                padding: "0.02em 0.14em",
                color: c.text,
                WebkitTextStroke: `${fontSize * 0.1}px ${c.background}`,
                paintOrder: "stroke fill",
                rotate: active ? `${(random(`cap-${bi}-${i}`) - 0.5) * 5}deg` : "0deg",
              }}
            >
              {active ? (
                <span
                  style={{
                    position: "absolute",
                    inset: "-0.02em -0.02em",
                    backgroundColor: c.accent,
                    clipPath: roughPolygonPct(`cap-chip-${bi}-${i}`, 2.5),
                  }}
                />
              ) : null}
              <span style={{ position: "relative" }}>{w.text.trim()}</span>
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

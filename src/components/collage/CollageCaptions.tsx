import type { Caption } from "@remotion/captions";
import React, { useMemo } from "react";
import { AbsoluteFill, interpolate, random, useCurrentFrame, useVideoConfig } from "remotion";
import { useCollageTheme } from "../../brand/collageTheme";
import { CAPTIONS, SAFE } from "../../templates/safeZone";
import { roughPolygonPct } from "./torn";

type Block = { startMs: number; endMs: number; words: Caption[] };

const END = /[.!?…]["”']?$/;
const SOFT = /[,;:—–]["”']?$/;

// Palavras que não podem fechar um bloco (o sentido fica pendurado):
// artigos, "um/uma", preposições e contrações, conjunções, possessivos, "não", verbos de ligação.
const DANGLING = new Set(
  (
    "o a os as um uma uns umas de do da dos das em no na nos nas num numa por pelo pela pelos pelas " +
    "pra pro pras pros para com sem sob sobre ao aos à às até entre desde contra após e ou mas que se nem " +
    "porque quando como onde não nao mais menos muito muita tão tao seu sua seus suas meu minha nosso nossa " +
    "este esta esse essa é são sao foi era está esta tá ta vai vão"
  ).split(" "),
);

const bare = (w: string) => w.trim().toLowerCase().replace(/[^\p{L}\p{N}']/gu, "");
const len = (words: Caption[]) => words.reduce((n, w) => n + w.text.trim().length, 0) + words.length - 1;

// Custo de um bloco [i, j) dentro da frase.
const blockCost = (words: Caption[], i: number, j: number, { max, maxChars }: { max: number; maxChars: number }) => {
  const size = j - i;
  const chunk = words.slice(i, j);
  if (size > max || (size > 1 && len(chunk) > maxChars)) {
    return Infinity;
  }
  const last = words[j - 1].text.trim();
  const isEnd = j === words.length;
  let cost = (size - 4) * (size - 4) * 0.3;
  if (!isEnd && !SOFT.test(last) && DANGLING.has(bare(last))) {
    cost += 100;
  }
  if (!isEnd && SOFT.test(last)) {
    cost -= 4;
  }
  // Não separar faixas de números ("entre 4 | e 5%").
  if (!isEnd && /\d/.test(last) && /^(e|a|ou|-|–)$/.test(bare(words[j].text))) {
    cost += 50;
  }
  if (words.length >= 3 && size < 3) {
    cost += size === 1 ? 15 : 6;
  }
  return cost;
};

// Blocos de até 5 palavras (no máximo 2 linhas), quebrados por sentido dentro de cada frase.
export const toBlocks = (captions: Caption[], { max = 5, maxChars = 34 } = {}): Block[] => {
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
    // best[j] = menor custo pra quebrar words[0..j); from[j] = início do último bloco.
    const best = new Array<number>(words.length + 1).fill(Infinity);
    const from = new Array<number>(words.length + 1).fill(0);
    best[0] = 0;
    for (let j = 1; j <= words.length; j++) {
      for (let i = Math.max(0, j - max); i < j; i++) {
        const c = best[i] + blockCost(words, i, j, { max, maxChars });
        if (c < best[j]) {
          best[j] = c;
          from[j] = i;
        }
      }
    }
    const cuts: [number, number][] = [];
    for (let j = words.length; j > 0; j = from[j]) {
      cuts.unshift([from[j], j]);
    }
    for (const [i, j] of cuts) {
      const chunk = words.slice(i, j);
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

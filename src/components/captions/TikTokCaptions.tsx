import type { Caption } from "@remotion/captions";
import React, { useMemo } from "react";
import { AbsoluteFill, interpolate, random, useVideoConfig } from "remotion";
import { useTheme } from "../../brand/theme";
import { BOUNCY, popSpring, useStopMotionFrame } from "../paper/motion";
import { toPages } from "./narrationToCaptions";

// Centro vertical das legendas: terço inferior, acima da área de descrição
// do TikTok (que ocupa ~os últimos 450px) e longe dos botões da direita.
const CENTER_Y = 1335;
const MAX_WIDTH = 840;
const HOLD_MS = 350;

type Props = {
  readonly captions: Caption[];
  readonly fontSize?: number;
};

// Legendas palavra por palavra; a palavra falada agora fica num recorte da cor de acento.
export const TikTokCaptions: React.FC<Props> = ({ captions, fontSize = 74 }) => {
  const { c, font } = useTheme();
  const frame = useStopMotionFrame();
  const { fps } = useVideoConfig();
  const pages = useMemo(() => toPages(captions), [captions]);
  const t = (frame / fps) * 1000;

  const pageIndex = pages.findIndex((p, i) => {
    const next = pages[i + 1];
    const end = next ? Math.min(next.startMs, p.endMs + HOLD_MS) : p.endMs + HOLD_MS;
    return t >= p.startMs && t < end;
  });
  if (pageIndex === -1) {
    return null;
  }
  const page = pages[pageIndex];

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          left: (1080 - MAX_WIDTH) / 2 - 20,
          width: MAX_WIDTH,
          top: CENTER_Y,
          translate: "0 -50%",
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          alignItems: "center",
          columnGap: fontSize * 0.28,
          rowGap: fontSize * 0.12,
          fontFamily: font.text,
          fontWeight: 800,
          fontSize,
          lineHeight: 1.12,
          letterSpacing: -1,
        }}
      >
        {page.words.map((w, i) => {
          if (t < w.startMs) {
            return null;
          }
          const active = t >= w.startMs && (t < w.endMs || (i === page.words.length - 1 && t < w.endMs + HOLD_MS));
          const s = popSpring(frame, fps, Math.round((w.startMs / 1000) * fps), BOUNCY);
          const seed = `${pageIndex}-${i}`;
          const tilt = (random(`cap-${seed}`) - 0.5) * 4;
          return (
            <span
              key={i}
              style={{
                position: "relative",
                display: "inline-block",
                padding: "0.04em 0.16em",
                color: c.text,
                scale: interpolate(s, [0, 1], [0.7, 1]),
                rotate: active ? `${tilt}deg` : "0deg",
                WebkitTextStroke: `${fontSize * 0.11}px ${c.background}`,
                paintOrder: "stroke fill",
                textShadow: `0 6px 10px rgba(0,0,0,0.65)`,
              }}
            >
              {active ? <Chip seed={seed} /> : null}
              <span style={{ position: "relative" }}>{w.text.trim()}</span>
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

// Recorte da cor de acento atrás da palavra atual.
const Chip: React.FC<{ readonly seed: string }> = ({ seed }) => {
  const { c } = useTheme();
  const j = (k: string) => (random(`chip-${seed}-${k}`) - 0.5) * 6;
  const d = `M${3 + j("a")} ${4 + j("b")} L${97 + j("c")} ${2 + j("d")} L${98 + j("e")} ${96 + j("f")} L${2 + j("g")} ${98 + j("h")} Z`;
  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      style={{
        position: "absolute",
        inset: "-0.06em -0.04em",
        width: "calc(100% + 0.08em)",
        height: "calc(100% + 0.12em)",
        overflow: "visible",
        filter: "drop-shadow(0 6px 6px rgba(0,0,0,0.6))",
      }}
    >
      <path d={d} fill={c.accent} stroke={c.edge} strokeWidth={6} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  );
};

import React from "react";
import { AbsoluteFill, interpolate, OffthreadVideo, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { useCollageTheme } from "../../brand/collageTheme";
import { withAlpha } from "../../brand/color";
import { PrintOverlay } from "../collage/PrintOverlay";
import { tornOutline } from "../collage/torn";
import { EASE } from "./motion";

// Trecho de filme usado como comentário: sempre mudo, curto (1–2s) e nunca em tela cheia
// crua — dentro de moldura, card de vidro ou papel rasgado, com retícula e grão por cima.
// O arquivo fica em public/clips/ (fora do git).

export type ClipStyle = "frame" | "card" | "torn";

// Limites do trecho (s): nunca uma sequência longa.
export const CLIP_MIN_S = 1;
export const CLIP_MAX_S = 2;
export const clipSeconds = (duration?: number) => Math.min(CLIP_MAX_S, Math.max(CLIP_MIN_S, duration ?? 1.8));

const GRADE = "url(#k-sharpen) saturate(0.78) contrast(1.08) brightness(0.96)";

type Props = {
  readonly src: string;
  readonly seed: string;
  readonly at: number;
  // Segundo do arquivo onde o trecho começa.
  readonly from: number;
  readonly duration?: number;
  readonly style?: ClipStyle;
  readonly width?: number;
  readonly height?: number;
  readonly label?: string;
};

export const KClip: React.FC<Props> = ({ src, seed, at, from, duration, style = "frame", width = 820, height = 470, label }) => {
  const { c, f } = useCollageTheme();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const start = Math.round(at * fps);
  const frames = Math.round(clipSeconds(duration) * fps);
  // Ken Burns lento + leve tremida de câmera na mão: o trecho nunca parece um repost parado.
  const local = frame - start;
  const zoom = interpolate(local, [0, frames], [1.04, 1.12], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const drift = interpolate(local, [0, frames], [-10, 10], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE.inOutCubic });
  const video = (
    <Sequence from={start} durationInFrames={frames} layout="none" name={`trecho ${from}s`}>
      <OffthreadVideo
        src={staticFile(src)}
        trimBefore={Math.round(from * fps)}
        muted
        volume={0}
        style={{ width: "100%", height: "100%", objectFit: "cover", scale: zoom, translate: `${drift}px 0`, filter: GRADE }}
      />
    </Sequence>
  );
  // Vinheta interna: o trecho "afunda" na moldura.
  const vignette = <AbsoluteFill style={{ boxShadow: "inset 0 0 90px rgba(8,4,16,0.65)", pointerEvents: "none" }} />;
  const tag = label ? (
    <div
      style={{
        position: "absolute",
        left: style === "torn" ? 34 : 22,
        bottom: style === "torn" ? 30 : 20,
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 14px",
        borderRadius: 999,
        backgroundColor: withAlpha("#0e0a1c", 0.72),
        border: `1.5px solid ${withAlpha("#ffffff", 0.35)}`,
        fontFamily: f.mono,
        fontWeight: 700,
        fontSize: 26,
        letterSpacing: 1,
        color: "#fff",
        whiteSpace: "nowrap",
      }}
    >
      <div style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: c.accent, boxShadow: `0 0 10px ${c.accent}`, opacity: 0.6 + Math.sin(frame / 5) * 0.4 }} />
      {label}
    </div>
  ) : null;

  if (style === "torn") {
    const outer = tornOutline(width, height, `${seed}-o`, { amp: 8 });
    const inner = tornOutline(width, height, `${seed}-i`, { amp: 8, inset: 12 });
    return (
      <div style={{ position: "relative", width, height, filter: "drop-shadow(0 34px 44px rgba(26,4,32,0.45))" }}>
        <AbsoluteFill style={{ backgroundColor: c.cream, clipPath: `path("${outer}")` }} />
        <AbsoluteFill style={{ clipPath: `path("${inner}")`, overflow: "hidden", backgroundColor: "#0b0410" }}>
          {video}
          {vignette}
          <PrintOverlay halftone={0.12} grain={0.34} />
        </AbsoluteFill>
        {tag}
      </div>
    );
  }

  const card = style === "card";
  return (
    <div
      style={{
        position: "relative",
        width: width + (card ? 0 : 20),
        height: height + (card ? 0 : 20),
        padding: card ? 0 : 10,
        borderRadius: card ? 40 : 34,
        backgroundColor: card ? "rgba(20,10,25,0.45)" : "#fff",
        border: card ? `3px solid ${withAlpha("#ffffff", 0.6)}` : undefined,
        boxShadow: card ? `0 40px 80px rgba(26,4,32,0.4), 0 0 60px ${withAlpha(c.accent, 0.25)}` : "0 40px 80px rgba(26,4,32,0.4)",
      }}
    >
      <div style={{ position: "relative", width, height, borderRadius: card ? 37 : 26, overflow: "hidden", backgroundColor: "#0b0410" }}>
        {video}
        {vignette}
        <PrintOverlay halftone={0.12} grain={0.34} />
        {tag}
      </div>
    </div>
  );
};

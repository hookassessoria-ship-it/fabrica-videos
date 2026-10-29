import React from "react";
import { AbsoluteFill, Audio, interpolate, random, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { useCollageTheme } from "../../brand/collageTheme";
import { withAlpha } from "../../brand/color";

// Identidade "URGENTE" dos vídeos de notícia: selo fixo no topo (acima da safe zone de 250 px)
// com a data, pulsando de leve, e uma tarja com glitch cobrindo o primeiro ~0,55 s.
export type UrgentSpec = { date: string; color: string; label?: string; introSec?: number };

const Badge: React.FC<{ spec: UrgentSpec }> = ({ spec }) => {
  const { f } = useCollageTheme();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const pulse = 0.5 + 0.5 * Math.sin(t * Math.PI * 1.6);
  const enter = interpolate(t, [0.35, 0.6], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div
      style={{
        position: "absolute",
        top: 118,
        left: "50%",
        translate: `-50% ${(1 - enter) * -30}px`,
        scale: 1 + pulse * 0.035,
        opacity: enter,
        display: "flex",
        alignItems: "center",
        gap: 18,
        height: 78,
        padding: "0 30px 0 24px",
        borderRadius: 14,
        backgroundColor: spec.color,
        boxShadow: `0 0 ${24 + pulse * 26}px ${withAlpha(spec.color, 0.55 + pulse * 0.25)}, 0 10px 30px rgba(0,0,0,0.35)`,
        color: "#fff",
        whiteSpace: "nowrap",
      }}
    >
      <div style={{ width: 20, height: 20, borderRadius: 999, backgroundColor: "#fff", opacity: 0.55 + pulse * 0.45 }} />
      <span style={{ fontFamily: f.display, fontWeight: 900, fontSize: 46, letterSpacing: "0.04em" }}>{spec.label ?? "URGENTE"}</span>
      <span style={{ width: 3, height: 40, backgroundColor: "rgba(255,255,255,0.6)" }} />
      <span style={{ fontFamily: f.mono, fontWeight: 700, fontSize: 38 }}>{spec.date}</span>
    </div>
  );
};

// Tarja de abertura: faixa larga com "URGENTE", fatias deslocadas e separação RGB; some até introSec.
const Stripe: React.FC<{ spec: UrgentSpec }> = ({ spec }) => {
  const { f } = useCollageTheme();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const end = spec.introSec ?? 0.55;
  if (t >= end) {
    return null;
  }
  const out = interpolate(t, [end - 0.15, end], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const jx = (random(`ug-x-${frame}`) - 0.5) * 24;
  const split = 4 + random(`ug-s-${frame}`) * 8;
  const slices = [0, 1, 2, 3];
  const word = (color: string, dx: number) => (
    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", translate: `${dx}px 0`, color, mixBlendMode: "screen" }}>
      <span style={{ fontFamily: f.display, fontWeight: 900, fontSize: 150, letterSpacing: "0.04em" }}>{spec.label ?? "URGENTE"}</span>
    </div>
  );
  return (
    <AbsoluteFill style={{ opacity: out }}>
      <AbsoluteFill style={{ backgroundColor: "rgba(0,0,0,0.45)" }} />
      {slices.map((k) => {
        const off = (random(`ug-sl-${frame}-${k}`) - 0.5) * 36;
        return (
          <div key={k} style={{ position: "absolute", left: 0, right: 0, top: 760 + k * 70, height: 70, overflow: "hidden", translate: `${off + jx}px 0` }}>
            <div style={{ position: "absolute", left: 0, right: 0, top: -k * 70, height: 280, backgroundColor: spec.color }}>
              {word("#ff0040", -split)}
              {word("#00e5ff", split)}
              {word("#ffffff", 0)}
            </div>
          </div>
        );
      })}
      {[0, 1, 2].map((k) => (
        <div key={`n${k}`} style={{ position: "absolute", left: 0, right: 0, top: 200 + random(`ug-n-${frame}-${k}`) * 1500, height: 4 + random(`ug-h-${frame}-${k}`) * 10, backgroundColor: withAlpha(spec.color, 0.8) }} />
      ))}
    </AbsoluteFill>
  );
};

export const UrgentOverlay: React.FC<{ spec?: UrgentSpec | null }> = ({ spec }) =>
  spec ? (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <Stripe spec={spec} />
      <Badge spec={spec} />
      {/* alerta curto (dois bipes), baixo: não compete com a primeira palavra */}
      <Audio src={staticFile("sfx/alert-1.mp3")} volume={0.35} />
    </AbsoluteFill>
  ) : null;

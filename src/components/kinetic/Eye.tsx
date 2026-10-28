import React from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";

const BLINK_EVERY = 2.6;
const OUTLINE = "M8 62 Q100 -18 192 62 Q100 142 8 62 Z";

// Olho do "Ponto Cego" (@pontocego.br): contorno off-white, íris em degradê laranja→rosa e
// pupila vazada (o fundo aparece por ela). Pisca a cada 2,6 s e a pupila passeia de leve.
export const PontoCegoEye: React.FC<{ readonly seed: string; readonly at: number; readonly size?: number }> = ({ seed, at, size = 220 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps - at;
  const id = `eye-${seed}`.replace(/[^a-zA-Z0-9-]/g, "");
  const cyc = ((t % BLINK_EVERY) + BLINK_EVERY) % BLINK_EVERY;
  const blink = interpolate(cyc, [BLINK_EVERY - 0.16, BLINK_EVERY - 0.08, BLINK_EVERY], [1, 0.08, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const look = Math.sin(t * 1.3) * 6;
  return (
    <svg width={size} height={size * 0.62} viewBox="0 0 200 124" style={{ overflow: "visible", filter: "drop-shadow(0 0 18px rgba(255,90,120,0.45))" }}>
      <defs>
        <linearGradient id={`${id}-g`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FF8A3D" />
          <stop offset="100%" stopColor="#FF3D8B" />
        </linearGradient>
        <mask id={`${id}-m`}>
          <rect x="0" y="0" width="200" height="124" fill="white" />
          <circle cx={100 + look} cy="62" r="14" fill="black" />
        </mask>
        <clipPath id={`${id}-c`}>
          <path d={OUTLINE} />
        </clipPath>
      </defs>
      <g transform={`translate(0 62) scale(1 ${blink}) translate(0 -62)`}>
        <g clipPath={`url(#${id}-c)`}>
          <circle cx={100 + look} cy="62" r="36" fill={`url(#${id}-g)`} mask={`url(#${id}-m)`} />
        </g>
        <path d={OUTLINE} fill="none" stroke="#F5EFE6" strokeWidth="7" strokeLinejoin="round" />
      </g>
    </svg>
  );
};

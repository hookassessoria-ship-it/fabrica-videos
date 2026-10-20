import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { useCollageTheme } from "../../brand/collageTheme";
import { withAlpha } from "../../brand/color";
import { SAFE, VISUAL } from "../../templates/safeZone";

export type GlowStop = {
  startFrame: number;
  x: number;
  y: number;
};

const GLIDE = 18;

// Centro do glow: segue o elemento principal de cada cena, deslizando entre cenas.
const glowAt = (stops: GlowStop[], frame: number) => {
  let i = 0;
  while (i + 1 < stops.length && frame >= stops[i + 1].startFrame) {
    i++;
  }
  const cur = stops[i];
  const prev = stops[i - 1];
  if (!prev) {
    return cur;
  }
  const t = interpolate(frame, [cur.startFrame, cur.startFrame + GLIDE], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.45, 0, 0.2, 1),
  });
  return { x: prev.x + (cur.x - prev.x) * t, y: prev.y + (cur.y - prev.y) * t };
};

// Fundo tech minimalista, contínuo no vídeo todo (fica fora das transições).
export const CollageBackground: React.FC<{ readonly glow: GlowStop[]; readonly label?: string }> = ({ glow, label }) => {
  const { c, f } = useCollageTheme();
  const frame = useCurrentFrame();
  const g = glow.length > 0 ? glowAt(glow, frame) : { x: VISUAL.centerX, y: VISUAL.centerY };
  const pulse = 1 + Math.sin(frame / 45) * 0.03;
  const line = withAlpha(c.text, 0.16);
  const ticks: React.ReactNode[] = [];
  for (let y = VISUAL.top; y <= VISUAL.bottom; y += 96) {
    ticks.push(<line key={y} x1={SAFE.left - 8} x2={SAFE.left + 8} y1={y} y2={y} stroke={line} strokeWidth={2} />);
  }
  return (
    <AbsoluteFill style={{ backgroundColor: c.background }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle at ${g.x}px ${g.y}px, ${withAlpha(c.accent, 0.3)} 0px, ${withAlpha(c.accent, 0.12)} ${260 * pulse}px, ${withAlpha(c.accent, 0)} ${620 * pulse}px)`,
        }}
      />
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <pattern id="cb-dots" width={36} height={36} patternUnits="userSpaceOnUse">
            <circle cx={18} cy={18} r={2} fill={c.text} />
          </pattern>
        </defs>
        <rect width={1080} height={1920} fill="url(#cb-dots)" opacity={0.06} />
        <line x1={SAFE.left} x2={SAFE.left} y1={VISUAL.top - 30} y2={VISUAL.bottom} stroke={line} strokeWidth={2} />
        <line x1={SAFE.left} x2={SAFE.right} y1={VISUAL.bottom} y2={VISUAL.bottom} stroke={line} strokeWidth={2} />
        {ticks}
      </svg>
      {label ? (
        <div
          style={{
            position: "absolute",
            right: 1080 - SAFE.right,
            top: VISUAL.bottom + 12,
            fontFamily: f.mono,
            fontSize: 20,
            letterSpacing: 2,
            color: withAlpha(c.text, 0.4),
          }}
        >
          {label}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

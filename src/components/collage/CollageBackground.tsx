import React from "react";
import { AbsoluteFill, Easing, interpolate, random, useCurrentFrame, useVideoConfig } from "remotion";
import { useCollageTheme } from "../../brand/collageTheme";
import { withAlpha } from "../../brand/color";
import { SAFE, VISUAL } from "../../templates/safeZone";

export type BackgroundScene = {
  id: string;
  startFrame: number;
  frames: number;
  // Centro do elemento principal (glow).
  x: number;
  y: number;
};

const GLIDE = 18;

const activeIndex = (scenes: BackgroundScene[], frame: number) => {
  let i = 0;
  while (i + 1 < scenes.length && frame >= scenes[i + 1].startFrame) {
    i++;
  }
  return i;
};

// Centro do glow: segue o elemento principal de cada cena, deslizando entre cenas.
const glowAt = (scenes: BackgroundScene[], frame: number) => {
  const i = activeIndex(scenes, frame);
  const cur = scenes[i];
  const prev = scenes[i - 1];
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

// Cruzinha de marcação (registro de impressão).
const Cross: React.FC<{ readonly x: number; readonly y: number; readonly s: number; readonly color: string }> = ({ x, y, s, color }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`} stroke={color} strokeWidth={2}>
    <line x1={-14} x2={14} y1={0} y2={0} />
    <line x1={0} x2={0} y1={-14} y2={14} />
    <circle r={6} fill="none" />
  </g>
);

// Marcas tech discretas que mudam a cada cena: cruzinhas, leitura de coordenadas
// e uma linha de medida tracejada (horizontal, entre as duas cruzinhas de cima).
const TechMarks: React.FC<{ readonly scene: BackgroundScene; readonly local: number }> = ({ scene, local }) => {
  const { c, f } = useCollageTheme();
  const { fps } = useVideoConfig();
  const r = (k: string) => random(`tech-${scene.id}-${k}`);
  const color = withAlpha(c.text, 0.32);
  // Marcas no alto da faixa visual (o meio e a base costumam ter peças e anotações).
  const top = VISUAL.top + 50 + r("ty") * 40;
  const pts: [number, number][] = [
    [SAFE.left + 50 + r("ax") * 160, top + r("ay") * 30],
    [SAFE.right - 40 - r("bx") * 160, top + r("by") * 30],
    [r("side") > 0.5 ? SAFE.right - 30 : SAFE.left + 30, VISUAL.centerY + (r("cy") - 0.5) * 300],
  ];
  const appear = (delay: number) =>
    interpolate(local, [delay * fps, (delay + 0.35) * fps], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.back(2)) });
  const [a, b] = pts;
  const draw = interpolate(local, [0.5 * fps, 1.3 * fps], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic) });
  const end: [number, number] = [b[0], a[1]];
  const dist = Math.round(Math.hypot(end[0] - a[0], end[1] - a[1]));
  const readout = `X ${(scene.x / 1080).toFixed(2)} · Y ${(scene.y / 1920).toFixed(2)}`;
  const label = { fontFamily: f.mono, fontSize: 17, fill: withAlpha(c.text, 0.45), letterSpacing: 1.5 };
  return (
    <g>
      {pts.map(([x, y], i) => (
        <Cross key={i} x={x} y={y} s={appear(0.15 + i * 0.15)} color={color} />
      ))}
      <line
        x1={a[0]}
        y1={a[1]}
        x2={a[0] + (end[0] - a[0]) * draw}
        y2={a[1] + (end[1] - a[1]) * draw}
        stroke={color}
        strokeWidth={2}
        strokeDasharray="10 8"
      />
      <text x={(a[0] + end[0]) / 2} y={a[1] - 14} textAnchor="middle" opacity={draw} {...label}>
        {`${dist} PX`}
      </text>
      <text x={b[0]} y={b[1] + 38} textAnchor="end" opacity={appear(0.7)} {...label}>
        {readout}
      </text>
    </g>
  );
};

// Fundo tech minimalista, contínuo no vídeo todo (fica fora das transições).
export const CollageBackground: React.FC<{ readonly scenes: BackgroundScene[]; readonly label?: string }> = ({ scenes, label }) => {
  const { c, f } = useCollageTheme();
  const frame = useCurrentFrame();
  const g = scenes.length > 0 ? glowAt(scenes, frame) : { x: VISUAL.centerX, y: VISUAL.centerY };
  const active = scenes.length > 0 ? scenes[activeIndex(scenes, frame)] : undefined;
  const pulse = 1 + Math.sin(frame / 45) * 0.03;
  const line = withAlpha(c.text, 0.18);
  const ticks: React.ReactNode[] = [];
  for (let y = VISUAL.top; y <= VISUAL.bottom; y += 96) {
    ticks.push(<line key={y} x1={SAFE.left - 8} x2={SAFE.left + 8} y1={y} y2={y} stroke={line} strokeWidth={2} />);
  }
  return (
    <AbsoluteFill style={{ backgroundColor: c.background }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle at ${g.x}px ${g.y}px, ${withAlpha(c.accent, 0.42)} 0px, ${withAlpha(c.accent, 0.18)} ${300 * pulse}px, ${withAlpha(c.accent, 0)} ${700 * pulse}px)`,
        }}
      />
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <pattern id="cb-dots" width={36} height={36} patternUnits="userSpaceOnUse">
            <circle cx={18} cy={18} r={2.2} fill={c.text} />
          </pattern>
        </defs>
        <rect width={1080} height={1920} fill="url(#cb-dots)" opacity={0.1} />
        <line x1={SAFE.left} x2={SAFE.left} y1={VISUAL.top - 30} y2={VISUAL.bottom} stroke={line} strokeWidth={2} />
        <line x1={SAFE.left} x2={SAFE.right} y1={VISUAL.bottom} y2={VISUAL.bottom} stroke={line} strokeWidth={2} />
        {ticks}
        {active ? <TechMarks key={active.id} scene={active} local={frame - active.startFrame} /> : null}
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
            color: withAlpha(c.text, 0.45),
          }}
        >
          {label}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

import React from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { useCollageTheme } from "../../brand/collageTheme";
import { withAlpha } from "../../brand/color";
import { MonoLabel } from "./KineticText";
import { clamp01, EASE, springAt } from "./motion";

// Mastro com uma figura amarrada (a analogia do Ulisses): mastro, verga e vela recolhida,
// bandeirola no topo e cordas de acento que se desenham uma a uma a partir de `tieAt`,
// cada uma com um nó que pipoca no fim. Depois de amarrada, a figura balança de leve
// (quer ir, mas não sai do lugar).

const ROPE_FRAMES = 7;
const ROPE_EVERY = 5;

export const ropeFrames = (ropes: number) => (ropes - 1) * ROPE_EVERY + ROPE_FRAMES;

type Props = {
  readonly at: number;
  readonly tieAt: number;
  readonly height?: number;
  readonly ropes?: number;
  readonly label?: string;
};

export const Mast: React.FC<Props> = ({ at, tieAt, height = 900, ropes = 4, label }) => {
  const { c } = useCollageTheme();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const H = height;
  const W = H * 0.5;
  const cx = W / 2;
  const t = (frame - at * fps) / fps;
  const grow = interpolate(frame, [at * fps, at * fps + 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE.outExpo });
  const tie = Math.round(tieAt * fps);
  const tied = clamp01((frame - tie - ropeFrames(ropes)) / 6);
  // Figura: entra com mola; amarrada, só balança (força pra sair, sem sair).
  const fig = Math.max(0, springAt(frame, fps, Math.round(at * fps) + 4, "bouncy"));
  const strain = tied * Math.sin(t * 7) * 2.4;
  const pole = 30;
  const yardY = H * 0.13;
  const figTop = H * 0.3;
  const figH = H * 0.46;
  const flag = Math.sin(t * 6) * 10;
  const ropeY = (i: number) => figTop + figH * (0.28 + (0.62 * i) / Math.max(1, ropes - 1));
  const rx = figH * 0.32;
  const ry = figH * 0.06;
  const rope = (i: number, front: boolean) => {
    const p = interpolate(frame, [tie + i * ROPE_EVERY, tie + i * ROPE_EVERY + ROPE_FRAMES], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE.outExpo });
    if (p <= 0) {
      return null;
    }
    const y = ropeY(i);
    const tilt = i % 2 ? -4 : 5;
    const d = front ? `M${cx - rx} ${y} A${rx} ${ry} 0 0 0 ${cx + rx} ${y}` : `M${cx + rx} ${y} A${rx} ${ry} 0 0 0 ${cx - rx} ${y}`;
    const common = { d, fill: "none", strokeLinecap: "round" as const, pathLength: 1, strokeDasharray: 1, strokeDashoffset: 1 - p, transform: `rotate(${tilt} ${cx} ${y})` };
    return (
      <g key={`${i}-${front}`} opacity={front ? 1 : 0.45}>
        <path {...common} stroke={c.accent} strokeWidth={H * 0.016} style={{ filter: front ? `drop-shadow(0 0 12px ${withAlpha(c.accent, 0.9)})` : undefined }} />
        {front ? <path {...common} stroke={withAlpha("#ffffff", 0.7)} strokeWidth={H * 0.004} strokeDasharray="0.03 0.025" strokeDashoffset={0} opacity={p >= 1 ? 1 : 0} /> : null}
      </g>
    );
  };
  // Nó de cada corda (pipoca quando a corda termina de se desenhar).
  const knot = (i: number) => {
    const s = Math.max(0, springAt(frame, fps, tie + i * ROPE_EVERY + ROPE_FRAMES - 1, "bouncy"));
    if (frame < tie + i * ROPE_EVERY + ROPE_FRAMES - 1) {
      return null;
    }
    const y = ropeY(i) + ry * 0.9;
    return <circle key={`k${i}`} cx={cx + (i % 2 ? -rx * 0.35 : rx * 0.3)} cy={y} r={H * 0.014 * s} fill={c.accent} stroke="#fff" strokeWidth={3} />;
  };
  return (
    <div style={{ position: "relative", width: W, height: H }}>
      <svg width={W} height={H} style={{ overflow: "visible" }}>
        <defs>
          <linearGradient id="mast-wood" x1="0" x2="1">
            <stop offset="0%" stopColor={c.cream} />
            <stop offset="60%" stopColor="#cdbf9f" />
            <stop offset="100%" stopColor="#8f8168" />
          </linearGradient>
        </defs>
        <g style={{ transform: `scaleY(${grow})`, transformOrigin: `${cx}px ${H}px` }}>
          {/* mastro */}
          <rect x={cx - pole / 2} y={0} width={pole} height={H} rx={pole / 2} fill="url(#mast-wood)" stroke={withAlpha("#ffffff", 0.7)} strokeWidth={3} />
          {/* bandeirola */}
          <path d={`M${cx + pole / 2} 6 Q${cx + 70} ${20 + flag} ${cx + 120} ${30 + flag * 1.4} Q${cx + 70} ${44 + flag} ${cx + pole / 2} 60 Z`} fill={c.accent} opacity={0.95} />
          {/* verga + vela recolhida */}
          <rect x={cx - W * 0.48} y={yardY} width={W * 0.96} height={16} rx={8} fill="url(#mast-wood)" stroke={withAlpha("#ffffff", 0.6)} strokeWidth={2} />
          <path
            d={`M${cx - W * 0.44} ${yardY + 16} q${W * 0.11} 34 ${W * 0.22} 0 q${W * 0.11} 34 ${W * 0.22} 0 q${W * 0.11} 34 ${W * 0.22} 0 q${W * 0.11} 34 ${W * 0.22} 0 Z`}
            fill={withAlpha(c.cream, 0.9)}
            stroke={withAlpha("#ffffff", 0.8)}
            strokeWidth={2}
          />
        </g>
        {/* metade de trás das cordas (atrás da figura) */}
        {Array.from({ length: ropes }, (_, i) => rope(i, false))}
        {/* figura amarrada */}
        <g transform={`translate(${cx} ${figTop + figH}) scale(${(figH / 24) * fig}) translate(-12 -24)`} fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          {/* figura de braços junto ao corpo (amarrada), em caixa de 24 unidades */}
          <g transform={`rotate(${strain} 12 24)`} style={{ filter: "drop-shadow(0 0 2px rgba(0,0,0,0.7))" }}>
            <circle cx={12} cy={3.6} r={2.5} fill="#fff" stroke="none" />
            <path d="M12 6.8 V15.2 M12 8.2 L9.6 14.6 M12 8.2 L14.4 14.6 M12 15.2 L10.2 22.6 M12 15.2 L13.8 22.6" strokeWidth={2.2} />
          </g>
        </g>
        {/* metade da frente + nós */}
        {Array.from({ length: ropes }, (_, i) => rope(i, true))}
        {Array.from({ length: ropes }, (_, i) => knot(i))}
      </svg>
      {label ? (
        <div style={{ position: "absolute", left: "50%", bottom: -60, translate: "-50% 0", whiteSpace: "nowrap" }}>
          <MonoLabel text={label} at={tieAt + ropeFrames(ropes) / fps} size={26} />
        </div>
      ) : null}
    </div>
  );
};

import * as lucide from "lucide";
import React from "react";
import { interpolate, random, useCurrentFrame, useVideoConfig } from "remotion";
import { useCollageTheme } from "../../brand/collageTheme";
import { withAlpha } from "../../brand/color";
import type { IconContainer, IconPreset } from "../../templates/kineticTypes";
import { clamp01, EASE, springAt, useShot } from "./motion";

type IconNode = [string, Record<string, string | number>][];

// "shopping-cart" -> ShoppingCart (nomes do lucide.dev).
const pascal = (name: string) =>
  name
    .split(/[-_ ]/)
    .filter(Boolean)
    .map((p) => p[0].toUpperCase() + p.slice(1))
    .join("");

export const iconNode = (name: string): IconNode => {
  const node = (lucide as unknown as Record<string, IconNode | undefined>)[pascal(name)];
  if (!node) {
    throw new Error(`Ícone "${name}" não existe no lucide (veja os nomes em lucide.dev/icons)`);
  }
  return node;
};

const DRAW_FRAMES = 14;

type Props = {
  readonly icon: string;
  readonly seed: string;
  readonly at: number;
  readonly preset?: IconPreset;
  readonly size?: number;
  readonly container?: IconContainer;
  readonly color?: string;
  readonly label?: string;
};

// Ícone animado: o traço se desenha ao entrar e cada preset tem movimento próprio.
export const AnimatedIcon: React.FC<Props> = ({ icon, seed, at, preset = "draw", size = 130, container = "circle", color, label }) => {
  const { c, f } = useCollageTheme();
  const { ink } = useShot();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const start = Math.round(at * fps);
  const t = (frame - start) / fps;
  const node = iconNode(icon);
  const stroke = color ?? (container === "none" ? ink : "#ffffff");
  const iconPx = container === "none" ? size : size * 0.52;
  const drawFrames = preset === "chartUp" ? 26 : DRAW_FRAMES;
  const ph = random(`ico-${seed}`) * Math.PI * 2;

  // Movimento do ícone dentro do contêiner.
  let tx = 0;
  let ty = 0;
  let rot = 0;
  let sx = 1;
  let sy = 1;
  let rotY = 0;
  let opacity = 1;
  let origin = "50% 50%";
  const wheelSpin = preset === "drive" || preset === "trail" ? t * 720 : 0;
  switch (preset) {
    case "pop": {
      const s = springAt(frame, fps, start, "bouncy");
      const sq = Math.exp(-(frame - start) / 5) * Math.sin((frame - start) * 0.9) * 0.18;
      sx = s * (1 + sq);
      sy = s * (1 - sq);
      break;
    }
    case "bounce": {
      const b = Math.abs(Math.sin(t * Math.PI * 1.6 + ph));
      ty = -b * iconPx * 0.22;
      const squash = b < 0.15 ? (0.15 - b) * 1.4 : 0;
      sx = 1 + squash;
      sy = 1 - squash;
      origin = "50% 100%";
      break;
    }
    case "spin":
      rot = t * 140;
      break;
    case "spin3d":
      rotY = t * 260;
      break;
    case "pulse":
      sx = sy = 1 + Math.max(0, Math.sin(t * Math.PI * 2.4 + ph)) * 0.12;
      break;
    case "shake": {
      const cyc = (t + ph) % 1.3;
      rot = cyc < 0.35 ? Math.sin(cyc * 60) * 14 * (1 - cyc / 0.35) : 0;
      break;
    }
    case "drive":
    case "trail": {
      const s = springAt(frame, fps, start, "snappy");
      tx = (1 - s) * -size * 1.6 + Math.sin(t * 2.2) * iconPx * 0.05;
      ty = Math.abs(Math.sin(t * 14)) * -iconPx * 0.025;
      break;
    }
    case "grow": {
      const s = springAt(frame, fps, start, "bouncy");
      sy = Math.max(0, s);
      origin = "50% 100%";
      break;
    }
    case "rise":
      ty = -((t * 60) % (iconPx * 0.5)) + iconPx * 0.25;
      opacity = 1 - (((t * 60) % (iconPx * 0.5)) / (iconPx * 0.5)) ** 3;
      break;
    case "float":
      ty = Math.sin(t * 2.4 + ph) * iconPx * 0.08;
      rot = Math.sin(t * 1.7 + ph) * 6;
      break;
    case "blink":
      opacity = random(`${seed}-b${Math.floor(frame / 3)}`) > 0.25 ? 1 : 0.25;
      break;
    default:
      break;
  }

  const strokeW = 2;
  const drawn = (i: number) => clamp01((frame - start - i * 2) / drawFrames);
  const lockClosed = preset === "lock" ? interpolate(frame - start, [16, 22], [-3.5, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE.outBack }) : 0;
  const fillLevel = preset === "fill" ? interpolate(frame - start, [8, 8 + 1.2 * fps], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE.outQuart }) : 0;

  const svg = (
    <svg
      viewBox="0 0 24 24"
      width={iconPx}
      height={iconPx}
      fill="none"
      stroke={stroke}
      strokeWidth={strokeW}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{
        overflow: "visible",
        translate: `${tx}px ${ty}px`,
        rotate: `${rot}deg`,
        scale: `${sx} ${sy}`,
        transform: rotY ? `rotateY(${rotY}deg)` : undefined,
        transformOrigin: origin,
        opacity,
        filter: `drop-shadow(0 2px 6px ${withAlpha("#1a0420", 0.35)})`,
      }}
    >
      {preset === "fill" ? (
        <>
          <defs>
            <clipPath id={`fill-${seed}`}>
              {node.map(([tag, attrs], i) => React.createElement(tag, { key: i, ...attrs }))}
            </clipPath>
          </defs>
          <rect x={0} y={24 - 22 * fillLevel} width={24} height={24} fill={c.accent} clipPath={`url(#fill-${seed})`} stroke="none" />
        </>
      ) : null}
      {node.map(([tag, attrs], i) => {
        const isWheel = tag === "circle" && wheelSpin !== 0;
        const isShackle = preset === "lock" && tag === "path";
        return (
          <g key={i} transform={isShackle ? `translate(0 ${lockClosed})` : undefined}>
            {React.createElement(tag, { ...attrs, pathLength: 1, strokeDasharray: 1, strokeDashoffset: 1 - drawn(i) })}
            {isWheel ? (
              <g transform={`rotate(${wheelSpin} ${attrs.cx} ${attrs.cy})`} opacity={drawn(i)}>
                <line x1={Number(attrs.cx) - Number(attrs.r)} y1={attrs.cy} x2={Number(attrs.cx) + Number(attrs.r)} y2={attrs.cy} strokeWidth={1.4} />
                <line x1={attrs.cx} y1={Number(attrs.cy) - Number(attrs.r)} x2={attrs.cx} y2={Number(attrs.cy) + Number(attrs.r)} strokeWidth={1.4} />
              </g>
            ) : null}
          </g>
        );
      })}
      {preset === "trail" || preset === "drive"
        ? [0, 1, 2].map((k) => (
            <line
              key={k}
              x1={-2 - k * 1.5 - ((t * 40 + k * 7) % 6)}
              x2={-7 - k * 1.5 - ((t * 40 + k * 7) % 6)}
              y1={9 + k * 4}
              y2={9 + k * 4}
              strokeWidth={1.6}
              opacity={0.75 - k * 0.2}
            />
          ))
        : null}
    </svg>
  );

  if (container === "none") {
    return <div style={{ perspective: 600 }}>{svg}</div>;
  }

  // Contêiner: círculo ou pill de vidro com glow suave; o glow respira.
  const glow = 0.45 + Math.sin(t * 2.2 + ph) * 0.15;
  const ring = preset === "pulse" ? (t * 1.2) % 1 : -1;
  const shell: React.CSSProperties = {
    position: "relative",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: size * 0.18,
    height: size,
    minWidth: size,
    padding: container === "pill" ? `0 ${size * 0.32}px 0 ${size * 0.22}px` : 0,
    borderRadius: 999,
    backgroundColor: "rgba(20,10,25,0.5)",
    border: `2.5px solid ${withAlpha("#ffffff", 0.55)}`,
    boxShadow: `0 0 ${size * 0.45}px ${withAlpha(c.accent, glow)}, inset 0 2px 0 ${withAlpha("#ffffff", 0.35)}, 0 18px 40px rgba(26,4,32,0.25)`,
    perspective: 600,
  };
  return (
    <div style={shell}>
      {ring >= 0 ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: 999,
            border: `3px solid ${withAlpha(c.accent, 1 - ring)}`,
            scale: 1 + ring * 0.6,
          }}
        />
      ) : null}
      {svg}
      {label ? (
        <span style={{ fontFamily: f.sans, fontWeight: 800, fontSize: size * 0.34, color: "#fff", letterSpacing: "-0.02em", whiteSpace: "nowrap" }}>{label}</span>
      ) : null}
    </div>
  );
};

type GroupProps = {
  readonly icons: string[];
  readonly seed: string;
  readonly at: number;
  readonly arrangement?: "grid" | "orbit" | "row";
  readonly cols?: number;
  readonly preset?: IconPreset;
  readonly size?: number;
  readonly container?: IconContainer;
  readonly gap?: number;
  readonly radius?: number;
};

// Grupo de ícones entrando em cascata (2–4 frames), em grade, linha ou órbita.
export const IconGroup: React.FC<GroupProps> = ({ icons, seed, at, arrangement = "grid", cols = 3, preset = "pop", size = 120, container = "circle", gap, radius = 300 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const g = gap ?? size * 0.35;
  const n = icons.length;
  const rows = Math.ceil(n / cols);
  const w = arrangement === "row" ? n * size + (n - 1) * g : cols * size + (cols - 1) * g;
  const h = arrangement === "row" ? size : rows * size + (rows - 1) * g;
  return (
    <div style={{ position: "relative", width: arrangement === "orbit" ? radius * 2 : w, height: arrangement === "orbit" ? radius * 2 : h }}>
      {icons.map((name, i) => {
        const iAt = at + (i * 3) / fps;
        let x: number;
        let y: number;
        if (arrangement === "orbit") {
          const ang = (i / n) * Math.PI * 2 + (frame / fps) * 0.5;
          x = radius + Math.cos(ang) * radius;
          y = radius + Math.sin(ang) * radius * 0.82;
        } else if (arrangement === "row") {
          x = i * (size + g) + size / 2;
          y = size / 2;
        } else {
          x = (i % cols) * (size + g) + size / 2;
          y = Math.floor(i / cols) * (size + g) + size / 2;
        }
        const s = springAt(frame, fps, Math.round(iAt * fps), "bouncy");
        if (frame < Math.round(iAt * fps)) {
          return null;
        }
        const bob = Math.sin(frame / fps * 2 + i * 1.7) * 6;
        return (
          <div key={i} style={{ position: "absolute", left: x, top: y + bob, translate: "-50% -50%", scale: Math.max(0, s) }}>
            <AnimatedIcon icon={name} seed={`${seed}-${i}`} at={iAt} preset={preset} size={size} container={container} />
          </div>
        );
      })}
    </div>
  );
};

// Ícone gigante no fundo: traço fino, desfocado e translúcido, girando e derivando devagar.
export const GhostIcon: React.FC<{ readonly icon: string; readonly size?: number; readonly opacity?: number; readonly blur?: number; readonly seed: string }> = ({
  icon,
  size = 640,
  opacity = 0.16,
  blur = 5,
  seed,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const ph = random(`ghost-${seed}`) * Math.PI * 2;
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="#ffffff"
      strokeWidth={1.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ opacity, filter: `blur(${blur}px)`, rotate: `${Math.sin(t * 0.4 + ph) * 8 + t * 4}deg`, overflow: "visible" }}
    >
      {iconNode(icon).map(([tag, attrs], i) => React.createElement(tag, { key: i, ...attrs }))}
    </svg>
  );
};

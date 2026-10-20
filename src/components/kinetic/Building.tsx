import React from "react";
import { Easing, interpolate, random, useCurrentFrame, useVideoConfig } from "remotion";
import { useCollageTheme } from "../../brand/collageTheme";
import { withAlpha } from "../../brand/color";
import { iconNode } from "./AnimatedIcon";
import { clamp01, EASE, springAt } from "./motion";

// Movimento já resolvido (segundos do shot).
export type FloorMove = { at: number; to: number; duration?: number; ease?: "fast" | "slow" | "smooth" };

type Mover = { floor?: number; moves?: FloorMove[] };

type Props = {
  readonly seed: string;
  readonly at: number;
  readonly floors?: number;
  readonly width?: number;
  readonly height?: number;
  readonly elevator?: Mover & { cargo?: string[]; label?: string };
  readonly stairs?: Mover & { label?: string; icon?: string };
  readonly markers?: { at: number; floor: number; icon?: string; label: string }[];
  readonly gap?: { at: number; from: number; to: number; label: string };
  readonly speed?: { label?: string };
};

const EASES = {
  fast: Easing.bezier(0.55, 0, 0.15, 1),
  slow: Easing.bezier(0.35, 0, 0.65, 1),
  smooth: EASE.inOutCubic,
};

// Andar (contínuo) de quem anda: elevador ou bonequinho da escada.
const floorAt = (m: Mover | undefined, frame: number, fps: number) => {
  let f = m?.floor ?? 1;
  let settle = 0;
  for (const mv of [...(m?.moves ?? [])].sort((a, b) => a.at - b.at)) {
    const s = Math.round(mv.at * fps);
    if (frame < s) {
      break;
    }
    const d = Math.max(1, Math.round((mv.duration ?? 1) * fps));
    const p = interpolate(frame, [s, s + d], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASES[mv.ease ?? "smooth"] });
    const from = f;
    f = from + (mv.to - from) * p;
    if (p < 1) {
      settle = 0;
      break;
    }
    // Chegada rápida balança um pouco antes de assentar.
    const k = frame - (s + d);
    settle = mv.ease === "fast" ? Math.sin(k * 0.7) * Math.exp(-k / 6) * 0.12 * Math.sign(mv.to - from) : 0;
  }
  return f + settle;
};

const Icon: React.FC<{ readonly name: string; readonly x: number; readonly y: number; readonly size: number; readonly color?: string; readonly width?: number }> = ({
  name,
  x,
  y,
  size,
  color = "#ffffff",
  width = 2,
}) => (
  <svg x={x - size / 2} y={y - size / 2} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" overflow="visible">
    {iconNode(name).map(([tag, attrs], i) => React.createElement(tag, { key: i, ...attrs }))}
  </svg>
);

// Prédio estilizado da analogia: andar = preço, elevador = inflação (velocidade), escada = salário.
// O elevador e o bonequinho da escada andam por "moves"; marcadores e uma chave apontam andares.
export const Building: React.FC<Props> = ({ seed, at, floors = 10, width = 860, height = 960, elevator, stairs, markers = [], gap, speed }) => {
  const { c, f } = useCollageTheme();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const start = Math.round(at * fps);
  const t = (frame - start) / fps;

  // Geometria: escada ocupa a faixa da esquerda; chave/velocímetro, a da direita.
  // A torre fica no espaço que sobra (no máximo 640px de largura).
  const leftZone = stairs ? width * 0.23 : width * 0.02;
  const rightZone = gap || speed ? width * 0.27 : width * 0.04;
  const towerW = Math.min(640, width - leftZone - rightZone);
  const tx0 = leftZone + (width - leftZone - rightZone - towerW) / 2;
  const tx1 = tx0 + towerW;
  const yRoof = 70;
  const yT = 130;
  const yB = height - 40;
  const fh = (yB - yT) / floors;
  const shaftX0 = tx0 + (tx1 - tx0) * 0.38;
  const shaftX1 = tx0 + (tx1 - tx0) * 0.7;
  const level = (fl: number) => yB - (fl - 1) * fh;

  // Entrada: torre cresce de baixo, andares acendem em cascata.
  const grow = clamp01(springAt(frame, fps, start, "heavy"));
  const floorOn = (i: number) => clamp01((frame - start - 4 - i * 1.5) / 6);

  // Elevador.
  const ef = floorAt(elevator, frame, fps);
  const efPrev = floorAt(elevator, frame - 1, fps);
  const vel = (ef - efPrev) * fps; // andares por segundo
  const carH = fh * 0.86;
  const carW = shaftX1 - shaftX0 - 16;
  const carY = level(ef) - carH;
  const carOn = clamp01(springAt(frame, fps, start + 10, "bouncy"));
  const hover = Math.abs(vel) < 0.05 ? Math.sin(t * 3) * 1.5 : 0;
  const blur = Math.min(10, Math.abs(vel) * 0.9);

  // Escada (lado de fora, à esquerda): um lance por andar, alternando o sentido.
  const sx0 = Math.max(width * 0.02, 52);
  const sx1 = tx0 - 22;
  const stairOn = clamp01((frame - start - 8) / 18);
  const sf = floorAt(stairs, frame, fps);
  const sfPrev = floorAt(stairs, frame - 1, fps);
  const climbing = Math.abs(sf - sfPrev) > 0.0005;
  const flight = Math.min(floors - 1, Math.max(0, Math.floor(sf - 1)));
  const fr = clamp01(sf - 1 - flight);
  const goingRight = flight % 2 === 0;
  const px = goingRight ? sx0 + (sx1 - sx0) * fr : sx1 - (sx1 - sx0) * fr;
  const py = level(sf);
  const step = climbing ? Math.abs(Math.sin(t * 9)) : 0;
  const stairPath = Array.from({ length: floors - 1 }, (_, i) => {
    const y0 = level(i + 1);
    const y1 = level(i + 2);
    const right = i % 2 === 0;
    const n = 6;
    let d = `M${right ? sx0 : sx1} ${y0}`;
    for (let k = 1; k <= n; k++) {
      const xx = right ? sx0 + ((sx1 - sx0) * k) / n : sx1 - ((sx1 - sx0) * k) / n;
      const yy = y0 + ((y1 - y0) * k) / n;
      d += ` H${xx} V${yy}`;
    }
    return d;
  }).join(" ");

  const speedNorm = clamp01(Math.abs(vel) / 10);
  const lit = (i: number, k: number) => random(`${seed}-w${i}-${k}`) > 0.45 || (random(`${seed}-fl${i}-${k}-${Math.floor(t * 1.5 + k)}`) > 0.93);

  return (
    <div style={{ position: "relative", width, height }}>
      <svg width={width} height={height} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
        <defs>
          <linearGradient id={`car-${seed}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={withAlpha("#ffffff", 0.35)} />
            <stop offset="35%" stopColor={c.accent} />
            <stop offset="100%" stopColor={withAlpha(c.accent, 0.85)} />
          </linearGradient>
          <filter id={`vblur-${seed}`} x="-20%" y="-40%" width="140%" height="180%">
            <feGaussianBlur stdDeviation={`0 ${blur.toFixed(1)}`} />
          </filter>
        </defs>

        {/* chão */}
        <line x1={10} x2={width - 10} y1={yB + 2} y2={yB + 2} stroke={withAlpha("#ffffff", 0.7)} strokeWidth={5} strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - grow} />

        {/* torre */}
        <g style={{ transformOrigin: `${(tx0 + tx1) / 2}px ${yB}px`, transform: `scaleY(${grow})` }}>
          <rect x={tx0} y={yT - 14} width={tx1 - tx0} height={yB - yT + 14} rx={26} fill="rgba(20,10,25,0.6)" stroke={withAlpha("#ffffff", 0.6)} strokeWidth={3} />
          <path d={`M${tx0 + 30} ${yT - 14} L${(tx0 + tx1) / 2} ${yRoof} L${tx1 - 30} ${yT - 14}`} fill="rgba(20,10,25,0.6)" stroke={withAlpha("#ffffff", 0.6)} strokeWidth={3} strokeLinejoin="round" />
          <line x1={(tx0 + tx1) / 2} x2={(tx0 + tx1) / 2} y1={yRoof} y2={yRoof - 46} stroke={withAlpha("#ffffff", 0.7)} strokeWidth={4} />
          <circle cx={(tx0 + tx1) / 2} cy={yRoof - 50} r={9} fill={c.accent} opacity={Math.sin(t * 5) > 0 ? 1 : 0.25} />
          {/* poço do elevador */}
          <rect x={shaftX0} y={yT} width={shaftX1 - shaftX0} height={yB - yT} rx={10} fill="rgba(5,2,10,0.55)" />
          {Array.from({ length: floors }, (_, i) => {
            const y = level(i + 1);
            const on = floorOn(i);
            return (
              <g key={i} opacity={on}>
                <line x1={tx0 + 12} x2={tx1 - 12} y1={y - fh} y2={y - fh} stroke={withAlpha("#ffffff", 0.18)} strokeWidth={2} />
                <text x={tx0 + 18} y={y - fh * 0.35} fontFamily={f.mono} fontSize={Math.min(30, fh * 0.34)} fill={withAlpha("#ffffff", 0.75)}>
                  {i + 1}
                </text>
                {[0, 1].map((k) => (
                  <rect
                    key={k}
                    x={tx0 + 64 + k * ((shaftX0 - tx0 - 70) / 2)}
                    y={y - fh * 0.72}
                    width={(shaftX0 - tx0 - 90) / 2}
                    height={fh * 0.44}
                    rx={5}
                    fill={lit(i, k) ? withAlpha(c.cream, 0.85) : withAlpha("#ffffff", 0.08)}
                  />
                ))}
                <rect x={shaftX1 + 14} y={y - fh * 0.72} width={tx1 - shaftX1 - 30} height={fh * 0.44} rx={5} fill={lit(i, 2) ? withAlpha(c.accentLight, 0.8) : withAlpha("#ffffff", 0.08)} />
              </g>
            );
          })}
          {/* cabo */}
          <line x1={(shaftX0 + shaftX1) / 2 + Math.sin(t * 40) * Math.min(3, Math.abs(vel) * 0.3)} x2={(shaftX0 + shaftX1) / 2} y1={yT} y2={carY} stroke={withAlpha("#ffffff", 0.7)} strokeWidth={3} opacity={carOn} />
          {/* linhas de velocidade no poço */}
          {speedNorm > 0.15
            ? Array.from({ length: 6 }, (_, k) => {
                const len = 40 + speedNorm * 90;
                const yy = carY + carH + 20 + ((k * 53 + frame * 22 * Math.sign(vel)) % 260 + 260) % 260;
                return (
                  <line
                    key={k}
                    x1={shaftX0 + 18 + (k % 3) * ((shaftX1 - shaftX0 - 36) / 2)}
                    x2={shaftX0 + 18 + (k % 3) * ((shaftX1 - shaftX0 - 36) / 2)}
                    y1={yy}
                    y2={Math.min(yB, yy + len)}
                    stroke={withAlpha("#ffffff", 0.55 * speedNorm)}
                    strokeWidth={4}
                    strokeLinecap="round"
                  />
                );
              })
            : null}
        </g>

        {/* carro do elevador com a carga */}
        <g
          opacity={carOn}
          filter={blur > 0.6 ? `url(#vblur-${seed})` : undefined}
          style={{ transformOrigin: `${(shaftX0 + shaftX1) / 2}px ${carY + carH / 2}px`, transform: `translateY(${hover}px) scale(${0.6 + 0.4 * carOn})` }}
        >
          <rect x={shaftX0 + 8} y={carY} width={carW} height={carH} rx={14} fill={`url(#car-${seed})`} stroke="#ffffff" strokeWidth={3} />
          <line x1={(shaftX0 + shaftX1) / 2} x2={(shaftX0 + shaftX1) / 2} y1={carY + 8} y2={carY + carH - 8} stroke={withAlpha("#ffffff", 0.45)} strokeWidth={2} />
          {(elevator?.cargo ?? []).slice(0, 2).map((name, k, arr) => (
            <Icon key={name} name={name} x={shaftX0 + 8 + (carW * (k + 1)) / (arr.length + 1)} y={carY + carH * 0.55} size={Math.min(carW / (arr.length + 0.4), carH * 0.62)} />
          ))}
        </g>

        {/* escada + bonequinho */}
        {stairs ? (
          <g opacity={stairOn}>
            <path d={stairPath} fill="none" stroke={withAlpha("#ffffff", 0.75)} strokeWidth={4} strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - stairOn} />
            <g style={{ transform: `translate(${px}px, ${py - 44 - step * 8}px) rotate(${climbing ? Math.sin(t * 9) * 6 : 0}deg)` }}>
              <circle r={46} fill={withAlpha(c.cream, 0.95)} stroke={c.accent} strokeWidth={4} />
              <Icon name={stairs.icon ?? "person-standing"} x={0} y={0} size={60} color="#1a1426" width={2.2} />
            </g>
            {/* gotinhas de suor enquanto sobe */}
            {climbing
              ? [0, 1].map((k) => {
                  const ph = ((t * 1.6 + k * 0.5) % 1 + 1) % 1;
                  return <circle key={k} cx={px + 30 + k * 10 + ph * 16} cy={py - 70 + ph * 34} r={5 * (1 - ph)} fill={c.accentLight} opacity={1 - ph} />;
                })
              : null}
          </g>
        ) : null}
      </svg>

      {/* rótulo em cima do carro */}
      {elevator?.label ? (
        <Pill x={(shaftX0 + shaftX1) / 2} y={carY - 30 + hover} scale={carOn} accent>
          {elevator.label}
        </Pill>
      ) : null}
      {stairs?.label ? (
        <Pill x={Math.max(stairs.label.length * 9 + 26, px)} y={py - 124 - step * 8} scale={stairOn}>
          {stairs.label}
        </Pill>
      ) : null}

      {/* marcadores de andar (à direita da torre) */}
      {markers.map((m, i) => {
        const s = springAt(frame, fps, Math.round(m.at * fps), "bouncy");
        if (frame < m.at * fps) {
          return null;
        }
        const y = level(m.floor) - fh / 2;
        return (
          <React.Fragment key={i}>
            <div style={{ position: "absolute", left: shaftX1, top: y, width: 24 * clamp01(s), height: 0, borderTop: `3px dashed ${withAlpha("#ffffff", 0.8)}` }} />
            <div
              style={{
                position: "absolute",
                left: shaftX1 + 24,
                top: y,
                translate: "0 -50%",
                transformOrigin: "left center",
                scale: Math.max(0, s),
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 20px 10px 14px",
                borderRadius: 999,
                backgroundColor: "rgba(20,10,25,0.72)",
                border: `2.5px solid ${withAlpha("#ffffff", 0.6)}`,
                boxShadow: `0 0 26px ${withAlpha(c.accent, 0.45)}`,
                color: "#fff",
                fontFamily: f.sans,
                fontWeight: 800,
                fontSize: 28,
                whiteSpace: "nowrap",
              }}
            >
              {m.icon ? (
                <svg width={30} height={30} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  {iconNode(m.icon).map(([tag, attrs], k) => React.createElement(tag, { key: k, ...attrs }))}
                </svg>
              ) : null}
              {m.label}
            </div>
          </React.Fragment>
        );
      })}

      {/* chave entre dois andares (a distância entre o salário e o preço) */}
      {gap && frame >= gap.at * fps ? <Gap {...gap} level={level} fh={fh} x={tx1 + 28} /> : null}

      {/* velocímetro: velocidade do elevador = inflação */}
      {speed ? <Speedo x={width - 70} y={yB - 110} value={speedNorm} label={speed.label ?? "velocidade"} on={carOn} /> : null}
    </div>
  );
};

const Pill: React.FC<{ readonly x: number; readonly y: number; readonly scale: number; readonly accent?: boolean; readonly children: React.ReactNode }> = ({ x, y, scale, accent, children }) => {
  const { c, f } = useCollageTheme();
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        translate: "-50% -50%",
        scale: Math.max(0, scale),
        padding: "6px 18px",
        borderRadius: 999,
        backgroundColor: accent ? "#ffffff" : "rgba(20,10,25,0.75)",
        color: accent ? "#16121f" : "#fff",
        border: accent ? undefined : `2px solid ${withAlpha("#ffffff", 0.6)}`,
        fontFamily: f.mono,
        fontWeight: 700,
        fontSize: 26,
        letterSpacing: 2,
        textTransform: "uppercase",
        whiteSpace: "nowrap",
        boxShadow: accent ? `0 0 24px ${withAlpha(c.accent, 0.6)}` : undefined,
      }}
    >
      {children}
    </div>
  );
};

const Gap: React.FC<{ readonly at: number; readonly from: number; readonly to: number; readonly label: string; readonly level: (f: number) => number; readonly fh: number; readonly x: number }> = ({
  at,
  from,
  to,
  label,
  level,
  fh,
  x,
}) => {
  const { c, f } = useCollageTheme();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = interpolate(frame, [at * fps, at * fps + 16], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE.outExpo });
  const s = springAt(frame, fps, Math.round(at * fps) + 10, "bouncy");
  const y0 = level(from) - fh / 2;
  const y1 = level(to) - fh / 2;
  const w = 44;
  return (
    <>
      <svg style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }} width={1} height={1}>
        <path d={`M${x} ${y0} H${x + w} V${y1} H${x}`} fill="none" stroke={c.accent} strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - p} />
      </svg>
      <div
        style={{
          position: "absolute",
          left: x + w + 16,
          top: (y0 + y1) / 2,
          translate: "0 -50%",
          scale: Math.max(0, s),
          transformOrigin: "left center",
          padding: "12px 22px",
          borderRadius: 22,
          backgroundColor: c.accent,
          color: "#fff",
          fontFamily: f.sans,
          fontWeight: 900,
          fontSize: 34,
          lineHeight: 1.05,
          letterSpacing: "-0.02em",
          whiteSpace: "pre",
          boxShadow: `0 0 30px ${withAlpha(c.accent, 0.6)}`,
        }}
      >
        {label}
      </div>
    </>
  );
};

const Speedo: React.FC<{ readonly x: number; readonly y: number; readonly value: number; readonly label: string; readonly on: number }> = ({ x, y, value, label, on }) => {
  const { c, f } = useCollageTheme();
  const frame = useCurrentFrame();
  const r = 62;
  const jitter = value > 0.3 ? Math.sin(frame * 2.3) * 3 * value : 0;
  const ang = -180 + value * 180 + jitter;
  const rad = (ang * Math.PI) / 180;
  return (
    <div style={{ position: "absolute", left: x, top: y, translate: "-50% -50%", scale: on, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
      <svg width={r * 2 + 20} height={r + 24} style={{ overflow: "visible" }}>
        <path d={`M10 ${r + 10} A${r} ${r} 0 0 1 ${r * 2 + 10} ${r + 10}`} fill="rgba(20,10,25,0.6)" stroke={withAlpha("#ffffff", 0.6)} strokeWidth={4} />
        <path d={`M10 ${r + 10} A${r} ${r} 0 0 1 ${r * 2 + 10} ${r + 10}`} fill="none" stroke={c.accent} strokeWidth={10} strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - value} />
        <line x1={r + 10} y1={r + 10} x2={r + 10 + Math.cos(rad) * (r - 14)} y2={r + 10 + Math.sin(rad) * (r - 14)} stroke="#fff" strokeWidth={5} strokeLinecap="round" />
        <circle cx={r + 10} cy={r + 10} r={8} fill="#fff" />
      </svg>
      <div style={{ fontFamily: f.mono, fontSize: 22, letterSpacing: 2, textTransform: "uppercase", color: "#fff", padding: "3px 12px", borderRadius: 999, backgroundColor: "rgba(20,10,25,0.7)" }}>{label}</div>
    </div>
  );
};

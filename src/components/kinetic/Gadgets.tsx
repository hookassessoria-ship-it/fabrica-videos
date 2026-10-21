import React from "react";
import { interpolate, random, useCurrentFrame, useVideoConfig } from "remotion";
import { useCollageTheme } from "../../brand/collageTheme";
import { withAlpha } from "../../brand/color";
import { iconNode } from "./AnimatedIcon";
import { clamp01, EASE, springAt } from "./motion";

// Peças de cena reutilizáveis: celular com scroll infinito, planeta com anéis de gravidade,
// blocos empilhando (construir), duas trilhas lado a lado (comparar caminhos) e bonequinho
// parado com o mundo passando rápido atrás (o tempo correndo sem sair do lugar).

const Lucide: React.FC<{ readonly name: string; readonly size: number; readonly color?: string; readonly width?: number; readonly fill?: string }> = ({ name, size, color = "#fff", width = 2, fill = "none" }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill={fill} stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" style={{ overflow: "visible" }}>
    {iconNode(name).map(([tag, attrs], i) => React.createElement(tag, { key: i, ...attrs }))}
  </svg>
);

const Pill: React.FC<{ readonly text: string; readonly fontSize: number; readonly accent?: boolean }> = ({ text, fontSize, accent = false }) => {
  const { c, f } = useCollageTheme();
  return (
    <div
      style={{
        padding: `${fontSize * 0.28}px ${fontSize * 0.7}px`,
        borderRadius: 999,
        backgroundColor: accent ? c.accent : "rgba(20,10,25,0.6)",
        border: `2px solid ${withAlpha("#ffffff", accent ? 0.7 : 0.45)}`,
        boxShadow: accent ? `0 0 30px ${withAlpha(c.accent, 0.6)}` : undefined,
        fontFamily: f.sans,
        fontWeight: 800,
        fontSize,
        color: "#fff",
        letterSpacing: "-0.01em",
        whiteSpace: "nowrap",
      }}
    >
      {text}
    </div>
  );
};

// ---------------------------------------------------------------- celular

type PhoneProps = {
  readonly seed: string;
  readonly at: number;
  // Altura do aparelho (a largura é metade).
  readonly size?: number;
  // Rolagens por segundo (cada uma "estala" pro próximo vídeo).
  readonly speed?: number;
  // Anéis de acento saindo do aparelho (alerta: o tempo indo embora).
  readonly rings?: boolean;
  readonly label?: string;
};

const TILE_COLORS = ["#7C5CFF", "#FF4FA3", "#3D5AFE", "#E8774A", "#2EC4B6", "#C2185B"];

export const PhoneFeed: React.FC<PhoneProps> = ({ seed, at, size = 760, speed = 2.2, rings = false, label }) => {
  const { c } = useCollageTheme();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = Math.max(0, (frame - at * fps) / fps);
  const w = size * 0.5;
  const pad = w * 0.045;
  const sw = w - pad * 2;
  const sh = size - pad * 2;
  const n = t * speed;
  const idx = Math.floor(n);
  // Cada rolagem: arranca rápido e assenta (como o dedo soltando).
  const frac = EASE.outExpo(clamp01((n - idx) / 0.55));
  const pos = (idx + frac) * sh;
  const tiles = [idx - 1, idx, idx + 1, idx + 2].filter((i) => i >= 0);
  const fingerP = clamp01((n - idx) / 0.35);
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{ position: "relative", width: w, height: size }}>
        {rings
          ? [0, 1, 2].map((k) => {
              const ph = (t * 0.9 + k / 3) % 1;
              return (
                <div
                  key={k}
                  style={{
                    position: "absolute",
                    inset: 0,
                    borderRadius: w * 0.16,
                    border: `4px solid ${withAlpha(c.accent, (1 - ph) * 0.8)}`,
                    scale: 1 + ph * 0.45,
                    boxShadow: `0 0 30px ${withAlpha(c.accent, (1 - ph) * 0.5)}`,
                  }}
                />
              );
            })
          : null}
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: w * 0.16,
            backgroundColor: "#0b0410",
            border: `4px solid ${withAlpha("#ffffff", 0.75)}`,
            boxShadow: `0 40px 80px rgba(26,4,32,0.45), 0 0 60px ${withAlpha(c.accent, 0.35)}`,
            overflow: "hidden",
          }}
        >
          <div style={{ position: "absolute", left: pad - 4, top: pad - 4, width: sw, height: sh, borderRadius: w * 0.12, overflow: "hidden" }}>
            {tiles.map((i) => {
              const col = TILE_COLORS[Math.floor(random(`${seed}-tc${i}`) * TILE_COLORS.length)];
              const bx = random(`${seed}-bx${i}`) * 0.6 + 0.2;
              return (
                <div
                  key={i}
                  style={{
                    position: "absolute",
                    left: 0,
                    top: i * sh - pos,
                    width: sw,
                    height: sh,
                    background: `radial-gradient(circle at ${bx * 100}% 38%, ${withAlpha("#ffffff", 0.35)} 0%, ${col} 32%, ${withAlpha(col, 0.25)} 70%, #0b0410 100%)`,
                  }}
                >
                  {/* coluna de ações e legenda, como num feed de vídeos */}
                  <div style={{ position: "absolute", right: sw * 0.05, bottom: sh * 0.16, display: "flex", flexDirection: "column", gap: sh * 0.045, alignItems: "center" }}>
                    <div style={{ width: sw * 0.13, height: sw * 0.13, borderRadius: "50%", backgroundColor: c.paperWhite, border: `3px solid ${c.accent}` }} />
                    <Lucide name="heart" size={sw * 0.12} fill={withAlpha("#ffffff", 0.9)} />
                    <Lucide name="message-circle" size={sw * 0.12} />
                    <Lucide name="share-2" size={sw * 0.12} />
                  </div>
                  <div style={{ position: "absolute", left: sw * 0.06, bottom: sh * 0.07, display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ width: sw * 0.42, height: sh * 0.022, borderRadius: 8, backgroundColor: withAlpha("#ffffff", 0.85) }} />
                    <div style={{ width: sw * 0.62, height: sh * 0.018, borderRadius: 8, backgroundColor: withAlpha("#ffffff", 0.5) }} />
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ position: "absolute", left: "50%", top: pad * 0.9, translate: "-50% 0", width: w * 0.28, height: w * 0.06, borderRadius: 999, backgroundColor: "#000" }} />
        </div>
        {/* dedo arrastando pra cima a cada rolagem */}
        <div style={{ position: "absolute", left: w * 0.52, top: size * (0.78 - 0.32 * EASE.outQuart(fingerP)), opacity: fingerP < 1 ? 0.95 : 0.3, filter: "drop-shadow(0 6px 10px rgba(0,0,0,0.5))" }}>
          <Lucide name="pointer" size={w * 0.26} width={1.8} fill={withAlpha("#ffffff", 0.9)} color="#1a0420" />
        </div>
      </div>
      {label ? (
        <div style={{ marginTop: size * 0.04 }}>
          <Pill text={label} fontSize={Math.max(28, size * 0.045)} />
        </div>
      ) : null}
    </div>
  );
};

// ---------------------------------------------------------------- planeta

type PlanetProps = {
  readonly seed: string;
  readonly at: number;
  readonly size?: number;
  // Quantos anéis de gravidade pulsando pra fora.
  readonly rings?: number;
  readonly label?: string;
};

export const Planet: React.FC<PlanetProps> = ({ seed, at, size = 420, rings = 3, label }) => {
  const { c } = useCollageTheme();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = Math.max(0, (frame - at * fps) / fps);
  const R = size / 2;
  const box = size * 2.2;
  const cx = box / 2;
  const cy = box / 2;
  const id = `pl-${seed}`;
  // Ondas do oceano: faixas senoidais deslizando dentro do disco.
  const waves = Array.from({ length: 7 }, (_, i) => {
    const y = cy - R + (i + 0.8) * (size / 7.6);
    const amp = R * 0.035 * (1 + (i % 3) * 0.4);
    const ph = t * (1.4 + i * 0.25) + i;
    const d = Array.from({ length: 25 }, (_, k) => {
      const x = cx - R + (k / 24) * size;
      return `${k === 0 ? "M" : "L"}${x.toFixed(1)} ${(y + Math.sin(k * 0.7 + ph) * amp).toFixed(1)}`;
    }).join(" ");
    return <path key={i} d={d} stroke={withAlpha("#ffffff", 0.22 + (i % 2) * 0.12)} strokeWidth={size * 0.008} fill="none" />;
  });
  const ellipse = (k: number, half: "back" | "front") => {
    const ph = (t * 0.55 + k / rings) % 1;
    const rx = R * (1.15 + ph * 1.0);
    const ry = rx * 0.3;
    const o = (1 - ph) ** 1.3 * 0.9 * clamp01(t * 3);
    // metade de trás (atrás do planeta) e da frente (por cima)
    const sweep = half === "front" ? 0 : 1;
    return <path key={`${half}${k}`} d={`M${cx - rx} ${cy} A${rx} ${ry} 0 0 ${sweep} ${cx + rx} ${cy}`} stroke={k === 0 ? c.accent : withAlpha(c.accentLight, 0.9)} strokeWidth={size * 0.012} fill="none" opacity={o} />;
  };
  // Navezinha orbitando.
  const oa = t * 1.3 + random(`pl-${seed}`) * 6;
  const sx = cx + Math.cos(oa) * R * 1.35;
  const sy = cy + Math.sin(oa) * R * 0.42;
  const front = Math.sin(oa) > 0;
  const ship = <ellipse cx={sx} cy={sy} rx={size * 0.035} ry={size * 0.014} fill="#fff" style={{ filter: "drop-shadow(0 0 6px #fff)" }} transform={`rotate(${(Math.cos(oa) * 18).toFixed(1)} ${sx} ${sy})`} />;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <svg width={box} height={box * 0.62} viewBox={`0 ${box * 0.19} ${box} ${box * 0.62}`} style={{ overflow: "visible" }}>
        <defs>
          <radialGradient id={`${id}-sea`} cx="36%" cy="30%" r="80%">
            <stop offset="0%" stopColor="#bdf3ff" />
            <stop offset="22%" stopColor="#3a9cc4" />
            <stop offset="58%" stopColor="#17426b" />
            <stop offset="100%" stopColor="#050c1c" />
          </radialGradient>
          <clipPath id={`${id}-clip`}>
            <circle cx={cx} cy={cy} r={R} />
          </clipPath>
        </defs>
        {Array.from({ length: rings }, (_, k) => ellipse(k, "back"))}
        {!front ? ship : null}
        <circle cx={cx} cy={cy} r={R * 1.06} fill={withAlpha(c.accent, 0.18)} style={{ filter: `blur(${size * 0.04}px)` }} />
        <circle cx={cx} cy={cy} r={R} fill={`url(#${id}-sea)`} />
        <g clipPath={`url(#${id}-clip)`}>
          {waves}
          <circle cx={cx + R * 0.55} cy={cy + R * 0.45} r={R * 1.1} fill="rgba(5,8,20,0.55)" style={{ filter: `blur(${size * 0.06}px)` }} />
        </g>
        <circle cx={cx} cy={cy} r={R} fill="none" stroke={withAlpha("#ffffff", 0.55)} strokeWidth={size * 0.008} />
        {Array.from({ length: rings }, (_, k) => ellipse(k, "front"))}
        {front ? ship : null}
      </svg>
      {label ? <Pill text={label} fontSize={Math.max(28, size * 0.075)} /> : null}
    </div>
  );
};

// ---------------------------------------------------------------- blocos empilhando

type StackProps = {
  readonly seed: string;
  readonly at: number;
  readonly items: { icon: string; label?: string }[];
  // Segundos entre um bloco e o próximo.
  readonly every?: number;
  // Altura de cada bloco.
  readonly size?: number;
};

export const BlockStack: React.FC<StackProps> = ({ seed, at, items, every = 0.35, size = 130 }) => {
  const { c, f } = useCollageTheme();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const bw = size * 4.2;
  const gap = size * 0.12;
  const total = items.length * (size + gap);
  return (
    <div style={{ position: "relative", width: bw + size, height: total + size * 0.3 }}>
      {/* chão */}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: size * 0.1, borderRadius: 99, backgroundColor: withAlpha("#ffffff", 0.55), boxShadow: `0 0 30px ${withAlpha(c.accent, 0.5)}` }} />
      {items.map((it, i) => {
        const start = Math.round((at + i * every) * fps);
        if (frame < start) {
          return null;
        }
        const s = springAt(frame, fps, start, "bouncy");
        const last = i === items.length - 1;
        const off = (i % 2 ? 1 : -1) * size * 0.18 + (random(`${seed}-bo${i}`) - 0.5) * size * 0.1;
        const y = total - (i + 1) * (size + gap) + gap + size * 0.2 - (1 - s) * 520;
        // pancada: o bloco amassa quando bate
        const land = Math.exp(-(frame - start - 6) / 4) * (frame - start > 5 ? 1 : 0);
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: size / 2 + off,
              top: y,
              width: bw,
              height: size,
              borderRadius: size * 0.22,
              display: "flex",
              alignItems: "center",
              gap: size * 0.22,
              padding: `0 ${size * 0.3}px`,
              backgroundColor: last ? c.accent : "rgba(20,10,25,0.55)",
              border: `3px solid ${withAlpha("#ffffff", last ? 0.8 : 0.55)}`,
              boxShadow: `0 0 ${size * 0.4}px ${withAlpha(c.accent, last ? 0.7 : 0.3)}, 0 18px 30px rgba(26,4,32,0.35)`,
              scale: `${1 + land * 0.06} ${1 - land * 0.08}`,
              opacity: clamp01(s * 3),
            }}
          >
            <Lucide name={it.icon} size={size * 0.56} width={2.2} />
            {it.label ? <span style={{ fontFamily: f.sans, fontWeight: 800, fontSize: size * 0.36, color: "#fff", letterSpacing: "-0.02em", whiteSpace: "nowrap" }}>{it.label}</span> : null}
          </div>
        );
      })}
    </div>
  );
};

// ---------------------------------------------------------------- duas trilhas

type Lane = { label: string; icon?: string; rise: number };

type TracksProps = {
  readonly seed: string;
  readonly at: number;
  readonly lanes: Lane[];
  readonly width?: number;
  readonly height?: number;
  // Segundos pra cada linha se desenhar até o fim.
  readonly duration?: number;
};

// Caminhos lado a lado, sem números: linha reta (não sai do lugar) x linha subindo.
export const Tracks: React.FC<TracksProps> = ({ seed, at, lanes, width = 900, height = 560, duration = 2.2 }) => {
  const { c } = useCollageTheme();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const gap = 24;
  const lw = (width - gap * (lanes.length - 1)) / lanes.length;
  return (
    <div style={{ display: "flex", gap }}>
      {lanes.map((lane, i) => {
        const start = (at + i * 0.15) * fps;
        const p = interpolate(frame, [start, start + duration * fps], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE.inOutCubic });
        const up = lane.rise > 0;
        const col = up ? c.accent : withAlpha("#ffffff", 0.75);
        const x0 = lw * 0.12;
        const x1 = lw * 0.88;
        const base = height * 0.8;
        const ph = random(`${seed}-tw${i}`) * 6;
        const yAt = (u: number) => base - lane.rise * u ** 1.7 * height * 0.55 + (up ? 0 : Math.sin(u * 14 + ph) * 4);
        const pts = Array.from({ length: 41 }, (_, k) => [x0 + ((x1 - x0) * k) / 40, yAt(k / 40)]);
        const d = pts.map(([x, y], k) => `${k ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
        const head = pts[Math.round(p * 40)];
        const s = springAt(frame, fps, Math.round(start), "snappy");
        return (
          <div
            key={i}
            style={{
              position: "relative",
              width: lw,
              height,
              borderRadius: 40,
              backgroundColor: "rgba(20,10,25,0.45)",
              border: `2.5px solid ${withAlpha(up ? c.accent : "#ffffff", 0.55)}`,
              boxShadow: up ? `0 0 50px ${withAlpha(c.accent, 0.35)}` : "0 20px 40px rgba(26,4,32,0.3)",
              opacity: clamp01(s * 2),
              translate: `0 ${(1 - s) * 60}px`,
            }}
          >
            <svg width={lw} height={height} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
              <line x1={x0} y1={base + 18} x2={x1} y2={base + 18} stroke={withAlpha("#ffffff", 0.3)} strokeWidth={3} />
              {Array.from({ length: 5 }, (_, k) => (
                <line key={k} x1={x0 + ((x1 - x0) * k) / 4} y1={base + 10} x2={x0 + ((x1 - x0) * k) / 4} y2={base + 26} stroke={withAlpha("#ffffff", 0.35)} strokeWidth={3} />
              ))}
              <path d={d} stroke={col} strokeWidth={10} fill="none" strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - p} style={{ filter: up ? `drop-shadow(0 0 12px ${c.accent})` : undefined }} />
              <circle cx={head[0]} cy={head[1]} r={16} fill={up ? c.accent : "#fff"} stroke="#fff" strokeWidth={4} />
            </svg>
            <div style={{ position: "absolute", left: 0, right: 0, top: 26, display: "flex", justifyContent: "center" }}>
              <Pill text={lane.label} fontSize={Math.min(34, lw / (lane.label.length * 0.62 + 2))} accent={up} />
            </div>
            {lane.icon && p > 0.85 ? (
              <div style={{ position: "absolute", left: head[0] - 40, top: head[1] - 110, scale: Math.max(0, springAt(frame, fps, Math.round(start + duration * fps * 0.85), "bouncy")) }}>
                <Lucide name={lane.icon} size={80} color={up ? c.accentLight : "#fff"} width={2.4} />
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
};

// ---------------------------------------------------------------- parado no mesmo lugar

type TreadmillProps = {
  readonly seed: string;
  readonly at: number;
  // Largura do painel (altura = 75%).
  readonly size?: number;
  readonly speed?: number;
  // Ícones que passam voando atrás (o tempo correndo).
  readonly icons?: string[];
  readonly label?: string;
};

export const Treadmill: React.FC<TreadmillProps> = ({ seed, at, size = 820, speed = 1, icons = ["calendar", "clock", "sun", "moon"], label }) => {
  const { c } = useCollageTheme();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = Math.max(0, (frame - at * fps) / fps);
  const w = size;
  const h = size * 0.75;
  const ground = h * 0.8;
  const v = 1700 * speed;
  const streaks = Array.from({ length: 16 }, (_, i) => {
    const len = 80 + random(`${seed}-sl${i}`) * 220;
    const y = 30 + random(`${seed}-sy${i}`) * (ground - 60);
    const x = w - ((t * v * (0.6 + random(`${seed}-sv${i}`) * 0.8) + random(`${seed}-sx${i}`) * (w + len)) % (w + len));
    return <div key={i} style={{ position: "absolute", left: x, top: y, width: len, height: 4, borderRadius: 4, backgroundColor: i % 4 === 0 ? c.accent : withAlpha("#ffffff", 0.35 + random(`${seed}-so${i}`) * 0.35) }} />;
  });
  const spacing = w * 0.62;
  const flow = (t * v * 0.55) % (spacing * icons.length);
  const passing = icons.map((name, i) => {
    const x = w + 60 - ((flow + i * spacing) % (spacing * icons.length));
    return (
      <div key={i} style={{ position: "absolute", left: x, top: h * (0.16 + (i % 2) * 0.16), filter: "blur(2.5px)", scale: "1.35 1", opacity: 0.85 }}>
        <Lucide name={name} size={h * 0.2} color={withAlpha("#ffffff", 0.85)} />
      </div>
    );
  });
  const dash = (t * v) % 80;
  const breathe = 1 + Math.sin(t * 3) * 0.02;
  const fig = h * 0.36;
  const s = springAt(frame, fps, Math.round(at * fps), "bouncy");
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{ position: "relative", width: w, height: h, borderRadius: 44, overflow: "hidden", backgroundColor: "rgba(20,10,25,0.5)", border: `2.5px solid ${withAlpha("#ffffff", 0.5)}`, boxShadow: "0 30px 60px rgba(26,4,32,0.35)" }}>
        {streaks}
        {passing}
        <svg width={w} height={h} style={{ position: "absolute", inset: 0 }}>
          <line x1={0} y1={ground} x2={w} y2={ground} stroke={withAlpha("#ffffff", 0.6)} strokeWidth={4} />
          <line x1={0} y1={ground + 16} x2={w} y2={ground + 16} stroke={withAlpha("#ffffff", 0.35)} strokeWidth={4} strokeDasharray="40 40" strokeDashoffset={dash} />
        </svg>
        {/* você: parado, no mesmo ponto */}
        <div style={{ position: "absolute", left: w / 2 - fig / 2, top: ground - fig - 8, width: fig, height: fig, borderRadius: "50%", backgroundColor: c.cream, display: "flex", alignItems: "center", justifyContent: "center", scale: Math.max(0, s) * breathe, boxShadow: `0 0 40px ${withAlpha(c.accent, 0.6)}` }}>
          <Lucide name="person-standing" size={fig * 0.7} color={c.ink} width={2.2} />
        </div>
        <div style={{ position: "absolute", left: w / 2 - h * 0.05, top: ground - fig - h * 0.17, opacity: 0.55 + 0.45 * Math.sin(t * 6) }}>
          <Lucide name="map-pin" size={h * 0.1} color={c.accent} width={2.6} />
        </div>
      </div>
      {label ? (
        <div style={{ marginTop: 22 }}>
          <Pill text={label} fontSize={34} />
        </div>
      ) : null}
    </div>
  );
};

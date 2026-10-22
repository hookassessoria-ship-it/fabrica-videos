import React from "react";
import { interpolate, random, useCurrentFrame, useVideoConfig } from "remotion";
import { useCollageTheme } from "../../brand/collageTheme";
import { withAlpha } from "../../brand/color";
import { Particles } from "./Numbers";
import { clamp01, decimalsOf, EASE, formatBR, useShot } from "./motion";

// Peças sobre tempo: relógio (com aceleração), ampulheta (esvaziando e quebrando),
// calendário de folhas voando e contador que troca de valor numa palavra (2… 3… 5 anos).

// Voltas acumuladas com velocidade subindo de s0 a s1 em `ramp` s (curva quadrática:
// começa calmo e dispara). Usado pelo relógio e pelo calendário.
export const rampTurns = (t: number, s0: number, s1: number, ramp: number) => {
  if (t <= 0) {
    return 0;
  }
  const R = Math.max(0.01, ramp);
  if (t <= R) {
    return s0 * t + ((s1 - s0) * t ** 3) / (3 * R * R);
  }
  return s0 * R + ((s1 - s0) * R) / 3 + s1 * (t - R);
};

export const rampSpeed = (t: number, s0: number, s1: number, ramp: number) => (t >= ramp ? s1 : s0 + (s1 - s0) * (Math.max(0, t) / Math.max(0.01, ramp)) ** 2);

const Pill: React.FC<{ readonly text: string; readonly size: number }> = ({ text, size }) => {
  const { f } = useCollageTheme();
  return (
    <div
      style={{
        marginTop: size * 0.08,
        padding: `${size * 0.03}px ${size * 0.07}px`,
        borderRadius: 999,
        backgroundColor: "rgba(20,10,25,0.6)",
        border: `2px solid ${withAlpha("#ffffff", 0.45)}`,
        fontFamily: f.sans,
        fontWeight: 800,
        fontSize: Math.max(26, size * 0.11),
        color: "#fff",
        letterSpacing: "-0.01em",
        whiteSpace: "nowrap",
      }}
    >
      {text}
    </div>
  );
};

// ---------------------------------------------------------------- relógio

type ClockProps = {
  readonly seed: string;
  readonly at: number;
  readonly size?: number;
  // Voltas por segundo do ponteiro grande; `speedTo` acelera até esse valor em `ramp` s.
  readonly speed?: number;
  readonly speedTo?: number;
  readonly ramp?: number;
  // Hora inicial (10.13 = 10h08).
  readonly time?: number;
  readonly label?: string;
  readonly alert?: boolean;
};

export const Clock: React.FC<ClockProps> = ({ seed, at, size = 300, speed = 0.08, speedTo, ramp = 1.5, time = 10.13, label, alert = false }) => {
  const { c } = useCollageTheme();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = (frame - at * fps) / fps;
  const s1 = speedTo ?? speed;
  const turns = rampTurns(t, speed, s1, ramp);
  const minDeg = (time % 1) * 360 + turns * 360;
  const hourDeg = ((time % 12) / 12) * 360 + turns * 30;
  // Rastro (motion blur) quando o ponteiro gira rápido.
  const perFrame = (rampSpeed(t, speed, s1, ramp) * 360) / fps;
  const ghosts = perFrame > 10 ? 6 : 0;
  const R = size / 2;
  const ticks = Array.from({ length: 12 }, (_, i) => {
    const on = clamp01((t * fps - i * 1.2) / 6);
    const a = (i / 12) * Math.PI * 2;
    const major = i % 3 === 0;
    const r0 = R * (major ? 0.72 : 0.78);
    const r1 = R * 0.86;
    return <line key={i} x1={R + Math.sin(a) * r0} y1={R - Math.cos(a) * r0} x2={R + Math.sin(a) * r1} y2={R - Math.cos(a) * r1} stroke="#fff" strokeWidth={major ? size * 0.022 : size * 0.012} strokeLinecap="round" opacity={on} />;
  });
  const hand = (deg: number, len: number, w: number, color: string, opacity = 1, key?: string) => (
    <line key={key} x1={R} y1={R} x2={R + Math.sin((deg * Math.PI) / 180) * len} y2={R - Math.cos((deg * Math.PI) / 180) * len} stroke={color} strokeWidth={w} strokeLinecap="round" opacity={opacity} />
  );
  const rim = alert ? c.accent : "#ffffff";
  const glow = 0.4 + Math.sin(t * 2.4 + random(`clk-${seed}`) * 6) * 0.15 + (alert ? 0.25 : 0);
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          backgroundColor: "rgba(20,10,25,0.5)",
          border: `${Math.max(3, size * 0.012)}px solid ${withAlpha(rim, 0.7)}`,
          boxShadow: `0 0 ${size * 0.35}px ${withAlpha(c.accent, glow)}, inset 0 3px 0 ${withAlpha("#ffffff", 0.3)}, 0 24px 50px rgba(26,4,32,0.35)`,
        }}
      >
        <svg width={size} height={size} style={{ overflow: "visible" }}>
          <circle cx={R} cy={R} r={R * 0.62} fill="none" stroke={withAlpha(c.accent, 0.5)} strokeWidth={size * 0.01} strokeDasharray={`${size * 0.02} ${size * 0.05}`} transform={`rotate(${t * 20} ${R} ${R})`} />
          {ticks}
          {Array.from({ length: ghosts }, (_, k) => hand(minDeg - (perFrame * (k + 1)) / 2, R * 0.74, size * 0.03, c.accentLight, 0.42 - k * 0.06, `g${k}`))}
          {hand(hourDeg, R * 0.46, size * 0.045, "#fff")}
          {hand(minDeg, R * 0.74, size * 0.03, alert ? c.accent : "#fff")}
          <circle cx={R} cy={R} r={size * 0.045} fill={c.accent} style={{ filter: `drop-shadow(0 0 8px ${c.accent})` }} />
        </svg>
      </div>
      {label ? <Pill text={label} size={size} /> : null}
    </div>
  );
};

// ---------------------------------------------------------------- ampulheta

type HourglassProps = {
  readonly seed: string;
  readonly at: number;
  // Altura (a largura é 62% disso).
  readonly size?: number;
  // Segundos pra areia escoar inteira.
  readonly empty?: number;
  // Segundo (do shot) em que o vidro quebra.
  readonly breakAt?: number;
  readonly label?: string;
};

// Contorno do vidro no viewBox 100 x 160 (bulbo de cima, gargalo em y 80, bulbo de baixo).
const GLASS = "M20 14 C20 50 46 66 47 80 C46 94 20 110 20 146 L80 146 C80 110 54 94 53 80 C54 66 80 50 80 14 Z";
const NECK_Y = 80;

export const Hourglass: React.FC<HourglassProps> = ({ seed, at, size = 380, empty = 2, breakAt, label }) => {
  const { c } = useCollageTheme();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = (frame - at * fps) / fps;
  const p = interpolate(t, [0.15, 0.15 + empty], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE.inOutCubic });
  const k = size / 160;
  const w = 100 * k;
  const clip = `hg-${seed}`;
  const topSurface = 30 + (NECK_Y - 2 - 30) * p;
  const bottomSurface = 146 - 40 * p;
  const sand = c.accent;
  const broken = breakAt !== undefined ? (frame - breakAt * fps) / fps : -1;

  if (broken >= 0) {
    // Estilhaços: triângulos do contorno voando pra fora com gravidade; a areia espirra.
    const pts = Array.from({ length: 14 }, (_, i) => {
      const a = (i / 14) * Math.PI * 2;
      return [50 + Math.cos(a) * 32 * (1 + 0.3 * Math.sin(i * 2.1)), 80 + Math.sin(a) * 62];
    });
    const fade = clamp01(1 - broken / 0.9);
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div style={{ position: "relative", width: w, height: size }}>
          <svg width={w} height={size} viewBox="0 0 100 160" style={{ overflow: "visible" }}>
            {pts.map(([x0, y0], i) => {
              const [x1, y1] = pts[(i + 1) % pts.length];
              const cx = (50 + x0 + x1) / 3;
              const cy = (80 + y0 + y1) / 3;
              const dir = Math.atan2(cy - 80, cx - 50);
              const v = 70 + random(`${seed}-sh${i}`) * 90;
              const dx = Math.cos(dir) * v * broken;
              const dy = Math.sin(dir) * v * broken + 140 * broken * broken;
              const rot = (random(`${seed}-sr${i}`) - 0.5) * 720 * broken;
              return (
                <polygon
                  key={i}
                  points={`50,80 ${x0},${y0} ${x1},${y1}`}
                  fill={withAlpha("#ffffff", 0.1)}
                  stroke="#fff"
                  strokeWidth={1.4}
                  opacity={fade}
                  transform={`translate(${dx} ${dy}) rotate(${rot} ${cx} ${cy})`}
                />
              );
            })}
            {/* armação caindo */}
            <rect x={8} y={2} width={84} height={10} rx={4} fill={c.cream} opacity={fade} transform={`translate(${-30 * broken} ${-60 * broken + 120 * broken * broken}) rotate(${-90 * broken} 50 7)`} />
            <rect x={8} y={148} width={84} height={10} rx={4} fill={c.cream} opacity={fade} transform={`translate(${20 * broken} ${80 * broken * broken}) rotate(${25 * broken} 50 153)`} />
          </svg>
          <div style={{ position: "absolute", left: "50%", top: "50%" }}>
            <Particles seed={`${seed}-sand`} at={breakAt ?? 0} count={34} spread={size * 0.9} kind="dots" />
          </div>
        </div>
        {label ? <Pill text={label} size={size * 0.8} /> : null}
      </div>
    );
  }

  // Rachadura nos 8 quadros antes de quebrar.
  const crack = breakAt !== undefined ? clamp01((frame - (breakAt * fps - 8)) / 8) : 0;
  const shake = crack > 0 ? Math.sin(frame * 2.7) * 2.5 * crack : 0;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <svg width={w} height={size} viewBox="0 0 100 160" style={{ overflow: "visible", translate: `${shake}px 0`, filter: `drop-shadow(0 0 ${12 + 10 * p}px ${withAlpha(c.accent, 0.55)})` }}>
        <defs>
          <clipPath id={clip}>
            <path d={GLASS} />
          </clipPath>
        </defs>
        {/* areia de cima descendo, areia de baixo subindo em monte */}
        <g clipPath={`url(#${clip})`}>
          <rect x={0} y={topSurface} width={100} height={NECK_Y - topSurface} fill={sand} />
          <path d={`M0 146 L0 ${bottomSurface + 12} Q50 ${bottomSurface - 10} 100 ${bottomSurface + 12} L100 146 Z`} fill={sand} />
        </g>
        {p > 0 && p < 1 ? (
          <line x1={50} y1={NECK_Y} x2={50} y2={bottomSurface} stroke={sand} strokeWidth={2.2} strokeDasharray="3 2" strokeDashoffset={-frame * 1.5} />
        ) : null}
        <path d={GLASS} fill={withAlpha("#ffffff", 0.07)} stroke="#fff" strokeWidth={2.4} />
        <path d="M27 22 C27 44 40 60 44 70" stroke={withAlpha("#ffffff", 0.45)} strokeWidth={2} fill="none" strokeLinecap="round" />
        {crack > 0 ? <path d="M30 40 L41 52 L35 60 L48 74 L44 86 L58 98" stroke="#fff" strokeWidth={1.6} fill="none" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - crack} /> : null}
        <rect x={8} y={2} width={84} height={10} rx={4} fill={c.cream} />
        <rect x={8} y={148} width={84} height={10} rx={4} fill={c.cream} />
        <line x1={13} y1={12} x2={13} y2={148} stroke={c.cream} strokeWidth={3} />
        <line x1={87} y1={12} x2={87} y2={148} stroke={c.cream} strokeWidth={3} />
      </svg>
      {label ? <Pill text={label} size={size * 0.8} /> : null}
    </div>
  );
};

// ---------------------------------------------------------------- calendário

const MONTHS = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];

type CalendarProps = {
  readonly seed: string;
  readonly at: number;
  readonly size?: number;
  // Folhas por segundo (acelera até `rateTo` em `ramp` s).
  readonly rate?: number;
  readonly rateTo?: number;
  readonly ramp?: number;
  // Texto de cada folha (padrão: meses). Sem números: o que passa voando não é dado.
  readonly pages?: string[];
  readonly label?: string;
};

export const CalendarFlip: React.FC<CalendarProps> = ({ seed, at, size = 360, rate = 4, rateTo, ramp = 1.2, pages = MONTHS, label }) => {
  const { c, f } = useCollageTheme();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = (frame - at * fps) / fps;
  const r1 = rateTo ?? rate;
  const turned = rampTurns(t - 0.25, rate, r1, ramp);
  const n = Math.floor(turned);
  const w = size;
  const h = size * 1.08;
  const header = h * 0.2;
  // Instante (s) em que a folha k foi arrancada: inverte a curva por busca.
  const tearTime = (k: number) => {
    let lo = 0;
    let hi = Math.max(0.01, t);
    for (let i = 0; i < 18; i++) {
      const mid = (lo + hi) / 2;
      if (rampTurns(mid - 0.25, rate, r1, ramp) >= k + 1) {
        hi = mid;
      } else {
        lo = mid;
      }
    }
    return hi;
  };
  const page = (idx: number, style: React.CSSProperties, key: string) => (
    <div
      key={key}
      style={{
        position: "absolute",
        left: 0,
        top: header * 0.55,
        width: w,
        height: h - header * 0.55,
        borderRadius: `0 0 ${w * 0.08}px ${w * 0.08}px`,
        backgroundColor: c.paperWhite,
        boxShadow: "0 10px 30px rgba(26,4,32,0.35)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        paddingTop: header * 0.6,
        ...style,
      }}
    >
      <div style={{ fontFamily: f.display, fontSize: w * 0.34, lineHeight: 1, color: c.ink, letterSpacing: "0.02em" }}>{pages[idx % pages.length]}</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: w * 0.022, marginTop: w * 0.05, width: w * 0.74 }}>
        {Array.from({ length: 28 }, (_, d) => (
          <div key={d} style={{ height: w * 0.055, borderRadius: w * 0.012, backgroundColor: d === (idx * 5) % 28 ? c.accent : withAlpha(c.ink, 0.14) }} />
        ))}
      </div>
    </div>
  );
  const flying = [];
  for (let j = 0; j < 5; j++) {
    const k = n - j;
    if (k < 0) {
      break;
    }
    const age = t - tearTime(k);
    if (age < 0 || age > 0.9) {
      continue;
    }
    const dir = random(`${seed}-cd${k}`) > 0.5 ? 1 : -1;
    const dx = dir * (260 + random(`${seed}-cx${k}`) * 220) * age;
    const dy = -(420 + random(`${seed}-cy${k}`) * 200) * age + 520 * age * age;
    flying.push(
      page(k, { transform: `translate(${dx}px, ${dy}px) rotate(${dir * 220 * age}deg) scaleX(${Math.cos(age * 5)})`, transformOrigin: "50% 0%", opacity: clamp01(1 - age / 0.9) }, `fly${k}`),
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{ position: "relative", width: w, height: h }}>
        {page(n + 1, {}, "next")}
        {/* folhas voando ficam atrás do topo encadernado */}
        {flying}
        <div style={{ position: "absolute", left: 0, top: 0, width: w, height: header, borderRadius: `${w * 0.08}px ${w * 0.08}px 0 0`, backgroundColor: c.accent, boxShadow: `0 0 40px ${withAlpha(c.accent, 0.5)}` }}>
          {[0.25, 0.75].map((x) => (
            <div key={x} style={{ position: "absolute", left: w * x - w * 0.04, top: -header * 0.3, width: w * 0.08, height: header * 0.75, borderRadius: w * 0.04, border: `${w * 0.015}px solid ${c.paperWhite}` }} />
          ))}
        </div>
      </div>
      {label ? <Pill text={label} size={size} /> : null}
    </div>
  );
};

// ---------------------------------------------------------------- contador

type CounterProps = {
  readonly seed: string;
  // Segundo (do shot) em que cada valor entra; o 1º é a entrada do elemento.
  readonly times: number[];
  readonly values: number[];
  readonly prefix?: string;
  readonly suffix?: string;
  readonly size?: number;
  readonly label?: string;
};

// Número herói que troca de valor (sem contar entre eles): cada valor bate com flip, kick
// e brilho; o último solta partículas. Os valores são exatamente os do JSON.
export const Counter: React.FC<CounterProps> = ({ seed, times, values, prefix = "", suffix = "", size = 300, label }) => {
  const { c, f } = useCollageTheme();
  const { ink } = useShot();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  let k = 0;
  times.forEach((ti, i) => {
    if (frame >= Math.round(ti * fps)) {
      k = i;
    }
  });
  const start = Math.round(times[k] * fps);
  const local = frame - start;
  // Cada valor cai de cima e acende em 3 quadros (sem achatar: o tamanho lido é sempre o real).
  const drop = interpolate(local, [0, 5], [-46, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE.outBack });
  const fadeIn = interpolate(local, [0, 3], [0.2, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const kick = interpolate(local, [0, 3, 10], [1.14, 1.04, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE.outQuart });
  const flash = interpolate(local, [0, 3, 16], [0.4, 1, 0.3], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const last = k === values.length - 1;
  const v = values[k];
  return (
    <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center" }}>
      {label ? <div style={{ fontFamily: f.mono, fontSize: size * 0.12, letterSpacing: 6, color: ink, opacity: 0.85, marginBottom: size * 0.02 }}>{label}</div> : null}
      <div
        data-bigtext="box"
        style={{
          display: "flex",
          alignItems: "flex-start",
          fontFamily: f.sans,
          fontWeight: 900,
          fontSize: size,
          lineHeight: 0.9,
          letterSpacing: "-0.05em",
          color: ink,
          scale: kick,
          translate: `0 ${drop}px`,
          opacity: fadeIn,
          textShadow: `0 0 ${20 + 60 * flash}px ${withAlpha(c.accent, 0.35 + 0.5 * flash)}, 0 8px 40px rgba(26,4,32,0.45)`,
        }}
      >
        <span data-num={k} data-main={1}>
          {prefix}
          {formatBR(v, decimalsOf(v))}
        </span>
        <span style={{ fontSize: size * 0.42, marginTop: size * 0.08, marginLeft: size * 0.03, letterSpacing: "-0.02em" }}>{suffix}</span>
      </div>
      {last ? (
        <div style={{ position: "absolute", left: "50%", top: "55%" }}>
          <Particles seed={`${seed}-burst`} at={times[k]} count={30} spread={size * 1.6} />
        </div>
      ) : null}
    </div>
  );
};

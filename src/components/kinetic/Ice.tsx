import React from "react";
import { interpolate, random, useCurrentFrame, useVideoConfig } from "remotion";
import { useCollageTheme } from "../../brand/collageTheme";
import { withAlpha } from "../../brand/color";
import { iconNode } from "./AnimatedIcon";
import { type FloorMove, floorAt } from "./Building";
import { clamp01, decimalsOf, EASE, formatBR, springAt, useShot } from "./motion";

// Peças da analogia do gelo (roteiro 002): o dinheiro é um cubo de gelo que derrete
// (inflação), o salário é a água enchendo o copo, as dívidas caem como dominó, o ciclo
// de preços gira, e a linha do tempo mostra as trocas de moeda com os zeros cortados.

const ICE = {
  hi: "#F2FCFF",
  mid: "#BFE9FA",
  deep: "#7CCBEA",
  water: "#8FD8F5",
};

const Glyph: React.FC<{ readonly name: string; readonly size: number; readonly color?: string; readonly width?: number }> = ({ name, size, color = "#ffffff", width = 2 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" style={{ overflow: "visible" }}>
    {iconNode(name).map(([tag, attrs], i) => React.createElement(tag, { key: i, ...attrs }))}
  </svg>
);

// ---------------------------------------------------------------- cubo de gelo

type IceProps = {
  readonly seed: string;
  readonly at: number;
  readonly size?: number;
  // Texto dentro do cubo ("$") ou número conferido pela revisão (value + prefix).
  readonly label?: string;
  readonly value?: number;
  readonly prefix?: string;
  readonly suffix?: string;
  // Quanto do cubo resta (1 = inteiro), com movimentos já resolvidos.
  readonly remain?: number;
  readonly melt?: FloorMove[];
  // Graus por segundo de giro (0 = parado de frente em 3/4).
  readonly spin?: number;
  readonly puddle?: boolean;
  // Segundo em que para de derreter (mão/freezer): brilho de gelo e sem gotas.
  readonly freezeAt?: number;
  readonly caption?: string;
  readonly alert?: boolean;
};

export const IceCube: React.FC<IceProps> = ({ seed, at, size = 360, label, value, prefix = "", suffix = "", remain = 1, melt = [], spin = 0, puddle = true, freezeAt, caption, alert = false }) => {
  const { c, f } = useCollageTheme();
  const { ink } = useShot();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const start = Math.round(at * fps);
  const t = (frame - start) / fps;
  const r = clamp01(floorAt({ floor: remain, moves: melt }, frame, fps));
  const rPrev = clamp01(floorAt({ floor: remain, moves: melt }, frame - 3, fps));
  const melting = rPrev - r > 0.0005 && (freezeAt === undefined || frame < freezeAt * fps);
  const frozen = freezeAt !== undefined && frame >= freezeAt * fps;
  const gone = 1 - r;
  // O cubo baixa e arredonda; a largura cai menos que a altura.
  const sx = 0.5 + 0.5 * Math.sqrt(r);
  const sy = Math.max(0.04, r);
  const round = 8 + gone * 42;
  const angle = 35 + t * spin + Math.sin(t * 0.8) * 4;
  const S = size;
  const face = (transform: string, shade: number): React.CSSProperties => ({
    position: "absolute",
    left: 0,
    top: 0,
    width: S,
    height: S,
    transform,
    borderRadius: `${round}%`,
    background: `linear-gradient(140deg, ${withAlpha(ICE.hi, 0.62 * shade)} 0%, ${withAlpha(ICE.mid, 0.38 * shade)} 45%, ${withAlpha(ICE.deep, 0.3 * shade)} 100%)`,
    border: `3px solid ${withAlpha("#ffffff", 0.75)}`,
    boxShadow: `inset 0 0 ${S * 0.18}px ${withAlpha("#ffffff", 0.45)}, inset ${S * 0.04}px ${S * 0.04}px 0 ${withAlpha("#ffffff", 0.25)}`,
    backfaceVisibility: "visible",
  });
  const sp = springAt(frame, fps, start, "bouncy");
  const d = value !== undefined ? decimalsOf(value) : 0;
  const text = value !== undefined ? `${prefix}${formatBR(value, d)}${suffix}` : label;
  const glow = frozen ? interpolate(frame, [freezeAt * fps, freezeAt * fps + 10, freezeAt * fps + 30], [0, 1, 0.55], { extrapolateRight: "clamp" }) : 0;
  const puddleW = S * (0.5 + 1.5 * gone);
  // Centro do cubo na tela (desce conforme derrete) e a base dele.
  const cy = S * 0.5 + (S * (1 - sy)) / 2 + S * 0.08;
  const baseY = cy + S * sy * 0.47 + S * sx * 0.12;
  return (
    <div style={{ position: "relative", width: S * 1.6, height: S * 1.9, display: "flex", flexDirection: "column", alignItems: "center", scale: Math.max(0, sp) }}>
      <div style={{ position: "absolute", left: "50%", top: S * 0.2, width: S, height: S, translate: "-50% 0" }}>
        {/* poça */}
        {puddle && gone > 0.02 ? (
          <div
            style={{
              position: "absolute",
              left: S / 2 - puddleW / 2,
              top: baseY - puddleW * 0.1,
              width: puddleW,
              height: puddleW * 0.2,
              borderRadius: "50%",
              background: `radial-gradient(ellipse at 40% 35%, ${withAlpha("#ffffff", 0.55)} 0%, ${withAlpha(alert ? c.accent : ICE.water, 0.55)} 30%, ${withAlpha(alert ? c.accent : ICE.water, 0.12)} 100%)`,
              boxShadow: `0 0 40px ${withAlpha(ICE.water, 0.35)}`,
            }}
          />
        ) : null}
        {/* brilho por trás (frio, ou quente quando congela de novo) */}
        <div
          style={{
            position: "absolute",
            inset: -S * 0.25,
            borderRadius: "50%",
            background: `radial-gradient(circle, ${withAlpha(frozen ? "#E9FBFF" : ICE.mid, 0.28 + 0.4 * glow)} 0%, transparent 65%)`,
          }}
        />
        <div style={{ position: "absolute", inset: 0, perspective: S * 4 }}>
          <div
            style={{
              position: "absolute",
              inset: 0,
              transformStyle: "preserve-3d",
              transform: `translateY(${(S * (1 - sy)) / 2 + S * 0.08}px) rotateX(-20deg) rotateY(${angle}deg) scale3d(${sx}, ${sy}, ${sx})`,
            }}
          >
            <div style={face(`translateZ(${S / 2}px)`, 1)} />
            <div style={face(`rotateY(180deg) translateZ(${S / 2}px)`, 0.8)} />
            <div style={face(`rotateY(90deg) translateZ(${S / 2}px)`, 0.9)} />
            <div style={face(`rotateY(-90deg) translateZ(${S / 2}px)`, 0.9)} />
            <div style={face(`rotateX(90deg) translateZ(${S / 2}px)`, 1.25)} />
            <div style={face(`rotateX(-90deg) translateZ(${S / 2}px)`, 0.6)} />
          </div>
        </div>
        {/* conteúdo "dentro" do gelo: plano, sempre de frente e legível */}
        {text ? (
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: cy - S * 0.02,
              translate: "-50% -50%",
              // número sempre legível, mesmo com o cubo quase derretido
              scale: value !== undefined ? Math.max(0.75, 0.5 + 0.5 * Math.sqrt(r)) : Math.max(0.35, 0.45 + 0.55 * Math.sqrt(r)),
              fontFamily: f.sans,
              fontWeight: 900,
              fontSize: value !== undefined ? S * 0.24 : S * 0.42,
              letterSpacing: "-0.04em",
              whiteSpace: "nowrap",
              color: alert && value === undefined ? c.accent : "#ffffff",
              textShadow: `0 0 18px ${withAlpha(ICE.deep, 0.9)}, 0 4px 14px rgba(8,20,40,0.65)`,
            }}
          >
            {value !== undefined ? (
              <span data-num={0} data-main={1}>
                {text}
              </span>
            ) : (
              text
            )}
          </div>
        ) : null}
        {/* gotas */}
        {melting
          ? Array.from({ length: 6 }).map((_, i) => {
              const period = 14;
              const k = (frame + Math.floor(random(`${seed}-d${i}`) * period)) % period;
              const x = S * (0.5 + (random(`${seed}-dx${i}-${Math.floor((frame + i * 3) / period)}`) - 0.5) * sx * 0.9);
              const y = baseY - S * 0.06 + (k / period) ** 2 * S * 0.3;
              return (
                <div
                  key={i}
                  style={{
                    position: "absolute",
                    left: x,
                    top: y,
                    width: S * 0.05,
                    height: S * 0.07,
                    translate: "-50% 0",
                    borderRadius: "50% 50% 50% 50% / 60% 60% 40% 40%",
                    background: withAlpha(ICE.water, 0.85),
                    boxShadow: `0 0 8px ${withAlpha("#ffffff", 0.6)}`,
                    opacity: 1 - k / period,
                  }}
                />
              );
            })
          : null}
        {/* congelou: estrelinhas de gelo */}
        {frozen
          ? Array.from({ length: 8 }).map((_, i) => {
              const a = (i / 8) * Math.PI * 2 + t * 0.6;
              const rr = S * (0.55 + 0.12 * Math.sin(t * 3 + i));
              const tw = 0.5 + 0.5 * Math.sin(t * 6 + i * 1.7);
              return (
                <div key={i} style={{ position: "absolute", left: S / 2 + Math.cos(a) * rr, top: S / 2 + Math.sin(a) * rr * 0.8, translate: "-50% -50%", opacity: glow * tw }}>
                  <Glyph name="snowflake" size={S * 0.1} color="#E9FBFF" width={2.4} />
                </div>
              );
            })
          : null}
      </div>
      {caption ? (
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: S * 1.62,
            translate: "-50% 0",
            fontFamily: f.mono,
            fontWeight: 700,
            fontSize: Math.max(30, S * 0.1),
            letterSpacing: 3,
            color: ink,
            whiteSpace: "nowrap",
            textShadow: "0 2px 8px rgba(0,0,0,0.6)",
          }}
        >
          {caption}
        </div>
      ) : null}
    </div>
  );
};

// ---------------------------------------------------------------- copo

type GlassProps = {
  readonly seed: string;
  readonly at: number;
  readonly width?: number;
  readonly height?: number;
  // Nível do líquido (0..1) com movimentos já resolvidos.
  readonly level?: number;
  readonly moves?: FloorMove[];
  readonly liquid?: "water" | "whiskey" | "beer";
  // Cubinhos de gelo boiando.
  readonly ice?: number;
  readonly caption?: string;
};

const LIQUID = {
  water: { top: "#BDEBFF", body: "#6EC6EE" },
  whiskey: { top: "#F6C46A", body: "#C77A1E" },
  beer: { top: "#FFE59A", body: "#F2A81D" },
};

export const Glass: React.FC<GlassProps> = ({ seed, at, width = 300, height = 420, level = 0.2, moves = [], liquid = "water", ice = 0, caption }) => {
  const { f } = useCollageTheme();
  const { ink } = useShot();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const lv = clamp01(floorAt({ floor: level, moves }, frame, fps));
  const W = width;
  const H = height;
  const inset = W * 0.1;
  // Paredes levemente abertas (copo baixo).
  const xAt = (y: number) => inset * (1 - y / H);
  const surface = H - lv * (H - H * 0.08);
  const wave = (x: number) => Math.sin(x / 28 + t * 4) * 4;
  const col = LIQUID[liquid];
  const top = `M ${xAt(surface)} ${surface}`;
  const surf = Array.from({ length: 13 }, (_, i) => {
    const x = xAt(surface) + ((W - 2 * xAt(surface)) * i) / 12;
    return `L ${x.toFixed(1)} ${(surface + wave(x)).toFixed(1)}`;
  }).join(" ");
  const body = `${top} ${surf} L ${W - xAt(H)} ${H - 8} Q ${W / 2} ${H + 6} ${xAt(H)} ${H - 8} Z`;
  return (
    <div style={{ position: "relative", width: W, height: H + 80, scale: Math.max(0, springAt(frame, fps, Math.round(at * fps), "snappy")) }}>
      <svg width={W} height={H} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
        <defs>
          <linearGradient id={`${seed}-liq`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor={col.top} stopOpacity={0.95} />
            <stop offset="1" stopColor={col.body} stopOpacity={0.9} />
          </linearGradient>
        </defs>
        {lv > 0.01 ? <path d={body} fill={`url(#${seed}-liq)`} /> : null}
        {/* bolhas (cerveja) */}
        {liquid === "beer" && lv > 0.05
          ? Array.from({ length: 10 }).map((_, i) => {
              const x = W * (0.2 + 0.6 * random(`${seed}-b${i}`));
              const k = ((t * 0.6 + random(`${seed}-bk${i}`)) % 1) * (H - surface);
              return <circle key={i} cx={x} cy={H - 10 - k} r={3 + (i % 3)} fill="#ffffff" opacity={0.6} />;
            })
          : null}
        {/* cubinhos de gelo boiando */}
        {Array.from({ length: ice }).map((_, i) => {
          const s = W * 0.26;
          const x = W * (0.22 + (0.56 * i) / Math.max(1, ice - 1)) - s / 2;
          const y = surface - s * 0.55 + Math.sin(t * 2 + i) * 4;
          return (
            <rect
              key={i}
              x={x}
              y={y}
              width={s}
              height={s}
              rx={s * 0.22}
              fill={withAlpha(ICE.hi, 0.55)}
              stroke="#ffffff"
              strokeWidth={3}
              transform={`rotate(${(i % 2 ? 12 : -9) + Math.sin(t + i) * 3} ${x + s / 2} ${y + s / 2})`}
            />
          );
        })}
        {/* vidro */}
        <path d={`M 0 0 L ${xAt(H)} ${H - 8} Q ${W / 2} ${H + 6} ${W - xAt(H)} ${H - 8} L ${W} 0`} fill={withAlpha("#ffffff", 0.06)} stroke={withAlpha("#ffffff", 0.85)} strokeWidth={6} strokeLinejoin="round" />
        <path d={`M ${W * 0.12} ${H * 0.1} L ${W * 0.18} ${H * 0.8}`} stroke={withAlpha("#ffffff", 0.45)} strokeWidth={8} strokeLinecap="round" />
      </svg>
      {caption ? (
        <div style={{ position: "absolute", left: "50%", top: H + 22, translate: "-50% 0", fontFamily: f.mono, fontWeight: 700, fontSize: 32, letterSpacing: 3, color: ink, whiteSpace: "nowrap" }}>{caption}</div>
      ) : null}
    </div>
  );
};

// ---------------------------------------------------------------- dominó

type DominoProps = {
  readonly seed: string;
  readonly at: number;
  readonly items: { icon?: string; label?: string }[];
  // Segundo (do shot) em que a 1ª peça cai; quantas caem; intervalo entre quedas.
  readonly fallAt?: number;
  readonly fall?: number;
  readonly every?: number;
  readonly size?: number;
  readonly gap?: number;
};

export const Dominoes: React.FC<DominoProps> = ({ seed, at, items, fallAt, fall, every = 0.22, size = 300, gap }) => {
  const { c, f } = useCollageTheme();
  const { ink } = useShot();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const w = size * 0.48;
  const step = gap ?? w * 1.55;
  const n = items.length;
  const falling = fall ?? n;
  const t0 = (fallAt ?? at + 0.6) * fps;
  // Ângulo em que encosta na peça seguinte (a última deita).
  const rest = Math.asin(Math.min(1, (step - w) / size)) * (180 / Math.PI) + 4;
  // A caixa inclui o espaço da última peça deitada, pra centralizar a fila inteira.
  const lying = falling >= n ? size * Math.sin((84 * Math.PI) / 180) : 0;
  return (
    <div style={{ position: "relative", width: step * (n - 1) + w + lying, height: size + 90 }}>
      {items.map((it, i) => {
        const s = springAt(frame, fps, Math.round(at * fps + i * 3), "snappy");
        const fs = t0 + i * every * fps;
        const target = i === n - 1 ? 84 : rest + i * 1.5;
        const p = i < falling ? interpolate(frame, [fs, fs + 0.32 * fps], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE.inExpo }) : 0;
        const bounce = p >= 1 ? Math.sin((frame - fs - 0.32 * fps) * 0.9) * Math.exp(-(frame - fs - 0.32 * fps) / 5) * 3 : 0;
        const ang = p * target - bounce;
        const hot = p > 0;
        return (
          <React.Fragment key={i}>
            <div
              style={{
                position: "absolute",
                left: i * step,
                top: 0,
                width: w,
                height: size,
                transformOrigin: "100% 100%",
                rotate: `${ang}deg`,
                scale: Math.max(0, s),
                borderRadius: w * 0.16,
                background: hot ? `linear-gradient(160deg, ${withAlpha(c.accent, 0.85)}, ${withAlpha(c.accent, 0.45)})` : "linear-gradient(160deg, rgba(40,26,58,0.85), rgba(20,10,25,0.7))",
                border: `3px solid ${withAlpha("#ffffff", hot ? 0.9 : 0.55)}`,
                boxShadow: hot ? `0 0 40px ${withAlpha(c.accent, 0.55)}` : "0 10px 30px rgba(0,0,0,0.4)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: size * 0.08,
              }}
            >
              <div style={{ width: w * 0.62, height: 4, borderRadius: 2, backgroundColor: withAlpha("#ffffff", 0.5) }} />
              {it.icon ? <Glyph name={it.icon} size={w * 0.58} width={2.2} /> : null}
            </div>
            {it.label ? (
              <div
                style={{
                  position: "absolute",
                  left: i * step + w / 2,
                  top: size + 22,
                  translate: "-50% 0",
                  fontFamily: f.sans,
                  fontWeight: 800,
                  fontSize: Math.max(26, Math.min(34, step * 0.2)),
                  color: ink,
                  whiteSpace: "nowrap",
                  opacity: Math.min(1, Math.max(0, s)),
                }}
              >
                {it.label}
              </div>
            ) : null}
            {/* poeira no impacto */}
            {i < falling && frame >= fs + 0.3 * fps && frame < fs + 0.75 * fps ? (
              <div style={{ position: "absolute", left: i * step + w + size * 0.2, top: size - 6 }}>
                {Array.from({ length: 5 }).map((_, k) => {
                  const q = (frame - fs - 0.3 * fps) / (0.45 * fps);
                  const a = -Math.PI * (0.15 + 0.7 * random(`${seed}-${i}-${k}`));
                  return (
                    <div
                      key={k}
                      style={{ position: "absolute", left: Math.cos(a) * 60 * q, top: Math.sin(a) * 40 * q, width: 7, height: 7, borderRadius: "50%", backgroundColor: withAlpha("#ffffff", 0.8 * (1 - q)) }}
                    />
                  );
                })}
              </div>
            ) : null}
          </React.Fragment>
        );
      })}
    </div>
  );
};

// ---------------------------------------------------------------- ciclo

type CycleProps = {
  readonly at: number;
  readonly items: { icon: string; label: string }[];
  readonly radius?: number;
  // Intervalo entre a entrada de cada item (s) e voltas por segundo do brilho.
  readonly every?: number;
  readonly speed?: number;
};

export const Cycle: React.FC<CycleProps> = ({ at, items, radius = 300, every = 0.5, speed = 0.35 }) => {
  const { c, f } = useCollageTheme();
  const { ink } = useShot();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const start = at * fps;
  const t = Math.max(0, (frame - start) / fps);
  const R = radius;
  const n = items.length;
  const ring = interpolate(frame, [start, start + 20], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE.outExpo });
  const runner = -Math.PI / 2 + t * speed * Math.PI * 2;
  const box = R * 2 + 260;
  return (
    <div style={{ position: "relative", width: box, height: box }}>
      <svg width={box} height={box} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
        <circle cx={box / 2} cy={box / 2} r={R} fill="none" stroke={withAlpha("#ffffff", 0.35)} strokeWidth={6} strokeDasharray="2 22" strokeLinecap="round" pathLength={360} />
        <circle
          cx={box / 2}
          cy={box / 2}
          r={R}
          fill="none"
          stroke={c.accent}
          strokeWidth={8}
          pathLength={1}
          strokeDasharray={`${0.22 * ring} 1`}
          strokeDashoffset={-((runner + Math.PI / 2) / (Math.PI * 2)) + 0.22}
          strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 12px ${c.accent})` }}
        />
        {/* setas entre os itens */}
        {items.map((_, i) => {
          const a = -Math.PI / 2 + ((i + 0.5) / n) * Math.PI * 2;
          const x = box / 2 + Math.cos(a) * R;
          const y = box / 2 + Math.sin(a) * R;
          const deg = (a * 180) / Math.PI + 90;
          return <path key={i} d="M -14 -12 L 8 0 L -14 12" transform={`translate(${x} ${y}) rotate(${deg - 90})`} fill="none" stroke={ink} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" opacity={ring} />;
        })}
        <circle cx={box / 2 + Math.cos(runner) * R} cy={box / 2 + Math.sin(runner) * R} r={16 * ring} fill="#ffffff" style={{ filter: `drop-shadow(0 0 16px ${c.accent})` }} />
      </svg>
      {items.map((it, i) => {
        const a = -Math.PI / 2 + (i / n) * Math.PI * 2;
        const s = springAt(frame, fps, Math.round(start + i * every * fps), "bouncy");
        const dist = Math.abs(Math.atan2(Math.sin(runner - a), Math.cos(runner - a)));
        const lit = Math.max(0, 1 - dist / 0.6);
        const cs = 150;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: box / 2 + Math.cos(a) * R,
              top: box / 2 + Math.sin(a) * R,
              translate: "-50% -50%",
              scale: Math.max(0, s) * (1 + 0.08 * lit),
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 10,
            }}
          >
            <div
              style={{
                width: cs,
                height: cs,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: lit > 0.1 ? withAlpha(c.accent, 0.35 + 0.45 * lit) : "rgba(20,10,25,0.6)",
                border: `3px solid ${withAlpha("#ffffff", 0.6 + 0.4 * lit)}`,
                boxShadow: `0 0 ${20 + 40 * lit}px ${withAlpha(c.accent, 0.3 + 0.5 * lit)}`,
              }}
            >
              <Glyph name={it.icon} size={cs * 0.5} width={2.2} />
            </div>
            <div style={{ fontFamily: f.sans, fontWeight: 800, fontSize: 32, color: ink, whiteSpace: "nowrap", textShadow: "0 2px 10px rgba(0,0,0,0.6)" }}>{it.label}</div>
          </div>
        );
      })}
    </div>
  );
};

// ---------------------------------------------------------------- linha do tempo

type TimelineProps = {
  readonly at: number;
  readonly items: { year?: number; label: string; cut?: boolean }[];
  readonly every?: number;
  // Segundo em que as tesouras cortam (uma troca atrás da outra); sem isso, corta assim
  // que a linha entra.
  readonly cutAt?: number;
  readonly width?: number;
  readonly height?: number;
};

// Linha do tempo vertical: cada moeda entra em sequência; nas trocas com corte, um "000"
// cai e a tesoura fecha em cima dele. Os anos são números conferidos pela revisão.
export const Timeline: React.FC<TimelineProps> = ({ at, items, every = 0.28, cutAt, width = 820, height = 980 }) => {
  const { c, f } = useCollageTheme();
  const { ink } = useShot();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const n = items.length;
  const row = height / n;
  const lineP = interpolate(frame, [at * fps, at * fps + (n * every + 0.3) * fps], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const yearW = 150;
  const x0 = 40;
  return (
    <div style={{ position: "relative", width, height }}>
      <div style={{ position: "absolute", left: x0 + yearW + 20, top: row / 2, width: 4, height: (height - row) * lineP, borderRadius: 2, backgroundColor: withAlpha("#ffffff", 0.45) }} />
      {items.map((it, i) => {
        const s0 = Math.round((at + i * every) * fps);
        const s = springAt(frame, fps, s0, "snappy");
        const y = row * i + row / 2;
        const size = Math.min(44, row * 0.46);
        const cutIndex = items.slice(0, i).filter((x) => x.cut).length;
        const cutStart = cutAt !== undefined ? Math.max(s0 + 6, Math.round((cutAt + cutIndex * 0.16) * fps)) : s0 + 6;
        const fallP = interpolate(frame, [cutStart + 6, cutStart + 22], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE.inExpo });
        const snip = interpolate(frame, [cutStart, cutStart + 4, cutStart + 8], [0, 1, 0.2], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        const last = i === n - 1;
        return (
          <div key={i} style={{ position: "absolute", left: 0, top: y, width, translate: "0 -50%", opacity: Math.min(1, Math.max(0, s) * 1.5), scale: 0.9 + 0.1 * Math.min(1, s) }}>
            <div style={{ position: "absolute", left: x0, top: 0, width: yearW, translate: "0 -50%", textAlign: "right", fontFamily: f.mono, fontWeight: 700, fontSize: size, color: last ? c.accentLight : ink }}>
              {it.year !== undefined ? (
                <span data-num={i} data-main={1}>
                  {String(it.year)}
                </span>
              ) : (
                <span style={{ opacity: 0.7 }}>—</span>
              )}
            </div>
            <div
              style={{
                position: "absolute",
                left: x0 + yearW + 22 - 11,
                top: 0,
                width: 22,
                height: 22,
                translate: "0 -50%",
                borderRadius: "50%",
                backgroundColor: it.cut ? c.accent : last ? c.accentLight : "#ffffff",
                boxShadow: it.cut ? `0 0 18px ${c.accent}` : undefined,
              }}
            />
            <div
              style={{
                position: "absolute",
                left: x0 + yearW + 60,
                top: 0,
                translate: "0 -50%",
                fontFamily: f.sans,
                fontWeight: 800,
                fontSize: size * 0.95,
                letterSpacing: "-0.02em",
                color: ink,
                whiteSpace: "nowrap",
              }}
            >
              {it.label}
            </div>
            {it.cut && frame >= cutStart ? (
              <div style={{ position: "absolute", left: width - 190, top: 0, translate: "0 -50%", display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ rotate: `${-25 + 25 * snip}deg`, translate: `0 ${-4 * snip}px` }}>
                  <Glyph name="scissors" size={size * 1.1} color={c.accent} width={2.4} />
                </div>
                <div
                  style={{
                    fontFamily: f.mono,
                    fontWeight: 700,
                    fontSize: size * 0.95,
                    color: c.accent,
                    translate: `0 ${fallP * row * 1.6}px`,
                    rotate: `${fallP * 24}deg`,
                    opacity: 1 - fallP * 0.85,
                    textDecoration: "line-through",
                    textDecorationThickness: 4,
                  }}
                >
                  000
                </div>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
};

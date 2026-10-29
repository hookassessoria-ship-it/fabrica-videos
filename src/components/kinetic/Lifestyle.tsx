import React from "react";
import { interpolate, random, useCurrentFrame, useVideoConfig } from "remotion";
import { useCollageTheme } from "../../brand/collageTheme";
import { withAlpha } from "../../brand/color";
import { iconNode } from "./AnimatedIcon";
import { type FloorMove, floorAt } from "./Building";
import { clamp01, EASE, springAt, useShot } from "./motion";

// Elementos do rikuai-007 (inflação do estilo de vida), reutilizáveis: carteira/cofrinho que
// enche e esvazia, balão que infla e celular com um quiz genérico.

const GLASS = "rgba(20,10,25,0.5)";

// ---------------------------------------------------------------- carteira / cofrinho

// Nível (0..1) do dinheiro dentro: `level` inicial e `moves` [{at, to, duration}] já em
// segundos. Subindo, cédulas/moedas caem pra dentro; descendo, voam pra fora pelo topo.
type MoneyProps = {
  readonly seed: string;
  readonly at: number;
  readonly kind?: "wallet" | "piggy";
  readonly size?: number;
  readonly level?: number;
  readonly moves?: FloorMove[];
  readonly caption?: string;
  readonly alert?: boolean;
};

const NOTE_W = 0.42;
const NOTE_H = 0.2;

// Uma cédula genérica (sem moeda nem rosto): retângulo cream com faixa e círculo de acento.
const Note: React.FC<{ readonly w: number; readonly accent: string; readonly cream: string }> = ({ w, accent, cream }) => (
  <svg width={w} height={w * (NOTE_H / NOTE_W)} viewBox="0 0 42 20" style={{ overflow: "visible" }}>
    <rect x={0} y={0} width={42} height={20} rx={2.5} fill={cream} stroke="#1a1020" strokeWidth={1.2} />
    <rect x={3} y={3} width={36} height={14} rx={1.5} fill="none" stroke={withAlpha(accent, 0.8)} strokeWidth={1.2} />
    <circle cx={21} cy={10} r={4.2} fill={withAlpha(accent, 0.85)} />
  </svg>
);

const Coin: React.FC<{ readonly d: number; readonly accent: string }> = ({ d, accent }) => (
  <svg width={d} height={d} viewBox="0 0 20 20">
    <circle cx={10} cy={10} r={9} fill={accent} stroke="#ffffff" strokeWidth={1.6} />
    <circle cx={10} cy={10} r={5.5} fill="none" stroke={withAlpha("#ffffff", 0.75)} strokeWidth={1.2} />
  </svg>
);

// Momentos em que o nível muda, com o sentido (pra soltar as cédulas no tempo certo).
const flightsOf = (moves: FloorMove[], level: number) => {
  let cur = level;
  return [...moves]
    .sort((a, b) => a.at - b.at)
    .map((m) => {
      const out = { at: m.at, dir: Math.sign(m.to - cur), amount: Math.abs(m.to - cur), duration: m.duration ?? 1 };
      cur = m.to;
      return out;
    });
};

export const MoneyBox: React.FC<MoneyProps> = ({ seed, at, kind = "wallet", size = 360, level = 1, moves = [], caption, alert = false }) => {
  const { c, f } = useCollageTheme();
  const { ink } = useShot();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const lv = clamp01(floorAt({ floor: level, moves }, frame, fps));
  const pop = Math.max(0, springAt(frame, fps, Math.round(at * fps), "bouncy"));
  const flights = flightsOf(moves, level);
  const empty = lv < 0.04;
  const col = alert || empty ? c.accent : "#ffffff";
  const W = size;
  const H = kind === "wallet" ? size * 0.72 : size * 0.86;
  // Cédulas/moedas em voo: 7 por movimento, espalhadas ao longo dele.
  const flying = flights.flatMap((fl, j) =>
    Array.from({ length: Math.max(3, Math.round(7 * Math.min(1, fl.amount * 1.4))) }, (_, k) => {
      const s = (fl.at + (k / 7) * fl.duration * 0.8) * fps;
      const p = (frame - s) / (0.75 * fps);
      if (p < 0 || p > 1) {
        return null;
      }
      const r = random(`${seed}-f${j}-${k}`);
      const side = r < 0.5 ? -1 : 1;
      // pra fora: sobe e abre pros lados; pra dentro: cai de cima até a boca
      const x = fl.dir < 0 ? W / 2 + side * (40 + r * W * 0.6) * EASE.outQuart(p) : W / 2 + side * (W * 0.45) * (1 - EASE.outQuart(p));
      const y = fl.dir < 0 ? H * 0.18 - (H * 0.9 * EASE.outQuart(p) - H * 0.5 * p * p) : -H * 0.6 + H * 0.75 * EASE.outQuart(p);
      const op = fl.dir < 0 ? interpolate(p, [0, 0.1, 0.75, 1], [0, 1, 1, 0]) : interpolate(p, [0, 0.15, 0.85, 1], [0, 1, 1, 0]);
      const rot = (r - 0.5) * 720 * p + side * 20;
      return (
        <div key={`${j}-${k}`} style={{ position: "absolute", left: x, top: y, translate: "-50% -50%", rotate: `${rot}deg`, opacity: op }}>
          {kind === "wallet" ? <Note w={size * 0.28} accent={c.accent} cream={c.cream} /> : <Coin d={size * 0.14} accent={c.accent} />}
        </div>
      );
    }),
  );
  // Vazio: poeirinha saindo e a carteira treme de leve.
  const shake = empty ? Math.sin(t * 22) * 2.5 : 0;
  return (
    <div style={{ position: "relative", width: W, height: H + (caption ? 70 : 0), scale: pop }}>
      <div style={{ position: "absolute", left: 0, top: 0, width: W, height: H, translate: `${shake}px 0` }}>
        {kind === "wallet" ? <WalletBody seed={seed} w={W} h={H} level={lv} color={col} accent={c.accent} cream={c.cream} t={t} /> : <PiggyBody seed={seed} w={W} h={H} level={lv} color={col} accent={c.accent} t={t} />}
        {empty
          ? Array.from({ length: 5 }, (_, i) => {
              const ph = ((t * 0.7 + i / 5) % 1 + 1) % 1;
              return (
                <div
                  key={i}
                  style={{
                    position: "absolute",
                    left: W * (0.3 + 0.1 * i),
                    top: H * 0.12 - ph * H * 0.35,
                    width: 10,
                    height: 10,
                    borderRadius: 5,
                    background: withAlpha("#ffffff", 0.55 * (1 - ph)),
                  }}
                />
              );
            })
          : null}
      </div>
      {flying}
      {caption ? (
        <div style={{ position: "absolute", left: 0, right: 0, top: H + 18, textAlign: "center", fontFamily: f.mono, fontWeight: 700, fontSize: Math.max(30, size * 0.09), color: ink, letterSpacing: "0.06em" }}>
          {caption}
        </div>
      ) : null}
    </div>
  );
};

const WalletBody: React.FC<{ readonly seed: string; readonly w: number; readonly h: number; readonly level: number; readonly color: string; readonly accent: string; readonly cream: string; readonly t: number }> = ({
  seed,
  w,
  h,
  level,
  color,
  accent,
  cream,
  t,
}) => {
  // Cédulas aparecendo pela boca da carteira: até 4, descem quando o nível cai.
  const notes = 4;
  return (
    <svg width={w} height={h} viewBox="0 0 100 72" style={{ overflow: "visible", filter: `drop-shadow(0 10px 24px ${withAlpha("#000000", 0.45)})` }}>
      {Array.from({ length: notes }, (_, i) => {
        const show = clamp01(level * notes - i);
        const lift = 14 * show + Math.sin(t * 2 + i) * 0.8;
        return (
          <g key={i} transform={`translate(${18 + i * 14} ${20 - lift}) rotate(${(random(`${seed}-n${i}`) - 0.5) * 18})`} opacity={show > 0.02 ? 1 : 0}>
            <rect x={0} y={0} width={34} height={18} rx={2} fill={cream} stroke="#1a1020" strokeWidth={1} />
            <rect x={2.5} y={2.5} width={29} height={13} rx={1.2} fill="none" stroke={withAlpha(accent, 0.8)} strokeWidth={1} />
            <circle cx={17} cy={9} r={3.4} fill={withAlpha(accent, 0.85)} />
          </g>
        );
      })}
      {/* corpo */}
      <rect x={4} y={18} width={92} height={52} rx={9} fill={GLASS} stroke={color} strokeWidth={3.2} />
      {/* aba com o botão */}
      <path d="M 58 32 H 96 V 52 H 58 Q 52 52 52 46 V 38 Q 52 32 58 32 Z" fill={withAlpha("#140a1c", 0.75)} stroke={color} strokeWidth={3} />
      <circle cx={63} cy={42} r={3.2} fill={level < 0.04 ? accent : color} />
      {/* costura */}
      <rect x={9} y={23} width={82} height={42} rx={6} fill="none" stroke={withAlpha(color, 0.45)} strokeWidth={1.2} strokeDasharray="3 3" />
    </svg>
  );
};

const PiggyBody: React.FC<{ readonly seed: string; readonly w: number; readonly h: number; readonly level: number; readonly color: string; readonly accent: string; readonly t: number }> = ({
  seed,
  w,
  h,
  level,
  color,
  accent,
  t,
}) => {
  const node = iconNode("piggy-bank");
  const id = `pig-${seed}`.replace(/[^a-zA-Z0-9-]/g, "");
  // Nível do "recheio" (moedas) dentro do porquinho, ondulando de leve.
  const top = 22 - 17 * level;
  return (
    <svg width={w} height={h} viewBox="0 -2 24 22" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" style={{ overflow: "visible", filter: `drop-shadow(0 8px 18px ${withAlpha("#000000", 0.45)})` }}>
      <defs>
        <clipPath id={id}>
          {node.map(([tag, attrs], i) => React.createElement(tag, { key: i, ...attrs }))}
        </clipPath>
      </defs>
      {node.map(([tag, attrs], i) => React.createElement(tag, { key: `g${i}`, ...attrs, fill: GLASS, stroke: "none" }))}
      {level > 0.01 ? <path d={`M -2 ${top + Math.sin(t * 3) * 0.3} Q 6 ${top - 0.6} 12 ${top} T 26 ${top} V 26 H -2 Z`} fill={withAlpha(accent, 0.9)} stroke="none" clipPath={`url(#${id})`} /> : null}
      {node.map(([tag, attrs], i) => React.createElement(tag, { key: `s${i}`, ...attrs }))}
    </svg>
  );
};

// ---------------------------------------------------------------- balão

type BalloonProps = {
  readonly seed: string;
  readonly at: number;
  // Diâmetro com escala 1.
  readonly size?: number;
  // Escala inicial e movimentos (inflando: to > atual).
  readonly scale?: number;
  readonly moves?: FloorMove[];
  readonly text?: string;
  readonly alert?: boolean;
};

export const Balloon: React.FC<BalloonProps> = ({ seed, at, size = 560, scale = 0.45, moves = [], text, alert = false }) => {
  const { c, f } = useCollageTheme();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps - at;
  const pop = Math.max(0, springAt(frame, fps, Math.round(at * fps), "bouncy"));
  const k = Math.max(0.05, floorAt({ floor: scale, moves }, frame, fps));
  // Inflando: estica na vertical e respira; cheio demais (≥ 0,9) treme.
  const breathe = 1 + Math.sin(t * 2.6) * 0.015;
  const tense = clamp01((k - 0.85) / 0.15);
  const jitter = tense * Math.sin(t * 40) * 3;
  const d = size * k * breathe;
  const fill = alert || tense > 0.5 ? c.accent : c.accentLight;
  const id = `bal-${seed}`.replace(/[^a-zA-Z0-9-]/g, "");
  const stringLen = size * 0.42;
  const sway = Math.sin(t * 1.8) * 10;
  const lines = text?.split("\n") ?? [];
  const fontPx = Math.max(30, Math.min(d * 0.16, (d * 0.78) / Math.max(4, Math.max(...lines.map((l) => l.length), 1) * 0.58)));
  return (
    <div style={{ position: "relative", width: size, height: size * 1.12 + stringLen * 0.2, scale: pop }}>
      <div style={{ position: "absolute", left: size / 2 + jitter, top: size * 0.56 + (size - d) * 0.42, translate: "-50% -50%" }}>
        <svg width={d} height={d * 1.16} viewBox="0 0 100 116" style={{ overflow: "visible", filter: `drop-shadow(0 18px 40px ${withAlpha(fill, 0.45)})` }}>
          <defs>
            <radialGradient id={`${id}-g`} cx="0.35" cy="0.3" r="0.8">
              <stop offset="0" stopColor="#ffffff" stopOpacity={0.85} />
              <stop offset="0.25" stopColor={fill} />
              <stop offset="1" stopColor={withAlpha(c.accent, 1)} />
            </radialGradient>
          </defs>
          <path d="M 50 2 C 80 2 98 26 98 52 C 98 80 72 102 50 104 C 28 102 2 80 2 52 C 2 26 20 2 50 2 Z" fill={`url(#${id}-g)`} stroke="#ffffff" strokeWidth={2.4} />
          {/* nó */}
          <path d="M 45 104 L 55 104 L 52 111 L 48 111 Z" fill={c.accent} stroke="#ffffff" strokeWidth={1.6} />
          {/* reflexo */}
          <ellipse cx={32} cy={26} rx={10} ry={16} fill="#ffffff" opacity={0.35} transform="rotate(-25 32 26)" />
          {/* linhas de tensão quando cheio demais */}
          {tense > 0
            ? [0, 1, 2].map((i) => <path key={i} d={`M ${70 + i * 6} ${18 + i * 10} q 6 4 4 12`} stroke="#ffffff" strokeWidth={1.6} fill="none" opacity={tense * 0.8} />)
            : null}
        </svg>
        {text ? (
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: d * 0.5,
              translate: "0 -50%",
              textAlign: "center",
              fontFamily: f.sans,
              fontWeight: 900,
              fontSize: fontPx,
              lineHeight: 1.0,
              color: "#ffffff",
              textShadow: `0 3px 10px ${withAlpha("#1a0420", 0.6)}`,
              whiteSpace: "pre",
            }}
          >
            {text}
          </div>
        ) : null}
      </div>
      {/* barbante */}
      <svg width={size} height={size * 1.5} style={{ position: "absolute", left: 0, top: 0, overflow: "visible", pointerEvents: "none" }}>
        <path
          d={`M ${size / 2 + jitter} ${size * 0.56 + (size - d) * 0.42 + d * 0.62} q ${sway} ${stringLen * 0.35} ${-sway * 0.6} ${stringLen * 0.7} t ${sway * 0.4} ${stringLen * 0.3}`}
          stroke={withAlpha("#ffffff", 0.75)}
          strokeWidth={3}
          fill="none"
        />
      </svg>
    </div>
  );
};

// ---------------------------------------------------------------- celular com quiz

type QuizProps = {
  readonly seed: string;
  readonly at: number;
  // Largura do celular (altura = 2×).
  readonly size?: number;
  readonly title?: string;
  readonly question?: string;
  readonly options?: string[];
  // Opção que recebe o toque (índice) e quando (s do shot; padrão at + 1,2).
  readonly pick?: number;
  readonly pickAt?: number;
};

export const QuizPhone: React.FC<QuizProps> = ({
  seed,
  at,
  size = 400,
  title = "DIAGNÓSTICO",
  question = "Pra onde vai o seu dinheiro?",
  options = ["Delivery e apps", "Assinaturas", "Não faço ideia"],
  pick = 2,
  pickAt,
}) => {
  const { c, f } = useCollageTheme();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const start = Math.round(at * fps);
  const W = size;
  const H = size * 2;
  const pop = Math.max(0, springAt(frame, fps, start, "snappy"));
  const tap = Math.round((pickAt ?? at + 1.2) * fps);
  const tapP = clamp01((frame - tap) / 8);
  const progress = interpolate(frame, [start + 6, start + 20, tap, tap + 10], [0, 0.2, 0.2, 0.45], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE.outQuart });
  const pad = W * 0.08;
  const fs = W * 0.075;
  return (
    <div style={{ position: "relative", width: W, height: H, scale: pop, rotate: `${Math.sin(frame / fps) * 1.2}deg` }}>
      {/* aparelho */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: W * 0.14,
          border: `${Math.max(5, W * 0.016)}px solid #ffffff`,
          background: "linear-gradient(180deg, rgba(24,12,34,0.92), rgba(10,6,18,0.95))",
          boxShadow: `0 30px 80px ${withAlpha("#000000", 0.55)}, 0 0 60px ${withAlpha(c.accent, 0.25)}`,
          overflow: "hidden",
        }}
      >
        {/* notch */}
        <div style={{ position: "absolute", left: "50%", top: W * 0.035, width: W * 0.28, height: W * 0.05, borderRadius: W * 0.03, background: "#000000", translate: "-50% 0" }} />
        <div style={{ position: "absolute", left: pad, right: pad, top: W * 0.16 }}>
          <div style={{ fontFamily: f.mono, fontWeight: 700, fontSize: fs * 0.62, color: c.accentLight, letterSpacing: "0.12em" }}>{title}</div>
          {/* progresso */}
          <div style={{ marginTop: W * 0.04, height: W * 0.025, borderRadius: W * 0.02, background: withAlpha("#ffffff", 0.15) }}>
            <div style={{ width: `${progress * 100}%`, height: "100%", borderRadius: W * 0.02, background: c.accent }} />
          </div>
          <div style={{ marginTop: W * 0.09, fontFamily: f.sans, fontWeight: 900, fontSize: fs * 1.05, lineHeight: 1.12, color: "#ffffff" }}>{question}</div>
          <div style={{ marginTop: W * 0.08, display: "flex", flexDirection: "column", gap: W * 0.045 }}>
            {options.map((o, i) => {
              const s = Math.max(0, springAt(frame, fps, start + 10 + i * 5, "snappy"));
              const chosen = i === pick && tapP > 0;
              return (
                <div
                  key={i}
                  style={{
                    position: "relative",
                    padding: `${W * 0.045}px ${W * 0.06}px`,
                    borderRadius: W * 0.06,
                    border: `${Math.max(2, W * 0.007)}px solid ${chosen ? c.accent : withAlpha("#ffffff", 0.5)}`,
                    background: chosen ? withAlpha(c.accent, 0.35 + 0.4 * tapP) : withAlpha("#ffffff", 0.06),
                    fontFamily: f.sans,
                    fontWeight: 800,
                    fontSize: fs * 0.82,
                    color: "#ffffff",
                    opacity: s,
                    translate: `${(1 - s) * 40}px 0`,
                    overflow: "hidden",
                  }}
                >
                  {o}
                  {chosen ? (
                    <div
                      style={{
                        position: "absolute",
                        right: W * 0.05,
                        top: "50%",
                        width: W * 0.08,
                        height: W * 0.08,
                        borderRadius: "50%",
                        background: c.accent,
                        border: "2px solid #ffffff",
                        translate: "0 -50%",
                        scale: Math.max(0, springAt(frame, fps, tap + 2, "bouncy")),
                      }}
                    />
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
        {/* toque: círculo que expande sobre a opção escolhida */}
        {frame >= tap && frame < tap + 14 ? (
          <div
            style={{
              position: "absolute",
              left: W * 0.62,
              top: W * 0.16 + W * 0.53 + pick * (W * 0.045 * 2 + fs * 0.82 * 1.2 + W * 0.045) + W * 0.05,
              width: W * 0.1,
              height: W * 0.1,
              borderRadius: "50%",
              border: "3px solid #ffffff",
              translate: "-50% -50%",
              scale: 1 + (frame - tap) / 5,
              opacity: 1 - (frame - tap) / 14,
            }}
          />
        ) : null}
      </div>
    </div>
  );
};

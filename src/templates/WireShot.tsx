import React, { useRef } from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { useCollageTheme } from "../brand/collageTheme";
import { withAlpha } from "../brand/color";
import { cameraAt, type CamSpec, project, threeCamera } from "../components/wire/camera";
import { barGrow, Bars3D, barsLayout, Line3D, lineLayout, lineProgress } from "../components/wire/charts";
import { Head } from "../components/wire/models";
import { Cart, HoloCore, PriceTag, Thermometer } from "../components/wire/props";
import { Room } from "../components/wire/Room";
import { WIRE } from "../components/wire/theme";
import { Beam, OrbitArcs, Pedestal } from "../components/wire/Wire";
import { COUNT_MAX_S, countProgress, decimalsOf, formatBR } from "../components/kinetic/motion";
import { resolveBeat, type SceneWord } from "./collageLayers";
import type { KElement, KShot, WireSpec, WireStage } from "./kineticTypes";
import { NumberProbe, type TimedElement } from "./KineticShot";

// Um shot do WireframeExplainer: o palco 3D (objeto principal, sala, câmera) e a camada HTML
// (palavras-chave, HUD, números projetados nos objetos). Funciona com os mesmos shots do
// KineticExplainer: o palco é deduzido dos elementos quando o shot não traz "wire".

export const inferStage = (shot: KShot): WireStage => {
  if (shot.wire?.stage) {
    return shot.wire.stage;
  }
  const has = (t: KElement["type"]) => shot.elements.some((e) => e.type === t);
  if (has("building")) {
    return "building";
  }
  if (has("bars")) {
    return "bars";
  }
  if (has("line")) {
    return "line";
  }
  if (has("number") || shot.elements.some((e) => e.type === "meter" && e.kind === "thermometer")) {
    return "number";
  }
  const cart = shot.elements.some(
    (e) => (e.type === "icon" && e.icon === "shopping-cart") || (e.type === "photo" && /cart|carrinho/i.test(`${e.id ?? ""} ${e.image?.query ?? ""}`)),
  );
  return cart ? "cart" : "core";
};

const STAGE_CAM: Record<WireStage, CamSpec> = {
  head: { target: [0, 0.4, 0], orbit: [-32, 18], radius: [7.6, 6.6], height: [0.3, 0.7], fov: 38 },
  bars: { target: [0, -0.3, 0], orbit: [-26, 22], radius: [19, 17.5], height: [2.4, 3.2] },
  line: { target: [0, -0.1, 0], orbit: [-14, 14], radius: [14, 12.8], height: [1.4, 1.9] },
  number: { target: [1.2, 0.3, 0], orbit: [-18, 16], radius: [12.5, 11.5], height: [1.0, 1.4] },
  cart: { target: [0, 0.4, 0], orbit: [38, -16], radius: [14, 12.5], height: [2.2, 2.8] },
  core: { target: [0, 0, 0], orbit: [-25, 25], radius: [8.5, 7.5], height: [0.8, 1.4] },
  building: { target: [0, 0.6, 0], orbit: [-20, 15], radius: [12, 11], height: [1.5, 2.2] },
  food: { target: [0, 0, 0], orbit: [-30, 30], radius: [8, 7], height: [0.8, 1.2] },
  cables: { target: [0, 0.4, 0], orbit: [-15, 15], radius: [9, 8], height: [1, 1.6] },
  end: { target: [0, 0, 0], orbit: [-20, 20], radius: [8.5, 7.5], height: [0.6, 1] },
};

export const shotCamera = (shot: KShot, stage: WireStage): CamSpec => ({ ...STAGE_CAM[stage], ...(shot.wire?.camera ?? {}) });

const isKeyword = (el: KElement) =>
  el.type === "keyword" ||
  el.type === "ransom" ||
  el.type === "clipping" ||
  (el.type === "text" && (el.size ?? 110) >= 56 && !el.outline && el.effect !== "type" && el.font !== "mono");

const isHud = (el: KElement) => el.type === "label" || (el.type === "text" && (el.effect === "type" || el.font === "mono" || (el.size ?? 110) < 56) && !el.outline);

const textOf = (el: KElement) => ("text" in el ? (el.text as string) : "").replace(/\n/g, " ").toUpperCase();

// ---------------------------------------------------------------- 3D

type Props3D = { readonly shot: KShot; readonly stage: WireStage; readonly timed: TimedElement[]; readonly words: SceneWord[]; readonly seed: string };

export const WireShot3D: React.FC<Props3D> = ({ shot, stage, timed, words, seed }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const spec: WireSpec = shot.wire ?? {};
  const alertAt = spec.alertAt ? resolveBeat(spec.alertAt, words, shot.id, 0) : spec.alert ? 0 : undefined;
  const bars = timed.find((t) => t.el.type === "bars");
  const line = timed.find((t) => t.el.type === "line");
  const meter = timed.find((t) => t.el.type === "meter");
  return (
    <>
      <Room seed={seed} walls={spec.walls ?? (stage === "head" || stage === "bars" || stage === "cart")} />
      {stage === "head" ? (
        <group position={[0, 0.25, 0]}>
          <Head lightAt={alertAt} />
          <OrbitArcs radius={2.7} y={0.9} count={3} speed={0.9} color={alertAt !== undefined && frame >= alertAt * fps ? WIRE.alert : WIRE.cyan} />
          <Pedestal radius={1.8} />
          <Beam radius={1.5} />
        </group>
      ) : null}
      {stage === "bars" && bars && bars.el.type === "bars" ? <Bars3D data={bars.el.data} at={bars.at} max={bars.el.max} /> : null}
      {stage === "line" && line && line.el.type === "line" ? (
        <>
          <Line3D points={line.el.points} at={line.at} />
          <OrbitArcs radius={3.8} y={0.3} count={2} speed={0.5} />
        </>
      ) : null}
      {stage === "number" ? (
        <>
          <group position={[3.3, -0.6, 0]} scale={0.72}>
            {meter && meter.el.type === "meter" ? <Thermometer value={meter.el.value} at={meter.at} /> : <HoloCore alert />}
          </group>
          <group position={[-0.6, 0.4, -1.5]}>
            <OrbitArcs radius={2.8} count={3} speed={0.8} color={WIRE.alert} />
          </group>
          <Pedestal radius={2.6} alert />
        </>
      ) : null}
      {stage === "cart" ? (
        <>
          <Cart alert={spec.alert} coreAt={alertAt} roll={0.6} />
          {spec.priceTag ? <PriceTag x={1.5} y={2.7} at={alertAt ?? 0.3} /> : null}
          <OrbitArcs radius={3.2} y={0.2} count={2} speed={0.7} color={alertAt !== undefined ? WIRE.alert : WIRE.cyan} />
          <Pedestal radius={2.4} alert={alertAt !== undefined} />
        </>
      ) : null}
      {stage === "core" || stage === "building" || stage === "food" || stage === "cables" || stage === "end" ? (
        <>
          <HoloCore alert={spec.alert} />
          <OrbitArcs radius={2.6} count={3} speed={0.9} color={spec.alert ? WIRE.alert : WIRE.cyan} />
          <Pedestal radius={2} alert={spec.alert} />
          <Beam />
        </>
      ) : null}
    </>
  );
};

// ---------------------------------------------------------------- HTML

const Keyword: React.FC<{ readonly text: string; readonly start: number; readonly end: number; readonly y: number; readonly size?: number; readonly alert?: boolean }> = ({
  text,
  start,
  end,
  y,
  size,
  alert,
}) => {
  const { f } = useCollageTheme();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (frame < start || frame >= end) {
    return null;
  }
  const s = spring({ frame: frame - start, fps, config: { damping: 11, stiffness: 220, mass: 0.6 } });
  const k = frame - start;
  // Glitch de entrada: cópias ciano/magenta deslocadas por 3 quadros.
  const jit = k < 3 ? (k % 2 ? 1 : -1) * 10 : 0;
  const fontSize = Math.min(size ?? 150, 930 / Math.max(3, text.length * 0.62));
  const stroke = Math.max(6, fontSize * 0.07);
  const style: React.CSSProperties = {
    fontFamily: f.sans,
    fontWeight: 900,
    fontSize,
    lineHeight: 1,
    letterSpacing: "-0.02em",
    textTransform: "uppercase",
    whiteSpace: "nowrap",
    WebkitTextStroke: `${stroke}px #000`,
    paintOrder: "stroke fill",
  };
  return (
    <div
      data-bigtext="box"
      style={{ position: "absolute", left: 540, top: y, translate: "-50% -50%", scale: 1.25 - 0.25 * Math.min(1, s), opacity: Math.min(1, s * 3) }}
    >
      {k < 3 ? (
        <>
          <div style={{ ...style, position: "absolute", left: jit, top: 0, color: WIRE.cyan, WebkitTextStroke: undefined, opacity: 0.8 }}>{text}</div>
          <div style={{ ...style, position: "absolute", left: -jit, top: 0, color: WIRE.alert, WebkitTextStroke: undefined, opacity: 0.8 }}>{text}</div>
        </>
      ) : null}
      <div
        style={{
          ...style,
          position: "relative",
          color: "#fff",
          textShadow: `0 10px 0 rgba(0,0,0,0.55), 0 0 40px ${withAlpha(alert ? WIRE.alert : WIRE.cyan, 0.55)}`,
        }}
      >
        {text}
      </div>
    </div>
  );
};

const Hud: React.FC<{ readonly text: string; readonly x: number; readonly y: number; readonly start: number; readonly size?: number; readonly typed?: boolean; readonly alert?: boolean }> = ({
  text,
  x,
  y,
  start,
  size = 30,
  typed = false,
  alert = false,
}) => {
  const { f } = useCollageTheme();
  const frame = useCurrentFrame();
  if (frame < start) {
    return null;
  }
  const shown = typed ? text.slice(0, Math.max(0, Math.floor((frame - start) / 1.5))) : text;
  const blink = Math.floor(frame / 8) % 2 === 0;
  const c = alert ? WIRE.alert : WIRE.cyan;
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        translate: "-50% -50%",
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "8px 16px",
        border: `2px solid ${withAlpha(c, 0.7)}`,
        borderRadius: 6,
        backgroundColor: withAlpha("#02060D", 0.6),
        fontFamily: f.mono,
        fontWeight: 700,
        fontSize: size,
        letterSpacing: 2,
        color: c,
        whiteSpace: "nowrap",
        textShadow: `0 0 14px ${withAlpha(c, 0.8)}`,
        boxShadow: `0 0 18px ${withAlpha(c, 0.25)}`,
      }}
    >
      <span style={{ width: size * 0.36, height: size * 0.36, backgroundColor: c, opacity: blink ? 1 : 0.3, boxShadow: `0 0 10px ${c}` }} />
      {shown.toUpperCase()}
    </div>
  );
};

// Número herói em mono ciano (estilo HUD): conta de 0 até o valor em no máximo 0,4s.
const HeroNumber: React.FC<{ readonly el: Extract<KElement, { type: "number" }>; readonly at: number; readonly x: number; readonly y: number }> = ({ el, at, x, y }) => {
  const { f } = useCollageTheme();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const start = at * fps;
  if (frame < start) {
    return null;
  }
  const count = Math.min(el.duration ?? COUNT_MAX_S, COUNT_MAX_S);
  const p = countProgress(frame, fps, start, count);
  const d = el.decimals ?? decimalsOf(el.value);
  const size = Math.min(el.size ?? 230, 230);
  const flash = interpolate(frame, [start + count * fps, start + count * fps + 3, start + count * fps + 16], [0, 1, 0.3], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div data-bigtext="box" style={{ position: "absolute", left: x, top: y, translate: "-50% -50%", display: "flex", flexDirection: "column", alignItems: "center" }}>
      {el.label ? <div style={{ fontFamily: f.mono, fontSize: 30, letterSpacing: 4, color: WIRE.cyan, marginBottom: 6 }}>{el.label}</div> : null}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          fontFamily: f.mono,
          fontWeight: 700,
          fontSize: size,
          lineHeight: 0.95,
          letterSpacing: "-0.1em",
          color: "#EFFFFF",
          WebkitTextStroke: "6px #000",
          paintOrder: "stroke fill",
          textShadow: `0 0 ${20 + 50 * flash}px ${withAlpha(WIRE.cyan, 0.6 + 0.4 * flash)}, 0 8px 0 rgba(0,0,0,0.5)`,
        }}
      >
        <span data-num={0} data-counting={p < 1 ? 1 : undefined}>
          {el.prefix ?? ""}
          {formatBR(p >= 1 ? el.value : el.value * p, d)}
        </span>
        <span style={{ fontSize: size * 0.42, marginTop: size * 0.06, marginLeft: 6 }}>{el.suffix ?? ""}</span>
      </div>
    </div>
  );
};

type PropsHtml = { readonly shot: KShot; readonly stage: WireStage; readonly timed: TimedElement[]; readonly numberCheck?: boolean; readonly startFrame: number };

export const WireShotHtml: React.FC<PropsHtml> = ({ shot, stage, timed, numberCheck, startFrame }) => {
  const { f } = useCollageTheme();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const rootRef = useRef<HTMLDivElement>(null);
  const frames = Math.round(shot.duration * fps);
  const cam = threeCamera(cameraAt(shotCamera(shot, stage), frame, frames, fps));
  const keywords = timed.filter((t) => isKeyword(t.el)).sort((a, b) => a.at - b.at);
  // Palco sem objeto central (só núcleo): a palavra-chave pode ficar no meio da tela.
  const keywordY = stage === "core" ? 820 : 360;

  return (
    <AbsoluteFill ref={rootRef}>
      {timed.map((t, i) => {
        const { el, at } = t;
        const start = Math.round(at * fps);
        if (isKeyword(el)) {
          const k = keywords.indexOf(t);
          const next = keywords[k + 1];
          const end = next ? Math.round(next.at * fps) : frames + 30;
          return (
            <div key={i} data-el={i}>
              <Keyword
                text={textOf(el)}
                start={start}
                end={end}
                y={el.type === "keyword" && el.y !== undefined ? el.y : keywordY}
                size={"size" in el ? (el.size as number | undefined) : undefined}
                alert={(el.type === "keyword" && el.alert) || el.type === "clipping" || el.type === "ransom" || Boolean(el.impact)}
              />
            </div>
          );
        }
        if (isHud(el)) {
          const typed = el.type === "text" && el.effect === "type";
          return (
            <div key={i} data-el={i}>
              <Hud
                text={(el as { text: string }).text}
                x={540}
                // Fontes de dado embaixo (acima da legenda); textos digitados no topo.
                y={el.type === "label" ? 1262 : keywordY === 360 ? 250 : 600}
                start={start}
                typed={typed}
                size={el.type === "label" ? 26 : 34}
              />
            </div>
          );
        }
        if (el.type === "number") {
          return (
            <div key={i} data-el={i}>
              <HeroNumber el={el} at={at} x={stage === "number" ? 380 : 540} y={stage === "number" ? 700 : 760} />
            </div>
          );
        }
        if (el.type === "bars" && stage === "bars") {
          const layout = barsLayout(el.data, 6.6, 5, el.max);
          return (
            <div key={i} data-el={i}>
              {layout.map((b, j) => {
                const { pop } = barGrow(frame, fps, at, j);
                const top = project(cam, [b.top[0], b.top[1] + 0.32, 0]);
                const base = project(cam, [b.base[0], b.base[1] - 0.35, 0.4]);
                const d = el.data[j];
                const c = d.highlight ? WIRE.alert : WIRE.cyan;
                return (
                  <React.Fragment key={j}>
                    {pop > 0 ? (
                      <div
                        data-num={j}
                        style={{
                          position: "absolute",
                          left: top.x,
                          top: top.y,
                          translate: "-50% -50%",
                          scale: Math.max(0, pop),
                          opacity: Math.min(1, pop * 3),
                          fontFamily: f.mono,
                          fontWeight: 700,
                          fontSize: d.highlight ? 34 : 26,
                          color: "#fff",
                          padding: "1px 6px",
                          borderRadius: 4,
                          backgroundColor: withAlpha("#02060D", 0.7),
                          border: `2px solid ${c}`,
                          letterSpacing: "-0.04em",
                          textShadow: `0 0 12px ${c}`,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {d.display ?? `${formatBR(d.value, decimalsOf(d.value))}${el.unit ?? "%"}`}
                      </div>
                    ) : null}
                    <div style={{ position: "absolute", left: base.x, top: base.y, translate: "-50% 0", fontFamily: f.mono, fontSize: 26, color: withAlpha(WIRE.cyan, 0.9), opacity: Math.min(1, barGrow(frame, fps, at, j).g * 2) }}>{d.label}</div>
                  </React.Fragment>
                );
              })}
            </div>
          );
        }
        if (el.type === "line" && stage === "line") {
          const pts = lineLayout(el.points);
          const p = lineProgress(frame, fps, at);
          const seg = p * (pts.length - 1);
          return (
            <div key={i} data-el={i}>
              {pts.map((q, j) => {
                if (seg < j - 0.02) {
                  return null;
                }
                const a = project(cam, [q[0], q[1] + 0.45, q[2]]);
                const b = project(cam, [q[0], -2.55, 0.3]);
                return (
                  <React.Fragment key={j}>
                    <div
                      data-num={j}
                      style={{ position: "absolute", left: a.x, top: a.y, translate: "-50% -50%", fontFamily: f.mono, fontWeight: 700, fontSize: j === 0 ? 38 : 32, color: "#fff", padding: "2px 10px", borderRadius: 4, backgroundColor: withAlpha("#02060D", 0.7), border: `2px solid ${j === 0 ? WIRE.alert : WIRE.cyan}`, whiteSpace: "nowrap" }}
                    >
                      {formatBR(el.points[j], decimalsOf(el.points[j]))}
                      {el.unit ?? "%"}
                    </div>
                    {el.labels?.[j] ? <div style={{ position: "absolute", left: b.x, top: b.y, translate: "-50% 0", fontFamily: f.mono, fontSize: 26, color: WIRE.cyan }}>{el.labels[j]}</div> : null}
                  </React.Fragment>
                );
              })}
            </div>
          );
        }
        if (el.type === "icon" && el.label) {
          return (
            <div key={i} data-el={i}>
              <Hud text={el.label} x={540} y={1180} start={start} size={30} />
            </div>
          );
        }
        return null;
      })}
      {numberCheck ? <NumberProbe shotId={shot.id} startFrame={startFrame} root={rootRef} /> : null}
    </AbsoluteFill>
  );
};

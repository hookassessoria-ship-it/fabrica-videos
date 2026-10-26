import React, { useRef } from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { useCollageTheme } from "../brand/collageTheme";
import { withAlpha } from "../brand/color";
import { TYPE_FRAMES_PER_WORD } from "../components/kinetic/KineticText";
import { COUNT_MAX_S, countProgress, decimalsOf, formatBR } from "../components/kinetic/motion";
import { BUILDING, Building3D, buildingBox, type BuildingSpec, levelY, stairPose } from "../components/wire/building";
import { Cables3D, cablesBox, type CableTag, tagLayout } from "../components/wire/cables";
import {
  benchLayout,
  Clock3D,
  Receipt3D,
  Cycle3D,
  CYCLE_R,
  cycleLabelAnchor,
  DOMINO,
  dominoLabelAnchor,
  Dominoes3D,
  dominoXs,
  Freezer3D,
  Glass3D,
  Ice3D,
  ICE_SIZE,
  iceCenter,
  iceRemain,
  Pizza3D,
  Sun3D,
  Zeros3D,
} from "../components/wire/ice";
import { cameraAt, type CamSpec, fitCamera, project, projectBox, type Rect, threeCamera } from "../components/wire/camera";
import { barGrow, Bars3D, barsLayout, FLOOR_Y, Line3D, lineLayout, lineProgress } from "../components/wire/charts";
import { Head } from "../components/wire/models";
import { Cart, HoloCore, MilkCarton, PriceTag, RiceBag, Thermometer } from "../components/wire/props";
import { Room } from "../components/wire/Room";
import { WIRE } from "../components/wire/theme";
import { Beam, OrbitArcs, Pedestal } from "../components/wire/Wire";
import { floorAt } from "../components/kinetic/Building";
import { resolveBeat, type SceneWord } from "./collageLayers";
import type { KBeat, KElement, KMove, KShot, WireSpec, WireStage } from "./kineticTypes";
import { NumberProbe, type TimedElement } from "./KineticShot";

// Um shot do WireframeExplainer: o palco 3D (objeto principal, sala, câmera) e a camada HTML
// (palavras-chave, HUD, números projetados nos objetos). Funciona com os mesmos shots do
// KineticExplainer: o palco é deduzido dos elementos quando o shot não traz "wire".
//
// Zonas da tela (1080x1920):
//   palavra-chave  y 285–455 (centro 370)        HUD digitado  y ~520
//   objeto 3D      dentro de stageRect (abaixo do texto, acima da fonte/legenda)
//   fonte/rótulo   y ~1262                       legenda       y ~1310–1450
// A câmera é enquadrada automaticamente (fitCamera) pra caixa do objeto — arcos de luz e
// rótulos projetados incluídos — nunca sair do stageRect durante a órbita.

export const KEYWORD_Y = 370;
const TYPED_Y = 520;
const SOURCE_Y = 1262;

export const inferStage = (shot: KShot): WireStage => {
  if (shot.wire?.stage) {
    return shot.wire.stage;
  }
  const has = (t: KElement["type"]) => shot.elements.some((e) => e.type === t);
  if (has("building")) {
    return "building";
  }
  if (has("ice") || has("glass")) {
    return "ice";
  }
  if (has("dominoes")) {
    return "dominoes";
  }
  if (has("cycle")) {
    return "cycle";
  }
  if (has("timeline")) {
    return "zeros";
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

// Órbita/altura iniciais de cada palco (a distância é ajustada pelo enquadramento).
const STAGE_CAM: Record<WireStage, CamSpec> = {
  head: { orbit: [-32, 18], radius: [7.6, 6.8], height: [0.3, 0.7], fov: 38 },
  bars: { orbit: [-26, 22], radius: [17, 15.5], height: [2.4, 3.2] },
  line: { orbit: [-14, 14], radius: [14, 12.8], height: [1.4, 1.9] },
  number: { orbit: [-30, 30], radius: [12, 11], height: [1.0, 1.4] },
  cart: { orbit: [38, -16], radius: [14, 12.5], height: [2.2, 2.8] },
  core: { orbit: [-25, 25], radius: [8.5, 7.5], height: [0.8, 1.4] },
  building: { orbit: [-22, 18], radius: [14, 12.5], height: [1.2, 2.0] },
  food: { orbit: [-30, 30], radius: [8, 7], height: [0.8, 1.2] },
  cables: { orbit: [-18, 18], radius: [11, 10], height: [0.6, 1.2] },
  end: { orbit: [-20, 20], radius: [8.5, 7.5], height: [0.6, 1] },
  ice: { orbit: [-22, 18], radius: [9, 8], height: [1.6, 2.2] },
  dominoes: { orbit: [-28, 10], radius: [10, 9], height: [1.4, 2.0] },
  cycle: { orbit: [-16, 16], radius: [9, 8.2], height: [0.2, 0.6] },
  zeros: { orbit: [-24, 12], radius: [9, 8], height: [0.4, 1.0] },
  pizza: { orbit: [-30, 30], radius: [8, 7], height: [1.2, 1.8] },
  clock: { orbit: [-20, 20], radius: [8, 7.2], height: [0.2, 0.5] },
};

const isKeyword = (el: KElement) =>
  el.type === "keyword" ||
  el.type === "ransom" ||
  el.type === "clipping" ||
  (el.type === "text" && (el.size ?? 110) >= 56 && !el.outline && el.effect !== "type" && el.font !== "mono");

const isTyped = (el: KElement) => el.type === "text" && (el.effect === "type" || el.font === "mono" || (el.size ?? 110) < 56) && !el.outline;

const textOf = (el: KElement) => ("text" in el ? (el.text as string) : "").replace(/\n/g, " ").toUpperCase();

// ---------------------------------------------------------------- layout do palco

export type StageCtx = {
  shot: KShot;
  stage: WireStage;
  timed: TimedElement[];
  words: SceneWord[];
};

const resolveMoves = (ctx: StageCtx, m: KMove[] | undefined, fallback: number) => m?.map((mv) => ({ ...mv, at: resolveBeat(mv, ctx.words, ctx.shot.id, fallback) }));

// Prédio: o elemento "building" do shot (com os tempos resolvidos pelas palavras).
export const buildingSpecOf = (ctx: StageCtx): BuildingSpec => {
  const t = ctx.timed.find((x) => x.el.type === "building");
  const el = t?.el.type === "building" ? t.el : undefined;
  const at = t?.at ?? 0;
  const beat = (b: KBeat, fb: number) => resolveBeat(b, ctx.words, ctx.shot.id, fb);
  return {
    floors: el?.floors ?? 10,
    elevator: el?.elevator ? { ...el.elevator, moves: resolveMoves(ctx, el.elevator.moves, at + 0.4) } : { floor: 1 },
    stairs: el?.stairs ? { ...el.stairs, moves: resolveMoves(ctx, el.stairs.moves, at + 0.4) } : undefined,
    markers: el?.markers?.map((m) => ({ ...m, at: beat(m, at + 0.5) })),
    gap: el?.gap ? { ...el.gap, at: beat(el.gap, at + 0.6) } : undefined,
    speed: el?.speed,
  };
};

// Bancada do palco "ice": cubos e copos na ordem do JSON, com os tempos resolvidos.
export const benchOf = (ctx: StageCtx) => {
  const items = ctx.timed.filter((t) => t.el.type === "ice" || t.el.type === "glass");
  const { xs, freezerX } = benchLayout(items, Boolean(ctx.shot.wire?.freezer));
  const beat = (b: KBeat, fb: number) => resolveBeat(b, ctx.words, ctx.shot.id, fb);
  return {
    freezerX,
    items: items.map((t, i) => {
      const el = t.el;
      const mv = (m: KMove[] | undefined) => (m ?? []).map((x) => ({ ...x, at: beat(x, t.at + 0.4) }));
      if (el.type === "ice") {
        return { kind: "ice" as const, t, x: xs[i], remain: el.remain ?? 1, melt: mv(el.melt), freezeAt: el.freezeAt ? beat(el.freezeAt, t.at + 1) : undefined };
      }
      const g = el as Extract<KElement, { type: "glass" }>;
      return { kind: "glass" as const, t, x: xs[i], level: g.level ?? 0.2, moves: mv(g.moves) };
    }),
  };
};

const dominoesOf = (ctx: StageCtx) => {
  const t = ctx.timed.find((x) => x.el.type === "dominoes");
  const el = t?.el.type === "dominoes" ? t.el : undefined;
  if (!t || !el) {
    return undefined;
  }
  return { t, el, fallAt: el.fallAt ? resolveBeat(el.fallAt, ctx.words, ctx.shot.id, t.at + 0.6) : t.at + 0.6, every: el.every ?? 0.22, fall: el.fall ?? el.items.length };
};

const timelineOf = (ctx: StageCtx) => {
  const t = ctx.timed.find((x) => x.el.type === "timeline");
  const el = t?.el.type === "timeline" ? t.el : undefined;
  if (!t || !el) {
    return undefined;
  }
  return { t, el, cutAt: el.cutAt ? resolveBeat(el.cutAt, ctx.words, ctx.shot.id, t.at + 1) : t.at + 1 };
};

export const tagsOf = (ctx: StageCtx): CableTag[] => (ctx.shot.wire?.tags ?? []).map((t) => ({ ...t, at: resolveBeat(t, ctx.words, ctx.shot.id, 0.3) }));

const B = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) => new THREE.Box3(new THREE.Vector3(x0, y0, z0), new THREE.Vector3(x1, y1, z1));

// Caixa (mundo) de tudo que precisa ficar dentro do quadro: objeto, arcos, rótulos.
export const stageBox = (ctx: StageCtx): THREE.Box3 => {
  const { stage, timed } = ctx;
  switch (stage) {
    case "head":
      return B(-2.05, -1.95, -2.05, 2.05, 1.95, 2.05);
    case "bars": {
      const el = timed.find((t) => t.el.type === "bars")?.el;
      const top = el?.type === "bars" ? Math.max(...barsLayout(el.data, 6.6, 5, el.max).map((b) => b.top[1])) : 2.8;
      return B(-3.7, FLOOR_Y - 0.6, -0.6, 3.7, top + 0.95, 0.6);
    }
    case "line": {
      const el = timed.find((t) => t.el.type === "line")?.el;
      const top = el?.type === "line" ? Math.max(...lineLayout(el.points).map((p) => p[1])) : 1.8;
      return B(-3.0, FLOOR_Y - 0.6, -0.3, 3.0, top + 0.9, 0.3);
    }
    case "number":
      return timed.some((t) => t.el.type === "meter") ? B(-0.8, FLOOR_Y - 0.1, -0.8, 0.8, 3.1, 0.8) : B(-1.7, FLOOR_Y - 0.1, -1.7, 1.7, 1.7, 1.7);
    case "cart":
      return B(-2.45, FLOOR_Y - 0.1, -2.45, 2.45, 3.5, 2.45);
    case "core":
      return B(-2.65, FLOOR_Y - 0.1, -2.65, 2.65, 1.65, 2.65);
    case "building": {
      const spec = buildingSpecOf(ctx);
      const b = buildingBox(spec);
      // rótulos dos marcadores/chave saem pra direita do prédio
      if (spec.markers?.length || spec.gap) {
        b.max.x = 5.0;
      }
      return b;
    }
    case "food":
      return B(-2.35, FLOOR_Y - 0.1, -2.35, 2.35, 1.3, 2.35);
    case "cables":
      return cablesBox(tagsOf(ctx)).union(B(-3.3, 0, 0, 3.3, 0, 0));
    case "end":
      return B(-1.7, FLOOR_Y - 0.1, -1.7, 1.7, 0.6, 1.7);
    case "ice": {
      const { items, freezerX } = benchOf(ctx);
      const xs = items.map((it) => it.x);
      const x0 = Math.min(...xs, 0) - 1.45;
      const x1 = Math.max(...xs, freezerX ?? -Infinity, 0) + (freezerX !== undefined ? 1.1 : 1.45);
      // rótulos (valor no cubo, legenda embaixo) entram na caixa; o sol fica no alto à direita
      const sun = ctx.shot.wire?.sun ? sunPosition(items) : undefined;
      return B(x0, FLOOR_Y - 0.75, -1.45, sun ? Math.max(x1, sun[0] + 1.35) : x1, sun ? sun[1] + 1.35 : FLOOR_Y + ICE_SIZE * 1.2, 1.45);
    }
    case "dominoes": {
      const d = dominoesOf(ctx);
      const xs = dominoXs(d?.el.items.length ?? 5);
      return B(xs[0] - 0.8, FLOOR_Y - 0.75, -0.7, xs[xs.length - 1] + (d && d.fall >= d.el.items.length ? DOMINO.h + 0.3 : 0.8), FLOOR_Y + DOMINO.h + 0.2, 0.7);
    }
    case "cycle":
      return B(-CYCLE_R - 1.4, -CYCLE_R - 1.1, -0.5, CYCLE_R + 1.4, CYCLE_R + 0.7, 0.5);
    case "zeros":
      return B(-2.2, FLOOR_Y - 0.1, -0.7, 2.2, 1.6, 0.7);
    case "pizza":
      return B(-2.0, -1.4, -2.0, 2.0, 1.0, 2.0);
    case "clock":
      return B(-2.0, -2.0, -0.4, 2.0, 2.0, 0.4);
    default:
      return B(-2, -2, -2, 2, 2, 2);
  }
};

// Área da tela onde o objeto 3D pode ficar.
export const stageRect = (ctx: StageCtx): Rect => {
  const typed = ctx.timed.some((t) => isTyped(t.el));
  const top = typed ? 575 : 495;
  // À direita, até x 960: abaixo de y 1100 fica a coluna de botões do TikTok.
  switch (ctx.stage) {
    case "number":
      return { x0: 640, x1: 960, y0: top, y1: 1215 };
    case "food":
      return { x0: 70, x1: 960, y0: 770, y1: 1215 };
    case "end":
      // com o @ do perfil embaixo do título, o objeto desce um pouco
      return { x0: 120, x1: 960, y0: ctx.shot.wire?.endHandle ? 880 : 800, y1: 1120 };
    case "zeros":
      return { x0: 600, x1: 960, y0: top + 60, y1: 1180 };
    default: {
      const labels = ctx.timed.filter((t) => t.el.type === "label").length;
      // sem fonte embaixo, o objeto pode descer até perto da legenda
      const bottom = labels === 0 && ctx.stage === "building" ? 1255 : 1215 - Math.max(0, labels - 1) * 56;
      return { x0: 60, x1: 960, y0: top, y1: bottom };
    }
  }
};

export const shotCamera = (ctx: StageCtx, frames: number, fps: number): CamSpec =>
  fitCamera({ ...STAGE_CAM[ctx.stage], ...(ctx.shot.wire?.camera ?? {}) }, stageBox(ctx), stageRect(ctx), frames, fps);

// ---------------------------------------------------------------- 3D

type Props3D = { readonly ctx: StageCtx; readonly seed: string; readonly cam: CamSpec };

export const WireShot3D: React.FC<Props3D> = ({ ctx, seed, cam }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { shot, stage, timed, words } = ctx;
  const camState = cameraAt(cam, frame, Math.round(shot.duration * fps), fps);
  const camDist = camState.position.distanceTo(camState.target);
  const spec: WireSpec = shot.wire ?? {};
  const alertAt = spec.alertAt ? resolveBeat(spec.alertAt, words, shot.id, 0) : spec.alert ? 0 : undefined;
  const lit = alertAt !== undefined && frame >= alertAt * fps;
  const bars = timed.find((t) => t.el.type === "bars");
  const line = timed.find((t) => t.el.type === "line");
  const meter = timed.find((t) => t.el.type === "meter");
  const t = frame / fps;
  return (
    <>
      <Room seed={seed} camDist={camDist} walls={spec.walls ?? (stage === "head" || stage === "bars" || stage === "cart" || stage === "building")} />
      {stage === "head" ? (
        <group position={[0, 0.25, 0]}>
          <Head lightAt={alertAt} />
          <OrbitArcs radius={1.95} y={0.9} count={3} speed={0.9} color={lit ? WIRE.alert : WIRE.cyan} />
          <Pedestal radius={1.8} />
          <Beam radius={1.5} />
        </group>
      ) : null}
      {stage === "bars" && bars && bars.el.type === "bars" ? <Bars3D data={bars.el.data} at={bars.at} max={bars.el.max} /> : null}
      {stage === "line" && line && line.el.type === "line" ? <Line3D points={line.el.points} at={line.at} /> : null}
      {stage === "number" ? (
        <>
          {spec.object === "clock" ? (
            <group scale={0.85}>
              <Clock3D speed={0.9} />
            </group>
          ) : spec.object === "receipt" ? (
            <group scale={0.8}>
              <Receipt3D alert={spec.alert} />
            </group>
          ) : meter && meter.el.type === "meter" ? (
            <Thermometer value={meter.el.value} at={meter.at} />
          ) : (
            <HoloCore alert />
          )}
          <Pedestal radius={0.8} alert />
        </>
      ) : null}
      {stage === "cart" ? (
        <>
          <Cart alert={spec.alert} coreAt={alertAt} roll={0.6} />
          {spec.priceTag ? <PriceTag x={1.5} y={2.7} at={alertAt ?? 0.3} /> : null}
          <OrbitArcs radius={2.3} y={1.6} count={2} speed={0.7} color={lit || spec.alert ? WIRE.alert : WIRE.cyan} />
          <Pedestal radius={2.3} alert={lit || spec.alert} />
        </>
      ) : null}
      {stage === "core" ? (
        <>
          <HoloCore alert={spec.alert || lit} />
          <OrbitArcs radius={2.55} count={3} speed={0.9} color={spec.alert || lit ? WIRE.alert : WIRE.cyan} />
          <Pedestal radius={2} alert={spec.alert || lit} />
          <Beam />
        </>
      ) : null}
      {stage === "building" ? <Building3D spec={buildingSpecOf(ctx)} alert={spec.alert} /> : null}
      {stage === "food" ? (
        <>
          <group position={[-1.05, -0.3, 0]} rotation={[0.08, t * 0.9, 0]}>
            <RiceBag alert={spec.alert} />
          </group>
          <group position={[1.1, -0.45, 0]} rotation={[-0.05, -t * 0.8 + 1, 0]}>
            <MilkCarton alert={spec.alert} />
          </group>
          <OrbitArcs radius={2.25} y={-0.2} count={2} speed={0.6} color={spec.alert ? WIRE.alert : WIRE.cyan} />
          <Pedestal radius={2.25} alert={spec.alert} />
        </>
      ) : null}
      {stage === "cables" ? <Cables3D tags={tagsOf(ctx)} /> : null}
      {stage === "ice" ? <Bench3D ctx={ctx} /> : null}
      {stage === "dominoes"
        ? (() => {
            const d = dominoesOf(ctx);
            return d ? <Dominoes3D n={d.el.items.length} fallAt={d.fallAt} every={d.every} fall={d.fall} /> : null;
          })()
        : null}
      {stage === "cycle"
        ? (() => {
            const c = timed.find((x) => x.el.type === "cycle");
            return c && c.el.type === "cycle" ? <Cycle3D n={c.el.items.length} at={c.at} every={c.el.every ?? 0.5} speed={c.el.speed ?? 0.35} alert={spec.alert} /> : null;
          })()
        : null}
      {stage === "zeros"
        ? (() => {
            const z = timelineOf(ctx);
            return <Zeros3D at={z?.t.at ?? 0} cutAt={z?.cutAt ?? 1} />;
          })()
        : null}
      {stage === "pizza" ? (
        <>
          <Pizza3D alert={spec.alert} />
          <OrbitArcs radius={2.1} y={-0.2} count={2} speed={0.7} color={spec.alert ? WIRE.alert : WIRE.cyan} />
        </>
      ) : null}
      {stage === "clock" ? <Clock3D speed={1.6} /> : null}
      {stage === "end" ? (
        <>
          <group position={[0, -0.8, 0]} scale={0.6}>
            <HoloCore />
          </group>
          <OrbitArcs radius={1.6} y={-0.8} count={2} speed={0.6} />
          <Pedestal radius={1.6} />
          <Beam radius={1.3} />
        </>
      ) : null}
    </>
  );
};

// Sol em cima do 1º cubo, um pouco à direita (perto, pra não afastar a câmera).
const sunPosition = (items: { kind: string; x: number }[]): [number, number, number] => {
  const first = items.find((it) => it.kind === "ice") ?? items[0];
  return [(first?.x ?? 0) + 1.5, FLOOR_Y + ICE_SIZE + 1.4, -0.6];
};

const Bench3D: React.FC<{ readonly ctx: StageCtx }> = ({ ctx }) => {
  const { items, freezerX } = benchOf(ctx);
  return (
    <>
      {items.map((it, i) => {
        if (it.kind === "ice" && it.t.el.type === "ice") {
          const el = it.t.el;
          return <Ice3D key={i} seed={it.t.seed} x={it.x} remain={it.remain} melt={it.melt} freezeAt={it.freezeAt} alert={el.alert} spin={el.spin ?? 12} glyph={el.value === undefined} />;
        }
        if (it.kind === "glass" && it.t.el.type === "glass") {
          return <Glass3D key={i} x={it.x} level={it.level} moves={it.moves} liquid={it.t.el.liquid} ice={it.t.el.ice} />;
        }
        return null;
      })}
      {freezerX !== undefined ? <Freezer3D x={freezerX} /> : null}
      {ctx.shot.wire?.sun ? <Sun3D position={sunPosition(items)} radius={0.62} /> : null}
    </>
  );
};

// ---------------------------------------------------------------- HTML

const KEYWORD_MAX = 170;

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
  // Largura média de uma letra em caixa alta do Inter 900 (com contorno) ≈ 0,74 do tamanho.
  const fontSize = Math.min(size ?? 150, KEYWORD_MAX, 930 / Math.max(3, text.length * 0.74));
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

// Digitação por palavra (nunca aparece palavra cortada).
export const typedWords = (text: string, frame: number, start: number) => {
  const words = text.split(/\s+/).filter(Boolean);
  const n = Math.min(words.length, Math.floor((frame - start) / TYPE_FRAMES_PER_WORD) + 1);
  return words.slice(0, Math.max(0, n)).join(" ");
};

const Hud: React.FC<{
  readonly text: string;
  readonly x: number;
  readonly y: number;
  readonly start: number;
  readonly size?: number;
  readonly typed?: boolean;
  readonly alert?: boolean;
  readonly anchor?: "center" | "left";
}> = ({ text, x, y, start, size = 30, typed = false, alert = false, anchor = "center" }) => {
  const { f } = useCollageTheme();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (frame < start) {
    return null;
  }
  const shown = typed ? typedWords(text, frame, start) : text;
  // Rótulo preso num objeto 3D não sai do quadro (nem entra na coluna de botões do TikTok):
  // largura estimada da fonte mono + borda + ponto.
  const w = text.length * (size * 0.6 + 2) + size * 0.36 + 48;
  const right = y + size > 1100 ? 950 : 1040;
  const left = anchor === "center" ? Math.min(Math.max(x, 40 + w / 2), right - w / 2) : Math.min(Math.max(x, 40), right - w);
  const blink = Math.floor(frame / 8) % 2 === 0;
  const c = alert ? WIRE.alert : WIRE.cyan;
  const s = Math.min(1, spring({ frame: frame - start, fps, config: { damping: 14, stiffness: 240 } }));
  return (
    <div
      data-safe="hud"
      data-fulltext={typed ? text.toUpperCase() : undefined}
      style={{
        position: "absolute",
        left,
        top: y,
        translate: anchor === "center" ? "-50% -50%" : "0 -50%",
        opacity: Math.min(1, s * 2),
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "8px 16px",
        border: `2px solid ${withAlpha(c, 0.75)}`,
        borderRadius: 6,
        backgroundColor: withAlpha("#02060D", 0.78),
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
      <span data-shown>{shown.toUpperCase()}</span>
    </div>
  );
};

// Número herói em mono ciano (estilo HUD): conta de 0 até o valor em no máximo 0,4s.
const HeroNumber: React.FC<{ readonly el: Extract<KElement, { type: "number" }>; readonly at: number; readonly x: number; readonly y: number; readonly size: number; readonly alert?: boolean }> = ({
  el,
  at,
  x,
  y,
  size,
  alert,
}) => {
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
  // Cabe na área do número (largura 2·(x − 50)): dígitos mono ≈ 0,52 do tamanho (letterSpacing −0,1em).
  const chars = `${el.prefix ?? ""}${formatBR(el.value, d)}`.length + (el.suffix ?? "").length * 0.45;
  const fit = Math.min(size, (2 * Math.min(x - 50, 1030 - x)) / Math.max(1, chars * 0.55));
  const flash = interpolate(frame, [start + count * fps, start + count * fps + 3, start + count * fps + 16], [0, 1, 0.3], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const c = alert ? WIRE.alert : WIRE.cyan;
  return (
    <div data-bigtext="box" style={{ position: "absolute", left: x, top: y, translate: "-50% -50%", display: "flex", flexDirection: "column", alignItems: "center" }}>
      {el.label ? <div style={{ fontFamily: f.mono, fontWeight: 700, fontSize: 34, letterSpacing: 3, color: c, marginBottom: 6, textShadow: `0 0 12px ${withAlpha(c, 0.8)}` }}>{el.label}</div> : null}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          fontFamily: f.mono,
          fontWeight: 700,
          fontSize: fit,
          lineHeight: 0.95,
          letterSpacing: "-0.1em",
          color: "#EFFFFF",
          WebkitTextStroke: "6px #000",
          paintOrder: "stroke fill",
          textShadow: `0 0 ${20 + 50 * flash}px ${withAlpha(c, 0.6 + 0.4 * flash)}, 0 8px 0 rgba(0,0,0,0.5)`,
        }}
      >
        <span data-num={0} data-main={1} data-counting={p < 1 ? 1 : undefined}>
          {el.prefix ?? ""}
          {formatBR(p >= 1 ? el.value : el.value * p, d)}
        </span>
        <span style={{ fontSize: fit * 0.42, marginTop: fit * 0.06, marginLeft: 6 }}>{el.suffix ?? ""}</span>
      </div>
    </div>
  );
};

// Rótulo de número colado num objeto 3D (fundo HUD escuro, legível no celular).
const NumTag: React.FC<{
  readonly i: number;
  readonly x: number;
  readonly y: number;
  readonly text: string;
  readonly size: number;
  readonly main: boolean;
  readonly alert?: boolean;
  readonly pop?: number;
}> = ({ i, x, y, text, size, main, alert = false, pop = 1 }) => {
  const { f } = useCollageTheme();
  const c = alert ? WIRE.alert : WIRE.cyan;
  return (
    <div
      data-num={i}
      data-main={main ? 1 : undefined}
      style={{
        position: "absolute",
        left: x,
        top: y,
        translate: "-50% -50%",
        scale: Math.max(0, pop),
        opacity: Math.min(1, pop * 3),
        fontFamily: f.mono,
        fontWeight: 700,
        fontSize: size,
        lineHeight: 1.1,
        letterSpacing: "-0.05em",
        color: "#fff",
        padding: "2px 8px",
        borderRadius: 5,
        backgroundColor: withAlpha("#02060D", 0.86),
        border: `2px solid ${c}`,
        textShadow: `0 0 10px ${withAlpha(c, 0.9)}`,
        boxShadow: `0 0 14px ${withAlpha(c, 0.35)}`,
        whiteSpace: "nowrap",
      }}
    >
      {text}
    </div>
  );
};

// Tamanho do rótulo: o maior que cabe na distância entre colunas; os principais nunca
// abaixo de 34px (se não couber, os outros ficam menores).
const MIN_MAIN = 34;
const axisSize = (xs: number[], texts: (string | undefined)[]) => {
  const slot = xs.length > 1 ? Math.abs(xs[xs.length - 1] - xs[0]) / (xs.length - 1) : 400;
  const chars = Math.max(1, ...texts.map((t) => t?.length ?? 0));
  return Math.round(Math.min(MIN_MAIN, Math.max(26, (slot * 0.9) / (chars * 0.62))));
};

const labelSizes = (xs: number[], texts: string[], main: boolean[]) => {
  const slot = xs.length > 1 ? Math.abs(xs[xs.length - 1] - xs[0]) / (xs.length - 1) : 400;
  const chars = Math.max(...texts.map((t) => t.length));
  const fit = (slot * 0.94 - 18) / (chars * 0.6);
  return main.map((m) => Math.round(Math.min(46, Math.max(m ? MIN_MAIN : 20, fit))));
};

type PropsHtml = {
  readonly ctx: StageCtx;
  readonly cam: CamSpec;
  readonly numberCheck?: boolean;
  readonly startFrame: number;
};

export const WireShotHtml: React.FC<PropsHtml> = ({ ctx, cam: camSpec, numberCheck, startFrame }) => {
  const { f } = useCollageTheme();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const rootRef = useRef<HTMLDivElement>(null);
  const { shot, stage, timed } = ctx;
  const frames = Math.round(shot.duration * fps);
  const cam = threeCamera(cameraAt(camSpec, frame, frames, fps));
  const keywords = timed.filter((t) => isKeyword(t.el)).sort((a, b) => a.at - b.at);
  const objBox = projectBox(cam, stageBox(ctx));
  const labels = timed.filter((t) => t.el.type === "label");
  const spec = shot.wire ?? {};

  const heroPos = stage === "number" ? { x: 330, y: 850, size: 200 } : stage === "food" ? { x: 540, y: 625, size: 190 } : { x: 540, y: 760, size: 200 };

  return (
    <AbsoluteFill ref={rootRef}>
      {/* caixa do objeto 3D projetada: entra na checagem de área segura e de sobreposição */}
      <div
        data-safe="object"
        data-avoid
        style={{ position: "absolute", left: objBox.x0, top: objBox.y0, width: objBox.x1 - objBox.x0, height: objBox.y1 - objBox.y0, pointerEvents: "none" }}
      />
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
                y={KEYWORD_Y}
                size={"size" in el ? (el.size as number | undefined) : undefined}
                alert={(el.type === "keyword" && el.alert) || el.type === "clipping" || el.type === "ransom"}
              />
            </div>
          );
        }
        if (isTyped(el)) {
          return (
            <div key={i} data-el={i}>
              <Hud text={(el as { text: string }).text} x={540} y={TYPED_Y} start={start} typed={el.type === "text" && el.effect === "type"} size={34} />
            </div>
          );
        }
        if (el.type === "label") {
          // Fonte de dado: logo acima da legenda. Se houver mais de um rótulo, empilha pra cima.
          const n = labels.indexOf(t);
          return (
            <div key={i} data-el={i}>
              <Hud text={el.text} x={540} y={SOURCE_Y - n * 56} start={start} size={Math.min(26, Math.floor((852 - 2 * el.text.length) / (0.6 * el.text.length + 0.36)))} />
            </div>
          );
        }
        if (el.type === "icon" && el.label && labels.length === 0) {
          return (
            <div key={i} data-el={i}>
              <Hud text={el.label} x={540} y={stage === "end" ? 1180 : SOURCE_Y} start={start} size={stage === "end" ? 44 : 30} />
            </div>
          );
        }
        if (el.type === "number") {
          return (
            <div key={i} data-el={i}>
              <HeroNumber el={el} at={at} x={heroPos.x} y={heroPos.y} size={Math.min(el.size ?? heroPos.size, heroPos.size)} alert={spec.alert} />
            </div>
          );
        }
        if (el.type === "bars" && stage === "bars") {
          const layout = barsLayout(el.data, 6.6, 5, el.max);
          const texts = el.data.map((d) => d.display ?? `${formatBR(d.value, decimalsOf(d.value))}${el.unit ?? "%"}`);
          const tops = layout.map((b) => project(cam, [b.top[0], b.top[1] + 0.34, 0]));
          const main = el.data.map((d, j) => Boolean(d.highlight) || j === 0 || j === el.data.length - 1);
          const sizes = labelSizes(
            tops.map((p) => p.x),
            texts,
            main,
          );
          const yearSize = axisSize(
            tops.map((p) => p.x),
            el.data.map((d) => d.label),
          );
          return (
            <div key={i} data-el={i}>
              {layout.map((b, j) => {
                const { pop, g } = barGrow(frame, fps, at, j);
                const base = project(cam, [b.base[0], b.base[1] - 0.38, 0.5]);
                return (
                  <React.Fragment key={j}>
                    {pop > 0 ? <NumTag i={j} x={tops[j].x} y={tops[j].y - sizes[j] * 0.3} text={texts[j]} size={sizes[j]} main={main[j]} alert={el.data[j].highlight} pop={pop} /> : null}
                    <div style={{ position: "absolute", left: base.x, top: base.y, translate: "-50% 0", fontFamily: f.mono, fontWeight: 700, fontSize: yearSize, color: withAlpha(WIRE.cyan, 0.95), textShadow: "0 2px 6px #000", opacity: Math.min(1, g * 2) }}>
                      {el.data[j].label}
                    </div>
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
          const texts = el.points.map((v) => `${el.prefix ?? ""}${formatBR(v, decimalsOf(v))}${el.unit ?? "%"}`);
          const proj = pts.map((q) => project(cam, [q[0], q[1] + 0.5, q[2]]));
          const main = el.points.map((_, j) => j === 0 || j === el.points.length - 1);
          const sizes = labelSizes(
            proj.map((q) => q.x),
            texts,
            main,
          );
          const yearSize = axisSize(
            proj.map((q) => q.x),
            el.labels ?? [],
          );
          return (
            <div key={i} data-el={i}>
              {pts.map((q, j) => {
                if (seg < j - 0.02) {
                  return null;
                }
                const b = project(cam, [q[0], FLOOR_Y - 0.38, 0.3]);
                return (
                  <React.Fragment key={j}>
                    <NumTag i={j} x={proj[j].x} y={proj[j].y - sizes[j] * 0.3} text={texts[j]} size={sizes[j]} main={main[j]} alert={j === 0} />
                    {el.labels?.[j] ? (
                      <div style={{ position: "absolute", left: b.x, top: b.y, translate: "-50% 0", fontFamily: f.mono, fontWeight: 700, fontSize: yearSize, color: WIRE.cyan, textShadow: "0 2px 6px #000" }}>
                        {el.labels[j]}
                      </div>
                    ) : null}
                  </React.Fragment>
                );
              })}
            </div>
          );
        }
        return null;
      })}
      {stage === "building" ? <BuildingLabels ctx={ctx} cam={cam} /> : null}
      {stage === "ice" ? <BenchLabels ctx={ctx} cam={cam} /> : null}
      {stage === "dominoes" ? <DominoLabels ctx={ctx} cam={cam} /> : null}
      {stage === "cycle" ? <CycleLabels ctx={ctx} cam={cam} /> : null}
      {stage === "zeros" ? <TimelineHud ctx={ctx} /> : null}
      {stage === "cables" ? <CableLabels ctx={ctx} cam={cam} /> : null}
      {stage === "end" ? <EndCard title={spec.endTitle} handle={spec.endHandle} /> : null}
      {numberCheck ? <NumberProbe shotId={shot.id} startFrame={startFrame} root={rootRef} /> : null}
    </AbsoluteFill>
  );
};

// Rótulos do prédio: marcadores de andar, chave de distância, nomes do elevador e da escada.
const BuildingLabels: React.FC<{ readonly ctx: StageCtx; readonly cam: THREE.PerspectiveCamera }> = ({ ctx, cam }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const spec = buildingSpecOf(ctx);
  const floors = spec.floors ?? 10;
  const ef = floorAt(spec.elevator, frame, fps);
  const out: React.ReactNode[] = [];
  // Marcadores em andares vizinhos: afasta na vertical pra as etiquetas não se encostarem.
  const GAP = 78;
  const marks = (spec.markers ?? [])
    .map((m, i) => ({ m, i, p: project(cam, [BUILDING.width / 2 + 0.55, levelY(m.floor) + BUILDING.fh / 2, 0]) }))
    .sort((a, b) => a.p.y - b.p.y);
  for (let k = 1; k < marks.length; k++) {
    const d = marks[k].p.y - marks[k - 1].p.y;
    if (d < GAP) {
      marks[k - 1].p.y -= (GAP - d) / 2;
      marks[k].p.y += (GAP - d) / 2;
    }
  }
  marks.forEach(({ m, i, p }) => {
    if (frame < m.at * fps) {
      return;
    }
    out.push(<Hud key={`m${i}`} text={m.label} x={p.x} y={p.y} start={Math.round(m.at * fps)} size={34} anchor="left" />);
  });
  if (spec.speed?.label) {
    const p = project(cam, [BUILDING.width / 2 + 0.85, FLOOR_Y + 0.05, 0]);
    out.push(<Hud key="speed" text={spec.speed.label} x={p.x} y={p.y + 26} start={0} size={28} />);
  }
  if (spec.gap && frame >= spec.gap.at * fps) {
    const mid = (levelY(spec.gap.from) + levelY(spec.gap.to)) / 2 + BUILDING.fh / 2;
    const p = project(cam, [BUILDING.width / 2 + 0.75, mid, 0]);
    out.push(<Hud key="gap" text={spec.gap.label.replace(/\n/g, " ")} x={p.x} y={p.y} start={Math.round(spec.gap.at * fps)} size={36} alert anchor="left" />);
  }
  if (spec.elevator?.label) {
    const p = project(cam, [BUILDING.shaftX, levelY(ef) + BUILDING.fh + 0.12, 0]);
    out.push(<Hud key="el" text={spec.elevator.label} x={p.x} y={p.y} start={0} size={30} />);
  }
  if (spec.stairs?.label) {
    const sf = floorAt(spec.stairs, frame, fps);
    const pose = stairPose(sf, floors);
    const p = project(cam, [pose.x, pose.y + 1.05, 0]);
    out.push(<Hud key="st" text={spec.stairs.label} x={p.x} y={p.y} start={0} size={30} />);
  }
  return <>{out}</>;
};

const CableLabels: React.FC<{ readonly ctx: StageCtx; readonly cam: THREE.PerspectiveCamera }> = ({ ctx, cam }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <>
      {tagLayout(tagsOf(ctx)).map((l, i) => {
        if (frame < l.at * fps) {
          return null;
        }
        const p = project(cam, l.plate);
        return <Hud key={i} text={l.text} x={p.x} y={p.y} start={Math.round(l.at * fps)} size={l.big ? 46 : 34} alert={l.alert} />;
      })}
    </>
  );
};

// Bancada: valor dentro do cubo (número conferido) e legenda embaixo de cada item.
const BenchLabels: React.FC<{ readonly ctx: StageCtx; readonly cam: THREE.PerspectiveCamera }> = ({ ctx, cam }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { items } = benchOf(ctx);
  return (
    <>
      {items.map((it) => {
        const idx = ctx.timed.indexOf(it.t);
        const el = it.t.el;
        const caption = el.type === "ice" || el.type === "glass" ? el.caption : undefined;
        const base = project(cam, [it.x, FLOOR_Y - 0.4, 0.9]);
        let value: React.ReactNode = null;
        if (el.type === "ice" && el.value !== undefined && it.kind === "ice") {
          const r = iceRemain(it, frame, fps);
          const c = project(cam, iceCenter(it.x, ICE_SIZE, r));
          const text = `${el.prefix ?? ""}${formatBR(el.value, decimalsOf(el.value))}${el.suffix ?? ""}`;
          value = <NumTag i={0} x={c.x} y={c.y} text={text} size={46} main alert={el.alert} />;
        }
        return (
          <div key={idx} data-el={idx}>
            {value}
            {caption ? <Hud text={caption} x={base.x} y={base.y} start={Math.round(it.t.at * fps)} size={30} /> : null}
          </div>
        );
      })}
    </>
  );
};

const DominoLabels: React.FC<{ readonly ctx: StageCtx; readonly cam: THREE.PerspectiveCamera }> = ({ ctx, cam }) => {
  const d = dominoesOf(ctx);
  const { fps } = useVideoConfig();
  if (!d) {
    return null;
  }
  const xs = dominoXs(d.el.items.length);
  return (
    <>
      {d.el.items.map((it, i) => {
        if (!it.label) {
          return null;
        }
        const p = project(cam, dominoLabelAnchor(xs[i]));
        return <Hud key={i} text={it.label} x={p.x} y={p.y + (i % 2) * 56} start={Math.round(d.t.at * fps)} size={28} />;
      })}
    </>
  );
};

const CycleLabels: React.FC<{ readonly ctx: StageCtx; readonly cam: THREE.PerspectiveCamera }> = ({ ctx, cam }) => {
  const { fps } = useVideoConfig();
  const c = ctx.timed.find((x) => x.el.type === "cycle");
  if (!c || c.el.type !== "cycle") {
    return null;
  }
  const n = c.el.items.length;
  const every = c.el.every ?? 0.5;
  return (
    <>
      {c.el.items.map((it, i) => {
        const p = project(cam, cycleLabelAnchor(i, n));
        return <Hud key={i} text={it.label} x={p.x} y={p.y} start={Math.round((c.at + i * every) * fps)} size={32} alert={ctx.shot.wire?.alert} />;
      })}
    </>
  );
};

// Linha do tempo das moedas como HUD (anos são números conferidos), à esquerda dos zeros 3D.
const TimelineHud: React.FC<{ readonly ctx: StageCtx }> = ({ ctx }) => {
  const { f } = useCollageTheme();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const z = timelineOf(ctx);
  if (!z) {
    return null;
  }
  const idx = ctx.timed.indexOf(z.t);
  const items = z.el.items;
  const every = z.el.every ?? 0.12;
  const top = 600;
  const row = 64;
  return (
    <div data-el={idx} style={{ position: "absolute", left: 70, top, width: 520 }}>
      {items.map((it, i) => {
        const s0 = Math.round((z.t.at + i * every) * fps);
        if (frame < s0) {
          return null;
        }
        const cutIndex = items.slice(0, i).filter((x) => x.cut).length;
        const cut = it.cut && frame >= (z.cutAt + cutIndex * 0.16) * fps;
        const c = cut ? WIRE.alert : WIRE.cyan;
        const s = Math.min(1, spring({ frame: frame - s0, fps, config: { damping: 14, stiffness: 240 } }));
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: 0,
              top: i * row,
              display: "flex",
              alignItems: "center",
              gap: 16,
              opacity: s,
              translate: `${(1 - s) * -30}px 0`,
              fontFamily: f.mono,
              fontWeight: 700,
              whiteSpace: "nowrap",
            }}
          >
            <span style={{ width: 110, textAlign: "right", fontSize: 36, color: "#fff", textShadow: `0 0 10px ${withAlpha(c, 0.9)}` }}>
              {it.year !== undefined ? (
                <span data-num={i} data-main={1}>
                  {String(it.year)}
                </span>
              ) : (
                "—"
              )}
            </span>
            <span style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: c, boxShadow: `0 0 12px ${c}` }} />
            <span style={{ fontSize: 30, color: withAlpha(WIRE.white, 0.92), padding: "2px 10px", borderRadius: 5, backgroundColor: withAlpha("#02060D", 0.8) }}>{it.label}</span>
            {it.cut ? <span style={{ fontSize: 28, color: c, textDecoration: cut ? "line-through" : undefined, opacity: cut ? 0.9 : 0.6 }}>−000</span> : null}
          </div>
        );
      })}
    </div>
  );
};

// Tela final: logo RikuAI em holograma + "LINK NA BIO".
const EndCard: React.FC<{ readonly title?: string; readonly handle?: string }> = ({ title = "RikuAI", handle }) => {
  const { f } = useCollageTheme();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 12, stiffness: 160 } });
  const flicker = 0.88 + 0.12 * Math.abs(Math.sin(frame * 1.7));
  return (
    <>
      <div
        data-bigtext="box"
        style={{
          position: "absolute",
          left: 540,
          top: 690,
          translate: "-50% -50%",
          scale: 0.8 + 0.2 * Math.min(1, s),
          opacity: Math.min(1, s * 2) * flicker,
          fontFamily: f.display,
          fontSize: 210,
          lineHeight: 1,
          color: "#EFFFFF",
          letterSpacing: "0.02em",
          WebkitTextStroke: "3px rgba(46,230,240,0.9)",
          textShadow: `0 0 30px ${WIRE.cyan}, 0 0 80px ${withAlpha(WIRE.cyan, 0.6)}`,
          whiteSpace: "nowrap",
        }}
      >
        {title}
      </div>
      {handle ? (
        <div
          style={{
            position: "absolute",
            left: 540,
            top: 820,
            translate: "-50% -50%",
            opacity: Math.min(1, s * 2),
            fontFamily: f.mono,
            fontWeight: 700,
            fontSize: 56,
            color: WIRE.cyan,
            textShadow: `0 0 18px ${withAlpha(WIRE.cyan, 0.8)}`,
            whiteSpace: "nowrap",
          }}
        >
          {handle}
        </div>
      ) : null}
    </>
  );
};

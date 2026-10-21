import React, { useRef } from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { useCollageTheme } from "../brand/collageTheme";
import { withAlpha } from "../brand/color";
import { TYPE_FRAMES_PER_WORD } from "../components/kinetic/KineticText";
import { COUNT_MAX_S, countProgress, decimalsOf, formatBR } from "../components/kinetic/motion";
import { BUILDING, Building3D, buildingBox, type BuildingSpec, levelY, stairPose } from "../components/wire/building";
import { Cables3D, cablesBox, type CableTag, tagLayout } from "../components/wire/cables";
import { cameraAt, type CamSpec, fitCamera, project, projectBox, type Rect, threeCamera } from "../components/wire/camera";
import { barGrow, Bars3D, barsLayout, FLOOR_Y, Line3D, lineLayout, lineProgress } from "../components/wire/charts";
import { Head } from "../components/wire/models";
import { Cart, HoloCore, MilkCarton, PriceTag, RiceBag, Thermometer } from "../components/wire/props";
import { Room } from "../components/wire/Room";
import { BlackHole, Ocean, OceanPlanet, Ship } from "../components/wire/space";
import { BLOCK, Blocks3D, blockY, Clock3D, CLOCK_R, HOURGLASS_H, Hourglass3D, type Lane3D, Paths3D, PATHS, pathPoint, pathProgress, Phone3D, StillFigure } from "../components/wire/time3d";
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
  // Elementos do 004 viram o palco 3D equivalente.
  if (has("clock") || has("hourglass")) {
    return "clocks";
  }
  if (has("phone")) {
    return "phone";
  }
  if (has("planet")) {
    return "planet";
  }
  if (has("tracks")) {
    return "paths";
  }
  if (has("stack")) {
    return "blocks";
  }
  if (has("treadmill") || has("counter")) {
    return "figure";
  }
  if (has("clip")) {
    return "ocean";
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
  ocean: { orbit: [-20, 8], radius: [9, 8], height: [1.6, 2.2] },
  planet: { orbit: [-20, 20], radius: [9, 8], height: [1.0, 1.6] },
  blackhole: { orbit: [-15, 25], radius: [10, 9], height: [2.4, 3.2] },
  clocks: { orbit: [-14, 14], radius: [10, 9], height: [0.4, 0.8] },
  figure: { orbit: [-30, 18], radius: [8, 7], height: [0.6, 1.0] },
  phone: { orbit: [-24, 18], radius: [8, 7], height: [0.3, 0.6] },
  paths: { orbit: [-40, -14], radius: [10, 9], height: [3.0, 3.6] },
  blocks: { orbit: [-26, 20], radius: [9, 8], height: [1.2, 1.8] },
};

// Relógios e ampulhetas do shot, lado a lado (palco "clocks"), na ordem do JSON.
type ClockItem = { t: TimedElement; x: number; y: number; top: number; bottom: number };
const CLOCK_GAP = 3.1;
export const clockItems = (ctx: StageCtx): ClockItem[] => {
  const list = ctx.timed.filter((t) => t.el.type === "clock" || t.el.type === "hourglass");
  return list.map((t, k) => {
    const x = (k - (list.length - 1) / 2) * CLOCK_GAP;
    const y = -0.4;
    const h = t.el.type === "hourglass" ? HOURGLASS_H : CLOCK_R;
    return { t, x, y, top: y + h, bottom: y - h };
  });
};

const lanesOf = (ctx: StageCtx) => {
  const t = ctx.timed.find((x) => x.el.type === "tracks");
  return t?.el.type === "tracks" ? { lanes: t.el.lanes as (Lane3D & { icon?: string })[], at: t.at, duration: t.el.duration ?? 2.2 } : null;
};

const blocksOf = (ctx: StageCtx) => {
  const t = ctx.timed.find((x) => x.el.type === "stack");
  return t?.el.type === "stack" ? { items: t.el.items, at: t.at, every: t.el.every ?? 0.35 } : null;
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
    case "ocean":
      return B(-3.4, -1.9, -3.5, 3.4, 1.4, 2.2);
    case "planet":
      return B(-3.0, -2.5, -3.0, 3.0, 2.5, 3.0);
    case "blackhole":
      return B(-4.1, -1.3, -4.1, 4.1, 1.3, 4.1);
    case "clocks": {
      const items = clockItems(ctx);
      const n = Math.max(1, items.length);
      const w = ((n - 1) * CLOCK_GAP) / 2 + 1.35;
      const top = Math.max(...items.map((c) => c.top), 0.85);
      // números presos em cima de cada relógio e rótulos embaixo também ficam dentro
      const nums = timed.some((t) => t.el.type === "number") ? 1.1 : 0.15;
      const labels = items.some((c) => "label" in c.t.el && c.t.el.label) ? 0.7 : 0.1;
      return B(-w, Math.min(...items.map((c) => c.bottom), -1.65) - labels, -1, w, top + nums, 1);
    }
    case "figure":
      return B(-2.0, FLOOR_Y, -1.7, 2.0, FLOOR_Y + 2.45, 1.7);
    case "phone":
      return B(-2.1, -2.6, -0.5, 2.1, 2.6, 0.5);
    case "paths": {
      const n = lanesOf(ctx)?.lanes.length ?? 2;
      const zw = ((n - 1) * PATHS.gap) / 2 + 0.5;
      return B(-PATHS.length / 2 - 0.3, FLOOR_Y, -zw, PATHS.length / 2 + 0.3, FLOOR_Y + 0.15 + PATHS.height + 0.5, zw);
    }
    case "blocks": {
      const n = blocksOf(ctx)?.items.length ?? 3;
      // rótulos à direita de cada bloco
      return B(-BLOCK.w / 2 - 0.3, FLOOR_Y, -BLOCK.d / 2, BLOCK.w / 2 + 2.6, blockY(n - 1) + BLOCK.h / 2 + 0.1, BLOCK.d / 2);
    }
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
      return { x0: 120, x1: 960, y0: 800, y1: 1120 };
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
  const space = stage === "ocean" || stage === "planet" || stage === "blackhole";
  const waveAt = spec.waveAt ? resolveBeat(spec.waveAt, words, shot.id, 0.5) : undefined;
  const lanes = stage === "paths" ? lanesOf(ctx) : null;
  const blocks = stage === "blocks" ? blocksOf(ctx) : null;
  const phone = timed.find((x) => x.el.type === "phone");
  const planet = timed.find((x) => x.el.type === "planet");
  return (
    <>
      <Room
        seed={seed}
        camDist={camDist}
        floor={!space}
        scroll={stage === "figure" ? 5 * (spec.speed ?? 1) : 0}
        walls={spec.walls ?? (stage === "head" || stage === "bars" || stage === "cart" || stage === "building" || stage === "blocks")}
      />
      {stage === "ocean" ? (
        <>
          <Ocean waveAt={waveAt} />
          {spec.ship === false ? null : <Ship alert={spec.alert} />}
        </>
      ) : null}
      {stage === "planet" ? <OceanPlanet rings={planet?.el.type === "planet" ? planet.el.rings : undefined} alert={spec.alert} /> : null}
      {stage === "blackhole" ? <BlackHole seed={seed} /> : null}
      {stage === "clocks"
        ? clockItems(ctx).map(({ t: item, x, y }, k) => (
            <group key={k} position={[x, y, 0]}>
              {item.el.type === "clock" ? (
                <Clock3D spec={{ at: item.at, speed: item.el.speed, speedTo: item.el.speedTo, ramp: item.el.ramp, time: item.el.time, alert: item.el.alert }} />
              ) : item.el.type === "hourglass" ? (
                <Hourglass3D seed={`${seed}-${k}`} spec={{ at: item.at, empty: item.el.empty, breakAt: item.el.break?.at }} />
              ) : null}
            </group>
          ))
        : null}
      {stage === "figure" ? <StillFigure seed={seed} speed={spec.speed} sad={spec.sad} /> : null}
      {stage === "phone" ? <Phone3D at={phone?.at ?? 0} speed={phone?.el.type === "phone" ? phone.el.speed : undefined} rings={phone?.el.type === "phone" ? (phone.el.rings ?? true) : true} /> : null}
      {lanes ? <Paths3D lanes={lanes.lanes} at={lanes.at} duration={lanes.duration} /> : null}
      {blocks ? <Blocks3D count={blocks.items.length} at={blocks.at} every={blocks.every} /> : null}
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
          {meter && meter.el.type === "meter" ? <Thermometer value={meter.el.value} at={meter.at} /> : <HoloCore alert />}
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
  const fontSize = Math.min(size ?? 150, KEYWORD_MAX, 930 / Math.max(3, text.length * 0.62));
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
          fontSize: size,
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
        <span style={{ fontSize: size * 0.42, marginTop: size * 0.06, marginLeft: 10, letterSpacing: "0.02em" }}>{el.suffix ?? ""}</span>
      </div>
    </div>
  );
};

// Contador em mono (2… 3… 5 anos): cada valor bate com kick e brilho, sem contar entre eles.
const HeroCounter: React.FC<{ readonly el: Extract<KElement, { type: "counter" }>; readonly times: number[]; readonly x: number; readonly y: number; readonly size: number; readonly alert?: boolean }> = ({
  el,
  times,
  x,
  y,
  size,
  alert,
}) => {
  const { f } = useCollageTheme();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (frame < Math.round(times[0] * fps)) {
    return null;
  }
  let k = 0;
  times.forEach((ti, i) => {
    if (frame >= Math.round(ti * fps)) {
      k = i;
    }
  });
  const local = frame - Math.round(times[k] * fps);
  const kick = interpolate(local, [0, 3, 10], [1.18, 1.05, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const flash = interpolate(local, [0, 3, 16], [0.4, 1, 0.3], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const c = alert || k === el.values.length - 1 ? WIRE.alert : WIRE.cyan;
  const v = el.values[k];
  return (
    <div data-bigtext="box" style={{ position: "absolute", left: x, top: y, translate: "-50% -50%", scale: kick, display: "flex", flexDirection: "column", alignItems: "center" }}>
      {el.label ? <div style={{ fontFamily: f.mono, fontWeight: 700, fontSize: 34, letterSpacing: 3, color: c, marginBottom: 6, textShadow: `0 0 12px ${withAlpha(c, 0.8)}` }}>{el.label}</div> : null}
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
          textShadow: `0 0 ${20 + 50 * flash}px ${withAlpha(c, 0.6 + 0.4 * flash)}, 0 8px 0 rgba(0,0,0,0.5)`,
        }}
      >
        <span data-num={k} data-main={1}>
          {el.prefix ?? ""}
          {formatBR(v, decimalsOf(v))}
        </span>
        <span style={{ fontSize: size * 0.42, marginTop: size * 0.06, marginLeft: 10, letterSpacing: "0.02em" }}>{el.suffix ?? ""}</span>
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

  // Palcos do 004 (objeto ocupando a área de baixo): o número herói fica na faixa da
  // palavra-chave (uma coisa por vez nessa faixa).
  const BAND_STAGES: WireStage[] = ["ocean", "planet", "blackhole", "figure", "phone", "paths", "blocks"];
  const heroPos =
    stage === "number"
      ? { x: 330, y: 850, size: 200 }
      : stage === "food"
        ? { x: 540, y: 625, size: 190 }
        : BAND_STAGES.includes(stage)
          ? { x: 540, y: KEYWORD_Y, size: 160 }
          : { x: 540, y: 760, size: 200 };
  const clocks = stage === "clocks" ? clockItems(ctx) : [];
  const numberEls = timed.filter((t) => t.el.type === "number");

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
              <Hud text={el.text} x={540} y={SOURCE_Y - n * 56} start={start} size={26} />
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
        if (el.type === "number" && clocks.length > 0) {
          // Um número por relógio (na ordem), preso em cima dele.
          const c = clocks[Math.min(clocks.length - 1, numberEls.indexOf(t))];
          const p = project(cam, [c.x, c.top + 0.62, 0]);
          return (
            <div key={i} data-el={i}>
              <HeroNumber el={el} at={at} x={p.x} y={p.y} size={Math.min(el.size ?? 120, 130)} alert={c.t.el.type === "clock" ? c.t.el.alert : spec.alert} />
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
        if (el.type === "counter") {
          return (
            <div key={i} data-el={i}>
              <HeroCounter el={el} times={[at, ...(el.beats ?? []).map((b) => b.at ?? at)]} x={540} y={KEYWORD_Y} size={Math.min(el.size ?? 160, 170)} alert={spec.alert} />
            </div>
          );
        }
        if ((el.type === "phone" || el.type === "planet" || el.type === "treadmill") && el.label && labels.length === 0) {
          return (
            <div key={i} data-el={i}>
              <Hud text={el.label} x={540} y={SOURCE_Y} start={start} size={30} />
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
          const texts = el.points.map((v) => `${formatBR(v, decimalsOf(v))}${el.unit ?? "%"}`);
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
      {stage === "cables" ? <CableLabels ctx={ctx} cam={cam} /> : null}
      {stage === "clocks" || stage === "paths" || stage === "blocks" ? <TimeLabels ctx={ctx} cam={cam} /> : null}
      {stage === "end" ? <EndCard /> : null}
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

// Rótulos dos palcos do 004: nome de cada relógio (embaixo dele), de cada trilha (no fim
// dela, aparece quando a linha chega) e de cada bloco (à direita, quando ele assenta).
const TimeLabels: React.FC<{ readonly ctx: StageCtx; readonly cam: THREE.PerspectiveCamera }> = ({ ctx, cam }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const out: React.ReactNode[] = [];
  if (ctx.stage === "clocks") {
    clockItems(ctx).forEach((c, k) => {
      const label = "label" in c.t.el ? (c.t.el.label as string | undefined) : undefined;
      if (label) {
        const p = project(cam, [c.x, c.bottom - 0.42, 0]);
        out.push(<Hud key={`c${k}`} text={label} x={p.x} y={p.y} start={Math.round(c.t.at * fps)} size={32} alert={c.t.el.type === "clock" && c.t.el.alert} />);
      }
    });
  }
  const lanes = ctx.stage === "paths" ? lanesOf(ctx) : null;
  lanes?.lanes.forEach((lane, i) => {
    const p = pathProgress(frame, fps, lanes.at, i, lanes.duration);
    const q = project(cam, pathPoint(lane, i, lanes.lanes.length, Math.max(0.05, p)));
    out.push(<Hud key={`l${i}`} text={lane.label} x={q.x} y={q.y - 58} start={Math.round((lanes.at + i * 0.15) * fps)} size={32} alert={lane.rise > 0} />);
  });
  const blocks = ctx.stage === "blocks" ? blocksOf(ctx) : null;
  blocks?.items.forEach((it, i) => {
    if (!it.label) {
      return;
    }
    const start = Math.round((blocks.at + i * blocks.every) * fps) + 8;
    const p = project(cam, [BLOCK.w / 2 + 0.35 + (i % 2 ? 0.18 : -0.18), blockY(i), 0]);
    out.push(<Hud key={`b${i}`} text={it.label} x={p.x} y={p.y} start={start} size={32} anchor="left" alert={i === blocks.items.length - 1} />);
  });
  return <>{out}</>;
};

// Tela final: logo RikuAI em holograma + "LINK NA BIO".
const EndCard: React.FC = () => {
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
        RikuAI
      </div>
    </>
  );
};

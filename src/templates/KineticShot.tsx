import React, { useEffect, useMemo, useRef } from "react";
import { AbsoluteFill, continueRender, delayRender, interpolate, random, useCurrentFrame, useVideoConfig } from "remotion";
import { useCollageTheme } from "../brand/collageTheme";
import { RansomText } from "../components/collage/Type";
import { AnimatedIcon, GhostIcon, IconGroup } from "../components/kinetic/AnimatedIcon";
import { Building } from "../components/kinetic/Building";
import { CommentBubbles } from "../components/kinetic/Bubbles";
import { Clipping, GlassCard } from "../components/kinetic/Cards";
import { BarChart, LineChart } from "../components/kinetic/Charts";
import { clipSeconds, KClip } from "../components/kinetic/Clip";
import { BlockStack, PhoneFeed, Planet, Tracks, Treadmill } from "../components/kinetic/Gadgets";
import { KineticText, MonoLabel } from "../components/kinetic/KineticText";
import { KPhoto } from "../components/kinetic/KPhoto";
import { COUNT_MAX_S, EASE, ShotProvider } from "../components/kinetic/motion";
import { BigNumber, Particles } from "../components/kinetic/Numbers";
import { Piece } from "../components/kinetic/Piece";
import { Meter, Shape } from "../components/kinetic/Shapes";
import { CalendarFlip, Clock, Counter, Hourglass } from "../components/kinetic/TimeProps";
import { resolveBeat, type SceneWord } from "./collageLayers";
import type { ImageAsset } from "./collageTypes";
import type { EnterPreset, KBeat, KElement, KMove, KShot } from "./kineticTypes";
import { VISUAL } from "./safeZone";

const DEFAULT_ENTER: Partial<Record<KElement["type"], EnterPreset>> = {
  text: "none",
  number: "blur",
  bars: "none",
  line: "none",
  icon: "pop",
  icons: "none",
  card: "up",
  shape: "none",
  meter: "up",
  ransom: "none",
  bubbles: "instant",
  ghost: "blur",
  building: "instant",
  clipping: "drop",
  label: "left",
  clip: "up",
  clock: "pop",
  hourglass: "pop",
  calendar: "drop",
  counter: "blur",
  phone: "up",
  planet: "zoom",
  stack: "instant",
  tracks: "instant",
  treadmill: "up",
};

// Altura do ponto fixo do zoom da câmera (faixa dos títulos).
const ZOOM_ORIGIN_Y = 330;
const SHAKE_FRAMES = 6;

// Frame (do shot) em que o impacto de um elemento acontece.
const impactFrame = (el: KElement, start: number, fps: number) => {
  if (el.type === "number") {
    return start + Math.round(Math.min(el.duration ?? COUNT_MAX_S, COUNT_MAX_S) * fps);
  }
  if (el.type === "ransom") {
    return start + (el.text.split(/\s+/).filter(Boolean).length - 1) * 4 + 4;
  }
  // Contador: o impacto é o último valor; ampulheta: quando o vidro quebra.
  if (el.type === "counter" && el.beats?.length) {
    return Math.round((el.beats[el.beats.length - 1].at ?? 0) * fps) + 3;
  }
  if (el.type === "hourglass" && el.break?.at !== undefined) {
    return Math.round(el.break.at * fps);
  }
  return start + 6;
};

export type TimedElement = { el: KElement; at: number; seed: string; impact?: number };

// Beats internos (valores do contador, quebra da ampulheta) resolvidos pelas palavras: o
// render e os sons usam os mesmos tempos.
const resolveInner = (el: KElement, words: SceneWord[], shotId: string, at: number): KElement => {
  if (el.type === "counter") {
    return { ...el, beats: (el.beats ?? []).map((b, i) => ({ at: resolveBeat(b, words, shotId, at + 0.5 * (i + 1)) })) };
  }
  if (el.type === "hourglass" && el.break) {
    return { ...el, break: { at: resolveBeat(el.break, words, shotId, at + 1.2) } };
  }
  return el;
};

export const timeElements = (shot: KShot, words: SceneWord[], fps: number): TimedElement[] =>
  shot.elements.map((raw, i) => {
    const at = resolveBeat(raw, words, shot.id, Math.min(0.2 + i * 0.25, Math.max(0, shot.duration - 0.4)));
    const el = resolveInner(raw, words, shot.id, at);
    return { el, at, seed: `${shot.id}-${el.id ?? i}`, impact: el.impact ? impactFrame(el, Math.round(at * fps), fps) : undefined };
  });

type Props = {
  readonly shot: KShot;
  readonly sceneId: string;
  readonly words: SceneWord[];
  readonly images?: Record<string, ImageAsset> | null;
  // Liga o registro dos números renderizados (scripts/check-numbers.mjs).
  readonly numberCheck?: boolean;
  // Frame do vídeo em que o shot começa (pro registro da revisão).
  readonly startFrame?: number;
};

// Opacidade efetiva: produto da opacidade dos ancestrais (e da fração visível marcada
// pelas transições com máscara).
const effectiveOpacity = (node: Element) => {
  let op = 1;
  for (let n: Element | null = node; n && n !== document.body; n = n.parentElement) {
    op *= Number(getComputedStyle(n).opacity);
    const vis = (n as HTMLElement).dataset?.vis;
    if (vis !== undefined) {
      op *= Number(vis);
    }
  }
  return op;
};

const boxOf = (el: Element) => {
  if ((el as HTMLElement).dataset.bigtext !== "union") {
    return el.getBoundingClientRect();
  }
  // Caixa justa: união das peças (ex: letras do ransom).
  const rects = Array.from(el.querySelectorAll(":scope > * > *")).map((c) => c.getBoundingClientRect()).filter((r) => r.width > 2 && r.height > 2);
  if (rects.length === 0) {
    return el.getBoundingClientRect();
  }
  const l = Math.min(...rects.map((r) => r.left));
  const t = Math.min(...rects.map((r) => r.top));
  return new DOMRect(l, t, Math.max(...rects.map((r) => r.right)) - l, Math.max(...rects.map((r) => r.bottom)) - t);
};

// Revisão automática (scripts/check-numbers.mjs): depois que o quadro é montado, registra
// no log do navegador o texto de cada número e a caixa de cada texto grande na tela.
// O render só termina depois disso (delayRender por quadro).
export const NumberProbe: React.FC<{ readonly shotId: string; readonly startFrame: number; readonly root: React.RefObject<HTMLDivElement | null> }> = ({ shotId, startFrame, root }) => {
  const frame = useCurrentFrame();
  const handle = useMemo(() => delayRender(`numcheck ${shotId} ${frame}`), [shotId, frame]);
  useEffect(() => {
    const comp = document.querySelector("[data-comp-root]")?.getBoundingClientRect();
    const k = comp ? 1080 / comp.width : 1;
    const rect = (r: DOMRect) => ({
      x: Math.round((r.left - (comp?.left ?? 0)) * k),
      y: Math.round((r.top - (comp?.top ?? 0)) * k),
      w: Math.round(r.width * k),
      h: Math.round(r.height * k),
    });
    const all = (sel: string) => Array.from(root.current?.querySelectorAll<HTMLElement>(sel) ?? []);
    const label = (n: Element) => (n.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 28);
    const items = all("[data-num]")
      .filter((n) => effectiveOpacity(n) > 0.05)
      .map((n) => {
        const r = n.getBoundingClientRect();
        // Tamanho efetivo da fonte na tela (escala de transform e da composição incluídas).
        const font = parseFloat(getComputedStyle(n).fontSize) * (n.offsetHeight > 0 ? r.height / n.offsetHeight : 1) * k;
        return {
          el: Number(n.closest<HTMLElement>("[data-el]")?.dataset.el),
          i: Number(n.dataset.num),
          text: n.textContent ?? "",
          counting: n.dataset.counting === "1",
          main: n.dataset.main === "1",
          font: Math.round(font * 10) / 10,
          inBig: Boolean(n.closest("[data-bigtext]")),
          op: Math.round(effectiveOpacity(n) * 100) / 100,
          ...rect(r),
        };
      });
    const texts = all("[data-bigtext]").map((n) => ({ label: label(n), ...rect(boxOf(n)), op: Math.round(effectiveOpacity(n) * 100) / 100 }));
    // Caixa de objetos 3D (WireframeExplainer): texto grande não pode ficar em cima.
    const avoid = all("[data-avoid]").map((n) => ({ label: "objeto 3D", ...rect(n.getBoundingClientRect()), op: 1 }));
    // Tudo que precisa ficar dentro da área segura.
    const safe = all("[data-safe], [data-bigtext], [data-num], [data-fulltext]")
      .filter((n) => effectiveOpacity(n) > 0.3)
      .map((n) => ({ label: n.dataset.safe === "object" ? "objeto 3D" : label(n), ...rect(n.dataset.bigtext === "union" ? boxOf(n) : n.getBoundingClientRect()) }));
    // Digitação: o que aparece tem que ser palavras inteiras do texto.
    const typed = all("[data-fulltext]").map((n) => ({
      full: (n.dataset.fulltext ?? "").replace(/\s+/g, " ").trim().toUpperCase(),
      shown: (n.querySelector("[data-shown]")?.textContent ?? n.textContent ?? "").replace(/\s+/g, " ").trim().toUpperCase(),
    }));
    // Ransom: letras visíveis de cada palavra.
    const ransom = all("[data-rword]").map((n) => ({
      el: Number(n.closest<HTMLElement>("[data-el]")?.dataset.el),
      word: n.dataset.rword ?? "",
      shown: (n.textContent ?? "").length,
    }));
    // Legenda (fica fora do shot): o destaque precisa cobrir a palavra inteira.
    const captions = Array.from(document.querySelectorAll<HTMLElement>("[data-capword]")).map((n) => {
      const tx = n.querySelector("[data-captext]")?.getBoundingClientRect();
      const hl = n.querySelector<HTMLElement>("[data-hl]");
      const hr = hl?.getBoundingClientRect();
      const cover = tx && hr ? Math.max(0, Math.min(hr.right, tx.right) - Math.max(hr.left, tx.left)) / Math.max(1, tx.width) : 1;
      return { word: (n.textContent ?? "").trim(), active: Boolean(hl), hlOp: hl ? Math.round(effectiveOpacity(hl) * 100) / 100 : 0, cover: Math.round(cover * 100) / 100, ...(tx ? rect(tx) : { x: 0, y: 0, w: 0, h: 0 }) };
    });
    console.log(`NUMCHECK ${JSON.stringify({ shot: shotId, frame: startFrame + frame, items, texts, avoid, safe, typed, ransom, captions })}`);
    continueRender(handle);
  }, [handle, root, shotId, frame, startFrame]);
  return null;
};

export const KineticShot: React.FC<Props> = ({ shot, sceneId, words, images, numberCheck, startFrame = 0 }) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const { c } = useCollageTheme();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const frames = Math.round(shot.duration * fps);
  const timed = timeElements(shot, words, fps);
  const impacts = timed.map((t) => t.impact).filter((v): v is number => v !== undefined);

  // Câmera virtual: "punch-in" rápido, deriva lenta, acelera na saída (speed ramp).
  const [z0, z1] = shot.camera?.zoom ?? [1, 1.06];
  const zoom =
    interpolate(frame, [0, 8], [z0 + 0.05, z0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE.outExpo }) +
    interpolate(frame, [8, Math.max(9, frames - 8)], [0, z1 - z0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) +
    interpolate(frame, [frames - 8, frames], [0, 0.04], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE.inExpo });
  const rot = Math.sin((frame / fps) * 0.7) * (shot.camera?.rotate ?? 0.8);
  let sx = 0;
  let sy = 0;
  for (const fi of impacts) {
    const k = frame - fi;
    if (k >= 0 && k < SHAKE_FRAMES) {
      const a = (1 - k / SHAKE_FRAMES) * 16;
      sx += (random(`${shot.id}-sx-${fi}-${k}`) - 0.5) * 2 * a;
      sy += (random(`${shot.id}-sy-${fi}-${k}`) - 0.5) * 2 * a;
    }
  }
  const cam = { x: Math.sin((frame / fps) * 0.5) * 14, y: Math.cos((frame / fps) * 0.4) * 10 };
  const ink = shot.interrupt === "white" ? c.ink : "#ffffff";
  const interruptBg = shot.interrupt === "black" ? "#07060c" : shot.interrupt === "white" ? "#f4f1ea" : shot.interrupt === "accent" ? c.accent : undefined;

  return (
    <ShotProvider value={{ ink, cam, frames }}>
      <AbsoluteFill>
        {interruptBg ? <AbsoluteFill style={{ backgroundColor: interruptBg }} /> : null}
        {/* zoom ancorado na faixa dos títulos: eles ficam parados e não saem da área segura */}
        <AbsoluteFill ref={rootRef} style={{ scale: zoom, rotate: `${rot}deg`, translate: `${sx}px ${sy}px`, transformOrigin: `540px ${ZOOM_ORIGIN_Y}px` }}>
          {timed.map((t, i) => (
            <Element key={t.seed} timed={t} index={i} sceneId={sceneId} images={images} words={words} shotId={shot.id} />
          ))}
        </AbsoluteFill>
        {numberCheck ? <NumberProbe shotId={shot.id} startFrame={startFrame} root={rootRef} /> : null}
      </AbsoluteFill>
    </ShotProvider>
  );
};

const Element: React.FC<{
  readonly timed: TimedElement;
  readonly index: number;
  readonly sceneId: string;
  readonly images?: Record<string, ImageAsset> | null;
  readonly words: SceneWord[];
  readonly shotId: string;
}> = ({ timed, index, sceneId, images, words, shotId }) => {
  const { c } = useCollageTheme();
  const { fps } = useVideoConfig();
  const { el, at, seed, impact } = timed;
  const x = el.x ?? VISUAL.centerX;
  const y = el.y ?? VISUAL.centerY;
  const piece = {
    seed,
    x,
    y,
    at,
    enter: el.enter ?? DEFAULT_ENTER[el.type] ?? "up",
    exitAt: el.exitAt,
    depth: el.depth ?? 1,
    scale: el.scale,
    rotate: el.rotate,
    tilt: el.tilt ?? (el.type === "card" || el.type === "number" || el.type === "counter"),
    float: el.float ?? 6,
    zIndex: el.z ?? index,
    probe: index,
  };
  const burst =
    impact !== undefined && el.type !== "number" ? (
      <div style={{ position: "absolute", left: "50%", top: "50%" }}>
        <Particles seed={`${seed}-impact`} at={impact / fps} count={28} spread={520} />
      </div>
    ) : null;
  const accentOr = (col?: string) => (col === "accent" ? c.accent : col === "ink" ? c.ink : col === "cream" ? c.cream : undefined);

  switch (el.type) {
    case "text":
      return (
        <Piece {...piece}>
          <KineticText
            text={el.text}
            at={at}
            mode={el.mode}
            effect={el.effect}
            size={el.size}
            weight={el.weight}
            font={el.font}
            color={accentOr(el.color)}
            maxWidth={el.maxWidth}
            highlight={el.highlight}
            plate={el.plate}
            align={el.align}
            outline={el.outline}
          />
          {burst}
        </Piece>
      );
    case "number":
      return (
        <Piece {...piece}>
          <BigNumber seed={seed} value={el.value} at={at} decimals={el.decimals} prefix={el.prefix} suffix={el.suffix} size={el.size} duration={el.duration} color={el.color} particles={el.particles ?? true} label={el.label} />
        </Piece>
      );
    case "bars": {
      const w = el.width ?? 880;
      const h = el.height ?? 600;
      const origin = { x: VISUAL.centerX - (x - w / 2), y: VISUAL.centerY - (y - (h + 70) / 2), size: 260 };
      const bracket = el.bracket ? { ...el.bracket, at: el.bracket.at ?? at + 1.2 } : undefined;
      // Match cut: o gráfico já está inteiro no 1º frame (o valor vem do shot anterior).
      return (
        <Piece {...piece} enter={el.enter ?? (el.morphFrom !== undefined ? "instant" : piece.enter)} float={el.float ?? 3}>
          <BarChart data={el.data} at={at} width={w} height={h} max={el.max} unit={el.unit} morphFrom={el.morphFrom} morphOrigin={origin} bracket={bracket} />
        </Piece>
      );
    }
    case "line":
      return (
        <Piece {...piece} float={el.float ?? 3}>
          <LineChart points={el.points} labels={el.labels} at={at} width={el.width} height={el.height} unit={el.unit} />
        </Piece>
      );
    case "icon":
      return (
        <Piece {...piece}>
          <AnimatedIcon icon={el.icon} seed={seed} at={at} preset={el.preset} size={el.size} container={el.container} color={accentOr(el.color)} label={el.label} badge={el.badge} badgeAt={el.badgeAt} />
        </Piece>
      );
    case "icons":
      return (
        <Piece {...piece}>
          <IconGroup icons={el.icons} seed={seed} at={at} arrangement={el.arrangement} cols={el.cols} preset={el.preset} size={el.size} container={el.container} gap={el.gap} radius={el.radius} />
        </Piece>
      );
    case "card":
      return (
        <Piece {...piece}>
          <GlassCard seed={seed} at={at} title={el.title} subtitle={el.subtitle} kicker={el.kicker} icon={el.icon} width={el.width} height={el.height} tone={el.tone} />
        </Piece>
      );
    case "shape":
      return (
        <Piece {...piece} float={el.float ?? 3}>
          <Shape shape={el.shape} at={at} w={el.w} h={el.h} dx={(el.toX ?? x + 300) - x} dy={(el.toY ?? y) - y} color={accentOr(el.color)} stroke={el.stroke} />
        </Piece>
      );
    case "building": {
      // Movimentos e marcadores também podem entrar por palavra da narração.
      const beat = <B extends KBeat>(b: B, fallback: number) => resolveBeat(b, words, shotId, fallback);
      const moves = (m?: KMove[]) => m?.map((mv) => ({ ...mv, at: beat(mv, at + 0.4) }));
      return (
        <Piece {...piece} float={el.float ?? 3}>
          <Building
            seed={seed}
            at={at}
            floors={el.floors}
            width={el.width}
            height={el.height}
            elevator={el.elevator ? { ...el.elevator, moves: moves(el.elevator.moves) } : undefined}
            stairs={el.stairs ? { ...el.stairs, moves: moves(el.stairs.moves) } : undefined}
            markers={el.markers?.map((m) => ({ ...m, at: beat(m, at + 0.5) }))}
            gap={el.gap ? { ...el.gap, at: beat(el.gap, at + 0.6) } : undefined}
            speed={el.speed}
          />
        </Piece>
      );
    }
    case "ghost":
      return (
        <Piece {...piece} depth={el.depth ?? 0} float={el.float ?? 14}>
          <GhostIcon icon={el.icon} size={el.size} opacity={el.opacity} blur={el.blur} seed={seed} />
        </Piece>
      );
    case "particles":
      return (
        <div style={{ position: "absolute", left: x, top: y }}>
          <Particles seed={seed} at={at} count={el.count} spread={el.spread} kind={el.kind} />
        </div>
      );
    case "meter":
      return (
        <Piece {...piece}>
          <Meter kind={el.kind} value={el.value} at={at} label={el.label} size={el.size} />
        </Piece>
      );
    case "photo": {
      const asset = el.id ? images?.[`${sceneId}/${el.id}`] : undefined;
      const strip = (el.images ?? []).map((im) => images?.[`${sceneId}/${im.id}`]);
      const photo = <KPhoto style={el.style} seed={seed} at={at} asset={asset} strip={strip} width={el.width} height={el.height} text={el.text} side={el.side} />;
      if (el.style === "split") {
        const side = el.side ?? "left";
        const pos: React.CSSProperties =
          side === "left" ? { left: 0, top: 0 } : side === "right" ? { right: 0, top: 0 } : side === "top" ? { left: 0, top: 0 } : { left: 0, bottom: 0 };
        return <div style={{ position: "absolute", ...pos, zIndex: piece.zIndex }}>{photo}</div>;
      }
      const enter: EnterPreset = el.enter ?? (el.style === "cutout" ? "drop" : el.style === "mask" ? "none" : "up");
      return (
        <Piece {...piece} enter={enter} tilt={el.tilt ?? el.style === "frame"}>
          {photo}
          {burst}
        </Piece>
      );
    }
    case "bubbles":
      return (
        <Piece {...piece} float={el.float ?? 2}>
          <CommentBubbles items={el.items} seed={seed} at={at} every={el.every} size={el.size} spread={el.spread} step={el.step} />
        </Piece>
      );
    case "ransom":
      return (
        <Piece {...piece}>
          <RansomText text={el.text} seed={seed} at={at} size={el.size} maxWidth={900} />
          {burst}
        </Piece>
      );
    case "clipping":
      return (
        <Piece {...piece} rotate={el.rotate ?? -3}>
          <Clipping seed={seed} text={el.text} sub={el.sub} size={el.size} />
          {burst}
        </Piece>
      );
    case "label":
      return (
        <Piece {...piece} float={el.float ?? 2}>
          <MonoLabel text={el.text} at={at} size={el.size} />
        </Piece>
      );
    case "clip":
      // Sai sozinho quando o trecho acaba (a saída termina junto com o último quadro).
      return (
        <Piece {...piece} exitAt={el.exitAt ?? at + clipSeconds(el.duration) - 8 / fps} tilt={el.tilt ?? el.style !== "torn"} float={el.float ?? 4}>
          <KClip src={el.src} seed={seed} at={at} from={el.from} duration={el.duration} style={el.style} width={el.width} height={el.height} label={el.label} />
          {burst}
        </Piece>
      );
    case "clock":
      return (
        <Piece {...piece}>
          <Clock seed={seed} at={at} size={el.size} speed={el.speed} speedTo={el.speedTo} ramp={el.ramp} time={el.time} label={el.label} alert={el.alert} />
          {burst}
        </Piece>
      );
    case "hourglass":
      return (
        <Piece {...piece}>
          <Hourglass seed={seed} at={at} size={el.size} empty={el.empty} breakAt={el.break?.at} label={el.label} />
          {burst}
        </Piece>
      );
    case "calendar":
      return (
        <Piece {...piece}>
          <CalendarFlip seed={seed} at={at} size={el.size} rate={el.rate} rateTo={el.rateTo} ramp={el.ramp} pages={el.pages} label={el.label} />
          {burst}
        </Piece>
      );
    case "counter":
      return (
        <Piece {...piece}>
          <Counter seed={seed} times={[at, ...(el.beats ?? []).map((b) => b.at ?? at)]} values={el.values} prefix={el.prefix} suffix={el.suffix} size={el.size} label={el.label} />
        </Piece>
      );
    case "phone":
      return (
        <Piece {...piece}>
          <PhoneFeed seed={seed} at={at} size={el.size} speed={el.speed} rings={el.rings} label={el.label} />
          {burst}
        </Piece>
      );
    case "planet":
      return (
        <Piece {...piece} float={el.float ?? 8}>
          <Planet seed={seed} at={at} size={el.size} rings={el.rings} label={el.label} />
        </Piece>
      );
    case "stack":
      return (
        <Piece {...piece} float={el.float ?? 3}>
          <BlockStack seed={seed} at={at} items={el.items} every={el.every} size={el.size} />
        </Piece>
      );
    case "tracks":
      return (
        <Piece {...piece} float={el.float ?? 3}>
          <Tracks seed={seed} at={at} lanes={el.lanes} width={el.width} height={el.height} duration={el.duration} />
        </Piece>
      );
    case "treadmill":
      return (
        <Piece {...piece} float={el.float ?? 3}>
          <Treadmill seed={seed} at={at} size={el.size} speed={el.speed} icons={el.icons} label={el.label} />
        </Piece>
      );
    default:
      return null;
  }
};

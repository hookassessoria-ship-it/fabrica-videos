import type { Caption } from "@remotion/captions";
import { getStaticFiles } from "remotion";
import type { TransitionName } from "./kineticTypes";
import { TYPE_FRAMES_PER_WORD } from "../components/kinetic/KineticText";
import { resolveBeat, type SceneWord } from "./collageLayers";
import type { TimedElement } from "./KineticShot";

// Efeitos sonoros automáticos a partir da biblioteca em public/sfx/<tipo>-<n>.mp3
// (npm run sfx:generate): cada transição, ícone, número, ransom, digitação e pattern
// interrupt ganha o seu som. As variações se alternam pra não repetir o mesmo som seguido.

export type SfxEvent = { frame: number; src: string; volume: number; kind: string };

// Volume base de cada tipo (a narração fica em 1.0).
const VOLUME: Record<string, number> = {
  whoosh: 0.32,
  "whoosh-long": 0.3,
  swipe: 0.3,
  pop: 0.28,
  hit: 0.38,
  click: 0.25,
  riser: 0.3,
  glitch: 0.3,
  paper: 0.45,
};

const TRANSITION_SFX: Partial<Record<TransitionName, string>> = {
  zoom: "whoosh",
  whip: "whoosh",
  circle: "whoosh",
  morph: "whoosh-long",
  slide: "swipe",
  wipe: "swipe",
  glitch: "glitch",
  invert: "glitch",
  flash: "hit",
};

const RISER_FRAMES = 36;

// Biblioteca disponível: { whoosh: ["sfx/whoosh-1.mp3", ...], ... }
export const sfxLibrary = (): Record<string, string[]> => {
  const lib: Record<string, string[]> = {};
  for (const f of getStaticFiles()) {
    const m = f.name.match(/^sfx\/([a-z-]+?)-(\d+)\.(mp3|wav)$/);
    if (m) {
      (lib[m[1]] ??= []).push(f.name);
    }
  }
  Object.values(lib).forEach((v) => v.sort());
  return lib;
};

export const staticFileExists = (name: string) => getStaticFiles().some((f) => f.name === name);

type ShotTiming = { startFrame: number; transitionIn: TransitionName; interrupt?: string };

// Beats aninhados (queda do dominó, movimentos do elevador) que entram por palavra:
// resolve pra segundos antes de mapear os sons.
export const resolveNestedBeats = (timed: TimedElement[], words: SceneWord[], shotId: string): TimedElement[] =>
  timed.map((t) => {
    const { el, at } = t;
    if (el.type === "timeline" && el.cutAt?.enterOnWord) {
      return { ...t, el: { ...el, cutAt: { at: resolveBeat(el.cutAt, words, shotId, at + 1) } } };
    }
    if (el.type === "dominoes" && el.fallAt?.enterOnWord) {
      return { ...t, el: { ...el, fallAt: { at: resolveBeat(el.fallAt, words, shotId, at + 0.6) } } };
    }
    if (el.type === "building" && el.elevator?.moves) {
      return { ...t, el: { ...el, elevator: { ...el.elevator, moves: el.elevator.moves.map((m) => ({ ...m, at: resolveBeat(m, words, shotId, at + 0.4) })) } } };
    }
    return t;
  });

export const buildSfxEvents = (
  shots: ShotTiming[],
  timed: TimedElement[][],
  fps: number,
  lib: Record<string, string[]>,
  explicit: Record<string, string> | null | undefined,
): SfxEvent[] => {
  const raw: { frame: number; kind: string; gain?: number }[] = [];
  const add = (frame: number, kind: string, gain = 1) => raw.push({ frame: Math.max(0, Math.round(frame)), kind, gain });

  shots.forEach((s, i) => {
    if (i > 0) {
      const kind = TRANSITION_SFX[s.transitionIn];
      if (kind) {
        add(s.startFrame - 3, kind);
      }
    }
    // Pattern interrupt: sobe (riser) até o corte e bate (hit) no corte.
    if (s.interrupt) {
      add(s.startFrame - RISER_FRAMES, "riser");
      add(s.startFrame, "hit");
    }
    for (const { el, at, impact, tie } of timed[i]) {
      const f = s.startFrame + at * fps;
      // Som pedido no JSON além do automático: "riser" termina no impacto (revelação),
      // "whoosh" acompanha a entrada. Os demais já são cobertos pelo mapeamento.
      if (el.sfx === "riser") {
        add((impact ?? f + 0.4 * fps) - RISER_FRAMES, "riser");
      } else if (el.sfx === "whoosh") {
        add(f, "whoosh", 0.9);
      }
      switch (el.type) {
        case "icon":
          add(f + 2, "pop");
          break;
        case "icons":
          el.icons.forEach((_, k) => add(f + 2 + k * 3, "pop", 0.8));
          break;
        case "bubbles":
          el.items.forEach((_, k) => add(f + k * (el.every ?? 0.2) * fps, "pop", 0.85));
          break;
        case "number":
          add(impact ?? f + 0.4 * fps, "hit");
          break;
        case "ransom":
          add(f, "paper");
          add(impact ?? f + 6, "hit");
          break;
        case "clipping":
          add(f + 2, "paper");
          break;
        case "text":
          if (el.effect === "type") {
            // Digitação por palavra: um clique a cada palavra que aparece.
            el.text.split(" ").forEach((_, k) => add(f + k * TYPE_FRAMES_PER_WORD, "click", 0.9));
          } else if (el.effect === "impact") {
            add(f + 2, "hit", 0.9);
          }
          break;
        case "photo":
          if (el.style === "strip") {
            (el.images ?? []).forEach((_, k) => add(f + k * 9, "swipe", 0.8));
          } else if (el.sfx !== "whoosh") {
            add(f, "swipe", 0.8);
          }
          break;
        case "clip":
          // Trecho de filme entra como foto (o vídeo em si é sempre mudo).
          if (el.sfx !== "whoosh") {
            add(f, "swipe", 0.8);
          }
          break;
        case "mast":
          // Cada corda apertando: swipe curto (as cordas saem a cada 5 quadros).
          Array.from({ length: el.ropes ?? 4 }, (_, k) => add(s.startFrame + (tie ?? at + 0.5) * fps + k * 5 + 3, "swipe", 0.55));
          break;
        case "bars":
          // Valor de cada barra aparece com pop quando ela termina de crescer.
          el.data.forEach((_, k) => add(f + 4 + k * 3 + 11, "pop", 0.6));
          break;
        case "building":
          (el.elevator?.moves ?? []).forEach((m) => {
            if (m.ease === "fast" && m.at !== undefined) {
              add(s.startFrame + m.at * fps, "whoosh-long");
            }
          });
          break;
        case "dominoes": {
          // cada peça que cai bate na próxima
          const t0 = s.startFrame + (el.fallAt?.at ?? at + 0.6) * fps;
          el.items.slice(0, el.fall ?? el.items.length).forEach((_, k) => add(t0 + k * (el.every ?? 0.22) * fps + 9, "click", 1));
          break;
        }
        case "cycle":
          el.items.forEach((_, k) => add(f + k * (el.every ?? 0.5) * fps + 2, "pop", 0.8));
          break;
        case "timeline":
          el.items.forEach((it, k) => {
            add(f + k * (el.every ?? 0.28) * fps + 2, "click", 0.8);
            if (it.cut) {
              const cutIndex = el.items.slice(0, k).filter((x) => x.cut).length;
              const at0 = el.cutAt?.at;
              add(at0 !== undefined ? s.startFrame + (at0 + cutIndex * 0.16) * fps : f + k * (el.every ?? 0.28) * fps + 8, "paper", 0.9);
            }
          });
          break;
        case "shape":
          if (el.impact) {
            add(f + 4, "hit", 0.8);
          }
          break;
        default:
          break;
      }
    }
  });

  // Mesmo tipo muito colado: fica um só. Variações se alternam.
  raw.sort((a, b) => a.frame - b.frame);
  const lastAt: Record<string, number> = {};
  const counter: Record<string, number> = {};
  const out: SfxEvent[] = [];
  for (const e of raw) {
    const files = explicit?.[e.kind] ? [explicit[e.kind]] : lib[e.kind];
    if (!files || files.length === 0) {
      continue;
    }
    if (lastAt[e.kind] !== undefined && e.frame - lastAt[e.kind] < (e.kind === "click" ? 3 : 5)) {
      continue;
    }
    lastAt[e.kind] = e.frame;
    const n = counter[e.kind] ?? 0;
    counter[e.kind] = n + 1;
    out.push({ frame: e.frame, src: files[n % files.length], volume: (VOLUME[e.kind] ?? 0.3) * (e.gain ?? 1), kind: e.kind });
  }
  return out;
};

// Fala no quadro (0..1, suavizado): os efeitos e a trilha abaixam enquanto há voz.
export const speechEnvelope = (captions: Caption[], fps: number, frames: number) => {
  const on = new Float32Array(frames);
  for (const c of captions) {
    const a = Math.max(0, Math.floor((c.startMs / 1000) * fps) - 1);
    const b = Math.min(frames - 1, Math.ceil((c.endMs / 1000) * fps) + 1);
    for (let f = a; f <= b; f++) {
      on[f] = 1;
    }
  }
  const out = new Float32Array(frames);
  const R = 3;
  for (let f = 0; f < frames; f++) {
    let sum = 0;
    let n = 0;
    for (let k = -R; k <= R; k++) {
      if (f + k >= 0 && f + k < frames) {
        sum += on[f + k];
        n++;
      }
    }
    out[f] = sum / n;
  }
  return out;
};

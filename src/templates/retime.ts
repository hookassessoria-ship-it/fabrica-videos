import type { Caption } from "@remotion/captions";
import { narrationToCaptions } from "../components/captions/narrationToCaptions";
import type { KElement, KMove, KScene, KShot } from "./kineticTypes";

// Shots e entradas foram desenhados contra a narração estimada (palavras distribuídas
// pela duração de cada cena). Com a narração gravada, cada instante é levado pro tempo
// real por um "time warp" palavra a palavra: o que entrava numa palavra continua
// entrando nela. O vídeo termina TAIL segundos depois da última palavra.

const TAIL = 1;
const MIN_SHOT = 0.6;
// O corte vem um pouquinho antes da palavra.
const LEAD = 0.12;

const sceneDur = (s: KScene) => s.shots.reduce((a, sh) => a + sh.duration, 0);
const wordCount = (s: KScene) => s.narration.split(/\s+/).filter(Boolean).length;

// Mapa monotônico tempo estimado -> tempo real (interpolação linear entre âncoras).
const makeWarp = (anchors: [number, number][]) => {
  const pts = anchors.filter((p, i) => i === 0 || (p[0] > anchors[i - 1][0] && p[1] >= anchors[i - 1][1]));
  return (t: number) => {
    if (t <= pts[0][0]) {
      return pts[0][1] + (t - pts[0][0]);
    }
    for (let i = 1; i < pts.length; i++) {
      if (t <= pts[i][0]) {
        const [a0, b0] = pts[i - 1];
        const [a1, b1] = pts[i];
        return b0 + ((t - a0) / (a1 - a0)) * (b1 - b0);
      }
    }
    const last = pts[pts.length - 1];
    return last[1] + (t - last[0]);
  };
};

// Tempo dentro do shot, esticado/encolhido como a fala, contado do início do shot (o que
// entrava no começo continua entrando no começo, mesmo quando o corte foi puxado pra palavra).
const warpAt = (at: number | undefined, oldStart: number, _newStart: number, warp: (t: number) => number) =>
  at === undefined || at < 0 ? at : Math.max(0, warp(oldStart + at) - warp(oldStart));

const warpElement = (el: KElement, oldStart: number, newStart: number, warp: (t: number) => number): KElement => {
  const w = (at: number | undefined) => warpAt(at, oldStart, newStart, warp);
  const moves = (m?: KMove[]) => m?.map((mv) => ({ ...mv, at: w(mv.at) }));
  const out = { ...el, at: w(el.at), exitAt: w(el.exitAt) } as KElement;
  if (out.type === "bars" && out.bracket) {
    out.bracket = { ...out.bracket, at: w(out.bracket.at) };
  }
  if (out.type === "building") {
    if (out.elevator) {
      out.elevator = { ...out.elevator, moves: moves(out.elevator.moves) };
    }
    if (out.stairs) {
      out.stairs = { ...out.stairs, moves: moves(out.stairs.moves) };
    }
    out.markers = out.markers?.map((m) => ({ ...m, at: w(m.at) }));
    out.gap = out.gap ? { ...out.gap, at: w(out.gap.at) } : undefined;
  }
  return out;
};

// Shots curtos demais: pega tempo do vizinho mais longo; se não der, junta com ele.
const enforceMin = (shots: KShot[]): KShot[] => {
  const out = shots.map((s) => ({ ...s }));
  for (let i = 0; i < out.length; i++) {
    if (out[i].duration >= MIN_SHOT) {
      continue;
    }
    const prev = out[i - 1];
    const next = out[i + 1];
    const donor = [prev, next].filter(Boolean).sort((a, b) => b.duration - a.duration)[0];
    const need = MIN_SHOT - out[i].duration;
    if (donor && donor.duration - need >= 1) {
      donor.duration -= need;
      out[i].duration = MIN_SHOT;
    } else if (donor) {
      donor.duration += out[i].duration;
      out.splice(i, 1);
      i--;
    }
  }
  return out;
};

export const retimeScenes = (scenes: KScene[], captions: Caption[] | null | undefined): KScene[] => {
  const total = scenes.reduce((a, s) => a + wordCount(s), 0);
  if (!captions || captions.length === 0) {
    return scenes;
  }
  if (captions.length !== total) {
    console.warn(`Legendas (${captions.length} palavras) não batem com a narração do JSON (${total}). Rode de novo: npm run voice:generate`);
    return scenes;
  }
  // Linha do tempo estimada (a mesma usada pra desenhar os shots).
  const oldStarts: number[] = [];
  let acc = 0;
  scenes.forEach((s) => {
    oldStarts.push(acc);
    acc += sceneDur(s);
  });
  const est = narrationToCaptions(scenes.map((s, i) => ({ narration: s.narration, startSec: oldStarts[i], durationSec: sceneDur(s) })));
  const end = captions[captions.length - 1].endMs / 1000 + TAIL;
  const warp = makeWarp([[0, 0], ...est.map((c, i): [number, number] => [c.startMs / 1000, captions[i].startMs / 1000]), [acc, end]]);

  // Cada corte cai logo antes da 1ª palavra falada no shot (como numa edição feita
  // em cima da fala); as entradas dentro do shot seguem o time warp.
  const estStarts = est.map((c) => c.startMs / 1000);
  const realStarts = captions.map((c) => c.startMs / 1000);
  const oldBounds: number[] = [];
  let tb = 0;
  scenes.forEach((sc) =>
    sc.shots.forEach((sh) => {
      oldBounds.push(tb);
      tb += sh.duration;
    }),
  );
  const flat = scenes.flatMap((sc, si) => sc.shots.map((sh) => ({ sh, si })));
  // Faixa de palavras de cada cena (mesma ordem da narração).
  const firstWord: number[] = [];
  let wi = 0;
  scenes.forEach((sc) => {
    firstWord.push(wi);
    wi += wordCount(sc);
  });
  const normWord = (w: string) => w.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9%]/g, "");
  const newBounds: number[] = [0];
  for (let k = 1; k < oldBounds.length; k++) {
    const { sh, si } = flat[k];
    const prev = newBounds[k - 1];
    let w = -1;
    if (sh.cutOnWord) {
      const from = firstWord[si];
      const to = si + 1 < firstWord.length ? firstWord[si + 1] : captions.length;
      const range = captions.map((c, i) => ({ c, i })).filter(({ c, i }) => i >= from && i < to && c.startMs / 1000 > prev + 0.1);
      const hit = range.find(({ c }) => c.text.trim() === sh.cutOnWord) ?? range.find(({ c }) => normWord(c.text) === normWord(sh.cutOnWord as string));
      w = hit ? hit.i : -1;
    }
    if (w === -1) {
      w = estStarts.findIndex((t0) => t0 >= oldBounds[k] - 0.05);
    }
    const t = w === -1 ? warp(oldBounds[k]) : Math.max(0, realStarts[w] - LEAD);
    // Monotônico.
    newBounds.push(Math.max(t, prev + 0.2));
  }
  newBounds.push(end);

  let k = 0;
  return scenes.map((scene) => {
    const shots = scene.shots.map((shot) => {
      const oldStart = oldBounds[k];
      const newStart = newBounds[k];
      const duration = newBounds[k + 1] - newStart;
      k++;
      return { ...shot, duration, elements: shot.elements.map((el) => warpElement(el, oldStart, newStart, warp)) };
    });
    return { ...scene, shots: enforceMin(shots) };
  });
};

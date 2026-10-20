import type { Caption } from "@remotion/captions";

type TimedNarration = {
  narration: string;
  startSec: number;
  durationSec: number;
};

const LEAD_IN = 0.2;
const TAIL = 0.35;

// Pausa extra (em "letras") depois de pontuação.
const pauseAfter = (word: string): number => {
  if (/[.!?…]["”']?$/.test(word)) {
    return 7;
  }
  if (/[,;:]$/.test(word)) {
    return 4;
  }
  return 0;
};

// Sem áudio/transcrição: distribui as palavras da narração pela duração
// de cada cena, proporcional ao tamanho da palavra.
export const narrationToCaptions = (scenes: TimedNarration[]): Caption[] => {
  const out: Caption[] = [];
  for (const scene of scenes) {
    const words = scene.narration.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      continue;
    }
    const start = scene.startSec + LEAD_IN;
    const span = Math.max(0.3, scene.durationSec - LEAD_IN - TAIL);
    const weights = words.map((w) => w.length + 3);
    const pauses = words.map(pauseAfter);
    const total = weights.reduce((a, b) => a + b, 0) + pauses.slice(0, -1).reduce((a, b) => a + b, 0);
    let t = start;
    words.forEach((w, i) => {
      const dur = (weights[i] / total) * span;
      out.push({
        text: ` ${w}`,
        startMs: Math.round(t * 1000),
        endMs: Math.round((t + dur) * 1000),
        timestampMs: Math.round((t + dur / 2) * 1000),
        confidence: null,
        pageBreakAfter: i === words.length - 1,
      });
      t += dur + (i < words.length - 1 ? (pauses[i] / total) * span : 0);
    });
  }
  return out;
};

export type CaptionPage = {
  startMs: number;
  endMs: number;
  words: Caption[];
};

// Agrupa palavras em "páginas" curtas (estilo TikTok).
export const toPages = (captions: Caption[], { maxWords = 3, maxChars = 18 } = {}): CaptionPage[] => {
  const pages: CaptionPage[] = [];
  let cur: Caption[] = [];
  const flush = () => {
    if (cur.length) {
      pages.push({ startMs: cur[0].startMs, endMs: cur[cur.length - 1].endMs, words: cur });
      cur = [];
    }
  };
  for (const cap of captions) {
    const chars = cur.reduce((n, w) => n + w.text.trim().length + 1, 0) + cap.text.trim().length;
    if (cur.length >= maxWords || (cur.length > 0 && chars > maxChars)) {
      flush();
    }
    cur.push(cap);
    if (cap.pageBreakAfter || /[.!?…,;:]["”']?$/.test(cap.text.trim())) {
      flush();
    }
  }
  flush();
  return pages;
};

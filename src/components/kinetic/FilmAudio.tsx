import type { Caption } from "@remotion/captions";
import React from "react";
import { Audio, Sequence, staticFile } from "remotion";
import type { KScene } from "../../templates/kineticTypes";

// Falas originais do filme no meio da narração (cena com "filmAudio", preparada por
// scripts/film-audio.mjs): o trecho toca em primeiro plano, sem SFX por cima, e entra na
// mesma caixa de legenda com a etiqueta "(do filme)".

const LABEL = "(do filme)";

type Timed = { text: string; at: number; end: number };

const filmScenes = (scenes: KScene[]) => scenes.map((s) => s.filmAudio).filter((f): f is NonNullable<KScene["filmAudio"]> => Boolean(f?.file && f.at !== undefined));

// Janelas (s) em que a fala do filme toca: os SFX ficam fora delas.
export const filmWindows = (scenes: KScene[]): [number, number][] => filmScenes(scenes).map((f) => [(f.at as number) - 0.25, (f.at as number) + (f.duration ?? 0) + 0.15]);

export const inFilmWindow = (windows: [number, number][], sec: number) => windows.some(([a, b]) => sec >= a && sec <= b);

// Palavras de cada linha (com tempo, se veio da transcrição; senão distribuídas pela linha),
// em blocos curtos que começam sempre com "(do filme)".
export const filmCaptions = (scenes: KScene[]): Caption[] => {
  const out: Caption[] = [];
  for (const f of filmScenes(scenes)) {
    for (const line of f.lines ?? []) {
      const at = line.at ?? f.at ?? 0;
      const end = line.end ?? at + 2;
      const base = f.from ?? 0;
      const words: Timed[] = line.words?.length
        ? line.words.map((w) => ({ text: w.text, at: at + (w.from - (line.from ?? base)), end: at + (w.to - (line.from ?? base)) }))
        : line.text.replace(/\|/g, " ").split(/\s+/).filter(Boolean).map((t, i, all) => ({ text: t, at: at + ((end - at) * i) / all.length, end: at + ((end - at) * (i + 1)) / all.length }));
      // Blocos: "|" no texto da linha marca a quebra (ex.: "Um pequeno preço | a se pagar pela
      // salvação."); sem "|", a linha inteira vira um bloco. Cada bloco é uma palavra só na
      // legenda (não quebra no meio) e começa com a etiqueta.
      const parts = line.text.split("|").map((p) => p.trim()).filter(Boolean);
      let k = 0;
      for (const part of parts) {
        const n = part.split(/\s+/).length;
        const ws = words.slice(k, k + n);
        k += n;
        const first = ws[0] ?? { at, end };
        const last = ws[ws.length - 1] ?? first;
        out.push({ text: ` ${LABEL} ${part}`, startMs: Math.round(first.at * 1000), endMs: Math.round(last.end * 1000), timestampMs: Math.round(((first.at + last.end) / 2) * 1000), confidence: 1, pageBreakAfter: true } as Caption);
      }
    }
  }
  return out;
};

export const withFilmCaptions = (captions: Caption[], scenes: KScene[]): Caption[] => {
  const film = filmCaptions(scenes);
  return film.length === 0 ? captions : [...captions, ...film].sort((a, b) => a.startMs - b.startMs);
};

export const FilmAudioTracks: React.FC<{ readonly scenes: KScene[]; readonly fps: number }> = ({ scenes, fps }) => (
  <>
    {filmScenes(scenes).map((f) => (
      <Sequence key={f.file} from={Math.round((f.at as number) * fps)} durationInFrames={Math.ceil(((f.duration ?? 4) + 0.2) * fps)} layout="none" name={`filme ${f.file}`}>
        <Audio src={staticFile(f.file as string)} volume={1} />
      </Sequence>
    ))}
  </>
);

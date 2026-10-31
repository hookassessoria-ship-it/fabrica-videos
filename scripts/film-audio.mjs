// Falas do filme no meio da narração (cenas com "filmAudio", STYLE-GUIDE §19).
//
// Uma cena com "filmAudio": { "src", "from", "to", "cut"?: [[a, b], ...], "words"?: [...] }
// não vai pro TTS: a narração pausa e toca o trecho ORIGINAL do filme (src, de "from" a "to",
// sem as pausas em "cut"). A "narration" da cena é a fala em português (legenda), e "words"
// traz o tempo de cada palavra no arquivo do filme (transcrição), pra legenda acompanhar a fala.
//
// O MP3 final = TTS cortado no silêncio entre as cenas + os trechos do filme, com a mesma
// loudness da voz e fade curto. As legendas do TTS depois de cada trecho andam a duração dele;
// as do filme entram com "film": true (o template mostra "(do filme)" e não põe SFX por cima).
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const FADE = 0.08;

// LUFS integrado de um arquivo (o ffmpeg imprime o JSON do loudnorm no stderr).
export const lufs = (file) => {
  const r = spawnSync("ffmpeg", ["-hide_banner", "-nostdin", "-i", file, "-af", "loudnorm=print_format=json", "-f", "null", "-"], { encoding: "utf8" });
  const m = String(r.stderr ?? "").match(/"input_i"\s*:\s*"(-?[\d.]+)"/);
  return m ? Number(m[1]) : -18;
};

// Trecho do filme sem as pausas de "cut": lista de [início, fim] no arquivo.
export const keptRanges = (fa) => {
  const cuts = [...(fa.cut ?? [])].sort((a, b) => a[0] - b[0]);
  const out = [];
  let t = fa.from;
  for (const [a, b] of cuts) {
    if (a > t) {
      out.push([t, Math.min(a, fa.to)]);
    }
    t = Math.max(t, b);
  }
  if (t < fa.to) {
    out.push([t, fa.to]);
  }
  return out;
};

export const filmDuration = (fa) => keptRanges(fa).reduce((s, [a, b]) => s + (b - a), 0);

// Tempo no arquivo do filme -> tempo dentro do trecho (sem as pausas cortadas).
const filmLocal = (fa, t) => {
  let acc = 0;
  for (const [a, b] of keptRanges(fa)) {
    if (t <= b) {
      return acc + Math.max(0, t - a);
    }
    acc += b - a;
  }
  return acc;
};

// Palavras da legenda do filme (texto da cena) com o tempo da transcrição; se a contagem não
// bater, espalha pelo trecho.
export const filmWordTimes = (scene, tokens) => {
  const fa = scene.filmAudio;
  const dur = filmDuration(fa);
  const src = fa.words ?? [];
  if (src.length === tokens.length && src.length > 0) {
    return tokens.map((text, i) => ({ text, start: filmLocal(fa, src[i].start), end: filmLocal(fa, src[i].end) }));
  }
  const n = tokens.length;
  return tokens.map((text, i) => ({ text, start: (dur * i) / n, end: (dur * (i + 1)) / n - 0.02 }));
};

// Onde cada trecho entra no TTS (no meio do silêncio entre a cena anterior e a seguinte).
// timed: palavras do TTS com "scene" = índice ORIGINAL da cena.
export const insertPoints = (scenes, timed, ttsDuration) =>
  scenes
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => s.filmAudio)
    .map(({ s, i }) => {
      const before = timed.filter((w) => w.scene < i);
      const after = timed.filter((w) => w.scene > i);
      const prevEnd = before.length ? before[before.length - 1].end : null;
      const nextStart = after.length ? after[0].start : null;
      const cut = prevEnd === null ? 0 : nextStart === null ? ttsDuration : (prevEnd + nextStart) / 2;
      return { scene: i, id: s.id, cut, duration: filmDuration(s.filmAudio), from: s.filmAudio.from, to: s.filmAudio.to };
    });

// Palavras finais (TTS deslocado + filme), em ordem de cena.
export const composeWords = (scenes, timed, inserts, tokensOf) => {
  const shift = (t) => t + inserts.filter((p) => p.cut <= t).reduce((s, p) => s + p.duration, 0);
  const out = [];
  scenes.forEach((s, i) => {
    if (s.filmAudio) {
      const p = inserts.find((x) => x.scene === i);
      const at = p.cut + inserts.filter((x) => x.cut < p.cut || (x.cut === p.cut && x.scene < i)).reduce((sum, x) => sum + x.duration, 0);
      for (const w of filmWordTimes(s, tokensOf(s.narration))) {
        out.push({ scene: i, text: w.text, start: at + w.start, end: at + w.end, film: true });
      }
    } else {
      for (const w of timed.filter((x) => x.scene === i)) {
        out.push({ ...w, start: shift(w.start), end: shift(w.end) });
      }
    }
  });
  return out;
};

// Monta o MP3: TTS em fatias + trechos do filme (loudness da voz, fade de 80 ms).
export const composeAudio = ({ ttsFile, outFile, scenes, inserts, root }) => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "film-"));
  const target = lufs(ttsFile);
  const pieces = [];
  let t = 0;
  const sorted = [...inserts].sort((a, b) => a.cut - b.cut || a.scene - b.scene);
  sorted.forEach((p, k) => {
    if (p.cut > t + 0.001) {
      const f = path.join(dir, `tts-${k}.wav`);
      execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", ttsFile, "-af", `atrim=${t}:${p.cut},asetpts=PTS-STARTPTS`, "-ac", "1", "-ar", "44100", f]);
      pieces.push(f);
      t = p.cut;
    }
    const fa = scenes[p.scene].filmAudio;
    const src = path.join(root, "public", fa.src);
    const ranges = keptRanges(fa);
    const parts = ranges.map(([a, b], j) => `[0:a]atrim=${a}:${b},asetpts=PTS-STARTPTS,afade=t=in:d=${FADE},afade=t=out:st=${Math.max(0, b - a - FADE)}:d=${FADE}[p${j}]`);
    const concat = `${ranges.map((_, j) => `[p${j}]`).join("")}concat=n=${ranges.length}:v=0:a=1,pan=mono|c0=0.5*c0+0.5*c1,loudnorm=I=${target}:TP=-1.5:LRA=11[out]`;
    const raw = path.join(dir, `film-${k}.wav`);
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", src, "-filter_complex", `${parts.join(";")};${concat}`, "-map", "[out]", "-ar", "44100", raw]);
    // o loudnorm pode mudar um pouco a duração: acerta pro tamanho exato do trecho
    const f = path.join(dir, `filmx-${k}.wav`);
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", raw, "-af", `apad,atrim=0:${p.duration}`, "-ar", "44100", "-ac", "1", f]);
    pieces.push(f);
  });
  const rest = path.join(dir, "tts-end.wav");
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", ttsFile, "-af", `atrim=${t},asetpts=PTS-STARTPTS`, "-ac", "1", "-ar", "44100", rest]);
  pieces.push(rest);
  const inputs = pieces.flatMap((f) => ["-i", f]);
  const filter = `${pieces.map((_, i) => `[${i}:a]`).join("")}concat=n=${pieces.length}:v=0:a=1[a]`;
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...inputs, "-filter_complex", filter, "-map", "[a]", "-c:a", "libmp3lame", "-b:a", "192k", outFile]);
  rmSync(dir, { recursive: true, force: true });
};

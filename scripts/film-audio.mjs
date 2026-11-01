// Falas do filme no meio da narração ("filmAudio" por cena).
//
//   node scripts/film-audio.mjs <id>     reaplica sem gastar créditos (o voice:generate já chama sozinho)
//
// Uma cena com "filmAudio": { "src", "from", "to", "lines": [{ "text", "from", "to" }] } não tem
// narração: a fala original do filme toca em primeiro plano e a narração pausa. Este passo:
//   1. guarda a narração crua em public/audio/<id>-voice.mp3 e abre nela um silêncio do tamanho
//      da fala (+ respiro), no ponto da cena; o resultado vira public/audio/<id>.mp3;
//   2. empurra as legendas seguintes pelo mesmo tempo (videos/<id>-captions.json);
//   3. extrai o trecho do filme normalizado em -16 LUFS (public/audio/<id>-film-<n>.mp3);
//   4. grava na cena "at" (segundo do vídeo em que a fala começa), "duration", "file" e o tempo
//      de cada linha, que o template usa pra tocar, legendar "(do filme)" e calar os SFX.
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const PAD = 0.3;
const words = (s) => s.split(/\s+/).filter(Boolean).length;
const dur = (file) => Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file]).toString().trim());

export const applyFilmAudio = (root, id) => {
  const videoFile = path.join(root, "videos", `${id}.json`);
  const video = JSON.parse(readFileSync(videoFile, "utf8"));
  const films = video.scenes.map((s, i) => ({ s, i })).filter(({ s }) => s.filmAudio);
  if (films.length === 0 || !video.captions) {
    return false;
  }
  const pub = (rel) => path.join(root, "public", rel);
  const audio = pub(`audio/${id}.mp3`);
  const raw = pub(`audio/${id}-voice.mp3`);
  if (!existsSync(raw)) {
    copyFileSync(audio, raw);
  }
  const capFile = path.join(root, "videos", video.captions);
  const align = JSON.parse(readFileSync(path.join(root, "videos", `${id}-alignment.json`), "utf8"));
  // Legendas cruas (do alinhamento salvo), pra poder reaplicar quantas vezes precisar.
  let caps = align.words.map((w, i) => ({
    text: i === 0 ? w.text : ` ${w.text}`,
    startMs: Math.round(w.start * 1000),
    endMs: Math.round(Math.max(w.end, w.start + 0.05) * 1000),
    timestampMs: Math.round(((w.start + w.end) / 2) * 1000),
    confidence: 1,
  }));
  const first = [];
  let acc = 0;
  video.scenes.forEach((s) => {
    first.push(acc);
    acc += words(s.narration);
  });

  // Pontos de corte na narração crua e quanto silêncio entra em cada um.
  const cuts = [];
  films.forEach(({ s, i }, n) => {
    const fa = s.filmAudio;
    const len = fa.to - fa.from;
    const before = first[i] - 1;
    const t = before >= 0 ? align.words[before].end + 0.15 : 0;
    cuts.push({ t, gap: len + 2 * PAD, scene: i, n, len });
  });
  // Áudio: trechos da narração intercalados com silêncio.
  const sr = 44100;
  const n = cuts.length + 1;
  const filters = [`[0:a]aresample=${sr},aformat=channel_layouts=mono,asplit=${n}${Array.from({ length: n }, (_, k) => `[in${k}]`).join("")}`];
  const parts = [];
  let prev = 0;
  cuts.forEach((c, k) => {
    filters.push(`anullsrc=r=${sr}:cl=mono,atrim=0:${c.gap.toFixed(3)}[s${k}]`);
    // Fala do filme logo no começo: não há narração antes do silêncio.
    if (c.t - prev > 0.01) {
      filters.push(`[in${k}]atrim=${prev}:${c.t},asetpts=PTS-STARTPTS[v${k}]`);
      parts.push(`[v${k}]`);
    } else {
      filters.push(`[in${k}]anullsink`);
    }
    parts.push(`[s${k}]`);
    prev = c.t;
  });
  filters.push(`[in${cuts.length}]atrim=${prev},asetpts=PTS-STARTPTS[vend]`);
  parts.push("[vend]");
  filters.push(`${parts.join("")}concat=n=${parts.length}:v=0:a=1[out]`);
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", raw, "-filter_complex", filters.join(";"), "-map", "[out]", "-b:a", "192k", audio]);

  // Legendas e cenas.
  let shift = 0;
  cuts.forEach((c) => {
    const fa = video.scenes[c.scene].filmAudio;
    const at = c.t + shift + PAD;
    const file = `audio/${id}-film-${c.n + 1}.mp3`;
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-ss", String(fa.from), "-to", String(fa.to), "-i", pub(fa.src), "-vn", "-af", "loudnorm=I=-16:TP=-1.5:LRA=11", "-ar", "48000", "-b:a", "192k", pub(file)]);
    video.scenes[c.scene].filmAudio = {
      ...fa,
      at: Number(at.toFixed(3)),
      duration: Number(dur(pub(file)).toFixed(3)),
      file,
      lines: fa.lines.map((l) => ({ ...l, at: Number((at + l.from - fa.from).toFixed(3)), end: Number((at + l.to - fa.from).toFixed(3)) })),
    };
    const tMs = (c.t + shift) * 1000;
    const gapMs = Math.round(c.gap * 1000);
    caps = caps.map((w) => (w.startMs >= tMs ? { ...w, startMs: w.startMs + gapMs, endMs: w.endMs + gapMs, timestampMs: w.timestampMs + gapMs } : w));
    shift += c.gap;
  });
  writeFileSync(capFile, `${JSON.stringify(caps, null, 1)}\n`);
  writeFileSync(videoFile, `${JSON.stringify(video, null, 2)}\n`);
  console.log(`✓ falas do filme: ${cuts.map((c) => `cena ${c.scene + 1} (${c.len.toFixed(1)}s)`).join(", ")} · narração com pausas em audio/${id}.mp3`);
  return true;
};

if (import.meta.url === `file://${process.argv[1]}`) {
  const id = process.argv[2];
  applyFilmAudio(path.resolve(import.meta.dirname, ".."), id);
}

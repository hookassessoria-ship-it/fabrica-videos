// Biblioteca de efeitos sonoros com a ElevenLabs (sound generation).
//
//   npm run sfx:generate            gera o que faltar em public/sfx/
//   npm run sfx:generate -- --all   gera tudo de novo
//   npm run sfx:generate -- --pad   só completa com silêncio os arquivos que já existem
//
// Cada efeito sai em 2–3 variações (public/sfx/<tipo>-<n>.mp3), com silêncio aparado nas
// pontas, fade curto no fim e pico normalizado. public/sfx/manifest.json lista as variações;
// o template usa isso pra pôr som em transições, ícones, números, ransom, digitação e
// pattern interrupts automaticamente (variando pra não repetir o mesmo som seguido).
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const dir = path.join(root, "public/sfx");
const KEY = process.env.ELEVENLABS_API_KEY;
const PAD_SECONDS = 2.2;

export const LIBRARY = {
  whoosh: { n: 3, seconds: 0.6, prompt: "short clean UI whoosh, fast air swoosh, modern motion graphics, no reverb" },
  "whoosh-long": { n: 2, seconds: 1.3, prompt: "smooth cinematic whoosh sweep passing by, clean, modern motion graphics, no reverb" },
  pop: { n: 3, seconds: 0.5, prompt: "short soft bubbly UI pop, clean digital pop, no reverb" },
  hit: { n: 3, seconds: 0.9, prompt: "short punchy impact hit, deep thump with a crisp snap, modern motion graphics, no reverb" },
  click: { n: 3, seconds: 0.5, prompt: "single crisp mechanical keyboard key click, dry, close mic, no reverb" },
  riser: { n: 2, seconds: 1.5, prompt: "short tension riser building up quickly, clean synth swell, ends abruptly, no reverb" },
  glitch: { n: 2, seconds: 0.6, prompt: "short digital glitch stutter, data corruption blip, clean, no reverb" },
  paper: { n: 2, seconds: 0.7, prompt: "quick paper cutout slapped on a table with a small paper rustle, dry, close mic" },
  swipe: { n: 3, seconds: 0.5, prompt: "quick UI swipe swish, short, clean, no reverb" },
};

const ffmpeg = (...args) => execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...args], { stdio: ["ignore", "pipe", "pipe"] }).toString();

const durationOf = (file) => Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file]).toString().trim()) || 0;
const peakOf = (file) => Number(execFileSync("sh", ["-c", `ffmpeg -i "${file}" -af volumedetect -f null - 2>&1 | grep max_volume || true`]).toString().match(/max_volume: (-?[\d.]+) dB/)?.[1] ?? 0);

// Normaliza o pico em -1 dBFS, corta o silêncio das pontas (sem deixar o som curto demais)
// e faz um fade de 30ms no fim.
const polish = (input, output) => {
  const norm = `${output}.norm.wav`;
  const cut = `${output}.cut.wav`;
  ffmpeg("-i", input, "-af", `volume=${(-1 - peakOf(input)).toFixed(2)}dB`, "-ac", "2", "-ar", "44100", norm);
  ffmpeg("-i", norm, "-af", "silenceremove=start_periods=1:start_threshold=-42dB,areverse,silenceremove=start_periods=1:start_threshold=-48dB,areverse", cut);
  const src = durationOf(cut) >= 0.15 ? cut : norm;
  const dur = durationOf(src);
  // Completa com silêncio até PAD_SECONDS: o template toca cada efeito numa janela fixa
  // de 2s, e o arquivo nunca pode acabar antes dela (o extrator de áudio trava).
  ffmpeg("-i", src, "-af", `afade=t=out:st=${Math.max(0, dur - 0.03).toFixed(3)}:d=0.03,apad=whole_dur=${PAD_SECONDS}`, "-b:a", "192k", output);
  rmSync(norm);
  rmSync(cut);
  return dur;
};

const generate = async (prompt, seconds) => {
  const res = await fetch("https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_128", {
    method: "POST",
    headers: { "xi-api-key": KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ text: prompt, duration_seconds: Math.max(0.5, seconds), prompt_influence: 0.6 }),
  });
  if (!res.ok) {
    throw new Error(`sound-generation: ${res.status} ${await res.text()}`);
  }
  return Buffer.from(await res.arrayBuffer());
};

if (!KEY) {
  console.error("Falta ELEVENLABS_API_KEY no .env");
  process.exit(1);
}
const all = process.argv.includes("--all");
if (process.argv.includes("--pad")) {
  for (const [kind, spec] of Object.entries(LIBRARY)) {
    for (let i = 1; i <= spec.n; i++) {
      const out = path.join(dir, `${kind}-${i}.mp3`);
      if (existsSync(out) && durationOf(out) < PAD_SECONDS - 0.05) {
        const tmp = `${out}.pad.mp3`;
        ffmpeg("-i", out, "-af", `apad=whole_dur=${PAD_SECONDS}`, "-b:a", "192k", tmp);
        renameSync(tmp, out);
      }
    }
  }
  console.log(`✓ efeitos completados até ${PAD_SECONDS}s`);
  process.exit(0);
}
mkdirSync(dir, { recursive: true });
const manifest = {};
for (const [kind, spec] of Object.entries(LIBRARY)) {
  manifest[kind] = [];
  for (let i = 1; i <= spec.n; i++) {
    const rel = `sfx/${kind}-${i}.mp3`;
    const out = path.join(root, "public", rel);
    if (all || !existsSync(out)) {
      const raw = path.join(os.tmpdir(), `sfx-${kind}-${i}.mp3`);
      writeFileSync(raw, await generate(spec.prompt, spec.seconds));
      const dur = polish(raw, out);
      rmSync(raw);
      console.log(`  ✓ ${rel} (${dur.toFixed(2)}s)`);
    }
    manifest[kind].push(rel);
  }
}
writeFileSync(path.join(dir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
console.log("✓ public/sfx/manifest.json");

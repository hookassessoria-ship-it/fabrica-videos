// Renderiza um vídeo de /videos pelo id (nome do arquivo JSON).
//
//   npm run render:video -- <id>         final 1080x1920: out/<id>-1080.mp4
//   npm run render:video -- <id> --4k    final 4K (2160x3840, scale 2): out/<id>-4k.mp4
//   npm run preview:fast -- <id>         rápido: out/preview/<id>-fast.mp4 (metade da escala)
//
// Finais: H.264 CRF 16, AAC 320 kbps, e o áudio do master normalizado em -14 LUFS
// (pico -1,5 dBTP), o padrão de TikTok/Reels — a mixagem relativa não muda.
// Antes de renderizar, roda a revisão automática (scripts/check-numbers.mjs: números em
// todos os quadros + sobreposição de textos grandes); se falhar, para. --skip-check pula.
// Usa todos os núcleos. Se REMOTION_BROWSER_EXECUTABLE estiver no .env, usa esse Chrome.
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync, renameSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { runChecks } from "./check-numbers.mjs";

const root = path.resolve(import.meta.dirname, "..");
const args = process.argv.slice(2);
const fast = args.includes("--fast");
const uhd = args.includes("--4k");
const id = args.find((a) => !a.startsWith("--"));

if (!id) {
  console.error(`Uso: npm run ${fast ? "preview:fast" : "render:video"} -- <id> [--4k]  (um arquivo de /videos, sem .json)`);
  process.exit(1);
}
const file = path.join(root, "videos", `${id}.json`);
if (!existsSync(file)) {
  console.error(`Não achei videos/${id}.json`);
  process.exit(1);
}
const video = JSON.parse(readFileSync(file, "utf8"));
const out = fast ? `out/preview/${id}-fast.mp4` : uhd ? `out/${id}-4k.mp4` : `out/${id}-1080.mp4`;
const extra = args.filter((a) => a.startsWith("--") && !["--fast", "--skip-check", "--4k"].includes(a));

if (!args.includes("--skip-check") && !(await runChecks(id))) {
  console.error("Render cancelado: corrija os itens acima (ou use --skip-check).");
  process.exit(1);
}

const quality = fast
  ? ["--scale=0.5", "--crf=32", "--x264-preset=veryfast"]
  : ["--crf=16", "--x264-preset=medium", "--jpeg-quality=95", "--audio-codec=aac", "--audio-bitrate=320k", ...(uhd ? ["--scale=2", "--timeout=120000"] : [])];

const cmd = [
  "remotion",
  "render",
  video.composition,
  out,
  "--codec=h264",
  `--concurrency=${os.cpus().length}`,
  ...quality,
  ...(process.env.REMOTION_BROWSER_EXECUTABLE ? [`--browser-executable=${process.env.REMOTION_BROWSER_EXECUTABLE}`] : []),
  ...extra,
];
console.log(`> npx ${cmd.join(" ")}`);
const t0 = Date.now();
const res = spawnSync("npx", cmd, { cwd: root, stdio: "inherit" });
if (res.status !== 0) {
  process.exit(res.status ?? 1);
}

// Loudness do master em duas passadas (mede, depois aplica), vídeo copiado sem recodificar.
if (!fast) {
  const abs = path.join(root, out);
  const measure = spawnSync("ffmpeg", ["-hide_banner", "-i", abs, "-af", "loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-"], { encoding: "utf8" });
  const m = JSON.parse(measure.stderr.slice(measure.stderr.lastIndexOf("{"), measure.stderr.lastIndexOf("}") + 1));
  const tmp = abs.replace(/\.mp4$/, ".loud.mp4");
  const filter = `loudnorm=I=-14:TP=-1.5:LRA=11:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`;
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", abs, "-c:v", "copy", "-af", filter, "-ar", "48000", "-c:a", "aac", "-b:a", "320k", "-movflags", "+faststart", tmp]);
  renameSync(tmp, abs);
  console.log(`áudio: ${Number(m.input_i).toFixed(1)} LUFS -> -14 LUFS`);
}
console.log(`pronto em ${((Date.now() - t0) / 1000).toFixed(0)}s: ${out}`);

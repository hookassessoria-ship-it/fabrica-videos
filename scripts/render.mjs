// Renderiza um vídeo de /videos pelo id (nome do arquivo JSON).
//
//   npm run render:video -- <id>    final: out/<id>.mp4 (H.264, 1080x1920, 30fps)
//   npm run preview:fast -- <id>    rápido: out/preview/<id>-fast.mp4 (metade da escala, CRF alto)
//
// Antes de renderizar, roda a checagem de números (scripts/check-numbers.mjs); se algum
// número na tela não bater com o JSON, para. --skip-check pula a checagem.
// Usa todos os núcleos. Se REMOTION_BROWSER_EXECUTABLE estiver no .env, usa esse Chrome.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { checkNumbers } from "./check-numbers.mjs";

const root = path.resolve(import.meta.dirname, "..");
const args = process.argv.slice(2);
const fast = args.includes("--fast");
const id = args.find((a) => !a.startsWith("--"));

if (!id) {
  console.error(`Uso: npm run ${fast ? "preview:fast" : "render:video"} -- <id>  (um arquivo de /videos, sem .json)`);
  process.exit(1);
}
const file = path.join(root, "videos", `${id}.json`);
if (!existsSync(file)) {
  console.error(`Não achei videos/${id}.json`);
  process.exit(1);
}
const video = JSON.parse(readFileSync(file, "utf8"));
const out = fast ? `out/preview/${id}-fast.mp4` : `out/${id}.mp4`;
const extra = args.filter((a) => a.startsWith("--") && a !== "--fast" && a !== "--skip-check");

if (!args.includes("--skip-check") && !(await checkNumbers(id))) {
  console.error("Render cancelado: corrija os números acima (ou use --skip-check).");
  process.exit(1);
}

const cmd = [
  "remotion",
  "render",
  video.composition,
  out,
  "--codec=h264",
  `--concurrency=${os.cpus().length}`,
  ...(fast ? ["--scale=0.5", "--crf=32", "--x264-preset=veryfast"] : ["--crf=18"]),
  ...(process.env.REMOTION_BROWSER_EXECUTABLE ? [`--browser-executable=${process.env.REMOTION_BROWSER_EXECUTABLE}`] : []),
  ...extra,
];
console.log(`> npx ${cmd.join(" ")}`);
const t0 = Date.now();
const res = spawnSync("npx", cmd, { cwd: root, stdio: "inherit" });
if (res.status === 0) {
  console.log(`pronto em ${((Date.now() - t0) / 1000).toFixed(0)}s: ${out}`);
}
process.exit(res.status ?? 1);

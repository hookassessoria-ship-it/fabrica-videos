// Quadros soltos pra revisar um vídeo (sem renderizar tudo):
//   npm run stills -- <CompositionId> <pasta> <quadro> [quadro...]
// Salva <pasta>/<CompositionId>-<quadro>.png.
import { bundle } from "@remotion/bundler";
import { openBrowser, renderStill, selectComposition } from "@remotion/renderer";
import path from "node:path";
const [id, outDir, ...frames] = process.argv.slice(2);
if (!id || !outDir || frames.length === 0) {
  console.error("Uso: npm run stills -- <CompositionId> <pasta> <quadro> [quadro...]");
  process.exit(1);
}
const root = path.resolve(import.meta.dirname, "..");
const serveUrl = await bundle({ entryPoint: path.join(root, "src/index.ts"), rspack: true });
const browser = await openBrowser("chrome", { browserExecutable: process.env.REMOTION_BROWSER_EXECUTABLE ?? null, logLevel: "error" });
const composition = await selectComposition({ serveUrl, id, puppeteerInstance: browser, logLevel: "error" });
for (const f of frames) {
  await renderStill({ composition, serveUrl, frame: Number(f), output: path.join(outDir, `${id}-${String(f).padStart(5, "0")}.png`), puppeteerInstance: browser, logLevel: "error", timeoutInMilliseconds: 120000 });
  process.stdout.write(`${f} `);
}
await browser.close({ silent: true });

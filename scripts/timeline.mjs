// Mostra a linha do tempo real de um vídeo (shots já reajustados pela narração).
//
//   npm run timeline -- <id>
import { bundle } from "@remotion/bundler";
import { openBrowser, selectComposition } from "@remotion/renderer";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const id = process.argv[2];
const video = JSON.parse(readFileSync(path.join(root, "videos", `${id}.json`), "utf8"));
const serveUrl = await bundle({ entryPoint: path.join(root, "src/index.ts"), rspack: true });
const browser = await openBrowser("chrome", { browserExecutable: process.env.REMOTION_BROWSER_EXECUTABLE ?? null, logLevel: "error" });
const c = await selectComposition({ serveUrl, id: video.composition, puppeteerInstance: browser, logLevel: "error" });
let t = 0;
for (const sc of c.props.scenes) {
  for (const sh of sc.shots) {
    const ats = sh.elements.map((e) => e.at).filter((a) => a !== undefined && a >= 0);
    const words = sh.elements.filter((e) => e.enterOnWord).map((e) => e.enterOnWord);
    console.log(
      `${sh.id.padEnd(5)} ${t.toFixed(2).padStart(6)}s  ${sh.duration.toFixed(2)}s  última entrada (at): ${ats.length ? Math.max(...ats).toFixed(2) : "-"}${words.length ? `  palavras: ${words.join(", ")}` : ""}`,
    );
    t += sh.duration;
  }
}
console.log(`total ${t.toFixed(2)}s (${c.durationInFrames} quadros)`);
await browser.close({ silent: true });

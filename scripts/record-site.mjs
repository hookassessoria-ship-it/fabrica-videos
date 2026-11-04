// Grava uma página local quadro a quadro em 1080×1920 (sem barra de navegador): a cada
// quadro, as animações CSS vão pro tempo exato e a rolagem segue a linha do tempo.
//
//   node scripts/record-site.mjs <arquivo.html> <saida.mp4> <segundos> '<[[t, y], ...]>'
//
// A rolagem interpola entre os pontos [segundo, pixel] com easing suave.
import { createRequire } from "node:module";
import { execSync } from "node:child_process";
// Playwright vem instalado globalmente (com o Chromium) na máquina.
const { chromium } = createRequire(execSync("npm root -g").toString().trim() + "/")("playwright");
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import path from "node:path";

const [file, out, secs, keysJson] = process.argv.slice(2);
const keys = JSON.parse(keysJson ?? "[[0,0]]");
const FPS = 30;
const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2);
const scrollAt = (t) => {
  let y = keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [t0, y0] = keys[i - 1];
    const [t1, y1] = keys[i];
    if (t >= t1) y = y1;
    else if (t > t0) return y0 + (y1 - y0) * ease((t - t0) / (t1 - t0));
  }
  return y;
};
const dir = `${out}.frames`;
rmSync(dir, { recursive: true, force: true });
mkdirSync(dir, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 432, height: 768 }, deviceScaleFactor: 2.5 });
await page.goto(`file://${path.resolve(file)}`);
await page.evaluate(() => document.fonts.ready);
await page.addStyleTag({ content: "html { scroll-behavior: auto !important; }" });
const n = Math.round(Number(secs) * FPS);
for (let f = 0; f < n; f++) {
  const t = f / FPS;
  await page.evaluate(({ t, y }) => {
    for (const a of document.getAnimations()) {
      a.pause();
      a.currentTime = t * 1000;
    }
    window.scrollTo(0, y);
  }, { t, y: scrollAt(t) });
  await page.screenshot({ path: `${dir}/${String(f).padStart(4, "0")}.png` });
}
await browser.close();
execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", String(FPS), "-i", `${dir}/%04d.png`, "-c:v", "libx264", "-crf", "16", "-pix_fmt", "yuv420p", out]);
rmSync(dir, { recursive: true, force: true });
console.log(`✓ ${out} (${n} quadros)`);

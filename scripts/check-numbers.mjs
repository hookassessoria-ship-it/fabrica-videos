// Checagem de números: em cada shot com número (number, bars, line), renderiza quadros
// do último terço do shot, lê o texto que de fato aparece na tela e compara com o JSON.
// Qualquer diferença (contagem que não terminou, valor errado, número sumido) falha.
//
//   npm run check:numbers -- <id>
//
// O preview:fast e o render:video rodam isto antes de renderizar.
import { bundle } from "@remotion/bundler";
import { openBrowser, renderStill, selectComposition } from "@remotion/renderer";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const FPS = 30;

const decimalsOf = (v) => (Number.isInteger(v) ? 0 : (String(v).split(".")[1]?.length ?? 1));

// "1.234,56%" -> 1234.56
const parseBR = (text) => {
  const m = text.replace(/\s/g, "").match(/-?[\d.]+(,\d+)?/);
  return m ? Number(m[0].replace(/\./g, "").replace(",", ".")) : NaN;
};

// O que cada elemento numérico precisa mostrar, por índice do item.
const expectedOf = (el) => {
  if (el.type === "number") {
    return [{ i: 0, value: el.value, decimals: el.decimals ?? decimalsOf(el.value) }];
  }
  if (el.type === "bars") {
    return el.data.map((d, i) => ({ i, value: d.value, decimals: decimalsOf(d.value), display: d.display, label: d.label }));
  }
  if (el.type === "line") {
    return el.points.map((v, i) => ({ i, value: v, decimals: decimalsOf(v), label: el.labels?.[i] }));
  }
  return null;
};

export const checkNumbers = async (id) => {
  const file = path.join(root, "videos", `${id}.json`);
  const video = JSON.parse(readFileSync(file, "utf8"));
  if (video.template && video.template !== "KineticExplainer") {
    console.log("checagem de números: só vale pro KineticExplainer, pulando");
    return true;
  }

  // Linha do tempo dos shots (mesma conta do template).
  const targets = [];
  let acc = 0;
  for (const scene of video.scenes) {
    for (const shot of scene.shots) {
      const start = Math.round(acc * FPS);
      acc += shot.duration;
      const frames = Math.round(acc * FPS) - start;
      const numeric = shot.elements
        .map((el, index) => ({ el, index, expected: expectedOf(el) }))
        .filter((n) => n.expected && !(n.el.exitAt !== undefined && n.el.exitAt < (shot.duration * 2) / 3));
      if (numeric.length > 0) {
        const checkFrames = [...new Set([Math.ceil((frames * 2) / 3), Math.round((frames * 5) / 6), frames - 1])].map((k) => start + k);
        targets.push({ shot, numeric, checkFrames });
      }
    }
  }
  if (targets.length === 0) {
    console.log("checagem de números: nenhum número no vídeo");
    return true;
  }

  const t0 = Date.now();
  const serveUrl = await bundle({ entryPoint: path.join(root, "src/index.ts"), rspack: true });
  const inputProps = { numberCheck: true };
  const logLevel = "error";
  const browser = await openBrowser("chrome", { browserExecutable: process.env.REMOTION_BROWSER_EXECUTABLE ?? null, logLevel });
  const composition = await selectComposition({ serveUrl, id: video.composition, inputProps, puppeteerInstance: browser, logLevel });
  const tmp = mkdtempSync(path.join(os.tmpdir(), "numcheck-"));

  // frame global -> registros do probe
  const logs = new Map();
  const jobs = targets.flatMap((t) => t.checkFrames.map((frame) => ({ t, frame })));
  const queue = [...jobs];
  const worker = async () => {
    while (queue.length > 0) {
      const { t, frame } = queue.shift();
      await renderStill({
        composition,
        serveUrl,
        frame,
        output: path.join(tmp, `${frame}.png`),
        inputProps,
        scale: 0.2,
        puppeteerInstance: browser,
        logLevel,
        onBrowserLog: (log) => {
          if (!log.text.startsWith("NUMCHECK ")) {
            return;
          }
          const rec = JSON.parse(log.text.slice(9));
          if (rec.shot === t.shot.id) {
            logs.set(`${t.shot.id}@${frame}`, rec.items);
          }
        },
      });
    }
  };
  await Promise.all(Array.from({ length: Math.min(4, os.cpus().length) }, worker));
  await browser.close({ silent: true });
  rmSync(tmp, { recursive: true, force: true });

  const errors = [];
  for (const t of targets) {
    for (const n of t.numeric) {
      const seen = t.checkFrames.map((frame) => ({ frame, items: (logs.get(`${t.shot.id}@${frame}`) ?? []).filter((it) => it.el === n.index) }));
      for (const exp of n.expected) {
        const name = `${t.shot.id} · ${n.el.type}${exp.label ? ` ${exp.label}` : ""}`;
        const want = exp.display ?? `${exp.value.toFixed(exp.decimals).replace(".", ",")}`;
        const shown = seen.map((s) => ({ frame: s.frame, item: s.items.find((it) => it.i === exp.i) }));
        if (shown.every((s) => !s.item)) {
          errors.push(`${name}: não aparece na tela no último terço do shot (esperado ${want})`);
          continue;
        }
        for (const s of shown) {
          if (!s.item) {
            continue;
          }
          const ok = exp.display ? s.item.text.trim() === exp.display : Math.abs(parseBR(s.item.text) - Number(exp.value.toFixed(exp.decimals))) < 1e-9;
          if (!ok) {
            errors.push(`${name}: quadro ${s.frame} mostra "${s.item.text}", esperado ${want}`);
          }
        }
      }
    }
  }

  const total = targets.reduce((s, t) => s + t.numeric.reduce((a, n) => a + n.expected.length, 0), 0);
  if (errors.length > 0) {
    console.error(`\n✗ checagem de números falhou (${errors.length}):`);
    errors.forEach((e) => console.error(`  - ${e}`));
    return false;
  }
  console.log(`✓ checagem de números: ${total} valores em ${targets.length} shots batem com o JSON (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
  return true;
};

if (import.meta.url === `file://${process.argv[1]}`) {
  const id = process.argv.slice(2).find((a) => !a.startsWith("--"));
  if (!id || !existsSync(path.join(root, "videos", `${id}.json`))) {
    console.error("Uso: npm run check:numbers -- <id>  (um arquivo de /videos, sem .json)");
    process.exit(1);
  }
  const ok = await checkNumbers(id);
  process.exit(ok ? 0 : 1);
}

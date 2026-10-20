// Revisão automática de um vídeo KineticExplainer, quadro a quadro (todos os quadros):
//
//  - números: todo número na tela (number, bars, line) tem que ser 0, o valor do JSON,
//    ou estar na contagem do número herói (BigNumber). Valor intermediário falha.
//  - sobreposição: dois textos grandes (títulos, ransom, recortes, número herói, palavra
//    com foto) nunca ocupam a mesma área ao mesmo tempo, transições incluídas.
//
//   npm run check:numbers -- <id>     só números
//   npm run check:overlap -- <id>     só sobreposição
//   npm run check -- <id>             os dois
//
// O preview:fast e o render:video rodam os dois antes de renderizar.
import { bundle } from "@remotion/bundler";
import { openBrowser, renderFrames, selectComposition } from "@remotion/renderer";
import { existsSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");

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

// Sobreposição: fração da área do menor texto coberta pelo outro.
const overlapRatio = (a, b) => {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  if (w <= 0 || h <= 0) {
    return 0;
  }
  return (w * h) / Math.min(a.w * a.h, b.w * b.h);
};
const OVERLAP_MAX = 0.12;
const VISIBLE = 0.3;
const onScreen = (t) => t.w > 4 && t.h > 4 && t.x < 1080 && t.y < 1920 && t.x + t.w > 0 && t.y + t.h > 0;

// Agrupa quadros seguidos em intervalos ("12,3s–12,8s").
const ranges = (frames, fps) => {
  const sorted = [...new Set(frames)].sort((a, b) => a - b);
  const out = [];
  for (const f of sorted) {
    const last = out[out.length - 1];
    if (last && f - last[1] <= 1) {
      last[1] = f;
    } else {
      out.push([f, f]);
    }
  }
  const s = (f) => `${(f / fps).toFixed(2).replace(".", ",")}s`;
  return out.map(([a, b]) => (a === b ? s(a) : `${s(a)}–${s(b)}`)).join(", ");
};

export const runChecks = async (id, { numbers = true, overlap = true } = {}) => {
  const file = path.join(root, "videos", `${id}.json`);
  const video = JSON.parse(readFileSync(file, "utf8"));
  if (video.template && video.template !== "KineticExplainer") {
    console.log("revisão automática: só vale pro KineticExplainer, pulando");
    return true;
  }

  const t0 = Date.now();
  const logLevel = "error";
  const serveUrl = await bundle({ entryPoint: path.join(root, "src/index.ts"), rspack: true });
  const inputProps = { numberCheck: true };
  const browser = await openBrowser("chrome", { browserExecutable: process.env.REMOTION_BROWSER_EXECUTABLE ?? null, logLevel });
  const composition = await selectComposition({ serveUrl, id: video.composition, inputProps, puppeteerInstance: browser, logLevel });
  const { fps } = composition;

  // Linha do tempo real (cenas já reajustadas pela narração, vindas do calculateMetadata).
  const scenes = composition.props.scenes ?? video.scenes;
  const shots = new Map();
  let acc = 0;
  for (const scene of scenes) {
    for (const shot of scene.shots) {
      const start = Math.round(acc * fps);
      acc += shot.duration;
      shots.set(shot.id, { shot, start, frames: Math.round(acc * fps) - start });
    }
  }

  // Todos os quadros, sem screenshot: só monta a página e coleta o registro do probe.
  const records = [];
  await renderFrames({
    composition,
    serveUrl,
    inputProps,
    imageFormat: "none",
    outputDir: null,
    concurrency: os.cpus().length,
    puppeteerInstance: browser,
    logLevel,
    onStart: () => undefined,
    onFrameUpdate: () => undefined,
    onBrowserLog: (log) => {
      if (log.text.startsWith("NUMCHECK ")) {
        records.push(JSON.parse(log.text.slice(9)));
      }
    },
  });
  await browser.close({ silent: true });

  const errors = [];

  if (numbers) {
    const bad = new Map();
    const seenLate = new Set();
    let total = 0;
    for (const rec of records) {
      const info = shots.get(rec.shot);
      if (!info) {
        continue;
      }
      for (const it of rec.items) {
        const el = info.shot.elements[it.el];
        const exp = el && expectedOf(el)?.find((e) => e.i === it.i);
        if (!exp) {
          continue;
        }
        total++;
        const local = rec.frame - info.start;
        if (local >= Math.ceil((info.frames * 2) / 3)) {
          seenLate.add(`${rec.shot}/${it.el}/${it.i}`);
        }
        const parsed = parseBR(it.text);
        const ok =
          (it.counting && el.type === "number") ||
          parsed === 0 ||
          (exp.display ? it.text.trim() === exp.display : Math.abs(parsed - Number(exp.value.toFixed(exp.decimals))) < 1e-9);
        if (!ok) {
          const key = `${rec.shot} · ${el.type}${exp.label ? ` ${exp.label}` : ""}: mostra "${it.text}", esperado ${exp.display ?? exp.value.toFixed(exp.decimals).replace(".", ",")}`;
          bad.set(key, [...(bad.get(key) ?? []), rec.frame]);
        }
      }
    }
    for (const [msg, frames] of bad) {
      errors.push(`número ${msg} (${ranges(frames, fps)})`);
    }
    // Todo número tem que estar na tela no último terço do shot.
    for (const { shot, frames } of shots.values()) {
      shot.elements.forEach((el, index) => {
        if (el.exitAt !== undefined && el.exitAt < (shot.duration * 2) / 3) {
          return;
        }
        (expectedOf(el) ?? []).forEach((exp) => {
          if (frames > 0 && !seenLate.has(`${shot.id}/${index}/${exp.i}`)) {
            errors.push(`número ${shot.id} · ${el.type}${exp.label ? ` ${exp.label}` : ""}: não aparece no último terço do shot`);
          }
        });
      });
    }
    if (bad.size === 0) {
      console.log(`✓ números: ${total} leituras em ${records.length} registros, todas corretas`);
    }
  }

  if (overlap) {
    // Junta os textos de todos os shots presentes em cada quadro (transições incluídas).
    const byFrame = new Map();
    for (const rec of records) {
      const list = byFrame.get(rec.frame) ?? [];
      for (const t of rec.texts.filter((x) => x.op >= VISIBLE && onScreen(x))) {
        // A transição glitch desenha a cena duas vezes (camada deslocada): mesma peça, conta uma vez.
        if (!list.some((u) => u.shot === rec.shot && u.label === t.label)) {
          list.push({ ...t, shot: rec.shot });
        }
      }
      byFrame.set(rec.frame, list);
    }
    const bad = new Map();
    for (const [frame, list] of byFrame) {
      for (let a = 0; a < list.length; a++) {
        for (let b = a + 1; b < list.length; b++) {
          if (overlapRatio(list[a], list[b]) > OVERLAP_MAX) {
            const [p, q] = [list[a], list[b]].sort((m, n) => m.label.localeCompare(n.label));
            const key = `"${p.label}" (${p.shot}) × "${q.label}" (${q.shot})`;
            bad.set(key, [...(bad.get(key) ?? []), frame]);
          }
        }
      }
    }
    for (const [msg, frames] of bad) {
      errors.push(`sobreposição ${msg} (${ranges(frames, fps)})`);
    }
    if (bad.size === 0) {
      console.log(`✓ sobreposição: nenhum par de textos grandes dividindo a mesma área em ${byFrame.size} quadros`);
    }
  }

  if (errors.length > 0) {
    console.error(`\n✗ revisão automática falhou (${errors.length}):`);
    errors.forEach((e) => console.error(`  - ${e}`));
    return false;
  }
  console.log(`✓ revisão automática ok (${((Date.now() - t0) / 1000).toFixed(0)}s, ${composition.durationInFrames} quadros)`);
  return true;
};

// Compatível com o nome antigo.
export const checkNumbers = (id) => runChecks(id);

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const id = args.find((a) => !a.startsWith("--"));
  if (!id || !existsSync(path.join(root, "videos", `${id}.json`))) {
    console.error("Uso: npm run check -- <id>  (um arquivo de /videos, sem .json)");
    process.exit(1);
  }
  const ok = await runChecks(id, { numbers: !args.includes("--overlap-only"), overlap: !args.includes("--numbers-only") });
  process.exit(ok ? 0 : 1);
}

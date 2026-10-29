// Revisão automática de um vídeo KineticExplainer, quadro a quadro (todos os quadros):
//
//  - números: todo número na tela (number, bars, line) tem que ser 0, o valor do JSON,
//    ou estar na contagem do número herói (BigNumber). Valor intermediário falha.
//  - sobreposição: dois textos grandes (títulos, ransom, recortes, número herói, palavra
//    com foto) nunca ocupam a mesma área ao mesmo tempo, transições incluídas. Texto grande
//    também não pode cobrir números de gráfico nem objetos 3D (WireframeExplainer).
//  - palavras cortadas: digitação só mostra palavras inteiras; no ransom uma palavra pode
//    estar incompleta no máximo 3 quadros; na legenda o destaque cobre a palavra inteira.
//  - safe zone: títulos, números, HUDs e objetos 3D dentro de [30,1050] x [250,1500], e
//    fora da coluna de botões do TikTok (abaixo de y 1100, direita até 960). Só falha se
//    passar de meio segundo seguido (entrada/saída animada pode passar rapidinho).
//  - tamanho: valores principais (data-main) com pelo menos 34 px na tela (1080), medidos
//    no último terço do shot (já assentados).
//  - trechos de filme: no máximo 8, cada um com no máximo 2 s, sem a mesma forma (card, bg,
//    strip) duas vezes seguidas, até 2 com rosto e sem repetir momento entre A, B e C.
//
//   npm run check:numbers -- <id>     só números
//   npm run check:overlap -- <id>     só sobreposição
//   npm run check -- <id>             os dois
//
// O preview:fast e o render:video rodam os dois antes de renderizar.
import { bundle } from "@remotion/bundler";
import { openBrowser, renderFrames, selectComposition } from "@remotion/renderer";
import { existsSync, readdirSync, readFileSync } from "node:fs";
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
  // Número dentro do cubo de gelo ("R$ 100").
  if (el.type === "ice" && el.value !== undefined) {
    return [{ i: 0, value: el.value, decimals: decimalsOf(el.value), label: el.caption }];
  }
  // Anos da linha do tempo: aparecem exatamente como no JSON ("1942", sem ponto).
  if (el.type === "timeline") {
    return el.items.flatMap((it, i) => (it.year === undefined ? [] : [{ i, value: it.year, decimals: 0, display: String(it.year), label: it.label }]));
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
// Número de gráfico sob texto grande: qualquer pedaço já atrapalha a leitura.
const NUM_OVERLAP_MAX = 0.05;
const SAFE = { x0: 30, x1: 1050, y0: 250, y1: 1500, sideY: 1100, sideX: 960 };
const SAFE_SUSTAIN = 15;
const MIN_MAIN_PX = 33.5;
const RANSOM_PARTIAL_MAX = 3;
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

// Quadros seguidos mais longos que n.
const sustained = (frames, n) => {
  const sorted = [...new Set(frames)].sort((a, b) => a - b);
  const out = [];
  let run = [];
  for (const f of sorted) {
    if (run.length > 0 && f - run[run.length - 1] > 1) {
      if (run.length > n) {
        out.push(...run);
      }
      run = [];
    }
    run.push(f);
  }
  if (run.length > n) {
    out.push(...run);
  }
  return out;
};

const add = (map, key, frame) => map.set(key, [...(map.get(key) ?? []), frame]);

export const runChecks = async (id, { numbers = true, overlap = true, from, to } = {}) => {
  const file = path.join(root, "videos", `${id}.json`);
  const video = JSON.parse(readFileSync(file, "utf8"));
  if (video.template && !["KineticExplainer", "WireframeExplainer"].includes(video.template)) {
    console.log("revisão automática: só vale pro KineticExplainer, pulando");
    return true;
  }

  const t0 = Date.now();
  const logLevel = "error";
  const serveUrl = process.env.RENDER_BUNDLE ?? await bundle({ entryPoint: path.join(root, "src/index.ts"), rspack: true });
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
    frameRange: to === undefined && from === undefined ? null : [from ?? 0, Math.min(to ?? Infinity, composition.durationInFrames - 1)],
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

  // Trechos de filme (STYLE-GUIDE §4.8): no máximo 8 por vídeo; card e bg com 1–2 s, strip com
  // 2–3 cortes de 0,3–0,8 s (total até 2 s); nunca a mesma forma (card, bg, strip) duas vezes
  // seguidas; no máximo 2 trechos com rosto; o arquivo existe em public/; e nenhum trecho
  // repete um momento já usado em outra versão do mesmo roteiro (A, B e C). O vídeo é sempre
  // mudo (o componente usa volume 0). Na C, os trechos do monitor holográfico da abertura.
  const totalS = composition.durationInFrames / fps;
  const shotStartS = new Map([...shots].map(([sid, v]) => [sid, v.start / fps]));
  const formOf = (el) => (el.style === "bg" ? "bg" : el.style === "strip" ? "strip" : "card");
  const cutLen = (d) => Math.min(0.8, Math.max(0.3, d ?? 0.5));
  const clipParts = (el) => (el.style === "strip" ? (el.cuts ?? []).map((ct) => ({ from: ct.from, len: cutLen(ct.duration) })) : [{ from: el.from, len: el.duration ?? 1.6 }]);
  const clipsIn = (v) => [
    ...(v.holoIntro?.clips ?? []).map((ct, k) => ({ el: { ...ct, src: v.holoIntro.src, style: "holo" }, shot: `monitor ${k + 1}`, t: k })),
    ...v.scenes.flatMap((sc) => sc.shots.flatMap((sh) => sh.elements.filter((el) => el.type === "clip").map((el) => ({ el, shot: sh.id, t: (shotStartS.get(sh.id) ?? 0) + (typeof el.at === "number" ? el.at : 0) })))),
  ];
  const clips = clipsIn({ ...video, scenes }).sort((a, b) => a.t - b.t);
  if (clips.length > 0) {
    const errs0 = errors.length;
    if (clips.length > 8) {
      errors.push(`clipes: ${clips.length} trechos no vídeo (máximo 8)`);
    }
    let seconds = 0;
    for (const { el, shot } of clips) {
      const src = el.src ?? "clips/odisseia-trailer.mp4";
      if (el.style === "strip") {
        const cuts = el.cuts ?? [];
        const len = cuts.reduce((a, ct) => a + cutLen(ct.duration), 0);
        seconds += len;
        if (cuts.length < 2 || cuts.length > 3) {
          errors.push(`clipes: strip em ${shot} com ${cuts.length} corte(s) (tem que ter 2 ou 3)`);
        }
        if (cuts.some((ct) => typeof ct.from !== "number" || (ct.duration ?? 0.5) < 0.3 || (ct.duration ?? 0.5) > 0.8)) {
          errors.push(`clipes: strip em ${shot} com corte sem "from" ou fora de 0,3–0,8 s`);
        }
        if (len > 2) {
          errors.push(`clipes: strip em ${shot} com ${len.toFixed(2)}s no total (máximo 2 s)`);
        }
      } else {
        const d = el.duration ?? 1.6;
        seconds += d;
        if (typeof el.from !== "number") {
          errors.push(`clipes: trecho em ${shot} sem "from"`);
        }
        if (d < 1 || d > 2) {
          errors.push(`clipes: trecho em ${shot} com ${d}s (tem que ser de 1 a 2 s)`);
        }
      }
      if (!existsSync(path.join(root, "public", src))) {
        errors.push(`clipes: arquivo public/${src} não existe (${shot})`);
      }
    }
    // Forma: nunca a mesma em seguida (frame e torn são a mesma forma: card).
    const kinetic = clips.filter((c) => c.el.style !== "holo");
    for (let i = 1; i < kinetic.length; i++) {
      if (formOf(kinetic[i].el) === formOf(kinetic[i - 1].el)) {
        errors.push(`clipes: dois trechos "${formOf(kinetic[i].el)}" seguidos (${kinetic[i - 1].shot} e ${kinetic[i].shot})`);
      }
    }
    const faces = clips.filter((c) => c.el.face);
    if (faces.length > 2) {
      errors.push(`clipes: ${faces.length} trechos com rosto (máximo 2): ${faces.map((c) => c.shot).join(", ")}`);
    }
    // Versões do mesmo roteiro (baseOf) não repetem momento do filme.
    const family = video.baseOf ?? video.id;
    const siblings = readdirSync(path.join(root, "videos"))
      .filter((f) => f.endsWith(".json") && f !== `${id}.json`)
      .map((f) => JSON.parse(readFileSync(path.join(root, "videos", f), "utf8")))
      .filter((v) => Array.isArray(v.scenes) && (v.baseOf ?? v.id) === family);
    for (const sib of siblings) {
      const theirs = clipsIn(sib).flatMap((c) => clipParts(c.el).map((p) => ({ ...p, src: c.el.src ?? "clips/odisseia-trailer.mp4" })));
      for (const { el, shot } of clips) {
        for (const p of clipParts(el)) {
          const hit = theirs.find((q) => q.src === (el.src ?? "clips/odisseia-trailer.mp4") && Math.min(p.from + p.len, q.from + q.len) - Math.max(p.from, q.from) > 0.05);
          if (hit) {
            errors.push(`clipes: trecho em ${shot} (${p.from}s) repete o momento ${hit.from}s já usado em ${sib.id}`);
          }
        }
      }
    }
    const pct = Math.round((seconds / totalS) * 100);
    if (errors.length === errs0) {
      const forms = clips.map((c) => (c.el.style === "holo" ? "monitor" : formOf(c.el))).join(" → ");
      console.log(`✓ clipes: ${clips.length} trecho(s), ${seconds.toFixed(1)}s (${pct}% do vídeo), sem áudio, ${faces.length} com rosto: ${forms}`);
    }
    // Avisos (não reprovam): quantidade, cobertura e distribuição no padrão dos vídeos com filme.
    if (kinetic.length > 0 && video.template !== "WireframeExplainer") {
      if (kinetic.length < 6) {
        console.log(`  aviso: só ${kinetic.length} trecho(s) de filme (o padrão é 6 a 8)`);
      }
      if (pct < 18 || pct > 27) {
        console.log(`  aviso: trechos cobrem ${pct}% do vídeo (o padrão é ~20–25%)`);
      }
      const marks = [0, ...kinetic.map((c) => c.t), totalS];
      const gap = Math.max(...marks.slice(1).map((m, i) => m - marks[i]));
      if (gap > 16) {
        console.log(`  aviso: ${gap.toFixed(0)}s seguidos sem trecho de filme (distribua ao longo do vídeo)`);
      }
    }
  }

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
    for (const { shot, frames, start } of shots.values()) {
      if ((to !== undefined && start + frames - 1 > to) || (from !== undefined && start < from)) {
        continue;
      }
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
    // Texto grande x números de gráfico/rótulos (fora dele) e x objetos 3D.
    for (const rec of records) {
      const big = (byFrame.get(rec.frame) ?? []).filter((t) => t.label !== "objeto 3D");
      const nums = rec.items.filter((it) => !it.inBig && it.op >= VISIBLE && onScreen(it));
      for (const n of nums) {
        for (const t of big) {
          if (overlapRatio(n, t) > NUM_OVERLAP_MAX) {
            add(bad, `"${t.label}" (${t.shot}) × número "${n.text.trim()}" (${rec.shot})`, rec.frame);
          }
        }
      }
      for (const o of rec.avoid ?? []) {
        for (const t of big) {
          if (overlapRatio(o, t) > OVERLAP_MAX) {
            add(bad, `"${t.label}" (${t.shot}) × objeto 3D (${rec.shot})`, rec.frame);
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

    // Palavras cortadas.
    const cut = new Map();
    const partial = new Map();
    const capSeen = new Set();
    for (const rec of records) {
      for (const t of rec.typed ?? []) {
        const full = t.full.split(" ");
        const shown = t.shown.split(" ").filter(Boolean);
        if (!shown.every((w, i) => w === full[i])) {
          add(cut, `digitação mostra "${t.shown}" de "${t.full}" (${rec.shot})`, rec.frame);
        }
      }
      for (const r of rec.ransom ?? []) {
        if (r.shown > 0 && r.shown < [...r.word].length) {
          add(partial, `${rec.shot}/${r.el}/${r.word}`, rec.frame);
        }
      }
      for (const c of rec.captions ?? []) {
        const key = `${rec.frame}/${c.word}/${c.x}/${c.y}`;
        if (capSeen.has(key)) {
          continue;
        }
        capSeen.add(key);
        if (c.active && c.hlOp >= VISIBLE && c.cover < 0.98) {
          add(cut, `legenda: destaque cobre só ${Math.round(c.cover * 100)}% de "${c.word}"`, rec.frame);
        }
        if (c.w > 0 && (c.x < 0 || c.x + c.w > 1080)) {
          add(cut, `legenda: "${c.word}" sai do quadro`, rec.frame);
        }
      }
    }
    for (const [key, frames] of partial) {
      if (new Set(frames).size > RANSOM_PARTIAL_MAX) {
        const [shot, , word] = key.split("/");
        add(cut, `ransom "${word}" incompleto por ${new Set(frames).size} quadros (${shot})`, frames[0]);
        frames.slice(1).forEach((f) => add(cut, `ransom "${word}" incompleto por ${new Set(frames).size} quadros (${shot})`, f));
      }
    }
    for (const [msg, frames] of cut) {
      errors.push(`palavra cortada: ${msg} (${ranges(frames, fps)})`);
    }
    if (cut.size === 0) {
      console.log("✓ palavras: nenhuma palavra cortada em títulos, ransom ou legendas");
    }

    // Safe zone.
    const out = new Map();
    const worst = new Map();
    for (const rec of records) {
      // Shot saindo durante a transição (quadros depois do fim dele): o conteúdo está indo
      // embora da tela, não conta. Sobreposição de texto continua valendo nesses quadros.
      const info = shots.get(rec.shot);
      if (info && rec.frame - info.start >= info.frames) {
        continue;
      }
      const seen = new Set();
      for (const b of rec.safe ?? []) {
        if (b.w <= 4 || b.h <= 4 || seen.has(b.label)) {
          continue;
        }
        const right = b.x + b.w;
        const bottom = b.y + b.h;
        const why =
          b.x < SAFE.x0 || right > SAFE.x1 || b.y < SAFE.y0 || bottom > SAFE.y1
            ? `fora da área segura (${b.x},${b.y})–(${right},${bottom})`
            : bottom > SAFE.sideY && right > SAFE.sideX
              ? `embaixo dos botões do TikTok (${b.x},${b.y})–(${right},${bottom})`
              : null;
        if (why) {
          seen.add(b.label);
          const key = `"${b.label}" (${rec.shot}) ${why.split(" (")[0]}`;
          add(out, key, rec.frame);
          // Guarda o pior quadro (mais longe da área) pra mensagem.
          const dist = Math.max(SAFE.x0 - b.x, right - SAFE.x1, SAFE.y0 - b.y, bottom - SAFE.y1, bottom > SAFE.sideY ? right - SAFE.sideX : 0);
          if (!(worst.get(key)?.dist >= dist)) {
            worst.set(key, { dist, box: why.slice(why.indexOf("(")) });
          }
        }
      }
    }
    let outCount = 0;
    for (const [msg, frames] of out) {
      const long = sustained(frames, SAFE_SUSTAIN);
      if (long.length > 0) {
        outCount++;
        errors.push(`safe zone: ${msg}, pior ${worst.get(msg).box} (${ranges(long, fps)})`);
      }
    }
    if (outCount === 0) {
      console.log("✓ safe zone: títulos, números, HUDs e objetos 3D dentro da área segura");
    }
  }

  if (numbers) {
    // Tamanho mínimo dos valores principais, já assentados (último terço do shot).
    const small = new Map();
    for (const rec of records) {
      const info = shots.get(rec.shot);
      if (!info || rec.frame - info.start < Math.ceil((info.frames * 2) / 3)) {
        continue;
      }
      for (const it of rec.items) {
        if (it.main && it.op >= 0.9 && it.font > 0 && it.font < MIN_MAIN_PX) {
          add(small, `"${it.text.trim()}" (${rec.shot}) com ${it.font.toFixed(1).replace(".", ",")} px`, rec.frame);
        }
      }
    }
    for (const [msg, frames] of small) {
      errors.push(`número pequeno demais: ${msg}, mínimo 34 px (${ranges(frames, fps)})`);
    }
    if (small.size === 0) {
      console.log("✓ tamanho: valores principais com 34 px ou mais");
    }
  }

  if (errors.length > 0) {
    console.error(`\n✗ revisão automática falhou (${errors.length}):`);
    errors.forEach((e) => console.error(`  - ${e}`));
    return false;
  }
  console.log(`✓ revisão automática ok (${((Date.now() - t0) / 1000).toFixed(0)}s, ${to === undefined ? composition.durationInFrames : Math.min(to + 1, composition.durationInFrames)} quadros)`);
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
  const toArg = args.find((a) => a.startsWith("--to="));
  const fromArg = args.find((a) => a.startsWith("--from="));
  const ok = await runChecks(id, {
    numbers: !args.includes("--overlap-only"),
    overlap: !args.includes("--numbers-only"),
    to: toArg ? Number(toArg.slice(5)) : undefined,
    from: fromArg ? Number(fromArg.slice(7)) : undefined,
  });
  process.exit(ok ? 0 : 1);
}

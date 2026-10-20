// Gera as 3 versões de um roteiro:
//   A  videos/<id>.json      KineticExplainer + sunset-dark + voz masculina (marca: voices.a)
//   B  videos/<id>-b.json    KineticExplainer + paleta rikuai + voz feminina (voices.b) + gancho
//                            alternativo ("hookAlt" no roteiro), outra seed de transições/layout
//                            e fotos diferentes das da A
//   C  videos/<id>-c.json    WireframeExplainer (holograma 3D) com o áudio e as legendas da B
//
//   npm run make:all -- <id>                 tudo: deriva B/C, fotos, narração, revisão e render 1080
//   opções: --only a,b,c   --derive-only   --rederive (refaz B/C a partir do roteiro)
//           --preview (preview:fast no lugar do render final)   --no-render
//
// B e C só são derivados se ainda não existirem (ajustes feitos à mão neles ficam); use
// --rederive pra gerar de novo. A narração só é gerada se o vídeo ainda não tiver áudio.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const args = process.argv.slice(2);
const id = args.find((a, i) => !a.startsWith("--") && args[i - 1] !== "--only");
const only = (args[args.indexOf("--only") + 1] ?? "a,b,c").split(",");
const has = (f) => args.includes(f);

const readJson = (p) => JSON.parse(readFileSync(p, "utf8"));
const writeJson = (p, d) => writeFileSync(p, `${JSON.stringify(d, null, 2)}\n`);
const videoPath = (vid) => path.join(root, "videos", `${vid}.json`);

// Paletas da B: a A usa sunset-dark/heat, a B troca pelo equivalente roxo.
const PALETTE_B = { "sunset-dark": "rikuai", sunset: "rikuai", heat: "rikuai-heat" };

export const deriveB = (base, brand) => {
  const b = structuredClone(base);
  b.id = `${base.id}-b`;
  b.composition = `${base.composition}B`;
  b.title = `${base.title ?? base.id} (B)`;
  b.baseOf = base.id;
  b.background = { ...(base.background ?? {}), palette: "rikuai" };
  b.seed = b.id;
  b.layout = { seed: b.id, mirror: 0.5 };
  b.photos = { avoidFrom: [base.id] };
  b.voice = { ...(brand.voices?.b ?? {}) };
  b.audio = null;
  b.captions = null;
  delete b.hookAlt;
  for (const alt of base.hookAlt ?? []) {
    const scene = b.scenes.find((s) => s.id === alt.scene);
    if (!scene) {
      throw new Error(`hookAlt: cena "${alt.scene}" não existe no roteiro`);
    }
    scene.narration = alt.narration;
    if (alt.shots) {
      scene.shots = structuredClone(alt.shots);
    }
  }
  for (const scene of b.scenes) {
    for (const shot of scene.shots) {
      if (typeof shot.palette === "string" && PALETTE_B[shot.palette]) {
        shot.palette = PALETTE_B[shot.palette];
      }
    }
  }
  return b;
};

// C: mesmas cenas/narração da B (mesmo áudio => mesmo retiming), renderizadas em 3D.
export const deriveC = (b) => {
  const c = structuredClone(b);
  c.id = b.id.replace(/-b$/, "-c");
  c.composition = b.composition.replace(/B$/, "C");
  c.title = (b.title ?? c.id).replace(/\(B\)$/, "(C)");
  c.template = "WireframeExplainer";
  c.audioFrom = b.id;
  c.audio = b.audio ?? `audio/${b.id}.mp3`;
  c.captions = b.captions ?? `${b.id}-captions.json`;
  delete c.voice;
  delete c.photos;
  delete c.layout;
  c.seed = c.id;
  return c;
};

const run = (label, script, ...rest) => {
  console.log(`\n▸ ${label}: npm run ${script} -- ${rest.join(" ")}`);
  const r = spawnSync("npm", ["run", "--silent", script, "--", ...rest], { cwd: root, stdio: "inherit" });
  if (r.status !== 0) {
    console.error(`✗ ${label} falhou`);
    process.exit(r.status ?? 1);
  }
};

if (import.meta.url === `file://${process.argv[1]}`) {
  if (!id || !existsSync(videoPath(id))) {
    console.error("Uso: npm run make:all -- <roteiro-id> [--only a,b,c] [--derive-only] [--rederive] [--preview] [--no-render]");
    process.exit(1);
  }
  const base = readJson(videoPath(id));
  const brand = readJson(path.join(root, "brands", `${base.brand}.json`));
  if (!base.voice?.id && brand.voices?.a) {
    base.voice = { ...brand.voices.a, ...(base.voice ?? {}) };
    writeJson(videoPath(id), base);
  }

  const bId = `${id}-b`;
  const cId = `${id}-c`;
  if (has("--rederive") || !existsSync(videoPath(bId))) {
    writeJson(videoPath(bId), deriveB(base, brand));
    console.log(`✓ videos/${bId}.json derivado do roteiro`);
  }
  if (has("--rederive") || !existsSync(videoPath(cId))) {
    writeJson(videoPath(cId), deriveC(readJson(videoPath(bId))));
    console.log(`✓ videos/${cId}.json derivado da versão B`);
  }
  if (has("--derive-only")) {
    process.exit(0);
  }

  const render = (vid) => {
    if (has("--no-render")) {
      return;
    }
    run(`render ${vid}`, has("--preview") ? "preview:fast" : "render:video", vid);
  };

  for (const [v, vid] of [
    ["a", id],
    ["b", bId],
  ]) {
    if (!only.includes(v)) {
      continue;
    }
    run(`fotos ${vid}`, "images:fetch", vid);
    if (!readJson(videoPath(vid)).audio) {
      run(`narração ${vid}`, "voice:generate", vid);
    }
    render(vid);
  }
  if (only.includes("c")) {
    // C usa o áudio da B: precisa dela pronta.
    const b = readJson(videoPath(bId));
    if (!b.audio) {
      run(`narração ${bId}`, "voice:generate", bId);
    }
    const c = readJson(videoPath(cId));
    const fresh = readJson(videoPath(bId));
    c.audio = fresh.audio;
    c.captions = fresh.captions;
    writeJson(videoPath(cId), c);
    render(cId);
  }
  console.log("\n✓ make:all concluído");
}

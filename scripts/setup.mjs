// Prepara uma máquina nova pra renderizar os vídeos do repositório:
//
//   npm run setup
//
//  1. npm install
//  2. dependências Python do recorte de fundo (scripts/requirements.txt), se faltarem
//  3. navegador do Remotion (se REMOTION_BROWSER_EXECUTABLE não estiver no .env)
//  4. fontes (fonts:cache), texturas (se faltarem) e modelos 3D (models:fetch)
//  5. fotos de todos os vídeos de /videos que usam fotos (images:fetch, precisa de
//     PIXABAY_API_KEY no .env; os ids fixos no JSON trazem as mesmas fotos)
//
// A biblioteca de efeitos sonoros (public/sfx) já vem no git. A narração não: ela gasta
// créditos da ElevenLabs, então o setup só avisa quais vídeos estão sem áudio.
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const env = { ...process.env };
if (existsSync(path.join(root, ".env"))) {
  for (const line of readFileSync(path.join(root, ".env"), "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && m[2] && env[m[1]] === undefined) {
      env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
}

const run = (label, cmd, args, { optional = false } = {}) => {
  console.log(`\n▸ ${label}`);
  const r = spawnSync(cmd, args, { cwd: root, stdio: "inherit", env });
  if (r.status !== 0) {
    if (optional) {
      console.warn(`⚠ ${label} falhou (seguindo em frente)`);
      return false;
    }
    console.error(`✗ ${label} falhou`);
    process.exit(r.status ?? 1);
  }
  return true;
};

run("dependências do Node", "npm", ["install"]);

const hasPy = spawnSync("python3", ["-c", "import rembg, numpy, PIL, scipy"], { stdio: "ignore" }).status === 0;
if (!hasPy) {
  run("dependências Python (rembg)", "python3", ["-m", "pip", "install", "-r", "scripts/requirements.txt"], { optional: true });
}

if (!env.REMOTION_BROWSER_EXECUTABLE) {
  run("navegador do Remotion", "npx", ["remotion", "browser", "ensure"]);
}

run("fontes", "npm", ["run", "--silent", "fonts:cache"]);
const textures = path.join(root, "public", "textures");
if (!existsSync(textures) || readdirSync(textures).filter((f) => f.endsWith(".png")).length === 0) {
  run("texturas", "npm", ["run", "--silent", "textures"], { optional: true });
}
run("modelos 3D", "npm", ["run", "--silent", "models:fetch"]);

// Vídeos que usam fotos (elemento "photo", ou cenas com "image" no CollageExplainer).
const videos = readdirSync(path.join(root, "videos"))
  .filter((f) => f.endsWith(".json") && !f.endsWith("-captions.json") && !f.endsWith("-alignment.json"))
  .map((f) => ({ id: f.replace(/\.json$/, ""), json: JSON.parse(readFileSync(path.join(root, "videos", f), "utf8")) }))
  .filter(({ json }) => Array.isArray(json.scenes));
const usesPhotos = (json) => JSON.stringify(json.scenes).includes('"image"') && json.template !== "WireframeExplainer";
const withPhotos = videos.filter(({ json }) => usesPhotos(json));
if (!env.PIXABAY_API_KEY) {
  console.warn(`\n⚠ PIXABAY_API_KEY não está no .env: pulando as fotos de ${withPhotos.map((v) => v.id).join(", ")}`);
} else {
  for (const { id } of withPhotos) {
    run(`fotos ${id}`, "npm", ["run", "--silent", "images:fetch", "--", id]);
  }
}

const missingAudio = videos.filter(({ json }) => json.audio && !existsSync(path.join(root, "public", json.audio)));
if (missingAudio.length > 0) {
  console.log("\nNarração ainda não gerada (gasta créditos da ElevenLabs, rode quando quiser):");
  const voiced = new Set();
  for (const { id, json } of missingAudio) {
    const src = json.audioFrom ?? id;
    if (!voiced.has(src)) {
      voiced.add(src);
      console.log(`  npm run voice:generate -- ${src}`);
    }
  }
}
console.log("\n✓ setup pronto. Teste com: npm run preview:fast -- <id>");

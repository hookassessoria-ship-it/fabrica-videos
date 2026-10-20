// Busca no Pixabay as fotos das cenas de um vídeo e baixa pra public/images/raw/<video-id>/.
//
// Cada cena pode ter: "image": { "query": "shopping cart", "treatment": "cutout" | "torn" | "taped",
//   "require"?: ["cart"] (tags obrigatórias), "id"?: 12345 (fixa uma foto específica),
//   "pick"?: 0 (n-ésima melhor), "allowPeople"?: false }
//
// - Busca em inglês, só fotos (image_type=photo), safesearch, sem imagens geradas por IA.
// - Prefere vertical e alta resolução; evita fotos com pessoas/rostos pelas tags.
// - Salva credits.json (autor, link, id) junto das fotos. Fotos já escolhidas ficam fixas
//   (o id vai pro credits.json), então rodar de novo baixa as mesmas imagens.
// - Cenas "cutout" passam pelo rembg (npm run images:cutout).
//
// Uso: npm run images:fetch -- <video-id> [--refresh]
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const [videoId, ...flags] = process.argv.slice(2);
const refresh = flags.includes("--refresh");
const key = process.env.PIXABAY_API_KEY;

if (!videoId) {
  console.error("Uso: npm run images:fetch -- <video-id> [--refresh]");
  process.exit(1);
}
if (!key) {
  console.error("PIXABAY_API_KEY não definida (coloque em .env).");
  process.exit(1);
}

const video = JSON.parse(await readFile(path.join(root, "videos", `${videoId}.json`), "utf8"));
const rawDir = path.join(root, "public", "images", "raw", videoId);
const creditsPath = path.join(rawDir, "credits.json");
await mkdir(rawDir, { recursive: true });
const credits = existsSync(creditsPath) ? JSON.parse(await readFile(creditsPath, "utf8")) : { videoId, images: {} };

// Tags que indicam gente na foto (rosto em close, retratos, figuras públicas).
const PEOPLE =
  /\b(people|person|persons|man|men|woman|women|girl|boy|child|children|kid|kids|baby|face|faces|portrait|selfie|model|lady|guy|human|crowd|politician|president|celebrity|family|couple|businessman|businesswoman|customer|shopper)\b/i;

const api = async (params) => {
  const url = new URL("https://pixabay.com/api/");
  url.search = new URLSearchParams({ key, image_type: "photo", safesearch: "true", per_page: "60", ...params }).toString();
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Pixabay ${res.status}: ${await res.text()}`);
  }
  return (await res.json()).hits ?? [];
};

const largeSize = (hit) => {
  const scale = Math.min(1, 1280 / Math.max(hit.imageWidth, hit.imageHeight));
  return { width: Math.round(hit.imageWidth * scale), height: Math.round(hit.imageHeight * scale) };
};

// Fração dos termos da busca que aparecem nas tags (a busca do Pixabay é bem solta).
const relevance = (hit, query) => {
  const words = query.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
  const tags = hit.tags.toLowerCase();
  return words.length === 0 ? 1 : words.filter((w) => tags.includes(w)).length / words.length;
};

const score = (hit, spec) => {
  const { treatment } = spec;
  const vertical = hit.imageHeight >= hit.imageWidth * 1.1;
  const pixels = hit.imageWidth * hit.imageHeight;
  let s = relevance(hit, spec.query) * 6;
  s += vertical ? 3 : treatment === "cutout" ? 1 : 0;
  s += Math.min(2, pixels / 6e6);
  s += Math.log10(1 + hit.likes + hit.downloads / 50) * 0.6;
  if (treatment === "cutout" && /\b(isolated|white background|cut out|transparent)\b/i.test(hit.tags)) {
    s += 3;
  }
  return s;
};

const pickHit = async (spec) => {
  if (spec.id) {
    const [hit] = await api({ id: String(spec.id) });
    if (!hit) {
      throw new Error(`Foto ${spec.id} não encontrada no Pixabay`);
    }
    return hit;
  }
  const vertical = await api({ q: spec.query, orientation: "vertical" });
  const any = await api({ q: spec.query });
  const seen = new Set();
  const required = (spec.require ?? []).map((t) => t.toLowerCase());
  const usable = [...vertical, ...any]
    .filter((h) => !seen.has(h.id) && seen.add(h.id))
    .filter((h) => !h.isAiGenerated && !h.isLowQuality)
    .filter((h) => spec.allowPeople || !PEOPLE.test(h.tags))
    .filter((h) => Math.max(h.imageWidth, h.imageHeight) >= 1600)
    .filter((h) => required.every((t) => h.tags.toLowerCase().includes(t)));
  const relevant = usable.filter((h) => relevance(h, spec.query) >= 0.5);
  const candidates = (relevant.length > 0 ? relevant : usable).sort((a, b) => score(b, spec) - score(a, spec));
  if (candidates.length === 0) {
    throw new Error(`Nenhuma foto adequada pra "${spec.query}". Tente outra busca ou "allowPeople": true.`);
  }
  return candidates[Math.min(spec.pick ?? 0, candidates.length - 1)];
};

const cutouts = [];
for (const scene of video.scenes) {
  const spec = scene.image;
  if (!spec?.query && !spec?.id) {
    continue;
  }
  const prev = credits.images[scene.id];
  const pinned = !refresh && prev && prev.query === spec.query && (spec.id === undefined || spec.id === prev.pixabayId);
  const hit = pinned ? (await api({ id: String(prev.pixabayId) }))[0] : await pickHit(spec);
  // PNGs do Pixabay costumam vir com fundo transparente: mantém como PNG.
  const ext = /\.png$/i.test(new URL(hit.largeImageURL).pathname) ? "png" : "jpg";
  const file = `images/raw/${videoId}/${scene.id}.${ext}`;
  const abs = path.join(root, "public", file);
  if (!existsSync(abs) || !pinned) {
    const res = await fetch(hit.largeImageURL);
    if (!res.ok) {
      throw new Error(`Download falhou (${res.status}): ${hit.largeImageURL}`);
    }
    await writeFile(abs, Buffer.from(await res.arrayBuffer()));
  }
  const { width, height } = largeSize(hit);
  credits.images[scene.id] = {
    ...(pinned ? prev : {}),
    pixabayId: hit.id,
    query: spec.query,
    treatment: spec.treatment ?? "torn",
    file,
    width,
    height,
    author: hit.user,
    authorUrl: `https://pixabay.com/users/${hit.user}-${hit.user_id}/`,
    pageUrl: hit.pageURL,
    tags: hit.tags,
    license: "Pixabay Content License",
  };
  console.log(`  ✓ ${scene.id}: #${hit.id} ${width}x${height} por ${hit.user} — ${hit.tags}`);
  if ((spec.treatment ?? "torn") === "cutout") {
    cutouts.push(abs);
  }
}

await writeFile(creditsPath, JSON.stringify(credits, null, 2) + "\n");
console.log(`créditos: ${path.relative(root, creditsPath)}`);

if (cutouts.length > 0) {
  console.log(`removendo fundo de ${cutouts.length} imagem(ns)...`);
  execFileSync("python3", [path.join(root, "scripts", "cutout.py"), ...cutouts], { stdio: "inherit" });
}

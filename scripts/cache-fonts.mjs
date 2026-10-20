// Baixa pra public/fonts/google/ as fontes que as marcas em /brands usam,
// com os mesmos arquivos do @remotion/google-fonts. O template carrega do
// cache local quando existe (render offline e determinístico) e cai pro
// Google Fonts quando não existe.
//
// Uso: npm run fonts:cache
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { getAvailableFonts } from "@remotion/google-fonts";

const root = path.resolve(import.meta.dirname, "..");
const outDir = path.join(root, "public", "fonts", "google");
const SUBSETS = ["latin"];

const brandFiles = (await readdir(path.join(root, "brands"))).filter((f) => f.endsWith(".json"));
const wanted = new Map();
for (const file of brandFiles) {
  const brand = JSON.parse(await readFile(path.join(root, "brands", file), "utf8"));
  for (const spec of Object.values(brand.fonts ?? {})) {
    const weights = new Set([...(wanted.get(spec.family) ?? []), ...(spec.weights ?? ["400"])]);
    wanted.set(spec.family, weights);
  }
}

const manifest = {};
for (const [family, weights] of wanted) {
  const entry = getAvailableFonts().find((f) => f.fontFamily === family);
  if (!entry) {
    throw new Error(`Fonte "${family}" não existe no @remotion/google-fonts`);
  }
  const info = (await entry.load()).getInfo();
  manifest[family] = [];
  for (const weight of weights) {
    for (const subset of SUBSETS) {
      const url = info.fonts.normal?.[weight]?.[subset];
      if (!url) {
        console.warn(`  ! ${family} ${weight} ${subset}: não disponível`);
        continue;
      }
      const rel = `fonts/google/${entry.importName}/normal-${weight}-${subset}.woff2`;
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Falha ao baixar ${url}: ${res.status}`);
      }
      await mkdir(path.dirname(path.join(root, "public", rel)), { recursive: true });
      await writeFile(path.join(root, "public", rel), Buffer.from(await res.arrayBuffer()));
      manifest[family].push({ style: "normal", weight, file: rel, unicodeRange: info.unicodeRanges[subset] });
      console.log(`  ✓ ${family} ${weight} (${subset})`);
    }
  }
}
await mkdir(outDir, { recursive: true });
await writeFile(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log(`manifest: ${path.relative(root, path.join(outDir, "manifest.json"))}`);

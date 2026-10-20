// Baixa os modelos 3D usados pelo WireframeExplainer pra public/models/ e registra autoria e
// licença em public/models/credits.json. Os arquivos .glb não vão pro git (licenças de
// terceiros: alguns não permitem redistribuir o arquivo solto); rodar de novo baixa tudo.
//
//   npm run models:fetch
//
// O que não existe pronto (prédio, elevador, escada, carrinho, arroz, leite, cédulas,
// carteira, velocímetro, termômetro, gráficos) é construído por código em
// src/components/wire/.
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const dir = path.join(root, "public/models");
const THREE_REV = "r180";

export const MODELS = [
  {
    id: "head",
    file: "head.glb",
    url: `https://raw.githubusercontent.com/mrdoob/three.js/${THREE_REV}/examples/models/gltf/LeePerrySmith/LeePerrySmith.glb`,
    title: "Lee Perry-Smith head scan",
    author: "Lee Perry-Smith / Infinite-Realities (via three.js examples)",
    license: "CC BY 3.0 — https://creativecommons.org/licenses/by/3.0/",
    attribution: "Cabeça 3D: Lee Perry-Smith / Infinite-Realities (CC BY 3.0)",
    source: "https://github.com/mrdoob/three.js/tree/dev/examples/models/gltf/LeePerrySmith",
  },
  {
    id: "xbot",
    file: "xbot.glb",
    url: `https://raw.githubusercontent.com/mrdoob/three.js/${THREE_REV}/examples/models/gltf/Xbot.glb`,
    title: "X Bot (animações idle, walk, run, sad_pose)",
    author: "Mixamo / Adobe (via three.js examples)",
    license: "Mixamo — uso livre (inclusive comercial) dentro de projetos; não redistribuir o arquivo solto",
    attribution: null,
    source: "https://github.com/mrdoob/three.js/blob/dev/examples/models/gltf/Xbot.glb",
  },
];

const fetchRetry = async (url) => {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url);
    if (res.ok || attempt >= 4) {
      return res;
    }
    await new Promise((r) => setTimeout(r, 2000 * 2 ** attempt));
  }
};

await mkdir(dir, { recursive: true });
for (const m of MODELS) {
  const out = path.join(dir, m.file);
  if (existsSync(out) && !process.argv.includes("--refresh")) {
    console.log(`  · ${m.file} (já baixado)`);
    continue;
  }
  const res = await fetchRetry(m.url);
  if (!res.ok) {
    throw new Error(`Download falhou (${res.status}): ${m.url}`);
  }
  await writeFile(out, Buffer.from(await res.arrayBuffer()));
  console.log(`  ✓ ${m.file} — ${m.title} (${m.license.split(" — ")[0]})`);
}
await writeFile(
  path.join(dir, "credits.json"),
  `${JSON.stringify({ models: MODELS.map(({ url, ...rest }) => ({ ...rest, downloadedFrom: url })) }, null, 2)}\n`,
);
console.log("créditos: public/models/credits.json");

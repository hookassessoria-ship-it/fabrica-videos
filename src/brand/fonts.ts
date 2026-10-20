import { getAvailableFonts } from "@remotion/google-fonts";
import { useEffect, useState } from "react";
import { cancelRender, continueRender, delayRender, staticFile } from "remotion";
import { type Brand, brandFontSpecs, type FontSpec } from "./types";

type CachedFace = { style: string; weight: string; file: string; unicodeRange?: string };
type Manifest = Record<string, CachedFace[]>;

// Cache local gerado por `npm run fonts:cache` (mesmos arquivos do Google Fonts).
let manifestPromise: Promise<Manifest> | null = null;
const loadManifest = (): Promise<Manifest> =>
  (manifestPromise ??= fetch(staticFile("fonts/google/manifest.json"))
    .then((r): Promise<Manifest> | Manifest => (r.ok ? r.json() : {}))
    .catch((): Manifest => ({})));

const addFace = async (family: string, src: string, weight = "400", style = "normal", unicodeRange?: string) => {
  const face = new FontFace(family, `url(${staticFile(src)})`, { weight, style, unicodeRange });
  await face.load();
  document.fonts.add(face);
};

const loadFromCache = async (spec: FontSpec) => {
  const faces = (await loadManifest())[spec.family] ?? [];
  const weights = spec.weights ?? ["400"];
  if (!weights.every((w) => faces.some((f) => f.weight === w))) {
    return false;
  }
  await Promise.all(
    faces.filter((f) => weights.includes(f.weight)).map((f) => addFace(spec.family, f.file, f.weight, f.style, f.unicodeRange)),
  );
  return true;
};

// Ordem: arquivos próprios (public/fonts) -> cache local do Google Fonts -> Google Fonts online.
const loadFamily = async (spec: FontSpec) => {
  if (spec.files && spec.files.length > 0) {
    await Promise.all(spec.files.map((f) => addFace(spec.family, f.src, f.weight, f.style)));
    return;
  }
  if (await loadFromCache(spec)) {
    return;
  }
  const entry = getAvailableFonts().find((f) => f.fontFamily === spec.family);
  if (!entry) {
    throw new Error(
      `Fonte "${spec.family}" não encontrada no @remotion/google-fonts. Confira o nome exato ou use "files" com arquivos próprios.`,
    );
  }
  const font = await entry.load();
  const { waitUntilDone } = font.loadFont("normal", {
    weights: spec.weights,
    subsets: ["latin"],
  });
  await waitUntilDone();
};

export const useBrandFonts = (brand: Brand) => {
  const [handle] = useState(() => delayRender("Carregando fontes da marca"));
  const specs = brandFontSpecs(brand);
  const key = JSON.stringify(specs);

  useEffect(() => {
    Promise.all(specs.map(loadFamily))
      .then(() => continueRender(handle))
      .catch((err) => cancelRender(err));
    // `key` resume `specs`; recarrega só quando a marca muda de fonte.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, handle]);
};

import { getAvailableFonts } from "@remotion/google-fonts";
import { useEffect, useState } from "react";
import { cancelRender, continueRender, delayRender, staticFile } from "remotion";
import type { Brand, FontSpec } from "./types";

type CachedFace = { style: string; weight: string; file: string; unicodeRange?: string };
type Manifest = Record<string, CachedFace[]>;

// Cache local gerado por `npm run fonts:cache` (mesmos arquivos do Google Fonts).
let manifestPromise: Promise<Manifest> | null = null;
const loadManifest = (): Promise<Manifest> =>
  (manifestPromise ??= fetch(staticFile("fonts/google/manifest.json"))
    .then((r): Promise<Manifest> | Manifest => (r.ok ? r.json() : {}))
    .catch((): Manifest => ({})));

const loadFromCache = async (spec: FontSpec) => {
  const faces = (await loadManifest())[spec.family] ?? [];
  const weights = spec.weights ?? ["400"];
  if (!weights.every((w) => faces.some((f) => f.weight === w))) {
    return false;
  }
  await Promise.all(
    faces
      .filter((f) => weights.includes(f.weight))
      .map(async (f) => {
        const face = new FontFace(spec.family, `url(${staticFile(f.file)}) format("woff2")`, {
          weight: f.weight,
          style: f.style,
          unicodeRange: f.unicodeRange,
        });
        await face.load();
        document.fonts.add(face);
      }),
  );
  return true;
};

// Carrega qualquer família do Google Fonts pelo nome escrito no JSON da marca.
const loadFamily = async (spec: FontSpec) => {
  if (await loadFromCache(spec)) {
    return;
  }
  const entry = getAvailableFonts().find((f) => f.fontFamily === spec.family);
  if (!entry) {
    throw new Error(
      `Fonte "${spec.family}" não encontrada no @remotion/google-fonts. Confira o nome exato no Google Fonts.`,
    );
  }
  const font = await entry.load();
  const { waitUntilDone } = font.loadFont("normal", {
    weights: spec.weights,
    subsets: ["latin"],
  });
  await waitUntilDone();
};

export const useBrandFonts = (fonts: Brand["fonts"]) => {
  const [handle] = useState(() => delayRender("Carregando fontes da marca"));
  const key = `${fonts.text.family}|${fonts.numbers.family}|${fonts.text.weights}|${fonts.numbers.weights}`;

  useEffect(() => {
    Promise.all([loadFamily(fonts.text), loadFamily(fonts.numbers)])
      .then(() => continueRender(handle))
      .catch((err) => cancelRender(err));
    // `key` resume `fonts`; recarrega só quando a marca muda de fonte.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, handle]);
};

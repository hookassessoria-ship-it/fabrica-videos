import type { Beat, CollageScene, Layer } from "./collageTypes";
import { VISUAL } from "./safeZone";

export type SceneWord = { text: string; start: number };

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9%]/g, "");

// Segundo (relativo à cena) de um beat: "at" direto, ou a palavra da narração.
export const resolveBeat = (beat: Beat, words: SceneWord[], sceneId: string, fallback = 0) => {
  if (beat.enterOnWord) {
    const target = norm(beat.enterOnWord);
    const hit = words.find((w) => norm(w.text) === target) ?? words.find((w) => norm(w.text).startsWith(target));
    if (hit) {
      return Math.max(0, hit.start + (beat.wordOffset ?? 0));
    }
    console.warn(`Cena "${sceneId}": palavra "${beat.enterOnWord}" não está na narração; usando at=${beat.at ?? fallback}`);
  }
  return beat.at ?? fallback;
};

// Id estável de cada camada (o mesmo que o images:fetch usa pra achar a foto).
const withIds = (layers: Layer[]) =>
  layers.map((l, i) => ({ ...l, id: l.id ?? (l.type === "photo" ? `photo${i}` : `${l.type}${i}`) }));

// Formato antigo (image/layout/title/labels/marks) -> camadas.
const legacyLayers = (scene: CollageScene): Layer[] => {
  const out: Layer[] = [];
  const cx = scene.layout?.x ?? VISUAL.centerX;
  const cy = scene.layout?.y ?? VISUAL.centerY + 30;
  if (scene.image) {
    out.push({
      id: "main",
      type: "photo",
      image: scene.image,
      x: cx,
      y: cy,
      width: scene.layout?.width,
      height: scene.layout?.height,
      rotate: scene.layout?.rotate,
      at: scene.layout?.at ?? 0.22,
    });
  }
  if (scene.title) {
    const t = scene.title;
    out.push({ type: t.style, text: t.text, x: t.x ?? cx, y: t.y ?? cy + 360, at: t.at ?? 0.7, rotate: t.rotate, size: t.size });
  }
  for (const m of scene.marks ?? []) {
    out.push({ type: m.kind, x: m.x, y: m.y, toX: m.toX, toY: m.toY, w: m.w, h: m.h, at: m.at });
  }
  for (const l of scene.labels ?? []) {
    out.push({ type: l.kind, text: l.text, x: l.x, y: l.y, at: l.at ?? 0.6, rotate: l.rotate, size: l.size });
  }
  return out;
};

export const sceneLayers = (scene: CollageScene): (Layer & { id: string })[] => [
  ...withIds(legacyLayers(scene)),
  ...withIds(scene.layers ?? []),
];

// Centro do glow: `focus` ou a primeira foto da cena.
export const sceneFocus = (scene: CollageScene) => {
  if (scene.focus) {
    return scene.focus;
  }
  const photo = sceneLayers(scene).find((l) => l.type === "photo");
  return photo ? { x: photo.x, y: photo.y } : { x: VISUAL.centerX, y: VISUAL.centerY };
};

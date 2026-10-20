import { random } from "remotion";
import type { KElement, KScene } from "./kineticTypes";

// Variação de layout entre versões do mesmo roteiro (A/B/...): com outra seed, parte dos
// shots é espelhada na horizontal (o que estava à esquerda vai pra direita), pra cada
// versão ter composição própria sem desenhar tudo de novo.

const CENTER_X = 500;
const mx = (x: number | undefined) => (x === undefined ? x : 2 * CENTER_X - x);

const SIDE: Record<string, "left" | "right" | "top" | "bottom"> = { left: "right", right: "left", top: "top", bottom: "bottom" };

const mirrorElement = (el: KElement): KElement => {
  const out = { ...el, x: mx(el.x ?? CENTER_X), rotate: el.rotate === undefined ? undefined : -el.rotate } as KElement;
  if (out.type === "shape") {
    out.toX = mx(out.toX);
  }
  if (out.type === "photo" && out.style === "split") {
    out.side = SIDE[out.side ?? "left"];
  }
  return out;
};

export type LayoutVariant = { seed?: string; mirror?: number };

// mirror: fração dos shots espelhados (0..1). Shots com interrupt, o 1º shot e os marcados
// com "mirror": false ficam iguais.
export const applyLayoutVariant = (scenes: KScene[], variant: LayoutVariant | null | undefined): KScene[] => {
  const ratio = variant?.mirror ?? 0;
  if (!ratio) {
    return scenes;
  }
  const seed = variant?.seed ?? "layout";
  let first = true;
  return scenes.map((scene) => ({
    ...scene,
    shots: scene.shots.map((shot) => {
      const keep = first || shot.interrupt !== undefined || shot.mirror === false || random(`${seed}-mirror-${shot.id}`) >= ratio;
      first = false;
      return keep ? shot : { ...shot, elements: shot.elements.map(mirrorElement) };
    }),
  }));
};

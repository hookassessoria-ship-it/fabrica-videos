export const FPS = 30;
export const WIDTH = 1080;
export const HEIGHT = 1920;
const TRANSITION_FRAMES = 14;

type TimelineScene = {
  duration: number;
  transition?: string;
};

export type TimedScene<S extends TimelineScene = TimelineScene> = {
  scene: S;
  index: number;
  startFrame: number;
  frames: number;
  // Transição que leva desta cena pra próxima (0 = corte seco).
  transitionOut: number;
};

// Cada cena começa exatamente no segundo da narração: a transição acontece
// por cima do começo da cena nova, e a cena anterior é estendida pra cobrir
// a sobreposição. Assim a duração total = soma das durações.
export const buildTimeline = <S extends TimelineScene>(scenes: S[], fps: number, transitionFrames = TRANSITION_FRAMES): TimedScene<S>[] => {
  let acc = 0;
  const base = scenes.map((scene, index) => {
    const startFrame = Math.round(acc * fps);
    acc += scene.duration;
    return { scene, index, startFrame, frames: Math.round(acc * fps) - startFrame };
  });
  return base.map((s, i) => {
    const next = base[i + 1];
    const wanted = next && next.scene.transition !== "cut" ? transitionFrames : 0;
    const transitionOut = next ? Math.max(0, Math.min(wanted, s.frames - 2, next.frames - 2)) : 0;
    return { ...s, transitionOut };
  });
};

export const totalFrames = (scenes: TimelineScene[], fps: number) =>
  Math.max(1, Math.round(scenes.reduce((sum, s) => sum + s.duration, 0) * fps));

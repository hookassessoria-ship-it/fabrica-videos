import { Audio } from "@remotion/media";
import { linearTiming, TransitionSeries } from "@remotion/transitions";
import React, { useMemo } from "react";
import { AbsoluteFill, type CalculateMetadataFunction, interpolate, Sequence, staticFile, useVideoConfig } from "remotion";
import { buildCollageTheme, CollageThemeProvider } from "../brand/collageTheme";
import { useBrandFonts } from "../brand/fonts";
import { narrationToCaptions } from "../components/captions/narrationToCaptions";
import { FluidBackground, type PaletteStop, resolvePalette } from "../components/kinetic/FluidBackground";
import { KineticCaptions } from "../components/kinetic/KineticCaptions";
import { kineticTransition, pickTransitions, TRANSITION_FRAMES } from "../components/transitions/kineticTransitions";
import type { SceneWord } from "./collageLayers";
import type { KineticExplainerProps, KScene, KShot, TransitionName } from "./kineticTypes";
import { KineticShot, timeElements } from "./KineticShot";
import { FPS, HEIGHT, WIDTH } from "./timeline";

const resolveSrc = (src: string) => (/^https?:\/\//.test(src) ? src : staticFile(src));

export const sceneDuration = (scene: KScene) => scene.shots.reduce((s, sh) => s + sh.duration, 0);
export const kineticTotalFrames = (scenes: KScene[], fps: number) => Math.max(1, Math.round(scenes.reduce((s, sc) => s + sceneDuration(sc), 0) * fps));

type FlatShot = {
  shot: KShot;
  sceneIndex: number;
  // Início do shot dentro da cena (s) e no vídeo (frames).
  offsetInScene: number;
  startFrame: number;
  frames: number;
  transitionIn: TransitionName;
  transitionOut: number;
};

const flatten = (scenes: KScene[], fps: number, seed: string): FlatShot[] => {
  const list: Omit<FlatShot, "transitionIn" | "transitionOut">[] = [];
  let acc = 0;
  scenes.forEach((scene, sceneIndex) => {
    let off = 0;
    scene.shots.forEach((shot) => {
      const startFrame = Math.round(acc * fps);
      acc += shot.duration;
      list.push({ shot, sceneIndex, offsetInScene: off, startFrame, frames: Math.round(acc * fps) - startFrame });
      off += shot.duration;
    });
  });
  const kinds = pickTransitions(list.map((l, i) => (i === 0 ? "cut" : l.shot.transition)), seed);
  return list.map((l, i) => {
    const next = list[i + 1];
    const wanted = next ? TRANSITION_FRAMES[kinds[i + 1]] : 0;
    const transitionOut = next ? Math.max(0, Math.min(wanted, l.frames - 2, next.frames - 2)) : 0;
    return { ...l, transitionIn: kinds[i], transitionOut };
  });
};

// Motion graphics premium: texto cinético, ícones, números, gráficos e fotos
// integradas sobre gradiente fluido; cortes curtos e transições variadas.
export const KineticExplainer: React.FC<KineticExplainerProps> = ({ brand, scenes, background, images, audioSrc, captions, music, sfx, showCaptions = true, numberCheck = false }) => {
  useBrandFonts(brand);
  const { fps, durationInFrames } = useVideoConfig();
  const theme = useMemo(() => buildCollageTheme(brand), [brand]);
  const shots = useMemo(() => flatten(scenes, fps, brand.id), [scenes, fps, brand.id]);

  const sceneStarts = useMemo(() => {
    const starts: number[] = [];
    let acc = 0;
    scenes.forEach((s) => {
      starts.push(acc);
      acc += sceneDuration(s);
    });
    return starts;
  }, [scenes]);

  const words = useMemo(
    () =>
      captions && captions.length > 0
        ? captions
        : narrationToCaptions(scenes.map((s, i) => ({ narration: s.narration, startSec: sceneStarts[i], durationSec: sceneDuration(s) }))),
    [captions, scenes, sceneStarts],
  );

  // Palavras relativas ao início de cada shot (pra "enterOnWord").
  const shotWords = useMemo(
    () =>
      shots.map((s): SceneWord[] => {
        const from = (sceneStarts[s.sceneIndex] + s.offsetInScene) * 1000;
        const sceneFrom = sceneStarts[s.sceneIndex] * 1000;
        const sceneTo = (sceneStarts[s.sceneIndex] + sceneDuration(scenes[s.sceneIndex])) * 1000;
        return words.filter((w) => w.startMs >= sceneFrom && w.startMs < sceneTo).map((w) => ({ text: w.text.trim(), start: (w.startMs - from) / 1000 }));
      }),
    [shots, words, sceneStarts, scenes],
  );

  const stops = useMemo((): PaletteStop[] => {
    let last = resolvePalette(background?.palette);
    return shots.map((s) => {
      if (s.shot.palette && !s.shot.interrupt) {
        last = resolvePalette(s.shot.palette);
      } else if (!s.shot.interrupt) {
        last = resolvePalette(background?.palette);
      }
      return { startFrame: s.startFrame, colors: last };
    });
  }, [shots, background?.palette]);

  const timedAll = useMemo(() => shots.map((s, i) => timeElements(s.shot, shotWords[i], fps)), [shots, shotWords, fps]);
  const impacts = useMemo(
    () => timedAll.flatMap((els, i) => els.map((e) => e.impact).filter((v): v is number => v !== undefined).map((v) => v + shots[i].startFrame)),
    [timedAll, shots],
  );
  // Efeitos sonoros: só toca o que tiver arquivo mapeado em "sfx".
  const sfxEvents = useMemo(
    () =>
      timedAll.flatMap((els, i) =>
        els.filter((e) => e.el.sfx && sfx?.[e.el.sfx]).map((e) => ({ frame: Math.max(0, shots[i].startFrame + Math.round(e.at * fps)), src: sfx?.[e.el.sfx as string] as string })),
      ),
    [timedAll, shots, sfx, fps],
  );
  const musicVolume = music?.volume ?? 0.08;

  return (
    <CollageThemeProvider value={theme}>
      <AbsoluteFill style={{ backgroundColor: "#000" }}>
        <FluidBackground stops={stops} speed={background?.speed ?? 0.3} video={background?.video} impacts={impacts} />
        <TransitionSeries>
          {shots.map((s, i) => (
            <React.Fragment key={s.shot.id}>
              {i > 0 && shots[i - 1].transitionOut > 0 ? (
                <TransitionSeries.Transition presentation={kineticTransition(s.transitionIn, theme.c.accent, s.shot.id)} timing={linearTiming({ durationInFrames: shots[i - 1].transitionOut })} />
              ) : null}
              <TransitionSeries.Sequence name={s.shot.id} durationInFrames={s.frames + s.transitionOut}>
                <KineticShot shot={s.shot} sceneId={scenes[s.sceneIndex].id} words={shotWords[i]} images={images} numberCheck={numberCheck} />
              </TransitionSeries.Sequence>
            </React.Fragment>
          ))}
        </TransitionSeries>
        {showCaptions ? <KineticCaptions captions={words} /> : null}
        {sfxEvents.map((e, i) => (
          <Sequence key={i} from={e.frame} layout="none">
            <Audio src={resolveSrc(e.src)} />
          </Sequence>
        ))}
        {audioSrc ? <Audio src={resolveSrc(audioSrc)} /> : null}
        {music ? (
          <Audio
            src={resolveSrc(music.src)}
            loop
            volume={(f) =>
              interpolate(f, [0, fps * 1.5, durationInFrames - fps * 2, durationInFrames], [0, musicVolume, musicVolume, 0], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              })
            }
          />
        ) : null}
      </AbsoluteFill>
    </CollageThemeProvider>
  );
};

export const calculateKineticMetadata: CalculateMetadataFunction<KineticExplainerProps> = ({ props }) => ({
  fps: FPS,
  width: WIDTH,
  height: HEIGHT,
  durationInFrames: kineticTotalFrames(props.scenes, FPS),
});

import { Audio } from "@remotion/media";
import { linearTiming, TransitionSeries } from "@remotion/transitions";
import React, { useMemo } from "react";
import { AbsoluteFill, type CalculateMetadataFunction, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { buildCollageTheme, CollageThemeProvider } from "../brand/collageTheme";
import { useBrandFonts } from "../brand/fonts";
import { narrationToCaptions } from "../components/captions/narrationToCaptions";
import { CollageBackground } from "../components/collage/CollageBackground";
import { CollageCaptions } from "../components/collage/CollageCaptions";
import { collageSwap } from "../components/transitions/collageSwap";
import type { CollageExplainerProps } from "./collageTypes";
import { CollageSceneView, photoCenter } from "./CollageScene";
import { buildTimeline, FPS, HEIGHT, totalFrames, WIDTH } from "./timeline";

const TRANSITION_FRAMES = 12;

const resolveSrc = (src: string) => (/^https?:\/\//.test(src) ? src : staticFile(src));

// Rótulo "FIG. 02 / 04" no canto da linha do fundo, acompanhando a cena atual.
const useFigLabel = (starts: number[]) => {
  const frame = useCurrentFrame();
  let i = 0;
  while (i + 1 < starts.length && frame >= starts[i + 1]) {
    i++;
  }
  const pad = (n: number) => String(n).padStart(2, "0");
  return `FIG. ${pad(i + 1)} / ${pad(starts.length)}`;
};

// Template vertical 1080x1920: colagem mixed media (recortes de revista + fundo tech).
export const CollageExplainer: React.FC<CollageExplainerProps> = ({
  brand,
  scenes,
  images,
  audioSrc,
  captions,
  music,
  showCaptions = true,
}) => {
  useBrandFonts(brand);
  const { fps, durationInFrames } = useVideoConfig();
  const theme = useMemo(() => buildCollageTheme(brand), [brand]);
  const timeline = useMemo(() => buildTimeline(scenes, fps, TRANSITION_FRAMES), [scenes, fps]);
  const glow = useMemo(
    () => timeline.map((t) => ({ startFrame: t.startFrame, ...(t.scene.focus ?? photoCenter(t.scene)) })),
    [timeline],
  );
  const words = useMemo(
    () =>
      captions && captions.length > 0
        ? captions
        : narrationToCaptions(timeline.map((t) => ({ narration: t.scene.narration, startSec: t.startFrame / fps, durationSec: t.frames / fps }))),
    [captions, timeline, fps],
  );
  const fig = useFigLabel(timeline.map((t) => t.startFrame));
  const musicVolume = music?.volume ?? 0.08;

  return (
    <CollageThemeProvider value={theme}>
      <AbsoluteFill style={{ backgroundColor: theme.c.background }}>
        <CollageBackground glow={glow} label={fig} />
        <TransitionSeries>
          {timeline.map((t, i) => (
            <React.Fragment key={t.scene.id}>
              {i > 0 && timeline[i - 1].transitionOut > 0 ? (
                <TransitionSeries.Transition presentation={collageSwap()} timing={linearTiming({ durationInFrames: timeline[i - 1].transitionOut })} />
              ) : null}
              <TransitionSeries.Sequence name={t.scene.id} durationInFrames={t.frames + t.transitionOut}>
                <CollageSceneView scene={t.scene} asset={images?.[t.scene.id]} />
              </TransitionSeries.Sequence>
            </React.Fragment>
          ))}
        </TransitionSeries>
        {showCaptions ? <CollageCaptions captions={words} /> : null}
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

export const calculateCollageMetadata: CalculateMetadataFunction<CollageExplainerProps> = ({ props }) => ({
  fps: FPS,
  width: WIDTH,
  height: HEIGHT,
  durationInFrames: totalFrames(props.scenes, FPS),
});

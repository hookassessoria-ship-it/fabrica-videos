import { Audio } from "@remotion/media";
import { linearTiming, TransitionSeries } from "@remotion/transitions";
import React, { useMemo } from "react";
import { AbsoluteFill, type CalculateMetadataFunction, interpolate, staticFile, useVideoConfig } from "remotion";
import { useBrandFonts } from "../brand/fonts";
import { buildTheme, ThemeProvider, useTheme } from "../brand/theme";
import { narrationToCaptions } from "../components/captions/narrationToCaptions";
import { TikTokCaptions } from "../components/captions/TikTokCaptions";
import { Backdrop } from "../components/paper/Backdrop";
import { PaperDefs } from "../components/paper/PaperDefs";
import { PaperTexture } from "../components/paper/PaperTexture";
import { SourceTag } from "../components/paper/SourceTag";
import { Stage } from "../components/paper/Stage";
import { paperFlip, paperSlide } from "../components/transitions/paperTransitions";
import { VISUALS } from "../visuals/registry";
import { SceneCamera } from "./SceneCamera";
import { buildTimeline, FPS, HEIGHT, totalFrames, WIDTH } from "./timeline";
import type { PaperExplainerProps, SceneSpec, SceneTransition } from "./types";

const resolveSrc = (src: string) => (/^https?:\/\//.test(src) ? src : staticFile(src));

const Scene: React.FC<{ readonly scene: SceneSpec }> = ({ scene }) => {
  const theme = useTheme();
  const Visual = VISUALS[scene.visual.type];
  if (!Visual) {
    throw new Error(
      `Cena "${scene.id}": visual "${scene.visual.type}" não existe. Disponíveis: ${Object.keys(VISUALS).join(", ")}`,
    );
  }
  return (
    <AbsoluteFill>
      <PaperTexture color={theme.c.background} />
      <SceneCamera keys={scene.camera} durationSec={scene.duration}>
        <Stage>
          <Backdrop variant={scene.backdrop ?? "sheets"} seed={scene.id} />
          <Visual props={scene.visual.props ?? {}} scene={scene} />
          {scene.source ? <SourceTag text={scene.source} at={scene.sourceAt} seed={scene.id} /> : null}
        </Stage>
      </SceneCamera>
    </AbsoluteFill>
  );
};

const presentationFor = (t: SceneTransition | undefined, edgeColor: string) => {
  switch (t) {
    case "flip":
      return paperFlip({ edgeColor, direction: "from-right" });
    case "slide-left":
      return paperSlide({ edgeColor, direction: "from-left" });
    case "slide-up":
      return paperSlide({ edgeColor, direction: "from-bottom" });
    default:
      return paperSlide({ edgeColor, direction: "from-right" });
  }
};

// Template vertical 1080x1920 de "papel recortado 3D" dirigido por dados.
export const PaperExplainer: React.FC<PaperExplainerProps> = ({
  brand,
  scenes,
  audioSrc,
  captions,
  music,
  showCaptions = true,
}) => {
  useBrandFonts(brand.fonts);
  const { fps, durationInFrames } = useVideoConfig();
  const theme = useMemo(() => buildTheme(brand), [brand]);
  const timeline = useMemo(() => buildTimeline(scenes, fps), [scenes, fps]);
  const words = useMemo(
    () =>
      captions && captions.length > 0
        ? captions
        : narrationToCaptions(
            timeline.map((t) => ({ narration: t.scene.narration, startSec: t.startFrame / fps, durationSec: t.frames / fps })),
          ),
    [captions, timeline, fps],
  );
  const musicVolume = music?.volume ?? 0.08;

  return (
    <ThemeProvider value={theme}>
      <AbsoluteFill className="pc-root" style={{ backgroundColor: theme.c.background }}>
        <PaperDefs />
        <TransitionSeries>
          {timeline.map((t, i) => (
            <React.Fragment key={t.scene.id}>
              {i > 0 && timeline[i - 1].transitionOut > 0 ? (
                <TransitionSeries.Transition
                  presentation={presentationFor(t.scene.transition, theme.c.edge)}
                  timing={linearTiming({ durationInFrames: timeline[i - 1].transitionOut })}
                />
              ) : null}
              <TransitionSeries.Sequence name={t.scene.id} durationInFrames={t.frames + t.transitionOut}>
                <Scene scene={t.scene} />
              </TransitionSeries.Sequence>
            </React.Fragment>
          ))}
        </TransitionSeries>
        {showCaptions ? <TikTokCaptions captions={words} /> : null}
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
    </ThemeProvider>
  );
};

export const calculatePaperExplainerMetadata: CalculateMetadataFunction<PaperExplainerProps> = ({ props }) => ({
  fps: FPS,
  width: WIDTH,
  height: HEIGHT,
  durationInFrames: totalFrames(props.scenes, FPS),
});

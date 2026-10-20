import { Composition, Folder } from "remotion";
import { HelloWorld } from "./HelloWorld";
import { Logo } from "./HelloWorld/Logo";
import { Title } from "./HelloWorld/Title";
import { calculateCollageMetadata, CollageExplainer } from "./templates/CollageExplainer";
import { calculateKineticMetadata, KineticExplainer, kineticTotalFrames } from "./templates/KineticExplainer";
import { calculatePaperExplainerMetadata, PaperExplainer } from "./templates/PaperExplainer";
import { FPS, HEIGHT, totalFrames, WIDTH } from "./templates/timeline";
import { VIDEOS } from "./videos";

// Each <Composition> is an entry in the sidebar!

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* Gerado a partir de /videos/*.json — vídeo novo = JSON novo, sem mexer aqui. */}
      <Folder name="Videos">
        {VIDEOS.map((v) =>
          v.template === "PaperExplainer" ? (
            <Composition
              key={v.video.composition}
              id={v.video.composition}
              component={PaperExplainer}
              durationInFrames={totalFrames(v.props.scenes, FPS)}
              fps={FPS}
              width={WIDTH}
              height={HEIGHT}
              defaultProps={v.props}
              calculateMetadata={calculatePaperExplainerMetadata}
            />
          ) : v.template === "KineticExplainer" ? (
            <Composition
              key={v.video.composition}
              id={v.video.composition}
              component={KineticExplainer}
              durationInFrames={kineticTotalFrames(v.props.scenes, FPS)}
              fps={FPS}
              width={WIDTH}
              height={HEIGHT}
              defaultProps={v.props}
              calculateMetadata={calculateKineticMetadata}
            />
          ) : (
            <Composition
              key={v.video.composition}
              id={v.video.composition}
              component={CollageExplainer}
              durationInFrames={totalFrames(v.props.scenes, FPS)}
              fps={FPS}
              width={WIDTH}
              height={HEIGHT}
              defaultProps={v.props}
              calculateMetadata={calculateCollageMetadata}
            />
          ),
        )}
      </Folder>
      <Folder name="Elements">
        <Composition
          id="Logo"
          component={Logo}
          durationInFrames={150}
          fps={30}
          width={1920}
          height={1080}
          defaultProps={{
            logoColor1: "#91EAE4",
            logoColor2: "#86A8E7",
          }}
        />
        <Composition
          id="Title"
          component={Title}
          durationInFrames={115}
          fps={30}
          width={1920}
          height={1080}
          defaultProps={{
            titleText: "Welcome to Remotion",
            titleColor: "#000000",
          }}
        />
      </Folder>
      <Composition
        // You can take the "id" to render a video:
        // bunx remotion render HelloWorld
        id="HelloWorld"
        component={HelloWorld}
        durationInFrames={150}
        fps={30}
        width={1920}
        height={1080}
        // You can override these props for each render:
        // https://www.remotion.dev/docs/parametrized-rendering
        defaultProps={{
          titleText: "Welcome to Remotion",
          titleColor: "#000000",
        }}
      />

    </>
  );
};

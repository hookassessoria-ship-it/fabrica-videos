import type { Caption } from "@remotion/captions";
import type { Brand } from "./brand/types";
import type { CollageExplainerProps, CollageScene, ImageAsset } from "./templates/collageTypes";
import type { KineticExplainerProps, KScene } from "./templates/kineticTypes";
import type { PaperExplainerProps, SceneSpec, VideoFile } from "./templates/types";

// Tudo em /videos/*.json que tiver `composition` + `scenes` vira uma composição.
const videoFiles = require.context("../videos", false, /\.json$/);
const brandFiles = require.context("../brands", false, /\.json$/);
// Fotos resolvidas pelo `npm run images:fetch` (um credits.json por vídeo).
const imageCredits = require.context("../public/images/raw", true, /credits\.json$/);

const isVideo = (v: unknown): v is VideoFile =>
  typeof v === "object" && v !== null && Array.isArray((v as VideoFile).scenes) && typeof (v as VideoFile).composition === "string";

const loadBrand = (id: string): Brand => {
  const key = `./${id}.json`;
  if (!brandFiles.keys().includes(key)) {
    throw new Error(`Marca "${id}" não encontrada em /brands (esperado brands/${id}.json)`);
  }
  return brandFiles(key) as Brand;
};

const loadCaptions = (file: string | null | undefined): Caption[] | null => {
  if (!file) {
    return null;
  }
  const key = `./${file.replace(/^\.?\/?(videos\/)?/, "")}`;
  // Ainda sem transcrição: cai pras legendas geradas a partir da narração.
  return videoFiles.keys().includes(key) ? (videoFiles(key) as Caption[]) : null;
};

const loadImages = (videoId: string): Record<string, ImageAsset> | null => {
  const key = `./${videoId}/credits.json`;
  return imageCredits.keys().includes(key) ? (imageCredits(key) as { images: Record<string, ImageAsset> }).images : null;
};

export type RegisteredVideo =
  | { file: string; video: VideoFile; template: "KineticExplainer"; props: KineticExplainerProps }
  | { file: string; video: VideoFile; template: "CollageExplainer"; props: CollageExplainerProps }
  | { file: string; video: VideoFile; template: "PaperExplainer"; props: PaperExplainerProps };

export const VIDEOS: RegisteredVideo[] = videoFiles
  .keys()
  .map((file) => ({ file, data: videoFiles(file) }))
  .filter((v): v is { file: string; data: VideoFile } => isVideo(v.data))
  .map(({ file, data }): RegisteredVideo => {
    const common = {
      brand: loadBrand(data.brand),
      audioSrc: data.audio ?? null,
      captions: loadCaptions(data.captions),
      music: data.music ?? null,
    };
    if (data.template === "PaperExplainer") {
      return { file, video: data, template: "PaperExplainer", props: { ...common, scenes: data.scenes as SceneSpec[] } };
    }
    if (data.template === "CollageExplainer") {
      return {
        file,
        video: data,
        template: "CollageExplainer",
        props: { ...common, scenes: data.scenes as CollageScene[], images: loadImages(data.id) },
      };
    }
    return {
      file,
      video: data,
      template: "KineticExplainer",
      props: {
        ...common,
        scenes: data.scenes as KScene[],
        images: loadImages(data.id),
        background: data.background ?? { palette: "sunset", speed: 0.3 },
        sfx: data.sfx ?? null,
      },
    };
  });

import type { Caption } from "@remotion/captions";
import type { Brand } from "./brand/types";
import type { PaperExplainerProps, VideoFile } from "./templates/types";

// Tudo em /videos/*.json que tiver `composition` + `scenes` vira uma composição.
const videoFiles = require.context("../videos", false, /\.json$/);
const brandFiles = require.context("../brands", false, /\.json$/);

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

export type RegisteredVideo = {
  file: string;
  video: VideoFile;
  props: PaperExplainerProps;
};

export const VIDEOS: RegisteredVideo[] = videoFiles
  .keys()
  .map((file) => ({ file, data: videoFiles(file) }))
  .filter((v): v is { file: string; data: VideoFile } => isVideo(v.data))
  .map(({ file, data }) => ({
    file,
    video: data,
    props: {
      brand: loadBrand(data.brand),
      scenes: data.scenes,
      audioSrc: data.audio ?? null,
      captions: loadCaptions(data.captions),
      music: data.music ?? null,
    },
  }));

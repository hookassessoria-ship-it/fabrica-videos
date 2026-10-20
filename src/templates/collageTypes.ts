import type { Caption } from "@remotion/captions";
import type { Brand } from "../brand/types";
import type { MusicSpec } from "./types";

export type Treatment = "torn" | "cutout" | "taped";

// O que o `npm run images:fetch` usa pra buscar a foto da cena.
export type ImageSpec = {
  query?: string;
  treatment?: Treatment;
  require?: string[];
  id?: number;
  pick?: number;
  allowPeople?: boolean;
};

// Resultado do images:fetch (public/images/raw/<video>/credits.json).
export type ImageAsset = {
  pixabayId: number;
  treatment: Treatment;
  file: string;
  width: number;
  height: number;
  cut?: string;
  cutWidth?: number;
  cutHeight?: number;
  sticker?: string;
  stickerWidth?: number;
  stickerHeight?: number;
  author: string;
  pageUrl: string;
};

export type PhotoLayout = {
  // Centro da foto e tamanho máximo, em px do quadro 1080x1920.
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  rotate?: number;
  at?: number;
};

export type TitleSpec = {
  style: "strip" | "ransom" | "display";
  text: string;
  x?: number;
  y?: number;
  at?: number;
  size?: number;
  rotate?: number;
};

export type LabelSpec = {
  kind: "mono" | "hand" | "chip";
  text: string;
  x: number;
  y: number;
  at?: number;
  rotate?: number;
  size?: number;
};

export type MarkSpec = {
  kind: "arrow" | "circle" | "underline";
  x: number;
  y: number;
  toX?: number;
  toY?: number;
  w?: number;
  h?: number;
  at?: number;
};

export type CollageScene = {
  id: string;
  narration: string;
  duration: number;
  transition?: "swap" | "cut";
  image?: ImageSpec;
  layout?: PhotoLayout;
  title?: TitleSpec;
  labels?: LabelSpec[];
  marks?: MarkSpec[];
  // Centro do glow roxo do fundo. Padrão: centro da foto.
  focus?: { x: number; y: number };
};

export type CollageExplainerProps = {
  brand: Brand;
  scenes: CollageScene[];
  images?: Record<string, ImageAsset> | null;
  audioSrc?: string | null;
  captions?: Caption[] | null;
  music?: MusicSpec | null;
  showCaptions?: boolean;
};

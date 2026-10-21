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
  // Recorte: preenche buracos internos (ex: tela branca de celular).
  fillHoles?: boolean;
  // Fora do Pixabay: "commons" = arquivo do Wikimedia Commons em domínio público/CC0
  // (pinturas). `file` é o título do arquivo ("File:....jpg").
  source?: "commons";
  file?: string;
};

// Resultado do images:fetch (public/images/raw/<video>/credits.json).
export type ImageAsset = {
  // Fotos do Pixabay têm pixabayId; pinturas do Commons têm source "commons".
  pixabayId?: number;
  source?: "pixabay" | "commons";
  license?: string;
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

// Momento de entrada (ou de um movimento): segundos desde o início da cena,
// ou atrelado a uma palavra da narração (primeira ocorrência na cena).
export type Beat = {
  at?: number;
  enterOnWord?: string;
  // Ajuste fino em segundos em relação à palavra (ex: -0.1 antecipa).
  wordOffset?: number;
};

export type LayerMove = Beat & {
  x?: number;
  y?: number;
  scale?: number;
  rotate?: number;
};

type LayerBase = Beat & {
  id?: string;
  // Centro da peça no quadro 1080x1920 (rótulo "mono": borda esquerda).
  x: number;
  y: number;
  scale?: number;
  rotate?: number;
  z?: number;
  // Amplitude (px) da flutuação depois que a peça assenta. 0 desliga.
  float?: number;
  moves?: LayerMove[];
};

export type Layer =
  | (LayerBase & { type: "photo"; image?: ImageSpec; treatment?: Treatment; width?: number; height?: number })
  | (LayerBase & {
      type: "number";
      value: number;
      decimals?: number;
      prefix?: string;
      suffix?: string;
      size?: number;
      color?: "text" | "accent" | "cream";
      countFrom?: number;
      countDuration?: number;
    })
  | (LayerBase & { type: "price"; text: string; sub?: string; size?: number })
  | (LayerBase & { type: "tape"; width?: number })
  | (LayerBase & { type: "mono" | "hand" | "chip" | "strip" | "ransom" | "display"; text: string; size?: number })
  | (LayerBase & { type: "arrow" | "circle" | "underline"; toX?: number; toY?: number; w?: number; h?: number });

export type CollageScene = {
  id: string;
  narration: string;
  duration: number;
  transition?: "swap" | "cut";
  // Formato antigo (uma foto + título + rótulos + marcas). Vira camadas automaticamente.
  image?: ImageSpec;
  layout?: PhotoLayout;
  title?: TitleSpec;
  labels?: LabelSpec[];
  marks?: MarkSpec[];
  // Peças da colagem, em ordem de empilhamento (a última fica por cima).
  layers?: Layer[];
  // Centro do glow roxo do fundo. Padrão: centro da primeira foto.
  focus?: { x: number; y: number };
};

export type CollageExplainerProps = {
  brand: Brand;
  scenes: CollageScene[];
  // Chave: "<cena>/<camada>" (ver credits.json).
  images?: Record<string, ImageAsset> | null;
  audioSrc?: string | null;
  captions?: Caption[] | null;
  music?: MusicSpec | null;
  showCaptions?: boolean;
};

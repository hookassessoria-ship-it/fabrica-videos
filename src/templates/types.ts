import type { Caption } from "@remotion/captions";
import type { Brand } from "../brand/types";
import type { BackdropVariant } from "../components/paper/Backdrop";

export type VisualSpec = {
  // Nome do visual registrado em src/visuals/registry.ts
  type: string;
  props?: Record<string, unknown>;
};

// Ponto-chave de câmera (segundos relativos à cena). Coordenadas do palco 1080x1920.
export type CameraKey = {
  at: number;
  x?: number;
  y?: number;
  zoom?: number;
};

export type SceneTransition = "slide" | "slide-left" | "slide-up" | "flip" | "cut";

export type SceneSpec = {
  id: string;
  narration: string;
  // Duração em segundos.
  duration: number;
  visual: VisualSpec;
  backdrop?: BackdropVariant;
  // Fonte do dado mostrado (aparece pequeno no canto).
  source?: string;
  sourceAt?: number;
  // Transição de ENTRADA desta cena.
  transition?: SceneTransition;
  camera?: CameraKey[];
};

export type MusicSpec = {
  src: string;
  volume?: number;
};

export type PaperExplainerProps = {
  brand: Brand;
  scenes: SceneSpec[];
  // Caminho em public/ (ex: "audio/rikuai-001.mp3") ou URL.
  audioSrc?: string | null;
  // Palavra por palavra. Sem isso, as legendas saem da narração.
  captions?: Caption[] | null;
  music?: MusicSpec | null;
  showCaptions?: boolean;
};

// Formato dos arquivos em /videos/*.json. `template` padrão: KineticExplainer.
export type VideoFile = {
  id: string;
  composition: string;
  title?: string;
  template?: "KineticExplainer" | "CollageExplainer" | "PaperExplainer" | "WireframeExplainer";
  // KineticExplainer: fundo (paleta/velocidade/vídeo) e mapa de efeitos sonoros.
  background?: { palette?: string | string[]; speed?: number; video?: string };
  sfx?: Record<string, string>;
  // Seed das transições sorteadas e variação de layout (versões do mesmo roteiro).
  seed?: string;
  layout?: { seed?: string; mirror?: number };
  // Fotos: não repetir as de outros vídeos (scripts/images-fetch.mjs).
  photos?: { avoidFrom?: string[] };
  // Gancho alternativo (versão B): troca narração e, se vier, os shots das primeiras cenas.
  hookAlt?: { scene: string; narration: string; shots?: unknown[] }[];
  // Narração (scripts/voice-generate.mjs).
  voice?: Record<string, unknown>;
  // Versão derivada: id do roteiro base / vídeo de onde vem o áudio (scripts/make-all.mjs).
  baseOf?: string;
  audioFrom?: string;
  brand: string;
  audio?: string | null;
  captions?: string | null;
  music?: MusicSpec | null;
  // Formato das cenas depende do template (ver templates/types.ts e templates/collageTypes.ts).
  scenes: unknown[];
};

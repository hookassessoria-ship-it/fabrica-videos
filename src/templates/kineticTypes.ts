import type { Caption } from "@remotion/captions";
import type { Brand } from "../brand/types";
import type { ImageAsset, ImageSpec } from "./collageTypes";
import type { ShapeName } from "../components/kinetic/Shapes";
import type { MusicSpec } from "./types";

export type EnterPreset = "pop" | "up" | "down" | "left" | "right" | "zoom" | "drop" | "blur" | "none" | "instant";

// Quando a peça entra: segundos desde o início do shot, ou uma palavra da narração.
// "at" negativo = a peça já está no meio da entrada no 1º quadro (gancho imediato).
export type KBeat = {
  at?: number;
  enterOnWord?: string;
  wordOffset?: number;
};

// Movimento de andar (elevador/escada): até "to", em "duration" segundos.
export type KMove = KBeat & { to: number; duration?: number; ease?: "fast" | "slow" | "smooth" };

type KBase = KBeat & {
  id?: string;
  // Centro no quadro 1080x1920. Padrão: centro da área segura.
  x?: number;
  y?: number;
  enter?: EnterPreset;
  // Segundos (do shot) em que sai, com antecipação. Sem isso, sai na transição.
  exitAt?: number;
  // 0 = fundo, 1 = meio, 2 = frente (parallax da câmera).
  depth?: 0 | 1 | 2;
  scale?: number;
  rotate?: number;
  // Perspectiva 3D com balanço lento (cards e números).
  tilt?: boolean;
  // Amplitude (px) da flutuação contínua.
  float?: number;
  z?: number;
  // Impacto: tremida da câmera + pulso do fundo + partículas.
  impact?: boolean;
  // Som do evento (nome em "sfx" do vídeo). Ignorado se não houver arquivo.
  sfx?: string;
};

export type TextMode = "word" | "line" | "letter";
export type TextEffect = "scale" | "slide" | "mask" | "blur" | "impact" | "type";
export type FontRoleName = "sans" | "display" | "mono" | "hand";

export type IconPreset =
  | "draw"
  | "pop"
  | "bounce"
  | "spin"
  | "spin3d"
  | "float"
  | "pulse"
  | "shake"
  | "drive"
  | "grow"
  | "rise"
  | "blink"
  | "trail"
  | "chartUp"
  | "fill"
  | "lock";

export type IconContainer = "circle" | "pill" | "none";

export type PhotoStyle = "cutout" | "torn" | "mask" | "strip" | "split" | "frame";

export type BarDatum = { label: string; value: number; display?: string; highlight?: boolean };

export type KElement =
  | (KBase & {
      type: "text";
      text: string;
      mode?: TextMode;
      effect?: TextEffect;
      size?: number;
      weight?: number;
      font?: FontRoleName;
      color?: "text" | "accent" | "ink" | "cream";
      maxWidth?: number;
      // Palavras destacadas com marca-texto na cor de acento.
      highlight?: string[];
      plate?: boolean;
      align?: "center" | "left";
      // Só o contorno (números gigantes vazados).
      outline?: boolean;
    })
  | (KBase & {
      type: "number";
      value: number;
      decimals?: number;
      prefix?: string;
      suffix?: string;
      size?: number;
      duration?: number;
      color?: "text" | "accent";
      particles?: boolean;
      label?: string;
    })
  | (KBase & {
      type: "bars";
      data: BarDatum[];
      width?: number;
      height?: number;
      max?: number;
      unit?: string;
      // Match cut: o valor dessa barra começa grande no centro e voa pro lugar.
      morphFrom?: number;
      bracket?: { from: number; to: number; label: string } & KBeat;
    })
  | (KBase & { type: "line"; points: number[]; labels?: string[]; width?: number; height?: number; unit?: string })
  | (KBase & {
      type: "icon";
      icon: string;
      preset?: IconPreset;
      size?: number;
      container?: IconContainer;
      color?: "text" | "accent" | "ink";
      label?: string;
    })
  | (KBase & {
      type: "icons";
      icons: string[];
      arrangement?: "grid" | "orbit" | "row";
      cols?: number;
      preset?: IconPreset;
      size?: number;
      container?: IconContainer;
      gap?: number;
      radius?: number;
    })
  | (KBase & {
      type: "card";
      title: string;
      subtitle?: string;
      kicker?: string;
      icon?: string;
      width?: number;
      height?: number;
      tone?: "glass" | "dark" | "accent";
    })
  | (KBase & {
      type: "shape";
      shape: ShapeName;
      w?: number;
      h?: number;
      toX?: number;
      toY?: number;
      color?: "text" | "accent" | "cream";
      stroke?: number;
    })
  // Prédio da analogia: andar = preço, elevador = inflação, escada = salário.
  | (KBase & {
      type: "building";
      floors?: number;
      width?: number;
      height?: number;
      elevator?: { floor?: number; moves?: KMove[]; cargo?: string[]; label?: string };
      stairs?: { floor?: number; moves?: KMove[]; label?: string; icon?: string };
      markers?: (KBeat & { floor: number; icon?: string; label: string })[];
      gap?: KBeat & { from: number; to: number; label: string };
      speed?: { label?: string };
    })
  // Ícone enorme, desfocado e translúcido, girando devagar no fundo.
  | (KBase & { type: "ghost"; icon: string; size?: number; opacity?: number; blur?: number })
  | (KBase & { type: "particles"; count?: number; spread?: number; kind?: "dots" | "sparks" | "confetti" })
  | (KBase & { type: "meter"; kind: "thermometer" | "gauge" | "progress"; value: number; label?: string; size?: number })
  | (KBase & {
      type: "photo";
      style: PhotoStyle;
      image?: ImageSpec;
      // "strip": várias fotos passando rápido.
      images?: { id: string; image: ImageSpec }[];
      width?: number;
      height?: number;
      // "mask": texto que recorta a foto.
      text?: string;
      // "split": lado da tela.
      side?: "left" | "right" | "top" | "bottom";
    })
  | (KBase & {
      type: "bubbles";
      // Comentários que pipocam em sequência.
      items: string[];
      every?: number;
      size?: number;
      spread?: number;
      step?: number;
    })
  | (KBase & { type: "ransom"; text: string; size?: number })
  | (KBase & { type: "clipping"; text: string; sub?: string; size?: number })
  | (KBase & { type: "label"; text: string; size?: number })
  // Palavra-chave grande (WireframeExplainer): branca, caixa alta, contorno preto grosso.
  | (KBase & { type: "keyword"; text: string; size?: number; alert?: boolean });

export type TransitionName = "zoom" | "whip" | "circle" | "wipe" | "glitch" | "flash" | "invert" | "slide" | "morph" | "cut";

export type PaletteSpec = string | string[];

export type KShot = {
  id: string;
  duration: number;
  // Transição de ENTRADA. Padrão: sorteada (sem repetir a anterior).
  transition?: TransitionName | "auto";
  // Com narração gravada: o corte pra este shot cai logo antes desta palavra (a 1ª
  // ocorrência depois do shot anterior). Sem isso, o corte vai pra 1ª palavra do shot.
  cutOnWord?: string;
  // false: nunca espelhar este shot na variação de layout (versões B/C).
  mirror?: boolean;
  // WireframeExplainer (versão C): palco 3D do shot. Sem isso, é deduzido dos elementos.
  wire?: WireSpec;
  palette?: PaletteSpec;
  // Pattern interrupt: fundo chapado no lugar do gradiente.
  interrupt?: "black" | "white" | "accent";
  camera?: { zoom?: [number, number]; rotate?: number };
  elements: KElement[];
};

export type WireStage = "head" | "bars" | "line" | "number" | "cart" | "core" | "building" | "food" | "cables" | "end";

export type WireSpec = {
  stage?: WireStage;
  // Acende o objeto em magenta (coisa negativa: preço subindo, imposto, carrinho caro).
  alert?: boolean;
  // Segundo (do shot) em que o miolo acende (cérebro da cabeça, compras do carrinho).
  alertAt?: KBeat;
  // Paredes de hexágono na sala.
  walls?: boolean;
  // Câmera: órbita (graus), distância e altura (a escala vem do enquadramento automático;
  // vale a proporção início→fim), travelling. O alvo é sempre o centro do palco (fitCamera).
  camera?: {
    orbit?: [number, number];
    radius?: [number, number];
    height?: [number, number];
    travel?: [number, number, number];
    fov?: number;
  };
  // Etiqueta de preço holográfica (palco "cart").
  priceTag?: boolean;
  // Etiquetas presas nos cabos (palco "cables"), cada uma entrando numa palavra.
  tags?: (KBeat & { text: string; alert?: boolean; big?: boolean })[];
};

export type KScene = {
  id: string;
  narration: string;
  shots: KShot[];
};

export type KBackground = {
  palette?: PaletteSpec;
  speed?: number;
  // Vídeo de fundo em loop (em public/), no lugar do gradiente.
  video?: string;
};

export type KineticExplainerProps = {
  brand: Brand;
  scenes: KScene[];
  background?: KBackground;
  images?: Record<string, ImageAsset> | null;
  audioSrc?: string | null;
  captions?: Caption[] | null;
  music?: MusicSpec | null;
  // Nome do efeito -> arquivo em public/ (ex: { "whoosh": "sfx/whoosh.mp3" }).
  sfx?: Record<string, string> | null;
  showCaptions?: boolean;
  // Só pra scripts/check-numbers.mjs: registra no log o texto dos números de cada quadro.
  numberCheck?: boolean;
  // Seed do sorteio de transições (padrão: id da marca). Versões do mesmo roteiro usam seeds diferentes.
  seed?: string;
  // Variação de layout (espelha parte dos shots).
  layout?: { seed?: string; mirror?: number } | null;
};

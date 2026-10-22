import React from "react";
import { AbsoluteFill, getStaticFiles, interpolate, OffthreadVideo, random, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { useCollageTheme } from "../../brand/collageTheme";
import { withAlpha } from "../../brand/color";
import { PrintOverlay } from "../collage/PrintOverlay";
import { tornOutline } from "../collage/torn";
import { MonoLabel } from "./KineticText";
import { EASE, useShot } from "./motion";

// Trecho de filme como comentário: sempre mudo (volume 0), sem logos nem letreiros. Três formas,
// nunca a mesma duas vezes seguidas no vídeo:
//  - card (style "frame" | "torn"): 1–2 s dentro de moldura (card branco) ou papel rasgado, com
//    retícula leve, grão e rótulo mono;
//  - bg: 1–2 s de fundo em tela cheia, escurecido (~40% de brilho) e com blur leve, com o motion
//    graphics e os textos do shot por cima;
//  - strip: 2–3 cortes de ~0,5 s em sequência rápida, com flash branco a cada corte.
// O vídeo começa no segundo `from` do arquivo (startFrom, em quadros do vídeo final) quando o
// trecho entra.

export const CLIP_MIN_S = 1;
export const CLIP_MAX_S = 2;
export const clipSeconds = (s?: number) => Math.min(CLIP_MAX_S, Math.max(CLIP_MIN_S, s ?? 1.6));
export const DEFAULT_CLIP = "clips/odisseia-trailer.mp4";

// Strip: cada corte tem ~0,5 s (0,3 a 0,8).
export type ClipCut = { from: number; duration?: number };
export const cutSeconds = (s?: number) => Math.min(0.8, Math.max(0.3, s ?? 0.5));
export const stripSeconds = (cuts: ClipCut[] = []) => cuts.reduce((acc, c) => acc + cutSeconds(c.duration), 0);

// Forma do trecho (a regra de não repetir a forma em seguida usa isso).
export type ClipForm = "card" | "bg" | "strip";
export const clipForm = (style?: string): ClipForm => (style === "bg" ? "bg" : style === "strip" ? "strip" : "card");

// O trailer é 16:9 com faixas pretas (conteúdo em 2,39:1): zoom que tira as faixas.
const LETTERBOX = 360 / 268;

// Mesmo tratamento de impressão das fotos (o filtro #k-sharpen fica na raiz do KineticExplainer).
const PRINT = "url(#k-sharpen) saturate(0.78) contrast(1.08)";

const useClipFile = (src: string) => getStaticFiles().some((f) => f.name === src);

// Na revisão automática o vídeo não é decodificado (só a caixa conta). Sem o arquivo, um aviso
// no lugar (a revisão também acusa o arquivo faltando).
const Fallback: React.FC<{ readonly src: string; readonly check?: boolean }> = ({ src, check }) =>
  check ? (
    <AbsoluteFill style={{ backgroundColor: "#15121c" }} />
  ) : (
    <AbsoluteFill style={{ backgroundColor: "#15121c", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontFamily: "monospace", fontSize: 26, textAlign: "center", padding: 30 }}>
      sem clipe — salve o arquivo em public/{src}
    </AbsoluteFill>
  );

// Um corte do arquivo: monta só enquanto aparece (+ `tail` quadros pra saída do elemento).
const Cut: React.FC<{ readonly src: string; readonly start: number; readonly len: number; readonly from: number; readonly tail?: number; readonly style: React.CSSProperties }> = ({
  src,
  start,
  len,
  from,
  tail = 0,
  style,
}) => {
  const { fps } = useVideoConfig();
  return (
    <Sequence from={start} durationInFrames={len + tail} layout="none">
      <OffthreadVideo src={staticFile(src)} startFrom={Math.round(from * fps)} volume={0} muted style={{ width: "100%", height: "100%", objectFit: "cover", ...style }} />
    </Sequence>
  );
};

type CardProps = {
  readonly seed: string;
  readonly at: number;
  readonly from: number;
  readonly seconds: number;
  readonly src?: string;
  readonly style?: "frame" | "torn";
  readonly width?: number;
  readonly height?: number;
  readonly label?: string;
  readonly focus?: [number, number];
  // Zoom dentro da moldura (corta as faixas pretas do formato cinema).
  readonly crop?: number;
};

// Moldura padrão no formato cinema (2,39:1): com o trailer em letterbox, o quadro inteiro
// aparece sem zoom extra (o vídeo cobre a moldura e as faixas pretas ficam de fora).
export const KClip: React.FC<CardProps> = ({ seed, at, from, seconds, src = DEFAULT_CLIP, style = "frame", width = 860, height = 360, label, focus = [0.5, 0.5], crop = 1.02 }) => {
  const { c } = useCollageTheme();
  const { check } = useShot();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const exists = useClipFile(src);
  const start = Math.round(at * fps);
  const len = Math.round(seconds * fps);
  // Ken Burns leve durante o trecho.
  const zoom = crop * interpolate(frame, [start, start + len], [1, 1.06], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const objectPosition = `${focus[0] * 100}% ${focus[1] * 100}%`;
  // +10 quadros: o trecho continua andando durante a saída do elemento.
  const video =
    check || !exists ? (
      <Fallback src={src} check={check} />
    ) : (
      <Cut src={src} start={start} len={len} from={from} tail={10} style={{ objectPosition, scale: zoom, transformOrigin: objectPosition, filter: PRINT }} />
    );
  const tag = label ? (
    <div style={{ position: "absolute", left: 26, top: -24, zIndex: 2 }}>
      <MonoLabel text={label} at={at + 0.12} size={26} />
    </div>
  ) : null;

  if (style === "torn") {
    const outer = tornOutline(width, height, `${seed}-o`, { amp: 8 });
    const inner = tornOutline(width, height, `${seed}-i`, { amp: 8, inset: 11 });
    return (
      <div style={{ position: "relative", width, height, filter: "drop-shadow(0 30px 40px rgba(26,4,32,0.45))" }}>
        <AbsoluteFill style={{ backgroundColor: c.cream, clipPath: `path("${outer}")` }} />
        <AbsoluteFill style={{ clipPath: `path("${inner}")`, overflow: "hidden", backgroundColor: "#000" }}>
          {video}
          <PrintOverlay halftone={0.12} grain={0.3} />
        </AbsoluteFill>
        {tag}
      </div>
    );
  }

  return (
    <div style={{ position: "relative", width: width + 20, height: height + 20, padding: 10, borderRadius: 34, backgroundColor: "#fff", boxShadow: `0 40px 80px rgba(26,4,32,0.45), 0 0 0 3px ${withAlpha(c.accent, 0.35)}` }}>
      <div style={{ position: "relative", width, height, borderRadius: 26, overflow: "hidden", backgroundColor: "#000" }}>
        {video}
        <PrintOverlay halftone={0.12} grain={0.3} />
      </div>
      {tag}
    </div>
  );
};

// ------------------------------------------------------------------ bg

type BgProps = {
  readonly at: number;
  readonly from: number;
  readonly seconds: number;
  readonly src?: string;
  // Ponto do quadro (0–1) que fica no centro da tela (o vertical recorta ~1/4 da largura).
  readonly focus?: [number, number];
  // Brilho (padrão 0,4) e blur (px, padrão 5).
  readonly dim?: number;
  readonly blur?: number;
};

// Fundo em tela cheia, atrás de tudo do shot (fora da câmera virtual): entra em fade rápido,
// desliza num zoom lento e sai em fade, voltando pro fundo da marca.
export const KClipBg: React.FC<BgProps> = ({ at, from, seconds, src = DEFAULT_CLIP, focus = [0.5, 0.5], dim = 0.4, blur = 5 }) => {
  const { c } = useCollageTheme();
  const { check } = useShot();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const exists = useClipFile(src);
  const start = Math.round(at * fps);
  const len = Math.round(seconds * fps);
  const op = Math.min(
    interpolate(frame, [start, start + 6], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
    interpolate(frame, [start + len - 2, start + len + 8], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
  );
  if (check || frame < start || op <= 0) {
    return null;
  }
  const zoom = LETTERBOX * 1.04 * interpolate(frame, [start, start + len + 8], [1.06, 1.16], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE.outQuart });
  const objectPosition = `${focus[0] * 100}% ${focus[1] * 100}%`;
  return (
    <AbsoluteFill style={{ opacity: op, overflow: "hidden", backgroundColor: "#07060c" }}>
      {exists ? (
        <Cut src={src} start={start} len={len} from={from} tail={10} style={{ objectPosition, scale: zoom, transformOrigin: objectPosition, filter: `brightness(${dim}) blur(${blur}px) saturate(0.95) contrast(1.15)` }} />
      ) : (
        <Fallback src={src} />
      )}
      {/* tom da marca por cima + vinheta: o fundo nunca briga com os textos */}
      <AbsoluteFill style={{ background: `linear-gradient(180deg, ${withAlpha(c.accent, 0.16)} 0%, transparent 45%, ${withAlpha("#07060c", 0.5)} 100%)`, mixBlendMode: "soft-light" }} />
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 45%, transparent 35%, rgba(7,6,12,0.6) 100%)" }} />
      <PrintOverlay halftone={0.1} grain={0.35} />
    </AbsoluteFill>
  );
};

// ------------------------------------------------------------------ strip

const STRIP_FLASH = 3;

type StripProps = {
  readonly seed: string;
  readonly at: number;
  readonly cuts: ClipCut[];
  readonly src?: string;
  readonly width?: number;
  readonly height?: number;
  readonly label?: string;
  readonly focus?: [number, number];
};

// Faixa de filme (perfurações em cima e embaixo) com 2–3 cortes rápidos: cada corte entra com
// flash branco, punch de zoom e um tranco lateral. Bolinhas marcam o corte atual.
export const KClipStrip: React.FC<StripProps> = ({ seed, at, cuts, src = DEFAULT_CLIP, width = 960, height = 400, label, focus = [0.5, 0.5] }) => {
  const { c } = useCollageTheme();
  const { check } = useShot();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const exists = useClipFile(src);
  const start = Math.round(at * fps);
  const lens = cuts.map((ct) => Math.round(cutSeconds(ct.duration) * fps));
  const starts = lens.map((_, i) => start + lens.slice(0, i).reduce((a, b) => a + b, 0));
  const k = starts.reduce((acc, s, i) => (frame >= s ? i : acc), 0);
  const local = frame - starts[k];
  const flash = interpolate(local, [0, STRIP_FLASH], [0.9, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const punch = interpolate(local, [0, lens[k] ?? 1], [1.16, 1.03], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE.outExpo });
  const jolt = (random(`${seed}-jolt-${k}`) - 0.5) * 36 * interpolate(local, [0, 5], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const objectPosition = `${focus[0] * 100}% ${focus[1] * 100}%`;
  const band = 46;
  const holes = Math.floor(width / 46);
  const perf = (top: boolean) => (
    <div style={{ position: "absolute", left: 0, right: 0, [top ? "top" : "bottom"]: 0, height: band, display: "flex", justifyContent: "space-around", alignItems: "center", padding: "0 10px" }}>
      {Array.from({ length: holes }, (_, i) => (
        <div key={i} style={{ width: 20, height: 15, borderRadius: 4, backgroundColor: withAlpha(c.cream, 0.82) }} />
      ))}
    </div>
  );
  return (
    <div style={{ position: "relative", width, height: height + band * 2, translate: `${jolt}px 0`, backgroundColor: "#0c0a10", borderRadius: 14, boxShadow: `0 40px 80px rgba(26,4,32,0.5), 0 0 0 3px ${withAlpha(c.accent, 0.35)}` }}>
      {perf(true)}
      <div style={{ position: "absolute", left: 14, right: 14, top: band, height, borderRadius: 8, overflow: "hidden", backgroundColor: "#000" }}>
        {check || !exists ? (
          <Fallback src={src} check={check} />
        ) : (
          cuts.map((ct, i) => (
            <Cut key={i} src={src} start={starts[i]} len={lens[i]} from={ct.from} tail={i === cuts.length - 1 ? 10 : 0} style={{ objectPosition, scale: punch * LETTERBOX * 1.02, transformOrigin: objectPosition, filter: PRINT }} />
          ))
        )}
        <PrintOverlay halftone={0.12} grain={0.34} />
        <AbsoluteFill style={{ backgroundColor: "#fff", opacity: flash }} />
        <div style={{ position: "absolute", right: 22, bottom: 18, display: "flex", gap: 8 }}>
          {cuts.map((_, i) => (
            <div key={i} style={{ width: i === k ? 34 : 12, height: 12, borderRadius: 12, backgroundColor: withAlpha("#ffffff", i === k ? 1 : 0.5) }} />
          ))}
        </div>
      </div>
      {perf(false)}
      {label ? (
        <div style={{ position: "absolute", left: 26, top: -30, zIndex: 2 }}>
          <MonoLabel text={label} at={at + 0.08} size={26} />
        </div>
      ) : null}
    </div>
  );
};

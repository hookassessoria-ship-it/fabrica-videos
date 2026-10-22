import React from "react";
import { AbsoluteFill, getStaticFiles, interpolate, OffthreadVideo, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { useCollageTheme } from "../../brand/collageTheme";
import { withAlpha } from "../../brand/color";
import { PrintOverlay } from "../collage/PrintOverlay";
import { tornOutline } from "../collage/torn";
import { MonoLabel } from "./KineticText";
import { useShot } from "./motion";

// Trecho de filme como comentário: sempre mudo (volume 0), 1–2 s, dentro de uma moldura
// (card branco) ou de papel rasgado, com retícula leve, grão e rótulo mono. Nunca em tela
// cheia crua. O vídeo começa no segundo `from` do arquivo (startFrom, em quadros do vídeo
// final) quando o elemento entra.

export const CLIP_MIN_S = 1;
export const CLIP_MAX_S = 2;
export const clipSeconds = (s?: number) => Math.min(CLIP_MAX_S, Math.max(CLIP_MIN_S, s ?? 1.6));
export const DEFAULT_CLIP = "clips/odisseia-trailer.mp4";

// Mesmo tratamento de impressão das fotos (o filtro #k-sharpen fica na raiz do KineticExplainer).
const PRINT = "url(#k-sharpen) saturate(0.78) contrast(1.08)";

type Props = {
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
export const KClip: React.FC<Props> = ({ seed, at, from, seconds, src = DEFAULT_CLIP, style = "frame", width = 860, height = 360, label, focus = [0.5, 0.5], crop = 1.02 }) => {
  const { c } = useCollageTheme();
  const { check } = useShot();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const start = Math.round(at * fps);
  const len = Math.round(seconds * fps);
  // Ken Burns leve durante o trecho.
  const zoom = crop * interpolate(frame, [start, start + len], [1, 1.06], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const objectPosition = `${focus[0] * 100}% ${focus[1] * 100}%`;
  const exists = getStaticFiles().some((f) => f.name === src);
  // Na revisão automática o vídeo não é decodificado (só a caixa conta). Sem o arquivo, um
  // aviso no lugar (a revisão também acusa o arquivo faltando).
  const video = check ? (
    <AbsoluteFill style={{ backgroundColor: "#15121c" }} />
  ) : !exists ? (
    <AbsoluteFill style={{ backgroundColor: "#15121c", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontFamily: "monospace", fontSize: 26, textAlign: "center", padding: 30 }}>
      sem clipe — salve o arquivo em public/{src}
    </AbsoluteFill>
  ) : (
    // +10 quadros: o trecho continua andando durante a saída do elemento.
    <Sequence from={start} durationInFrames={len + 10} layout="none">
      <OffthreadVideo
        src={staticFile(src)}
        startFrom={Math.round(from * fps)}
        volume={0}
        muted
        style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition, scale: zoom, transformOrigin: objectPosition, filter: PRINT }}
      />
    </Sequence>
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

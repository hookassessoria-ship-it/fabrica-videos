import React from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { useCollageTheme } from "../../brand/collageTheme";
import { withAlpha } from "../../brand/color";
import type { ImageAsset } from "../../templates/collageTypes";
import type { PhotoStyle } from "../../templates/kineticTypes";
import { PrintOverlay } from "../collage/PrintOverlay";
import { tornOutline } from "../collage/torn";
import { EASE, useShot } from "./motion";

// Leve nitidez (fotos do Pixabay chegam com no máximo 1280px) + tratamento de impressão.
// O filtro SVG #k-sharpen é definido uma vez na raiz do KineticExplainer.
const PRINT = "url(#k-sharpen) saturate(0.82) contrast(1.06)";
const STRIP_FRAMES = 9; // 0,3s por foto

const fit = (w: number, h: number, maxW: number, maxH: number) => {
  const k = Math.min(maxW / w, maxH / h);
  return { w: Math.round(w * k), h: Math.round(h * k) };
};

// Ken Burns: a foto nunca fica parada.
const useZoom = (at: number, to = 1.1) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { frames } = useShot();
  return interpolate(frame, [at * fps, Math.max(at * fps + 1, frames)], [1.0, to], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
};

const Missing: React.FC<{ readonly w: number; readonly h: number }> = ({ w, h }) => {
  const { f } = useCollageTheme();
  return (
    <div style={{ width: w, height: h, borderRadius: 30, border: "4px dashed rgba(255,255,255,0.6)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontFamily: f.mono, fontSize: 26, textAlign: "center", padding: 30 }}>
      sem foto — rode npm run images:fetch
    </div>
  );
};

// `origin`: ponto de foco ("x% y%"); o recorte e o zoom (Ken Burns) vão na direção dele.
const photoImg = (src: string, zoom: number, origin = "50% 50%", extra?: React.CSSProperties) => (
  <Img src={staticFile(src)} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: origin, transformOrigin: origin, scale: zoom, filter: PRINT, ...extra }} />
);

type Props = {
  readonly style: PhotoStyle;
  readonly seed: string;
  readonly at: number;
  readonly asset?: ImageAsset;
  readonly strip?: (ImageAsset | undefined)[];
  readonly width?: number;
  readonly height?: number;
  readonly text?: string;
  readonly side?: "left" | "right" | "top" | "bottom";
  readonly focus?: [number, number];
  readonly zoomTo?: number;
};

export const KPhoto: React.FC<Props> = ({ style, seed, at, asset, strip = [], width, height, text = "", side = "left", focus, zoomTo }) => {
  const { c, f } = useCollageTheme();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const zoom = useZoom(at, zoomTo);
  const origin = focus ? `${focus[0] * 100}% ${focus[1] * 100}%` : "50% 50%";

  if (style === "strip") {
    const w = width ?? 760;
    const h = height ?? 900;
    const k = Math.max(0, Math.floor((frame - at * fps) / STRIP_FRAMES));
    const idx = Math.min(strip.length - 1, k);
    const cur = strip[idx];
    const local = frame - at * fps - idx * STRIP_FRAMES;
    const flash = interpolate(local, [0, 3], [0.85, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    const z = interpolate(local, [0, STRIP_FRAMES], [1.18, 1.04], { extrapolateRight: "clamp", easing: EASE.outExpo });
    return (
      <div style={{ position: "relative", width: w, height: h, borderRadius: 40, overflow: "hidden", boxShadow: "0 40px 80px rgba(26,4,32,0.4)", border: `3px solid ${withAlpha("#ffffff", 0.6)}` }}>
        {cur ? photoImg(cur.file, idx === strip.length - 1 ? zoom * 1.04 : z, origin) : <Missing w={w} h={h} />}
        <PrintOverlay />
        <AbsoluteFill style={{ backgroundColor: "#fff", opacity: flash }} />
        <div style={{ position: "absolute", left: 24, bottom: 20, display: "flex", gap: 8 }}>
          {strip.map((_, i) => (
            <div key={i} style={{ width: i === idx ? 34 : 12, height: 12, borderRadius: 12, backgroundColor: withAlpha("#ffffff", i === idx ? 1 : 0.5) }} />
          ))}
        </div>
      </div>
    );
  }

  if (!asset) {
    return <Missing w={width ?? 600} h={height ?? 600} />;
  }

  if (style === "cutout") {
    const src = asset.cut ?? asset.file;
    const { w, h } = fit(asset.cutWidth ?? asset.width, asset.cutHeight ?? asset.height, width ?? 620, height ?? 620);
    return (
      <div style={{ position: "relative", width: w, height: h, scale: zoom * 0.97, filter: "drop-shadow(0 30px 40px rgba(26,4,32,0.45))" }}>
        <Img src={staticFile(src)} style={{ width: "100%", height: "100%", filter: PRINT }} />
        <PrintOverlay maskSrc={staticFile(src)} halftone={0.12} grain={0.3} />
      </div>
    );
  }

  if (style === "torn") {
    const { w, h } = fit(asset.width, asset.height, width ?? 760, height ?? 760);
    const outer = tornOutline(w, h, `${seed}-o`, { amp: 7 });
    const inner = tornOutline(w, h, `${seed}-i`, { amp: 7, inset: 10 });
    return (
      <div style={{ position: "relative", width: w, height: h, filter: "drop-shadow(0 30px 40px rgba(26,4,32,0.4))" }}>
        <AbsoluteFill style={{ backgroundColor: c.cream, clipPath: `path("${outer}")` }} />
        <AbsoluteFill style={{ clipPath: `path("${inner}")`, overflow: "hidden" }}>
          {photoImg(asset.file, zoom, origin)}
          <PrintOverlay />
        </AbsoluteFill>
      </div>
    );
  }

  if (style === "frame") {
    // Com largura e altura, o card tem exatamente esse tamanho (a foto é recortada).
    const { w, h } = width && height ? { w: width, h: height } : fit(asset.width, asset.height, width ?? 520, height ?? 520);
    return (
      <div style={{ position: "relative", width: w + 20, height: h + 20, padding: 10, borderRadius: 34, backgroundColor: "#fff", boxShadow: "0 40px 80px rgba(26,4,32,0.4)" }}>
        <div style={{ position: "relative", width: w, height: h, borderRadius: 26, overflow: "hidden" }}>
          {photoImg(asset.file, zoom, origin)}
          <PrintOverlay />
        </div>
      </div>
    );
  }

  if (style === "split") {
    const vertical = side === "left" || side === "right";
    const w = width ?? (vertical ? 540 : 1080);
    const h = height ?? (vertical ? 1920 : 960);
    const p = interpolate(frame, [at * fps, at * fps + 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE.outExpo });
    const hide = (1 - p) * 100;
    const clip = { left: `inset(0 ${hide}% 0 0)`, right: `inset(0 0 0 ${hide}%)`, top: `inset(0 0 ${hide}% 0)`, bottom: `inset(${hide}% 0 0 0)` }[side];
    return (
      <div style={{ position: "relative", width: w, height: h, clipPath: clip, overflow: "hidden" }}>
        {photoImg(asset.file, zoom * 1.02, origin)}
        <PrintOverlay />
        <div style={{ position: "absolute", [vertical ? (side === "left" ? "right" : "left") : side === "top" ? "bottom" : "top"]: 0, ...(vertical ? { top: 0, bottom: 0, width: 6 } : { left: 0, right: 0, height: 6 }), backgroundColor: c.accent, boxShadow: `0 0 30px ${c.accent}` }} />
      </div>
    );
  }

  // mask: a foto aparece DENTRO das letras.
  const w = width ?? 980;
  const letters = Math.max(1, [...text].length);
  const fontSize = height ?? Math.min(560, (w / letters) * 2.05);
  const h = Math.round(fontSize * 1.05);
  const id = `kmask-${seed}`;
  const reveal = interpolate(frame, [at * fps, at * fps + 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE.outExpo });
  const textProps = {
    x: w / 2,
    y: h * 0.86,
    textAnchor: "middle" as const,
    fontFamily: f.display,
    fontSize,
    letterSpacing: fontSize * 0.02,
  };
  return (
    <div style={{ position: "relative", width: w, height: h }}>
      <svg width={0} height={0} style={{ position: "absolute" }}>
        <defs>
          <clipPath id={id} clipPathUnits="userSpaceOnUse">
            <text {...textProps}>{text}</text>
          </clipPath>
        </defs>
      </svg>
      <div style={{ position: "absolute", inset: 0, clipPath: `url(#${id})`, filter: "drop-shadow(0 20px 30px rgba(26,4,32,0.45))" }}>
        <div style={{ position: "absolute", inset: 0, translate: `0 ${(1 - reveal) * 30}%` }}>{photoImg(asset.file, zoom * 1.05, origin)}</div>
        <PrintOverlay />
      </div>
      <svg width={w} height={h} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
        <text {...textProps} fill="none" stroke="#fff" strokeWidth={5} opacity={0.9} data-bigtext="box">
          {text}
        </text>
      </svg>
    </div>
  );
};

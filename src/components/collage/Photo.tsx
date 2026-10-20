import React from "react";
import { AbsoluteFill, Img, interpolate, random, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { useCollageTheme } from "../../brand/collageTheme";
import type { ImageAsset, Treatment } from "../../templates/collageTypes";
import { PrintOverlay } from "./PrintOverlay";
import { tornOutline } from "./torn";

// "Impresso": ~20% menos saturado e um pouco mais de contraste.
const PRINT_FILTER = "saturate(0.8) contrast(1.06)";
const BORDER = 16;

const fit = (w: number, h: number, maxW: number, maxH: number) => {
  const k = Math.min(maxW / w, maxH / h);
  return { w: Math.round(w * k), h: Math.round(h * k) };
};

// Zoom lento durante a cena (Ken Burns): 1 -> 1.06.
const useKenBurns = (durationSec: number, to = 1.06) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return interpolate(frame, [0, durationSec * fps], [1, to], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
};

type PhotoProps = {
  readonly asset?: ImageAsset;
  readonly treatment: Treatment;
  readonly seed: string;
  readonly maxW: number;
  readonly maxH: number;
  readonly durationSec: number;
};

export const photoSize = (asset: ImageAsset | undefined, treatment: Treatment, maxW: number, maxH: number) => {
  if (!asset) {
    return { w: maxW, h: Math.round(maxW * 1.2) > maxH ? maxH : Math.round(maxW * 1.2) };
  }
  if (treatment === "cutout") {
    return fit(asset.stickerWidth ?? asset.cutWidth ?? asset.width, asset.stickerHeight ?? asset.cutHeight ?? asset.height, maxW, maxH);
  }
  return fit(asset.width, asset.height, maxW, maxH);
};

export const Photo: React.FC<PhotoProps> = ({ asset, treatment, seed, maxW, maxH, durationSec }) => {
  const { c, f } = useCollageTheme();
  const zoom = useKenBurns(durationSec);
  const { w, h } = photoSize(asset, treatment, maxW, maxH);

  if (!asset) {
    return (
      <div
        style={{
          width: w,
          height: h,
          border: `3px dashed ${c.textMuted}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: c.textMuted,
          fontFamily: f.mono,
          fontSize: 26,
          textAlign: "center",
          padding: 40,
        }}
      >
        sem foto — rode npm run images:fetch
      </div>
    );
  }

  const img = (src: string) => (
    <Img
      src={staticFile(src)}
      style={{ width: "100%", height: "100%", objectFit: "cover", scale: zoom, filter: PRINT_FILTER }}
    />
  );

  if (treatment === "cutout") {
    const src = asset.sticker ?? asset.cut ?? asset.file;
    return (
      <div style={{ position: "relative", width: w, height: h, scale: zoom * 0.98 }}>
        <Img src={staticFile(src)} style={{ width: "100%", height: "100%", filter: PRINT_FILTER }} />
        <PrintOverlay maskSrc={staticFile(src)} halftone={0.14} grain={0.4} />
      </div>
    );
  }

  if (treatment === "taped") {
    const tape = (k: string, left: string, top: number, rot: number) => (
      <div
        style={{
          position: "absolute",
          left,
          top,
          width: 170,
          height: 50,
          translate: "-50% -50%",
          rotate: `${rot + (random(`${seed}-${k}`) - 0.5) * 8}deg`,
          backgroundColor: c.tape,
          clipPath: "polygon(0% 8%, 4% 0%, 96% 4%, 100% 14%, 97% 30%, 100% 50%, 96% 70%, 100% 92%, 94% 100%, 6% 96%, 0% 84%, 4% 64%, 0% 44%, 3% 24%)",
        }}
      />
    );
    return (
      <div style={{ position: "relative", width: w + BORDER * 2, height: h + BORDER * 2, backgroundColor: c.paperWhite, padding: BORDER }}>
        <div style={{ position: "relative", width: w, height: h, overflow: "hidden" }}>
          {img(asset.file)}
          <PrintOverlay />
        </div>
        <PrintOverlay halftone={0} grain={0.25} />
        {tape("t1", "14%", 4, -34)}
        {tape("t2", "86%", 4, 32)}
      </div>
    );
  }

  // torn: faixa creme (papel por baixo) + foto rasgada por cima.
  const outer = tornOutline(w, h, `${seed}-outer`, { amp: 7 });
  const inner = tornOutline(w, h, `${seed}-inner`, { amp: 7, inset: 10 });
  return (
    <div style={{ position: "relative", width: w, height: h }}>
      <AbsoluteFill style={{ backgroundColor: c.cream, clipPath: `path("${outer}")` }} />
      <AbsoluteFill style={{ clipPath: `path("${inner}")`, overflow: "hidden" }}>
        {img(asset.file)}
        <PrintOverlay />
      </AbsoluteFill>
    </div>
  );
};

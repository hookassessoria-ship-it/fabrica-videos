import React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";

// Retícula de halftone + grão por cima da foto (texturas geradas uma vez em public/textures).
// `maskSrc`: limita as texturas ao formato de um PNG transparente (fotos recortadas).
export const PrintOverlay: React.FC<{ readonly maskSrc?: string; readonly halftone?: number; readonly grain?: number }> = ({
  maskSrc,
  halftone = 0.16,
  grain = 0.32,
}) => {
  const mask = maskSrc
    ? {
        maskImage: `url(${maskSrc})`,
        WebkitMaskImage: `url(${maskSrc})`,
        maskSize: "100% 100%",
        WebkitMaskSize: "100% 100%",
      }
    : {};
  return (
    <AbsoluteFill style={{ pointerEvents: "none", ...mask }}>
      <Img src={staticFile("textures/halftone.png")} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: halftone }} />
      <Img src={staticFile("textures/grain.png")} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: grain }} />
    </AbsoluteFill>
  );
};

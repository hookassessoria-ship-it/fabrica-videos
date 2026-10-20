import React from "react";
import { AbsoluteFill } from "remotion";
import { STAGE_H, STAGE_W } from "./Layer";

// Palco SVG em tela cheia. Visuais desenham em coordenadas 1080x1920.
export const Stage: React.FC<{ readonly children: React.ReactNode }> = ({ children }) => (
  <AbsoluteFill>
    <svg
      viewBox={`0 0 ${STAGE_W} ${STAGE_H}`}
      width="100%"
      height="100%"
      style={{ position: "absolute", inset: 0, overflow: "visible" }}
    >
      {children}
    </svg>
  </AbsoluteFill>
);

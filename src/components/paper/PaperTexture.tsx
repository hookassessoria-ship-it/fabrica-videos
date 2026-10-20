import React from "react";
import { AbsoluteFill } from "remotion";
import { STAGE_H, STAGE_W } from "./Layer";
import { mottleTexture } from "./textures";

// Fundo de papel cartão: cor base + manchas suaves + grão + fibras claras.
// O grão e as fibras são os padrões #pc-noise / #pc-fiber do <PaperDefs>.
export const PaperTexture: React.FC<{ readonly color: string; readonly strength?: number }> = ({
  color,
  strength = 1,
}) => {
  return (
    <AbsoluteFill style={{ backgroundColor: color }}>
      <svg viewBox={`0 0 ${STAGE_W} ${STAGE_H}`} width="100%" height="100%" preserveAspectRatio="none">
        <image href={mottleTexture()} x={0} y={0} width={STAGE_W} height={STAGE_H} preserveAspectRatio="none" opacity={0.05 * strength} />
        <rect width={STAGE_W} height={STAGE_H} fill="url(#pc-noise)" opacity={0.07 * strength} />
        <rect width={STAGE_W} height={STAGE_H} fill="url(#pc-fiber)" opacity={0.5 * strength} />
      </svg>
    </AbsoluteFill>
  );
};

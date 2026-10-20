import React from "react";
import { useTheme } from "../../brand/theme";
import { Cut } from "./Cut";
import { roughPolygon, roughRect } from "./shapes";
import { type Tone, toneFill } from "./tones";

type ArrowProps = {
  readonly seed: string;
  readonly length?: number;
  readonly thickness?: number;
  // 0 = direita, 90 = baixo, -90 = cima.
  readonly angle?: number;
  readonly tone?: Tone;
};

// Seta de papel. Âncora no centro.
export const Arrow: React.FC<ArrowProps> = ({ seed, length = 300, thickness = 70, angle = 0, tone = "light" }) => {
  const theme = useTheme();
  const L = length;
  const t = thickness;
  const hw = t * 2.1;
  const hl = t * 1.5;
  return (
    <g transform={`rotate(${angle})`}>
      <Cut>
        <path
          d={roughPolygon(
            [
              [-L / 2, -t / 2],
              [L / 2 - hl, -t / 2],
              [L / 2 - hl, -hw / 2],
              [L / 2, 0],
              [L / 2 - hl, hw / 2],
              [L / 2 - hl, t / 2],
              [-L / 2, t / 2],
            ],
            seed,
            { radius: 6, wobble: 1.5 },
          )}
          fill={toneFill(theme, tone)}
        />
      </Cut>
    </g>
  );
};

type StrikeProps = {
  readonly seed: string;
  readonly length?: number;
  readonly thickness?: number;
  readonly angle?: number;
  readonly tone?: Tone;
  // 0..1: tira sendo colada da esquerda pra direita.
  readonly progress?: number;
};

// Tira de papel "riscando" algo. Âncora no centro.
export const Strike: React.FC<StrikeProps> = ({ seed, length = 420, thickness = 40, angle = -28, tone = "accent", progress = 1 }) => {
  const theme = useTheme();
  if (progress <= 0) {
    return null;
  }
  const L = length * Math.min(1, progress);
  return (
    <g transform={`rotate(${angle})`}>
      <Cut depth={3}>
        <path d={roughRect(-length / 2, -thickness / 2, L, thickness, seed, { radius: 8, wobble: 2 })} fill={toneFill(theme, tone)} />
      </Cut>
    </g>
  );
};

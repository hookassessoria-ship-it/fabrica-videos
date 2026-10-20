import React from "react";
import { useTheme } from "../../brand/theme";
import { Cut } from "./Cut";
import { PaperText } from "./PaperText";
import { roughCircle, roughPolygon } from "./shapes";
import { type Tone, toneFill, toneInk } from "./tones";

type LabelProps = {
  readonly seed: string;
  readonly text: string;
  readonly sub?: string;
  readonly width?: number;
  readonly height?: number;
  readonly tone?: Tone;
  readonly size?: number;
  readonly subSize?: number;
  readonly font?: "text" | "numbers";
  // Barbante saindo do furo até (dx, dy) em coordenadas locais. Omitir = sem barbante.
  readonly string?: { dx: number; dy: number };
};

// Etiqueta de preço (ponta à esquerda com furo). Âncora no centro.
export const Label: React.FC<LabelProps> = ({
  seed,
  text,
  sub,
  width = 360,
  height = 140,
  tone = "accent",
  size,
  subSize,
  font = "numbers",
  string,
}) => {
  const theme = useTheme();
  const { c } = theme;
  const w = width;
  const h = height;
  const tip = h * 0.38;
  const holeX = -w / 2 + tip * 0.78;
  const textX = tip * 0.4;
  const mainSize = size ?? h * (sub ? 0.42 : 0.5);
  return (
    <>
      {string ? (
        <path
          className="pc-noedge"
          d={`M${holeX} 0 Q${holeX + string.dx * 0.4} ${string.dy * 0.1 + 30} ${holeX + string.dx} ${string.dy}`}
          stroke={c.edge}
          strokeWidth={3.5}
          fill="none"
          strokeLinecap="round"
        />
      ) : null}
      <Cut>
        <path
          d={roughPolygon(
            [
              [-w / 2 + tip, -h / 2],
              [w / 2, -h / 2],
              [w / 2, h / 2],
              [-w / 2 + tip, h / 2],
              [-w / 2, 0],
            ],
            seed,
            { radius: 9, wobble: 2 },
          )}
          fill={toneFill(theme, tone)}
        />
        <path d={roughCircle(holeX, 0, h * 0.075, `${seed}-hole`)} fill={c.hole} />
        <PaperText
          text={text}
          x={textX}
          y={sub ? -h * 0.13 : 0}
          size={mainSize}
          font={font}
          weight={700}
          color={toneInk(theme, tone)}
        />
        {sub ? (
          <PaperText
            text={sub}
            x={textX}
            y={h * 0.25}
            size={subSize ?? h * 0.2}
            weight={600}
            color={toneInk(theme, tone)}
            opacity={0.85}
          />
        ) : null}
      </Cut>
    </>
  );
};

import React from "react";
import { random } from "remotion";
import { withAlpha } from "../../brand/color";
import { useTheme } from "../../brand/theme";
import { Cut } from "./Cut";
import { PaperText } from "./PaperText";
import { roughRect } from "./shapes";
import { type Tone, toneFill, toneInk } from "./tones";

// Pedaço de fita adesiva translúcida (não tem borda nem grão de papel).
export const Tape: React.FC<{
  readonly x?: number;
  readonly y?: number;
  readonly w?: number;
  readonly h?: number;
  readonly rotate?: number;
  readonly seed: string;
}> = ({ x = 0, y = 0, w = 150, h = 42, rotate = 0, seed }) => {
  const { c } = useTheme();
  const teeth = 5;
  const pts: string[] = [];
  for (let i = 0; i <= teeth; i++) {
    const yy = -h / 2 + (h / teeth) * i;
    pts.push(`${(-w / 2 + (i % 2 === 0 ? 0 : 5) + random(`${seed}-l${i}`) * 3).toFixed(1)},${yy.toFixed(1)}`);
  }
  for (let i = teeth; i >= 0; i--) {
    const yy = -h / 2 + (h / teeth) * i;
    pts.push(`${(w / 2 - (i % 2 === 0 ? 0 : 5) - random(`${seed}-r${i}`) * 3).toFixed(1)},${yy.toFixed(1)}`);
  }
  return (
    <polygon
      className="pc-noedge pc-nograin"
      points={pts.join(" ")}
      fill={withAlpha(c.edge, 0.3)}
      transform={`translate(${x} ${y}) rotate(${rotate})`}
    />
  );
};

type PaperCardProps = {
  readonly seed: string;
  readonly width: number;
  readonly height: number;
  readonly tone?: Tone;
  readonly title?: string;
  readonly subtitle?: string;
  readonly titleSize?: number;
  readonly subtitleSize?: number;
  readonly titleFont?: "text" | "numbers";
  readonly titleY?: number;
  readonly subtitleY?: number;
  readonly maxChars?: number;
  readonly tape?: boolean;
  readonly children?: React.ReactNode;
};

// Placa de papel com título/subtítulo. Âncora no centro.
export const PaperCard: React.FC<PaperCardProps> = ({
  seed,
  width,
  height,
  tone = "raised",
  title,
  subtitle,
  titleSize = 84,
  subtitleSize = 40,
  titleFont = "text",
  titleY,
  subtitleY,
  maxChars,
  tape = false,
  children,
}) => {
  const theme = useTheme();
  const ink = toneInk(theme, tone);
  const hasBoth = Boolean(title && subtitle);
  return (
    <>
      <Cut>
        <path d={roughRect(-width / 2, -height / 2, width, height, seed)} fill={toneFill(theme, tone)} />
        {title ? (
          <PaperText
            text={title}
            y={titleY ?? (hasBoth ? -height * 0.12 : 0)}
            size={titleSize}
            font={titleFont}
            color={ink}
            maxChars={maxChars}
          />
        ) : null}
        {subtitle ? (
          <PaperText
            text={subtitle}
            y={subtitleY ?? height * 0.26}
            size={subtitleSize}
            weight={600}
            color={tone === "light" ? theme.c.ink : tone === "accent" ? theme.c.text : theme.c.textMuted}
            maxChars={maxChars ? Math.round(maxChars * 1.6) : undefined}
          />
        ) : null}
        {children}
      </Cut>
      {tape ? <Tape seed={`${seed}-tape`} y={-height / 2} rotate={random(`${seed}-tr`) * 10 - 5} /> : null}
    </>
  );
};

import React from "react";
import { useTheme } from "../../brand/theme";

// Quebra simples por número de caracteres (SVG não quebra linha sozinho).
export const wrapText = (text: string, maxChars: number) => {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (next.length > maxChars && line) {
      lines.push(line);
      line = w;
    } else {
      line = next;
    }
  }
  if (line) {
    lines.push(line);
  }
  return lines;
};

type PaperTextProps = {
  readonly text: string | string[];
  readonly x?: number;
  readonly y?: number;
  readonly size: number;
  readonly weight?: number;
  // "text" = fonte de texto da marca; "numbers" = fonte dos números grandes.
  readonly font?: "text" | "numbers";
  readonly color?: string;
  readonly anchor?: "start" | "middle" | "end";
  readonly lineHeight?: number;
  readonly letterSpacing?: number;
  readonly maxChars?: number;
  readonly className?: string;
  readonly opacity?: number;
};

export const PaperText: React.FC<PaperTextProps> = ({
  text,
  x = 0,
  y = 0,
  size,
  weight = 800,
  font = "text",
  color,
  anchor = "middle",
  lineHeight = 1.08,
  letterSpacing,
  maxChars,
  className,
  opacity,
}) => {
  const theme = useTheme();
  const lines = Array.isArray(text) ? text : maxChars ? wrapText(text, maxChars) : [text];
  const step = size * lineHeight;
  return (
    <text
      x={x}
      y={y}
      fontFamily={font === "numbers" ? theme.font.numbers : theme.font.text}
      fontSize={size}
      fontWeight={weight}
      fill={color ?? theme.c.text}
      textAnchor={anchor}
      dominantBaseline="central"
      letterSpacing={letterSpacing}
      className={className}
      opacity={opacity}
    >
      {lines.map((l, i) => (
        <tspan key={i} x={x} dy={i === 0 ? (-(lines.length - 1) * step) / 2 : step}>
          {l}
        </tspan>
      ))}
    </text>
  );
};

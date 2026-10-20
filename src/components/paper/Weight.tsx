import React from "react";
import { mix } from "../../brand/color";
import { useTheme } from "../../brand/theme";
import { Cut } from "./Cut";
import { PaperText } from "./PaperText";
import { roughCircle, roughPolygon } from "./shapes";

type WeightProps = {
  readonly seed: string;
  readonly title: string;
  readonly subtitle?: string;
  readonly width?: number;
  readonly height?: number;
  readonly titleSize?: number;
};

// Contrapeso de papel pendurado. Âncora: ponto do gancho (topo).
export const Weight: React.FC<WeightProps> = ({ seed, title, subtitle, width = 460, height = 300, titleSize }) => {
  const { c } = useTheme();
  const w = width;
  const h = height;
  const ring = 30;
  const top = ring * 2 - 6;
  return (
    <Cut depth={4}>
      <path d={roughCircle(0, ring, ring, `${seed}-ring`)} fill={mix(c.paperRaised, c.edge, 0.15)} />
      <path d={roughCircle(0, ring, ring * 0.45, `${seed}-hole`)} fill={c.hole} />
      <path
        d={roughPolygon(
          [
            [-w * 0.34, top],
            [w * 0.34, top],
            [w / 2, top + h],
            [-w / 2, top + h],
          ],
          seed,
          { radius: 14, wobble: 2.5 },
        )}
        fill={c.paperRaised}
      />
      <PaperText
        text={title}
        y={top + h * (subtitle ? 0.44 : 0.52)}
        size={titleSize ?? h * 0.26}
        font="numbers"
        weight={700}
        color={c.text}
        maxChars={10}
      />
      {subtitle ? (
        <PaperText text={subtitle} y={top + h * 0.82} size={h * 0.085} weight={600} color={c.textMuted} />
      ) : null}
    </Cut>
  );
};

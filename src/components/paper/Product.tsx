import React from "react";
import { mix } from "../../brand/color";
import { useTheme } from "../../brand/theme";
import { Cut } from "./Cut";
import { PaperText } from "./PaperText";
import { roughPolygon, roughRect } from "./shapes";

export type ProductKind = "rice" | "milk" | "beans" | "box";

const DEFAULT_LABEL: Record<ProductKind, string> = {
  rice: "ARROZ",
  milk: "LEITE",
  beans: "FEIJÃO",
  box: "",
};

type ProductProps = {
  readonly kind: ProductKind;
  readonly seed: string;
  // Altura total. Âncora: centro da base.
  readonly size?: number;
  readonly label?: string;
};

export const Product: React.FC<ProductProps> = ({ kind, seed, size = 150, label }) => {
  const { c } = useTheme();
  const text = label ?? DEFAULT_LABEL[kind];
  const H = size;

  if (kind === "milk") {
    const W = H * 0.5;
    const bodyTop = -H * 0.72;
    return (
      <Cut>
        <path d={roughRect(-W / 2, bodyTop, W, -bodyTop, `${seed}-body`, { radius: 5 })} fill={c.lightPaper} />
        <path
          d={roughPolygon(
            [
              [-W / 2, bodyTop],
              [-W * 0.32, -H * 0.9],
              [W * 0.32, -H * 0.9],
              [W / 2, bodyTop],
            ],
            `${seed}-gable`,
            { radius: 3 },
          )}
          fill={mix(c.lightPaper, c.edge, 0.55)}
        />
        <path d={roughRect(-W * 0.32, -H, W * 0.64, H * 0.11, `${seed}-fin`, { radius: 3 })} fill={c.lightPaper} />
        <path d={roughRect(-W / 2, -H * 0.5, W, H * 0.2, `${seed}-band`, { radius: 2 })} fill={c.accent} />
        <PaperText text={text} y={-H * 0.4} size={H * 0.1} weight={800} color={c.text} />
      </Cut>
    );
  }

  if (kind === "box") {
    const W = H * 0.8;
    return (
      <Cut>
        <path d={roughRect(-W / 2, -H, W, H, `${seed}-box`, { radius: 6 })} fill={c.paperRaised} />
        <path d={roughRect(-W / 2, -H * 0.62, W, H * 0.26, `${seed}-band`, { radius: 3 })} fill={c.accent} />
        {text ? <PaperText text={text} y={-H * 0.49} size={H * 0.13} weight={800} color={c.text} /> : null}
      </Cut>
    );
  }

  // Sacos: arroz (claro) e feijão (escuro).
  const W = H * 0.68;
  const fill = kind === "rice" ? c.lightPaper : c.paperRaised;
  const crimp: [number, number][] = [];
  const teeth = 6;
  for (let i = 0; i <= teeth; i++) {
    const x = -W * 0.42 + (W * 0.84 * i) / teeth;
    crimp.push([x, -H + (i % 2 === 0 ? 0 : H * 0.04)]);
  }
  return (
    <Cut>
      <path
        d={roughPolygon(
          [...crimp, [W / 2, -H * 0.62], [W * 0.47, 0], [-W * 0.47, 0], [-W / 2, -H * 0.62]],
          `${seed}-bag`,
          { radius: 8, step: 999 },
        )}
        fill={fill}
      />
      <path d={roughRect(-W / 2 + 2, -H * 0.56, W - 4, H * 0.26, `${seed}-band`, { radius: 4 })} fill={c.accent} />
      <PaperText text={text} y={-H * 0.43} size={H * 0.13} weight={800} color={c.text} />
    </Cut>
  );
};

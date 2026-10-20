import React from "react";
import { mix } from "../../brand/color";
import { useTheme } from "../../brand/theme";
import { Cut } from "./Cut";
import { PaperText } from "./PaperText";
import { Product, type ProductKind } from "./Product";
import { roughCircle, roughRect } from "./shapes";

type ElevatorProps = {
  readonly seed: string;
  readonly width?: number;
  readonly height?: number;
  readonly contents?: ProductKind[];
  // 0..1: tiras de "velocidade" embaixo da cabine quando sobe rápido.
  readonly speed?: number;
  readonly display?: string;
};

// Cabine do elevador (cor de acento) com produtos dentro. Âncora: centro do piso.
export const Elevator: React.FC<ElevatorProps> = ({
  seed,
  width = 200,
  height = 170,
  contents = [],
  speed = 0,
  display,
}) => {
  const { c } = useTheme();
  const w = width;
  const h = height;
  const inner = { x: -w / 2 + 14, y: -h + 34, w: w - 28, h: h - 46 };
  const productSize = inner.h * 0.82;
  const spacing = inner.w / Math.max(1, contents.length);

  return (
    <>
      {speed > 0.05 ? (
        <Cut depth={1} edge={3}>
          {[-0.3, 0, 0.3].map((k, i) => {
            const len = (60 + i * 25) * speed;
            return (
              <path
                key={i}
                d={roughRect(k * w - 6, 16 + i * 6, 12, len, `${seed}-sp${i}`, { radius: 6 })}
                fill={mix(c.edge, c.paper, 0.45)}
              />
            );
          })}
        </Cut>
      ) : null}
      <Cut depth={3}>
        <rect x={-6} y={-h - 26} width={12} height={30} fill={c.accentShade} />
        <path d={roughCircle(0, -h - 30, 12, `${seed}-ring`)} fill={c.accentShade} />
        <path d={roughRect(-w / 2, -h, w, h, `${seed}-car`, { radius: 10 })} fill={c.accent} />
        <path d={roughRect(inner.x, inner.y, inner.w, inner.h, `${seed}-win`, { radius: 6 })} fill={c.hole} />
        <path d={roughRect(-w * 0.18, -h + 6, w * 0.36, 22, `${seed}-disp`, { radius: 4 })} fill={c.accentShade} />
        {display ? (
          <PaperText text={display} y={-h + 17} size={17} font="numbers" weight={700} color={c.text} />
        ) : (
          <polygon points={`-8,${-h + 23} 8,${-h + 23} 0,${-h + 11}`} fill={c.text} />
        )}
        {contents.map((kind, i) => (
          <g key={`${kind}-${i}`} transform={`translate(${inner.x + spacing * (i + 0.5)} ${inner.y + inner.h - 4})`}>
            <Product kind={kind} seed={`${seed}-p${i}`} size={productSize} />
          </g>
        ))}
      </Cut>
    </>
  );
};

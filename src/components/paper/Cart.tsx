import React from "react";
import { mix } from "../../brand/color";
import { useTheme } from "../../brand/theme";
import { Cut } from "./Cut";
import { Product, type ProductKind } from "./Product";
import { roughCircle, roughPolygon, roughRect } from "./shapes";

type CartProps = {
  readonly seed: string;
  readonly width?: number;
  readonly items?: ProductKind[];
  // Rotação das rodas (graus), pra quando o carrinho anda.
  readonly wheelTurn?: number;
};

// Geometria pública pra pendurar etiquetas etc.
export const cartGeometry = (width = 420) => {
  const r = width * 0.075;
  const basketBottom = -2 * r - 46;
  const basketTop = basketBottom - width * 0.46;
  return {
    wheelR: r,
    basketBottom,
    basketTop,
    // Ponta da alça (à esquerda, em cima).
    handle: { x: -width * 0.6, y: basketTop - width * 0.12 },
    topRight: { x: width * 0.5, y: basketTop },
  };
};

// Carrinho de supermercado de papel. Âncora: centro, no chão.
export const Cart: React.FC<CartProps> = ({ seed, width = 420, items = [], wheelTurn = 0 }) => {
  const { c } = useTheme();
  const w = width;
  const g = cartGeometry(w);
  const { basketTop: bt, basketBottom: bb, wheelR: r } = g;
  const xl = (y: number) => -w * 0.42 + ((y - bt) / (bb - bt)) * (w * 0.1);
  const xr = (y: number) => w * 0.5 - ((y - bt) / (bb - bt)) * (w * 0.08);

  const holes: React.ReactNode[] = [];
  const rows = 3;
  const cols = 6;
  for (let ri = 0; ri < rows; ri++) {
    const y0 = bt + 22 + ri * ((bb - bt - 34) / rows);
    const hh = (bb - bt - 34) / rows - 12;
    const x0 = xl(y0 + hh / 2) + 18;
    const x1 = xr(y0 + hh / 2) - 18;
    const cw = (x1 - x0) / cols;
    for (let ci = 0; ci < cols; ci++) {
      holes.push(
        <path
          key={`${ri}-${ci}`}
          d={roughRect(x0 + ci * cw + 5, y0, cw - 10, hh, `${seed}-h${ri}-${ci}`, { radius: 4, wobble: 1 })}
          fill={c.hole}
        />,
      );
    }
  }

  const productSize = w * 0.32;
  const spacing = (w * 0.8) / Math.max(1, items.length);

  return (
    <>
      {items.map((kind, i) => (
        <g key={`${kind}-${i}`} transform={`translate(${-w * 0.36 + spacing * (i + 0.5)} ${bt + productSize * 0.55}) rotate(${(i % 2 === 0 ? -1 : 1) * 6})`}>
          <Product kind={kind} seed={`${seed}-it${i}`} size={productSize} />
        </g>
      ))}
      <Cut>
        <path
          d={roughPolygon(
            [
              [g.handle.x, g.handle.y],
              [g.handle.x + 22, g.handle.y - 8],
              [xl(bt) + 14, bt + 10],
              [xl(bt) - 6, bt + 26],
            ],
            `${seed}-handle`,
            { radius: 6 },
          )}
          fill={c.accentShade}
        />
        <path d={roughRect(g.handle.x - 34, g.handle.y - 22, 70, 30, `${seed}-grip`, { radius: 12 })} fill={c.paperRaised} />
        <path d={roughRect(-w * 0.36, -2 * r - 22, w * 0.8, 18, `${seed}-frame`, { radius: 6 })} fill={c.accentShade} />
        <path d={roughRect(xl(bb) + 18, bb - 6, 16, -2 * r - 7 - bb, `${seed}-legl`, { radius: 5 })} fill={c.accentShade} />
        <path d={roughRect(xr(bb) - 34, bb - 6, 16, -2 * r - 7 - bb, `${seed}-legr`, { radius: 5 })} fill={c.accentShade} />
        <path
          d={roughPolygon(
            [
              [xl(bt), bt],
              [xr(bt), bt],
              [xr(bb), bb],
              [xl(bb), bb],
            ],
            `${seed}-basket`,
            { radius: 12 },
          )}
          fill={c.accent}
        />
        {holes}
      </Cut>
      {[-w * 0.26, w * 0.32].map((x, i) => (
        <g key={i} transform={`translate(${x} ${-r}) rotate(${wheelTurn})`}>
          <Cut depth={2}>
            <path d={roughCircle(0, 0, r, `${seed}-wh${i}`)} fill={c.paperRaised} />
            <path d={roughRect(-r * 0.12, -r * 0.8, r * 0.24, r * 1.6, `${seed}-sp${i}`, { radius: 3 })} fill={mix(c.paperRaised, c.edge, 0.2)} />
            <path d={roughCircle(0, 0, r * 0.3, `${seed}-hub${i}`)} fill={c.hole} />
          </Cut>
        </g>
      ))}
    </>
  );
};

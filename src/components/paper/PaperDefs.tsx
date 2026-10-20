import React from "react";
import { useTheme } from "../../brand/theme";
import { fiberTexture, grainTexture, inkMaskTexture } from "./textures";

// Sombras por profundidade de camada: quanto mais "alto" o recorte,
// maior e mais suave a sombra no papel de baixo.
const SHADOWS = [
  { depth: 1, dy: 5, blur: 4, opacity: 0.8, contact: 0.7 },
  { depth: 2, dy: 12, blur: 9, opacity: 0.85, contact: 0.75 },
  { depth: 3, dy: 20, blur: 14, opacity: 0.88, contact: 0.8 },
  { depth: 4, dy: 32, blur: 22, opacity: 0.9, contact: 0.8 },
];

// Regras das 3 passadas de cada recorte (ver Cut.tsx):
// 1) borda: tudo pintado na cor da borda com traço grosso -> silhueta "colada"
// 2) preenchimento normal
// 3) grão do papel por cima, em overlay, só dentro da silhueta
const css = (edge: string) => `
.pc-root { --pc-edge-color: ${edge}; }
.pc-edge, .pc-edge * {
  fill: var(--pc-edge-color) !important;
  stroke: var(--pc-edge-color) !important;
  stroke-width: var(--pc-edge-w) !important;
  stroke-linejoin: round !important;
  stroke-linecap: round !important;
  stroke-dasharray: none !important;
  opacity: 1 !important;
}
.pc-grain { mix-blend-mode: overlay; opacity: 0.85; }
.pc-grain, .pc-grain * {
  fill: url(#pc-noise) !important;
  stroke: url(#pc-noise) !important;
  stroke-width: var(--pc-edge-w) !important;
  stroke-linejoin: round !important;
  stroke-dasharray: none !important;
}
.pc-edge .pc-noedge, .pc-grain .pc-noedge, .pc-grain .pc-nograin { display: none; }
`;

export const PaperDefs: React.FC = () => {
  const { c } = useTheme();
  return (
    <svg width={0} height={0} style={{ position: "absolute" }} aria-hidden>
      <style>{css(c.edge)}</style>
      <defs>
        <pattern id="pc-noise" patternUnits="userSpaceOnUse" width={256} height={256}>
          <image href={grainTexture()} width={256} height={256} />
        </pattern>
        <pattern id="pc-fiber" patternUnits="userSpaceOnUse" width={512} height={512}>
          <image href={fiberTexture()} width={512} height={512} />
        </pattern>
        <pattern id="pc-ink" patternUnits="userSpaceOnUse" width={256} height={256}>
          <image href={inkMaskTexture()} width={256} height={256} />
        </pattern>
        {SHADOWS.map((s) => (
          <filter
            key={s.depth}
            id={`pc-shadow-${s.depth}`}
            x="-30%"
            y="-30%"
            width="160%"
            height="170%"
            colorInterpolationFilters="sRGB"
          >
            <feDropShadow dx={0} dy={s.dy} stdDeviation={s.blur} floodColor="#000" floodOpacity={s.opacity} />
            <feDropShadow dx={0} dy={1.5} stdDeviation={1} floodColor="#000" floodOpacity={s.contact} />
          </filter>
        ))}
      </defs>
    </svg>
  );
};

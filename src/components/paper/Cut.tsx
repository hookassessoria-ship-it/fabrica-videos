import React, { createContext, useContext } from "react";
import { useTheme } from "../../brand/theme";
import { useLayerDepth } from "./Layer";

type Pass = "fill" | "edge" | "grain";
const PassContext = createContext<Pass>("fill");

type CutProps = {
  readonly children: React.ReactNode;
  // Profundidade da sombra (1–4). Padrão: a profundidade da <Layer> atual.
  readonly depth?: number;
  // Largura da borda (px pra fora da silhueta). 0 = sem borda.
  readonly edge?: number;
  readonly edgeColor?: string;
  readonly grain?: boolean;
};

// Recorte de papel: desenha `children` (SVG) três vezes — borda grossa,
// preenchimento e grão — e aplica sombra. Recortes aninhados viram
// "colagens" dentro do recorte de fora.
export const Cut: React.FC<CutProps> = ({ children, depth, edge, edgeColor, grain = true }) => {
  const pass = useContext(PassContext);
  const theme = useTheme();
  const layerDepth = useLayerDepth();

  if (pass !== "fill") {
    return <>{children}</>;
  }

  const d = depth ?? Math.max(1, Math.min(4, layerDepth));
  const strokeWidth = (edge ?? theme.edgeWidth) * 2;
  const style = {
    "--pc-edge-w": `${strokeWidth}px`,
    ...(edgeColor ? { "--pc-edge-color": edgeColor } : {}),
  } as React.CSSProperties;
  // Espessura do cartão: a lateral do recorte aparece embaixo, mais escura.
  const thickness = strokeWidth > 0 ? 2 + d * 1.5 : 0;
  const sideStyle = { "--pc-edge-color": theme.c.edgeSide } as React.CSSProperties;

  return (
    <g filter={d > 0 ? `url(#pc-shadow-${d})` : undefined} style={style}>
      {thickness > 0 ? (
        <PassContext.Provider value="edge">
          <g className="pc-edge" transform={`translate(0 ${thickness})`} style={sideStyle}>
            {children}
          </g>
        </PassContext.Provider>
      ) : null}
      {strokeWidth > 0 ? (
        <PassContext.Provider value="edge">
          <g className="pc-edge">{children}</g>
        </PassContext.Provider>
      ) : null}
      {children}
      {grain ? (
        <PassContext.Provider value="grain">
          <g className="pc-grain">{children}</g>
        </PassContext.Provider>
      ) : null}
    </g>
  );
};

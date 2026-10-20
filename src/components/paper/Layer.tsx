import React, { createContext, useContext } from "react";

export type CameraState = {
  // Centro da vista em coordenadas do palco (1080x1920) e zoom.
  x: number;
  y: number;
  zoom: number;
};

export const STAGE_W = 1080;
export const STAGE_H = 1920;

const CameraContext = createContext<CameraState>({ x: STAGE_W / 2, y: STAGE_H / 2, zoom: 1 });
const DepthContext = createContext(2);

export const CameraProvider = CameraContext.Provider;
export const useCamera = () => useContext(CameraContext);
export const useLayerDepth = () => useContext(DepthContext);

// Quanto cada camada acompanha a câmera: fundo quase parado, frente mais rápida.
export const PARALLAX = [0.08, 0.3, 0.6, 1, 1.3];

type LayerProps = {
  // 0 = fundo ... 4 = mais perto da câmera
  readonly depth: 0 | 1 | 2 | 3 | 4;
  readonly children: React.ReactNode;
};

export const Layer: React.FC<LayerProps> = ({ depth, children }) => {
  const cam = useCamera();
  const k = PARALLAX[depth];
  const zoom = 1 + (cam.zoom - 1) * (0.4 + 0.6 * k);
  const cx = STAGE_W / 2 + (cam.x - STAGE_W / 2) * k;
  const cy = STAGE_H / 2 + (cam.y - STAGE_H / 2) * k;
  return (
    <DepthContext.Provider value={depth}>
      <g
        transform={`translate(${STAGE_W / 2} ${STAGE_H / 2}) scale(${zoom}) translate(${-cx} ${-cy})`}
      >
        {children}
      </g>
    </DepthContext.Provider>
  );
};

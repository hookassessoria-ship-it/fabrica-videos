import React from "react";
import { random } from "remotion";
import { mix } from "../../brand/color";
import { useTheme } from "../../brand/theme";
import { Cut } from "./Cut";
import { Layer } from "./Layer";
import { roughPolygon, roughRect, tornRect } from "./shapes";

export type BackdropVariant = "sheets" | "city" | "grid" | "plain";

// Camadas de fundo (profundidade 1 e 2) feitas de folhas de cartão escuro
// com bordas rasgadas. O fundo-base (profundidade 0) é o <PaperTexture>.
export const Backdrop: React.FC<{ readonly variant?: BackdropVariant; readonly seed: string }> = ({
  variant = "sheets",
  seed,
}) => {
  const { c } = useTheme();
  const tornEdge = mix(c.edge, c.paper, 0.72);
  const r = (k: string, min: number, max: number) => min + random(`${seed}-${k}`) * (max - min);

  const sheetTop = r("st", 150, 230);
  const sheetRot = r("sr", -1.6, 1.6);

  return (
    <>
      {variant !== "plain" ? (
        <Layer depth={1}>
          <g transform={`rotate(${sheetRot} 540 960)`}>
            <Cut depth={1} edge={2.5} edgeColor={tornEdge}>
              <path d={tornRect(-80, sheetTop, 1240, 1440, `${seed}-sheet`, 7)} fill={c.paper} />
            </Cut>
          </g>
          {variant === "grid" ? <GridLines top={sheetTop} rot={sheetRot} /> : null}
        </Layer>
      ) : null}

      {variant === "city" ? (
        <>
          <Skyline seed={seed} />
          <Layer depth={2}>
            <Cut depth={2} edge={2.5} edgeColor={tornEdge}>
              <path d={tornRect(-90, 1246, 1260, 760, `${seed}-street`, 6)} fill={c.paperRaised} />
            </Cut>
          </Layer>
        </>
      ) : null}

      {variant === "sheets" ? (
        <Layer depth={1}>
          <BackSheet seed={seed} />
        </Layer>
      ) : null}

      {variant === "sheets" || variant === "grid" ? (
        <Layer depth={2}>
          <g transform={`rotate(${r("gr", -2.5, 2.5)} 540 1700)`}>
            <Cut depth={2} edge={2.5} edgeColor={tornEdge}>
              <path d={tornRect(-90, r("gy", 1480, 1540), 1260, 600, `${seed}-ground`, 8)} fill={c.paperRaised} />
            </Cut>
          </g>
          <Scraps seed={seed} />
        </Layer>
      ) : null}
    </>
  );
};

const GridLines: React.FC<{ readonly top: number; readonly rot: number }> = ({ top, rot }) => {
  const { c } = useTheme();
  const lines: React.ReactNode[] = [];
  for (let y = top + 60; y < top + 1400; y += 60) {
    lines.push(<line key={`h${y}`} x1={-60} x2={1140} y1={y} y2={y} />);
  }
  for (let x = 30; x < 1080; x += 60) {
    lines.push(<line key={`v${x}`} x1={x} x2={x} y1={top + 10} y2={top + 1420} />);
  }
  return (
    <g transform={`rotate(${rot} 540 960)`} stroke={mix(c.paper, c.edge, 0.12)} strokeWidth={2}>
      {lines}
    </g>
  );
};

// Retalhos irregulares que sobraram do recorte, nos cantos do quadro.
const Scraps: React.FC<{ readonly seed: string }> = ({ seed }) => {
  const { c } = useTheme();
  const spots: [number, number][] = [
    [96, 330],
    [992, 300],
    [60, 1190],
  ];
  return (
    <>
      {spots.map(([x, y], i) => {
        const size = 26 + random(`${seed}-cf${i}`) * 22;
        const n = 3 + Math.floor(random(`${seed}-cn${i}`) * 3);
        const pts: [number, number][] = [];
        for (let k = 0; k < n; k++) {
          const a = (k / n) * Math.PI * 2 + random(`${seed}-ca${i}${k}`) * 0.9;
          const r = size * (0.45 + random(`${seed}-cr${i}${k}`) * 0.55);
          pts.push([x + Math.cos(a) * r, y + Math.sin(a) * r]);
        }
        return (
          <Cut key={i} depth={1} edge={3}>
            <path d={roughPolygon(pts, `${seed}-cp${i}`, { radius: 2, wobble: 1.5, step: 999 })} fill={i === 1 ? c.accentMuted : mix(c.paperRaised, c.edge, 0.08)} />
          </Cut>
        );
      })}
    </>
  );
};

// Folha grande torta atrás do conteúdo (dá camada e textura ao quadro).
const BackSheet: React.FC<{ readonly seed: string }> = ({ seed }) => {
  const { c } = useTheme();
  const tornEdge = mix(c.edge, c.paper, 0.72);
  const left = random(`${seed}-bs`) > 0.5;
  const x = left ? -260 : 560;
  return (
    <g transform={`rotate(${left ? -7 : 6} ${x + 390} 760)`}>
      <Cut depth={1} edge={2.5} edgeColor={tornEdge}>
        <path d={tornRect(x, 430, 780, 680, `${seed}-backsheet`, 8)} fill={mix(c.paper, c.paperRaised, 0.55)} />
      </Cut>
    </g>
  );
};

// Silhueta de cidade em duas camadas (pra cenas com prédio).
const Skyline: React.FC<{ readonly seed: string }> = ({ seed }) => {
  const { c } = useTheme();
  const tornEdge = mix(c.edge, c.paper, 0.72);
  const row = (depth: 1 | 2, baseY: number, color: string, k: string, minH: number, maxH: number) => {
    const blocks: React.ReactNode[] = [];
    let x = -60;
    let i = 0;
    while (x < 1140) {
      const w = 90 + random(`${seed}-${k}w${i}`) * 110;
      const h = minH + random(`${seed}-${k}h${i}`) * (maxH - minH);
      blocks.push(<path key={i} d={roughRect(x, baseY - h, w, h + 700, `${seed}-${k}${i}`, { radius: 4 })} fill={color} />);
      x += w - 6;
      i++;
    }
    return (
      <Layer depth={depth}>
        <Cut depth={depth} edge={2.5} edgeColor={tornEdge}>
          {blocks}
        </Cut>
      </Layer>
    );
  };
  return (
    <>
      {row(1, 1000, c.paper, "far", 200, 520)}
      {row(2, 1420, mix(c.paper, c.paperRaised, 0.7), "near", 60, 260)}
    </>
  );
};

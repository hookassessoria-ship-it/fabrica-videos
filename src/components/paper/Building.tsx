import React from "react";
import { random } from "remotion";
import { mix } from "../../brand/color";
import { useTheme } from "../../brand/theme";
import { Cut } from "./Cut";
import { PaperText } from "./PaperText";
import { roughCircle, roughRect } from "./shapes";

export type BuildingProps = {
  readonly seed: string;
  readonly floors?: number;
  readonly floorHeight?: number;
  readonly width?: number;
  // Centro do poço do elevador, relativo ao centro do prédio.
  readonly shaftX?: number;
  readonly shaftWidth?: number;
  readonly numbers?: boolean;
  readonly highlightFloors?: number[];
  readonly sign?: string;
  // Corte transversal: troca as janelas por um vão escuro por andar (pra escada).
  readonly stairwell?: boolean;
};

const ROOF = 34;

// Geometria compartilhada pra posicionar elevador, cabos, escada etc.
export const buildingGeometry = ({
  floors = 10,
  floorHeight = 96,
  width = 560,
  shaftX = 110,
  shaftWidth = 230,
}: Partial<BuildingProps>) => ({
  floors,
  floorHeight,
  width,
  shaftX,
  shaftWidth,
  top: -floors * floorHeight,
  roofTop: -floors * floorHeight - ROOF - 10,
  pulleyY: -floors * floorHeight - ROOF - 34,
  // y do piso do andar `floor` (1 = térreo). Aceita fração.
  floorY: (floor: number) => -(floor - 1) * floorHeight,
  // Vão da escada (corte transversal), em x relativo ao centro.
  stairwell: { left: -width / 2 + 86, right: shaftX - shaftWidth / 2 - 26 },
});

// Prédio de cartolina com N andares e poço do elevador. Âncora: centro da base.
export const Building: React.FC<BuildingProps> = (props) => {
  const { seed, numbers = true, highlightFloors = [], sign, stairwell = false } = props;
  const { c } = useTheme();
  const g = buildingGeometry(props);
  const { floors, floorHeight: fh, width: W, shaftX, shaftWidth: sw } = g;
  const left = -W / 2;
  const windowsRight = shaftX - sw / 2 - 24;

  const windows: React.ReactNode[] = [];
  const labels: React.ReactNode[] = [];
  for (let f = 1; f <= floors; f++) {
    const yb = g.floorY(f);
    const wy = yb - fh * 0.78;
    const ww = fh * 0.46;
    const wh = fh * 0.54;
    const startX = left + 92;
    if (stairwell) {
      windows.push(
        <path
          key={`room${f}`}
          d={roughRect(g.stairwell.left - 8, yb - fh + 6, g.stairwell.right - g.stairwell.left + 16, fh - 12, `${seed}-room${f}`, { radius: 3, wobble: 1 })}
          fill={c.hole}
        />,
      );
    }
    for (let x = startX, i = 0; !stairwell && x + ww <= windowsRight; x += ww + 24, i++) {
      const lit = random(`${seed}-lit-${f}-${i}`) < 0.22;
      windows.push(
        <path
          key={`w${f}-${i}`}
          d={roughRect(x, wy, ww, wh, `${seed}-w${f}-${i}`, { radius: 3, wobble: 1.2 })}
          fill={lit ? mix(c.lightPaper, c.paperRaised, 0.62) : c.hole}
        />,
      );
    }
    windows.push(
      <path
        key={`sep${f}`}
        d={roughRect(left + 6, yb - 7, W - 12, 7, `${seed}-sep${f}`, { radius: 1, wobble: 0.8 })}
        fill={c.paper}
      />,
    );
    if (numbers) {
      const hi = highlightFloors.includes(f);
      labels.push(
        <PaperText
          key={`n${f}`}
          text={`${f}`}
          x={left + 46}
          y={yb - fh * 0.5}
          size={hi ? 40 : 32}
          font="numbers"
          weight={700}
          color={hi ? c.accentLight : c.textMuted}
        />,
      );
    }
  }

  return (
    <>
      <Cut depth={2}>
        <path d={roughRect(left, g.top - 6, W, -g.top + 6, `${seed}-facade`, { radius: 6, step: 120 })} fill={c.paperRaised} />
        {windows}
        {labels}
        <path
          d={roughRect(shaftX - sw / 2, g.top + 4, sw, -g.top - 10, `${seed}-shaft`, { radius: 4, wobble: 1.5, step: 140 })}
          fill={c.hole}
        />
        <rect className="pc-nograin" x={shaftX - sw / 2 + 16} y={g.top + 8} width={5} height={-g.top - 18} fill={mix(c.hole, c.edge, 0.18)} />
        <rect className="pc-nograin" x={shaftX + sw / 2 - 21} y={g.top + 8} width={5} height={-g.top - 18} fill={mix(c.hole, c.edge, 0.18)} />
      </Cut>
      <Cut depth={2}>
        <path d={roughRect(left - 20, g.roofTop, W + 40, ROOF + 4, `${seed}-roof`, { radius: 6 })} fill={c.paper} />
      </Cut>
      <Cut depth={3}>
        <path d={roughCircle(shaftX, g.pulleyY, 26, `${seed}-pulley`)} fill={c.paperRaised} />
        <path d={roughCircle(shaftX, g.pulleyY, 9, `${seed}-hub`)} fill={c.hole} />
      </Cut>
      {sign ? <BuildingSign seed={seed} text={sign} y={g.roofTop - 70} /> : null}
    </>
  );
};

const BuildingSign: React.FC<{ readonly seed: string; readonly text: string; readonly y: number }> = ({ seed, text, y }) => {
  const { c } = useTheme();
  const w = text.length * 26 + 70;
  return (
    <Cut depth={3}>
      <rect x={-w / 2 + 40} y={y + 30} width={10} height={44} fill={c.paperRaised} />
      <rect x={w / 2 - 50} y={y + 30} width={10} height={44} fill={c.paperRaised} />
      <path d={roughRect(-w / 2, y - 34, w, 68, `${seed}-sign`, { radius: 8 })} fill={c.accent} />
      <PaperText text={text} y={y} size={38} weight={800} color={c.text} />
    </Cut>
  );
};

// Cabo fino (não é recorte: sem borda nem grão).
export const Cable: React.FC<{
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
  readonly width?: number;
  readonly sag?: number;
}> = ({ x1, y1, x2, y2, width = 4, sag = 0 }) => {
  const { c } = useTheme();
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2 + sag;
  return (
    <path
      className="pc-noedge"
      d={`M${x1} ${y1} Q${mx} ${my} ${x2} ${y2}`}
      stroke={mix(c.edge, c.paperRaised, 0.25)}
      strokeWidth={width}
      fill="none"
      strokeLinecap="round"
    />
  );
};

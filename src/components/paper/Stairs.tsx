import React from "react";
import { mix } from "../../brand/color";
import { useTheme } from "../../brand/theme";
import { Cut } from "./Cut";
import { type Pt, roughPolygon, roughRect } from "./shapes";
import { type Tone, toneFill } from "./tones";

export type StairsProps = {
  readonly seed: string;
  // Lances (1 = escada reta; >1 = zigue-zague tipo escada de incêndio, 1 lance por andar).
  readonly flights?: number;
  readonly stepsPerFlight?: number;
  readonly flightWidth?: number;
  readonly flightHeight?: number;
  readonly tone?: Tone;
};


export const stairsGeometry = ({
  flights = 1,
  stepsPerFlight = 6,
  flightWidth = 260,
  flightHeight = 96,
}: Partial<StairsProps>) => {
  // Posição dos pés de quem sobe, `progress` em lances (ex: 2.5 = meio do 3º lance).
  // Avança degrau por degrau (com pulinho), no espírito stop-motion.
  const pointAt = (progress: number) => {
    const p = Math.max(0, Math.min(flights, progress));
    const k = Math.min(flights - 1, Math.floor(p));
    const f = p - k;
    const dir: 1 | -1 = k % 2 === 0 ? 1 : -1;
    const x0 = dir === 1 ? 0 : flightWidth;
    const stepF = f * stepsPerFlight;
    const step = Math.floor(stepF);
    const within = stepF - step;
    const hop = Math.sin(Math.min(1, within) * Math.PI) * 14;
    const fq = Math.min(1, (step + Math.min(1, within * 1.6)) / stepsPerFlight);
    return {
      x: x0 + dir * fq * flightWidth,
      y: -k * flightHeight - Math.min(stepsPerFlight, Math.ceil(stepF - 0.0001)) * (flightHeight / stepsPerFlight) - hop,
      facing: dir,
      flight: k,
    };
  };
  return { flights, stepsPerFlight, flightWidth, flightHeight, pointAt };
};

// Escada de papel. Âncora: canto inferior esquerdo, no chão.
export const Stairs: React.FC<StairsProps> = (props) => {
  const { seed, tone = "raised" } = props;
  const theme = useTheme();
  const { c } = theme;
  const g = stairsGeometry(props);
  const sw = g.flightWidth / g.stepsPerFlight;
  const sh = g.flightHeight / g.stepsPerFlight;
  const fill = toneFill(theme, tone);
  const tread = mix(fill, c.edge, 0.16);

  const flightsDrawn: React.ReactNode[] = [];
  for (let k = 0; k < g.flights; k++) {
    const dir = k % 2 === 0 ? 1 : -1;
    const x0 = dir === 1 ? 0 : g.flightWidth;
    const y0 = -k * g.flightHeight;
    const pts: Pt[] = [[x0, y0]];
    for (let s = 0; s < g.stepsPerFlight; s++) {
      pts.push([x0 + dir * s * sw, y0 - (s + 1) * sh]);
      pts.push([x0 + dir * (s + 1) * sw, y0 - (s + 1) * sh]);
    }
    // Bloco sólido de degraus (cunha), apoiado no patamar de baixo.
    pts.push([x0 + dir * g.flightWidth, y0]);
    flightsDrawn.push(
      <Cut key={`f${k}`} depth={2} edge={4}>
        <path d={roughPolygon(pts, `${seed}-f${k}`, { radius: 2, wobble: 1, step: 999, cornerJitter: 1 })} fill={fill} />
        {Array.from({ length: g.stepsPerFlight }).map((_, s) => (
          <rect
            key={s}
            x={Math.min(x0 + dir * s * sw, x0 + dir * (s + 1) * sw)}
            y={y0 - (s + 1) * sh}
            width={sw}
            height={5}
            fill={tread}
          />
        ))}
      </Cut>,
    );
    if (g.flights > 1 && k > 0) {
      flightsDrawn.push(
        <Cut key={`l${k}`} depth={2} edge={4}>
          <path d={roughRect(-14, y0, g.flightWidth + 28, 14, `${seed}-l${k}`, { radius: 3 })} fill={fill} />
        </Cut>,
      );
    }
  }
  return <>{flightsDrawn}</>;
};

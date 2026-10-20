import React from "react";
import { interpolate, useVideoConfig } from "remotion";
import { useTheme } from "../../brand/theme";
import { Cut } from "./Cut";
import { popSpring, useStopMotionFrame } from "./motion";
import { PaperText } from "./PaperText";
import { roughRect } from "./shapes";

export type BarDatum = {
  label: string;
  value: number;
  // Texto do valor (ex: "10,06%"). Padrão: o número com vírgula.
  display?: string;
  highlight?: boolean;
};

type BarsProps = {
  readonly seed: string;
  readonly data: BarDatum[];
  readonly width: number;
  readonly height: number;
  readonly max?: number;
  // Segundo em que a primeira barra começa a subir e intervalo entre barras.
  readonly at?: number;
  readonly stagger?: number;
  readonly gap?: number;
  readonly valueSize?: number;
  readonly labelSize?: number;
};

const BAR_SPRING = { damping: 12, stiffness: 110, mass: 0.9 };

// Barras de cartolina subindo uma por uma. Âncora: canto inferior esquerdo da base.
export const Bars: React.FC<BarsProps> = ({
  seed,
  data,
  width,
  height,
  max,
  at = 0.3,
  stagger = 0.35,
  gap = 0.26,
  valueSize = 34,
  labelSize = 34,
}) => {
  const { c } = useTheme();
  const frame = useStopMotionFrame();
  const { fps } = useVideoConfig();
  const top = max ?? Math.max(...data.map((d) => d.value)) * 1.08;
  const slot = width / data.length;
  const bw = slot * (1 - gap);

  return (
    <>
      <Cut depth={2} edge={5}>
        <path d={roughRect(-24, 0, width + 48, 16, `${seed}-base`, { radius: 4 })} fill={c.paperRaised} />
      </Cut>
      {data.map((d, i) => {
        const s = popSpring(frame, fps, Math.round((at + i * stagger) * fps), BAR_SPRING);
        if (s <= 0.001) {
          return null;
        }
        const h = Math.max(8, (d.value / top) * height * s);
        const x = i * slot + (slot - bw) / 2;
        const labelIn = interpolate(s, [0.55, 0.9], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        const vs = d.highlight ? valueSize * 1.45 : valueSize;
        return (
          <g key={d.label}>
            <Cut depth={d.highlight ? 3 : 2}>
              <path d={roughRect(x, -h, bw, h, `${seed}-b${i}`, { radius: 6, step: 60 })} fill={d.highlight ? c.accent : c.accentMuted} />
            </Cut>
            <g opacity={labelIn} transform={`translate(${x + bw / 2} ${-h - vs * 0.75 - (1 - labelIn) * 20})`}>
              <Cut depth={2} edge={4}>
                <PaperText
                  text={d.display ?? d.value.toString().replace(".", ",")}
                  size={vs}
                  font="numbers"
                  weight={700}
                  color={c.text}
                />
              </Cut>
            </g>
            <PaperText text={d.label} x={x + bw / 2} y={52} size={labelSize} weight={600} color={c.textMuted} />
          </g>
        );
      })}
    </>
  );
};

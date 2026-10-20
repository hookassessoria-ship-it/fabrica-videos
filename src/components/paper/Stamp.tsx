import React from "react";
import { Easing, interpolate, useVideoConfig } from "remotion";
import { mix } from "../../brand/color";
import { useTheme } from "../../brand/theme";
import { Cut } from "./Cut";
import { stepFrame, useStopMotionFrame } from "./motion";
import { PaperText } from "./PaperText";
import { roughCircle, roughRect } from "./shapes";

type StampProps = {
  readonly seed: string;
  readonly text: string;
  readonly sub?: string;
  // Segundo (relativo à cena) do impacto.
  readonly at?: number;
  readonly width?: number;
  readonly height?: number;
  readonly rotate?: number;
  readonly color?: string;
};

const DROP = 0.32;
const LIFT = 0.4;

// Tremida da batida: devolve deslocamento pra aplicar no palco.
export const useImpactShake = (at: number, strength = 14) => {
  const frame = useStopMotionFrame();
  const { fps } = useVideoConfig();
  const t = frame - Math.round(at * fps);
  if (t < 0 || t > 8) {
    return { x: 0, y: 0 };
  }
  const k = (1 - t / 8) * strength;
  return { x: (t % 4 === 0 ? 1 : -1) * k * 0.5, y: k };
};

// Carimbo descendo, batendo e deixando a marca de tinta. Âncora no centro da marca.
export const Stamp: React.FC<StampProps> = ({
  seed,
  text,
  sub,
  at = 0.6,
  width = 560,
  height = 250,
  rotate = -7,
  color,
}) => {
  const theme = useTheme();
  const { c } = theme;
  const frame = useStopMotionFrame();
  const { fps } = useVideoConfig();
  const impact = stepFrame(Math.round(at * fps));
  const ink = color ?? c.accent;

  const toolY = interpolate(
    frame,
    [impact - DROP * fps, impact, impact + 4, impact + 4 + LIFT * fps],
    [-900, 0, 0, -1100],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: [Easing.in(Easing.quad), Easing.linear, Easing.in(Easing.cubic)],
    },
  );
  const squash = frame >= impact && frame < impact + 4 ? 0.9 : 1;
  const toolVisible = frame >= impact - DROP * fps && toolY > -1090;
  const markScale = interpolate(frame, [impact, impact + 6], [1.1, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const w = width;
  const h = height;
  return (
    <g transform={`rotate(${rotate})`}>
      <mask id={`ink-${seed}`} maskUnits="userSpaceOnUse" x={-w} y={-h} width={w * 2} height={h * 2}>
        <rect x={-w} y={-h} width={w * 2} height={h * 2} fill="url(#pc-ink)" />
      </mask>
      {frame >= impact ? (
        <g mask={`url(#ink-${seed})`} transform={`scale(${markScale})`}>
          <path
            d={roughRect(-w / 2, -h / 2, w, h, `${seed}-o`, { radius: 22, wobble: 3 })}
            fill="none"
            stroke={ink}
            strokeWidth={14}
          />
          <path
            d={roughRect(-w / 2 + 22, -h / 2 + 22, w - 44, h - 44, `${seed}-i`, { radius: 14, wobble: 2.5 })}
            fill="none"
            stroke={ink}
            strokeWidth={5}
          />
          <PaperText text={text} y={sub ? -h * 0.08 : 0} size={h * 0.44} font="numbers" weight={700} color={ink} letterSpacing={6} />
          {sub ? <PaperText text={sub} y={h * 0.27} size={h * 0.13} weight={800} color={ink} letterSpacing={4} /> : null}
        </g>
      ) : null}

      {toolVisible ? (
        <g transform={`translate(0 ${toolY - 8}) scale(1 ${squash})`}>
          <Cut depth={4}>
            <path d={roughRect(-w * 0.47, -96, w * 0.94, 72, `${seed}-base`, { radius: 10 })} fill={c.paperRaised} />
            <path d={roughRect(-w * 0.5, -30, w, 30, `${seed}-rub`, { radius: 6 })} fill={ink} />
            <path d={roughRect(-46, -230, 92, 140, `${seed}-neck`, { radius: 20 })} fill={mix(c.paperRaised, c.edge, 0.12)} />
            <path d={roughCircle(0, -280, 82, `${seed}-knob`)} fill={c.paperRaised} />
          </Cut>
        </g>
      ) : null}
    </g>
  );
};

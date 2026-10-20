import React from "react";
import { mix } from "../../brand/color";
import { useTheme } from "../../brand/theme";
import { Cut } from "./Cut";
import { Label } from "./Label";
import { roughCircle, roughRect } from "./shapes";
import { type Tone, toneFill } from "./tones";

export type Pose = "stand" | "walk" | "climb" | "pull" | "tired" | "cheer" | "point";

type PersonProps = {
  readonly seed: string;
  // Altura total. Âncora: entre os pés, no chão.
  readonly height?: number;
  readonly pose?: Pose;
  // Fase do ciclo de passos (radianos). Avance de forma "escadinha" pro stop-motion.
  readonly phase?: number;
  readonly facing?: 1 | -1;
  readonly tone?: Tone;
  readonly tired?: boolean;
  // Etiqueta pendurada acima da cabeça (ex: "ENERGIA").
  readonly tag?: string;
  readonly tagTone?: Tone;
  readonly tagScale?: number;
};

type Angles = { armB: number; armF: number; legB: number; legF: number; lean: number };

// Ângulos em graus, positivo = pra frente.
const poseAngles = (pose: Pose, p: number): Angles => {
  const s = Math.sin(p);
  switch (pose) {
    case "walk":
      return { armB: 18 * s, armF: -18 * s, legB: -22 * s, legF: 22 * s, lean: 4 };
    case "climb":
      return { armB: 20 * s, armF: -20 * s, legB: -12 + 14 * s, legF: 32 - 14 * s, lean: 10 };
    case "tired":
      return { armB: 6 + 6 * s, armF: 14 - 6 * s, legB: -10 + 8 * s, legF: 18 - 8 * s, lean: 16 };
    case "pull":
      return { armB: 128 + 6 * s, armF: 142 + 6 * s, legB: -20, legF: 26, lean: -14 + 3 * s };
    case "cheer":
      return { armB: 168, armF: 158, legB: -6, legF: 6, lean: 0 };
    case "point":
      return { armB: -6, armF: 90, legB: -4, legF: 4, lean: 0 };
    case "stand":
    default:
      return { armB: -5, armF: 5, legB: -3, legF: 3, lean: 0 };
  }
};

// Bonequinho de papel SEM rosto (cabeça é só um círculo), com "colchetes" nas juntas.
export const Person: React.FC<PersonProps> = ({
  seed,
  height = 220,
  pose = "stand",
  phase = 0,
  facing = 1,
  tone = "light",
  tired = false,
  tag,
  tagTone = "accent",
  tagScale = 1,
}) => {
  const theme = useTheme();
  const { c } = theme;
  const H = height;
  const a = poseAngles(tired && pose !== "pull" ? (pose === "stand" ? "tired" : pose) : pose, phase);
  const lean = a.lean + (tired && pose !== "stand" ? 6 : 0);

  const headR = H * 0.105;
  const torsoTop = -H + headR * 2 + H * 0.025;
  const hipY = -H * 0.44;
  const tw = H * 0.24;
  const aw = H * 0.075;
  const aL = H * 0.34;
  const lw = H * 0.095;
  const lL = H * 0.44;
  const shoulderY = torsoTop + H * 0.045;
  const body = toneFill(theme, tone);
  const limb = mix(body, c.background, 0.18);
  const brad = mix(c.edge, body, 0.35);

  const limbPath = (w: number, L: number, k: string) =>
    roughRect(-w / 2, -w / 2, w, L + w / 2, `${seed}-${k}`, { radius: w / 2, wobble: 0.8, step: 999 });

  const leg = (x: number, ang: number, k: string) => (
    <g transform={`translate(${x} ${hipY}) rotate(${-ang})`}>
      <path d={limbPath(lw, lL, k)} fill={limb} />
    </g>
  );
  const arm = (x: number, ang: number, k: string) => (
    <g transform={`translate(${x} ${shoulderY}) rotate(${-ang})`}>
      <path d={limbPath(aw, aL, k)} fill={limb} />
    </g>
  );

  return (
    <g transform={`scale(${facing} 1)`}>
      <Cut>
        {leg(-tw * 0.18, a.legB, "lb")}
        <g transform={`rotate(${lean} 0 ${hipY})`}>
          {arm(-tw * 0.2, a.armB, "ab")}
          <path d={roughRect(-tw / 2, torsoTop, tw, hipY - torsoTop + H * 0.04, `${seed}-torso`, { radius: tw * 0.35, step: 999 })} fill={body} />
          <path d={roughCircle(0, -H + headR, headR, `${seed}-head`)} fill={body} />
        </g>
        {leg(tw * 0.18, a.legF, "lf")}
        <g transform={`rotate(${lean} 0 ${hipY})`}>
          {arm(tw * 0.2, a.armF, "af")}
          <circle cx={tw * 0.2} cy={shoulderY} r={aw * 0.22} fill={brad} />
        </g>
        <circle cx={tw * 0.18} cy={hipY} r={lw * 0.2} fill={brad} />
      </Cut>
      {tired ? (
        <g transform={`rotate(${lean} 0 ${hipY})`}>
          <Cut depth={1} edge={3}>
            <path d={drop(headR * 1.25, -H + headR * 0.4, headR * 0.28)} fill={c.lightPaper} />
            <path d={drop(headR * 1.65, -H + headR * 1.3, headR * 0.22)} fill={c.lightPaper} />
          </Cut>
        </g>
      ) : null}
      {tag ? (
        <g transform={`scale(${facing} 1) translate(0 ${-H - 70 * tagScale}) scale(${tagScale})`}>
          <Label seed={`${seed}-tag`} text={tag} width={tag.length * 22 + 90} height={62} tone={tagTone} font="text" size={28} />
        </g>
      ) : null}
    </g>
  );
};

// Gota de suor (cansaço).
const drop = (x: number, y: number, r: number) =>
  `M${x} ${y - r * 2.2} Q${x + r * 1.2} ${y - r * 0.4} ${x + r} ${y + r * 0.3} A${r} ${r} 0 1 1 ${x - r} ${y + r * 0.3} Q${x - r * 1.2} ${y - r * 0.4} ${x} ${y - r * 2.2} Z`;

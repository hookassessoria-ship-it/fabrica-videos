import type { TransitionPresentation, TransitionPresentationComponentProps } from "@remotion/transitions";
import React from "react";
import { AbsoluteFill, random } from "remotion";
import type { TransitionName } from "../../templates/kineticTypes";
import { EASE } from "../kinetic/motion";

type P = { kind: TransitionName; accent: string; seed: string };
type C = TransitionPresentationComponentProps<P>;

// Duração (frames) de cada transição: todas rápidas.
export const TRANSITION_FRAMES: Record<TransitionName, number> = {
  zoom: 10,
  whip: 10,
  circle: 12,
  wipe: 12,
  glitch: 4,
  flash: 6,
  slide: 12,
  morph: 14,
  cut: 0,
};

const POOL: TransitionName[] = ["zoom", "whip", "circle", "wipe", "glitch", "flash", "slide", "morph"];

// Sorteio por seed, sem repetir a transição anterior nem a próxima (se for fixa no JSON).
export const pickTransitions = (requested: (TransitionName | "auto" | undefined)[], seed: string): TransitionName[] => {
  const out: TransitionName[] = [];
  requested.forEach((r, i) => {
    if (r && r !== "auto") {
      out.push(r);
      return;
    }
    const next = requested[i + 1];
    const options = POOL.filter((t) => t !== out[i - 1] && t !== next);
    out.push(options[Math.floor(random(`${seed}-tr-${i}`) * options.length)]);
  });
  return out;
};

// Blur direcional (horizontal) pro whip pan.
const DirBlur: React.FC<{ readonly id: string; readonly amount: number }> = ({ id, amount }) => (
  <svg width={0} height={0} style={{ position: "absolute" }}>
    <filter id={id} x="-20%" y="-5%" width="140%" height="110%">
      <feGaussianBlur stdDeviation={`${amount.toFixed(1)} 0`} />
    </filter>
  </svg>
);

const Kinetic: React.FC<C> = ({ children, presentationDirection: dir, presentationProgress: p, passedProps }) => {
  const { kind, accent, seed } = passedProps;
  const entering = dir === "entering";
  switch (kind) {
    case "zoom": {
      if (entering) {
        const e = EASE.outBack(p);
        return <AbsoluteFill style={{ scale: 0.7 + 0.3 * e, opacity: Math.min(1, p * 3) }}>{children}</AbsoluteFill>;
      }
      const e = EASE.inExpo(p);
      return <AbsoluteFill style={{ scale: 1 + e * 0.9, opacity: 1 - e, filter: `blur(${e * 14}px)` }}>{children}</AbsoluteFill>;
    }
    case "whip": {
      const id = `whip-${seed}-${dir}`;
      const amount = Math.sin(p * Math.PI) * 70;
      const x = entering ? (1 - EASE.outExpo(p)) * 110 : -EASE.inExpo(p) * 110;
      return (
        <AbsoluteFill style={{ translate: `${x}% 0`, filter: amount > 1 ? `url(#${id})` : undefined }}>
          <DirBlur id={id} amount={amount} />
          {children}
        </AbsoluteFill>
      );
    }
    case "circle": {
      const r = EASE.outExpo(p) * 120;
      if (entering) {
        return <AbsoluteFill style={{ clipPath: `circle(${r}% at 50% 42%)` }}>{children}</AbsoluteFill>;
      }
      const mask = `radial-gradient(circle at 50% 42%, transparent ${r}%, black ${r + 0.5}%)`;
      return <AbsoluteFill style={{ maskImage: mask, WebkitMaskImage: mask, scale: 1 - 0.06 * p }}>{children}</AbsoluteFill>;
    }
    case "wipe": {
      const x = EASE.inOutCubic(p) * 160 - 30;
      if (entering) {
        return (
          <AbsoluteFill>
            <AbsoluteFill style={{ clipPath: `polygon(0 0, ${x}% 0, ${x - 30}% 100%, 0 100%)` }}>{children}</AbsoluteFill>
            <div style={{ position: "absolute", top: -200, bottom: -200, width: 26, left: `${x - 15}%`, rotate: "16deg", backgroundColor: accent, boxShadow: `0 0 40px ${accent}`, opacity: p < 0.98 ? 1 : 0 }} />
          </AbsoluteFill>
        );
      }
      return <AbsoluteFill style={{ clipPath: `polygon(${x}% 0, 100% 0, 100% 100%, ${x - 30}% 100%)` }}>{children}</AbsoluteFill>;
    }
    case "glitch": {
      if (!entering) {
        return <AbsoluteFill style={{ opacity: p < 0.5 ? 1 : 0 }}>{children}</AbsoluteFill>;
      }
      const step = Math.floor(p * 4);
      const jx = (random(`${seed}-g${step}`) - 0.5) * 80;
      return (
        <AbsoluteFill style={{ translate: `${jx}px 0`, filter: p < 1 ? `hue-rotate(${step * 70}deg) saturate(2.2) contrast(1.3)` : undefined }}>
          {children}
          {p < 1 ? (
            <AbsoluteFill style={{ clipPath: `inset(${30 + step * 9}% 0 ${50 - step * 7}% 0)`, translate: `${-jx * 1.6}px 0`, mixBlendMode: "screen", opacity: 0.8 }}>{children}</AbsoluteFill>
          ) : null}
        </AbsoluteFill>
      );
    }
    case "flash": {
      if (!entering) {
        return <AbsoluteFill style={{ opacity: p < 0.5 ? 1 : 0, scale: 1 + p * 0.1 }}>{children}</AbsoluteFill>;
      }
      return (
        <AbsoluteFill>
          <AbsoluteFill style={{ opacity: p >= 0.5 ? 1 : 0 }}>{children}</AbsoluteFill>
          <AbsoluteFill style={{ backgroundColor: "#fff", opacity: 1 - Math.abs(p * 2 - 1) }} />
        </AbsoluteFill>
      );
    }
    case "slide": {
      if (entering) {
        return <AbsoluteFill style={{ translate: `0 ${(1 - EASE.outBack(p)) * 100}%` }}>{children}</AbsoluteFill>;
      }
      const e = EASE.inOutCubic(p);
      return <AbsoluteFill style={{ translate: `0 ${-e * 30}%`, scale: 1 - 0.1 * e, opacity: 1 - e }}>{children}</AbsoluteFill>;
    }
    case "morph": {
      if (!entering) {
        return <AbsoluteFill style={{ opacity: 1 - EASE.inExpo(p), scale: 1 - 0.08 * p }}>{children}</AbsoluteFill>;
      }
      // A cena nova nasce dentro de um quadrado arredondado girando, que cresce até a tela toda.
      const e = EASE.outExpo(p);
      const inset = (1 - e) * 46;
      const rot = (1 - e) * 45;
      return (
        <AbsoluteFill style={{ rotate: `${rot}deg`, clipPath: `inset(${inset}% ${inset}% round ${(1 - e) * 120 + 1}px)` }}>
          <AbsoluteFill style={{ rotate: `${-rot}deg`, scale: 1.4 - 0.4 * e }}>{children}</AbsoluteFill>
          <AbsoluteFill style={{ inset: `${inset}%`, border: `6px solid ${accent}`, borderRadius: (1 - e) * 120, opacity: 1 - e }} />
        </AbsoluteFill>
      );
    }
    default:
      return <AbsoluteFill>{children}</AbsoluteFill>;
  }
};

export const kineticTransition = (kind: TransitionName, accent: string, seed: string): TransitionPresentation<P> => ({
  component: Kinetic,
  props: { kind, accent, seed },
});

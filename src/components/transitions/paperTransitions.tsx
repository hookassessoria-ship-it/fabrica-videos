import type { TransitionPresentation, TransitionPresentationComponentProps } from "@remotion/transitions";
import React from "react";
import { AbsoluteFill, Easing } from "remotion";
import { STOP_MOTION_STEP } from "../paper/motion";

type PaperTransitionProps = {
  edgeColor: string;
  direction: "from-right" | "from-left" | "from-bottom";
};

// Progresso em degraus de 2 frames (stop-motion), com desaceleração de mão.
const stepped = (progress: number, durationInFrames: number) => {
  const steps = Math.max(1, Math.round(durationInFrames / STOP_MOTION_STEP));
  const q = Math.min(1, Math.floor(progress * steps + 0.0001) / steps);
  return Easing.bezier(0.2, 0.9, 0.3, 1)(q);
};

// Folha nova deslizando por cima da antiga, levemente torta, com sombra.
const PaperSlide: React.FC<TransitionPresentationComponentProps<PaperTransitionProps>> = ({
  children,
  presentationDirection,
  presentationProgress,
  presentationDurationInFrames,
  passedProps,
}) => {
  const p = stepped(presentationProgress, presentationDurationInFrames);
  if (presentationDirection === "exiting") {
    return (
      <AbsoluteFill>
        <AbsoluteFill style={{ scale: 1 - 0.03 * p }}>{children}</AbsoluteFill>
        <AbsoluteFill style={{ backgroundColor: "#000", opacity: 0.45 * p }} />
      </AbsoluteFill>
    );
  }
  const { direction, edgeColor } = passedProps;
  const off = (1 - p) * 112;
  const translate =
    direction === "from-left" ? `${-off}% 0` : direction === "from-bottom" ? `0 ${off}%` : `${off}% 0`;
  return (
    <AbsoluteFill
      style={{
        translate,
        rotate: `${(1 - p) * (direction === "from-left" ? -5 : 5)}deg`,
        boxShadow: `0 0 0 6px ${edgeColor}, 0 30px 60px rgba(0,0,0,0.7)`,
        overflow: "hidden",
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

// Folha virando: a nova "deita" por cima a partir da dobra na esquerda.
const PaperFlip: React.FC<TransitionPresentationComponentProps<PaperTransitionProps>> = ({
  children,
  presentationDirection,
  presentationProgress,
  presentationDurationInFrames,
  passedProps,
}) => {
  const p = stepped(presentationProgress, presentationDurationInFrames);
  if (presentationDirection === "exiting") {
    return (
      <AbsoluteFill>
        {children}
        <AbsoluteFill style={{ backgroundColor: "#000", opacity: 0.5 * p }} />
      </AbsoluteFill>
    );
  }
  const angle = (1 - p) * -96;
  return (
    <AbsoluteFill style={{ perspective: 2600 }}>
      <AbsoluteFill
        style={{
          transformOrigin: "0% 50%",
          transform: `rotateY(${angle}deg)`,
          boxShadow: `0 0 0 6px ${passedProps.edgeColor}, 0 30px 60px rgba(0,0,0,0.7)`,
          overflow: "hidden",
          opacity: p < 0.02 ? 0 : 1,
        }}
      >
        {children}
        <AbsoluteFill style={{ backgroundColor: "#000", opacity: 0.6 * (1 - p) }} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const paperSlide = (props: PaperTransitionProps): TransitionPresentation<PaperTransitionProps> => ({
  component: PaperSlide,
  props,
});

export const paperFlip = (props: PaperTransitionProps): TransitionPresentation<PaperTransitionProps> => ({
  component: PaperFlip,
  props,
});

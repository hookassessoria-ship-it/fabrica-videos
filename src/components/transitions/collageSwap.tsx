import type { TransitionPresentation, TransitionPresentationComponentProps } from "@remotion/transitions";
import React from "react";
import { AbsoluteFill, Easing } from "remotion";

type Props = Record<string, never>;

// A colagem anterior é varrida pra baixo enquanto os recortes novos caem por cima.
// O fundo é contínuo (fica fora da transição), então só os recortes se movem.
const CollageSwap: React.FC<TransitionPresentationComponentProps<Props>> = ({ children, presentationDirection, presentationProgress }) => {
  if (presentationDirection === "entering") {
    return <AbsoluteFill>{children}</AbsoluteFill>;
  }
  // Papel não fica transparente: a colagem inteira é empurrada pra fora, rígida.
  const p = Easing.in(Easing.quad)(presentationProgress);
  return (
    <AbsoluteFill
      style={{
        translate: `${-90 * p}px ${1500 * p}px`,
        rotate: `${-9 * p}deg`,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

export const collageSwap = (): TransitionPresentation<Props> => ({ component: CollageSwap, props: {} });

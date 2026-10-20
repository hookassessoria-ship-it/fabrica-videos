import type React from "react";
import type { SceneSpec } from "../templates/types";

export type VisualProps<P> = {
  readonly props: P;
  readonly scene: SceneSpec;
};

export type VisualComponent = React.FC<VisualProps<Record<string, unknown>>>;

// Os props de cada visual vêm do JSON do vídeo; aqui só tipamos o componente.
export const defineVisual = <P,>(component: React.FC<VisualProps<P>>) => component as unknown as VisualComponent;

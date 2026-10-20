import { BarChart, StampSlam, TitleCard, Versus } from "./basic";
import { CartTag, EndCard } from "./closing";
import type { VisualComponent } from "./defineVisual";
import { ElevatorTower } from "./ElevatorTower";

// Visuais disponíveis pro campo `visual.type` das cenas em /videos/*.json.
// Visual novo = componente novo aqui; vídeo novo = só JSON.
export const VISUALS: Record<string, VisualComponent> = {
  TitleCard,
  Versus,
  StampSlam,
  BarChart,
  CartTag,
  ElevatorTower,
  EndCard,
};

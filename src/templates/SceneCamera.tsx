import React from "react";
import { Easing, interpolate, useVideoConfig } from "remotion";
import { CameraProvider, STAGE_H, STAGE_W } from "../components/paper/Layer";
import { useStopMotionFrame } from "../components/paper/motion";
import type { CameraKey } from "./types";

const ease = Easing.bezier(0.45, 0, 0.25, 1);

const track = (keys: CameraKey[], field: "x" | "y" | "zoom", fallback: number, frame: number, fps: number) => {
  const pts = keys.filter((k) => k[field] !== undefined);
  if (pts.length === 0) {
    return fallback;
  }
  if (pts.length === 1) {
    return pts[0][field] as number;
  }
  return interpolate(
    frame,
    pts.map((k) => k.at * fps),
    pts.map((k) => k[field] as number),
    { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease },
  );
};

// Câmera da cena: deriva lenta por padrão (pra dar parallax entre camadas)
// ou pontos-chave vindos do JSON. Atualiza a cada 2 frames.
export const SceneCamera: React.FC<{
  readonly keys?: CameraKey[];
  readonly durationSec: number;
  readonly children: React.ReactNode;
}> = ({ keys, durationSec, children }) => {
  const frame = useStopMotionFrame();
  const { fps } = useVideoConfig();
  const k = keys && keys.length > 0 ? keys : null;
  const drift = interpolate(frame, [0, durationSec * fps], [-1, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const cam = k
    ? {
        x: track(k, "x", STAGE_W / 2, frame, fps),
        y: track(k, "y", STAGE_H / 2, frame, fps),
        zoom: track(k, "zoom", 1, frame, fps),
      }
    : { x: STAGE_W / 2 + drift * 14, y: STAGE_H / 2 + drift * 5, zoom: 1 + (drift + 1) * 0.008 };
  return <CameraProvider value={cam}>{children}</CameraProvider>;
};

import React from "react";
import { useCollageTheme } from "../../brand/collageTheme";
import { withAlpha } from "../../brand/color";
import { WIRE } from "./theme";

// Texto mono ciano de HUD (rótulos do monitor holográfico). `blink`: quadro atual, faz a
// bolinha "●" do começo piscar.
export const MonoText: React.FC<{ readonly x: number; readonly y: number; readonly text: string; readonly align?: "left" | "right"; readonly blink?: number }> = ({
  x,
  y,
  text,
  align = "left",
  blink,
}) => {
  const { f } = useCollageTheme();
  const dot = blink === undefined ? null : 0.35 + 0.65 * Math.abs(Math.sin(blink / 7));
  const [head, rest] = dot !== null && text.startsWith("●") ? ["●", text.slice(1)] : ["", text];
  return (
    <div
      style={{
        position: "absolute",
        top: y,
        ...(align === "left" ? { left: x } : { right: 1080 - x }),
        fontFamily: f.mono,
        fontWeight: 700,
        fontSize: 26,
        letterSpacing: 2,
        whiteSpace: "nowrap",
        color: WIRE.cyan,
        textShadow: `0 0 12px ${withAlpha(WIRE.cyan, 0.7)}, 0 2px 6px #000`,
      }}
    >
      {head ? <span style={{ color: WIRE.alert, opacity: dot ?? 1 }}>{head}</span> : null}
      {rest}
    </div>
  );
};

import React from "react";
import { random, useCurrentFrame, useVideoConfig } from "remotion";
import { useCollageTheme } from "../../brand/collageTheme";
import { withAlpha } from "../../brand/color";
import { AnimatedIcon } from "./AnimatedIcon";
import { clamp01, idle, springAt } from "./motion";

const AVATARS = ["angry", "thumbs-down", "message-circle-warning", "frown", "megaphone", "flame"];

type Props = {
  readonly items: string[];
  readonly seed: string;
  readonly at: number;
  // Segundos entre um balão e o próximo.
  readonly every?: number;
  readonly size?: number;
  // Distância horizontal do centro (os balões alternam esquerda/direita).
  readonly spread?: number;
  // Distância vertical entre balões.
  readonly step?: number;
};

// Balões de comentário pipocando em sequência, como um feed que não para de chegar:
// cada um entra com squash & stretch, os anteriores dão um tranco e a pilha sobe devagar.
export const CommentBubbles: React.FC<Props> = ({ items, seed, at, every = 0.2, size = 44, spread = 150, step = 150 }) => {
  const { c, f } = useCollageTheme();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const start = Math.round(at * fps);
  const gap = Math.max(1, Math.round(every * fps));
  const starts = items.map((_, i) => start + i * gap);
  const scroll = Math.max(0, frame - start) * 1.1;
  const top = -((items.length - 1) * step) / 2;

  return (
    <div style={{ position: "relative", width: 0, height: 0 }}>
      {items.map((text, i) => {
        const s0 = starts[i];
        if (frame < s0) {
          return null;
        }
        const s = springAt(frame, fps, s0, "bouncy");
        const k = frame - s0;
        const sq = Math.exp(-k / 5) * Math.sin(k * 0.9) * 0.14;
        // Tranco quando chegam os balões seguintes.
        let jolt = 0;
        for (let j = i + 1; j < items.length; j++) {
          const kj = frame - starts[j];
          if (kj >= 0 && kj < 12) {
            jolt += Math.exp(-kj / 3) * Math.sin(kj * 1.4) * 7;
          }
        }
        const side = i % 2 === 0 ? -1 : 1;
        const x = side * spread * (0.7 + random(`${seed}-bx${i}`) * 0.5);
        const y = top + i * step - scroll;
        const tilt = side * (2 + random(`${seed}-br${i}`) * 3);
        const id = idle(frame, fps, `${seed}-b${i}`, 4);
        const hot = i === items.length - 1;
        return (
          <div
            key={`${text}-${i}`}
            style={{
              position: "absolute",
              left: x + id.x + jolt * side,
              top: y + id.y,
              translate: "-50% -50%",
              transformOrigin: side < 0 ? "100% 100%" : "0% 100%",
              scale: `${s * (1 + sq)} ${s * (1 - sq)}`,
              rotate: `${tilt + id.r}deg`,
              opacity: clamp01(s * 4),
              display: "flex",
              alignItems: "center",
              gap: 16,
              flexDirection: side < 0 ? "row" : "row-reverse",
              zIndex: i,
            }}
          >
            <AnimatedIcon icon={AVATARS[i % AVATARS.length]} seed={`${seed}-av${i}`} at={s0 / fps} preset="pop" size={size * 1.7} />
            <div
              style={{
                position: "relative",
                padding: `${size * 0.36}px ${size * 0.6}px`,
                borderRadius: size * 0.7,
                [side < 0 ? "borderBottomLeftRadius" : "borderBottomRightRadius"]: 8,
                backgroundColor: hot ? c.accent : "#ffffff",
                color: hot ? "#ffffff" : "#16121f",
                fontFamily: f.sans,
                fontWeight: 800,
                fontSize: size,
                letterSpacing: "-0.02em",
                whiteSpace: "nowrap",
                boxShadow: `0 18px 40px ${withAlpha("#2a0630", 0.32)}${hot ? `, 0 0 40px ${withAlpha(c.accent, 0.6)}` : ""}`,
              }}
            >
              {text}
            </div>
          </div>
        );
      })}
    </div>
  );
};

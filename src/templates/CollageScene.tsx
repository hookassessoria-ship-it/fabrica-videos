import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { useCollageTheme } from "../brand/collageTheme";
import { Land, type Move } from "../components/collage/Land";
import { Photo } from "../components/collage/Photo";
import { CountUp, PriceTag, TapePiece } from "../components/collage/Pieces";
import { Chip, HandMark, HandNote, HeadlineStrip, MonoLabel, RansomText } from "../components/collage/Type";
import { resolveBeat, type SceneWord, sceneLayers } from "./collageLayers";
import type { CollageScene as SceneSpec, ImageAsset, Treatment } from "./collageTypes";

// Tamanho máximo padrão de uma foto por tratamento (quando a camada não diz).
const DEFAULT_BOX: Record<Treatment, { w: number; h: number }> = {
  cutout: { w: 560, h: 600 },
  torn: { w: 780, h: 840 },
  taped: { w: 760, h: 760 },
};

// "Batida" leve na cena inteira quando a primeira foto assenta.
const useLandingShake = (at: number | undefined) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (at === undefined) {
    return 0;
  }
  const t = frame - Math.round(at * fps) - 6;
  if (t < 0 || t > 6) {
    return 0;
  }
  return (1 - t / 6) * 5 * (t % 2 === 0 ? 1 : -1);
};

type Props = {
  readonly scene: SceneSpec;
  readonly images?: Record<string, ImageAsset> | null;
  // Palavras da narração desta cena (tempo relativo à cena), pra "enterOnWord".
  readonly words: SceneWord[];
};

export const CollageSceneView: React.FC<Props> = ({ scene, images, words }) => {
  const { f, c } = useCollageTheme();
  const layers = sceneLayers(scene);
  const timed = layers.map((l, i) => {
    const at = resolveBeat(l, words, scene.id, 0.2 + i * 0.6);
    const moves: Move[] = (l.moves ?? []).map((m) => ({ ...m, at: resolveBeat(m, words, scene.id, at + 1) }));
    return { l, at, moves, seed: `${scene.id}-${l.id}` };
  });
  const firstPhoto = timed.find((t) => t.l.type === "photo");
  const shake = useLandingShake(firstPhoto?.at);

  return (
    <AbsoluteFill style={{ translate: `0px ${shake}px` }}>
      {timed.map(({ l, at, moves, seed }, i) => {
        const z = l.z ?? i;
        const land = { seed, x: l.x, y: l.y, at, rotate: l.rotate, scale: l.scale, moves, zIndex: z, float: l.float };
        switch (l.type) {
          case "photo": {
            const asset = images?.[`${scene.id}/${l.id}`];
            const treatment = l.image?.treatment ?? l.treatment ?? asset?.treatment ?? "torn";
            const box = DEFAULT_BOX[treatment];
            return (
              <Land key={l.id} {...land} maxTilt={4} float={l.float ?? 3}>
                <Photo asset={asset} treatment={treatment} seed={seed} maxW={l.width ?? box.w} maxH={l.height ?? box.h} durationSec={scene.duration} />
              </Land>
            );
          }
          case "number":
            return (
              <Land key={l.id} {...land}>
                <CountUp
                  value={l.value}
                  at={at}
                  decimals={l.decimals}
                  prefix={l.prefix}
                  suffix={l.suffix}
                  size={l.size}
                  color={l.color}
                  from={l.countFrom}
                  duration={l.countDuration}
                />
              </Land>
            );
          case "price":
            return (
              <Land key={l.id} {...land}>
                <PriceTag text={l.text} sub={l.sub} seed={seed} size={l.size} />
              </Land>
            );
          case "tape":
            return (
              <Land key={l.id} {...land} shadow={false} float={0}>
                <TapePiece seed={seed} width={l.width} />
              </Land>
            );
          case "strip":
            return (
              <Land key={l.id} {...land}>
                <HeadlineStrip text={l.text} seed={seed} size={l.size} />
              </Land>
            );
          case "ransom":
            return (
              <Land key={l.id} {...land} shadow={false} maxTilt={0}>
                <RansomText text={l.text} seed={seed} at={0} size={l.size} />
              </Land>
            );
          case "display":
            return (
              <Land key={l.id} {...land}>
                <div style={{ fontFamily: f.display, fontSize: l.size ?? 150, color: c.text, lineHeight: 0.95, textAlign: "center", whiteSpace: "pre" }}>{l.text}</div>
              </Land>
            );
          case "chip":
            return (
              <Land key={l.id} {...land}>
                <Chip text={l.text} seed={seed} size={l.size} />
              </Land>
            );
          case "hand":
            return (
              <Land key={l.id} {...land} shadow={false} float={l.float ?? 2}>
                <HandNote text={l.text} at={at} size={l.size} />
              </Land>
            );
          case "mono":
            return (
              <div key={l.id} style={{ position: "absolute", left: l.x, top: l.y, translate: "0 -50%", rotate: `${l.rotate ?? 0}deg`, zIndex: z }}>
                <MonoLabel text={l.text} at={at} size={l.size} />
              </div>
            );
          case "arrow":
          case "circle":
          case "underline":
            return (
              <div key={l.id} style={{ position: "absolute", inset: 0, zIndex: z }}>
                <HandMark kind={l.type} seed={seed} x={l.x} y={l.y} toX={l.toX} toY={l.toY} w={l.w} h={l.h} at={at} />
              </div>
            );
          default:
            return null;
        }
      })}
    </AbsoluteFill>
  );
};

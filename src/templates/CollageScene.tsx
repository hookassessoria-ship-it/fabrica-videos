import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { useCollageTheme } from "../brand/collageTheme";
import { Land } from "../components/collage/Land";
import { Photo, photoSize } from "../components/collage/Photo";
import { Chip, HandMark, HandNote, HeadlineStrip, MonoLabel, RansomText } from "../components/collage/Type";
import type { CollageScene as SceneSpec, ImageAsset, Treatment } from "./collageTypes";
import { VISUAL } from "./safeZone";

// Tamanho máximo padrão da foto principal por tratamento.
// A faixa visual vai de 288 a 1248; o topo (~300) fica livre pros rótulos mono.
const DEFAULT_BOX: Record<Treatment, { w: number; h: number }> = {
  cutout: { w: 800, h: 820 },
  torn: { w: 860, h: 840 },
  taped: { w: 800, h: 780 },
};

const PHOTO_AT = 0.22;

// Onde a foto principal fica (centro) — também usado pro glow do fundo.
export const photoCenter = (scene: SceneSpec) => ({
  x: scene.layout?.x ?? VISUAL.centerX,
  y: scene.layout?.y ?? VISUAL.centerY + 30,
});

// "Batida" leve na cena inteira quando a foto principal assenta.
const useLandingShake = (at: number) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame - Math.round(at * fps) - 6;
  if (t < 0 || t > 6) {
    return 0;
  }
  return (1 - t / 6) * 5 * (t % 2 === 0 ? 1 : -1);
};

export const CollageSceneView: React.FC<{ readonly scene: SceneSpec; readonly asset?: ImageAsset }> = ({ scene, asset }) => {
  const { f, c } = useCollageTheme();
  const treatment = scene.image?.treatment ?? asset?.treatment ?? "torn";
  const box = DEFAULT_BOX[treatment];
  const maxW = scene.layout?.width ?? box.w;
  const maxH = scene.layout?.height ?? box.h;
  const center = photoCenter(scene);
  const photoAt = scene.layout?.at ?? PHOTO_AT;
  const shake = useLandingShake(photoAt);
  const hasPhoto = Boolean(scene.image || asset);
  const size = photoSize(asset, treatment, maxW, maxH);

  return (
    <AbsoluteFill style={{ translate: `0px ${shake}px` }}>
      {hasPhoto ? (
        <Land seed={`${scene.id}-photo`} x={center.x} y={center.y} at={photoAt} rotate={scene.layout?.rotate} maxTilt={4}>
          <Photo asset={asset} treatment={treatment} seed={scene.id} maxW={maxW} maxH={maxH} durationSec={scene.duration} />
        </Land>
      ) : null}

      {scene.title ? (
        <Land
          seed={`${scene.id}-title`}
          x={scene.title.x ?? VISUAL.centerX}
          y={scene.title.y ?? center.y + size.h / 2 - 40}
          at={scene.title.at ?? 0.7}
          rotate={scene.title.rotate}
          shadow={scene.title.style !== "ransom"}
          maxTilt={scene.title.style === "ransom" ? 0 : 6}
        >
          {scene.title.style === "ransom" ? (
            <RansomText text={scene.title.text} seed={`${scene.id}-ransom`} at={0} size={scene.title.size} />
          ) : scene.title.style === "strip" ? (
            <HeadlineStrip text={scene.title.text} seed={`${scene.id}-strip`} size={scene.title.size} />
          ) : (
            <div style={{ fontFamily: f.display, fontSize: scene.title.size ?? 150, color: c.text, lineHeight: 0.95, textAlign: "center", whiteSpace: "pre" }}>
              {scene.title.text}
            </div>
          )}
        </Land>
      ) : null}

      {(scene.marks ?? []).map((m, i) => (
        <HandMark key={`m${i}`} seed={`${scene.id}-m${i}`} {...m} />
      ))}

      {(scene.labels ?? []).map((l, i) => {
        const at = l.at ?? 0.6;
        if (l.kind === "mono") {
          return (
            <div key={`l${i}`} style={{ position: "absolute", left: l.x, top: l.y, translate: "0 -50%", rotate: `${l.rotate ?? 0}deg` }}>
              <MonoLabel text={l.text} at={at} size={l.size} />
            </div>
          );
        }
        return (
          <Land key={`l${i}`} seed={`${scene.id}-l${i}`} x={l.x} y={l.y} at={at} rotate={l.rotate} shadow={l.kind === "chip"}>
            {l.kind === "hand" ? <HandNote text={l.text} at={at} size={l.size} /> : <Chip text={l.text} seed={`${scene.id}-chip${i}`} size={l.size} />}
          </Land>
        );
      })}
    </AbsoluteFill>
  );
};

import React from "react";
import { useTheme } from "../../brand/theme";
import { Cut } from "./Cut";
import { Layer } from "./Layer";
import { PaperText } from "./PaperText";
import { Pop } from "./Pop";
import { roughRect } from "./shapes";

// "Fonte: ..." pequeno no canto superior esquerdo (abaixo da UI do TikTok).
export const SourceTag: React.FC<{ readonly text: string; readonly at?: number; readonly seed: string }> = ({
  text,
  at = 0.4,
  seed,
}) => {
  const { c } = useTheme();
  const size = 27;
  const label = `Fonte: ${text}`;
  const w = label.length * size * 0.54 + 44;
  const h = 54;
  return (
    <Layer depth={4}>
      <Pop seed={`${seed}-src`} x={70 + w / 2} y={215} at={at} from="left" distance={60} maxTilt={1.2}>
        <Cut depth={2} edge={4}>
          <path d={roughRect(-w / 2, -h / 2, w, h, `${seed}-srcbg`, { radius: 6 })} fill={c.paperRaised} />
          <PaperText text={label} size={size} weight={600} color={c.textMuted} />
        </Cut>
      </Pop>
    </Layer>
  );
};

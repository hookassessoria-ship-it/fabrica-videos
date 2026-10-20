import React from "react";
import { useTheme } from "../../brand/theme";
import { Cut } from "./Cut";
import { PaperText } from "./PaperText";
import { roughRect } from "./shapes";

// Nome da marca como letras recortadas + tira de acento embaixo. Âncora no centro.
export const Wordmark: React.FC<{ readonly seed: string; readonly size?: number; readonly text?: string }> = ({
  seed,
  size = 170,
  text,
}) => {
  const { brand, c } = useTheme();
  const name = text ?? brand.logo.text;
  const underline = name.length * size * 0.52;
  return (
    <>
      <Cut depth={2}>
        <path d={roughRect(-underline / 2, size * 0.48, underline, size * 0.16, `${seed}-ul`, { radius: 6 })} fill={c.accent} />
      </Cut>
      <Cut depth={3} edge={9}>
        <PaperText text={name} size={size} font="numbers" weight={700} color={c.text} letterSpacing={-2} />
      </Cut>
    </>
  );
};

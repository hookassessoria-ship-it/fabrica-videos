import { createContext, useContext } from "react";
import { mix } from "./color";
import type { Brand } from "./types";

export type Theme = {
  brand: Brand;
  c: Brand["colors"] & {
    // Tons derivados do acento: trocar `accent` no JSON da marca atualiza todos.
    accentShade: string;
    accentLight: string;
    accentMuted: string;
    // Papel claro (embalagens, documentos) e "furos" escuros no papel.
    lightPaper: string;
    hole: string;
    ink: string;
    // Lateral (espessura) dos recortes, vista por baixo da borda.
    edgeSide: string;
  };
  font: {
    text: string;
    numbers: string;
  };
  // Largura (px) da borda dos recortes, medida pra fora da silhueta.
  edgeWidth: number;
};

const stack = (family: string | undefined) =>
  `${family ? `"${family}", ` : ""}"Inter", system-ui, -apple-system, sans-serif`;

export const buildTheme = (brand: Brand): Theme => {
  const { colors } = brand;
  return {
    brand,
    c: {
      ...colors,
      accentShade: mix(colors.accent, "#000000", 0.38),
      accentLight: mix(colors.accent, "#ffffff", 0.35),
      accentMuted: mix(colors.accent, colors.paperRaised, 0.5),
      lightPaper: mix(colors.text, colors.edge, 0.35),
      hole: colors.background,
      ink: colors.background,
      edgeSide: mix(colors.edge, colors.background, 0.68),
    },
    font: {
      text: stack(brand.fonts.sans?.family),
      numbers: stack(brand.fonts.display?.family),
    },
    edgeWidth: 8,
  };
};

const ThemeContext = createContext<Theme | null>(null);

export const ThemeProvider = ThemeContext.Provider;

export const useTheme = (): Theme => {
  const theme = useContext(ThemeContext);
  if (!theme) {
    throw new Error("useTheme() precisa estar dentro do PaperExplainer");
  }
  return theme;
};

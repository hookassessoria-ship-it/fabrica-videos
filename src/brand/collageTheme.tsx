import { createContext, useContext } from "react";
import { mix, withAlpha } from "./color";
import { type Brand, fontStack } from "./types";

export type CollageTheme = {
  brand: Brand;
  c: Brand["colors"] & {
    paperWhite: string;
    ink: string;
    newsprint: string;
    tape: string;
    accentLight: string;
  };
  f: {
    display: string;
    sans: string;
    mono: string;
    hand: string;
  };
  ransomFamilies: string[];
};

export const buildCollageTheme = (brand: Brand): CollageTheme => {
  const { colors, fonts } = brand;
  return {
    brand,
    c: {
      ...colors,
      paperWhite: "#F4F1EA",
      ink: "#141416",
      newsprint: mix(colors.cream, "#9a968e", 0.35),
      tape: withAlpha(colors.cream, 0.55),
      accentLight: mix(colors.accent, "#ffffff", 0.35),
    },
    f: {
      display: fontStack(fonts.display, "Impact, sans-serif"),
      sans: fontStack(fonts.sans, "system-ui, sans-serif"),
      mono: fontStack(fonts.mono, "ui-monospace, monospace"),
      hand: fontStack(fonts.hand ?? fonts.sans, "cursive"),
    },
    ransomFamilies: (brand.ransomFonts ?? [fonts.display, fonts.sans, fonts.mono].filter(Boolean)).map((f) =>
      fontStack(f, "serif"),
    ),
  };
};

const Ctx = createContext<CollageTheme | null>(null);
export const CollageThemeProvider = Ctx.Provider;

export const useCollageTheme = (): CollageTheme => {
  const t = useContext(Ctx);
  if (!t) {
    throw new Error("useCollageTheme() precisa estar dentro do CollageExplainer");
  }
  return t;
};

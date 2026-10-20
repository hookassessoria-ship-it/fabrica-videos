import type { Theme } from "../../brand/theme";

// Tons de papel disponíveis pra qualquer recorte.
export type Tone = "paper" | "raised" | "accent" | "light" | "muted";

export const toneFill = (theme: Theme, tone: Tone) => {
  const { c } = theme;
  switch (tone) {
    case "paper":
      return c.paper;
    case "raised":
      return c.paperRaised;
    case "accent":
      return c.accent;
    case "light":
      return c.lightPaper;
    case "muted":
      return c.accentMuted;
  }
};

// Cor do texto impresso sobre cada tom.
export const toneInk = (theme: Theme, tone: Tone) =>
  tone === "light" ? theme.c.ink : theme.c.text;

export type FontSpec = {
  // Nome exato da família no Google Fonts (ex: "Inter", "Space Grotesk").
  family: string;
  weights?: string[];
};

export type Brand = {
  id: string;
  name: string;
  logo: {
    type: "wordmark" | "image";
    text: string;
    src: string | null;
  };
  cta: string;
  colors: {
    background: string;
    paper: string;
    paperRaised: string;
    edge: string;
    text: string;
    textMuted: string;
    accent: string;
  };
  fonts: {
    text: FontSpec;
    numbers: FontSpec;
  };
};

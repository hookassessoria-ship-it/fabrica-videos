export type FontFile = {
  // Caminho dentro de public/ (ex: "fonts/brand/Minha-Bold.woff2").
  src: string;
  weight?: string;
  style?: string;
};

export type FontSpec = {
  // Nome da família (no Google Fonts, o nome exato; em arquivos próprios, qualquer nome).
  family: string;
  weights?: string[];
  // Arquivos próprios em public/. Sem isso, a fonte vem do Google Fonts (via cache local).
  files?: FontFile[];
};

export type FontRole = "display" | "sans" | "mono" | "hand";

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
    cream: string;
  };
  fonts: Record<FontRole, FontSpec | undefined>;
  // Fontes sorteadas por letra no efeito "ransom note".
  ransomFonts?: FontSpec[];
};

// Todas as famílias que a marca usa (papéis + ransom), sem repetir.
export const brandFontSpecs = (brand: Brand): FontSpec[] => {
  const all = [...Object.values(brand.fonts), ...(brand.ransomFonts ?? [])].filter((f): f is FontSpec => Boolean(f));
  const byFamily = new Map<string, FontSpec>();
  for (const f of all) {
    const prev = byFamily.get(f.family);
    byFamily.set(f.family, prev ? { ...prev, weights: [...new Set([...(prev.weights ?? []), ...(f.weights ?? [])])] } : f);
  }
  return [...byFamily.values()];
};

export const fontStack = (spec: FontSpec | undefined, fallback = "system-ui, sans-serif") =>
  spec ? `"${spec.family}", ${fallback}` : fallback;

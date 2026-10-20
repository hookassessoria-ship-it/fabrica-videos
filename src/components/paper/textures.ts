// Texturas raster geradas uma vez por aba do navegador, com semente fixa
// (determinístico entre frames e entre renders).

const lcg = (seed: number) => {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
};

const paint = (
  size: number,
  seed: number,
  fill: (data: Uint8ClampedArray, rnd: () => number) => void,
) => {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return "";
  }
  const img = ctx.createImageData(size, size);
  fill(img.data, lcg(seed));
  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL("image/png");
};

const cache: Record<string, string> = {};

// Grão fino de cartão: cinza médio com variação quase gaussiana.
export const grainTexture = () =>
  (cache.grain ??= paint(256, 11, (d, rnd) => {
    for (let i = 0; i < d.length; i += 4) {
      const v = 128 + ((rnd() + rnd() + rnd()) / 3 - 0.5) * 2 * 120;
      d[i] = v;
      d[i + 1] = v;
      d[i + 2] = v;
      d[i + 3] = 255;
    }
  }));

// Manchas grandes e suaves (irregularidade da cartolina). Ampliada com suavização.
export const mottleTexture = () =>
  (cache.mottle ??= paint(24, 23, (d, rnd) => {
    for (let i = 0; i < d.length; i += 4) {
      const v = 100 + rnd() * 56;
      d[i] = v;
      d[i + 1] = v;
      d[i + 2] = v;
      d[i + 3] = 255;
    }
  }));

// Fibras/pontinhos claros soltos no papel escuro.
export const fiberTexture = () =>
  (cache.fiber ??= paint(512, 37, (d, rnd) => {
    for (let i = 0; i < d.length; i += 4) {
      const speck = rnd() < 0.0035;
      d[i] = 255;
      d[i + 1] = 255;
      d[i + 2] = 255;
      d[i + 3] = speck ? 90 + rnd() * 120 : 0;
    }
  }));

// Máscara de tinta de carimbo: falhas pequenas e irregulares.
export const inkMaskTexture = () =>
  (cache.ink ??= paint(256, 53, (d, rnd) => {
    for (let i = 0; i < d.length; i += 4) {
      const hole = rnd() < 0.16;
      const v = hole ? 0 : 200 + rnd() * 55;
      d[i] = v;
      d[i + 1] = v;
      d[i + 2] = v;
      d[i + 3] = 255;
    }
  }));

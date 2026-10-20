import { random } from "remotion";

// Geometria de "recorte de tesoura": lados levemente tortos e cantos
// um pouco arredondados. Tudo determinístico a partir de `seed`.

export type Pt = [number, number];

const jitter = (seed: string, amount: number) => (random(seed) - 0.5) * 2 * amount;

// Polígono com cantos arredondados (raio por vértice).
export const roundedPolygon = (points: Pt[], radius: number | number[]) => {
  const n = points.length;
  const r = (i: number) => (Array.isArray(radius) ? radius[i] : radius);
  const parts: string[] = [];
  for (let i = 0; i < n; i++) {
    const prev = points[(i - 1 + n) % n];
    const cur = points[i];
    const next = points[(i + 1) % n];
    const toPrev: Pt = [prev[0] - cur[0], prev[1] - cur[1]];
    const toNext: Pt = [next[0] - cur[0], next[1] - cur[1]];
    const lp = Math.hypot(toPrev[0], toPrev[1]) || 1;
    const ln = Math.hypot(toNext[0], toNext[1]) || 1;
    const rr = Math.min(r(i), lp / 2, ln / 2);
    const a: Pt = [cur[0] + (toPrev[0] / lp) * rr, cur[1] + (toPrev[1] / lp) * rr];
    const b: Pt = [cur[0] + (toNext[0] / ln) * rr, cur[1] + (toNext[1] / ln) * rr];
    parts.push(`${i === 0 ? "M" : "L"}${a[0].toFixed(1)} ${a[1].toFixed(1)}`);
    parts.push(`Q${cur[0].toFixed(1)} ${cur[1].toFixed(1)} ${b[0].toFixed(1)} ${b[1].toFixed(1)}`);
  }
  return parts.join(" ") + " Z";
};

// Subdivide as arestas e desloca pontos na perpendicular, como corte à mão.
export const roughPolygon = (
  points: Pt[],
  seed: string,
  { wobble = 2.2, step = 80, radius = 6, cornerJitter = 2 } = {},
) => {
  const out: Pt[] = [];
  const radii: number[] = [];
  points.forEach((p, i) => {
    const q = points[(i + 1) % points.length];
    out.push([p[0] + jitter(`${seed}-cx${i}`, cornerJitter), p[1] + jitter(`${seed}-cy${i}`, cornerJitter)]);
    radii.push(radius);
    const len = Math.hypot(q[0] - p[0], q[1] - p[1]);
    const segs = Math.max(1, Math.round(len / step));
    const nx = -(q[1] - p[1]) / (len || 1);
    const ny = (q[0] - p[0]) / (len || 1);
    for (let s = 1; s < segs; s++) {
      const t = s / segs + jitter(`${seed}-t${i}-${s}`, 0.12 / segs);
      const off = jitter(`${seed}-o${i}-${s}`, wobble);
      out.push([p[0] + (q[0] - p[0]) * t + nx * off, p[1] + (q[1] - p[1]) * t + ny * off]);
      radii.push(0);
    }
  });
  return roundedPolygon(out, radii);
};

export const roughRect = (
  x: number,
  y: number,
  w: number,
  h: number,
  seed: string,
  opts: { wobble?: number; step?: number; radius?: number; cornerJitter?: number } = {},
) =>
  roughPolygon(
    [
      [x, y],
      [x + w, y],
      [x + w, y + h],
      [x, y + h],
    ],
    seed,
    { radius: 10, ...opts },
  );

export const roughCircle = (
  cx: number,
  cy: number,
  r: number,
  seed: string,
  { wobble = 0.03, points = 22 } = {},
) => {
  const pts: Pt[] = [];
  for (let i = 0; i < points; i++) {
    const a = (i / points) * Math.PI * 2;
    const rr = r * (1 + jitter(`${seed}-r${i}`, wobble));
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
  }
  return roundedPolygon(pts, r * 0.25);
};

// Borda rasgada (papel de fundo): muitos pontos com variação maior.
export const tornRect = (x: number, y: number, w: number, h: number, seed: string, tear = 9) =>
  roughPolygon(
    [
      [x, y],
      [x + w, y],
      [x + w, y + h],
      [x, y + h],
    ],
    seed,
    { wobble: tear, step: 26, radius: 3, cornerJitter: tear },
  );

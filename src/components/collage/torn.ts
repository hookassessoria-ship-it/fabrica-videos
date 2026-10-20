import { random } from "remotion";

type Pt = [number, number];

const toPath = (pts: Pt[]) => `M${pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(" L")} Z`;

// Ruído 1D suave e determinístico (interpola valores aleatórios a cada `k` passos).
const smooth = (seed: string, i: number, k: number) => {
  const a = Math.floor(i / k);
  const t = (i % k) / k;
  const va = random(`${seed}-${a}`);
  const vb = random(`${seed}-${a + 1}`);
  return va + (vb - va) * (t * t * (3 - 2 * t));
};

// Contorno de papel rasgado num retângulo w x h. `inset` empurra pra dentro
// (a foto) deixando a faixa creme por fora; `amp` = tamanho dos "dentes".
export const tornOutline = (w: number, h: number, seed: string, { inset = 0, amp = 7, step = 11 } = {}) => {
  const pts: Pt[] = [];
  const sides: { from: Pt; to: Pt; n: Pt }[] = [
    { from: [0, 0], to: [w, 0], n: [0, 1] },
    { from: [w, 0], to: [w, h], n: [-1, 0] },
    { from: [w, h], to: [0, h], n: [0, -1] },
    { from: [0, h], to: [0, 0], n: [1, 0] },
  ];
  sides.forEach((side, si) => {
    const len = Math.hypot(side.to[0] - side.from[0], side.to[1] - side.from[1]);
    const n = Math.max(2, Math.round(len / step));
    // Cada lado rasga com intensidade própria.
    const sideAmp = amp * (0.45 + random(`${seed}-side${si}`) * 0.9);
    for (let i = 0; i < n; i++) {
      const t = i / n;
      const bx = side.from[0] + (side.to[0] - side.from[0]) * t;
      const by = side.from[1] + (side.to[1] - side.from[1]) * t;
      const tooth = (random(`${seed}-${si}-${i}`) - 0.5) * 2 * sideAmp * 0.55;
      const wave = (smooth(`${seed}-w${si}`, i, 6) - 0.5) * 2 * sideAmp;
      const band = inset > 0 ? inset * (0.55 + smooth(`${seed}-b${si}`, i, 5) * 0.9) : 0;
      const d = Math.max(0, sideAmp + tooth + wave) + band;
      pts.push([bx + side.n[0] * d, by + side.n[1] * d]);
    }
  });
  return toPath(pts);
};

// Polígono levemente irregular (chips de letra, fita adesiva), em % do elemento.
export const roughPolygonPct = (seed: string, amount = 4) => {
  const j = (k: string) => (random(`${seed}-${k}`) - 0.5) * 2 * amount;
  const p = (x: number, y: number, k: string) => `${(x + j(`${k}x`)).toFixed(1)}% ${(y + j(`${k}y`)).toFixed(1)}%`;
  return `polygon(${[p(amount, amount, "a"), p(50, 0 + amount / 2, "b"), p(100 - amount, amount, "c"), p(100 - amount / 2, 50, "d"), p(100 - amount, 100 - amount, "e"), p(50, 100 - amount / 2, "f"), p(amount, 100 - amount, "g"), p(amount / 2, 50, "h")].join(", ")})`;
};

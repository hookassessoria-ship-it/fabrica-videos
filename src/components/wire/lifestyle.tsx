import React, { useMemo } from "react";
import { interpolate, random, spring, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { FLOOR_Y } from "./charts";
import { Bag, Phone, roundedRect } from "./odyssey";
import { Banknote } from "./props";
import { glow, WIRE } from "./theme";
import { Core, OrbitArcs, Pedestal, WireMesh } from "./Wire";

// Palcos do rikuai-007 (inflação do estilo de vida), todos por código e reutilizáveis:
// carteira que esvazia (cédulas voando pros gastos), balão do padrão de vida inflando,
// escada que só sobe (volta bloqueada), aumento se dividindo entre casa e reserva e celular
// com quiz (tela final).

const ease = (p: number) => 1 - (1 - p) ** 3;
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

// ---------------------------------------------------------------- carteira que esvazia

const NOTES = 6;

// Gastos em volta da carteira (recebem as cédulas): celular, sacola, tela de streaming, copo.
export type Spend = "phone" | "bag" | "screen" | "cup";
const SPEND_R = 3.1;
const spendPos = (i: number, n: number): [number, number, number] => {
  const a = n === 1 ? 0 : interpolate(i, [0, n - 1], [-0.75, 0.75]) * Math.PI * 0.5;
  return [Math.sin(a) * SPEND_R * (n === 1 ? 0 : 1) + (n === 1 ? SPEND_R : 0), 0.9 + Math.cos(a) * 0.5, -Math.cos(a) * 0.6];
};

const Screen: React.FC<{ readonly lit: boolean }> = ({ lit }) => {
  const g = useMemo(() => ({ body: roundedRect(2.2, 1.35, 0.12, 0.08), play: new THREE.ConeGeometry(0.32, 0.5, 3), foot: new THREE.BoxGeometry(0.7, 0.08, 0.3) }), []);
  return (
    <group>
      <WireMesh geometry={g.body} alert={lit} fill={0.18} edge={2} edgeAngle={10} />
      <group position={[0.05, 0, 0.08]} rotation={[0, 0, -Math.PI / 2]}>
        <WireMesh geometry={g.play} alert fill={0.35} edge={2.2} edgeAngle={10} />
      </group>
      <group position={[0, -0.85, 0]}>
        <WireMesh geometry={g.foot} alert={lit} fill={0.2} edge={1.8} edgeAngle={10} />
      </group>
    </group>
  );
};

const Cup: React.FC<{ readonly lit: boolean }> = ({ lit }) => {
  const g = useMemo(() => ({ body: new THREE.CylinderGeometry(0.62, 0.45, 1.5, 16, 4, true), lid: new THREE.CylinderGeometry(0.68, 0.68, 0.14, 16, 1), straw: new THREE.CylinderGeometry(0.05, 0.05, 1.1, 6, 1) }), []);
  return (
    <group>
      <WireMesh geometry={g.body} alert={lit} fill={0.18} edge={2} edgeAngle={20} />
      <group position={[0, 0.8, 0]}>
        <WireMesh geometry={g.lid} alert={lit} fill={0.25} edge={2} edgeAngle={20} />
      </group>
      <group position={[0.2, 1.25, 0]} rotation={[0, 0, -0.25]}>
        <WireMesh geometry={g.straw} alert fill={0.4} edge={2.2} edgeAngle={20} />
      </group>
    </group>
  );
};

const SpendObject: React.FC<{ readonly kind: Spend; readonly lit: boolean }> = ({ kind, lit }) => {
  if (kind === "phone") {
    return (
      <group scale={0.62}>
        <Phone lit={lit} />
      </group>
    );
  }
  if (kind === "bag") {
    return (
      <group scale={0.7}>
        <Bag lit={lit} />
      </group>
    );
  }
  if (kind === "screen") {
    return (
      <group scale={0.7}>
        <Screen lit={lit} />
      </group>
    );
  }
  return (
    <group scale={0.75}>
      <Cup lit={lit} />
    </group>
  );
};

// Carteira com tampa; as cédulas saem uma a uma a partir de `drainAt` (a cada `every` s)
// e voam em arco pros gastos. Vazia, a carteira acende em magenta e treme.
export const DrainWallet: React.FC<{
  readonly drainAt?: number;
  readonly every?: number;
  readonly spends?: Spend[];
  readonly empty?: boolean;
  readonly alert?: boolean;
  readonly scale?: number;
  // Raio do pedestal (os arcos ficam um pouco além).
  readonly ring?: number;
}> = ({ drainAt, every = 0.22, spends = [], empty = false, alert = false, scale = 1.25, ring = 1.9 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const g = useMemo(() => ({ body: roundedRect(2.4, 1.55, 0.2, 0.42), flap: roundedRect(2.4, 0.66, 0.14, 0.08), clasp: new THREE.SphereGeometry(0.11, 10, 8) }), []);
  const left = (k: number) => (empty ? 1 : drainAt === undefined ? 0 : clamp01((t - (drainAt + k * every)) / 0.7));
  const allOut = empty || (drainAt !== undefined && t > drainAt + (NOTES - 1) * every + 0.7);
  const lit = alert || allOut;
  const shake = allOut ? Math.sin(t * 26) * 0.03 : 0;
  return (
    <group>
      <group position={[shake, -0.6, 0]} scale={scale} rotation={[0.1, Math.sin(t * 0.7) * 0.35, 0]}>
        <WireMesh geometry={g.body} alert={lit} fill={0.2} edge={2.1} edgeAngle={10} />
        <group position={[0, 0.36, 0.24]} rotation={[0.3, 0, 0]}>
          <WireMesh geometry={g.flap} alert={lit} fill={0.25} edge={2.1} edgeAngle={10} />
          <mesh geometry={g.clasp} position={[0.8, -0.08, 0.06]}>
            <meshBasicMaterial color={glow(lit ? WIRE.alert : WIRE.cyan, 2.2)} toneMapped={false} />
          </mesh>
        </group>
        {lit ? <Core geometry={g.body} intensity={0.35} /> : null}
      </group>
      {/* cédulas: paradas na boca da carteira, depois em arco até um gasto (ou pra cima, sumindo) */}
      {Array.from({ length: NOTES }, (_, k) => {
        const p = left(k);
        if (p >= 1) {
          return null;
        }
        const home: [number, number, number] = [-0.7 + (k % 3) * 0.7, 0.55 + Math.floor(k / 3) * 0.18 + Math.sin(t * 2 + k) * 0.04, -0.05 * k];
        // sem gastos em volta, as cédulas saem pros lados (baixo, pra não cruzar o texto de cima)
        const side = k % 2 ? 1 : -1;
        const target: [number, number, number] = spends.length ? spendPos(k % spends.length, spends.length) : [side * (2.6 + random(`dw-${k}`) * 1.2), 0.8 + random(`dwy-${k}`) * 0.8, 0.8];
        const e = ease(p);
        const x = home[0] + (target[0] - home[0]) * e;
        const y = home[1] + (target[1] - home[1]) * e + Math.sin(p * Math.PI) * 1.6;
        const z = home[2] + (target[2] - home[2]) * e;
        const s = interpolate(p, [0, 0.7, 1], [0.5, 0.42, 0.05]);
        return (
          <group key={k} position={[x, y, z]} rotation={[p * 4 + k, p * 5, 0.2 * (k - 2.5) + p * 3]} scale={s}>
            <Banknote alert={p > 0.6} />
          </group>
        );
      })}
      {spends.map((kind, i) => {
        const [x, y, z] = spendPos(i, spends.length);
        const hits = Array.from({ length: NOTES }, (_, k) => k).filter((k) => k % spends.length === i);
        const hit = drainAt === undefined ? 0 : Math.max(0, ...hits.map((k) => spring({ frame: frame - Math.round((drainAt + k * every + 0.7) * fps), fps, config: { damping: 9, stiffness: 200 } })));
        const lit2 = drainAt !== undefined && hits.some((k) => t > drainAt + k * every + 0.7);
        return (
          <group key={`${kind}-${i}`} position={[x, y + Math.sin(t * 1.3 + i) * 0.06, z]} rotation={[0, Math.sin(t * 0.8 + i) * 0.4, 0]} scale={1 + 0.12 * Math.sin(Math.min(1, hit) * Math.PI)}>
            <SpendObject kind={kind} lit={lit2} />
          </group>
        );
      })}
      <Pedestal radius={ring} y={FLOOR_Y + 0.05} alert={lit} />
      <OrbitArcs radius={ring + 0.2} y={-0.5} count={2} speed={0.8} color={lit ? WIRE.alert : WIRE.cyan} />
    </group>
  );
};

export const walletBox = (spends: number) =>
  spends > 0 ? new THREE.Box3(new THREE.Vector3(-SPEND_R - 1.1, FLOOR_Y - 0.1, -1.9), new THREE.Vector3(SPEND_R + 1.1, 3.0, 1.9)) : new THREE.Box3(new THREE.Vector3(-2.3, FLOOR_Y - 0.1, -2.1), new THREE.Vector3(2.3, 2.2, 2.1));

// ---------------------------------------------------------------- balão do padrão de vida

export const BALLOON_R = 1.55;

// Balão de malha preso por um barbante a um peso no chão; infla de `from` até `to` a partir
// de `inflateAt` (em `seconds`). Perto do máximo, treme e acende em magenta.
export const Balloon3D: React.FC<{ readonly from?: number; readonly to?: number; readonly inflateAt?: number; readonly seconds?: number; readonly alert?: boolean }> = ({
  from = 0.45,
  to = 1,
  inflateAt,
  seconds = 1.6,
  alert = false,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const k = inflateAt === undefined ? from : from + (to - from) * ease(clamp01((t - inflateAt) / seconds));
  const tense = clamp01((k - 0.86) / 0.14);
  const lit = alert || tense > 0.4;
  const g = useMemo(() => {
    const body = new THREE.SphereGeometry(BALLOON_R, 22, 16);
    body.scale(1, 1.15, 1);
    return { body, knot: new THREE.ConeGeometry(0.16, 0.26, 10), weight: new THREE.BoxGeometry(0.6, 0.4, 0.6, 2, 2, 2) };
  }, []);
  const r = BALLOON_R * 1.15 * k;
  const cy = 0.6 + r * 0.55;
  const jitter = tense * Math.sin(t * 45) * 0.04;
  const string = useMemo(() => new THREE.BufferGeometry(), []);
  const pts = Array.from({ length: 16 }, (_, i) => {
    const u = i / 15;
    const top = cy - r - 0.12;
    return new THREE.Vector3(Math.sin(u * Math.PI * 2 + t * 2) * 0.12 * (1 - u), top + (FLOOR_Y + 0.4 - top) * u, 0);
  });
  // lineSegments liga os vértices em pares: repete os pontos do meio pra linha ficar contínua
  string.setFromPoints(pts.slice(0, -1).flatMap((v, i) => [v, pts[i + 1]]));
  return (
    <group>
      <group position={[jitter, cy + Math.sin(t * 1.6) * 0.06, 0]} rotation={[0, t * 0.4, Math.sin(t * 1.1) * 0.06]} scale={k}>
        <WireMesh geometry={g.body} alert={lit} fill={0.16} edge={2} edgeAngle={8} />
        <Core geometry={g.body} intensity={0.15 + 0.35 * k} color={lit ? WIRE.alert : WIRE.cyan} />
        <mesh geometry={g.knot} position={[0, -BALLOON_R * 1.15 - 0.08, 0]} rotation={[Math.PI, 0, 0]}>
          <meshBasicMaterial color={glow(lit ? WIRE.alert : WIRE.cyan, 2)} toneMapped={false} />
        </mesh>
      </group>
      <lineSegments geometry={string}>
        <lineBasicMaterial color={glow(WIRE.white, 1.4)} toneMapped={false} />
      </lineSegments>
      <group position={[0, FLOOR_Y + 0.22, 0]}>
        <WireMesh geometry={g.weight} fill={0.25} edge={2} edgeAngle={10} />
      </group>
      <Pedestal radius={1.4} y={FLOOR_Y + 0.05} alert={lit} />
    </group>
  );
};

export const balloonBox = (to = 1) => {
  const r = BALLOON_R * 1.15 * to;
  const cy = 0.6 + r * 0.55;
  return new THREE.Box3(new THREE.Vector3(-BALLOON_R * to - 0.2, FLOOR_Y - 0.1, -BALLOON_R * to), new THREE.Vector3(BALLOON_R * to + 0.2, cy + r + 0.15, BALLOON_R * to));
};

// ---------------------------------------------------------------- escada que só sobe

export const STEPS = 6;
const STEP = { w: 0.95, h: 0.55, d: 1.6 };
const stepTop = (i: number): [number, number, number] => [-2.4 + i * STEP.w, FLOOR_Y + (i + 1) * STEP.h, 0];

// Degraus subindo da esquerda pra direita; um boneco de luz sobe um degrau a cada `every` s
// a partir de `climbAt`. À esquerda, a seta de volta (pra baixo) é barrada por um X magenta
// em `blockAt`.
export const StairsUp: React.FC<{ readonly climbAt?: number; readonly every?: number; readonly blockAt?: number; readonly alert?: boolean }> = ({ climbAt = 0.2, every = 0.42, blockAt, alert = false }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const g = useMemo(
    () => ({
      step: new THREE.BoxGeometry(STEP.w, STEP.h, STEP.d, 2, 2, 2),
      body: new THREE.CapsuleGeometry(0.17, 0.42, 4, 10),
      head: new THREE.SphereGeometry(0.15, 12, 10),
      shaft: new THREE.CylinderGeometry(0.09, 0.09, 1.2, 8, 1),
      tip: new THREE.ConeGeometry(0.26, 0.42, 10),
      bar: new THREE.BoxGeometry(1.25, 0.12, 0.12),
    }),
    [],
  );
  // posição do boneco: degrau atual com um pulinho entre um e outro
  const raw = Math.max(0, (t - climbAt) / every);
  const i0 = Math.min(STEPS - 1, Math.floor(raw));
  const ph = raw >= STEPS - 1 ? 1 : raw - Math.floor(raw);
  const a = stepTop(i0);
  const b = stepTop(Math.min(STEPS - 1, i0 + 1));
  const hop = ph < 0.35 ? ease(ph / 0.35) : 1;
  const px = a[0] + (b[0] - a[0]) * hop;
  const py = a[1] + (b[1] - a[1]) * hop + Math.sin(hop * Math.PI) * 0.35 + 0.42;
  const blocked = blockAt !== undefined ? spring({ frame: frame - Math.round(blockAt * fps), fps, config: { damping: 9, stiffness: 220 } }) : 0;
  return (
    <group>
      {Array.from({ length: STEPS }, (_, i) => {
        const [x, y] = stepTop(i);
        const on = i <= i0;
        return (
          <group key={i} position={[x, y - STEP.h / 2, 0]}>
            <WireMesh geometry={g.step} alert={alert} fill={on ? 0.24 : 0.12} edge={on ? 2.3 : 1.5} edgeAngle={10} />
          </group>
        );
      })}
      {/* boneco de luz */}
      <group position={[px, py, 0.1]}>
        <WireMesh geometry={g.body} fill={0.35} edge={2.4} edgeAngle={20} />
        <Core geometry={g.body} intensity={0.6} color={WIRE.cyan} />
        <mesh geometry={g.head} position={[0, 0.48, 0]}>
          <meshBasicMaterial color={glow(WIRE.white, 1.8)} toneMapped={false} />
        </mesh>
      </group>
      {/* seta de volta (pra baixo) e o X que barra */}
      <group position={[-3.15, FLOOR_Y + 1.6, 0.4]}>
        <group position={[0, Math.sin(t * 3) * 0.06, 0]}>
          <mesh geometry={g.shaft}>
            <meshBasicMaterial color={glow(blocked > 0.5 ? WIRE.alert : WIRE.white, 1.5)} toneMapped={false} transparent opacity={0.85} />
          </mesh>
          <mesh geometry={g.tip} position={[0, -0.75, 0]} rotation={[Math.PI, 0, 0]}>
            <meshBasicMaterial color={glow(blocked > 0.5 ? WIRE.alert : WIRE.white, 1.6)} toneMapped={false} />
          </mesh>
        </group>
        {blocked > 0.01
          ? [1, -1].map((s) => (
              <mesh key={s} geometry={g.bar} rotation={[0, 0, (s * Math.PI) / 4]} position={[0, -0.2, 0.25]} scale={[blocked, 1, 1]}>
                <meshBasicMaterial color={glow(WIRE.alert, 2.6)} toneMapped={false} />
              </mesh>
            ))
          : null}
      </group>
      <Pedestal radius={3.2} y={FLOOR_Y + 0.03} alert={alert} />
    </group>
  );
};

export const STAIRS_BOX = new THREE.Box3(new THREE.Vector3(-3.8, FLOOR_Y - 0.1, -1.1), new THREE.Vector3(3.0, FLOOR_Y + STEPS * STEP.h + 1.2, 1.1));

// ---------------------------------------------------------------- aumento se dividindo

export const SPLIT_X = 2.5;

const House: React.FC = () => {
  const g = useMemo(() => {
    const roof = new THREE.ConeGeometry(1.25, 0.9, 4, 1);
    roof.rotateY(Math.PI / 4);
    return { body: new THREE.BoxGeometry(1.6, 1.25, 1.4, 2, 2, 2), roof, door: new THREE.PlaneGeometry(0.36, 0.6) };
  }, []);
  return (
    <group>
      <WireMesh geometry={g.body} fill={0.16} edge={2} edgeAngle={10} />
      <group position={[0, 1.07, 0]}>
        <WireMesh geometry={g.roof} fill={0.2} edge={2} edgeAngle={10} />
      </group>
      <mesh geometry={g.door} position={[0, -0.32, 0.71]}>
        <meshBasicMaterial color={glow(WIRE.cyan, 1.4)} toneMapped={false} transparent opacity={0.6} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
};

const Vault: React.FC<{ readonly fill: number }> = ({ fill }) => {
  const frame = useCurrentFrame();
  const g = useMemo(
    () => ({ body: new THREE.BoxGeometry(1.55, 1.55, 1.3, 2, 2, 2), ring: new THREE.TorusGeometry(0.42, 0.06, 6, 24), spoke: new THREE.BoxGeometry(0.62, 0.05, 0.05), stack: new THREE.BoxGeometry(1.1, 0.12, 0.6) }),
    [],
  );
  const bars = Math.round(fill * 6);
  return (
    <group>
      <WireMesh geometry={g.body} fill={0.16} edge={2.2} edgeAngle={10} />
      <group position={[0, 0.05, 0.67]} rotation={[0, 0, frame * 0.04]}>
        <mesh geometry={g.ring}>
          <meshBasicMaterial color={glow(WIRE.cyan, 2.2)} toneMapped={false} />
        </mesh>
        {[0, 1, 2].map((i) => (
          <mesh key={i} geometry={g.spoke} rotation={[0, 0, (i * Math.PI) / 3]}>
            <meshBasicMaterial color={glow(WIRE.cyan, 2)} toneMapped={false} />
          </mesh>
        ))}
      </group>
      {/* reserva crescendo em cima do cofre */}
      {Array.from({ length: bars }, (_, i) => (
        <group key={i} position={[0, 0.86 + i * 0.14, 0]}>
          <WireMesh geometry={g.stack} fill={0.35} edge={2.2} edgeAngle={10} edgeColor={WIRE.cyan} />
        </group>
      ))}
    </group>
  );
};

// Pilha do aumento no alto; a partir de `splitAt`, as partículas descem e se dividem: uma
// parte pra casa (o padrão de vida de sempre), a fatia `share` pro cofre (reserva), que
// vai empilhando.
export const RaiseSplit: React.FC<{ readonly splitAt?: number; readonly share?: number; readonly seconds?: number }> = ({ splitAt = 0.4, share = 0.45, seconds = 2.2 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const g = useMemo(() => ({ stack: new THREE.BoxGeometry(1.5, 0.16, 0.8, 2, 1, 1), dot: new THREE.OctahedronGeometry(0.075, 0) }), []);
  const p = clamp01((t - splitAt) / seconds);
  const N = 36;
  return (
    <group>
      {/* o aumento: pilha de cédulas pulsando no alto */}
      <group position={[0, 2.3 + Math.sin(t * 2) * 0.05, 0]} rotation={[0, t * 0.5, 0]}>
        {[0, 1, 2, 3].map((i) => (
          <group key={i} position={[0, i * 0.18, 0]}>
            <WireMesh geometry={g.stack} fill={0.3} edge={2.3} edgeAngle={10} edgeColor={WIRE.white} />
          </group>
        ))}
      </group>
      {t >= splitAt
        ? Array.from({ length: N }, (_, k) => {
            const toVault = k / N < share;
            const period = 1.1;
            const ph = (((t - splitAt - (k / N) * period) / period) % 1 + 1) % 1;
            if (t - splitAt < (k / N) * period) {
              return null;
            }
            const tx = toVault ? SPLIT_X : -SPLIT_X;
            const x = interpolate(ph, [0, 0.35, 1], [0, tx * 0.2, tx]) + (random(`rs-${k}`) - 0.5) * 0.3;
            const y = interpolate(ph, [0, 1], [2.1, -0.2]) + Math.sin(ph * Math.PI) * 0.5;
            return (
              <mesh key={k} geometry={g.dot} position={[x, y, (random(`rz-${k}`) - 0.5) * 0.6]} rotation={[ph * 6, ph * 4, 0]}>
                <meshBasicMaterial color={glow(toVault ? WIRE.cyan : WIRE.white, toVault ? 2.6 : 1.6)} toneMapped={false} transparent opacity={interpolate(ph, [0, 0.1, 0.9, 1], [0, 1, 1, 0])} />
              </mesh>
            );
          })
        : null}
      <group position={[-SPLIT_X, FLOOR_Y + 0.68, 0]}>
        <House />
      </group>
      <group position={[SPLIT_X, FLOOR_Y + 0.8, 0]}>
        <Vault fill={p} />
      </group>
      <group position={[-SPLIT_X, 0, 0]}>
        <Pedestal radius={1.15} y={FLOOR_Y + 0.04} />
      </group>
      <group position={[SPLIT_X, 0, 0]}>
        <Pedestal radius={1.15} y={FLOOR_Y + 0.04} />
      </group>
    </group>
  );
};

export const SPLIT_BOX = new THREE.Box3(new THREE.Vector3(-SPLIT_X - 1.25, FLOOR_Y - 0.6, -1.2), new THREE.Vector3(SPLIT_X + 1.25, 3.2, 1.2));
// Rótulos embaixo da casa e do cofre (projetados no HTML).
export const splitLabelAnchor = (side: -1 | 1): [number, number, number] => [side * SPLIT_X, FLOOR_Y - 0.35, 0.8];

// ---------------------------------------------------------------- celular com quiz

// Celular de malha com a tela do quiz: barra de progresso, pergunta (traços) e 3 opções; a
// opção `pick` acende em `pickAt`.
export const QuizPhone3D: React.FC<{ readonly pickAt?: number; readonly pick?: number }> = ({ pickAt = 0.8, pick = 2 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const g = useMemo(
    () => ({ body: roundedRect(1.7, 3.4, 0.26, 0.16), opt: roundedRect(1.25, 0.34, 0.12, 0.04), bar: new THREE.BoxGeometry(1.25, 0.06, 0.02), line: new THREE.BoxGeometry(1.0, 0.07, 0.02) }),
    [],
  );
  const tap = spring({ frame: frame - Math.round(pickAt * fps), fps, config: { damping: 10, stiffness: 200 } });
  const prog = 0.25 + 0.25 * clamp01(tap);
  return (
    <group rotation={[0, Math.sin(t * 0.8) * 0.35, 0]}>
      <WireMesh geometry={g.body} fill={0.16} edge={2.2} edgeAngle={10} />
      {/* progresso */}
      <mesh geometry={g.bar} position={[0, 1.25, 0.1]}>
        <meshBasicMaterial color={glow(WIRE.white, 0.8)} toneMapped={false} transparent opacity={0.4} />
      </mesh>
      <mesh geometry={g.bar} position={[-0.625 + 0.625 * prog, 1.25, 0.11]} scale={[prog, 1.4, 1]}>
        <meshBasicMaterial color={glow(WIRE.cyan, 2.4)} toneMapped={false} />
      </mesh>
      {/* pergunta */}
      {[0, 1].map((i) => (
        <mesh key={i} geometry={g.line} position={[-0.12 * i, 0.85 - i * 0.2, 0.1]} scale={[1 - 0.25 * i, 1, 1]}>
          <meshBasicMaterial color={glow(WIRE.white, 1.6)} toneMapped={false} />
        </mesh>
      ))}
      {/* opções */}
      {[0, 1, 2].map((i) => {
        const chosen = i === pick && tap > 0.05;
        return (
          <group key={i} position={[0, 0.2 - i * 0.5, 0.1]} scale={chosen ? 1 + 0.08 * Math.sin(Math.min(1, tap) * Math.PI) : 1}>
            <WireMesh geometry={g.opt} alert={chosen} fill={chosen ? 0.45 : 0.15} edge={chosen ? 2.6 : 1.8} edgeAngle={10} />
            {chosen ? <Core geometry={g.opt} intensity={0.8} /> : null}
          </group>
        );
      })}
    </group>
  );
};

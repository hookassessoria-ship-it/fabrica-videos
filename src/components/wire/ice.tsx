import React, { useMemo } from "react";
import { interpolate, random, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { type FloorMove, floorAt } from "../kinetic/Building";
import { FLOOR_Y } from "./charts";
import { glow, WIRE } from "./theme";
import { Core, WireMesh } from "./Wire";

// Analogia do gelo em holograma (roteiro 002): cubo de gelo com cifrão que derrete em
// partículas, sol de malha com brilho quente, copo enchendo, freezer, dominós, ciclo de
// luz, zeros cortados, pizza e relógio. Layouts são contas puras, usadas pelo 3D e pelos
// rótulos HTML projetados.

export const WARM = "#FFB547";
const ICE_EDGE = "#BFF6FF";

// ---------------------------------------------------------------- layout da bancada

export const ICE_SIZE = 2.1;
const GLASS_H = 2.2;

// Itens lado a lado no chão, centrados (o freezer, se houver, fica à direita).
export const benchLayout = (items: unknown[], freezer = false) => {
  const step = 3.1;
  const n = items.length + (freezer ? 1 : 0);
  const xs = items.map((_, i) => (i - (n - 1) / 2) * step);
  const freezerX = freezer ? ((n - 1) / 2) * step + 0.2 : undefined;
  return { xs, freezerX };
};

export const iceRemain = (it: { remain: number; melt: FloorMove[] }, frame: number, fps: number) => Math.max(0, Math.min(1, floorAt({ floor: it.remain, moves: it.melt }, frame, fps)));

export const glassLevel = (it: { level: number; moves: FloorMove[] }, frame: number, fps: number) => Math.max(0, Math.min(1, floorAt({ floor: it.level, moves: it.moves }, frame, fps)));

// Centro (mundo) do cubo, que baixa conforme derrete.
export const iceCenter = (x: number, size: number, r: number): [number, number, number] => [x, FLOOR_Y + (size * Math.max(0.06, r)) / 2 + 0.02, 0];

// ---------------------------------------------------------------- cifrão

const dollarCurve = (s: number) => {
  const pts = [
    [0.42, 0.52],
    [0.12, 0.74],
    [-0.32, 0.62],
    [-0.4, 0.28],
    [-0.05, 0.05],
    [0.36, -0.18],
    [0.4, -0.55],
    [0.05, -0.75],
    [-0.42, -0.55],
  ].map(([x, y]) => new THREE.Vector3(x * s, y * s, 0));
  return new THREE.CatmullRomCurve3(pts);
};

const Dollar: React.FC<{ readonly size: number; readonly color: string }> = ({ size, color }) => {
  const geo = useMemo(() => {
    const s = new THREE.TubeGeometry(dollarCurve(size), 48, size * 0.06, 8, false);
    const bar = new THREE.CylinderGeometry(size * 0.045, size * 0.045, size * 1.9, 8);
    return { s, bar };
  }, [size]);
  return (
    <group>
      <mesh geometry={geo.s}>
        <meshBasicMaterial color={glow(color, 2.4)} toneMapped={false} />
      </mesh>
      <mesh geometry={geo.bar}>
        <meshBasicMaterial color={glow(color, 2.2)} toneMapped={false} />
      </mesh>
    </group>
  );
};

// ---------------------------------------------------------------- cubo de gelo

export const Ice3D: React.FC<{
  readonly seed: string;
  readonly x: number;
  readonly size?: number;
  readonly remain: number;
  readonly melt: FloorMove[];
  readonly freezeAt?: number;
  readonly alert?: boolean;
  readonly spin?: number;
  readonly glyph?: boolean;
}> = ({ seed, x, size = ICE_SIZE, remain, melt, freezeAt, alert = false, spin = 12, glyph = true }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const r = iceRemain({ remain, melt }, frame, fps);
  const rPrev = iceRemain({ remain, melt }, frame - 3, fps);
  const frozen = freezeAt !== undefined && frame >= freezeAt * fps;
  const melting = !frozen && rPrev - r > 0.0005;
  const sy = Math.max(0.06, r);
  const sx = 0.55 + 0.45 * Math.sqrt(r);
  const box = useMemo(() => new THREE.BoxGeometry(size, size, size, 3, 3, 3), [size]);
  const inner = useMemo(() => new THREE.BoxGeometry(size * 0.92, size * 0.92, size * 0.92), [size]);
  const puddleGeo = useMemo(() => new THREE.CircleGeometry(1, 48), []);
  const ringGeo = useMemo(() => new THREE.RingGeometry(0.97, 1, 64), []);
  const center = iceCenter(x, size, r);
  const edge = alert ? WIRE.alert : frozen ? "#FFFFFF" : ICE_EDGE;
  const flash = frozen ? interpolate(frame, [freezeAt * fps, freezeAt * fps + 8, freezeAt * fps + 30], [0, 1, 0.5], { extrapolateRight: "clamp" }) : 0;
  const puddle = size * (0.35 + 1.1 * (1 - r));

  // Partículas: derretendo, caem do cubo até o chão; congelado, faíscas brancas em volta.
  const particles = useMemo(() => {
    const n = 90;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const rr = (k: string) => random(`${seed}-p${i}-${k}`);
      if (frozen) {
        const a = rr("a") * Math.PI * 2 + t * (0.4 + rr("s"));
        const rad = size * (0.75 + 0.35 * rr("r"));
        pos.set([center[0] + Math.cos(a) * rad, center[1] + (rr("y") - 0.5) * size * 1.2, Math.sin(a) * rad], i * 3);
        continue;
      }
      const period = 0.9 + rr("p") * 0.8;
      const k = ((t + rr("o") * period) % period) / period;
      const sx0 = (rr("x") - 0.5) * size * sx;
      const sz0 = (rr("z") - 0.5) * size * sx;
      const top = center[1] + (size * sy) / 2;
      const y0 = top - rr("h") * size * sy;
      const y = Math.max(FLOOR_Y + 0.02, y0 - k * k * 3.2);
      pos.set([center[0] + sx0 * (1 + k * 0.4), y, sz0 * (1 + k * 0.4)], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    return g;
  }, [seed, frozen, t, size, sx, sy, center]);

  return (
    <group>
      {/* poça */}
      {1 - r > 0.03 ? (
        <group position={[x, FLOOR_Y + 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[puddle, puddle * 0.8, 1]}>
          <mesh geometry={puddleGeo}>
            <meshBasicMaterial color={glow(alert ? WIRE.alert : WIRE.cyan, 1.2)} transparent opacity={0.22} blending={THREE.AdditiveBlending} toneMapped={false} depthWrite={false} />
          </mesh>
          <mesh geometry={ringGeo}>
            <meshBasicMaterial color={glow(alert ? WIRE.alert : WIRE.cyan, 2)} transparent opacity={0.8} toneMapped={false} />
          </mesh>
        </group>
      ) : null}
      <group position={center} rotation={[0.18, (t * spin * Math.PI) / 180 + 0.6, 0]} scale={[sx, sy, sx]}>
        <WireMesh geometry={box} fill={0.1 + 0.2 * flash} edge={2 + 1.5 * flash} edgeAngle={1} edgeColor={edge} color={alert ? WIRE.alert : WIRE.white} />
        <Core geometry={inner} intensity={0.18 + 0.4 * flash} color={alert ? WIRE.alert : "#9FE9FF"} />
        {glyph && r > 0.15 ? (
          <group scale={[1 / sx, 1 / sy, 1 / sx]}>
            <group scale={[sx, Math.max(0.3, sy), sx]}>
              <Dollar size={size * 0.42} color={alert ? WIRE.alert : WIRE.cyan} />
            </group>
          </group>
        ) : null}
      </group>
      {melting || frozen ? (
        <points geometry={particles}>
          <pointsMaterial color={glow(frozen ? "#FFFFFF" : alert ? WIRE.alert : ICE_EDGE, 2)} size={frozen ? 0.07 : 0.05} sizeAttenuation transparent opacity={0.9} toneMapped={false} depthWrite={false} />
        </points>
      ) : null}
    </group>
  );
};

// ---------------------------------------------------------------- sol

export const Sun3D: React.FC<{ readonly position: [number, number, number]; readonly radius?: number }> = ({ position, radius = 0.9 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const geo = useMemo(() => new THREE.IcosahedronGeometry(radius, 2), [radius]);
  const halo = useMemo(() => new THREE.SphereGeometry(radius * 1.9, 24, 16), [radius]);
  const rays = useMemo(() => {
    const n = 16;
    const pts: number[] = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const r1 = radius * 1.35;
      const r2 = radius * (i % 2 ? 1.8 : 2.15);
      pts.push(Math.cos(a) * r1, Math.sin(a) * r1, 0, Math.cos(a) * r2, Math.sin(a) * r2, 0);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    return g;
  }, [radius]);
  const pulse = 1 + Math.sin(t * 3.2) * 0.05;
  return (
    <group position={position}>
      <group rotation={[0.3, t * 0.5, 0]} scale={pulse}>
        <WireMesh geometry={geo} fill={0.22} edge={2.2} edgeAngle={1} color={WARM} edgeColor={WARM} />
        <Core geometry={geo} intensity={0.9} color="#FF8A2A" />
      </group>
      <mesh geometry={halo} scale={pulse}>
        <meshBasicMaterial color={glow("#FF7A1A", 1.2)} transparent opacity={0.08} blending={THREE.AdditiveBlending} toneMapped={false} depthWrite={false} />
      </mesh>
      <lineSegments geometry={rays} rotation={[0, 0, t * 0.35]}>
        <lineBasicMaterial color={glow(WARM, 2.4)} toneMapped={false} />
      </lineSegments>
    </group>
  );
};

// ---------------------------------------------------------------- copo e freezer

const LIQ = { water: WIRE.cyan, whiskey: WARM, beer: "#FFD24A" };

export const Glass3D: React.FC<{ readonly x: number; readonly level: number; readonly moves: FloorMove[]; readonly liquid?: "water" | "whiskey" | "beer"; readonly ice?: number }> = ({
  x,
  level,
  moves,
  liquid = "water",
  ice = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const lv = glassLevel({ level, moves }, frame, fps);
  const H = GLASS_H;
  const rTop = 0.85;
  const rBot = 0.7;
  const cup = useMemo(() => new THREE.CylinderGeometry(rTop, rBot, H, 28, 1, true), [H]);
  const base = useMemo(() => new THREE.CircleGeometry(rBot, 28), []);
  const h = Math.max(0.02, (H - 0.1) * lv);
  // raio do copo na altura do líquido
  const rLiq = rBot + ((rTop - rBot) * h) / H;
  const liquidGeo = useMemo(() => new THREE.CylinderGeometry(rLiq * 0.96, rBot * 0.96, h, 28, 1), [h, rLiq]);
  const surface = useMemo(() => new THREE.RingGeometry(rLiq * 0.5, rLiq * 0.96, 32), [rLiq]);
  const cube = useMemo(() => new THREE.BoxGeometry(0.38, 0.38, 0.38), []);
  const col = LIQ[liquid];
  return (
    <group position={[x, FLOOR_Y, 0]}>
      <group position={[0, H / 2, 0]}>
        <WireMesh geometry={cup} fill={0.06} edge={2} edgeAngle={1} edgeColor={ICE_EDGE} />
      </group>
      <mesh geometry={base} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <meshBasicMaterial color={glow(ICE_EDGE, 1)} transparent opacity={0.15} blending={THREE.AdditiveBlending} toneMapped={false} depthWrite={false} />
      </mesh>
      {lv > 0.01 ? (
        <>
          <group position={[0, h / 2 + 0.04, 0]}>
            <Core geometry={liquidGeo} intensity={0.55} color={col} />
          </group>
          <mesh geometry={surface} rotation={[-Math.PI / 2, 0, t]} position={[0, h + 0.05, 0]}>
            <meshBasicMaterial color={glow(col, 2.2)} transparent opacity={0.85} toneMapped={false} side={THREE.DoubleSide} />
          </mesh>
        </>
      ) : null}
      {Array.from({ length: ice }, (_, i) => (
        <group key={i} position={[(i - (ice - 1) / 2) * 0.48, h + 0.12 + Math.sin(t * 2 + i) * 0.04, 0.05 * i]} rotation={[0.3 * i, t * 0.6 + i, 0.2]}>
          <WireMesh geometry={cube} fill={0.12} edge={2} edgeAngle={1} edgeColor={ICE_EDGE} />
        </group>
      ))}
    </group>
  );
};

export const Freezer3D: React.FC<{ readonly x: number }> = ({ x }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const geo = useMemo(() => new THREE.BoxGeometry(1.7, 3.3, 1.4, 1, 1, 1), []);
  const door = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute([-0.85, 0.5, 0.71, 0.85, 0.5, 0.71, 0.62, 0.9, 0.73, 0.62, 1.35, 0.73, 0.62, -0.1, 0.73, 0.62, -1.1, 0.73], 3));
    return g;
  }, []);
  const frost = 0.25 + 0.1 * Math.sin((frame / fps) * 2);
  return (
    <group position={[x, FLOOR_Y + 1.65, 0]} rotation={[0, -0.25, 0]}>
      <WireMesh geometry={geo} fill={0.08} edge={1.8} edgeAngle={1} />
      <Core geometry={geo} intensity={frost} color="#7FE3FF" />
      <lineSegments geometry={door}>
        <lineBasicMaterial color={glow(WIRE.cyan, 2.4)} toneMapped={false} />
      </lineSegments>
    </group>
  );
};

// ---------------------------------------------------------------- dominós

export const DOMINO = { h: 2.2, w: 1.2, t: 0.3, step: 1.5 };

export const dominoXs = (n: number) => Array.from({ length: n }, (_, i) => (i - (n - 1) / 2) * DOMINO.step);

export const dominoAngle = (i: number, n: number, frame: number, fps: number, fallAt: number, every: number, fall: number) => {
  if (i >= fall) {
    return 0;
  }
  const s = (fallAt + i * every) * fps;
  const p = interpolate(frame, [s, s + 0.32 * fps], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: (x) => x * x * x });
  const rest = Math.asin(Math.min(1, (DOMINO.step - DOMINO.t) / DOMINO.h));
  const target = i === n - 1 || i === fall - 1 ? (i === n - 1 ? Math.PI * 0.47 : rest) : rest;
  return p * target;
};

export const Dominoes3D: React.FC<{ readonly n: number; readonly fallAt: number; readonly every: number; readonly fall: number }> = ({ n, fallAt, every, fall }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const geo = useMemo(() => new THREE.BoxGeometry(DOMINO.t, DOMINO.h, DOMINO.w, 1, 2, 1), []);
  const pip = useMemo(() => new THREE.SphereGeometry(0.07, 8, 6), []);
  return (
    <group>
      {dominoXs(n).map((x, i) => {
        const a = dominoAngle(i, n, frame, fps, fallAt, every, fall);
        const down = a > 0.05;
        return (
          // pivô na aresta de baixo à direita: cai pra direita
          <group key={i} position={[x + DOMINO.t / 2, FLOOR_Y, 0]} rotation={[0, 0, -a]}>
            <group position={[-DOMINO.t / 2, DOMINO.h / 2, 0]}>
              <WireMesh geometry={geo} alert={down} fill={down ? 0.25 : 0.12} edge={2} edgeAngle={1} />
              {[-0.45, -0.15, 0.3].map((y, k) => (
                <mesh key={k} geometry={pip} position={[-DOMINO.t / 2 - 0.01, y, (k - 1) * 0.25]}>
                  <meshBasicMaterial color={glow(down ? WIRE.alert : WIRE.cyan, 2.2)} toneMapped={false} />
                </mesh>
              ))}
            </group>
          </group>
        );
      })}
    </group>
  );
};

// Ponto do rótulo de cada dominó (embaixo, no chão).
export const dominoLabelAnchor = (x: number): [number, number, number] => [x, FLOOR_Y - 0.45, 0.6];

// ---------------------------------------------------------------- ciclo

export const CYCLE_R = 2.2;
export const cycleNode = (i: number, n: number): [number, number, number] => {
  const a = Math.PI / 2 - (i / n) * Math.PI * 2;
  return [Math.cos(a) * CYCLE_R, Math.sin(a) * CYCLE_R, 0];
};

export const Cycle3D: React.FC<{ readonly n: number; readonly at: number; readonly every: number; readonly speed: number; readonly alert?: boolean }> = ({ n, at, every, speed, alert = false }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = Math.max(0, frame / fps - at);
  const ring = useMemo(() => new THREE.TorusGeometry(CYCLE_R, 0.025, 8, 96), []);
  const arc = useMemo(() => new THREE.TorusGeometry(CYCLE_R, 0.06, 8, 48, Math.PI * 0.55), []);
  const node = useMemo(() => new THREE.OctahedronGeometry(0.42, 0), []);
  const runner = useMemo(() => new THREE.SphereGeometry(0.13, 12, 8), []);
  const ang = Math.PI / 2 - t * speed * Math.PI * 2;
  const col = alert ? WIRE.alert : WIRE.cyan;
  return (
    <group>
      <mesh geometry={ring}>
        <meshBasicMaterial color={glow(WIRE.cyanDim, 2)} toneMapped={false} />
      </mesh>
      <mesh geometry={arc} rotation={[0, 0, ang - Math.PI * 0.55]}>
        <meshBasicMaterial color={glow(col, 2.4)} toneMapped={false} />
      </mesh>
      <mesh geometry={runner} position={[Math.cos(ang) * CYCLE_R, Math.sin(ang) * CYCLE_R, 0]}>
        <meshBasicMaterial color={glow("#ffffff", 2.6)} toneMapped={false} />
      </mesh>
      {Array.from({ length: n }, (_, i) => {
        const s = interpolate(frame, [(at + i * every) * fps, (at + i * every) * fps + 8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        if (s <= 0) {
          return null;
        }
        const p = cycleNode(i, n);
        const na = Math.atan2(p[1], p[0]);
        const lit = Math.max(0, 1 - Math.abs(Math.atan2(Math.sin(ang - na), Math.cos(ang - na))) / 0.6);
        return (
          <group key={i} position={p} scale={s * (1 + 0.15 * lit)} rotation={[0, t * 1.2 + i, 0]}>
            <WireMesh geometry={node} alert={alert || lit > 0.4} fill={0.18 + 0.3 * lit} edge={2 + lit} edgeAngle={1} />
          </group>
        );
      })}
    </group>
  );
};

// Rótulo do nó do ciclo: pra fora do anel.
export const cycleLabelAnchor = (i: number, n: number): [number, number, number] => {
  const [x, y] = cycleNode(i, n);
  const k = 1 + 0.62 / CYCLE_R;
  return [x * k, y * k - 0.55, 0];
};

// ---------------------------------------------------------------- zeros cortados

export const Zeros3D: React.FC<{ readonly at: number; readonly cutAt: number; readonly count?: number }> = ({ at, cutAt, count = 3 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const full = useMemo(() => new THREE.TorusGeometry(0.55, 0.13, 10, 40), []);
  const half = useMemo(() => new THREE.TorusGeometry(0.55, 0.13, 10, 20, Math.PI), []);
  const laser = useMemo(() => new THREE.BoxGeometry(5.6, 0.04, 0.04), []);
  const y0 = 0.6;
  const cutF = cutAt * fps;
  const sweep = interpolate(frame, [cutF - 6, cutF + 6], [-3, 3], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <group>
      {Array.from({ length: count }, (_, i) => {
        const x = (i - (count - 1) / 2) * 1.35;
        const drop = interpolate(frame, [(at + i * 0.12) * fps, (at + i * 0.12) * fps + 12], [5, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: (v) => 1 - (1 - v) ** 3 });
        const myCut = cutF + i * 3;
        const k = Math.max(0, (frame - myCut) / fps);
        if (frame < myCut) {
          return (
            <group key={i} position={[x, y0 + drop, 0]} scale={[0.72, 1, 1]} rotation={[0, frame / fps + i, 0]}>
              <WireMesh geometry={full} fill={0.16} edge={2.2} edgeAngle={20} />
            </group>
          );
        }
        // cortado: metade de cima sobe e some, a de baixo cai no chão, em magenta
        const fall = Math.min(y0 - FLOOR_Y - 0.15, 4.9 * k * k);
        return (
          <group key={i}>
            <group position={[x - 0.15 * k, y0 + 1.1 * k, -0.4 * k]} scale={[0.72, 1, 1]} rotation={[0, 0, 0.6 * k]}>
              <WireMesh geometry={half} alert fill={0.2} edge={2.2} edgeAngle={20} />
            </group>
            <group position={[x + 0.15 * k, y0 - fall, 0.2 * k]} scale={[0.72, 1, 1]} rotation={[0, 0, Math.PI - 0.5 * k]}>
              <WireMesh geometry={half} alert fill={0.2} edge={2.2} edgeAngle={20} />
            </group>
          </group>
        );
      })}
      {Math.abs(frame - cutF) < 10 ? (
        <mesh geometry={laser} position={[0, y0, 0.3]} rotation={[0, 0, -0.25 + sweep * 0.08]}>
          <meshBasicMaterial color={glow(WIRE.alert, 3)} toneMapped={false} />
        </mesh>
      ) : null}
    </group>
  );
};

// ---------------------------------------------------------------- pizza e relógio

export const Pizza3D: React.FC<{ readonly alert?: boolean }> = ({ alert = false }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const disc = useMemo(() => new THREE.CylinderGeometry(1.7, 1.7, 0.16, 40, 1), []);
  const crust = useMemo(() => new THREE.TorusGeometry(1.7, 0.13, 8, 48), []);
  const pep = useMemo(() => new THREE.CylinderGeometry(0.2, 0.2, 0.05, 16), []);
  const slices = useMemo(() => {
    const pts: number[] = [];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      pts.push(0, 0.1, 0, Math.cos(a) * 1.65, 0.1, Math.sin(a) * 1.65);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    return g;
  }, []);
  const tops = useMemo(() => Array.from({ length: 11 }, (_, i) => [Math.cos(i * 2.4) * (0.4 + (i % 4) * 0.33), Math.sin(i * 2.4) * (0.4 + (i % 4) * 0.33)] as const), []);
  return (
    <group position={[0, -0.2, 0]} rotation={[0.55, (frame / fps) * 0.5, 0]}>
      <WireMesh geometry={disc} fill={0.12} edge={2} edgeAngle={20} color={WARM} edgeColor={WARM} />
      <group rotation={[Math.PI / 2, 0, 0]}>
        <WireMesh geometry={crust} fill={0.15} edge={2} edgeAngle={30} color={WARM} edgeColor={WARM} />
      </group>
      <lineSegments geometry={slices}>
        <lineBasicMaterial color={glow(WARM, 2)} toneMapped={false} />
      </lineSegments>
      {tops.map(([x, z], i) => (
        <mesh key={i} geometry={pep} position={[x, 0.11, z]}>
          <meshBasicMaterial color={glow(alert ? WIRE.alert : "#FF5A3C", 2.2)} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
};

export const Clock3D: React.FC<{ readonly speed?: number }> = ({ speed = 1.6 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const ring = useMemo(() => new THREE.TorusGeometry(1.8, 0.08, 10, 64), []);
  const tick = useMemo(() => new THREE.BoxGeometry(0.06, 0.28, 0.06), []);
  const hand = useMemo(() => new THREE.BoxGeometry(0.09, 1, 0.06), []);
  const dot = useMemo(() => new THREE.SphereGeometry(0.14, 12, 8), []);
  const hands = [
    { len: 1.4, a: -t * speed * Math.PI * 2 },
    { len: 0.9, a: (-t * speed * Math.PI * 2) / 12 },
  ];
  return (
    <group rotation={[0.1, Math.sin(t * 0.6) * 0.3, 0]}>
      <WireMesh geometry={ring} fill={0.14} edge={2.2} edgeAngle={30} />
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2;
        return (
          <mesh key={i} geometry={tick} position={[Math.sin(a) * 1.5, Math.cos(a) * 1.5, 0]} rotation={[0, 0, -a]}>
            <meshBasicMaterial color={glow(WIRE.cyan, 2)} toneMapped={false} />
          </mesh>
        );
      })}
      {hands.map((h, i) => (
        <group key={i} rotation={[0, 0, h.a]}>
          <mesh geometry={hand} position={[0, h.len / 2, 0.05]} scale={[1, h.len, 1]}>
            <meshBasicMaterial color={glow(i === 0 ? WIRE.alert : "#ffffff", 2.4)} toneMapped={false} />
          </mesh>
        </group>
      ))}
      <mesh geometry={dot}>
        <meshBasicMaterial color={glow("#ffffff", 2.4)} toneMapped={false} />
      </mesh>
    </group>
  );
};

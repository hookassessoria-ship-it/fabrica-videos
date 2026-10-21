import React, { useMemo } from "react";
import { Easing, interpolate, random, spring, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { rampSpeed, rampTurns } from "../kinetic/TimeProps";
import { FLOOR_Y } from "./charts";
import { Bot } from "./models";
import { glow, WIRE } from "./theme";
import { Core, WireMesh } from "./Wire";

// Palcos "tempo": relógios e ampulhetas em velocidades diferentes, figura parada com o
// tempo passando em volta, celular com scroll infinito, duas trilhas e blocos empilhando.

const clampOpts = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

// ---------------------------------------------------------------- relógio

export type ClockSpec3D = { speed?: number; speedTo?: number; ramp?: number; time?: number; alert?: boolean; at: number };

export const CLOCK_R = 1.25;

export const Clock3D: React.FC<{ readonly spec: ClockSpec3D }> = ({ spec }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps - spec.at;
  const s0 = spec.speed ?? 0.08;
  const s1 = spec.speedTo ?? s0;
  const ramp = spec.ramp ?? 1.5;
  const turns = rampTurns(t, s0, s1, ramp);
  const time = spec.time ?? 10.13;
  const minA = -((time % 1) + turns) * Math.PI * 2;
  const hourA = -(((time % 12) / 12) + turns / 12) * Math.PI * 2;
  const perFrame = (rampSpeed(t, s0, s1, ramp) * Math.PI * 2) / fps;
  const c = spec.alert ? WIRE.alert : WIRE.cyan;
  const g = useMemo(
    () => ({
      rim: new THREE.TorusGeometry(CLOCK_R, 0.05, 8, 72),
      face: new THREE.CylinderGeometry(CLOCK_R * 0.97, CLOCK_R * 0.97, 0.05, 48, 1),
      tick: new THREE.BoxGeometry(0.05, 0.2, 0.04),
      minute: new THREE.BoxGeometry(0.07, 1.0, 0.05),
      hour: new THREE.BoxGeometry(0.1, 0.65, 0.05),
    }),
    [],
  );
  const hand = (geo: THREE.BufferGeometry, ang: number, len: number, color: string, k: number, opacity = 1, key?: string) => (
    <group key={key} rotation={[0, 0, ang]}>
      <mesh geometry={geo} position={[0, len / 2, 0.06]}>
        <meshBasicMaterial color={glow(color, k)} toneMapped={false} transparent opacity={opacity} depthWrite={false} />
      </mesh>
    </group>
  );
  const ghosts = perFrame > 0.18 ? 6 : 0;
  return (
    <group rotation={[0, Math.sin(frame / fps * 0.7) * 0.2, 0]}>
      <mesh geometry={g.rim}>
        <meshBasicMaterial color={glow(c, 2.2)} toneMapped={false} />
      </mesh>
      <group rotation={[Math.PI / 2, 0, 0]}>
        <WireMesh geometry={g.face} fill={0.06} edge={0.9} edgeAngle={1} alert={spec.alert} />
      </group>
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2;
        return (
          <mesh key={i} geometry={g.tick} position={[Math.sin(a) * CLOCK_R * 0.82, Math.cos(a) * CLOCK_R * 0.82, 0.04]} rotation={[0, 0, -a]} scale={i % 3 === 0 ? [1.4, 1.3, 1] : [1, 0.8, 1]}>
            <meshBasicMaterial color={glow(WIRE.white, 1.6)} toneMapped={false} />
          </mesh>
        );
      })}
      {Array.from({ length: ghosts }, (_, k) => hand(g.minute, minA + (perFrame * (k + 1)) / 2, 1.0, c, 1.6, 0.4 - k * 0.06, `g${k}`))}
      {hand(g.hour, hourA, 0.65, WIRE.white, 1.8)}
      {hand(g.minute, minA, 1.0, spec.alert ? WIRE.alert : WIRE.white, 2)}
      <mesh position={[0, 0, 0.1]}>
        <sphereGeometry args={[0.09, 12, 8]} />
        <meshBasicMaterial color={glow(WIRE.alert, 2.4)} toneMapped={false} />
      </mesh>
    </group>
  );
};

// ---------------------------------------------------------------- ampulheta

export type HourglassSpec3D = { empty?: number; breakAt?: number; at: number };

export const HOURGLASS_H = 1.75;

const hourglassProfile = () =>
  [
    [0.82, -1.55],
    [0.9, -1.2],
    [0.78, -0.62],
    [0.32, -0.16],
    [0.11, 0],
    [0.32, 0.16],
    [0.78, 0.62],
    [0.9, 1.2],
    [0.82, 1.55],
  ].map(([r, y]) => new THREE.Vector2(r, y));

export const Hourglass3D: React.FC<{ readonly spec: HourglassSpec3D; readonly seed: string }> = ({ spec, seed }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const g = useMemo(
    () => ({
      glass: new THREE.LatheGeometry(hourglassProfile(), 22),
      cap: new THREE.CylinderGeometry(1.05, 1.05, 0.14, 24, 1),
      post: new THREE.CylinderGeometry(0.035, 0.035, 3.1, 6),
      sand: new THREE.ConeGeometry(0.7, 1.15, 20, 3),
      shard: new THREE.TetrahedronGeometry(0.2),
    }),
    [],
  );
  const p = interpolate(t, [spec.at + 0.15, spec.at + 0.15 + (spec.empty ?? 2)], [0, 1], { ...clampOpts, easing: Easing.inOut(Easing.cubic) });
  const broken = spec.breakAt !== undefined ? t - spec.breakAt : -1;
  if (broken >= 0) {
    // Estilhaços voando pra fora com gravidade + a areia espirrando.
    const fade = Math.max(0, 1 - broken / 1.1);
    const sandGeo = new THREE.BufferGeometry();
    const sp: number[] = [];
    for (let i = 0; i < 160; i++) {
      const a = random(`${seed}-sa${i}`) * Math.PI * 2;
      const v = 1 + random(`${seed}-sv${i}`) * 2.6;
      const up = random(`${seed}-su${i}`) * 2.2;
      sp.push(Math.cos(a) * v * broken, up * broken - 4.5 * broken * broken, Math.sin(a) * v * broken);
    }
    sandGeo.setAttribute("position", new THREE.Float32BufferAttribute(sp, 3));
    return (
      <group>
        {Array.from({ length: 18 }, (_, i) => {
          const a = (i / 18) * Math.PI * 2 + random(`${seed}-ha${i}`);
          const y0 = (random(`${seed}-hy${i}`) - 0.5) * 2.8;
          const v = 1.6 + random(`${seed}-hv${i}`) * 2.2;
          const pos: [number, number, number] = [Math.cos(a) * (0.6 + v * broken), y0 + 1.6 * broken - 4.9 * broken * broken, Math.sin(a) * (0.6 + v * broken)];
          const rot = broken * (4 + random(`${seed}-hr${i}`) * 8);
          return (
            <group key={i} position={pos} rotation={[rot, rot * 0.7, 0]} scale={fade}>
              <WireMesh geometry={g.shard} fill={0.2} edge={2.2} edgeAngle={1} />
            </group>
          );
        })}
        <points geometry={sandGeo}>
          <pointsMaterial color={glow(WIRE.alert, 2.4)} size={0.07} sizeAttenuation transparent opacity={fade} toneMapped={false} depthWrite={false} />
        </points>
      </group>
    );
  }
  const crack = spec.breakAt !== undefined ? Math.max(0, Math.min(1, (t - (spec.breakAt - 0.3)) / 0.3)) : 0;
  const shake = crack * Math.sin(frame * 2.7) * 0.05;
  return (
    <group position={[shake, 0, 0]} rotation={[0, frame / fps * 0.5, 0]}>
      <WireMesh geometry={g.glass} fill={0.08 + crack * 0.2} edge={1.6 + crack * 1.5} edgeAngle={8} alert={crack > 0.5} />
      {[1, -1].map((s) => (
        <group key={s} position={[0, s * 1.62, 0]}>
          <WireMesh geometry={g.cap} fill={0.14} edge={1.8} edgeAngle={20} />
        </group>
      ))}
      {[0, 1, 2].map((k) => (
        <mesh key={k} geometry={g.post} position={[Math.cos((k / 3) * Math.PI * 2) * 0.98, 0, Math.sin((k / 3) * Math.PI * 2) * 0.98]}>
          <meshBasicMaterial color={glow(WIRE.cyan, 1.6)} toneMapped={false} />
        </mesh>
      ))}
      {/* areia: cone de cima encolhendo, monte de baixo crescendo */}
      {p < 0.999 ? (
        <group position={[0, 0.72, 0]} rotation={[Math.PI, 0, 0]} scale={[1 - p * 0.5, Math.max(0.001, 1 - p), 1 - p * 0.5]}>
          <WireMesh geometry={g.sand} alert fill={0.3} edge={2} edgeAngle={20} />
          <Core geometry={g.sand} intensity={0.6} />
        </group>
      ) : null}
      {p > 0.001 ? (
        <group position={[0, -1.45 + 0.55 * p, 0]} scale={[0.6 + 0.4 * p, Math.max(0.001, p), 0.6 + 0.4 * p]}>
          <WireMesh geometry={g.sand} alert fill={0.3} edge={2} edgeAngle={20} />
          <Core geometry={g.sand} intensity={0.6} />
        </group>
      ) : null}
      {p > 0 && p < 1 ? (
        <mesh position={[0, -0.7 + 0.28 * p, 0]}>
          <cylinderGeometry args={[0.025, 0.025, 1.4 - 0.55 * p, 6]} />
          <meshBasicMaterial color={glow(WIRE.alert, 2.4)} toneMapped={false} />
        </mesh>
      ) : null}
    </group>
  );
};

// ---------------------------------------------------------------- parado, com o tempo passando

// X Bot parado no centro; anéis de tempo girando cada vez mais rápido em volta dele e
// folhas de calendário passando voando (o mundo correndo, ele no mesmo lugar).
export const StillFigure: React.FC<{ readonly speed?: number; readonly seed: string; readonly sad?: boolean }> = ({ speed = 1, seed, sad = false }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const g = useMemo(
    () => ({
      ring: new THREE.TorusGeometry(1, 0.018, 6, 96),
      tick: new THREE.BoxGeometry(0.04, 0.16, 0.04),
      page: new THREE.BoxGeometry(0.62, 0.78, 0.01, 2, 3, 1),
      header: new THREE.BoxGeometry(0.62, 0.16, 0.02),
    }),
    [],
  );
  const rings = [
    { y: FLOOR_Y + 0.5, r: 1.35, tilt: 0.25, v: 1.6, alert: false },
    { y: FLOOR_Y + 1.25, r: 1.6, tilt: -0.3, v: -2.4, alert: true },
    { y: FLOOR_Y + 2.0, r: 1.25, tilt: 0.18, v: 3.2, alert: false },
  ];
  const span = 13;
  return (
    <group>
      <group position={[0, FLOOR_Y, 0]} scale={1.15} rotation={[0, 0.35, 0]}>
        <Bot clip={sad ? "sad_pose" : "idle"} speed={1} />
      </group>
      {rings.map((r, i) => {
        // gira acelerando: o tempo correndo cada vez mais rápido
        const ang = r.v * speed * (t + 0.25 * t * t);
        return (
          <group key={i} position={[0, r.y, 0]} rotation={[Math.PI / 2 + r.tilt, 0, ang]}>
            <mesh geometry={g.ring} scale={r.r}>
              <meshBasicMaterial color={glow(r.alert ? WIRE.alert : WIRE.cyan, 2.1)} toneMapped={false} transparent opacity={0.9} />
            </mesh>
            {Array.from({ length: 12 }, (_, k) => {
              const a = (k / 12) * Math.PI * 2;
              return (
                <mesh key={k} geometry={g.tick} position={[Math.cos(a) * r.r, Math.sin(a) * r.r, 0]} rotation={[0, 0, a]}>
                  <meshBasicMaterial color={glow(WIRE.white, 1.8)} toneMapped={false} />
                </mesh>
              );
            })}
          </group>
        );
      })}
      {Array.from({ length: 14 }, (_, i) => {
        const z = (random(`${seed}-pz${i}`) > 0.5 ? 1 : -1) * (1.1 + random(`${seed}-pd${i}`) * 1.8);
        const y = FLOOR_Y + 0.4 + random(`${seed}-py${i}`) * 2.2;
        const v = (5 + random(`${seed}-pv${i}`) * 4) * speed;
        const x = span / 2 - ((t * v + random(`${seed}-px${i}`) * span) % span);
        const spin = t * (3 + random(`${seed}-ps${i}`) * 4);
        return (
          <group key={i} position={[x, y, z]} rotation={[spin * 0.3, spin, spin * 0.2]}>
            <WireMesh geometry={g.page} fill={0.16} edge={1.6} edgeAngle={1} />
            <mesh geometry={g.header} position={[0, 0.39, 0]}>
              <meshBasicMaterial color={glow(i % 4 === 0 ? WIRE.alert : WIRE.cyan, 1.8)} toneMapped={false} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
};

// ---------------------------------------------------------------- celular

export const PHONE = { w: 2.0, h: 4.0 };

// Celular holográfico: feed rolando sem parar (cada rolagem estala pro próximo vídeo) e
// anéis magenta saindo dele (o tempo indo embora).
export const Phone3D: React.FC<{ readonly speed?: number; readonly rings?: boolean; readonly at: number }> = ({ speed = 2.2, rings = true, at }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = Math.max(0, frame / fps - at);
  const g = useMemo(
    () => ({
      body: new THREE.BoxGeometry(PHONE.w, PHONE.h, 0.16, 6, 12, 1),
      card: new THREE.PlaneGeometry(1.66, 1.05, 4, 3),
      dot: new THREE.CircleGeometry(0.08, 12),
      ring: new THREE.TorusGeometry(1, 0.02, 6, 96),
    }),
    [],
  );
  const cardEdges = useMemo(() => new THREE.EdgesGeometry(g.card), [g]);
  const n = t * speed;
  const idx = Math.floor(n);
  const frac = Easing.out(Easing.exp)(Math.min(1, (n - idx) / 0.55));
  const step = 1.2;
  const pos = (idx + frac) * step;
  const half = PHONE.h / 2 - 0.25;
  return (
    <group rotation={[-0.08, Math.sin(frame / fps * 0.6) * 0.32, 0.04]}>
      <WireMesh geometry={g.body} fill={0.07} edge={1.9} edgeAngle={1} />
      {Array.from({ length: 6 }, (_, k) => {
        const i = idx - 2 + k;
        const y = pos - i * step;
        // fora da tela do aparelho: some
        const vis = Math.max(0, 1 - Math.max(0, Math.abs(y) - (half - 0.6)) / 0.6);
        if (vis <= 0.01) {
          return null;
        }
        const alert = random(`ph-${i}`) > 0.6;
        return (
          <group key={i} position={[0, y, 0.1]}>
            <lineSegments geometry={cardEdges}>
              <lineBasicMaterial color={glow(alert ? WIRE.alert : WIRE.cyan, 2)} toneMapped={false} transparent opacity={vis} />
            </lineSegments>
            <mesh geometry={g.card}>
              <meshBasicMaterial color={glow(alert ? WIRE.alert : WIRE.cyan, 1)} toneMapped={false} transparent opacity={0.1 * vis} depthWrite={false} />
            </mesh>
            {[0.3, 0, -0.3].map((dy) => (
              <mesh key={dy} geometry={g.dot} position={[0.62, dy, 0.01]}>
                <meshBasicMaterial color={glow(WIRE.white, 2)} toneMapped={false} transparent opacity={vis} />
              </mesh>
            ))}
          </group>
        );
      })}
      {rings
        ? [0, 1, 2].map((k) => {
            const ph = (t * 0.8 + k / 3) % 1;
            const r = 1.6 + ph * 1.1;
            return (
              <mesh key={k} geometry={g.ring} scale={[r * 0.75, r * 1.25, r]}>
                <meshBasicMaterial color={glow(WIRE.alert, 2.2)} toneMapped={false} transparent opacity={(1 - ph) * 0.9} depthWrite={false} />
              </mesh>
            );
          })
        : null}
    </group>
  );
};

// ---------------------------------------------------------------- duas trilhas

export type Lane3D = { label: string; rise: number };

export const PATHS = { length: 5.2, gap: 2.4, height: 2.6 };

// Ponto de cada trilha (u de 0 a 1): reta no chão ou subindo.
export const pathPoint = (lane: Lane3D, i: number, n: number, u: number): [number, number, number] => {
  const x = -PATHS.length / 2 + u * PATHS.length;
  const z = (i - (n - 1) / 2) * PATHS.gap;
  return [x, FLOOR_Y + 0.15 + lane.rise * u ** 1.7 * PATHS.height, z];
};

export const pathProgress = (frame: number, fps: number, at: number, i: number, duration: number) =>
  interpolate(frame, [(at + i * 0.15) * fps, (at + i * 0.15 + duration) * fps], [0, 1], { ...clampOpts, easing: Easing.inOut(Easing.cubic) });

export const Paths3D: React.FC<{ readonly lanes: Lane3D[]; readonly at: number; readonly duration?: number }> = ({ lanes, at, duration = 2.2 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <group>
      {lanes.map((lane, i) => {
        const p = pathProgress(frame, fps, at, i, duration);
        const up = lane.rise > 0;
        const curve = new THREE.CatmullRomCurve3(Array.from({ length: 12 }, (_, k) => new THREE.Vector3(...pathPoint(lane, i, lanes.length, (k / 11) * Math.max(0.02, p)))));
        const tube = new THREE.TubeGeometry(curve, 48, up ? 0.07 : 0.05, 8, false);
        const head = pathPoint(lane, i, lanes.length, p);
        const c = up ? WIRE.cyan : WIRE.white;
        return (
          <group key={i}>
            {/* trilho inteiro apagado + o trecho já percorrido aceso */}
            <mesh position={[0, FLOOR_Y + 0.02, pathPoint(lane, i, lanes.length, 0)[2]]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[PATHS.length + 0.6, 0.9]} />
              <meshBasicMaterial color={glow(WIRE.cyanDim, 1.2)} toneMapped={false} transparent opacity={0.25} depthWrite={false} />
            </mesh>
            <mesh geometry={tube}>
              <meshBasicMaterial color={glow(c, up ? 2.4 : 1.2)} toneMapped={false} />
            </mesh>
            <mesh position={head}>
              <sphereGeometry args={[up ? 0.2 : 0.16, 16, 12]} />
              <meshBasicMaterial color={glow(up ? WIRE.cyan : WIRE.white, 2.6)} toneMapped={false} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
};

// ---------------------------------------------------------------- blocos

export const BLOCK = { w: 2.4, h: 0.62, d: 1.2, gap: 0.08 };

export const blockY = (i: number) => FLOOR_Y + BLOCK.h / 2 + i * (BLOCK.h + BLOCK.gap);

// Blocos caindo e empilhando (construir alguma coisa); o último acende.
export const Blocks3D: React.FC<{ readonly count: number; readonly at: number; readonly every?: number }> = ({ count, at, every = 0.35 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const geo = useMemo(() => new THREE.BoxGeometry(BLOCK.w, BLOCK.h, BLOCK.d, 4, 1, 2), []);
  return (
    <group>
      {Array.from({ length: count }, (_, i) => {
        const start = Math.round((at + i * every) * fps);
        if (frame < start) {
          return null;
        }
        const s = spring({ frame: frame - start, fps, config: { damping: 10, stiffness: 170 } });
        const last = i === count - 1;
        const off = (i % 2 ? 1 : -1) * 0.18;
        return (
          <group key={i} position={[off, blockY(i) + (1 - s) * 4, 0]} rotation={[0, (1 - s) * 0.8 + i * 0.06, 0]}>
            <WireMesh geometry={geo} fill={last ? 0.3 : 0.14} edge={last ? 2.4 : 1.8} edgeAngle={1} />
            {last ? <Core geometry={geo} intensity={0.5} color={WIRE.cyan} /> : null}
          </group>
        );
      })}
    </group>
  );
};

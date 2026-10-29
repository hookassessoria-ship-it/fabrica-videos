import React, { useMemo } from "react";
import { interpolate, random, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { FLOOR_Y } from "./charts";
import { glow, WIRE } from "./theme";
import { Pedestal, WireMesh } from "./Wire";

// Objetos do Polifemo (rikuai-006), em malha: olho único do ciclope (apaga), pedra que fecha a
// caverna, taça de vinho e o tridente de Poseidon. Um por shot, no palco "myth".

export type MythProp = "eye" | "rock" | "cup" | "trident";

export const MYTH_BOX = new THREE.Box3(new THREE.Vector3(-1.9, FLOOR_Y - 0.1, -1.6), new THREE.Vector3(1.9, FLOOR_Y + 3.3, 1.6));

// Olho do ciclope: globo em malha, íris e pupila de luz; "offAt" fecha a pálpebra e apaga.
const CyclopsEye: React.FC<{ readonly offAt?: number }> = ({ offAt }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const g = useMemo(() => ({ ball: new THREE.SphereGeometry(1.05, 24, 16), iris: new THREE.TorusGeometry(0.42, 0.06, 8, 40), pupil: new THREE.CircleGeometry(0.24, 32), lid: new THREE.SphereGeometry(1.1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2) }), []);
  const off = offAt === undefined ? 0 : interpolate(t, [offAt, offAt + 0.45], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const look = Math.sin(t * 1.4) * 0.25;
  const lit = 1 - off;
  return (
    <group position={[0, FLOOR_Y + 1.75, 0]} rotation={[0, look, 0]}>
      <WireMesh geometry={g.ball} fill={0.12} edge={1.4} edgeAngle={8} alert={off > 0.5} />
      <group position={[0, 0, 1.03]}>
        <mesh geometry={g.iris}>
          <meshBasicMaterial color={glow(off > 0 ? WIRE.alert : WIRE.cyan, 3 * lit + 0.3)} toneMapped={false} transparent opacity={0.3 + 0.7 * lit} />
        </mesh>
        <mesh geometry={g.pupil} position={[0, 0, 0.01]}>
          <meshBasicMaterial color={glow("#FFFFFF", 3 * lit)} toneMapped={false} transparent opacity={lit} />
        </mesh>
      </group>
      {/* pálpebra: meia esfera de cima que gira 90° pra frente e cobre o olho */}
      {off > 0 ? (
        <group rotation={[(Math.PI / 2) * off, 0, 0]}>
          <WireMesh geometry={g.lid} fill={0.25} edge={1.8} edgeAngle={8} alert />
        </group>
      ) : null}
    </group>
  );
};

// Pedra: icosaedro amassado (determinístico), rola da direita e para na boca da caverna.
const Boulder: React.FC<{ readonly rollAt?: number }> = ({ rollAt = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const geo = useMemo(() => {
    const g = new THREE.IcosahedronGeometry(1.25, 2);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const v = new THREE.Vector3(p.getX(i), p.getY(i), p.getZ(i));
      const k = 0.82 + 0.3 * random(`rock-${Math.round(v.x * 10)}-${Math.round(v.y * 10)}-${Math.round(v.z * 10)}`);
      v.multiplyScalar(k);
      p.setXYZ(i, v.x, v.y * 0.9, v.z);
    }
    g.computeVertexNormals();
    return g;
  }, []);
  const arch = useMemo(() => new THREE.TorusGeometry(1.55, 0.16, 8, 32, Math.PI), []);
  const p = interpolate(t, [rollAt, rollAt + 1.1], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const ease = 1 - (1 - p) ** 3;
  const x = 2.4 * (1 - ease);
  return (
    <>
      <group position={[0, FLOOR_Y, -0.3]}>
        <WireMesh geometry={arch} fill={0.08} edge={1.4} edgeAngle={8} />
      </group>
      <group position={[x, FLOOR_Y + 1.15, 0]} rotation={[0, 0, x * 1.2]}>
        <WireMesh geometry={geo} fill={0.16} edge={1.6} edgeAngle={14} alert={p >= 1} />
      </group>
    </>
  );
};

// Taça (torno) com vinho em magenta subindo.
const WineCup: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const g = useMemo(() => {
    const pts = [
      [0.0, 0],
      [0.55, 0],
      [0.55, 0.06],
      [0.1, 0.12],
      [0.08, 0.9],
      [0.25, 1.0],
      [0.7, 1.35],
      [0.82, 1.9],
      [0.78, 1.92],
    ].map(([x, y]) => new THREE.Vector2(x, y));
    return { cup: new THREE.LatheGeometry(pts, 24), wine: new THREE.CylinderGeometry(0.72, 0.45, 0.4, 24, 1) };
  }, []);
  const fill = interpolate(t, [0.1, 1.2], [0.2, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <group position={[0, FLOOR_Y + 0.05, 0]} rotation={[0.08, t * 0.6, 0]} scale={1.2}>
      <WireMesh geometry={g.cup} fill={0.1} edge={1.6} edgeAngle={8} />
      <mesh geometry={g.wine} position={[0, 1.25 + 0.25 * fill, 0]} scale={[0.85 + 0.15 * fill, fill, 0.85 + 0.15 * fill]}>
        <meshBasicMaterial color={glow(WIRE.alert, 1.6)} toneMapped={false} transparent opacity={0.55} />
      </mesh>
    </group>
  );
};

// Tridente de Poseidon: cabo + três pontas, em magenta quando "alert".
const Trident: React.FC<{ readonly alert?: boolean }> = ({ alert = true }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const g = useMemo(() => ({ shaft: new THREE.CylinderGeometry(0.06, 0.06, 3.0, 8, 6), bar: new THREE.CylinderGeometry(0.05, 0.05, 1.1, 8, 3), prong: new THREE.CylinderGeometry(0.045, 0.045, 0.7, 8, 3), tip: new THREE.ConeGeometry(0.12, 0.3, 6) }), []);
  return (
    <group position={[0, FLOOR_Y + 0.2, 0]} rotation={[0, t * 0.7, Math.sin(t * 1.3) * 0.06]}>
      <group position={[0, 1.5, 0]}>
        <WireMesh geometry={g.shaft} fill={0.3} edge={1.6} edgeAngle={8} alert={alert} />
      </group>
      <group position={[0, 2.95, 0]} rotation={[0, 0, Math.PI / 2]}>
        <WireMesh geometry={g.bar} fill={0.3} edge={1.6} edgeAngle={8} alert={alert} />
      </group>
      {[-0.5, 0, 0.5].map((x) => (
        <group key={x} position={[x, 3.3 + (x === 0 ? 0.08 : 0), 0]}>
          <WireMesh geometry={g.prong} fill={0.3} edge={1.6} edgeAngle={8} alert={alert} />
          <mesh geometry={g.tip} position={[0, 0.48, 0]}>
            <meshBasicMaterial color={glow(alert ? WIRE.alert : WIRE.cyan, 2.6)} toneMapped={false} />
          </mesh>
        </group>
      ))}
    </group>
  );
};

export const MythStage: React.FC<{ readonly prop: MythProp; readonly offAt?: number; readonly alert?: boolean }> = ({ prop, offAt, alert = false }) => (
  <>
    {prop === "eye" ? <CyclopsEye offAt={offAt} /> : null}
    {prop === "rock" ? <Boulder rollAt={offAt ?? 0} /> : null}
    {prop === "cup" ? <WineCup /> : null}
    {prop === "trident" ? (
      <group scale={0.85}>
        <Trident alert={alert || true} />
      </group>
    ) : null}
    <Pedestal radius={1.7} alert={alert || prop === "trident"} />
  </>
);

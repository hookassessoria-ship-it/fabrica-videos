import React, { useMemo } from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { FLOOR_Y } from "./charts";
import { Bot } from "./models";
import { glow, WIRE } from "./theme";
import { Pedestal, WireMesh } from "./Wire";

// Objetos do disfarce de Ulisses (rikuai-005): palácio grego em malha, coroa holográfica que
// pode apagar e a figura encapuzada (X Bot com capa e capuz) andando até o palácio.

const PALACE_X = 1.7;
const PALACE_TOP = FLOOR_Y + 2.75;

export const PALACE_BOX = new THREE.Box3(new THREE.Vector3(-3.5, FLOOR_Y - 0.1, -1.6), new THREE.Vector3(3.5, PALACE_TOP + 1.25, 1.6));

const pediment = () => {
  const s = new THREE.Shape();
  s.moveTo(-1.75, 0);
  s.lineTo(1.75, 0);
  s.lineTo(0, 0.6);
  s.lineTo(-1.75, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth: 1.5, bevelEnabled: false });
  g.translate(0, 0, -0.75);
  return g;
};

export const Palace: React.FC<{ readonly alert?: boolean }> = ({ alert = false }) => {
  const g = useMemo(
    () => ({
      steps: [new THREE.BoxGeometry(3.6, 0.14, 1.9, 6, 1, 3), new THREE.BoxGeometry(3.3, 0.14, 1.7, 6, 1, 3), new THREE.BoxGeometry(3.0, 0.14, 1.5, 6, 1, 3)],
      column: new THREE.CylinderGeometry(0.11, 0.13, 1.9, 10, 4),
      beam: new THREE.BoxGeometry(3.3, 0.26, 1.5, 6, 1, 3),
      roof: pediment(),
    }),
    [],
  );
  const xs = [-1.25, -0.75, -0.25, 0.25, 0.75, 1.25];
  return (
    <group position={[PALACE_X, FLOOR_Y, 0]}>
      {g.steps.map((s, i) => (
        <group key={i} position={[0, 0.07 + i * 0.14, 0]}>
          <WireMesh geometry={s} fill={0.1} edge={1.4} edgeAngle={10} alert={alert} />
        </group>
      ))}
      {xs.map((x) =>
        [-0.5, 0.5].map((z) => (
          <group key={`${x}${z}`} position={[x, 0.42 + 0.95, z]}>
            <WireMesh geometry={g.column} fill={0.14} edge={1.6} edgeAngle={10} alert={alert} />
          </group>
        )),
      )}
      <group position={[0, 0.42 + 1.9 + 0.13, 0]}>
        <WireMesh geometry={g.beam} fill={0.14} edge={1.6} edgeAngle={10} alert={alert} />
      </group>
      <group position={[0, 0.42 + 1.9 + 0.26, 0]}>
        <WireMesh geometry={g.roof} fill={0.12} edge={1.8} edgeAngle={10} alert={alert} />
      </group>
    </group>
  );
};

// Coroa: aro + 5 pontas, girando devagar. "off" = apagada (vai de branco a um fio magenta fraco).
export const HoloCrown: React.FC<{ readonly position?: [number, number, number]; readonly offAt?: number; readonly scale?: number }> = ({
  position = [PALACE_X, PALACE_TOP + 0.75, 0],
  offAt,
  scale = 1,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const g = useMemo(() => ({ ring: new THREE.TorusGeometry(0.42, 0.045, 8, 40), tip: new THREE.ConeGeometry(0.08, 0.32, 6), gem: new THREE.OctahedronGeometry(0.07) }), []);
  const off = offAt === undefined ? 0 : interpolate(t, [offAt, offAt + 0.5], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  // Apaga piscando, como lâmpada.
  const flick = off > 0 && off < 1 ? (Math.sin(t * 60) > 0 ? 1 : 0.3) : 1;
  const color = off >= 1 ? glow(WIRE.alert, 0.5) : glow(off > 0 ? WIRE.alert : "#FFF6D8", (2.6 - 1.8 * off) * flick);
  const mat = <meshBasicMaterial color={color} toneMapped={false} transparent opacity={1 - 0.65 * off} />;
  return (
    <group position={position} scale={scale} rotation={[0.25, t * 0.8, 0]}>
      <mesh geometry={g.ring} rotation={[Math.PI / 2, 0, 0]}>
        {mat}
      </mesh>
      {Array.from({ length: 5 }, (_, i) => {
        const a = (i / 5) * Math.PI * 2;
        return (
          <group key={i} position={[Math.cos(a) * 0.42, 0.18, Math.sin(a) * 0.42]}>
            <mesh geometry={g.tip}>{mat}</mesh>
            <mesh geometry={g.gem} position={[0, 0.2, 0]}>
              {mat}
            </mesh>
          </group>
        );
      })}
    </group>
  );
};

// Figura encapuzada: X Bot andando, com capa (cone aberto) e capuz (meia esfera) em malha.
export const HoodedWalker: React.FC<{ readonly from?: number; readonly to?: number; readonly seconds?: number; readonly alert?: boolean }> = ({
  from = -2.8,
  to = -0.6,
  seconds = 3,
  alert = false,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const p = Math.min(1, t / seconds);
  const x = from + (to - from) * p;
  const g = useMemo(
    () => ({
      cloak: new THREE.CylinderGeometry(0.2, 0.62, 1.25, 14, 5, true),
      hood: new THREE.SphereGeometry(0.21, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.62),
      staff: new THREE.CylinderGeometry(0.025, 0.025, 1.85, 6, 4),
    }),
    [],
  );
  const sway = Math.sin(t * 6.2) * 0.04;
  return (
    <group position={[x, FLOOR_Y, 0.2]} rotation={[0, Math.PI / 2, 0]}>
      <Bot clip={p < 1 ? "walk" : "idle"} speed={p < 1 ? 1 : 0.8} opacity={0.12} alert={alert} />
      <group position={[0, 0.78, 0]} rotation={[sway, 0, 0]}>
        <WireMesh geometry={g.cloak} fill={0.18} edge={1.6} edgeAngle={8} alert={alert} />
      </group>
      <group position={[0, 1.58, -0.02]}>
        <WireMesh geometry={g.hood} fill={0.22} edge={1.8} edgeAngle={8} alert={alert} />
      </group>
      <group position={[0.3, 0.93, 0.25]} rotation={[0, 0, -0.06 + sway]}>
        <WireMesh geometry={g.staff} fill={0.3} edge={1.4} edgeAngle={8} alert={alert} />
      </group>
    </group>
  );
};

export const DisguiseStage: React.FC<{ readonly walk?: boolean; readonly crown?: "on" | "off" | "none"; readonly crownOffAt?: number; readonly seconds: number; readonly alert?: boolean }> = ({
  walk = true,
  crown = "on",
  crownOffAt,
  seconds,
  alert = false,
}) => (
  <>
    <Palace alert={alert} />
    <Pedestal radius={2.2} alert={alert} />
    {crown !== "none" ? <HoloCrown offAt={crown === "off" ? (crownOffAt ?? 0.3) : undefined} /> : null}
    <HoodedWalker from={walk ? -3.0 : -1.0} to={walk ? -0.9 : -1.0} seconds={Math.max(1.5, seconds * 0.85)} />
  </>
);

import React, { useMemo } from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { FLOOR_Y } from "./charts";
import { glow, WIRE } from "./theme";
import { Pedestal, WireMesh } from "./Wire";

// Objetos do preço da evolução (rikuai-010), em malha: as seis gemas num anel (acendem uma a
// uma), a balança GANHO × CUSTO (o prato do custo desce) e a ampulheta (a areia escorre).
// Um por shot, no palco "evolution"; "pieceAt" marca o começo da ação.

export type EvoPiece = "gems" | "scale" | "hourglass";

export const EVO_BOX = new THREE.Box3(new THREE.Vector3(-2.1, FLOOR_Y - 0.1, -1.6), new THREE.Vector3(2.1, FLOOR_Y + 3.4, 1.6));

const useT = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return frame / fps;
};

// Seis gemas (octaedros) num anel girando; a partir de "litAt" acendem uma a cada 0,22 s.
const Gems: React.FC<{ readonly litAt?: number; readonly alert?: boolean }> = ({ litAt = 0, alert = false }) => {
  const t = useT();
  const geo = useMemo(() => new THREE.OctahedronGeometry(0.34, 0), []);
  const ring = useMemo(() => new THREE.TorusGeometry(1.35, 0.03, 6, 64), []);
  return (
    <group position={[0, FLOOR_Y + 1.75, 0]} rotation={[0.35, t * 0.5, 0]}>
      <WireMesh geometry={ring} fill={0.05} edge={1.2} edgeAngle={8} alert={alert} />
      {Array.from({ length: 6 }, (_, k) => {
        const a = (k / 6) * Math.PI * 2;
        const lit = interpolate(t, [litAt + k * 0.22, litAt + k * 0.22 + 0.25], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        return (
          <group key={k} position={[Math.cos(a) * 1.35, 0, Math.sin(a) * 1.35]} rotation={[0, -t * 1.2 + k, 0]} scale={[0.85, 1.25, 0.85]}>
            <WireMesh geometry={geo} fill={0.12 + 0.35 * lit} edge={1.4 + lit} edgeAngle={8} alert={alert && lit > 0.5} />
            <mesh geometry={geo} scale={0.45}>
              <meshBasicMaterial color={glow(alert ? WIRE.alert : "#FFFFFF", 0.4 + 2.6 * lit)} toneMapped={false} transparent opacity={0.15 + 0.8 * lit} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
};

// Balança: haste, travessão e dois pratos (esquerda GANHO, direita CUSTO). A partir de "tiltAt"
// o lado do custo desce e acende em magenta.
const Scale: React.FC<{ readonly tiltAt?: number }> = ({ tiltAt = 0.4 }) => {
  const t = useT();
  const g = useMemo(
    () => ({
      post: new THREE.CylinderGeometry(0.07, 0.09, 2.6, 8, 4),
      base: new THREE.CylinderGeometry(0.7, 0.8, 0.14, 24, 1),
      beam: new THREE.BoxGeometry(3.2, 0.08, 0.08, 8, 1, 1),
      pan: new THREE.SphereGeometry(0.55, 20, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
      cord: new THREE.CylinderGeometry(0.012, 0.012, 1.0, 4, 1),
      pivot: new THREE.OctahedronGeometry(0.16, 0),
    }),
    [],
  );
  const p = interpolate(t, [tiltAt, tiltAt + 0.9], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const ease = 1 - (1 - p) ** 3;
  const angle = -0.32 * ease + Math.sin(t * 2.4) * 0.02 * (1 - ease);
  const pan = (side: -1 | 1) => {
    const x = side * 1.5;
    const alert = side === 1 && p > 0.4;
    return (
      <group position={[x * Math.cos(angle), x * Math.sin(angle), 0]}>
        {[-0.35, 0.35].map((dx) => (
          <group key={dx} position={[dx * 0.8, -0.5, 0]} rotation={[0, 0, dx * 0.6]}>
            <WireMesh geometry={g.cord} fill={0} edge={1.2} edgeAngle={8} alert={alert} />
          </group>
        ))}
        <group position={[0, -0.95, 0]} rotation={[Math.PI, 0, 0]}>
          <WireMesh geometry={g.pan} fill={0.12} edge={1.5} edgeAngle={8} alert={alert} />
        </group>
      </group>
    );
  };
  return (
    <group position={[0, FLOOR_Y + 0.07, 0]} rotation={[0, Math.sin(t * 0.5) * 0.25, 0]}>
      <WireMesh geometry={g.base} fill={0.1} edge={1.4} edgeAngle={8} />
      <group position={[0, 1.3, 0]}>
        <WireMesh geometry={g.post} fill={0.15} edge={1.4} edgeAngle={8} />
      </group>
      <group position={[0, 2.6, 0]}>
        <mesh geometry={g.pivot}>
          <meshBasicMaterial color={glow(WIRE.cyan, 2.5)} toneMapped={false} />
        </mesh>
        <group rotation={[0, 0, angle]}>
          <WireMesh geometry={g.beam} fill={0.2} edge={1.6} edgeAngle={8} />
        </group>
        {pan(-1)}
        {pan(1)}
      </group>
    </group>
  );
};

// Ampulheta: dois cones de vidro em malha; a areia (magenta quando "alert") passa de cima
// pra baixo a partir de "flowAt", com um filete caindo no meio.
const Hourglass: React.FC<{ readonly flowAt?: number; readonly alert?: boolean }> = ({ flowAt = 0, alert = false }) => {
  const t = useT();
  const g = useMemo(() => {
    const pts = [
      [0.0, -1.3],
      [0.85, -1.3],
      [0.9, -1.15],
      [0.8, -0.6],
      [0.12, -0.05],
      [0.12, 0.05],
      [0.8, 0.6],
      [0.9, 1.15],
      [0.85, 1.3],
      [0.0, 1.3],
    ].map(([x, y]) => new THREE.Vector2(x, y));
    return {
      glass: new THREE.LatheGeometry(pts, 20),
      cap: new THREE.CylinderGeometry(1.05, 1.05, 0.12, 24, 1),
      top: new THREE.ConeGeometry(0.7, 0.9, 20, 1),
      bottom: new THREE.ConeGeometry(0.75, 0.7, 20, 1),
      stream: new THREE.CylinderGeometry(0.025, 0.025, 1.15, 6, 1),
    };
  }, []);
  const f = interpolate(t, [flowAt, flowAt + 3.2], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const sand = glow(alert ? WIRE.alert : "#FFFFFF", 1.4);
  return (
    <group position={[0, FLOOR_Y + 1.62, 0]} rotation={[0, t * 0.4, 0]}>
      <WireMesh geometry={g.glass} fill={0.06} edge={1.4} edgeAngle={8} />
      {[-1.36, 1.36].map((y) => (
        <group key={y} position={[0, y, 0]}>
          <WireMesh geometry={g.cap} fill={0.18} edge={1.5} edgeAngle={8} alert={alert} />
        </group>
      ))}
      {/* areia de cima (cone de ponta pra baixo) encolhendo */}
      <mesh geometry={g.top} position={[0, 0.55 - 0.2 * f, 0]} rotation={[Math.PI, 0, 0]} scale={[1 - 0.85 * f, 1 - 0.85 * f, 1 - 0.85 * f]}>
        <meshBasicMaterial color={sand} toneMapped={false} transparent opacity={0.5} />
      </mesh>
      {f > 0 && f < 1 ? (
        <mesh geometry={g.stream} position={[0, -0.6, 0]}>
          <meshBasicMaterial color={sand} toneMapped={false} transparent opacity={0.8} />
        </mesh>
      ) : null}
      {/* monte de baixo crescendo */}
      <mesh geometry={g.bottom} position={[0, -1.24 + 0.35 * (0.15 + 0.85 * f), 0]} scale={[0.15 + 0.85 * f, 0.15 + 0.85 * f, 0.15 + 0.85 * f]}>
        <meshBasicMaterial color={sand} toneMapped={false} transparent opacity={0.5} />
      </mesh>
    </group>
  );
};

export const EvolutionStage: React.FC<{ readonly piece: EvoPiece; readonly at?: number; readonly alert?: boolean }> = ({ piece, at, alert = false }) => (
  <>
    {piece === "gems" ? <Gems litAt={at} alert={alert} /> : null}
    {piece === "scale" ? <Scale tiltAt={at} /> : null}
    {piece === "hourglass" ? <Hourglass flowAt={at} alert={alert} /> : null}
    <Pedestal radius={1.8} alert={alert} />
  </>
);

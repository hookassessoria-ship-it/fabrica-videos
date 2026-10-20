import React, { useMemo } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { glow, WIRE } from "./theme";

// Malha holográfica: triângulos em branco translúcido (aditivo) + bordas em ciano com glow.
// `alert` acende tudo em magenta; `edgeAngle` controla quantas arestas viram "contorno".
export const WireMesh: React.FC<{
  readonly geometry: THREE.BufferGeometry;
  readonly alert?: boolean;
  readonly fill?: number;
  readonly edge?: number;
  readonly edgeAngle?: number;
  readonly wire?: boolean;
  readonly color?: string;
  readonly edgeColor?: string;
}> = ({ geometry, alert = false, fill = 0.14, edge = 1.6, edgeAngle = 25, wire = true, color, edgeColor }) => {
  const edges = useMemo(() => new THREE.EdgesGeometry(geometry, edgeAngle), [geometry, edgeAngle]);
  const fillColor = color ?? (alert ? WIRE.alert : WIRE.white);
  const lineColor = edgeColor ?? (alert ? WIRE.alert : WIRE.cyan);
  return (
    <>
      {wire ? (
        <mesh geometry={geometry}>
          <meshBasicMaterial color={glow(fillColor, 1.1)} wireframe transparent opacity={fill} blending={THREE.AdditiveBlending} toneMapped={false} depthWrite={false} />
        </mesh>
      ) : null}
      <lineSegments geometry={edges}>
        <lineBasicMaterial color={glow(lineColor, edge)} transparent opacity={0.95} toneMapped={false} />
      </lineSegments>
    </>
  );
};

// Núcleo sólido translúcido (o "miolo" que acende em vermelho).
export const Core: React.FC<{ readonly geometry: THREE.BufferGeometry; readonly intensity?: number; readonly color?: string }> = ({ geometry, intensity = 1, color = WIRE.alert }) => (
  <mesh geometry={geometry}>
    <meshBasicMaterial color={glow(color, 1.2 + intensity)} transparent opacity={0.35 * intensity} blending={THREE.AdditiveBlending} toneMapped={false} depthWrite={false} />
  </mesh>
);

// Arcos de luz ciano orbitando um objeto, com ponta de seta: mostram fluxo/movimento.
export const OrbitArcs: React.FC<{
  readonly radius?: number;
  readonly count?: number;
  readonly speed?: number;
  readonly tilt?: number;
  readonly y?: number;
  readonly color?: string;
}> = ({ radius = 2.6, count = 3, speed = 1, tilt = 0.35, y = 0, color = WIRE.cyan }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const arc = Math.PI * 0.55;
  const geo = useMemo(() => new THREE.TorusGeometry(radius, 0.012, 6, 64, arc), [radius, arc]);
  const head = useMemo(() => new THREE.ConeGeometry(0.07, 0.22, 10), []);
  return (
    <group position={[0, y, 0]}>
      {Array.from({ length: count }, (_, i) => {
        const rot = t * speed * (i % 2 ? -0.9 : 1.1) + (i * Math.PI * 2) / count;
        const tl = tilt * (i - (count - 1) / 2);
        return (
          <group key={i} rotation={[Math.PI / 2 + tl, 0, rot]}>
            <mesh geometry={geo}>
              <meshBasicMaterial color={glow(color, 2.2)} toneMapped={false} transparent opacity={0.9} />
            </mesh>
            {/* ponta de seta no fim do arco, tangente ao movimento */}
            <mesh geometry={head} position={[radius * Math.cos(arc), radius * Math.sin(arc), 0]} rotation={[0, 0, arc]}>
              <meshBasicMaterial color={glow(color, 2.4)} toneMapped={false} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
};

// Anel/base holográfica no chão, girando.
export const Pedestal: React.FC<{ readonly radius?: number; readonly y?: number; readonly alert?: boolean }> = ({ radius = 2, y = -2.15, alert = false }) => {
  const frame = useCurrentFrame();
  const c = alert ? WIRE.alert : WIRE.cyan;
  const ring = useMemo(() => new THREE.RingGeometry(radius * 0.92, radius, 72), [radius]);
  const dash = useMemo(() => new THREE.RingGeometry(radius * 0.7, radius * 0.74, 48, 1, 0, Math.PI * 1.4), [radius]);
  return (
    <group position={[0, y, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <mesh geometry={ring}>
        <meshBasicMaterial color={glow(c, 1.6)} toneMapped={false} transparent opacity={0.8} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={dash} rotation={[0, 0, frame * 0.03]}>
        <meshBasicMaterial color={glow(c, 1.3)} toneMapped={false} transparent opacity={0.6} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
};

// Feixe de luz vertical (projetor do holograma).
export const Beam: React.FC<{ readonly radius?: number; readonly height?: number; readonly y?: number }> = ({ radius = 1.6, height = 4.5, y = -2.2 }) => {
  const geo = useMemo(() => new THREE.CylinderGeometry(radius * 0.6, radius, height, 48, 1, true), [radius, height]);
  return (
    <mesh geometry={geo} position={[0, y + height / 2, 0]}>
      <meshBasicMaterial color={glow(WIRE.cyan, 0.5)} transparent opacity={0.06} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} toneMapped={false} depthWrite={false} />
    </mesh>
  );
};

import React, { useMemo } from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { FLOOR_Y } from "./charts";
import { roundedRect } from "./odyssey";
import { glow, WIRE } from "./theme";
import { Core, Pedestal, WireMesh } from "./Wire";

// Palco "furniture" (rikuai-009): móveis de malha (sofá, mesa, cadeira, luminária) entrando
// um a um e, em "tagAt", cada um encolhe e vira uma etiqueta de preço magenta balançando.

export type Furniture = "sofa" | "table" | "chair" | "lamp";
const SPACING = 2.7;
export const furnitureX = (i: number, n: number) => (i - (n - 1) / 2) * SPACING;
export const furnitureBox = (n: number) => {
  const half = (n - 1) * (SPACING / 2) + 1.5;
  return new THREE.Box3(new THREE.Vector3(-half, FLOOR_Y - 0.1, -1.3), new THREE.Vector3(half, FLOOR_Y + 3.3, 1.3));
};

const Sofa: React.FC<{ readonly lit: boolean }> = ({ lit }) => {
  const g = useMemo(() => ({ seat: new THREE.BoxGeometry(2.1, 0.45, 0.9, 4, 1, 2), back: new THREE.BoxGeometry(2.1, 0.7, 0.25, 4, 2, 1), arm: new THREE.BoxGeometry(0.25, 0.6, 0.9, 1, 2, 2) }), []);
  return (
    <group position={[0, FLOOR_Y + 0.45, 0]} scale={0.9}>
      <WireMesh geometry={g.seat} alert={lit} fill={0.18} edge={2} edgeAngle={10} />
      <group position={[0, 0.55, -0.33]}>
        <WireMesh geometry={g.back} alert={lit} fill={0.18} edge={2} edgeAngle={10} />
      </group>
      {[-1.17, 1.17].map((x) => (
        <group key={x} position={[x, 0.2, 0]}>
          <WireMesh geometry={g.arm} alert={lit} fill={0.2} edge={2} edgeAngle={10} />
        </group>
      ))}
    </group>
  );
};

const Table: React.FC<{ readonly lit: boolean }> = ({ lit }) => {
  const g = useMemo(() => ({ top: new THREE.BoxGeometry(1.7, 0.1, 1.0, 3, 1, 2), leg: new THREE.CylinderGeometry(0.05, 0.05, 1.0, 6, 1) }), []);
  return (
    <group position={[0, FLOOR_Y + 1.05, 0]}>
      <WireMesh geometry={g.top} alert={lit} fill={0.22} edge={2.1} edgeAngle={10} />
      {[
        [-0.75, -0.42],
        [0.75, -0.42],
        [-0.75, 0.42],
        [0.75, 0.42],
      ].map(([x, z]) => (
        <group key={`${x}${z}`} position={[x, -0.55, z]}>
          <WireMesh geometry={g.leg} alert={lit} fill={0.3} edge={2} edgeAngle={30} />
        </group>
      ))}
    </group>
  );
};

const Chair: React.FC<{ readonly lit: boolean }> = ({ lit }) => {
  const g = useMemo(() => ({ seat: new THREE.BoxGeometry(0.9, 0.1, 0.9, 2, 1, 2), back: new THREE.BoxGeometry(0.9, 0.9, 0.08, 2, 3, 1), leg: new THREE.CylinderGeometry(0.04, 0.04, 0.75, 6, 1) }), []);
  return (
    <group position={[0, FLOOR_Y + 0.8, 0]}>
      <WireMesh geometry={g.seat} alert={lit} fill={0.22} edge={2} edgeAngle={10} />
      <group position={[0, 0.5, -0.41]}>
        <WireMesh geometry={g.back} alert={lit} fill={0.2} edge={2} edgeAngle={10} />
      </group>
      {[
        [-0.38, -0.38],
        [0.38, -0.38],
        [-0.38, 0.38],
        [0.38, 0.38],
      ].map(([x, z]) => (
        <group key={`${x}${z}`} position={[x, -0.42, z]}>
          <WireMesh geometry={g.leg} alert={lit} fill={0.3} edge={2} edgeAngle={30} />
        </group>
      ))}
    </group>
  );
};

const Lamp: React.FC<{ readonly lit: boolean }> = ({ lit }) => {
  const frame = useCurrentFrame();
  const g = useMemo(() => ({ pole: new THREE.CylinderGeometry(0.04, 0.04, 2.2, 6, 1), base: new THREE.CylinderGeometry(0.4, 0.45, 0.08, 16, 1), shade: new THREE.CylinderGeometry(0.3, 0.6, 0.6, 16, 1, true) }), []);
  return (
    <group position={[0, FLOOR_Y, 0]}>
      <group position={[0, 0.05, 0]}>
        <WireMesh geometry={g.base} alert={lit} fill={0.25} edge={2} edgeAngle={20} />
      </group>
      <group position={[0, 1.15, 0]}>
        <WireMesh geometry={g.pole} alert={lit} fill={0.3} edge={2} edgeAngle={30} />
      </group>
      <group position={[0, 2.35, 0]}>
        <WireMesh geometry={g.shade} alert={lit} fill={0.22} edge={2.2} edgeAngle={20} />
        <Core geometry={g.shade} intensity={0.4 + 0.1 * Math.sin(frame / 5)} color={lit ? WIRE.alert : WIRE.cyan} />
      </group>
    </group>
  );
};

// Etiqueta de preço (sem número): cartão com furo e cordinha, magenta.
const PriceTag3D: React.FC = () => {
  const g = useMemo(() => ({ card: roundedRect(1.0, 0.6, 0.1, 0.05), hole: new THREE.TorusGeometry(0.07, 0.02, 6, 16), line: new THREE.BoxGeometry(0.55, 0.05, 0.01) }), []);
  return (
    <group>
      <WireMesh geometry={g.card} alert fill={0.4} edge={2.6} edgeAngle={10} />
      <Core geometry={g.card} intensity={0.7} />
      <mesh geometry={g.hole} position={[-0.36, 0, 0.04]}>
        <meshBasicMaterial color={glow(WIRE.white, 2)} toneMapped={false} />
      </mesh>
      {[0.1, -0.1].map((y) => (
        <mesh key={y} geometry={g.line} position={[0.12, y, 0.04]}>
          <meshBasicMaterial color={glow(WIRE.white, 1.8)} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
};

export const FurnitureStage: React.FC<{ readonly items: Furniture[]; readonly showAt?: number; readonly every?: number; readonly tagAt?: number; readonly alert?: boolean }> = ({
  items,
  showAt = 0,
  every = 0.35,
  tagAt,
  alert = false,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const n = items.length;
  return (
    <group>
      {items.map((it, i) => {
        const x = furnitureX(i, n);
        const inS = spring({ frame: frame - Math.round((showAt + i * every) * fps), fps, config: { damping: 12, stiffness: 180 } });
        const tagT = tagAt === undefined ? 0 : interpolate(t, [tagAt + i * 0.15, tagAt + i * 0.15 + 0.45], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        const obj = Math.max(0, inS) * (1 - tagT);
        const tag = tagT;
        return (
          <React.Fragment key={`${it}-${i}`}>
            <group position={[x, 0, 0]} rotation={[0, Math.sin(t * 0.6 + i) * 0.35, 0]}>
              {obj > 0.01 ? (
                <group scale={obj} position={[0, FLOOR_Y * (1 - obj), 0]}>
                  {it === "sofa" ? <Sofa lit={alert} /> : it === "table" ? <Table lit={alert} /> : it === "chair" ? <Chair lit={alert} /> : <Lamp lit={alert} />}
                </group>
              ) : null}
              {tag > 0.01 ? (
                <group position={[0, 0.4 + Math.sin(t * 2 + i) * 0.08, 0]} rotation={[0, 0, Math.sin(t * 2.4 + i) * 0.25]} scale={tag * 1.3}>
                  <PriceTag3D />
                </group>
              ) : null}
            </group>
            <group position={[x, 0, 0]}>
              <Pedestal radius={1.05} y={FLOOR_Y + 0.04} alert={alert || tag > 0.5} />
            </group>
          </React.Fragment>
        );
      })}
    </group>
  );
};

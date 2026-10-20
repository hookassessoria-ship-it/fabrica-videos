import React, { useMemo } from "react";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { FLOOR_Y } from "./charts";
import { glow, WIRE } from "./theme";
import { Core, WireMesh } from "./Wire";

// "Quem empurra esse elevador?": casa de máquinas no topo do poço, motor girando, cabos
// descendo até a cabine e etiquetas holográficas presas nos cabos (energia, combustível,
// transporte, dólar... e imposto, maior e em magenta).

export type CableTag = { text: string; at: number; alert?: boolean; big?: boolean };

const TOP = 3.3;
const BOTTOM = FLOOR_Y + 0.3;

// Onde cada etiqueta fica (mundo): alterna esquerda/direita, descendo pelos cabos.
export const tagLayout = (tags: CableTag[]) =>
  tags.map((t, i) => {
    const side = i % 2 === 0 ? -1 : 1;
    const y = TOP - 1.15 - i * 0.95;
    return { ...t, side, anchor: [side * 0.12, y, 0] as [number, number, number], plate: [side * 1.55, y, 0] as [number, number, number] };
  });

export const cablesBox = (tags: CableTag[]) => {
  const n = Math.max(1, tags.length);
  return new THREE.Box3(new THREE.Vector3(-2.75, Math.min(BOTTOM - 0.4, TOP - 1.15 - (n - 1) * 0.95 - 0.5), -0.9), new THREE.Vector3(2.75, TOP + 0.9, 0.9));
};

export const Cables3D: React.FC<{ readonly tags: CableTag[]; readonly pull?: number }> = ({ tags, pull = 1 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const g = useMemo(
    () => ({
      frame: new THREE.BoxGeometry(2.2, TOP - BOTTOM + 0.6, 1.4, 2, 8, 1),
      motor: new THREE.CylinderGeometry(0.42, 0.42, 0.5, 14, 1),
      gear: new THREE.TorusGeometry(0.42, 0.05, 6, 18),
      cabin: new THREE.BoxGeometry(0.9, 0.5, 0.8, 2, 2, 2),
      plate: new THREE.BoxGeometry(1, 0.42, 0.04, 2, 1, 1),
    }),
    [],
  );
  const layout = tagLayout(tags);
  // Cada etiqueta que entra dá um "tranco" pra cima na cabine.
  const lift = layout.reduce((acc, l) => acc + (frame >= l.at * fps ? 0.18 * Math.min(1, spring({ frame: frame - l.at * fps, fps, config: { damping: 12 } })) : 0), 0) * pull;
  const cabinY = BOTTOM + 0.25 + lift;
  return (
    <group>
      <group position={[0, (TOP + BOTTOM) / 2, 0]}>
        <WireMesh geometry={g.frame} fill={0.04} edge={1.1} edgeAngle={1} wire={false} />
      </group>
      {/* motor girando no topo */}
      <group position={[0, TOP + 0.35, 0]} rotation={[Math.PI / 2, 0, t * 2.4]}>
        <WireMesh geometry={g.motor} fill={0.2} edge={2} edgeAngle={20} />
        <WireMesh geometry={g.gear} fill={0.3} edge={2.2} edgeAngle={40} />
      </group>
      {/* cabos */}
      {[-0.12, 0, 0.12].map((x, i) => (
        <mesh key={i} position={[x, (TOP + cabinY + 0.25) / 2, 0]}>
          <cylinderGeometry args={[0.014, 0.014, TOP - cabinY - 0.25, 4]} />
          <meshBasicMaterial color={glow(WIRE.cyan, 2.2)} toneMapped={false} />
        </mesh>
      ))}
      {/* cabine (puxada pelos cabos) */}
      <group position={[0, cabinY, 0]}>
        <WireMesh geometry={g.cabin} alert fill={0.25} edge={2.2} edgeAngle={1} />
        <Core geometry={g.cabin} intensity={0.4} />
      </group>
      {/* etiquetas */}
      {layout.map((l, i) => {
        const s = frame < l.at * fps ? 0 : spring({ frame: frame - l.at * fps, fps, config: { damping: 9, stiffness: 170 } });
        if (s <= 0.01) {
          return null;
        }
        const c = l.alert ? WIRE.alert : WIRE.cyan;
        const k = l.big ? 1.45 : 1;
        return (
          <group key={i}>
            <mesh position={[(l.anchor[0] + l.plate[0]) / 2, l.anchor[1], 0]}>
              <boxGeometry args={[Math.abs(l.plate[0] - l.anchor[0]) * s, 0.02, 0.02]} />
              <meshBasicMaterial color={glow(c, 2)} toneMapped={false} />
            </mesh>
            <group position={l.plate} scale={[k * s, k * s, 1]} rotation={[0, 0, Math.sin(t * 2 + i) * 0.05]}>
              <WireMesh geometry={g.plate} alert={l.alert} fill={l.alert ? 0.3 : 0.15} edge={2.2} edgeAngle={1} />
              {l.alert ? <Core geometry={g.plate} intensity={0.6} /> : null}
            </group>
          </group>
        );
      })}
    </group>
  );
};

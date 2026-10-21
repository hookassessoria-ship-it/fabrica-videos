import React, { useMemo } from "react";
import { random, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { glow, WIRE } from "./theme";

// Sala holográfica: chão de grade em perspectiva (some na névoa, parece infinito), paredes
// de hexágonos em linha fina ciano e partículas flutuando.

export const Floor: React.FC<{ readonly y?: number; readonly scroll?: number }> = ({ y = -2.2, scroll = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  // A grade desliza devagar (sensação de movimento mesmo com a câmera quase parada).
  const z = ((frame / fps) * (0.4 + scroll)) % 2;
  return (
    <group position={[0, y, z]}>
      <gridHelper args={[160, 80, glow(WIRE.cyan, 0.9), glow(WIRE.cyanDim, 0.9)]} />
    </group>
  );
};

// Grade de hexágonos (pointy-top) como segmentos de linha.
const hexGeometry = (cols: number, rows: number, size: number) => {
  const pts: number[] = [];
  const w = Math.sqrt(3) * size;
  const h = 1.5 * size;
  for (let r = 0; r < rows; r++) {
    for (let q = 0; q < cols; q++) {
      const cx = q * w + (r % 2) * (w / 2) - (cols * w) / 2;
      const cy = r * h;
      for (let k = 0; k < 6; k++) {
        const a0 = (Math.PI / 3) * k + Math.PI / 6;
        const a1 = (Math.PI / 3) * (k + 1) + Math.PI / 6;
        pts.push(cx + size * Math.cos(a0), cy + size * Math.sin(a0), 0, cx + size * Math.cos(a1), cy + size * Math.sin(a1), 0);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
  return g;
};

export const HexWalls: React.FC<{ readonly y?: number; readonly depth?: number; readonly opacity?: number }> = ({ y = -2.2, depth = 14, opacity = 0.32 }) => {
  const frame = useCurrentFrame();
  const geo = useMemo(() => hexGeometry(26, 16, 0.9), []);
  // Uma faixa de luz sobe pelas paredes.
  const pulse = 0.75 + 0.25 * Math.sin(frame / 9);
  const mat = useMemo(
    () => new THREE.LineBasicMaterial({ color: glow(WIRE.cyan, 0.8), transparent: true, opacity, toneMapped: false, fog: true }),
    [opacity],
  );
  mat.opacity = opacity * pulse;
  return (
    <group position={[0, y, 0]}>
      <lineSegments geometry={geo} material={mat} position={[0, 0, -depth]} />
      <lineSegments geometry={geo} material={mat} position={[-depth, 0, 0]} rotation={[0, Math.PI / 2, 0]} />
      <lineSegments geometry={geo} material={mat} position={[depth, 0, 0]} rotation={[0, -Math.PI / 2, 0]} />
    </group>
  );
};

// Partículas: pontos ciano/brancos subindo devagar, cada um com seu ritmo.
export const Particles: React.FC<{ readonly count?: number; readonly spread?: number; readonly seed?: string }> = ({ count = 420, spread = 16, seed = "p" }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const base = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        x: (random(`${seed}-x${i}`) - 0.5) * spread,
        y: (random(`${seed}-y${i}`) - 0.5) * spread * 0.8,
        z: (random(`${seed}-z${i}`) - 0.5) * spread,
        v: 0.08 + random(`${seed}-v${i}`) * 0.25,
        ph: random(`${seed}-p${i}`) * Math.PI * 2,
        white: random(`${seed}-c${i}`) > 0.7,
      })),
    [count, spread, seed],
  );
  const [cyanGeo, whiteGeo] = useMemo(() => [new THREE.BufferGeometry(), new THREE.BufferGeometry()], []);
  const pos = (white: boolean) => {
    const arr: number[] = [];
    for (const p of base) {
      if (p.white !== white) {
        continue;
      }
      const h = spread * 0.8;
      const y = ((((p.y + t * p.v + h / 2) % h) + h) % h) - h / 2;
      arr.push(p.x + Math.sin(t * 0.5 + p.ph) * 0.15, y, p.z + Math.cos(t * 0.4 + p.ph) * 0.15);
    }
    return new THREE.Float32BufferAttribute(arr, 3);
  };
  cyanGeo.setAttribute("position", pos(false));
  whiteGeo.setAttribute("position", pos(true));
  return (
    <>
      <points geometry={cyanGeo}>
        <pointsMaterial color={glow(WIRE.cyan, 1.6)} size={0.05} sizeAttenuation transparent opacity={0.85} toneMapped={false} depthWrite={false} />
      </points>
      <points geometry={whiteGeo}>
        <pointsMaterial color={glow(WIRE.white, 1.8)} size={0.035} sizeAttenuation transparent opacity={0.9} toneMapped={false} depthWrite={false} />
      </points>
    </>
  );
};

// Névoa medida a partir da distância da câmera ao objeto (câmera afastada não apaga o objeto).
// `floor: false`: sem a grade (o palco traz o próprio chão, ex.: o mar).
export const Room: React.FC<{ readonly walls?: boolean; readonly seed: string; readonly floorY?: number; readonly camDist?: number; readonly floor?: boolean }> = ({
  walls = false,
  seed,
  floorY = -2.2,
  camDist = 12,
  floor = true,
}) => (
  <>
    <fog attach="fog" args={[WIRE.bg0, Math.max(8, camDist - 4), Math.max(34, camDist + 22)]} />
    {floor ? <Floor y={floorY} /> : null}
    {walls ? <HexWalls y={floorY} /> : null}
    <Particles seed={seed} />
  </>
);

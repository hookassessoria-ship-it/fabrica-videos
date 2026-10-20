import React, { useMemo } from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { FLOOR_Y } from "./charts";
import { glow, WIRE } from "./theme";
import { Core, WireMesh } from "./Wire";

// Objetos construídos por código (não existem prontos em CC0): carrinho, etiqueta, termômetro,
// pacote de arroz, caixa de leite, cédula, carteira, núcleo genérico.

// Caixa aberta em cima (sem a face +y), afunilando pra baixo.
const openBasket = (w: number, h: number, d: number, taper: number) => {
  const box = new THREE.BoxGeometry(w, h, d, 12, 6, 7).toNonIndexed();
  const pos = box.attributes.position;
  const keep: number[] = [];
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i += 3) {
    // descarta triângulos da tampa
    let top = true;
    for (let k = 0; k < 3; k++) {
      v.fromBufferAttribute(pos, i + k);
      if (v.y < h / 2 - 1e-4) {
        top = false;
      }
    }
    if (top) {
      continue;
    }
    for (let k = 0; k < 3; k++) {
      v.fromBufferAttribute(pos, i + k);
      const f = 1 - taper * (0.5 - v.y / h);
      keep.push(v.x * f, v.y, v.z * (0.85 + 0.15 * f));
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(keep, 3));
  return g;
};

const cyl = (r: number, h: number, seg = 8) => new THREE.CylinderGeometry(r, r, h, seg);

export const Cart: React.FC<{ readonly alert?: boolean; readonly coreAt?: number; readonly roll?: number }> = ({ alert = false, coreAt, roll = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const g = useMemo(
    () => ({
      basket: openBasket(2.6, 1.4, 1.6, 0.28),
      rail: cyl(0.04, 2.3),
      post: cyl(0.04, 1.0),
      leg: cyl(0.04, 1.3),
      wheel: new THREE.TorusGeometry(0.2, 0.05, 6, 16),
      chassis: new THREE.BoxGeometry(2.1, 0.06, 1.2, 6, 1, 4),
      goods: [new THREE.BoxGeometry(0.55, 0.8, 0.4, 2, 3, 2), new THREE.CylinderGeometry(0.22, 0.22, 0.75, 10, 3), new THREE.BoxGeometry(0.7, 0.5, 0.5, 2, 2, 2), new THREE.BoxGeometry(0.4, 0.95, 0.4, 2, 3, 2)],
    }),
    [],
  );
  // Miolo vermelho: as compras dentro do carrinho acendem a partir de coreAt.
  const core = coreAt === undefined ? (alert ? 1 : 0) : interpolate(frame, [coreAt * fps, coreAt * fps + 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const pulse = core * (0.8 + 0.2 * Math.sin(frame / 4));
  const wheelRot = (frame / fps) * roll * 6;
  return (
    <group position={[0, FLOOR_Y + 0.25, 0]}>
      {/* rodas */}
      {[
        [-0.95, 0, 0.5],
        [0.95, 0, 0.5],
        [-0.95, 0, -0.5],
        [0.95, 0, -0.5],
      ].map((p, i) => (
        <group key={i} position={p as [number, number, number]} rotation={[0, 0, wheelRot]}>
          <WireMesh geometry={g.wheel} fill={0.2} edge={1.8} edgeAngle={40} />
        </group>
      ))}
      <group position={[0, 0.3, 0]}>
        <WireMesh geometry={g.chassis} fill={0.18} edge={1.4} />
      </group>
      {/* pernas */}
      {[
        [-0.9, 0.9, 0.45],
        [0.9, 0.9, 0.45],
        [-0.9, 0.9, -0.45],
        [0.9, 0.9, -0.45],
      ].map((p, i) => (
        <group key={i} position={p as [number, number, number]}>
          <WireMesh geometry={g.leg} fill={0.2} edge={1.5} />
        </group>
      ))}
      {/* cesto */}
      <group position={[0.15, 2.2, 0]}>
        <WireMesh geometry={g.basket} fill={0.2} edge={1.9} edgeAngle={1} />
        {/* compras (miolo) */}
        {g.goods.map((geo, i) => (
          <group key={i} position={[-0.75 + i * 0.5, -0.25 + (i % 2) * 0.08, (i % 2 ? 0.2 : -0.2)]} rotation={[0, i * 0.5, (i - 1.5) * 0.08]}>
            <WireMesh geometry={geo} alert={core > 0.05} fill={0.15 + 0.3 * core} edge={1.2 + 1.4 * pulse} />
            {core > 0 ? <Core geometry={geo} intensity={pulse} /> : null}
          </group>
        ))}
      </group>
      {/* alça */}
      <group position={[-1.55, 3.1, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <WireMesh geometry={g.rail} fill={0.2} edge={2} />
      </group>
      {[0.75, -0.75].map((z, i) => (
        <group key={i} position={[-1.35, 2.8, z]} rotation={[0, 0, -0.6]}>
          <WireMesh geometry={g.post} fill={0.2} edge={1.6} />
        </group>
      ))}
    </group>
  );
};

// Etiqueta de preço holográfica pendurada por um fio, balançando.
export const priceTagAnchor = (x: number, y: number): [number, number, number] => [x, y, 0.2];

export const PriceTag: React.FC<{ readonly x?: number; readonly y?: number; readonly at?: number }> = ({ x = 1.9, y = 1.6, at = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - Math.round(at * fps), fps, config: { damping: 9, stiffness: 160 } });
  const geo = useMemo(() => {
    const sh = new THREE.Shape();
    const w = 1.3;
    const h = 0.8;
    sh.moveTo(-w / 2 + 0.25, h / 2);
    sh.lineTo(w / 2, h / 2);
    sh.lineTo(w / 2, -h / 2);
    sh.lineTo(-w / 2 + 0.25, -h / 2);
    sh.lineTo(-w / 2, 0);
    sh.closePath();
    const hole = new THREE.Path();
    hole.absarc(-w / 2 + 0.28, 0, 0.08, 0, Math.PI * 2, false);
    sh.holes.push(hole);
    return new THREE.ExtrudeGeometry(sh, { depth: 0.06, bevelEnabled: false });
  }, []);
  if (s <= 0.01) {
    return null;
  }
  const swing = Math.sin((frame / fps) * 2.4) * 0.18;
  return (
    <group position={[x, y, 0.2]} rotation={[0, 0.2, swing]} scale={s}>
      <WireMesh geometry={geo} alert fill={0.3} edge={2.4} edgeAngle={20} />
      <Core geometry={geo} intensity={0.6} />
    </group>
  );
};

// Termômetro: tubo + bulbo, o líquido sobe até `value` (0..1).
export const Thermometer: React.FC<{ readonly value: number; readonly at: number; readonly x?: number }> = ({ value, at, x = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const H = 4.2;
  const p = interpolate(frame, [at * fps + 6, at * fps + 6 + 1.0 * fps], [0, value], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const wob = Math.sin((frame - at * fps) / 4) * 0.015;
  const g = useMemo(() => ({ tube: new THREE.CylinderGeometry(0.32, 0.32, H, 18, 8, true), bulb: new THREE.SphereGeometry(0.6, 16, 12) }), []);
  const level = Math.max(0.02, p + wob) * H;
  return (
    <group position={[x, FLOOR_Y + 0.6, 0]}>
      <group position={[0, H / 2 + 0.4, 0]}>
        <WireMesh geometry={g.tube} fill={0.12} edge={1.6} edgeAngle={5} />
      </group>
      <WireMesh geometry={g.bulb} alert fill={0.3} edge={2} />
      <mesh position={[0, 0.4 + level / 2, 0]}>
        <cylinderGeometry args={[0.2, 0.2, level, 12]} />
        <meshBasicMaterial color={glow(WIRE.alert, 2.2)} toneMapped={false} transparent opacity={0.85} />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.45, 16, 12]} />
        <meshBasicMaterial color={glow(WIRE.alert, 2.2)} toneMapped={false} transparent opacity={0.85} />
      </mesh>
      {Array.from({ length: 9 }, (_, i) => (
        <mesh key={i} position={[0.42, 0.6 + (i * H) / 9, 0]}>
          <boxGeometry args={[0.18, 0.02, 0.02]} />
          <meshBasicMaterial color={glow(WIRE.cyan, 1.6)} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
};

// Pacote de arroz (saco com a boca dobrada) e caixa de leite.
export const RiceBag: React.FC<{ readonly alert?: boolean }> = ({ alert = false }) => {
  const geo = useMemo(() => {
    const g = new THREE.BoxGeometry(1.4, 2, 0.6, 6, 8, 3);
    const p = g.attributes.position;
    const v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      const bulge = 1 + 0.18 * Math.cos((v.y / 2) * Math.PI) ;
      p.setXYZ(i, v.x * (1 + 0.06 * Math.cos(v.y * 3)), v.y, v.z * bulge);
    }
    g.computeVertexNormals();
    return g;
  }, []);
  return <WireMesh geometry={geo} alert={alert} fill={0.18} edge={1.8} edgeAngle={12} />;
};

export const MilkCarton: React.FC<{ readonly alert?: boolean }> = ({ alert = false }) => {
  const geo = useMemo(() => {
    const g = new THREE.BoxGeometry(1, 2.2, 1, 3, 8, 3);
    const p = g.attributes.position;
    const v = new THREE.Vector3();
    // telhadinho no topo
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      if (v.y > 0.99) {
        p.setXYZ(i, v.x, v.y + 0.45 * (1 - Math.abs(v.x) * 2), v.z * 0.15);
      }
    }
    g.computeVertexNormals();
    return g;
  }, []);
  return <WireMesh geometry={geo} alert={alert} fill={0.18} edge={1.8} edgeAngle={12} />;
};

export const Banknote: React.FC<{ readonly alert?: boolean }> = ({ alert = false }) => {
  const geo = useMemo(() => new THREE.BoxGeometry(2.2, 1, 0.02, 10, 5, 1), []);
  return <WireMesh geometry={geo} alert={alert} fill={0.22} edge={1.8} edgeAngle={1} />;
};

// Núcleo genérico (quando o shot não tem um objeto próprio).
export const HoloCore: React.FC<{ readonly alert?: boolean }> = ({ alert = false }) => {
  const frame = useCurrentFrame();
  const g = useMemo(() => ({ outer: new THREE.IcosahedronGeometry(1.5, 1), inner: new THREE.OctahedronGeometry(0.7, 0) }), []);
  return (
    <group rotation={[frame * 0.006, frame * 0.012, 0]}>
      <WireMesh geometry={g.outer} alert={alert} fill={0.12} edge={1.8} edgeAngle={1} />
      <group rotation={[0, -frame * 0.03, frame * 0.02]}>
        <WireMesh geometry={g.inner} alert fill={0.3} edge={2.2} edgeAngle={1} />
        <Core geometry={g.inner} intensity={0.7} color={alert ? WIRE.alert : WIRE.cyan} />
      </group>
    </group>
  );
};

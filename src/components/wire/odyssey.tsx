import React, { useMemo } from "react";
import { interpolate, random, spring, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { FLOOR_Y } from "./charts";
import { Bot } from "./models";
import { Banknote } from "./props";
import { glow, WIRE } from "./theme";
import { Core, Pedestal, WireMesh } from "./Wire";

// Objetos da Odisseia (rikuai-003), todos construídos por código: mar em malha com ondas,
// navio grego genérico (casco, mastro, vela, remos), pedras, sereias como silhuetas de luz,
// anéis magenta de "canto", Ulisses (X Bot) amarrado ao mastro com cordas ciano que se
// desenham, e as tentações modernas (cartão, sacola, celular, carteira, ímã).

// ---------------------------------------------------------------- mar

// Altura do mar num ponto (também usada pra o navio balançar junto).
export const seaHeight = (x: number, z: number, t: number) =>
  0.22 * Math.sin(0.5 * x + 1.3 * t) + 0.14 * Math.sin(0.75 * z - 1.1 * t + 1.7) + 0.06 * Math.sin(1.7 * (x + z) + 2.1 * t);

export const Sea: React.FC<{ readonly y?: number; readonly size?: number; readonly alert?: boolean }> = ({ y = FLOOR_Y, size = 70, alert = false }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(size, size, 70, 70);
    g.rotateX(-Math.PI / 2);
    return g;
  }, [size]);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    pos.setY(i, seaHeight(pos.getX(i), pos.getZ(i), t));
  }
  pos.needsUpdate = true;
  return (
    <group position={[0, y, 0]}>
      <mesh geometry={geo}>
        <meshBasicMaterial color={glow(alert ? WIRE.alert : WIRE.cyan, 1.1)} wireframe transparent opacity={0.42} blending={THREE.AdditiveBlending} toneMapped={false} depthWrite={false} />
      </mesh>
    </group>
  );
};

// ---------------------------------------------------------------- navio grego

const smooth = (a: number, b: number, x: number) => {
  const k = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return k * k * (3 - 2 * k);
};

const HULL_L = 5.2;
// Altura da borda (sobe na popa, à esquerda, e um pouco na proa).
const sheer = (s: number) => 0.25 + 0.6 * smooth(0.55, 1, -s) + 0.15 * smooth(0.7, 1, s);
const halfWidth = (s: number) => 0.78 * Math.pow(Math.max(0, 1 - Math.abs(s) ** 2.2), 0.55);

const hullGeometry = () => {
  const nU = 30;
  const nV = 10;
  const pts: number[] = [];
  const idx: number[] = [];
  for (let u = 0; u <= nU; u++) {
    const s = (u / nU) * 2 - 1;
    const x = (s * HULL_L) / 2;
    const w = halfWidth(s);
    const top = sheer(s);
    const depth = 0.6 * Math.pow(Math.max(0, 1 - Math.abs(s) ** 3), 0.5) + 0.02;
    for (let v = 0; v <= nV; v++) {
      const th = (Math.PI * v) / nV;
      pts.push(x, top - (depth + top * 0.4) * Math.sin(th) - 0.1, -w * Math.cos(th));
    }
  }
  for (let u = 0; u < nU; u++) {
    for (let v = 0; v < nV; v++) {
      const a = u * (nV + 1) + v;
      const b = a + nV + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
};

const tube = (points: [number, number, number][], r: number, seg = 40) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p))), seg, r, 6, false);

const OARS = 7;

export const SHIP_BOX = new THREE.Box3(new THREE.Vector3(-3.0, FLOOR_Y - 0.5, -2.0), new THREE.Vector3(3.0, FLOOR_Y + 3.9, 2.0));

export const GreekShip: React.FC<{ readonly alert?: boolean; readonly sail?: boolean; readonly row?: number; readonly locked?: boolean }> = ({ alert = false, sail = true, row = 1, locked = false }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const g = useMemo(
    () => ({
      hull: hullGeometry(),
      stern: tube(
        [
          [-2.55, 0.85, 0],
          [-2.85, 1.35, 0],
          [-2.75, 1.85, 0],
          [-2.4, 2.05, 0],
          [-2.2, 1.85, 0],
        ],
        0.06,
      ),
      prow: tube(
        [
          [2.55, 0.35, 0],
          [2.75, 0.75, 0],
          [2.7, 1.05, 0],
        ],
        0.05,
        16,
      ),
      ram: new THREE.ConeGeometry(0.13, 0.7, 8),
      mast: new THREE.CylinderGeometry(0.06, 0.07, 3.6, 8, 6),
      yard: new THREE.CylinderGeometry(0.04, 0.04, 3.0, 6, 4),
      sail: (() => {
        const p = new THREE.PlaneGeometry(2.7, 1.9, 10, 8);
        const a = p.attributes.position;
        for (let i = 0; i < a.count; i++) {
          const u = a.getX(i) / 1.35;
          const v = a.getY(i) / 0.95;
          a.setZ(i, 0.35 * Math.cos((u * Math.PI) / 2) * Math.cos((v * Math.PI) / 2));
        }
        p.rotateY(Math.PI / 2);
        return p;
      })(),
      oar: new THREE.CylinderGeometry(0.022, 0.03, 2.1, 5, 3),
      blade: new THREE.BoxGeometry(0.06, 0.45, 0.18),
      eye: new THREE.RingGeometry(0.07, 0.12, 16),
      rudder: new THREE.BoxGeometry(0.08, 1.1, 0.3, 1, 3, 1),
    }),
    [],
  );
  const bob = seaHeight(0, 0, t) * 0.9;
  const roll = Math.sin(t * 1.3) * 0.04;
  const pitch = Math.sin(t * 0.9 + 1) * 0.03;
  const billow = 1 + Math.sin(t * 1.6) * 0.12;
  const edge = alert ? WIRE.alert : undefined;
  return (
    <group position={[0, FLOOR_Y + 0.15 + bob, 0]} rotation={[roll, 0, pitch]}>
      <WireMesh geometry={g.hull} alert={alert} fill={0.16} edge={1.8} edgeAngle={14} />
      <WireMesh geometry={g.stern} alert={alert} fill={0.2} edge={1.6} edgeAngle={40} />
      <WireMesh geometry={g.prow} alert={alert} fill={0.2} edge={1.6} edgeAngle={40} />
      {/* esporão na proa, na linha d'água */}
      <group position={[2.85, -0.35, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <WireMesh geometry={g.ram} alert={alert} fill={0.25} edge={2} edgeAngle={10} />
      </group>
      {/* olhos pintados na proa */}
      {[1, -1].map((side) => (
        <mesh key={side} geometry={g.eye} position={[2.2, 0.3, side * 0.33]} rotation={[0, side > 0 ? 0 : Math.PI, 0]}>
          <meshBasicMaterial color={glow(WIRE.cyan, 2.2)} toneMapped={false} side={THREE.DoubleSide} />
        </mesh>
      ))}
      {/* leme na popa (com trava, se "locked") */}
      <group position={[-2.35, -0.05, 0.42]} rotation={[0.2, 0, 0.35]}>
        <WireMesh geometry={g.rudder} alert={alert} fill={0.22} edge={1.8} edgeAngle={10} />
      </group>
      {locked ? (
        <>
          <Padlock position={[-2.3, 1.15, 0.7]} scale={0.6} />
          {/* rumo fixo: linha reta à frente da proa com ponta de seta */}
          <mesh position={[4.6, -0.3, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.03, 0.03, 3.4, 6]} />
            <meshBasicMaterial color={glow(WIRE.cyan, 3)} toneMapped={false} />
          </mesh>
          <mesh position={[6.45, -0.3, 0]} rotation={[0, 0, -Math.PI / 2]}>
            <coneGeometry args={[0.16, 0.45, 10]} />
            <meshBasicMaterial color={glow(WIRE.cyan, 3)} toneMapped={false} />
          </mesh>
        </>
      ) : null}
      {/* mastro, verga e vela quadrada */}
      <group position={[0.25, 1.65, 0]}>
        <WireMesh geometry={g.mast} fill={0.2} edge={1.8} edgeAngle={10} edgeColor={edge} />
      </group>
      <group position={[0.25, 3.25, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <WireMesh geometry={g.yard} fill={0.2} edge={1.8} edgeAngle={10} edgeColor={edge} />
      </group>
      {sail ? (
        <group position={[0.3, 2.25, 0]} scale={[billow, 1, 1]}>
          <WireMesh geometry={g.sail} fill={0.12} edge={1.4} edgeAngle={1} edgeColor={edge} />
        </group>
      ) : null}
      {/* remos dos dois lados, remando */}
      {[1, -1].map((side) =>
        Array.from({ length: OARS }, (_, i) => {
          const x = -1.6 + (i * 3.4) / (OARS - 1);
          const s = (x / HULL_L) * 2;
          const sweep = Math.sin(t * 2.4 * row - i * 0.15) * 0.35 * row;
          const lift = Math.cos(t * 2.4 * row - i * 0.15) * 0.12 * row;
          const a = 0.45 + lift;
          return (
            <group key={`${side}-${i}`} position={[x, sheer(s) - 0.12, side * halfWidth(s)]} rotation={[0, sweep * side, 0]}>
              <group rotation={[side * (Math.PI / 2 + a), 0, 0]}>
                <group position={[0, 1.05, 0]}>
                  <WireMesh geometry={g.oar} fill={0.25} edge={1.5} edgeAngle={30} edgeColor={edge} />
                </group>
                <group position={[0, 2.05, 0]}>
                  <WireMesh geometry={g.blade} fill={0.25} edge={1.5} edgeAngle={10} edgeColor={edge} />
                </group>
              </group>
            </group>
          );
        }),
      )}
    </group>
  );
};

// Cadeado holográfico (rumo travado).
export const Padlock: React.FC<{ readonly position?: [number, number, number]; readonly scale?: number }> = ({ position = [0, 0, 0], scale = 1 }) => {
  const frame = useCurrentFrame();
  const g = useMemo(() => ({ body: new THREE.BoxGeometry(1.2, 1, 0.45, 3, 3, 1), shackle: new THREE.TorusGeometry(0.4, 0.09, 8, 20, Math.PI) }), []);
  const pulse = 0.8 + 0.2 * Math.sin(frame / 5);
  return (
    <group position={position} scale={scale} rotation={[0, frame * 0.02, 0]}>
      <WireMesh geometry={g.body} fill={0.3} edge={2.2 * pulse} edgeAngle={10} />
      <Core geometry={g.body} intensity={0.5} color={WIRE.cyan} />
      <group position={[0, 0.5, 0]}>
        <WireMesh geometry={g.shackle} fill={0.3} edge={2.2} edgeAngle={10} />
      </group>
    </group>
  );
};

// ---------------------------------------------------------------- pedras e sereias

const rockGeometry = (seed: string, r: number) => {
  const g = new THREE.IcosahedronGeometry(r, 1);
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    // mesmo vértice repetido (geometria não indexada) recebe o mesmo deslocamento
    const k = 0.75 + 0.45 * random(`${seed}-${Math.round(v.x * 100)}-${Math.round(v.y * 100)}-${Math.round(v.z * 100)}`);
    p.setXYZ(i, v.x * k, Math.max(v.y * k * 1.25, -r * 0.2), v.z * k);
  }
  g.computeVertexNormals();
  return g;
};

export const Rocks: React.FC<{ readonly x?: number; readonly alert?: boolean; readonly seed?: string }> = ({ x = 0, alert = false, seed = "rk" }) => {
  const rocks = useMemo(
    () =>
      [
        { p: [0, 0, 0], r: 0.9 },
        { p: [0.95, -0.15, 0.55], r: 0.6 },
        { p: [-0.85, -0.2, -0.45], r: 0.65 },
        { p: [0.3, -0.25, -0.9], r: 0.45 },
      ].map((rk, i) => ({ ...rk, g: rockGeometry(`${seed}-${i}`, rk.r) })),
    [seed],
  );
  return (
    <group position={[x, FLOOR_Y + 0.15, 0]}>
      {rocks.map((rk, i) => (
        <group key={i} position={rk.p as [number, number, number]}>
          <WireMesh geometry={rk.g} alert={alert} fill={0.16} edge={1.5} edgeAngle={20} />
        </group>
      ))}
    </group>
  );
};

// Silhueta feminina genérica (torno): cauda/vestido que abre embaixo, cintura, ombros,
// cabeça; cabelo comprido e braços em tubos. Feita de luz, sem rosto.
const sirenGeometry = () => {
  const prof: [number, number][] = [
    [0.001, 0],
    [0.5, 0.04],
    [0.4, 0.3],
    [0.28, 0.65],
    [0.2, 0.95],
    [0.16, 1.12],
    [0.22, 1.3],
    [0.25, 1.44],
    [0.28, 1.52],
    [0.12, 1.6],
    [0.07, 1.66],
    [0.001, 1.68],
  ];
  return new THREE.LatheGeometry(
    prof.map(([r, y]) => new THREE.Vector2(r, y)),
    20,
  );
};

export const Siren: React.FC<{ readonly seed: string; readonly lit?: number }> = ({ seed, lit = 1 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const ph = random(`siren-${seed}`) * Math.PI * 2;
  const g = useMemo(
    () => ({
      body: sirenGeometry(),
      head: new THREE.SphereGeometry(0.16, 12, 10),
      hair: [0, 1, 2].map((k) =>
        tube(
          [
            [0, 1.86, -0.05],
            [(k - 1) * 0.12, 1.8, -0.18],
            [(k - 1) * 0.16, 1.5, -0.22],
            [(k - 1) * 0.2 + 0.05, 1.15, -0.2],
          ],
          0.025,
          20,
        ),
      ),
      arms: [1, -1].map((s) =>
        tube(
          [
            [s * 0.27, 1.5, 0],
            [s * 0.42, 1.3, 0.08],
            [s * 0.5, 1.12, 0.22],
            [s * 0.42, 1.0, 0.32],
          ],
          0.03,
          16,
        ),
      ),
    }),
    [],
  );
  const sway = Math.sin(t * 1.4 + ph) * 0.06;
  return (
    <group rotation={[0, 0, sway]}>
      <WireMesh geometry={g.body} fill={0.12 + 0.12 * lit} edge={1.3 + 0.8 * lit} edgeAngle={8} edgeColor={WIRE.alert} />
      <Core geometry={g.body} intensity={0.35 * lit} />
      <group position={[0, 1.86, 0]}>
        <WireMesh geometry={g.head} fill={0.2} edge={1.6} edgeAngle={30} edgeColor={WIRE.alert} />
      </group>
      {[...g.hair, ...g.arms].map((geo, i) => (
        <WireMesh key={i} geometry={geo} fill={0.25} edge={1.4} edgeAngle={40} edgeColor={WIRE.alert} />
      ))}
    </group>
  );
};

// Anéis de "canto" em magenta: crescem a partir do emissor em três planos e somem.
export const SoundRings: React.FC<{ readonly position?: [number, number, number]; readonly max?: number; readonly at?: number; readonly speed?: number; readonly color?: string }> = ({
  position = [0, 0, 0],
  max = 1.8,
  at = 0,
  speed = 1,
  color = WIRE.alert,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const geo = useMemo(() => new THREE.TorusGeometry(1, 0.018, 6, 64), []);
  const t = (frame - at * fps) / fps;
  if (t < 0) {
    return null;
  }
  const appear = Math.min(1, t * 3);
  const period = 1.2 / speed;
  const rings: React.ReactNode[] = [];
  for (let plane = 0; plane < 3; plane++) {
    for (let k = 0; k < 3; k++) {
      const ph = (((t / period + k / 3 + plane * 0.11) % 1) + 1) % 1;
      const r = 0.25 + ph * (max - 0.25);
      rings.push(
        <mesh key={`${plane}-${k}`} geometry={geo} scale={r} rotation={[0, (plane * Math.PI) / 3 + t * 0.3, 0]}>
          <meshBasicMaterial color={glow(color, 2.4)} toneMapped={false} transparent opacity={appear * (1 - ph) ** 1.3 * 0.9} depthWrite={false} />
        </mesh>,
      );
    }
  }
  return <group position={position}>{rings}</group>;
};

// Sereias nas pedras (2 ou 3), cada uma emitindo anéis.
export const SIRENS_BOX = new THREE.Box3(new THREE.Vector3(-2.7, FLOOR_Y - 0.3, -1.6), new THREE.Vector3(2.7, FLOOR_Y + 3.6, 1.6));

export const SirenRocks: React.FC<{ readonly ringsAt?: number; readonly count?: number; readonly x?: number }> = ({ ringsAt = 0, count = 3, x = 0 }) => {
  const spots: [number, number, number][] = count === 2 ? [[-0.9, 0.55, 0.1], [0.9, 0.35, -0.2]] : [[-1.35, 0.45, 0.2], [0, 0.75, -0.25], [1.35, 0.4, 0.15]];
  return (
    <group position={[x, 0, 0]}>
      <group scale={[1.5, 1, 1.1]}>
        <Rocks seed="siren-rocks" />
      </group>
      {spots.map((p, i) => (
        <group key={i} position={[p[0], FLOOR_Y + p[1], p[2]]} rotation={[0, (i - 1) * 0.4, 0]}>
          <Siren seed={`s${i}`} />
          <SoundRings position={[0, 1.75, 0.1]} max={1.5} at={ringsAt + i * 0.15} />
        </group>
      ))}
    </group>
  );
};

// ---------------------------------------------------------------- mastro com Ulisses

const ROPE_BANDS = [0.55, 0.95, 1.35];
export const ROPE_SECONDS = 0.5;

const ropeGeometry = (y: number) => {
  const pts: THREE.Vector3[] = [];
  const turns = 2.2;
  for (let i = 0; i <= 80; i++) {
    const a = (i / 80) * Math.PI * 2 * turns;
    pts.push(new THREE.Vector3(Math.cos(a) * 0.44, y + (i / 80) * 0.22 - 0.11, Math.sin(a) * 0.36 + 0.05));
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 160, 0.042, 6, false);
};

export const MAST_BOX = new THREE.Box3(new THREE.Vector3(-1.7, FLOOR_Y + 0.1, -1.2), new THREE.Vector3(1.7, FLOOR_Y + 3.45, 1.2));

export const MastTie: React.FC<{ readonly tieAt?: number; readonly ringsAt?: number }> = ({ tieAt, ringsAt }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const deckY = FLOOR_Y + 0.35;
  const g = useMemo(
    () => ({
      mast: new THREE.CylinderGeometry(0.11, 0.13, 3.0, 10, 6),
      yard: new THREE.CylinderGeometry(0.06, 0.06, 3.2, 8, 4),
      deck: new THREE.BoxGeometry(3.4, 0.12, 2.2, 8, 1, 5),
      ropes: ROPE_BANDS.map((y) => ropeGeometry(y)),
      knot: new THREE.SphereGeometry(0.07, 8, 6),
    }),
    [],
  );
  // Cordas: cada faixa se desenha em ROPE_SECONDS, uma depois da outra.
  const ropeP = (i: number) => (tieAt === undefined ? 1 : interpolate(t, [tieAt + i * 0.2, tieAt + i * 0.2 + ROPE_SECONDS], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
  const tied = ropeP(ROPE_BANDS.length - 1) >= 1;
  const strain = tied ? Math.sin(t * 6) * 0.04 : 0;
  g.ropes.forEach((r, i) => {
    const total = r.index ? r.index.count : 0;
    r.setDrawRange(0, Math.floor((total * ropeP(i)) / 6) * 6);
  });
  return (
    <group position={[0, seaHeight(0, 0, t) * 0.5, 0]}>
      <group position={[0, deckY, 0]}>
        <WireMesh geometry={g.deck} fill={0.14} edge={1.4} edgeAngle={10} />
      </group>
      <group position={[0, deckY + 1.5, -0.22]}>
        <WireMesh geometry={g.mast} fill={0.2} edge={1.8} edgeAngle={10} />
      </group>
      <group position={[0, deckY + 2.8, -0.22]} rotation={[0, 0, Math.PI / 2]}>
        <WireMesh geometry={g.yard} fill={0.2} edge={1.8} edgeAngle={10} />
      </group>
      {/* Ulisses: costas no mastro, força pra sair depois de amarrado */}
      <group position={[0, deckY + 0.06, 0.08]} rotation={[0, 0, strain]} scale={1.02}>
        <Bot clip="idle" speed={tied ? 1.6 : 1} opacity={0.16} />
      </group>
      <group position={[0, deckY, 0]}>
        {g.ropes.map((r, i) => (
          <React.Fragment key={i}>
            <mesh geometry={r}>
              <meshBasicMaterial color={glow(WIRE.cyan, 3.2)} toneMapped={false} />
            </mesh>
            {ropeP(i) >= 1 ? (
              <mesh geometry={g.knot} position={[0.3, ROPE_BANDS[i] + 0.1, 0.32]}>
                <meshBasicMaterial color={glow(WIRE.cyan, 3)} toneMapped={false} />
              </mesh>
            ) : null}
          </React.Fragment>
        ))}
      </group>
      {ringsAt !== undefined ? (
        <>
          <SoundRings position={[-1.4, deckY + 1.7, 0.3]} max={1.1} at={ringsAt} />
          <SoundRings position={[1.4, deckY + 1.7, 0.3]} max={1.1} at={ringsAt + 0.2} />
        </>
      ) : null}
    </group>
  );
};

// ---------------------------------------------------------------- tentações modernas

export type Temptation = "card" | "bag" | "phone" | "wallet" | "magnet";

const roundedRect = (w: number, h: number, r: number, depth: number) => {
  const s = new THREE.Shape();
  s.moveTo(-w / 2 + r, -h / 2);
  s.lineTo(w / 2 - r, -h / 2);
  s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
  s.lineTo(w / 2, h / 2 - r);
  s.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
  s.lineTo(-w / 2 + r, h / 2);
  s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
  s.lineTo(-w / 2, -h / 2 + r);
  s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 4 });
  g.translate(0, 0, -depth / 2);
  return g;
};

const Card: React.FC<{ readonly lit: boolean }> = ({ lit }) => {
  const g = useMemo(() => ({ body: roundedRect(3.0, 1.9, 0.2, 0.06), chip: new THREE.BoxGeometry(0.46, 0.36, 0.04, 2, 2, 1), wave: new THREE.TorusGeometry(0.16, 0.012, 4, 16, Math.PI * 0.6) }), []);
  return (
    <group>
      <WireMesh geometry={g.body} alert={lit} fill={0.2} edge={2} edgeAngle={10} />
      <group position={[-0.85, 0.2, 0.05]}>
        <WireMesh geometry={g.chip} fill={0.35} edge={2.2} edgeAngle={10} edgeColor={WIRE.cyan} />
      </group>
      {[1, 1.6, 2.2].map((k, i) => (
        <mesh key={i} geometry={g.wave} position={[0.9, 0.35, 0.05]} scale={k} rotation={[0, 0, -Math.PI * 0.3]}>
          <meshBasicMaterial color={glow(lit ? WIRE.alert : WIRE.cyan, 2)} toneMapped={false} />
        </mesh>
      ))}
      {/* linha dos números (traços, sem dígitos) */}
      {Array.from({ length: 4 }, (_, i) => (
        <mesh key={i} position={[-0.95 + i * 0.62, -0.38, 0.05]}>
          <boxGeometry args={[0.46, 0.06, 0.01]} />
          <meshBasicMaterial color={glow(WIRE.white, 1.6)} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
};

const Bag: React.FC<{ readonly lit: boolean }> = ({ lit }) => {
  const g = useMemo(() => {
    const body = new THREE.BoxGeometry(1.7, 2.0, 0.75, 5, 6, 3);
    const p = body.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i);
      p.setX(i, p.getX(i) * (1 + (0.5 - (y + 1) / 2) * 0.12));
    }
    return { body, handle: new THREE.TorusGeometry(0.42, 0.035, 6, 20, Math.PI) };
  }, []);
  return (
    <group>
      <WireMesh geometry={g.body} alert={lit} fill={0.2} edge={2} edgeAngle={10} />
      {[0.25, -0.25].map((z, i) => (
        <group key={i} position={[0, 1.0, z]}>
          <WireMesh geometry={g.handle} alert={lit} fill={0.3} edge={2} edgeAngle={30} />
        </group>
      ))}
    </group>
  );
};

const Phone: React.FC<{ readonly lit: boolean; readonly notifyAt?: number }> = ({ lit, notifyAt }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const g = useMemo(() => ({ body: roundedRect(1.4, 2.9, 0.22, 0.14), screen: new THREE.PlaneGeometry(1.2, 2.5, 6, 12), note: roundedRect(1.7, 0.36, 0.1, 0.04) }), []);
  return (
    <group>
      <WireMesh geometry={g.body} alert={lit} fill={0.18} edge={2} edgeAngle={10} />
      <mesh geometry={g.screen} position={[0, 0, 0.08]}>
        <meshBasicMaterial color={glow(WIRE.cyan, 0.9)} wireframe transparent opacity={0.35} toneMapped={false} />
      </mesh>
      {/* notificações pipocando em cima do celular, uma a cada 0,3 s */}
      {notifyAt !== undefined
        ? Array.from({ length: 4 }, (_, i) => {
            const s = spring({ frame: frame - Math.round((notifyAt + i * 0.3) * fps), fps, config: { damping: 10, stiffness: 180 } });
            if (s <= 0.01) {
              return null;
            }
            return (
              <group key={i} position={[0.35, 0.95 - i * 0.48, 0.35 + i * 0.02]} scale={s}>
                <WireMesh geometry={g.note} alert fill={0.35} edge={2.4} edgeAngle={10} />
                <Core geometry={g.note} intensity={0.6} />
              </group>
            );
          })
        : null}
    </group>
  );
};

const Wallet: React.FC<{ readonly lit: boolean }> = ({ lit }) => {
  const frame = useCurrentFrame();
  const g = useMemo(() => ({ body: roundedRect(2.0, 1.3, 0.16, 0.34), flap: roundedRect(2.0, 0.55, 0.12, 0.06) }), []);
  return (
    <group>
      <WireMesh geometry={g.body} alert={lit} fill={0.2} edge={2} edgeAngle={10} />
      <group position={[0, 0.3, 0.2]} rotation={[0.25, 0, 0]}>
        <WireMesh geometry={g.flap} alert={lit} fill={0.25} edge={2} edgeAngle={10} />
      </group>
      {[0, 1].map((i) => (
        <group key={i} position={[-0.2 + i * 0.4, 0.75 + Math.sin(frame / 7 + i) * 0.04, -0.05]} rotation={[0, 0, 0.12 - i * 0.24]} scale={0.7}>
          <Banknote />
        </group>
      ))}
    </group>
  );
};

const Magnet: React.FC = () => {
  const frame = useCurrentFrame();
  const g = useMemo(() => ({ arc: new THREE.TorusGeometry(0.75, 0.24, 10, 24, Math.PI), leg: new THREE.CylinderGeometry(0.24, 0.24, 0.8, 12, 3), tip: new THREE.CylinderGeometry(0.245, 0.245, 0.28, 12, 1) }), []);
  const pulse = 0.8 + 0.2 * Math.sin(frame / 4);
  return (
    // aberto pra baixo-direita (pra onde puxa)
    <group rotation={[0, 0, -Math.PI / 2 - 0.3]}>
      <WireMesh geometry={g.arc} fill={0.22} edge={2} edgeAngle={20} />
      {[0.75, -0.75].map((x, i) => (
        <group key={i} position={[x, -0.4, 0]}>
          <WireMesh geometry={g.leg} fill={0.22} edge={2} edgeAngle={20} />
          <group position={[0, -0.52, 0]}>
            <WireMesh geometry={g.tip} alert={i === 0} fill={0.4} edge={2.6 * pulse} edgeAngle={20} edgeColor={i === 0 ? WIRE.alert : WIRE.cyan} />
          </group>
        </group>
      ))}
    </group>
  );
};

// Posição de cada objeto na fileira (centro em x = 0).
const SPACING = 3.1;
export const temptationX = (i: number, n: number) => (i - (n - 1) / 2) * SPACING;

// Com anéis, a caixa inclui o raio máximo deles; sem anéis, só o objeto e o pedestal.
export const temptationBox = (n: number, rings = true) => {
  const half = (n - 1) * (SPACING / 2) + (rings ? 2.0 : 1.4);
  return new THREE.Box3(new THREE.Vector3(-half, FLOOR_Y - 0.1, rings ? -1.9 : -1.3), new THREE.Vector3(half, FLOOR_Y + (rings ? 4.1 : 3.4), rings ? 1.9 : 1.3));
};

export const Temptations: React.FC<{
  readonly objects: Temptation[];
  readonly ringsAt?: number;
  readonly notifyAt?: number;
  readonly pull?: boolean;
  readonly flow?: boolean;
  readonly lit?: boolean;
}> = ({ objects, ringsAt, notifyAt, pull = false, flow = false, lit = false }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const n = objects.length;
  // Ímã + carteira: a carteira é puxada (escorrega na direção do ímã, tremendo).
  const pullK = pull ? interpolate(t, [0.3, 2.2], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 0;
  return (
    <group>
      {objects.map((o, i) => {
        const x = temptationX(i, n);
        const isPulled = pull && o === "wallet";
        const dx = isPulled ? -pullK * (SPACING - 1.9) + Math.sin(t * 30) * 0.03 * pullK : 0;
        const spin = o === "magnet" ? 0 : Math.sin(t * 0.8 + i) * 0.5;
        return (
          <React.Fragment key={`${o}-${i}`}>
            <group position={[x + dx, -0.35 + Math.sin(t * 1.2 + i) * 0.08, 0]}>
              <group rotation={[0, spin, isPulled ? pullK * 0.25 : 0]}>
                {o === "card" ? <Card lit={lit} /> : null}
                {o === "bag" ? <Bag lit={lit} /> : null}
                {o === "phone" ? <Phone lit={lit} notifyAt={notifyAt} /> : null}
                {o === "wallet" ? <Wallet lit={lit} /> : null}
                {o === "magnet" ? <Magnet /> : null}
              </group>
              {ringsAt !== undefined && o !== "wallet" ? <SoundRings position={[0, 0.2, 0]} max={1.85} at={ringsAt + i * 0.12} speed={pull ? 1.4 : 1} /> : null}
            </group>
            <group position={[x, 0, 0]}>
              <Pedestal radius={1.2} y={FLOOR_Y + 0.05} alert={lit || o === "magnet"} />
            </group>
          </React.Fragment>
        );
      })}
      {/* cédulas (o salário) escorrendo pra dentro das tentações */}
      {flow
        ? Array.from({ length: 12 }, (_, k) => {
            const period = 1.6;
            const ph = (((t - k * (period / 12)) / period) % 1 + 1) % 1;
            if (t < k * (period / 12)) {
              return null;
            }
            const target = temptationX(k % n, n);
            const x = interpolate(ph, [0, 1], [target * 0.15 - 0.2, target]);
            const y = interpolate(ph, [0, 1], [3.3, 0.1]);
            const s = interpolate(ph, [0, 0.15, 0.85, 1], [0, 0.5, 0.5, 0]);
            return (
              <group key={k} position={[x, y, 0.3]} rotation={[ph * 3 + k, ph * 4, ph * 2]} scale={s}>
                <Banknote />
              </group>
            );
          })
        : null}
    </group>
  );
};

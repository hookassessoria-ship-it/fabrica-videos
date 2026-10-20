import React, { useMemo } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { floorAt, type Mover } from "../kinetic/Building";
import { FLOOR_Y } from "./charts";
import { Bot } from "./models";
import { Cart, MilkCarton, RiceBag } from "./props";
import { glow, WIRE } from "./theme";
import { Core, WireMesh } from "./Wire";

// Prédio da analogia em corte (holograma): andar = preço, elevador = inflação (velocidade),
// escada = salário. Mesmos campos do elemento "building" do Kinetic (elevator.moves,
// stairs.moves, markers, gap). O layout é uma conta pura, usada pelo 3D e pelos rótulos HTML.

export const BUILDING = {
  fh: 0.55,
  width: 3,
  depth: 1.8,
  shaftX: 0.62,
  shaftW: 1.0,
  stairX0: -3.1,
  stairX1: -1.65,
};

export const levelY = (floor: number) => FLOOR_Y + (floor - 1) * BUILDING.fh;

export type BuildingSpec = {
  floors?: number;
  elevator?: Mover & { cargo?: string[]; label?: string };
  stairs?: Mover & { label?: string };
  markers?: { at: number; floor: number; label: string }[];
  gap?: { at: number; from: number; to: number; label: string };
  speed?: { label?: string };
};

// Caixa do prédio no mundo (escada à esquerda, marcadores e chave à direita).
export const buildingBox = (spec: BuildingSpec) => {
  const floors = spec.floors ?? 10;
  const top = levelY(floors + 1) + 0.7;
  const right = spec.markers?.length || spec.gap ? 3.9 : spec.speed ? 2.9 : BUILDING.width / 2 + 0.2;
  const left = spec.stairs ? BUILDING.stairX0 - 0.35 : -BUILDING.width / 2 - 0.2;
  return new THREE.Box3(new THREE.Vector3(left, FLOOR_Y - 0.1, -BUILDING.depth / 2 - 0.1), new THREE.Vector3(right, top, BUILDING.depth / 2 + 0.1));
};

// Posição do bonequinho na escada (lances alternando de sentido, um por andar).
export const stairPose = (sf: number, floors: number) => {
  const flight = Math.min(floors - 1, Math.max(0, Math.floor(sf - 1)));
  const fr = Math.min(1, Math.max(0, sf - 1 - flight));
  const right = flight % 2 === 0;
  const x = right ? BUILDING.stairX0 + (BUILDING.stairX1 - BUILDING.stairX0) * fr : BUILDING.stairX1 - (BUILDING.stairX1 - BUILDING.stairX0) * fr;
  return { x, y: levelY(sf), dir: right ? 1 : -1 };
};

const box = (w: number, h: number, d: number, sx = 1, sy = 1, sz = 1) => new THREE.BoxGeometry(w, h, d, sx, sy, sz);

const Cargo: React.FC<{ readonly name: string }> = ({ name }) => {
  if (name === "milk") {
    return (
      <group scale={0.17}>
        <MilkCarton />
      </group>
    );
  }
  if (name === "shopping-cart") {
    return (
      <group scale={0.11} position={[0, 0.24, 0]}>
        <Cart alert />
      </group>
    );
  }
  return (
    <group scale={0.17}>
      <RiceBag />
    </group>
  );
};

export const Building3D: React.FC<{ readonly spec: BuildingSpec; readonly alert?: boolean }> = ({ spec, alert = false }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const floors = spec.floors ?? 10;
  const { fh, width, depth, shaftX, shaftW } = BUILDING;
  const H = floors * fh;
  const g = useMemo(
    () => ({
      shell: box(width, H, depth, 6, floors, 3),
      slab: box(width, 0.035, depth, 6, 1, 3),
      shaft: box(shaftW, H, depth * 0.7, 1, floors, 1),
      cabin: box(shaftW * 0.82, fh * 0.82, depth * 0.55, 2, 2, 2),
      roof: new THREE.ConeGeometry(width * 0.62, 0.6, 4, 1, true),
      window: box(0.42, fh * 0.42, 0.02),
      step: box(0.26, 0.04, 0.7),
    }),
    [width, H, depth, floors, shaftW, fh],
  );

  // Elevador.
  const ef = floorAt(spec.elevator, frame, fps);
  const vel = (ef - floorAt(spec.elevator, frame - 1, fps)) * fps;
  const fast = Math.abs(vel) > 3;
  const hot = alert || fast;
  const cabinY = levelY(ef) + fh * 0.45;
  const hover = Math.abs(vel) < 0.05 ? Math.sin(t * 3) * 0.01 : 0;

  // Escada + bonequinho.
  const sf = spec.stairs ? floorAt(spec.stairs, frame, fps) : 1;
  const climbing = spec.stairs ? Math.abs(sf - floorAt(spec.stairs, frame - 1, fps)) > 0.0005 : false;
  const pose = stairPose(sf, floors);
  const stairGeo = useMemo(() => {
    const pts: number[] = [];
    const n = 6;
    for (let i = 0; i < floors - 1; i++) {
      const right = i % 2 === 0;
      const y0 = levelY(i + 1);
      const x0 = right ? BUILDING.stairX0 : BUILDING.stairX1;
      const dx = ((BUILDING.stairX1 - BUILDING.stairX0) / n) * (right ? 1 : -1);
      const dy = fh / n;
      let x = x0;
      let y = y0;
      for (let k = 0; k < n; k++) {
        pts.push(x, y, 0, x, y + dy, 0, x, y + dy, 0, x + dx, y + dy, 0);
        x += dx;
        y += dy;
      }
      // patamar
      pts.push(x, y, 0, x + (right ? 0.25 : -0.25), y, 0);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    return geo;
  }, [floors, fh]);

  // Velocímetro 3D (arco + ponteiro) ao lado do prédio.
  const speedNorm = Math.min(1, Math.abs(vel) / 10);
  const needle = Math.PI - speedNorm * Math.PI + (speedNorm > 0.3 ? Math.sin(frame * 2.3) * 0.05 : 0);

  return (
    <group>
      {/* casca do prédio em corte: malha + bordas */}
      <group position={[0, FLOOR_Y + H / 2, 0]}>
        <WireMesh geometry={g.shell} fill={0.05} edge={1.5} edgeAngle={1} />
      </group>
      <group position={[0, FLOOR_Y + H + 0.3, 0]} rotation={[0, Math.PI / 4, 0]}>
        <WireMesh geometry={g.roof} fill={0.08} edge={1.6} edgeAngle={1} />
      </group>
      {Array.from({ length: floors + 1 }, (_, i) => (
        <group key={i} position={[0, levelY(i + 1), 0]}>
          <WireMesh geometry={g.slab} fill={0.12} edge={1.1} edgeAngle={1} wire={false} />
        </group>
      ))}
      {/* janelas acesas no lado esquerdo (piscam de leve) */}
      {Array.from({ length: floors }, (_, i) =>
        [0, 1].map((k) => {
          const on = ((i * 7 + k * 3 + Math.floor(t * 1.5)) % 5) !== 0;
          return (
            <mesh key={`${i}-${k}`} geometry={g.window} position={[-1.1 + k * 0.55, levelY(i + 1) + fh * 0.5, -depth / 2 + 0.02]}>
              <meshBasicMaterial color={glow(WIRE.white, on ? 1.4 : 0.4)} transparent opacity={on ? 0.55 : 0.15} toneMapped={false} />
            </mesh>
          );
        }),
      )}
      {/* poço do elevador */}
      <group position={[shaftX, FLOOR_Y + H / 2, 0]}>
        <WireMesh geometry={g.shaft} fill={0.04} edge={1.2} edgeAngle={1} wire={false} />
      </group>
      {/* cabo */}
      <mesh position={[shaftX, (FLOOR_Y + H + cabinY + fh * 0.4) / 2, 0]}>
        <cylinderGeometry args={[0.012, 0.012, Math.max(0.01, FLOOR_Y + H - cabinY - fh * 0.4), 4]} />
        <meshBasicMaterial color={glow(WIRE.cyan, 2)} toneMapped={false} />
      </mesh>
      {/* linhas de velocidade no poço */}
      {fast
        ? Array.from({ length: 5 }, (_, k) => {
            const len = 0.5 + speedNorm * 1.2;
            const y = cabinY - 0.4 - ((k * 0.37 + t * 9) % 2.4);
            return (
              <mesh key={k} position={[shaftX - 0.3 + (k % 3) * 0.3, Math.max(FLOOR_Y + len / 2, y), 0.35]}>
                <boxGeometry args={[0.015, len, 0.015]} />
                <meshBasicMaterial color={glow(WIRE.alert, 2.2)} toneMapped={false} transparent opacity={0.8} />
              </mesh>
            );
          })
        : null}
      {/* cabine com a carga */}
      <group position={[shaftX, cabinY + hover, 0]}>
        <WireMesh geometry={g.cabin} alert={hot} fill={hot ? 0.3 : 0.18} edge={hot ? 2.6 : 2} edgeAngle={1} />
        {hot ? <Core geometry={g.cabin} intensity={0.5} /> : null}
        {(spec.elevator?.cargo ?? ["wheat", "milk"]).slice(0, 2).map((c, i, arr) => (
          <group key={c} position={[arr.length === 1 ? 0 : -0.18 + i * 0.36, -fh * 0.41 + 0.01, 0]} rotation={[0, t * 0.8, 0]}>
            <group position={[0, c === "shopping-cart" ? 0 : 0.17, 0]}>
              <Cargo name={c} />
            </group>
          </group>
        ))}
      </group>
      {/* escada + bonequinho (X Bot) subindo, cansado */}
      {spec.stairs ? (
        <>
          <lineSegments geometry={stairGeo}>
            <lineBasicMaterial color={glow(WIRE.cyan, 1.6)} toneMapped={false} />
          </lineSegments>
          <group position={[pose.x, pose.y + 0.02, 0.05]} rotation={[0, (pose.dir * Math.PI) / 2, 0]} scale={0.42}>
            <Bot clip={climbing ? "walk" : "sad_pose"} speed={climbing ? 0.7 : 1} />
          </group>
        </>
      ) : null}
      {/* marcadores de andar: tracinho saindo da fachada */}
      {(spec.markers ?? []).map((m, i) =>
        frame >= m.at * fps ? (
          <mesh key={i} position={[width / 2 + 0.25, levelY(m.floor) + fh / 2, 0]}>
            <boxGeometry args={[0.5, 0.02, 0.02]} />
            <meshBasicMaterial color={glow(WIRE.cyan, 2)} toneMapped={false} />
          </mesh>
        ) : null,
      )}
      {/* chave entre dois andares (distância salário x preço) */}
      {spec.gap && frame >= spec.gap.at * fps ? (
        <group>
          {[spec.gap.from, spec.gap.to].map((fl, i) => (
            <mesh key={i} position={[width / 2 + 0.35, levelY(fl) + fh / 2, 0]}>
              <boxGeometry args={[0.5, 0.03, 0.03]} />
              <meshBasicMaterial color={glow(WIRE.alert, 2.4)} toneMapped={false} />
            </mesh>
          ))}
          <mesh position={[width / 2 + 0.6, (levelY(spec.gap.from) + levelY(spec.gap.to)) / 2 + fh / 2, 0]}>
            <boxGeometry args={[0.03, Math.abs(levelY(spec.gap.to) - levelY(spec.gap.from)), 0.03]} />
            <meshBasicMaterial color={glow(WIRE.alert, 2.4)} toneMapped={false} />
          </mesh>
        </group>
      ) : null}
      {/* velocímetro */}
      {spec.speed ? (
        <group position={[width / 2 + 0.85, FLOOR_Y + 0.55, 0]}>
          <mesh>
            <torusGeometry args={[0.45, 0.02, 6, 32, Math.PI]} />
            <meshBasicMaterial color={glow(WIRE.cyan, 1.6)} toneMapped={false} />
          </mesh>
          <mesh rotation={[0, 0, needle]} position={[Math.cos(needle) * 0.2, Math.sin(needle) * 0.2, 0]}>
            <boxGeometry args={[0.4, 0.035, 0.035]} />
            <meshBasicMaterial color={glow(speedNorm > 0.3 ? WIRE.alert : WIRE.white, 2.4)} toneMapped={false} />
          </mesh>
        </group>
      ) : null}
    </group>
  );
};

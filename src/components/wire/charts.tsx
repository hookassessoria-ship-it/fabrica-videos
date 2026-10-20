import React, { useMemo } from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import type { BarDatum } from "../../templates/kineticTypes";
import { glow, WIRE } from "./theme";
import { WireMesh } from "./Wire";

// Gráficos holográficos. O layout (onde fica cada barra/ponto) é uma conta pura, usada pelo
// three.js e pelos rótulos HTML (que são projetados na tela e lidos pela checagem de números).

export const FLOOR_Y = -2.2;
const STAGGER = 3;

export type BarsLayout = { x: number; h: number; top: [number, number, number]; base: [number, number, number] }[];

export const barsLayout = (data: BarDatum[], width = 6.6, height = 5, max?: number): BarsLayout => {
  const top = max ?? Math.max(...data.map((d) => d.value)) * 1.08;
  const slot = width / data.length;
  return data.map((d, i) => {
    const x = -width / 2 + slot * (i + 0.5);
    const h = (d.value / top) * height;
    return { x, h, top: [x, FLOOR_Y + h, 0], base: [x, FLOOR_Y, 0] };
  });
};

// Crescimento da barra i (0..1, com leve overshoot) e o "pop" do valor depois que ela cresce.
export const barGrow = (frame: number, fps: number, at: number, i: number) => {
  const s0 = Math.round(at * fps) + 4 + i * STAGGER;
  const g = spring({ frame: frame - s0, fps, config: { damping: 11, stiffness: 160, mass: 0.8 } });
  const labelStart = s0 + 12;
  const pop = frame < labelStart ? 0 : spring({ frame: frame - labelStart, fps, config: { damping: 9, stiffness: 190, mass: 0.7 } });
  return { g: Math.max(0, g), pop };
};

export const Bars3D: React.FC<{ readonly data: BarDatum[]; readonly at: number; readonly width?: number; readonly height?: number; readonly max?: number }> = ({
  data,
  at,
  width = 6.6,
  height = 5,
  max,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const layout = barsLayout(data, width, height, max);
  const slot = width / data.length;
  const bw = slot * 0.56;
  const geo = useMemo(() => {
    const g = new THREE.BoxGeometry(bw, 1, bw, 2, 10, 2);
    g.translate(0, 0.5, 0);
    return g;
  }, [bw]);
  const base = useMemo(() => new THREE.BoxGeometry(width + 0.6, 0.06, bw * 1.8), [width, bw]);
  return (
    <group>
      <group position={[0, FLOOR_Y, 0]}>
        <WireMesh geometry={base} fill={0.2} edge={1.8} />
      </group>
      {layout.map((b, i) => {
        const { g } = barGrow(frame, fps, at, i);
        const hl = Boolean(data[i].highlight);
        if (g <= 0.001) {
          return null;
        }
        return (
          <group key={i} position={[b.x, FLOOR_Y, 0]} scale={[1, Math.max(0.001, b.h * g), 1]}>
            <WireMesh geometry={geo} alert={hl} fill={hl ? 0.35 : 0.16} edge={hl ? 2.4 : 1.7} edgeAngle={10} />
            {hl ? (
              <mesh geometry={geo}>
                <meshBasicMaterial color={glow(WIRE.alert, 1.6)} transparent opacity={0.22} blending={THREE.AdditiveBlending} toneMapped={false} depthWrite={false} />
              </mesh>
            ) : null}
          </group>
        );
      })}
    </group>
  );
};

// Linha que se desenha ponto a ponto (com ponta brilhante).
export const lineLayout = (points: number[], width = 4.8, height = 3.4) => {
  const lo = Math.min(...points) * 0.7;
  const hi = Math.max(...points) * 1.05;
  return points.map((v, i): [number, number, number] => [-width / 2 + (i / (points.length - 1)) * width, FLOOR_Y + 0.6 + ((v - lo) / (hi - lo)) * height, 0]);
};

export const lineProgress = (frame: number, fps: number, at: number) =>
  interpolate(frame, [at * fps, at * fps + 1.1 * fps], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

export const Line3D: React.FC<{ readonly points: number[]; readonly at: number; readonly alertFirst?: boolean }> = ({ points, at, alertFirst = true }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pts = lineLayout(points);
  const p = lineProgress(frame, fps, at);
  const seg = p * (pts.length - 1);
  const i0 = Math.min(pts.length - 2, Math.floor(seg));
  const tt = seg - i0;
  const shown = pts.slice(0, i0 + 1).map((q) => new THREE.Vector3(...q));
  const tip = new THREE.Vector3(...pts[i0]).lerp(new THREE.Vector3(...pts[i0 + 1]), tt);
  shown.push(tip);
  const curve = new THREE.CatmullRomCurve3(shown, false, "catmullrom", 0.1);
  const tube = new THREE.TubeGeometry(curve, Math.max(8, shown.length * 12), 0.05, 8, false);
  const dot = useMemo(() => new THREE.SphereGeometry(0.12, 12, 8), []);
  return (
    <group>
      {p > 0 ? (
        <mesh geometry={tube}>
          <meshBasicMaterial color={glow(WIRE.cyan, 2.2)} toneMapped={false} />
        </mesh>
      ) : null}
      {pts.map((q, i) =>
        seg >= i - 0.02 ? (
          <group key={i} position={q}>
            <WireMesh geometry={dot} alert={alertFirst && i === 0} fill={0.4} edge={2.2} />
            {/* haste até o chão */}
            <mesh position={[0, (FLOOR_Y - q[1]) / 2, 0]}>
              <cylinderGeometry args={[0.01, 0.01, q[1] - FLOOR_Y, 4]} />
              <meshBasicMaterial color={glow(WIRE.cyanDim, 1.4)} toneMapped={false} transparent opacity={0.7} />
            </mesh>
          </group>
        ) : null,
      )}
      {p > 0 && p < 1 ? (
        <mesh geometry={dot} position={tip} scale={1.6}>
          <meshBasicMaterial color={glow(WIRE.white, 3)} toneMapped={false} />
        </mesh>
      ) : null}
    </group>
  );
};

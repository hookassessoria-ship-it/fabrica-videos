import { useLoader } from "@react-three/fiber";
import React, { useMemo } from "react";
import { interpolate, random, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";
import { glow, WIRE } from "./theme";
import { Core, WireMesh } from "./Wire";

// Modelos baixados por `npm run models:fetch` (créditos em public/models/credits.json).
const firstMeshGeometry = (root: THREE.Object3D) => {
  let g: THREE.BufferGeometry | null = null;
  root.traverse((o) => {
    if (!g && (o as THREE.Mesh).isMesh) {
      g = (o as THREE.Mesh).geometry;
    }
  });
  return g as unknown as THREE.BufferGeometry;
};

// Ouvidos no modelo da cabeça (unidades do modelo, antes da escala).
const EAR = { x: 3.7, y: 0.2, z: -1.3 };

// Cérebro procedural: esfera com dobras (giros) feitas por ruído, dois hemisférios.
const brainGeometry = () => {
  const g = new THREE.IcosahedronGeometry(1, 4);
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const folds = Math.sin(v.x * 9 + Math.sin(v.y * 7)) * Math.sin(v.y * 8 + v.z * 6) * 0.06;
    const fissure = Math.exp(-((v.x * 6) ** 2)) * 0.12;
    v.multiplyScalar(1 + folds - fissure);
    v.set(v.x * 1.05, v.y * 0.82, v.z * 1.22);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
};

// Cabeça humana em malha + cérebro que acende em magenta a partir de `lightAt` (s do shot).
// `waxAt`: a partir desse segundo, cera (ciano) tapa os dois ouvidos.
export const Head: React.FC<{ readonly lightAt?: number; readonly scale?: number; readonly waxAt?: number }> = ({ lightAt, scale = 0.3, waxAt }) => {
  const gltf = useLoader(GLTFLoader, staticFile("models/head.glb"));
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const geo = useMemo(() => firstMeshGeometry(gltf.scene), [gltf]);
  const brain = useMemo(brainGeometry, []);
  const on = lightAt === undefined ? 0 : interpolate(frame, [lightAt * fps, lightAt * fps + 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const pulse = on * (0.75 + 0.25 * Math.sin(frame / 4));
  // Faíscas de sinapse dentro do cérebro.
  const sparks = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const arr: number[] = [];
    for (let i = 0; i < 160; i++) {
      const u = random(`syn-u${i}`) * Math.PI * 2;
      const w = Math.acos(2 * random(`syn-w${i}`) - 1);
      const r = 0.85 * Math.cbrt(random(`syn-r${i}`));
      arr.push(r * Math.sin(w) * Math.cos(u) * 1.05, r * Math.cos(w) * 0.82, r * Math.sin(w) * Math.sin(u) * 1.22);
    }
    g.setAttribute("position", new THREE.Float32BufferAttribute(arr, 3));
    return g;
  }, []);
  const wax = waxAt === undefined ? 0 : Math.max(0, spring({ frame: frame - Math.round(waxAt * fps), fps, config: { damping: 10, stiffness: 170 } }));
  return (
    <group scale={scale}>
      <WireMesh geometry={geo} fill={0.1} edge={1.3} edgeAngle={18} />
      {wax > 0.01
        ? [1, -1].map((side) => (
            <group key={side} position={[side * EAR.x, EAR.y, EAR.z]} scale={wax}>
              <mesh>
                <sphereGeometry args={[0.55, 14, 10]} />
                <meshBasicMaterial color={glow(WIRE.cyan, 2.4)} toneMapped={false} transparent opacity={0.85} />
              </mesh>
            </group>
          ))
        : null}
      <group position={[0, 2.45, -0.75]} scale={[1.55, 1.3, 1.7]} rotation={[0.2, 0, 0]}>
        <WireMesh geometry={brain} alert={on > 0.05} fill={0.12 + 0.25 * on} edge={0.9 + 1.6 * pulse} edgeAngle={35} />
        {on > 0 ? <Core geometry={brain} intensity={pulse} /> : null}
        {on > 0 ? (
          <points geometry={sparks} rotation={[0, frame * 0.05, 0]}>
            <pointsMaterial color={glow(WIRE.alert, 2.5)} size={0.06} transparent opacity={on} toneMapped={false} depthWrite={false} />
          </points>
        ) : null}
      </group>
    </group>
  );
};

// Figura humana (X Bot) em malha, com animação do próprio modelo (walk, idle, sad_pose...).
export const Bot: React.FC<{ readonly clip?: string; readonly speed?: number; readonly alert?: boolean; readonly time?: number; readonly opacity?: number }> = ({
  clip = "walk",
  speed = 1,
  alert = false,
  time,
  opacity = 0.32,
}) => {
  const gltf = useLoader(GLTFLoader, staticFile("models/xbot.glb"));
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  // Cópia própria (o mesmo modelo pode aparecer em shots diferentes).
  const { scene, mixer } = useMemo(() => {
    const s = SkeletonUtils.clone(gltf.scene) as THREE.Object3D;
    const mat = new THREE.MeshBasicMaterial({
      color: glow(alert ? WIRE.alert : WIRE.white, 1.2),
      wireframe: true,
      transparent: true,
      opacity,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
      depthWrite: false,
    });
    s.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        (o as THREE.Mesh).material = mat;
        (o as THREE.Mesh).frustumCulled = false;
      }
    });
    return { scene: s, mixer: new THREE.AnimationMixer(s) };
  }, [gltf, alert, opacity]);
  const action = useMemo(() => {
    const a = gltf.animations.find((c) => c.name === clip) ?? gltf.animations[0];
    const act = mixer.clipAction(a);
    act.play();
    return act;
  }, [gltf, mixer, clip]);
  action.enabled = true;
  mixer.setTime((time ?? frame / fps) * speed);
  return <primitive object={scene} />;
};

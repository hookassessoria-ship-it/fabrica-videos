import React, { useMemo } from "react";
import { Easing, interpolate, random, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { glow, WIRE } from "./theme";
import { Core, WireMesh } from "./Wire";

// Palcos "espaço": oceano com onda gigante e nave pousada, planeta oceânico com anéis de
// gravidade, buraco negro como disco de acreção. Tudo genérico (visualização científica),
// nada que copie o desenho de um filme.

export const OCEAN_Y = -1.5;

const clampOpts = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

// ---------------------------------------------------------------- oceano

// Malha do mar deslocada no shader: marola constante + uma crista gigante que cresce e
// avança na direção da câmera. A cor vai do ciano ao magenta conforme a altura.
const OCEAN_VS = `
uniform float uTime;
uniform float uWave;
uniform float uWaveZ;
uniform float uSize;
varying float vH;
varying float vFade;
void main() {
  vec3 p = position;
  float h = sin(p.x * 1.3 + uTime * 1.4) * 0.08 + sin(p.z * 1.7 - uTime * 1.1) * 0.07 + sin((p.x + p.z) * 2.3 + uTime * 2.0) * 0.04;
  float d = p.z - uWaveZ;
  // crista: sobe rápido na frente e desce devagar atrás
  float ridge = uWave * exp(-pow(d / (d > 0.0 ? 0.8 : 1.6), 2.0)) * (0.88 + 0.12 * sin(p.x * 0.7 + uTime));
  p.y += h + ridge;
  vH = ridge + h;
  vFade = smoothstep(uSize * 0.5, uSize * 0.22, length(p.xz));
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;

const OCEAN_FS = `
uniform vec3 uColor;
uniform vec3 uAlert;
uniform float uWave;
varying float vH;
varying float vFade;
void main() {
  float k = clamp(vH / max(0.8, uWave * 0.9), 0.0, 1.0);
  gl_FragColor = vec4(mix(uColor, uAlert, k), (0.22 + 0.5 * k) * vFade);
}`;

export const Ocean: React.FC<{ readonly waveAt?: number; readonly size?: number; readonly height?: number }> = ({ waveAt, size = 16, height = 2.8 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(size, size * 0.8, 96, 76);
    g.rotateX(-Math.PI / 2);
    return g;
  }, [size]);
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: OCEAN_VS,
        fragmentShader: OCEAN_FS,
        wireframe: true,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uTime: { value: 0 },
          uWave: { value: 0 },
          uWaveZ: { value: -6 },
          uSize: { value: size },
          uColor: { value: glow(WIRE.cyan, 1.3) },
          uAlert: { value: glow(WIRE.alert, 2.2) },
        },
      }),
    [size],
  );
  const wave = waveAt === undefined ? 0 : interpolate(t, [waveAt, waveAt + 1.4], [0, height], { ...clampOpts, easing: Easing.inOut(Easing.cubic) });
  mat.uniforms.uTime.value = t;
  mat.uniforms.uWave.value = wave;
  mat.uniforms.uWaveZ.value = waveAt === undefined ? -6 : interpolate(t, [waveAt, waveAt + 2.6], [-5.6, -1.6], clampOpts);
  return <mesh geometry={geo} material={mat} position={[0, OCEAN_Y, 0]} frustumCulled={false} />;
};

// Altura do mar num ponto (mesma conta do shader, sem a crista) pra nave boiar junto.
const swell = (x: number, z: number, t: number) => Math.sin(x * 1.3 + t * 1.4) * 0.08 + Math.sin(z * 1.7 - t * 1.1) * 0.07;

// Nave genérica de pouso: casco em cunha, cabine, asas curtas e dois motores.
export const Ship: React.FC<{ readonly x?: number; readonly z?: number; readonly afloat?: boolean; readonly alert?: boolean; readonly scale?: number }> = ({
  x = 0.4,
  z = 0.8,
  afloat = true,
  alert = false,
  scale = 1,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const g = useMemo(() => {
    const hull = new THREE.BoxGeometry(2.4, 0.36, 1.3, 8, 2, 4);
    const p = hull.attributes.position;
    const v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      // bico afinando pra frente (+x) e topo abaulado
      const nose = 1 - Math.max(0, v.x / 1.2) * 0.55;
      p.setXYZ(i, v.x, v.y * (v.y > 0 ? 1 + 0.4 * (1 - Math.abs(v.z) / 0.65) : 1), v.z * nose);
    }
    hull.computeVertexNormals();
    return {
      hull,
      cabin: new THREE.BoxGeometry(0.62, 0.26, 0.62, 2, 1, 2),
      wing: new THREE.BoxGeometry(0.9, 0.05, 0.62, 3, 1, 2),
      engine: new THREE.CylinderGeometry(0.15, 0.19, 0.5, 10, 1),
    };
  }, []);
  const y = afloat ? OCEAN_Y + 0.24 + swell(x, z, t) : 0;
  return (
    <group position={[x, y, z]} rotation={[Math.sin(t * 1.3) * 0.04, -0.35, Math.sin(t * 1.1 + 1) * 0.05]} scale={scale}>
      <WireMesh geometry={g.hull} alert={alert} fill={0.16} edge={2} edgeAngle={18} />
      <group position={[0.45, 0.3, 0]}>
        <WireMesh geometry={g.cabin} fill={0.2} edge={2.2} edgeAngle={20} />
        <Core geometry={g.cabin} intensity={0.35} color={WIRE.cyan} />
      </group>
      {[1, -1].map((s) => (
        <group key={s} position={[-0.25, 0.02, s * 0.9]} rotation={[s * 0.18, 0, 0]}>
          <WireMesh geometry={g.wing} alert={alert} fill={0.18} edge={1.8} edgeAngle={10} />
        </group>
      ))}
      {[0.32, -0.32].map((zz) => (
        <group key={zz} position={[-1.25, 0.05, zz]} rotation={[0, 0, Math.PI / 2]}>
          <WireMesh geometry={g.engine} fill={0.2} edge={1.8} edgeAngle={30} />
        </group>
      ))}
    </group>
  );
};

// ---------------------------------------------------------------- planeta

const PLANET_VS = `
uniform float uTime;
uniform float uWave;
varying float vH;
void main() {
  vec3 n = normalize(position);
  float h = sin(n.x * 9.0 + uTime * 1.2) * sin(n.z * 8.0 - uTime) * 0.035;
  // faixa de onda gigante varrendo o planeta
  float band = dot(n, normalize(vec3(0.6, 0.2, 0.75)));
  float phase = mod(uTime * 0.35, 2.4) - 1.2;
  float ridge = uWave * exp(-pow((band - phase) / 0.07, 2.0));
  vH = ridge;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position + n * (h + ridge), 1.0);
}`;

const PLANET_FS = `
uniform vec3 uColor;
uniform vec3 uAlert;
varying float vH;
void main() {
  float k = clamp(vH / 0.25, 0.0, 1.0);
  gl_FragColor = vec4(mix(uColor, uAlert, k), 0.5 + 0.4 * k);
}`;

// Planeta oceânico em malha, com a crista de uma onda gigante dando a volta, anéis de
// gravidade pulsando pra fora e uma nave pequena em órbita.
export const OceanPlanet: React.FC<{ readonly rings?: number; readonly radius?: number; readonly alert?: boolean }> = ({ rings = 3, radius = 2, alert = false }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const geo = useMemo(() => new THREE.SphereGeometry(radius, 72, 48), [radius]);
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: PLANET_VS,
        fragmentShader: PLANET_FS,
        wireframe: true,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { uTime: { value: 0 }, uWave: { value: 0.22 }, uColor: { value: glow(WIRE.cyan, 0.9) }, uAlert: { value: glow(WIRE.alert, 2.2) } },
      }),
    [],
  );
  mat.uniforms.uTime.value = t;
  const ringGeo = useMemo(() => new THREE.TorusGeometry(1, 0.012, 6, 128), []);
  const orbit = t * 0.9;
  return (
    <group rotation={[0.25, t * 0.15, -0.18]}>
      {/* oclusor escuro: some com as linhas do lado de trás */}
      <mesh>
        <sphereGeometry args={[radius * 0.985, 48, 32]} />
        <meshBasicMaterial color={WIRE.bg0} />
      </mesh>
      <mesh geometry={geo} material={mat} />
      {Array.from({ length: rings }, (_, k) => {
        const ph = (t * 0.45 + k / rings) % 1;
        const r = radius * (1.15 + ph * 0.55);
        return (
          <mesh key={k} geometry={ringGeo} scale={[r, r, r]} rotation={[Math.PI / 2 + 0.32, 0, 0]}>
            <meshBasicMaterial color={glow(k === 0 || alert ? WIRE.alert : WIRE.cyan, 2)} transparent opacity={(1 - ph) * 0.85} toneMapped={false} depthWrite={false} />
          </mesh>
        );
      })}
      <group position={[Math.cos(orbit) * radius * 1.45, Math.sin(orbit * 0.7) * 0.3, Math.sin(orbit) * radius * 1.45]} rotation={[0, -orbit, 0]}>
        <Ship afloat={false} x={0} z={0} scale={0.16} />
      </group>
    </group>
  );
};

// ---------------------------------------------------------------- buraco negro

// Disco de acreção de partículas (rotação kepleriana, espiralando pra dentro), horizonte
// escuro e anéis de luz em volta. Visualização científica genérica.
export const BlackHole: React.FC<{ readonly count?: number; readonly seed?: string }> = ({ count = 2600, seed = "bh" }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const base = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        r: 1.3 + 2.7 * random(`${seed}-r${i}`) ** 1.5,
        a: random(`${seed}-a${i}`) * Math.PI * 2,
        y: (random(`${seed}-y${i}`) - 0.5) * 0.12,
      })),
    [count, seed],
  );
  const geo = useMemo(() => new THREE.BufferGeometry(), []);
  const pos: number[] = [];
  const col: number[] = [];
  const hot = glow(WIRE.white, 2.6);
  const mid = glow(WIRE.cyan, 2);
  const cold = glow(WIRE.alert, 1.8);
  const c = new THREE.Color();
  for (const p of base) {
    // espiral: cai devagar e reaparece na borda
    const r = 1.3 + ((((p.r - 1.3 - t * 0.12) % 2.7) + 2.7) % 2.7);
    const a = p.a + t * 1.7 * r ** -1.5;
    pos.push(Math.cos(a) * r, p.y * r, Math.sin(a) * r);
    const k = (r - 1.3) / 2.7;
    c.copy(k < 0.35 ? hot.clone().lerp(mid, k / 0.35) : mid.clone().lerp(cold, (k - 0.35) / 0.65));
    col.push(c.r, c.g, c.b);
  }
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  const ring = useMemo(() => new THREE.TorusGeometry(1.14, 0.022, 8, 96), []);
  return (
    <group rotation={[0.22, 0, 0.08]}>
      <points geometry={geo}>
        <pointsMaterial vertexColors size={0.05} sizeAttenuation transparent opacity={0.9} toneMapped={false} depthWrite={false} blending={THREE.AdditiveBlending} />
      </points>
      <mesh>
        <sphereGeometry args={[1, 40, 28]} />
        <meshBasicMaterial color="#000000" />
      </mesh>
      <mesh geometry={ring} rotation={[Math.PI / 2, 0, 0]}>
        <meshBasicMaterial color={glow(WIRE.white, 2.4)} toneMapped={false} transparent opacity={0.9} />
      </mesh>
      <mesh geometry={ring} rotation={[0, 0, t * 0.2]} scale={1.04}>
        <meshBasicMaterial color={glow(WIRE.cyan, 2)} toneMapped={false} transparent opacity={0.55} />
      </mesh>
    </group>
  );
};

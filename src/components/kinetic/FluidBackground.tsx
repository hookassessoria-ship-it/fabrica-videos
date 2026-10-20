import { Video } from "@remotion/media";
import React, { useLayoutEffect, useRef } from "react";
import { AbsoluteFill, Img, interpolate, random, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { withAlpha } from "../../brand/color";
import { EASE } from "./motion";

// Paletas: 5 cores, da mais clara (brilho) à mais escura (fundo profundo).
export const PALETTES: Record<string, string[]> = {
  sunset: ["#F7B347", "#E8774A", "#C2185B", "#5B2C6F", "#1A0B1F"],
  // mesmo pôr do sol, mais fundo: sem amarelo, roxo e quase preto dominando
  "sunset-dark": ["#E8774A", "#C2185B", "#5B2C6F", "#1A0B1F", "#0B0410"],
  electric: ["#FFFFFF", "#3D5AFE", "#0A0AFF", "#0B0B1A", "#04040C"],
  rikuai: ["#7C5CFF", "#2A1B5E", "#120F24", "#08080d", "#030305"],
  // variação "quente" pra momentos de alerta (imposto, alta de preço)
  heat: ["#FF8A3D", "#E53935", "#B0123B", "#4A0D2E", "#14040C"],
  // alerta na linha roxa (versão B): magenta em vez de laranja
  "rikuai-heat": ["#FF4FA3", "#C2187A", "#5B1A8C", "#1A0B33", "#07040F"],
};

const hexToRgb = (hex: string): [number, number, number] => {
  const n = parseInt(hex.replace("#", "").slice(0, 6), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

const luminance = (hex: string) => {
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const toHex = (rgb: number[]) => `#${rgb.map((v) => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, "0")).join("")}`;

// Nome de preset ou lista própria (4 ou 5 cores, em qualquer ordem): ordena da mais
// clara pra mais escura e, se faltar, cria a 5ª (sombra profunda) a partir da mais escura.
export const resolvePalette = (p: string | string[] | undefined, fallback = "sunset"): string[] => {
  if (Array.isArray(p) && p.length >= 4) {
    const sorted = [...p].sort((x, y) => luminance(y) - luminance(x)).slice(0, 5);
    if (sorted.length === 4) {
      sorted.push(toHex(hexToRgb(sorted[3]).map((v) => v * 0.4)));
    }
    return sorted;
  }
  return PALETTES[(typeof p === "string" ? p : fallback) as string] ?? PALETTES[fallback] ?? PALETTES["sunset-dark"];
};

// Gradiente fluido: ruído fbm com "domain warping" em escala grande (manchas amplas),
// mapeado numa rampa de 5 cores com áreas escuras de verdade e vinheta.
const FRAG = `
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform float uPulse;
uniform vec3 uC0;
uniform vec3 uC1;
uniform vec3 uC2;
uniform vec3 uC3;
uniform vec3 uC4;
float hash(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float noise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) { float v = 0.0; float a = 0.55; for (int i = 0; i < 3; i++) { v += a * noise(p); p *= 1.9; a *= 0.45; } return v; }
vec3 ramp(float v) {
  vec3 c = mix(uC4, uC3, smoothstep(0.0, 0.26, v));
  c = mix(c, uC2, smoothstep(0.24, 0.5, v));
  c = mix(c, uC1, smoothstep(0.5, 0.74, v));
  c = mix(c, uC0, smoothstep(0.74, 0.96, v));
  return c;
}
void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 p = vec2(uv.x, uv.y * uRes.y / uRes.x) * 0.6;
  float t = uTime;
  float a = t * 0.06;
  p = mat2(cos(a), -sin(a), sin(a), cos(a)) * (p - vec2(0.3, 0.55)) + vec2(0.3, 0.55);
  vec2 q = vec2(fbm(p + vec2(0.0, t * 0.7)), fbm(p + vec2(5.2, 1.3) - t * 0.55));
  vec2 r = vec2(fbm(p + 3.0 * q + vec2(1.7, 9.2) + t * 0.42), fbm(p + 3.0 * q + vec2(8.3, 2.8) - t * 0.36));
  float f = fbm(p + 2.4 * r);
  float v = smoothstep(0.44, 0.8, f);
  // dobras: onde o warp é fraco, a cor afunda no escuro
  v *= 0.73 + 0.36 * smoothstep(0.2, 0.7, length(r - vec2(0.15)));
  vec3 col = ramp(clamp(v + uPulse * 0.15, 0.0, 1.0));
  float vig = smoothstep(1.2, 0.3, length((uv - vec2(0.5, 0.5)) * vec2(1.0, 1.3)));
  col *= 0.55 + 0.45 * vig;
  col *= 1.0 + uPulse * 0.22;
  gl_FragColor = vec4(col, 1.0);
}`;

const VERT = `attribute vec2 a; void main() { gl_Position = vec4(a, 0.0, 1.0); }`;

type GL = { gl: WebGLRenderingContext; prog: WebGLProgram };

const setup = (canvas: HTMLCanvasElement): GL | null => {
  const gl = canvas.getContext("webgl", { preserveDrawingBuffer: true, antialias: false });
  if (!gl) {
    return null;
  }
  const sh = (type: number, src: string) => {
    const s = gl.createShader(type) as WebGLShader;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return s;
  };
  const prog = gl.createProgram() as WebGLProgram;
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    return null;
  }
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, "a");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  return { gl, prog };
};

export type PaletteStop = { startFrame: number; colors: string[] };

const GLIDE = 20;

// Cores no frame atual: transição suave entre a paleta do shot anterior e a do atual.
const colorsAt = (stops: PaletteStop[], frame: number) => {
  let i = 0;
  while (i + 1 < stops.length && frame >= stops[i + 1].startFrame) {
    i++;
  }
  const cur = stops[i].colors.map(hexToRgb);
  const prev = stops[i - 1]?.colors.map(hexToRgb);
  if (!prev) {
    return cur;
  }
  const t = interpolate(frame, [stops[i].startFrame, stops[i].startFrame + GLIDE], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE.inOutCubic });
  return cur.map((c, k) => c.map((v, j) => prev[k][j] + (v - prev[k][j]) * t) as [number, number, number]);
};

const RES = { w: 270, h: 480 };

const FluidCanvas: React.FC<{ readonly stops: PaletteStop[]; readonly speed: number; readonly pulse: number }> = ({ stops, speed, pulse }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const ref = useRef<HTMLCanvasElement>(null);
  const glRef = useRef<GL | null | undefined>(undefined);
  const colors = colorsAt(stops, frame);

  useLayoutEffect(() => {
    if (!ref.current) {
      return;
    }
    if (glRef.current === undefined) {
      glRef.current = setup(ref.current);
    }
    const ctx = glRef.current;
    if (!ctx) {
      return;
    }
    const { gl, prog } = ctx;
    gl.viewport(0, 0, RES.w, RES.h);
    gl.uniform2f(gl.getUniformLocation(prog, "uRes"), RES.w, RES.h);
    gl.uniform1f(gl.getUniformLocation(prog, "uTime"), (frame / fps) * speed);
    gl.uniform1f(gl.getUniformLocation(prog, "uPulse"), pulse);
    ["uC0", "uC1", "uC2", "uC3", "uC4"].forEach((name, k) => gl.uniform3fv(gl.getUniformLocation(prog, name), colors[k]));
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.finish();
  });

  // Sem WebGL: blobs grandes com degradê radial (mesmas cores).
  const fallback = glRef.current === null;
  return (
    <AbsoluteFill>
      <canvas ref={ref} width={RES.w} height={RES.h} style={{ width: "100%", height: "100%", display: fallback ? "none" : "block" }} />
      {fallback ? <BlobFallback colors={colors} t={(frame / fps) * speed} /> : null}
    </AbsoluteFill>
  );
};

const BlobFallback: React.FC<{ readonly colors: [number, number, number][]; readonly t: number }> = ({ colors, t }) => {
  const css = (c: [number, number, number], a: number) => `rgba(${c.map((v) => Math.round(v * 255)).join(",")},${a})`;
  const blobs = [0, 1, 2].map((k) => ({ x: 50 + Math.sin(t * 0.8 + k * 2) * 30, y: 30 + k * 25 + Math.cos(t * 0.6 + k) * 15 }));
  return (
    <AbsoluteFill
      style={{
        backgroundColor: css(colors[4], 1),
        background: blobs.map((b, k) => `radial-gradient(circle at ${b.x}% ${b.y}%, ${css(colors[k], 0.95)} 0%, ${css(colors[k], 0)} 55%)`).join(", "),
      }}
    />
  );
};

// Formas geométricas flutuando devagar no fundo (anéis, cruzes, pontos).
const FloatingShapes: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  return (
    <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
      {Array.from({ length: 9 }).map((_, i) => {
        const r = (k: string) => random(`bgshape-${i}-${k}`);
        const x = r("x") * 1080 + Math.sin(t * 0.25 + i) * 40;
        const y = ((r("y") * 1920 - t * (14 + r("v") * 18)) % 2100 + 2100) % 2100 - 90;
        const size = 26 + r("s") * 60;
        const kind = Math.floor(r("k") * 3);
        const rot = t * (20 + r("r") * 30) * (i % 2 ? 1 : -1);
        const col = withAlpha("#ffffff", 0.16 + r("o") * 0.12);
        return (
          <g key={i} transform={`translate(${x} ${y}) rotate(${rot})`} stroke={col} strokeWidth={3} fill="none">
            {kind === 0 ? <circle r={size / 2} /> : kind === 1 ? <path d={`M${-size / 2} 0 H${size / 2} M0 ${-size / 2} V${size / 2}`} /> : <rect x={-size / 2} y={-size / 2} width={size} height={size} rx={size * 0.2} />}
          </g>
        );
      })}
    </svg>
  );
};

type Props = {
  readonly stops: PaletteStop[];
  readonly speed?: number;
  readonly video?: string;
  // Frames de impacto (o fundo pulsa).
  readonly impacts?: number[];
};

export const FluidBackground: React.FC<Props> = ({ stops, speed = 0.3, video, impacts = [] }) => {
  const frame = useCurrentFrame();
  const pulse = impacts.reduce((acc, f0) => (frame >= f0 ? acc + Math.exp(-(frame - f0) / 6) : acc), 0);
  return (
    <AbsoluteFill style={{ backgroundColor: stops[0]?.colors[4] ?? "#000" }}>
      {video ? (
        <Video src={staticFile(video)} loop muted objectFit="cover" style={{ width: "100%", height: "100%" }} />
      ) : (
        <FluidCanvas stops={stops} speed={speed} pulse={Math.min(1, pulse)} />
      )}
      <FloatingShapes />
      <Img src={staticFile("textures/grain.png")} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.16 }} />
    </AbsoluteFill>
  );
};

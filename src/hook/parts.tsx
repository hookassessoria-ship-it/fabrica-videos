import type { Caption } from "@remotion/captions";
import React from "react";
import { AbsoluteFill, Easing, Img, interpolate, random, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { toBlocks } from "../components/collage/CollageCaptions";

// Peças da Hook Company: cinematográfico + minimalista. Fundo quase preto, um acento
// vermelho só pro destaque e a chamada, tipografia pesada, pouco elemento por tela.
// Zonas livres de texto do Meta (Reels/Stories): topo 270, base 670, laterais 65.

export const C = {
  bg: "#0A0A0B",
  panel: "#141416",
  raised: "#1C1C1F",
  edge: "#2A2A2E",
  text: "#F4F4F2",
  muted: "#8C8C92",
  red: "#E8323A",
  navy: "#0D1B3E",
};
export const F = { sans: '"Inter", system-ui, sans-serif', mono: '"Space Mono", ui-monospace, monospace' };
export const SAFE = { top: 270, bottom: 1250, left: 65, right: 1015 };
// Grade vertical das telas: rótulo, título, visual e legenda.
export const Y = { tag: 290, title: 360, visual: 620, visualEnd: 1070, caption: 1105 };

export const ease = Easing.bezier(0.22, 1, 0.36, 1);
export const p01 = (t: number, a: number, d: number) => interpolate(t, [a, a + d], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });

// Fundo: preto com luz suave vinda de cima, azul-marinho bem fraco embaixo, vinheta e grão.
export const Backdrop: React.FC<{ readonly light?: number }> = ({ light = 1 }) => {
  const frame = useCurrentFrame();
  const drift = Math.sin(frame / 90) * 40;
  return (
    <AbsoluteFill style={{ backgroundColor: C.bg }}>
      <AbsoluteFill style={{ background: `radial-gradient(ellipse 900px 700px at ${540 + drift}px 120px, rgba(255,255,255,${0.07 * light}), transparent 70%)` }} />
      <AbsoluteFill style={{ background: `radial-gradient(ellipse 1100px 800px at 540px 1900px, rgba(13,27,62,0.55), transparent 70%)` }} />
      <AbsoluteFill style={{ boxShadow: "inset 0 0 260px 80px rgba(0,0,0,0.75)" }} />
      <AbsoluteFill style={{ opacity: 0.07, mixBlendMode: "screen" }}>
        <Img src={staticFile("textures/grain.png")} style={{ width: 1400, height: 2400, objectFit: "cover", translate: `${-random(`g${frame}`) * 300}px ${-random(`h${frame}`) * 400}px` }} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// Título: linhas sobem por trás de uma máscara, uma depois da outra. Palavras em `accent`
// ficam vermelhas. `t` = segundos desde a entrada.
export const Title: React.FC<{ readonly lines: string[]; readonly t: number; readonly y?: number; readonly size?: number; readonly accent?: string[]; readonly align?: "left" | "center"; readonly color?: string; readonly weight?: number }> = ({
  lines,
  t,
  y = Y.title,
  size = 92,
  accent = [],
  align = "left",
  color = C.text,
  weight = 800,
}) => (
  <div style={{ position: "absolute", top: y, left: SAFE.left + 10, right: 1080 - SAFE.right + 10, textAlign: align }}>
    {lines.map((line, i) => {
      const p = p01(t, i * 0.07, 0.42);
      return (
        <div key={i} style={{ overflow: "hidden", paddingBottom: size * 0.08 }}>
          <div
            style={{
              fontFamily: F.sans,
              fontWeight: weight,
              fontSize: size,
              lineHeight: 1.02,
              letterSpacing: "-0.035em",
              color,
              translate: `0 ${(1 - p) * 110}%`,
            }}
          >
            {line.split(" ").map((w, k) => (
              <span key={k} style={{ color: accent.includes(w.replace(/[.,?!:]/g, "")) ? C.red : undefined }}>
                {w}{" "}
              </span>
            ))}
          </div>
        </div>
      );
    })}
  </div>
);

// Rótulo mono pequeno (kicker), ex.: "01 / 05" ou "PROJETO CONCEITUAL · HOOK COMPANY".
export const Label: React.FC<{ readonly text: string; readonly t: number; readonly y?: number; readonly x?: number; readonly dot?: boolean; readonly color?: string; readonly size?: number }> = ({
  text,
  t,
  y = Y.tag,
  x = SAFE.left + 10,
  dot = false,
  color = C.muted,
  size = 24,
}) => (
  <div style={{ position: "absolute", top: y, left: x, display: "flex", alignItems: "center", gap: 14, opacity: p01(t, 0.05, 0.3), fontFamily: F.mono, fontSize: size, letterSpacing: "0.18em", color, textTransform: "uppercase" }}>
    {dot ? <span style={{ width: 10, height: 10, borderRadius: 99, backgroundColor: C.red }} /> : null}
    {text}
  </div>
);

export const ConceptTag: React.FC<{ readonly t: number }> = ({ t }) => <Label text="Projeto conceitual · Hook Company" t={t} dot />;

// Painel com cantos arredondados (fragmento de tela, sem interface de app nenhum).
export const Panel: React.FC<{ readonly t: number; readonly children: React.ReactNode; readonly top?: number; readonly height?: number; readonly width?: number; readonly delay?: number }> = ({
  t,
  children,
  top = Y.visual,
  height = Y.visualEnd - Y.visual,
  width = 900,
  delay = 0.08,
}) => {
  const p = p01(t, delay, 0.5);
  return (
    <div
      style={{
        position: "absolute",
        top,
        left: (1080 - width) / 2,
        width,
        height,
        borderRadius: 34,
        overflow: "hidden",
        backgroundColor: C.panel,
        border: `1.5px solid ${C.edge}`,
        boxShadow: "0 40px 120px rgba(0,0,0,0.6)",
        opacity: p,
        translate: `0 ${(1 - p) * 40}px`,
        scale: 0.97 + 0.03 * p,
      }}
    >
      {children}
    </div>
  );
};

// Legenda queimada: blocos de até 2 linhas na faixa de baixo da área livre, palavra falada
// em branco e o resto em cinza claro.
export const Captions: React.FC<{ readonly captions: Caption[] }> = ({ captions }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const ms = (frame / fps) * 1000;
  const blocks = React.useMemo(() => toBlocks(captions, { max: 6, maxChars: 30 }), [captions]);
  const b = blocks.find((x, i) => ms >= x.startMs - 60 && ms < (blocks[i + 1]?.startMs ?? x.endMs + 400) - 60);
  if (!b) {
    return null;
  }
  return (
    <div style={{ position: "absolute", top: Y.caption, left: SAFE.left, right: 1080 - SAFE.right, display: "flex", justifyContent: "center" }}>
      <div style={{ maxWidth: 820, textAlign: "center", fontFamily: F.sans, fontWeight: 700, fontSize: 46, lineHeight: 1.22, padding: "10px 22px", borderRadius: 14, backgroundColor: "rgba(10,10,11,0.72)" }}>
        {b.words.map((w, i) => (
          <span key={i} style={{ color: ms >= w.startMs ? C.text : "rgba(244,244,242,0.5)" }}>
            {w.text}
          </span>
        ))}
      </div>
    </div>
  );
};

// Logo provisório (tipográfico) até chegar o arquivo da marca: "HOOK" pesado + "COMPANY" espaçado.
export const Logo: React.FC<{ readonly size?: number; readonly src?: string | null }> = ({ size = 150, src }) =>
  src ? (
    <Img src={staticFile(src)} style={{ height: size * 1.3, objectFit: "contain" }} />
  ) : (
    <div style={{ textAlign: "center", color: C.text }}>
      <div style={{ fontFamily: F.sans, fontWeight: 900, fontSize: size, letterSpacing: "-0.04em", lineHeight: 0.9 }}>HOOK</div>
      <div style={{ fontFamily: F.mono, fontSize: size * 0.17, letterSpacing: "0.62em", marginTop: size * 0.12, paddingLeft: "0.62em", color: C.muted }}>COMPANY</div>
    </div>
  );

// Tela final de todos os Reels.
export const EndCard: React.FC<{ readonly t: number; readonly logo?: string | null }> = ({ t, logo }) => {
  const a = p01(t, 0, 0.5);
  const b = p01(t, 0.25, 0.5);
  const c = p01(t, 0.45, 0.5);
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", top: 330, left: 0, right: 0, display: "flex", justifyContent: "center", opacity: a, scale: 0.96 + 0.04 * a }}>
        <Logo size={150} src={logo} />
      </div>
      <div style={{ position: "absolute", top: 640, left: SAFE.left, right: 1080 - SAFE.right, textAlign: "center", opacity: b, translate: `0 ${(1 - b) * 24}px` }}>
        <div style={{ fontFamily: F.sans, fontWeight: 800, fontSize: 78, letterSpacing: "-0.03em", color: C.text, lineHeight: 1.05 }}>Diagnóstico gratuito</div>
        <div style={{ fontFamily: F.sans, fontWeight: 500, fontSize: 36, color: C.muted, marginTop: 14 }}>da sua presença digital · em até 48 h</div>
      </div>
      <div style={{ position: "absolute", top: 860, left: 0, right: 0, display: "flex", justifyContent: "center", opacity: c, translate: `0 ${(1 - c) * 24}px` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18, padding: "26px 44px", borderRadius: 999, backgroundColor: C.red, color: "#fff", fontFamily: F.sans, fontWeight: 800, fontSize: 44, boxShadow: "0 18px 60px rgba(232,50,58,0.35)" }}>
          Chama no WhatsApp · 62 98495-3890
        </div>
      </div>
      <div style={{ position: "absolute", top: 1010, left: 0, right: 0, textAlign: "center", opacity: c, fontFamily: F.mono, fontSize: 34, letterSpacing: "0.08em", color: C.text }}>@hookcompany.go</div>
    </AbsoluteFill>
  );
};

import React from "react";
import { OffthreadVideo, random, Sequence, staticFile } from "remotion";
import type { HookScene } from "./HookReel";
import { C, ConceptTag, F, Label, p01, Panel, SAFE, Title, Y } from "./parts";

export type ViewProps = {
  t: number;
  dur: number;
  scene: HookScene;
  // Segundo (local da cena) em que a palavra é falada.
  at: (word: string, nth?: number, fallback?: number) => number;
  niche: "brand" | "gastro";
};

// ---------------------------------------------------------------- objetos fictícios
// Produto genérico desenhado em CSS (sem foto de banco, sem marca): um vaso de cerâmica
// pra "marca" e um prato pra gastronomia, com luz de estúdio quando "pro".
const Product: React.FC<{ readonly niche: "brand" | "gastro"; readonly pro: boolean; readonly seed: number; readonly size?: number }> = ({ niche, pro, seed, size = 1 }) => {
  const hue = Math.floor(random(`h${seed}`) * 360);
  const light = pro ? "radial-gradient(circle at 35% 30%, #5a4a3e, #2a211c 55%, #120e0c)" : `hsl(${hue},70%,60%)`;
  if (niche === "gastro") {
    return (
      <div style={{ width: 150 * size, height: 150 * size, borderRadius: 999, background: pro ? "radial-gradient(circle at 40% 35%, #f1ece4, #b9b2a8 70%)" : "#e9e9e9", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: pro ? "0 30px 40px rgba(0,0,0,0.6)" : "none" }}>
        <div style={{ width: 96 * size, height: 96 * size, borderRadius: 999, background: pro ? "radial-gradient(circle at 40% 35%, #d9883b, #8a3e1c 70%)" : `hsl(${hue},55%,55%)` }} />
      </div>
    );
  }
  return (
    <div style={{ width: 92 * size, height: 150 * size, borderRadius: `${46 * size}px ${46 * size}px ${30 * size}px ${30 * size}px`, background: light, boxShadow: pro ? "0 30px 40px rgba(0,0,0,0.6), inset -14px -10px 30px rgba(0,0,0,0.5)" : "none" }} />
  );
};

const AMATEUR_FONTS = ['"Abril Fatface", serif', '"Caveat", cursive', '"Anton", sans-serif'];
const AMATEUR_WORDS = ["PROMO!!", "novidade", "CONFIRA", "OFERTA", "chegou!", "VEM"];

// Quadrado do feed: amador (cor gritando, torto, fonte diferente em cada um) ou pro
// (mesma luz, mesmo fundo, mesmo rótulo discreto).
const Tile: React.FC<{ readonly i: number; readonly pro: boolean; readonly niche: "brand" | "gastro"; readonly w: number; readonly h: number; readonly mark?: number }> = ({ i, pro, niche, w, h, mark = 0 }) => {
  const hue = Math.floor(random(`t${i}`) * 360);
  const rot = pro ? 0 : (random(`r${i}`) - 0.5) * 7;
  return (
    <div
      style={{
        width: w,
        height: h,
        borderRadius: 10,
        position: "relative",
        overflow: "hidden",
        rotate: `${rot}deg`,
        background: pro ? "radial-gradient(ellipse at 50% 20%, #2a2a2e, #141416 70%)" : `linear-gradient(${Math.floor(random(`a${i}`) * 360)}deg, hsl(${hue},80%,55%), hsl(${(hue + 120) % 360},70%,60%))`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        outline: mark > 0 ? `${3 * mark}px solid rgba(232,50,58,${mark})` : "none",
      }}
    >
      <Product niche={niche} pro={pro} seed={i} size={pro ? 0.85 : 0.6 + random(`s${i}`) * 0.5} />
      {pro ? (
        <div style={{ position: "absolute", bottom: 10, left: 12, fontFamily: F.mono, fontSize: 15, letterSpacing: "0.14em", color: C.muted }}>{String(i + 1).padStart(2, "0")}</div>
      ) : (
        <div style={{ position: "absolute", top: 8 + random(`y${i}`) * 40, left: 8, fontFamily: AMATEUR_FONTS[i % 3], fontSize: 30, color: i % 2 ? "#ffef3a" : "#fff", textShadow: "2px 2px 0 #000" }}>{AMATEUR_WORDS[i % 6]}</div>
      )}
    </div>
  );
};

// Perfil fictício (sem interface de app): cabeçalho com nome e bio + grade 3×2.
export const Profile: React.FC<{ readonly t: number; readonly niche: "brand" | "gastro"; readonly pro?: number; readonly highlight?: "grid" | "bio" | "none"; readonly delay?: number; readonly top?: number }> = ({ t, niche, pro = 0, highlight = "none", delay, top }) => {
  const name = niche === "gastro" ? "Seu restaurante" : "Sua marca";
  const bioA = niche === "gastro" ? "Bem-vindos!! Comida boa e preço justo, venham conferir!!!" : "Bem-vindos!! Qualidade, amor e dedicação desde sempre...";
  const bioB = niche === "gastro" ? "Massa de fermentação natural e forno a lenha." : "Cerâmica feita à mão, em pequenos lotes.";
  const cta = niche === "gastro" ? "Peça pelo WhatsApp →" : "Encomendas pelo WhatsApp →";
  const isPro = pro > 0.5;
  const pulse = 0.5 + 0.5 * Math.sin(t * 6);
  return (
    <Panel t={t} delay={delay} top={top} height={top ? Y.visualEnd - top : undefined}>
      <div style={{ display: "flex", gap: 28, padding: "30px 34px 22px", alignItems: "center" }}>
        <div style={{ width: 104, height: 104, borderRadius: 999, flexShrink: 0, background: isPro ? "radial-gradient(circle at 35% 30%, #3a3a40, #141416)" : "#4a4a4a", border: `2px solid ${isPro ? C.text : "#666"}` }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: F.sans, fontWeight: 800, fontSize: 36, color: C.text, letterSpacing: "-0.02em" }}>{name}</div>
          <div style={{ position: "relative", marginTop: 8, fontFamily: F.sans, fontSize: 26, lineHeight: 1.3, color: isPro ? C.text : "#b5b5b5" }}>
            {isPro ? bioB : bioA}
            {highlight === "bio" ? <div style={{ position: "absolute", left: 0, top: "48%", height: 5, width: `${p01(t, 0.6, 0.4) * 100}%`, backgroundColor: C.red }} /> : null}
          </div>
          {isPro ? <div style={{ marginTop: 10, fontFamily: F.sans, fontWeight: 700, fontSize: 26, color: C.red }}>{cta}</div> : null}
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: isPro ? 8 : 14, padding: "6px 34px" }}>
        {Array.from({ length: 6 }, (_, i) => (
          <Tile key={i} i={i} pro={isPro} niche={niche} w={266} h={isPro ? 120 : 112} mark={highlight === "grid" && !isPro && i % 2 === 0 ? pulse : 0} />
        ))}
      </div>
    </Panel>
  );
};

// ---------------------------------------------------------------- Reel 4 · diagnóstico

// Título de 3–4 linhas: o perfil desce pra baixo do título (e encolhe a grade).
export const titleBottom = (lines: number, size: number) => Y.title + lines * size * 1.1 + 36;

const Hook4: React.FC<ViewProps> = ({ t, scene, niche }) => {
  const n = scene.text?.length ?? 2;
  const size = n > 3 ? 76 : 88;
  return (
    <>
      <Title lines={scene.text ?? []} t={t} size={size} accent={scene.accent} />
      <Profile t={t} niche={niche} delay={0.35} top={Math.max(Y.visual, titleBottom(n, size))} />
    </>
  );
};

// Os cinco itens do checklist, cada um com um visual rápido do problema.
const Item4: React.FC<ViewProps> = ({ t, scene, niche }) => {
  const v = scene.variant;
  const box = (children: React.ReactNode) => <Panel t={t} delay={0.12}>{children}</Panel>;
  let visual: React.ReactNode = null;
  if (v === "fotos") {
    visual = <Profile t={t} niche={niche} highlight="grid" delay={0.1} />;
  } else if (v === "bio") {
    visual = <Profile t={t} niche={niche} highlight="bio" delay={0.1} />;
  } else if (v === "oferta") {
    visual = box(
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 70, height: "100%" }}>
        <Tile i={3} pro={false} niche={niche} w={300} h={300} />
        <div style={{ fontFamily: F.sans, color: C.muted }}>
          <div style={{ fontSize: 30, letterSpacing: "0.12em", fontFamily: F.mono }}>OFERTA</div>
          <div style={{ fontSize: 200, fontWeight: 900, color: C.text, lineHeight: 1, opacity: p01(t, 0.4, 0.3) }}>?</div>
        </div>
      </div>,
    );
  } else if (v === "contato") {
    const tap = (t * 1.4) % 1;
    visual = box(
      <div style={{ position: "relative", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ padding: "26px 60px", borderRadius: 999, border: "3px dashed #4a4a50", color: "#5c5c62", fontFamily: F.sans, fontWeight: 700, fontSize: 40 }}>Contato</div>
        <div style={{ position: "absolute", left: 560, top: 250, width: 40, height: 40, borderRadius: 99, border: `3px solid ${C.text}`, opacity: 1 - tap, scale: 1 + tap * 1.6 }} />
        <div style={{ position: "absolute", left: 572, top: 262, width: 16, height: 16, borderRadius: 99, backgroundColor: C.text }} />
        <div style={{ position: "absolute", bottom: 40, fontFamily: F.mono, fontSize: 24, letterSpacing: "0.14em", color: C.muted }}>NADA ACONTECE</div>
      </div>,
    );
  } else if (v === "video") {
    visual = box(
      <div style={{ display: "flex", gap: 24, alignItems: "center", justifyContent: "center", height: "100%" }}>
        {[0, 1, 2].map((k) => (
          <div key={k} style={{ width: 230, height: 380, borderRadius: 14, background: `hsl(${k * 110 + 20},70%,${40 + k * 8}%)`, display: "flex", alignItems: "center", justifyContent: "center", rotate: `${(k - 1) * 4}deg`, opacity: p01(t, 0.1 + k * 0.12, 0.3) }}>
            <div style={{ fontFamily: AMATEUR_FONTS[k], fontSize: 56, color: k === 1 ? "#ffef3a" : "#fff", textShadow: "3px 3px 0 #000", textAlign: "center" }}>{["PROMO!", "olha só", "NOVO"][k]}</div>
          </div>
        ))}
      </div>,
    );
  }
  return (
    <>
      <Label text={scene.label ?? ""} t={t} color={C.red} />
      <Title lines={scene.text ?? []} t={t} size={88} accent={scene.accent} />
      {visual}
    </>
  );
};

const Sum4: React.FC<ViewProps> = ({ t, scene }) => {
  const items = ["Foto sem padrão", "Bio vaga", "Sem oferta clara", "Sem caminho pra contato", "Vídeo sem identidade"];
  return (
    <>
      <Title lines={scene.text ?? []} t={t} size={92} accent={scene.accent} />
      <div style={{ position: "absolute", top: Y.visual + 10, left: SAFE.left + 10, right: 1080 - SAFE.right }}>
        {items.map((s, i) => {
          const p = p01(t, 0.15 + i * 0.12, 0.35);
          return (
            <div key={s} style={{ display: "flex", alignItems: "center", gap: 26, padding: "16px 0", borderBottom: `1px solid ${C.edge}`, opacity: p, translate: `${(1 - p) * -30}px 0` }}>
              <span style={{ fontFamily: F.mono, fontSize: 26, color: C.red, width: 60 }}>{String(i + 1).padStart(2, "0")}</span>
              <span style={{ fontFamily: F.sans, fontWeight: 600, fontSize: 40, color: C.text }}>{s}</span>
            </div>
          );
        })}
      </div>
    </>
  );
};

const Fix4: React.FC<ViewProps> = ({ t, scene, niche, at }) => {
  const p = p01(t, Math.min(0.15, at("corrigir", 1, 0.15)), 0.45);
  return (
    <>
      <ConceptTag t={t} />
      <Title lines={scene.text ?? []} t={t} size={92} accent={scene.accent} />
      <Profile t={t} niche={niche} pro={p} delay={0} />
    </>
  );
};

const Offer4: React.FC<ViewProps> = ({ t, scene }) => {
  const rows = ["O que derruba a percepção", "Por que isso acontece", "Como corrigir"];
  return (
    <>
      <Title lines={scene.text ?? []} t={t} size={92} accent={scene.accent} />
      <div style={{ position: "absolute", top: Y.visual + 20, left: SAFE.left + 10, right: 1080 - SAFE.right }}>
        {rows.map((s, i) => {
          const p = p01(t, 0.3 + i * 0.18, 0.4);
          return (
            <div key={s} style={{ display: "flex", alignItems: "center", gap: 28, marginBottom: 22, padding: "26px 30px", borderRadius: 20, backgroundColor: C.panel, border: `1.5px solid ${C.edge}`, opacity: p, translate: `0 ${(1 - p) * 20}px` }}>
              <span style={{ fontFamily: F.sans, fontWeight: 900, fontSize: 44, color: C.red, width: 70 }}>{i + 1}</span>
              <span style={{ fontFamily: F.sans, fontWeight: 600, fontSize: 38, color: C.text }}>{s}</span>
            </div>
          );
        })}
      </div>
    </>
  );
};


// ---------------------------------------------------------------- Reel 2 · site

// Celular genérico (moldura fina, sem interface de app nem barra de navegador) tocando a
// gravação do site-conceito. `from` = segundo da gravação no início da cena.
const Phone: React.FC<{ readonly t: number; readonly src?: string; readonly x: number; readonly y: number; readonly w: number; readonly from?: number; readonly glow?: boolean; readonly children?: React.ReactNode }> = ({ t, src, x, y, w, from = 0, glow = false, children }) => {
  const h = (w * 16) / 9;
  const p = p01(t, 0, 0.45);
  return (
    <div style={{ position: "absolute", left: x, top: y, width: w, height: h, borderRadius: w * 0.09, border: `${Math.max(6, w * 0.022)}px solid #1d1d20`, outline: `1.5px solid ${C.edge}`, overflow: "hidden", backgroundColor: "#000", boxShadow: glow ? "0 0 120px rgba(232,50,58,0.18), 0 40px 120px rgba(0,0,0,0.7)" : "0 40px 120px rgba(0,0,0,0.7)", opacity: p, translate: `0 ${(1 - p) * 40}px` }}>
      {src ? (
        <Sequence from={-Math.round(from * 30)} layout="none">
          <OffthreadVideo src={staticFile(src)} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </Sequence>
      ) : null}
      {children}
    </div>
  );
};

// Cardápio digital ruim (gancho D): lista miúda, sem foto, sem botão de pedido.
const BadMenu: React.FC = () => (
  <div style={{ background: "#fff", width: "100%", height: "100%", padding: 14, fontFamily: "Arial, sans-serif", color: "#444" }}>
    <div style={{ fontFamily: '"Abril Fatface", serif', fontSize: 22, color: "#a00", textAlign: "center" }}>CARDÁPIO</div>
    {Array.from({ length: 22 }, (_, i) => (
      <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 9, borderBottom: "1px dotted #ccc", padding: "3px 0" }}>
        <span>Item {i + 1} ............ ver descrição</span>
        <span>consulte</span>
      </div>
    ))}
  </div>
);

// Anotação vermelha que entra na palavra falada (coluna à direita do celular).
const Note: React.FC<{ readonly t: number; readonly at: number; readonly y: number; readonly text: string; readonly good?: boolean }> = ({ t, at, y, text, good }) => {
  const p = p01(t, at - 0.1, 0.35);
  return (
    <div style={{ position: "absolute", left: 610, top: y, width: 400, opacity: p, translate: `${(1 - p) * 30}px 0`, display: "flex", alignItems: "center", gap: 16 }}>
      <span style={{ width: 34, height: 3, backgroundColor: good ? C.text : C.red }} />
      <span style={{ fontFamily: F.sans, fontWeight: 700, fontSize: 36, color: good ? C.text : C.text, lineHeight: 1.15 }}>{text}</span>
    </div>
  );
};

const Hook2: React.FC<ViewProps> = ({ t, scene, niche }) => {
  const n = scene.text?.length ?? 2;
  const size = n > 3 ? 76 : 86;
  const top = titleBottom(n, size);
  const w = Math.min(300, ((Y.visualEnd - top) * 9) / 16);
  return (
    <>
      <Title lines={scene.text ?? []} t={t} size={size} accent={scene.accent} />
      <Phone t={t - 0.25} x={(1080 - w) / 2} y={top} w={w} src={niche === "gastro" ? undefined : "clips/hook/site-ruim.mp4"} from={0.6}>
        {niche === "gastro" ? <BadMenu /> : null}
      </Phone>
    </>
  );
};

const Bad2: React.FC<ViewProps> = ({ t, at }) => (
  <>
    <ConceptTag t={t} />
    <Phone t={t} x={95} y={340} w={430} src="clips/hook/site-ruim.mp4" />
    <Note t={t} at={at("devagar", 1, 0.3)} y={420} text="Carrega devagar" />
    <Note t={t} at={at("pop-up", 1, 1.0)} y={560} text="Pop-up na frente" />
    <Note t={t} at={at("pequeno,", 1, 1.6)} y={700} text="Texto pequeno" />
    <Note t={t} at={at("escondido.", 1, 2.2)} y={840} text="Botão escondido" />
  </>
);

const Turn2: React.FC<ViewProps> = ({ t, scene }) => <Title lines={scene.text ?? []} t={t} size={110} accent={scene.accent} y={560} />;

const Good2: React.FC<ViewProps> = ({ t, at }) => (
  <>
    <ConceptTag t={t} />
    <Phone t={t} x={95} y={340} w={430} src="clips/hook/site-premium.mp4" glow />
    <Note t={t} at={at("imagem", 1, 0.3)} y={420} text="Imagem que mostra o produto" good />
    <Note t={t} at={at("frase", 1, 1.4)} y={600} text="Frase que diz o que você faz" good />
    <Note t={t} at={at("botão", 1, 2.6)} y={780} text="Botão claro pra falar com você" good />
  </>
);

const Vitrine2: React.FC<ViewProps> = ({ t, scene }) => (
  <>
    <Title lines={scene.text ?? []} t={t} size={96} accent={scene.accent} />
    <Phone t={t} x={(1080 - 260) / 2} y={titleBottom(scene.text?.length ?? 2, 96)} w={260} src="clips/hook/site-premium.mp4" from={6.4} glow />
  </>
);

// ---------------------------------------------------------------- Reel 3 · anúncio

// Anúncio fictício 9:16 (pizzaria sem nome real): bonito mas mudo, e as três camadas que
// fazem ele vender — gancho, oferta, chamada pra ação. `layers` = quantas já entraram (0–3).
const Ad: React.FC<{ readonly t: number; readonly x: number; readonly y: number; readonly w: number; readonly layers: number[]; readonly mute?: boolean }> = ({ t, x, y, w, layers, mute = false }) => {
  const h = (w * 16) / 9;
  const k = w / 400;
  const p = p01(t, 0, 0.4);
  const [l1, l2, l3] = layers;
  return (
    <div style={{ position: "absolute", left: x, top: y, width: w, height: h, borderRadius: 22 * k, overflow: "hidden", border: `1.5px solid ${C.edge}`, background: "radial-gradient(ellipse at 50% 55%, #3a2418, #120c09 70%)", opacity: p, boxShadow: "0 40px 100px rgba(0,0,0,0.6)" }}>
      <div style={{ position: "absolute", left: "50%", top: "47%", translate: "-50% -50%", width: 250 * k, height: 250 * k, borderRadius: 999, background: "radial-gradient(circle at 40% 35%, #f1ece4, #b9b2a8 70%)", boxShadow: `0 ${30 * k}px ${50 * k}px rgba(0,0,0,0.7)`, display: "flex", alignItems: "center", justifyContent: "center", rotate: `${t * 6}deg` }}>
        <div style={{ width: 196 * k, height: 196 * k, borderRadius: 999, background: "radial-gradient(circle at 40% 35%, #e0963f, #9a3b18 72%)" }} />
      </div>
      {mute ? <div style={{ position: "absolute", left: 20 * k, top: 22 * k, fontFamily: '"Abril Fatface", serif', fontSize: 30 * k, color: "#fff" }}>Sabor que encanta</div> : null}
      <div style={{ position: "absolute", left: 22 * k, right: 22 * k, top: 26 * k, opacity: l1, translate: `0 ${(1 - l1) * -20}px` }}>
        <div style={{ fontFamily: F.sans, fontWeight: 900, fontSize: 46 * k, lineHeight: 1, letterSpacing: "-0.03em", color: "#fff" }}>Fome às dez da noite?</div>
      </div>
      <div style={{ position: "absolute", left: 22 * k, right: 22 * k, bottom: 120 * k, opacity: l2, translate: `0 ${(1 - l2) * 20}px`, fontFamily: F.sans, fontWeight: 600, fontSize: 26 * k, color: "#fff", lineHeight: 1.25 }}>
        Pizza de fermentação natural, direto do forno a lenha.
      </div>
      <div style={{ position: "absolute", left: 22 * k, right: 22 * k, bottom: 30 * k, height: 66 * k, borderRadius: 999, backgroundColor: C.red, opacity: l3, scale: 0.9 + 0.1 * l3, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: F.sans, fontWeight: 800, fontSize: 26 * k, color: "#fff" }}>
        Peça pelo WhatsApp →
      </div>
    </div>
  );
};

const Hook3: React.FC<ViewProps> = ({ t, scene }) => {
  const n = scene.text?.length ?? 2;
  const size = n > 3 ? 76 : 86;
  const top = titleBottom(n, size);
  const w = Math.min(320, ((Y.visualEnd - top) * 9) / 16);
  return (
    <>
      <Title lines={scene.text ?? []} t={t} size={size} accent={scene.accent} />
      <Ad t={t - 0.25} x={(1080 - w) / 2} y={top} w={w} layers={[0, 0, 0]} mute />
    </>
  );
};

const Weak3: React.FC<ViewProps> = ({ t, at }) => (
  <>
    <ConceptTag t={t} />
    <Ad t={t} x={95} y={340} w={430} layers={[0, 0, 0]} mute />
    <Note t={t} at={at("pra", 1, 1.0)} y={430} text="Pra quem é?" />
    <Note t={t} at={at("ganha,", 1, 1.6)} y={580} text="O que eu ganho?" />
    <Note t={t} at={at("agora.", 1, 2.2)} y={730} text="E agora?" />
  </>
);

// Camadas: cada cena acende a sua e mantém as anteriores.
const Layer3: React.FC<ViewProps> = ({ t, scene }) => {
  const n = Number(scene.variant ?? 1);
  const on = (i: number) => (i < n ? 1 : i === n ? p01(t, 0.35, 0.4) : 0);
  return (
    <>
      <Label text={scene.label ?? ""} t={t} color={C.red} />
      <Ad t={1} x={95} y={340} w={430} layers={[on(1), on(2), on(3)]} />
      <div style={{ position: "absolute", left: 600, top: 420, width: 410 }}>
        {(scene.text ?? []).map((line, i) => (
          <div key={i} style={{ fontFamily: F.sans, fontWeight: 800, fontSize: 52, lineHeight: 1.06, letterSpacing: "-0.03em", color: i === 0 ? C.red : C.text, opacity: p01(t, 0.1 + i * 0.08, 0.35), translate: `${(1 - p01(t, 0.1 + i * 0.08, 0.35)) * 20}px 0` }}>
            {line}
          </div>
        ))}
      </div>
    </>
  );
};

const Compare3: React.FC<ViewProps> = ({ t, scene }) => (
  <>
    <Title lines={scene.text ?? []} t={t} size={80} accent={scene.accent} />
    <Ad t={t} x={140} y={600} w={260} layers={[0, 0, 0]} mute />
    <Ad t={t - 0.15} x={680} y={600} w={260} layers={[1, 1, 1]} />
    <div style={{ position: "absolute", top: 1072, left: 140, width: 260, textAlign: "center", fontFamily: F.mono, fontSize: 22, color: C.muted, opacity: p01(t, 0.4, 0.3) }}>BONITO</div>
    <div style={{ position: "absolute", top: 1072, left: 680, width: 260, textAlign: "center", fontFamily: F.mono, fontSize: 22, color: C.red, opacity: p01(t, 0.5, 0.3) }}>VENDE</div>
  </>
);

const Statement: React.FC<ViewProps> = ({ t, scene }) => <Title lines={scene.text ?? []} t={t} size={100} accent={scene.accent} y={520} />;

// ---------------------------------------------------------------- Reel 5 · processo

const Hook5: React.FC<ViewProps> = ({ t, scene }) => (
  <>
    <Title lines={scene.text ?? []} t={t} size={(scene.text?.length ?? 2) > 3 ? 84 : 100} accent={scene.accent} y={420} />
    <div style={{ position: "absolute", top: 1010, left: SAFE.left + 10, height: 3, width: `${p01(t, 0.2, 1.2) * 300}px`, backgroundColor: C.red }} />
  </>
);

const STEPS = [
  { k: "01", t: "Conversa", d: "o que você vende e pra quem", w: "conversa" },
  { k: "02", t: "Conceito", d: "a ideia antes de produzir", w: "conceito," },
  { k: "03", t: "Produção", d: "filmagem, design ou código", w: "produção." },
  { k: "04", t: "Entrega", d: "pronta pra usar", w: "entrega," },
];

const Steps5: React.FC<ViewProps> = ({ t, at }) => (
  <>
    <Label text="Como funciona" t={t} />
    <div style={{ position: "absolute", top: 360, left: SAFE.left + 10, right: 1080 - SAFE.right }}>
      {STEPS.map((s, i) => {
        const a = at(s.w, 1, 0.4 + i * 1.2);
        const p = p01(t, a - 0.15, 0.4);
        const lit = t >= a - 0.15;
        return (
          <div key={s.k} style={{ display: "flex", gap: 30, alignItems: "baseline", padding: "20px 0", borderBottom: `1px solid ${C.edge}`, opacity: 0.25 + 0.75 * p }}>
            <span style={{ fontFamily: F.mono, fontSize: 30, color: lit ? C.red : C.muted, width: 70 }}>{s.k}</span>
            <div>
              <div style={{ fontFamily: F.sans, fontWeight: 800, fontSize: 64, letterSpacing: "-0.03em", color: C.text, lineHeight: 1 }}>{s.t}</div>
              <div style={{ fontFamily: F.sans, fontSize: 30, color: C.muted, marginTop: 8 }}>{s.d}</div>
            </div>
          </div>
        );
      })}
    </div>
  </>
);

const FRONTS = [
  { t: "Audiovisual", d: "Comerciais e vídeos de produto", w: "comerciais" },
  { t: "Sites", d: "Sites e landing pages", w: "sites" },
  { t: "Criativos", d: "Criativos pra anúncio", w: "criativos" },
];

const Fronts5: React.FC<ViewProps> = ({ t, at }) => (
  <>
    <Label text="Três frentes" t={t} />
    {FRONTS.map((f, i) => {
      const p = p01(t, at(f.w, 1, 0.3 + i * 1.0) - 0.15, 0.4);
      return (
        <div key={f.t} style={{ position: "absolute", top: 370 + i * 240, left: SAFE.left + 10, right: 1080 - SAFE.right - 10, height: 210, borderRadius: 26, backgroundColor: C.panel, border: `1.5px solid ${C.edge}`, padding: "34px 40px", opacity: p, translate: `0 ${(1 - p) * 30}px` }}>
          <div style={{ fontFamily: F.mono, fontSize: 24, letterSpacing: "0.16em", color: C.red }}>{String(i + 1).padStart(2, "0")}</div>
          <div style={{ fontFamily: F.sans, fontWeight: 800, fontSize: 60, letterSpacing: "-0.03em", color: C.text, marginTop: 8 }}>{f.t}</div>
          <div style={{ fontFamily: F.sans, fontSize: 30, color: C.muted, marginTop: 4 }}>{f.d}</div>
        </div>
      );
    })}
  </>
);

const Offer5: React.FC<ViewProps> = ({ t, scene, at }) => {
  const a = p01(t, at("diagnóstico", 1, 0.5) - 0.15, 0.4);
  const b = p01(t, at("orçamento.", 1, 2.5) - 0.15, 0.4);
  return (
    <>
      <Title lines={scene.text ?? []} t={t} size={92} accent={scene.accent} />
      <div style={{ position: "absolute", top: 700, left: SAFE.left + 10, display: "flex", flexDirection: "column", gap: 26 }}>
        <div style={{ padding: "26px 40px", borderRadius: 999, backgroundColor: C.red, color: "#fff", fontFamily: F.sans, fontWeight: 800, fontSize: 46, opacity: a, translate: `${(1 - a) * -30}px 0` }}>Diagnóstico gratuito</div>
        <div style={{ padding: "26px 40px", borderRadius: 999, border: `2px solid ${C.text}`, color: C.text, fontFamily: F.sans, fontWeight: 800, fontSize: 46, opacity: b, translate: `${(1 - b) * -30}px 0`, alignSelf: "flex-start" }}>Orçamento</div>
      </div>
    </>
  );
};

export const VIEWS: Record<string, React.FC<ViewProps>> = {
  "r3-hook": Hook3,
  "r3-weak": Weak3,
  "r3-layer": Layer3,
  "r3-compare": Compare3,
  statement: Statement,
  "r5-hook": Hook5,
  "r5-steps": Steps5,
  "r5-fronts": Fronts5,
  "r5-offer": Offer5,
  "r2-hook": Hook2,
  "r2-bad": Bad2,
  "r2-turn": Turn2,
  "r2-good": Good2,
  "r2-vitrine": Vitrine2,
  "r4-hook": Hook4,
  "r4-item": Item4,
  "r4-sum": Sum4,
  "r4-fix": Fix4,
  "r4-offer": Offer4,
};

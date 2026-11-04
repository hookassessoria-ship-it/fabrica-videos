import type { Caption } from "@remotion/captions";
import React, { useMemo } from "react";
import { AbsoluteFill, Audio, type CalculateMetadataFunction, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import type { Brand } from "../brand/types";
import { useBrandFonts } from "../brand/fonts";
import { Backdrop, Captions, EndCard, Logo } from "./parts";
import { VIEWS, type ViewProps } from "./views";

// Reels de conversão da Hook Company. Cada cena tem a sua fala e uma "view" (desenho em
// código, em src/hook/views.tsx); a cena começa na 1ª palavra dela e vai até a próxima.
// A última cena é a tela final (view "cta"), que fica pelo menos HOLD s depois da fala.

export type HookScene = { id: string; narration: string; view: string; text?: string[]; accent?: string[]; label?: string; variant?: string };
export type HookReelProps = {
  brand: Brand;
  scenes: HookScene[];
  audioSrc?: string | null;
  captions?: Caption[] | null;
  music?: { src?: string; volume?: number } | null;
  logo?: string | null;
  // "gastro": as demos usam o negócio fictício de gastronomia (gancho D).
  niche?: "brand" | "gastro";
  // Capa (still): sem legenda corrida e com a assinatura da Hook embaixo.
  cover?: boolean;
};

const FPS = 30;
const HOLD = 1.0;
const LEAD = 0.12;
const norm = (w: string) => w.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");
const count = (s: string) => s.split(/\s+/).filter(Boolean).length;

export type Window = { start: number; end: number; words: { text: string; at: number }[] };

export const sceneWindows = (scenes: HookScene[], captions: Caption[] | null | undefined): Window[] => {
  const caps = captions ?? [];
  let wi = 0;
  const raw = scenes.map((s) => {
    const n = count(s.narration);
    const ws = caps.slice(wi, wi + n);
    wi += n;
    return ws;
  });
  const lastEnd = caps.length ? caps[caps.length - 1].endMs / 1000 : scenes.length * 3;
  const starts = raw.map((ws, i) => (i === 0 ? 0 : ws.length ? Math.max(0, ws[0].startMs / 1000 - LEAD) : i * 3));
  return raw.map((ws, i) => {
    const start = starts[i];
    const end = i + 1 < starts.length ? starts[i + 1] : lastEnd + HOLD;
    return { start, end, words: ws.map((w) => ({ text: w.text.trim(), at: w.startMs / 1000 - start })) };
  });
};

export const calculateHookMetadata: CalculateMetadataFunction<HookReelProps> = ({ props }) => {
  const w = sceneWindows(props.scenes, props.captions);
  return { durationInFrames: Math.ceil(w[w.length - 1].end * FPS), fps: FPS, width: 1080, height: 1920 };
};

const SceneView: React.FC<{ readonly scene: HookScene; readonly win: Window; readonly props: HookReelProps; readonly first: boolean }> = ({ scene, win, props, first }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  // 1ª cena já entra no meio da animação: o quadro 0 tem texto grande e movimento.
  const t = frame / fps + (first ? 0.3 : 0);
  const at = (word: string, nth = 1, fallback = 0) => {
    const hits = win.words.filter((w) => norm(w.text) === norm(word));
    return hits[nth - 1]?.at ?? fallback;
  };
  const vp: ViewProps = { t, dur: win.end - win.start, scene, at, niche: props.niche ?? "brand" };
  if (scene.view === "cta") {
    return <EndCard t={t} logo={props.logo} />;
  }
  const View = VIEWS[scene.view];
  return View ? <View {...vp} /> : null;
};

export const HookReel: React.FC<HookReelProps> = (props) => {
  useBrandFonts(props.brand);
  const { fps, durationInFrames } = useVideoConfig();
  const wins = useMemo(() => sceneWindows(props.scenes, props.captions), [props.scenes, props.captions]);
  const music = props.music?.src ?? "audio/hook/bed.mp3";
  return (
    <AbsoluteFill style={{ backgroundColor: "#0A0A0B" }}>
      <Backdrop />
      {props.scenes.map((s, i) => {
        const from = Math.round(wins[i].start * fps);
        const len = Math.max(1, Math.round(wins[i].end * fps) - from);
        return (
          <Sequence key={s.id} from={from} durationInFrames={len} name={s.id}>
            <SceneView scene={s} win={wins[i]} props={props} first={i === 0} />
            {/* corte com um sopro curto, baixinho (nunca na 1ª cena nem por cima da fala) */}
            {i > 0 ? <Audio src={staticFile(s.view === "cta" ? "sfx/riser-1.mp3" : `sfx/swipe-${(i % 3) + 1}.mp3`)} volume={s.view === "cta" ? 0.18 : 0.12} /> : null}
          </Sequence>
        );
      })}
      {props.captions?.length && !props.cover ? <Captions captions={props.captions} /> : null}
      {props.cover ? (
        <div style={{ position: "absolute", top: 1150, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
          <Logo size={64} src={props.logo} />
        </div>
      ) : null}
      {props.audioSrc ? <Audio src={staticFile(props.audioSrc)} volume={1} /> : null}
      <Audio
        src={staticFile(music)}
        volume={(f) => (props.music?.volume ?? 0.55) * Math.min(1, f / (fps * 0.4)) * Math.min(1, (durationInFrames - f) / (fps * 0.8))}
      />
    </AbsoluteFill>
  );
};

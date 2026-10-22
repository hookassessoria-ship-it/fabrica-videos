// Créditos dos trechos de filme de um vídeo: lê videos/<id>.json (elementos "clip" dos shots e
// o monitor holográfico "holoIntro" da C) e grava a lista em
// public/images/raw/<id>/credits.json -> "clips" (as fotos do arquivo ficam como estão; o
// images:fetch preserva essa chave). Imprime também o bloco "Trechos" do creditos.txt.
//
//   npm run clips:credits -- <id>
//
// Filme novo: acrescente o arquivo em FILMS (título e crédito como vão no creditos.txt).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const DEFAULT_SRC = "clips/odisseia-trailer.mp4";
const FILMS = {
  "clips/odisseia-trailer.mp4": { title: "A Odisseia (2026)", credit: "Christopher Nolan / Universal", from: "trailer oficial" },
};
const FORM_PT = { card: "card", bg: "fundo", strip: "flashes", monitor: "monitor holográfico" };

const cutLen = (d) => Math.min(0.8, Math.max(0.3, d ?? 0.5));
const clipLen = (d) => Math.min(2, Math.max(1, d ?? 1.6));
const round = (v) => Math.round(v * 100) / 100;
// 76.9 -> "1:16,9"; 102.25 -> "1:42,25"
const clock = (s) => {
  const m = Math.floor(s / 60);
  const rest = s - m * 60;
  const dec = Math.round(rest * 100) % 10 === 0 ? 1 : 2;
  const txt = rest.toFixed(dec).replace(".", ",");
  return `${m}:${rest < 10 ? "0" : ""}${txt}`;
};

export const clipsOf = (video) => {
  const out = [];
  for (const [k, c] of (video.holoIntro?.clips ?? []).entries()) {
    out.push({ shot: `monitor ${k + 1}`, form: "monitor", src: video.holoIntro.src ?? DEFAULT_SRC, cuts: [{ from: c.from, to: round(c.from + clipLen(c.duration)), note: c.note }], face: Boolean(c.face) });
  }
  for (const sc of video.scenes) {
    for (const sh of sc.shots) {
      for (const el of sh.elements.filter((e) => e.type === "clip")) {
        const form = el.style === "bg" ? "bg" : el.style === "strip" ? "strip" : "card";
        const cuts =
          form === "strip"
            ? (el.cuts ?? []).map((ct) => ({ from: ct.from, to: round(ct.from + cutLen(ct.duration)), note: ct.note }))
            : [{ from: el.from, to: round(el.from + clipLen(el.duration)), note: el.note }];
        out.push({ shot: sh.id, form, src: el.src ?? DEFAULT_SRC, cuts, face: Boolean(el.face) });
      }
    }
  }
  return out;
};

export const creditLines = (clips) => {
  if (clips.length === 0) {
    return [];
  }
  const films = [...new Set(clips.map((c) => c.src))].map((src) => FILMS[src] ?? { title: src, credit: "", from: "arquivo" });
  const head = films.map((f) => `${f.title}${f.credit ? `, ${f.credit}` : ""}`).join("; ");
  const lines = [`Trechos: ${head}, usados sem áudio para comentário (${clips.length} trechos de até 2 s, tempos do ${films[0].from}):`];
  for (const c of clips) {
    const times = c.cuts.map((ct) => `${clock(ct.from)}–${clock(ct.to)}`).join(" / ");
    const notes = c.cuts.map((ct) => ct.note).filter(Boolean).join(" / ");
    lines.push(`- ${times} · ${FORM_PT[c.form]}${notes ? ` · ${notes}` : ""}`);
  }
  return lines;
};

if (import.meta.url === `file://${process.argv[1]}`) {
  const id = process.argv[2];
  if (!id) {
    console.error("uso: npm run clips:credits -- <id>");
    process.exit(1);
  }
  const video = JSON.parse(readFileSync(path.join(root, "videos", `${id}.json`), "utf8"));
  const clips = clipsOf(video);
  const dir = path.join(root, "public/images/raw", id);
  const file = path.join(dir, "credits.json");
  const credits = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : { videoId: id, images: {} };
  if (clips.length === 0) {
    delete credits.clips;
  } else {
    credits.clips = clips.map((c) => ({ ...c, film: FILMS[c.src] ?? null, audio: false }));
  }
  if (clips.length > 0 || existsSync(file)) {
    mkdirSync(dir, { recursive: true });
    writeFileSync(file, JSON.stringify(credits, null, 2) + "\n");
  }
  console.log(`trechos: ${clips.length} -> ${path.relative(root, file)}`);
  console.log(creditLines(clips).join("\n"));
}

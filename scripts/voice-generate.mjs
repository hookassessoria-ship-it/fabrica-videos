// Narração com a ElevenLabs (text-to-speech com timestamps).
//
//   npm run voice:generate -- <id>            narração completa
//   npm run voice:generate -- <id> --test     1ª frase com as vozes candidatas (public/audio/voice-tests/)
//   npm run voice:generate -- <id> --dry-run  só mostra o texto que seria enviado e quantos caracteres gasta
//   opções: --voice <voice_id>  --model <model_id>
//
// Junta a narração das cenas num texto só (com pausa entre cenas), troca siglas e números
// pela forma falada ("IBGÊ", "dez vírgula zero seis por cento") e gera o áudio com o
// alinhamento por caractere. Salva:
//   public/audio/<id>.mp3                 áudio (não vai pro git)
//   videos/<id>-alignment.json            texto enviado + alinhamento por caractere
//   videos/<id>-captions.json             timestamps por palavra (palavras originais: "10%")
// e aponta "audio"/"captions" no JSON do vídeo. O template reajusta os shots pela narração.
//
// Configuração da voz no JSON do vídeo: "voice": { "id", "name", "model", "settings", "tempo",
// "pronunciation", "candidates" }. A chave fica em .env (ELEVENLABS_API_KEY).
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const API = "https://api.elevenlabs.io/v1";
const KEY = process.env.ELEVENLABS_API_KEY;

// ---------------------------------------------------------------- números por extenso (pt-BR)
const UNI = ["zero", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove", "dez", "onze", "doze", "treze", "catorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
const DEZ = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
const CEM = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];

const under1000 = (n) => {
  if (n < 20) {
    return UNI[n];
  }
  if (n < 100) {
    return DEZ[Math.floor(n / 10)] + (n % 10 ? ` e ${UNI[n % 10]}` : "");
  }
  if (n === 100) {
    return "cem";
  }
  return CEM[Math.floor(n / 100)] + (n % 100 ? ` e ${under1000(n % 100)}` : "");
};

export const intWords = (n) => {
  if (n < 1000) {
    return under1000(n);
  }
  const mil = Math.floor(n / 1000);
  const rest = n % 1000;
  const head = mil === 1 ? "mil" : `${under1000(mil)} mil`;
  if (!rest) {
    return head;
  }
  // "dois mil e vinte e um", "dois mil quatrocentos e dez"
  return rest < 100 || rest % 100 === 0 ? `${head} e ${under1000(rest)}` : `${head} ${under1000(rest)}`;
};

// "10,06" -> "dez vírgula zero seis"; "32,2" -> "trinta e dois vírgula dois"
export const numberWords = (s) => {
  const [int, dec] = s.replace(/\./g, "").split(",");
  let out = intWords(Number(int));
  if (dec) {
    out += ` vírgula ${dec.startsWith("0") ? [...dec].map((d) => UNI[Number(d)]).join(" ") : intWords(Number(dec))}`;
  }
  return out;
};

const DEFAULT_PRONUNCIATION = { IBGE: "IBGÊ", PIB: "pib" };

// Palavra original -> forma falada (pontuação preservada).
const spokenToken = (token, pron) => {
  const m = token.match(/^([^\p{L}\p{N}%]*)(.*?)([^\p{L}\p{N}%]*)$/u);
  const [, pre, core, post] = m ?? ["", "", token, ""];
  let spoken = core;
  if (pron[core] !== undefined) {
    spoken = pron[core];
  } else if (/^\d+([.,]\d+)?%?$/.test(core)) {
    spoken = numberWords(core.replace("%", "")) + (core.endsWith("%") ? " por cento" : "");
  }
  return { pre, core, post, spoken };
};

export const tokensOf = (narration) => narration.split(/\s+/).filter(Boolean);

// Texto enviado + mapa palavra -> trecho falado.
const buildScript = (scenes, pron, sceneBreak) => {
  const words = [];
  const parts = [];
  scenes.forEach((scene, si) => {
    const spoken = tokensOf(scene.narration).map((tok) => {
      const t = spokenToken(tok, pron);
      words.push({ scene: si, text: tok, spoken: t.spoken });
      return `${t.pre}${t.spoken}${t.post}`;
    });
    parts.push(spoken.join(" "));
  });
  return { text: parts.join(sceneBreak), words };
};

// ---------------------------------------------------------------- API
const api = async (pathname, body, query = "") => {
  const res = await fetch(`${API}${pathname}${query}`, {
    method: "POST",
    headers: { "xi-api-key": KEY, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`ElevenLabs ${pathname}: ${res.status} ${await res.text()}`);
  }
  return res.json();
};

const voiceSettings = (model, s = {}) => {
  const base = { stability: 0.4, similarity_boost: 0.75, style: 0.3, use_speaker_boost: true, speed: 1.08, ...s };
  if (model.startsWith("eleven_v3") || model.startsWith("eleven_v4")) {
    // v3+: estabilidade só 0 / 0,5 / 1 (Creative / Natural / Robust).
    base.stability = base.stability < 0.25 ? 0 : base.stability < 0.75 ? 0.5 : 1;
  }
  return base;
};

const tts = async ({ voiceId, model, text, settings }) => {
  const body = { text, model_id: model, voice_settings: voiceSettings(model, settings) };
  return api(`/text-to-speech/${voiceId}/with-timestamps`, body, "?output_format=mp3_44100_128");
};

// Acelera o áudio (ritmo de TikTok) sem mudar o tom, quando o modelo não aceita "speed".
const retempo = (file, tempo) => {
  if (!tempo || Math.abs(tempo - 1) < 0.005) {
    return;
  }
  const tmp = path.join(os.tmpdir(), `tempo-${Date.now()}.mp3`);
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", file, "-filter:a", `atempo=${tempo}`, "-b:a", "192k", tmp]);
  writeFileSync(file, readFileSync(tmp));
  rmSync(tmp);
};

// ---------------------------------------------------------------- alinhamento -> palavras
const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export const wordTimings = (alignment, words, tempo = 1) => {
  const chars = alignment.characters;
  const starts = alignment.character_start_times_seconds;
  const ends = alignment.character_end_times_seconds;
  const full = norm(chars.join(""));
  // Índice de cada caractere do texto normalizado (NFD pode mudar o tamanho): mapeia de volta.
  const map = [];
  chars.forEach((ch, i) => {
    for (let k = 0; k < norm(ch).length; k++) {
      map.push(i);
    }
  });
  let cursor = 0;
  const out = words.map((w) => {
    const target = norm(w.spoken).replace(/[^\p{L}\p{N} ]/gu, "").trim();
    const first = target.split(" ")[0];
    let at = target ? full.indexOf(target, cursor) : -1;
    if (at === -1 && first) {
      at = full.indexOf(first, cursor);
    }
    if (at === -1) {
      return { ...w, start: null, end: null };
    }
    const len = full.indexOf(target, cursor) === at ? target.length : first.length;
    cursor = at + len;
    const a = map[at];
    const b = map[Math.min(map.length - 1, at + len - 1)];
    return { ...w, start: starts[a] / tempo, end: ends[b] / tempo };
  });
  // Palavras não encontradas: interpola entre as vizinhas.
  out.forEach((w, i) => {
    if (w.start === null) {
      const prev = out.slice(0, i).reverse().find((x) => x.end !== null);
      const next = out.slice(i + 1).find((x) => x.start !== null);
      w.start = prev ? prev.end : 0;
      w.end = next ? next.start : w.start + 0.3;
    }
  });
  return out;
};

const toCaptions = (timed) =>
  timed.map((w, i) => ({
    text: i === 0 ? w.text : ` ${w.text}`,
    startMs: Math.round(w.start * 1000),
    endMs: Math.round(Math.max(w.end, w.start + 0.05) * 1000),
    timestampMs: Math.round(((w.start + w.end) / 2) * 1000),
    confidence: 1,
  }));

const audioDuration = (file) =>
  Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file]).toString().trim());

// ---------------------------------------------------------------- main
const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const id = args.find((a, i) => !a.startsWith("--") && !["--voice", "--model"].includes(args[i - 1]));
if (!id || !existsSync(path.join(root, "videos", `${id}.json`))) {
  console.error("Uso: npm run voice:generate -- <id> [--test] [--voice <voice_id>] [--model <model_id>]");
  process.exit(1);
}
if (!KEY && !args.includes("--dry-run")) {
  console.error("Falta ELEVENLABS_API_KEY no .env");
  process.exit(1);
}

const videoFile = path.join(root, "videos", `${id}.json`);
const video = JSON.parse(readFileSync(videoFile, "utf8"));
const voice = video.voice ?? {};
const model = opt("--model") ?? voice.model ?? "eleven_multilingual_v2";
const pron = { ...DEFAULT_PRONUNCIATION, ...(voice.pronunciation ?? {}) };
const tempo = voice.tempo ?? 1;

if (args.includes("--test")) {
  // 1ª frase com cada candidata.
  const candidates = voice.candidates ?? [];
  if (candidates.length === 0) {
    console.error('Defina "voice.candidates" no JSON do vídeo: [{ "id": "...", "name": "..." }]');
    process.exit(1);
  }
  // Texto do teste: "voice.testText" ou a 1ª frase do roteiro (curto, pra economizar créditos).
  const first = { ...video.scenes[0], narration: voice.testText ?? video.scenes[0].narration.split(/(?<=[.!?])\s/)[0] };
  const { text } = buildScript([first], pron, "");
  const dir = path.join(root, "public/audio/voice-tests", id);
  mkdirSync(dir, { recursive: true });
  for (const [n, c] of candidates.entries()) {
    const res = await tts({ voiceId: c.id, model, text, settings: voice.settings });
    const file = path.join(dir, `${n + 1}-${c.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}.mp3`);
    writeFileSync(file, Buffer.from(res.audio_base64, "base64"));
    retempo(file, tempo);
    console.log(`  ✓ ${path.relative(root, file)}  (${c.id}, ${audioDuration(file).toFixed(2)}s)`);
  }
  process.exit(0);
}

const voiceId = opt("--voice") ?? voice.id;
if (!voiceId) {
  console.error('Defina "voice.id" no JSON do vídeo (ou passe --voice <voice_id>).');
  process.exit(1);
}

// Pausa natural entre cenas: parágrafo novo (v3+ não aceita <break>).
// "voice.pause" (s) encurta ou alonga a pausa entre cenas (padrão 0,35 s).
const sceneBreak = model.startsWith("eleven_v3") || model.startsWith("eleven_v4") ? "\n\n" : ` <break time="${voice.pause ?? 0.35}s" />\n`;
const { text, words } = buildScript(video.scenes, pron, sceneBreak);
console.log(`> ${model}, voz ${voice.name ?? voiceId}, ${text.length} caracteres`);
if (args.includes("--dry-run")) {
  console.log(text);
  process.exit(0);
}
const res = await tts({ voiceId, model, text, settings: voice.settings });

const audioRel = `audio/${id}.mp3`;
const audioFile = path.join(root, "public", audioRel);
mkdirSync(path.dirname(audioFile), { recursive: true });
writeFileSync(audioFile, Buffer.from(res.audio_base64, "base64"));
retempo(audioFile, tempo);

const alignment = res.alignment ?? res.normalized_alignment;
const timed = wordTimings(alignment, words, tempo);
const captions = toCaptions(timed);
const duration = audioDuration(audioFile);

writeFileSync(
  path.join(root, "videos", `${id}-alignment.json`),
  `${JSON.stringify({ model, voiceId, voiceName: voice.name ?? null, tempo, text, duration, words: timed, alignment }, null, 1)}\n`,
);
writeFileSync(path.join(root, "videos", `${id}-captions.json`), `${JSON.stringify(captions, null, 1)}\n`);

video.audio = audioRel;
video.captions = `${id}-captions.json`;
writeFileSync(videoFile, `${JSON.stringify(video, null, 2)}\n`);

console.log(`✓ ${audioRel} (${duration.toFixed(2)}s), ${captions.length} palavras com timestamp`);
console.log(`✓ videos/${id}-alignment.json, videos/${id}-captions.json`);

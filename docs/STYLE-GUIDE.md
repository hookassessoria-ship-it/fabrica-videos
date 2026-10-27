# Guia de estilo — explicadores RikuAI para TikTok (versões A, B e C)

Especificação completa dos vídeos verticais da RikuAI feitos neste repositório (Remotion 4.0.537 + React + TypeScript), a partir do roteiro de referência `rikuai-001-elevador` ("O elevador dos preços"). Quem seguir este guia consegue produzir, para um roteiro novo, as três versões com o mesmo estilo.

> **Fonte da verdade é o código.** Todos os valores abaixo foram tirados dos arquivos citados entre parênteses. Se um valor mudar no código, vale o código. Arquivos de referência: `videos/rikuai-001-elevador.json` (A), `videos/rikuai-001-elevador-b.json` (B), `videos/rikuai-001-elevador-c.json` (C).

---

## 1. Visão geral e fluxo

Um roteiro vira **três vídeos** (para postar em perfis diferentes sem ser marcado como duplicado):

| Versão | Arquivo | Template | Visual | Voz | Gancho | Entrega |
|---|---|---|---|---|---|---|
| **A** | `videos/<id>.json` (o roteiro) | `KineticExplainer` | paleta `sunset-dark` (fundo escuro, alto contraste), alertas em `heat` | masculina, Liam (`voices.a`) | o do roteiro | `out/<id>-1080.mp4` (a A do 001 também saiu uma vez em 4K, mas a entrega é 1080) |
| **B** | `videos/<id>-b.json` | `KineticExplainer` | paleta `rikuai`, alertas em `rikuai-heat`, outra seed, metade dos shots espelhados, fotos diferentes das da A | feminina calma, Sarah (`voices.b`) | `hookAlt` do roteiro (+ cenas próprias em `altB`) | `out/<id>-b-1080.mp4` (só 1080) |
| **C** | `videos/<id>-c.json` | `WireframeExplainer` | holograma 3D (sala azul-marinho, malha ciano com glow, magenta pro negativo) | **a mesma narração da B** (`audioFrom`) | o da B | `out/<id>-c-1080.mp4` |

Formato fixo (`src/templates/timeline.ts`): **1080×1920, 30 fps**. Tudo é dirigido por JSON: cada `videos/*.json` com `composition` + `scenes` vira uma composição na pasta **Videos** do Remotion Studio (`src/videos.ts`, `src/Root.tsx`), sem mexer em código. Os arquivos `*-captions.json` e `*-alignment.json` em `videos/` não são vídeos (não têm `composition`).

### 1.1 Comandos, na ordem

```bash
cp .env.example .env                      # PIXABAY_API_KEY, ELEVENLABS_API_KEY, (opcional) REMOTION_BROWSER_EXECUTABLE
npm run setup                             # máquina nova (ver §14)
# escreva videos/<id>.json (versão A, com "hookAlt")
npm run make:all -- <id> --derive-only    # cria videos/<id>-b.json e videos/<id>-c.json
# (ajuste a C à mão: shots com "wire" e "keyword" — §6.9)
npm run voice:generate -- <id>-b --test   # opcional: testa as candidatas de voz da B
npm run make:all -- <id> --preview        # fotos + narrações + revisão + prévias rápidas das 3
npm run make:all -- <id>                  # fotos + narrações + revisão + render final 1080 das 3
```

`scripts/make-all.mjs` (via `npm run make:all -- <id> [opções]`):

| Opção | Efeito |
|---|---|
| (nenhuma) | deriva B/C se não existirem, depois para A e B: `images:fetch` → `voice:generate` (só se o JSON ainda não tem `audio`) → `render:video`; para C: garante a narração da B, copia `audio`/`captions` da B para a C e renderiza |
| `--only a,b,c` | só as versões listadas (padrão `a,b,c`) |
| `--derive-only` | só deriva B e C e sai |
| `--rederive` | refaz B e C a partir do roteiro (**apaga ajustes manuais** nelas) |
| `--preview` | usa `preview:fast` no lugar de `render:video` |
| `--no-render` | não renderiza (só fotos e narração) |

Antes de derivar, se o roteiro não tem `voice.id`, o script copia `brand.voices.a` para `voice` da A e salva o arquivo. B e C **só são derivados se ainda não existirem**.

### 1.2 Saídas

| Comando | Arquivo |
|---|---|
| `npm run render:video -- <id>` | `out/<id>-1080.mp4` |
| `npm run render:video -- <id> --4k` | `out/<id>-4k.mp4` (2160×3840) |
| `npm run preview:fast -- <id>` | `out/preview/<id>-fast.mp4` (meia escala) |
| `npm run timeline -- <id>` | imprime a linha do tempo real (shots já reajustados pela narração) |
| `npm run stills -- <CompositionId> <pasta> <quadro> [quadro…]` | PNGs de quadros soltos para revisar sem renderizar tudo: `<pasta>/<CompositionId>-<quadro com 5 dígitos>.png` |

Tempo de render 3D (anotado em `videos/README.md`): a C leva ~0,6 s por quadro em meia escala e ~2 s por quadro em 1080 (4 núcleos).

---

## 2. Formato e zonas da tela

### 2.1 Constantes (`src/templates/safeZone.ts`)

| Constante | Valor | Uso |
|---|---|---|
| `SAFE` | top 250, bottom 1500 (1920−420), left 60, right 940 (1080−140) | área livre da UI do TikTok |
| `VISUAL` | top 288 (15%), bottom 1248 (65%), centerX 500, centerY 768 | faixa do visual principal; **posição padrão** de qualquer elemento sem `x`/`y` é (500, 768) |
| `CAPTIONS` | centerY 1380 (`round((1248+1500)/2)+6`), width 840 (`940−60−40`) | legenda; a caixa começa em x = 80 (`SAFE.left + 20`) |

A revisão automática usa uma área um pouco diferente (`scripts/check-numbers.mjs`, `SAFE = { x0: 30, x1: 1050, y0: 250, y1: 1500, sideY: 1100, sideX: 960 }`): tudo dentro de x 30–1050 × y 250–1500 e, **abaixo de y 1100, nada passa de x 960** (coluna de botões do TikTok).

O centro horizontal de composição é **x = 500** (não 540): é o centro de `SAFE` e também o eixo do espelhamento da B (`variant.ts`, `CENTER_X = 500`). A C centraliza textos em x = 540.

```
y    0 ┌───────────────────────────────┐
       │ UI do TikTok                  │
y  250 ├─ SAFE.top ────────────────────┤
y  288 │ VISUAL.top                    │ Kinetic: títulos 290–420 · C: palavra-chave 370 (285–455)
y  520 │                               │ C: HUD digitado
y  768 │ centro do visual (x 500)      │ Kinetic: visual principal 700–900
y 1100 │                     ┌botões─┐ │ checagem: daqui pra baixo, x ≤ 960
y 1235 │ Kinetic: "Fonte: …" │       │ │ C: fonte 1262
y 1248 │ VISUAL.bottom       │       │ │
y 1380 │ legenda (centro)    │       │ │
y 1500 ├─ SAFE.bottom ───────┴───────┴─┤
y 1920 └───────────────────────────────┘
```

### 2.2 Posições usadas na A/B (Kinetic)

| Faixa | y | Exemplos do 001 |
|---|---|---|
| Título/frase de apoio | 290–420 | `"DE 2023 PRA CÁ"` y 330, `"PREÇO = ANDAR"` y 300, `"ANTES DE\nME XINGAR…"` y 365, ransom `"VOANDO"` y 365 |
| Visual principal (número, gráfico, prédio, foto, palavra gigante) | 690–900 | número herói y 760/590, barras y 810/890, prédio y 800–860 |
| Apoio inferior (ícone em pill, foto rasgada, rótulo) | 1040–1235 | pill `"carrinho"` y 1190, `"Fonte: IBGE (IPCA)"` x 500 y 1235 |
| Rótulo de fonte no canto | x 235, y 310 | `"Fonte: IBGE (IPCA)"` em shots com número no centro |
| Ícones laterais | x 820–880, y 450–760 | `trending-down` x 870 y 590 |

O zoom da câmera é ancorado em y 330 (`KineticShot.tsx`, `ZOOM_ORIGIN_Y = 330`): a faixa dos títulos fica parada e não sai da área segura.

### 2.3 Posições da C (Wireframe, `src/templates/WireShot.tsx`)

| Peça | Posição |
|---|---|
| Palavra-chave (`KEYWORD_Y`) | centro x 540, **y 370** (zona 285–455) |
| HUD digitado (`TYPED_Y`) | x 540, **y 520**, mono 34 px |
| Fonte/rótulo (`SOURCE_Y`) | x 540, **y 1262**; se houver mais de um `label`, empilha pra cima de 56 em 56 px |
| Rótulo de ícone (`icon.label`, sem `label` no shot) | y 1262 (30 px); no palco `end`, y 1180 (44 px) |
| Número herói | palco `number`: (330, 850), máx. 200 px · palco `food`: (540, 625), máx. 190 px · outros: (540, 760), máx. 200 px |
| Objeto 3D | dentro de `stageRect` (§6.4) |
| Legenda | igual ao Kinetic (centro y 1380) |

---

## 3. Regras editoriais (obrigatórias)

| # | Regra | Como é garantida |
|---|---|---|
| 1 | **Números:** qualquer número na tela é 0, o valor exato do JSON, ou o número herói durante a contagem (contagem ≤ 0,4 s). Barras **nunca contam**: o valor aparece pronto, com pop, depois que a barra termina de crescer. Todo número precisa estar na tela no último terço do seu shot. | Código: `COUNT_MAX_S = 0.4` (`motion.ts`); `BarChart`/`barGrow` só mostram o valor final. Checagem `números` (§10). |
| 2 | **Nunca dois textos grandes na mesma área ao mesmo tempo**, transições incluídas (títulos, ransom, recortes, número herói, palavra com foto). Texto grande nunca cobre números de gráfico nem o objeto 3D. Transição entre shots cujas faixas de texto se cruzam vira corte exclusivo (`flash`/`invert`, ou `cut`). | Código: `textBands`/`pickTransitions` (§4.9); na C, uma palavra-chave por vez e objeto fora da zona de texto (`stageRect`). Checagem `sobreposição`. |
| 3 | **Nenhuma palavra cortada:** digitação revela só palavras inteiras (4 quadros por palavra); no ransom cada palavra completa em até 3 quadros; o destaque da legenda cobre a palavra inteira desde o 1º quadro. | Código: `TYPE_FRAMES_PER_WORD = 4`, ransom com letras da palavra em 2 quadros, destaque com `inset: 0`. Checagem `palavras cortadas`. |
| 4 | **Safe zone do TikTok:** títulos, números, HUDs e objetos 3D dentro da área segura. | Checagem `safe zone` (falha se ficar fora por mais de 15 quadros seguidos). |
| 5 | **Valores principais com ≥ 34 px na tela.** | Código: barras `valueSize = max(34, …)`; C `MIN_MAIN = 34`. Checagem `tamanho`. |
| 6 | **Contraste e hierarquia:** fundos escuros; uma mensagem principal por tela; o elemento principal ocupa 70–80% da largura; cards e contêineres são vidro escuro (`rgba(20,10,25,0.45)`) com borda clara; texto claro tem sombra escura. **Variedade:** `ring` no máximo 2× por vídeo e `disc` no máximo 2× (alterne com `dots`, `diagonals`, `blob`, `triangle`, `ghost`, texto `outline`); não repetir o mesmo layout em dois shots seguidos; nenhum trecho com tela vazia ou elemento parado por mais de 0,5 s. | Paletas escuras e estilos no código; o resto é revisão manual (não há checagem automática de variedade). |
| 7 | **Fotos:** só Pixabay (licença: os `.jpg`/`.png` não vão pro git, só o `credits.json` com os ids fixados); largura original ≥ 1500 px; sem rosto em close; sem figuras públicas (políticos aparecem só como texto); sem moeda estrangeira em notas/recibos; nenhuma foto repetida no vídeo; a B não usa fotos da A. Uma foto a cada 5–8 s, 1–3 s na tela, sem repetir o mesmo estilo em seguida. | `images-fetch.mjs`: filtro de largura, regex de pessoas nas tags, `exclude` (ex.: `["euro"]`), `avoidFrom`, `used`; `.gitignore`. Figuras públicas/moeda: revisão manual + `require`/`exclude`/`id`. |
| 8 | **Legendas** agrupadas por sentido (nunca terminam em artigo/preposição), até 2 linhas, palavra falada destacada. | `toBlocks` (§4.11). Checagem do destaque. |
| 9 | **Narração:** ElevenLabs `eleven_multilingual_v2` com timestamps; números escritos por extenso em pt-BR antes do TTS; mapa de pronúncia (`IBGE → IBGÊ`, `PIB → pib`); no plano grátis só vozes *premade* funcionam via API. Cenas reajustadas aos timestamps reais. | `voice-generate.mjs`, `retime.ts` (§7). |
| 10 | **Som:** biblioteca gerada uma vez (ElevenLabs sound generation, versionada em `public/sfx/`), mapeamento automático por evento, rodízio de variações, ducking sob a voz, narração em 1.0, master normalizado em −14 LUFS. | `sfxMap.ts`, `render.mjs` (§8, §11). |

---

## 4. Versão A — KineticExplainer

Motion graphics premium: texto cinético, ícones, números, gráficos e fotos sobre gradiente fluido; cortes curtos e transições variadas (`src/templates/KineticExplainer.tsx`, `KineticShot.tsx`).

### 4.1 Campos de topo do JSON

```jsonc
{
  "id": "rikuai-001-elevador",          // = nome do arquivo
  "composition": "Rikuai001Elevador",   // id no Studio (B ganha sufixo "B", C ganha "C")
  "title": "O elevador dos preços",
  "template": "KineticExplainer",
  "brand": "rikuai",                    // brands/rikuai.json
  "background": { "palette": "sunset-dark", "speed": 0.3 },
  "audio": "audio/rikuai-001-elevador.mp3",          // preenchido pelo voice:generate
  "captions": "rikuai-001-elevador-captions.json",   // idem
  "music": null,
  "sfx": {},                            // vazio = biblioteca automática de public/sfx
  "voice": { … },                       // §7
  "hookAlt": [ … ],                     // §5
  "scenes": [ { "id", "narration", "shots": [ … ] } ]
}
```

A A **não tem `seed`**: o sorteio de transições usa o id da marca (`"rikuai"`). Sem `layout` (nenhum espelhamento). Sem `background`, o padrão seria `{ palette: "sunset", speed: 0.3 }` (`src/videos.ts`) — sempre declare `sunset-dark`.

### 4.2 Cores

**Marca** (`brands/rikuai.json`): background `#08080d`, paper `#121218`, paperRaised `#1b1b22`, edge `#C4C4CC`, text `#F2F2F2`, textMuted `#8E8E9A`, **accent `#7C5CFF`** (marcado como *placeholder* na marca; todos os destaques derivam dele), cream `#EDE3CF`.

**Derivadas** (`src/brand/collageTheme.tsx`): paperWhite `#F4F1EA`, ink `#141416`, newsprint = mix(cream, `#9a968e`, 0.35) = `#d0c8b8`, accentLight = mix(accent, `#ffffff`, 0.35) = `#aa95ff`. O acento roxo `#7C5CFF` é o mesmo na A e na B (marca-texto, discos, legenda ativa, barras destacadas, borda do wipe).

**Paletas do fundo** (`src/components/kinetic/FluidBackground.tsx`, da mais clara para a mais escura):

| Nome | Cores | Uso |
|---|---|---|
| `sunset-dark` | `#E8774A` `#C2185B` `#5B2C6F` `#1A0B1F` `#0B0410` | **fundo da A** (roxo e quase preto dominando, laranja só nos brilhos) |
| `heat` | `#FF8A3D` `#E53935` `#B0123B` `#4A0D2E` `#14040C` | **shots de alerta da A** (`"palette": "heat"`: inflação alta, comida, carga tributária) |
| `rikuai` | `#7C5CFF` `#2A1B5E` `#120F24` `#08080d` `#030305` | **fundo da B**; último shot (CTA) da A |
| `rikuai-heat` | `#FF4FA3` `#C2187A` `#5B1A8C` `#1A0B33` `#07040F` | shots de alerta da B (magenta em vez de laranja) |
| `sunset` | `#F7B347` `#E8774A` `#C2185B` `#5B2C6F` `#1A0B1F` | não usar nas versões A/B (claro demais) |
| `electric` | `#FFFFFF` `#3D5AFE` `#0A0AFF` `#0B0B1A` `#04040C` | não usada |

Lista própria também funciona (4–5 cores em qualquer ordem; são ordenadas por luminância e, com 4, a 5ª é a mais escura × 0,4).

### 4.3 Fontes (papéis da marca)

| Papel | Família (pesos) | Onde aparece |
|---|---|---|
| `display` | Anton (400) | `text` com `"font": "display"` (`"VS"`, `"?"`, `"RikuAI"`, palavras `outline` gigantes), palavra da foto `mask` |
| `sans` | Inter (400, 600, 700, 800, 900) | padrão do `text` (900, `letterSpacing −0.04em`), número herói (900), valores de barra/linha (900), títulos de card (900), balões (800), legendas (800) |
| `mono` | Space Mono (400, 700) | `label` (fonte de dado), textos digitados (`"font": "mono"`, `"weight": 700`), anos das barras, kicker do card, etiquetas do prédio |
| `hand` | Caveat (700) | não usada em A/B/C |
| ransom | Anton 400, Playfair Display 900, Space Mono 700, Archivo Black 400, Abril Fatface 400 | sorteadas letra a letra no `ransom` |
| recorte | `"Playfair Display", Georgia, serif` 900 (fixo no código) | `clipping` |

As fontes são baixadas por `npm run fonts:cache` para `public/fonts/google/` (subset `latin`) e carregadas do cache local; sem cache, do Google Fonts.

### 4.4 Cenas, shots e tempo

- **Cena** = uma frase/ideia da narração (`id`, `narration`, `shots`). **Shot** = 1–3 s (2–3 cortes por frase), cada um com layout próprio.
- `duration` dos shots é só a proporção desejada: com narração gravada tudo é reajustado (§7.3).
- Cada elemento entra em `at` (segundos desde o início do shot; **negativo** = já no meio da animação no 1º quadro, bom para o gancho) ou em `enterOnWord` (+ `wordOffset`, em segundos). Sem nenhum dos dois: `at = min(0.2 + i·0.25, max(0, duration − 0.4))` (i = índice do elemento).
- `enterOnWord` compara a palavra normalizada (minúsculas, sem acento, só `a-z0-9%`), primeiro igual e depois "começa com", **na primeira ocorrência da cena inteira** (não só do shot); se a palavra já foi dita antes do shot, entra no quadro 0. Use palavras únicas na cena e copie a pontuação quando ajudar (`"IBGE."`, `"10%."`).
- `cutOnWord` no shot: o corte para ele cai logo antes dessa palavra (primeira ocorrência dentro da cena que ainda deixa o shot anterior com pelo menos 0,6 s; assim um "A" repetido na mesma cena — "A cervejinha… A comprinha…" — pega a ocorrência certa). Prefira palavras únicas na cena.
- `exitAt`: sai antes do fim com antecipação (6 quadros encolhendo 7%, depois 8 quadros crescendo +60%, sumindo, subindo 40 px e desfocando 16 px).

### 4.5 Câmera virtual por shot (`KineticShot.tsx`)

| Movimento | Valor |
|---|---|
| Zoom padrão | `camera.zoom` = `[1, 1.06]` (início → fim) |
| Punch-in | começa +0,05 e assenta em 8 quadros (`outExpo`) |
| Speed ramp de saída | +0,04 nos últimos 8 quadros (`inExpo`) |
| Rotação | `sin(t·0.7) × camera.rotate` (padrão 0,8°) |
| Deriva | x = `sin(t·0.5)·14` px, y = `cos(t·0.4)·10` px, multiplicada pelo parallax de `depth` (0 → 0,35; 1 → 1; 2 → 1,7) |
| Tremida de impacto | 6 quadros, amplitude 16 px decaindo, em cada elemento com `"impact": true` |
| Ponto fixo do zoom | (540, 330) |

`impact: true` também solta 28 partículas (spread 520) no elemento (exceto `number`, que tem as suas) e faz o fundo pulsar (`exp(−Δf/6)`). Quadro do impacto: `number` = fim da contagem; `ransom` = início + (palavras−1)·4 + 4; demais = início + 6.

### 4.6 Entradas e micro-movimento (`Piece.tsx`, `motion.ts`)

Entradas (`enter`): `pop` (mola bouncy + squash 0,16), `zoom` (de 2,4× com blur 18 em 0,45 s), `drop` (cai de −420 px girando −8°), `blur` (0,5 s, escala 1,12→1, blur 22), `none` (fade de 4 quadros), `instant`, `up`/`down`/`left`/`right` (260 px, mola snappy). Blur de movimento = `min(16, velocidade·0,12)`.

Padrões por tipo: text `none`, number `blur`, bars `none` (`instant` com `morphFrom`), line `none`, icon `pop`, icons `none`, card `up`, shape `none`, meter `up`, ransom `none`, bubbles `instant`, ghost `blur`, building `instant`, clipping `drop`, label `left`, photo `drop` (cutout) / `none` (mask) / `up` (demais).

Nada fica parado: flutuação `float` (padrão 6 px; ghost 14; bars/line/shape/building 3; bubbles/label 2), rotação ±0,8°, respiração de escala 1→1,02. `tilt` (padrão em `card` e `number`): rotateX ±7°, rotateY ±10°, perspectiva 1400.

Molas (`SPRING`): snappy {damping 14, stiffness 230, mass 0,7}, bouncy {9, 190, 0,75}, soft {18, 120, 1}, heavy {11, 140, 1,3}. Curvas: outExpo `(0.16,1,0.3,1)`, inExpo `(0.7,0,0.84,0)`, inOutCubic `(0.65,0,0.35,1)`, outBack `(0.34,1.56,0.64,1)`, outQuart `(0.25,1,0.5,1)`.

### 4.7 Catálogo de elementos (campos realmente usados na A)

Campos comuns: `x`, `y` (centro, px), `at`/`enterOnWord`/`wordOffset`, `enter`, `exitAt`, `depth` (0 fundo, 1 meio, 2 frente), `scale`, `rotate`, `tilt`, `float`, `z`, `impact`, `sfx`, `id`.

| Tipo | Campos usados na A | Especificação |
|---|---|---|
| `text` | `text` (`\n` quebra linha), `mode` (`word`/`line`; também `letter`), `effect`, `size`, `font`, `weight`, `color: "accent"`, `highlight`, `plate`, `outline` | Padrão: 110 px, Inter 900, `maxWidth` 880, cascata word 3 / letter 2 / line 5 quadros. Efeitos: `slide` (padrão, sobe 0,7 em com motion blur), `scale` (0,3→1 bouncy), `mask` (sobe de dentro de uma máscara em 10 quadros), `blur` (12 quadros, blur 16, escala 1,2→1), `impact` (bloco inteiro 2,6→0,94→1,03→1 em 12 quadros), `type` (uma palavra a cada 4 quadros + cursor de acento). `highlight`: marca-texto de acento cresce entre os quadros 6–14 da palavra. `plate`: fundo `rgba(14,10,28,0.62)`, raio 28. `outline`: só contorno (traço `max(2, size·0,012)` a 60%), decorativo e fora da checagem de sobreposição. Texto ≥ 56 px e não-outline é "texto grande". |
| `number` | `value`, `prefix`, `suffix`, `size`, `label` | Número herói: Inter 900, 300 px padrão, `letterSpacing −0.05em`, sufixo a 42% do tamanho; conta de 0 ao valor em ≤ 0,4 s (`outExpo`), brilho de acento estoura no fim, kick 1→1,08→1, 30 partículas. `label` em mono a 12% do tamanho. Formato pt-BR (`10,06`, `1.234,5`), casas decimais = as do valor. |
| `bars` | `data[{label, value, display, highlight}]`, `width`, `height`, `morphFrom`, `bracket {from, to, label, at/enterOnWord}` | Padrão 880 × 600; topo = máx × 1,12; barras em cascata de 3 quadros (mola bouncy), branco 82% ou acento com glow (`highlight`); **valor sem contagem**, pop 11 quadros depois do início da barra; valor em Inter 900 `max(34, min(44, slot·0,3))` px (×1,25 no destaque); ano em mono `min(28, slot·0,24)`. `display` troca o texto final (`"+7,69%"`). `morphFrom`: o valor dessa barra sai grande (260 px) do centro do visual e voa pro topo em 16 quadros (match cut com o número do shot anterior; o gráfico já entra inteiro). `bracket`: chave de acento desenhada em 14 quadros + pill Inter 900 40 px; padrão `at + 1.2`. |
| `line` | `points`, `labels`, `width`, `height` (usados na B) | 820 × 420; desenha em 1,1 s com ponta de acento; valores Inter 900 38 px aparecem quando a ponta passa; anos mono 26 px. |
| `icon` | `icon` (nome do lucide.dev), `preset`, `size`, `container` (`circle`/`pill`/`none`), `label`, `enter` | 130 px padrão; contêiner de vidro `rgba(20,10,25,0.5)`, borda 2,5 px branca 55%, glow de acento respirando; ícone a 52% do contêiner; traço desenha em 14 quadros (26 em `chartUp`). Presets usados: `spin3d`, `chartUp`, `pop`, `pulse`, `bounce`, `drive`, `grow`, `rise`, `float`, `shake`, `blink`, `trail` (existem também `draw`, `spin`, `fill`, `lock`). `label` em pill: Inter 800 a 34% do tamanho. |
| `icons` | (não usado) | grupo em `grid`/`orbit`/`row`, cascata de 3 quadros. |
| `card` | `kicker`, `title`, `subtitle`, `width`, `height`, `enter`, `tilt` | Vidro escuro `rgba(20,10,25,0.45)`, raio 44, borda 2,5 px, reflexo de luz passando; título Inter 900 numa linha (`min(110, (w−80)/(len·0,6))`), kicker mono caixa alta. |
| `shape` | `shape`, `w`, `h`, `toX`, `toY`, `color: "accent"`, `stroke`, `depth: 0` | Formas de traço se desenham em 16 quadros. Usadas: `waves` (ondas sonoras saindo de x/y pra direita — gire com `rotate`; `w` = alcance, `h` = abertura em graus, padrão 100; `stroke` mais grosso = canto mais forte), `crack` (rachadura de x/y até `toX`/`toY` em 8 quadros, pra "quebrar" um texto), `dots` (grade de pontos com onda, passo 46), `ring` (gira 30°/s), `diagonals` (faixas a 28% deslizando), `underline` (onda de acento), `disc` (disco de acento com degradê e glow 120 px), `cross`, `line` (risco de acento, ex.: riscar uma frase), `blob`, `arrow`. Formas de fundo levam `"depth": 0`. |
| `ghost` | `icon`, `size`, `opacity` | Ícone gigante (640 padrão; 780–820 na A), traço fino, blur 5, opacidade 0,13–0,14, girando devagar. |
| `particles` | `count`, `spread`, `kind: "sparks"` | Explosão de 0,9 s (branco, acento, cream, accentLight). |
| `meter` | `kind` (`thermometer`/`gauge`), `value` (0–1), `size`, `label` | 360 px padrão, mola heavy, oscila de leve; preenchimento de acento. |
| `photo` | `id` (obrigatório), `style`, `image {query, treatment, require, id, fillHoles}` (ou `{source: "commons", file, query}` pra pintura, §9.5), `width`, `height`, `images[{id, image}]` (strip), `text` (mask), `side` (split), `rotate`, `tilt`, `focus` [x, y] (0–1: recorte e Ken Burns vão pra esse ponto), `zoomTo` (escala no fim, padrão 1,1) | §4.7.1 |
| `bubbles` | `items`, `every`, `size`, `spread`, `step`, `depth: 2` | Balões de comentário pipocando (squash & stretch), alternando lados, avatar de ícone, o último em acento; pilha sobe 1,1 px/quadro. |
| `ransom` | `text`, `size` | Letras em recortes de papel (cream/ink, paperWhite/ink, accent/branco, ink/cream, newsprint/ink, paperWhite/accent), tamanho ×0,8–1,2, rotação ±9°, 25% minúsculas; largura máx. 900; cada palavra começa 4 quadros depois da anterior e suas letras batem em 2 quadros (escala 1,5→0,92→1,03→1). |
| `clipping` | `text` (`\n`), `sub`, `size`, `rotate` (padrão −3), `enter` | Manchete de jornal rasgada: papel newsprint, Playfair Display 900 (96 padrão), `sub` em mono a 22% com sublinhado. |
| `label` | `text` | Pill mono 26 px, fundo `rgba(14,10,28,0.45)`, borda branca 25%, ponto de acento piscando; letras aparecem a 0,9 quadro/caractere. Usar para fonte do dado (`"Fonte: IBGE (IPCA)"`, `"Fonte: Receita Federal"`) e rótulos técnicos em caixa alta. |
| `building` | ver §4.8 | prédio da analogia |
| `clip` | `style` (`frame`/`torn` = card, `bg`, `strip`), `from` (segundo do arquivo; card e bg), `duration` (1–2 s, padrão 1,6; card e bg), `cuts[{from, duration, note}]` (strip: 2–3 cortes de 0,3–0,8 s, padrão 0,5), `face` (trecho com rosto), `note` (o que aparece, vai pros créditos), `src` (padrão `clips/odisseia-trailer.mp4`), `width`, `height`, `label`, `focus`, `crop` (card, padrão 1,02), `dim` (bg, padrão 0,4), `blur` (bg, padrão 5) | Trecho de filme como **comentário**, sempre mudo (`OffthreadVideo` com `volume={0}`, `muted` e `startFrom`), em três formas que se alternam — regras completas na **§17**. **card**: moldura padrão 860×360 (2,39:1, o formato do trailer em letterbox: o vídeo cobre a moldura e as faixas pretas ficam de fora sem zoom extra; o trailer de referência tem só 640×360, então não aumente a moldura), card branco ou papel rasgado, retícula 0,12 + grão 0,3, rótulo mono, sai sozinho depois de `duration`; ponha sempre um elemento de motion por cima (ondas, seta, rótulo). **bg**: tela cheia atrás de todo o shot (camada própria, fora da câmera virtual), escurecido e com blur, o motion e os textos do shot por cima. **strip**: faixa de filme 960×400 (padrão) com 2–3 cortes rápidos e flash. Sem o arquivo, mostra um aviso no lugar. Os vídeos ficam em `public/clips/` (fora do git). |
| `mast` | `height` (900), `ropes` (4), `tie` (beat), `label` | Mastro com verga, vela recolhida, bandeirola e uma figura de braços colados ao corpo; as cordas de acento se desenham uma a cada 5 quadros a partir de `tie` (swipe por corda), com nó no fim; amarrada, a figura balança sem sair do lugar. |
| `ice` | `label` (`"$"`) **ou** `value` + `prefix`/`suffix` (número conferido, ex. `R$ 100`), `size` (360), `remain` (quanto resta, 1 = inteiro), `melt[{at/enterOnWord, to, duration, ease}]`, `spin` (graus/s), `puddle` (padrão true), `freezeAt` (beat), `caption`, `alert` | Cubo de gelo em CSS 3D (6 faces translúcidas `#F2FCFF → #BFE9FA → #7CCBEA`, borda branca 75%), gira em 3/4; derretendo, baixa (`scaleY = remain`), estreita (`0,5 + 0,5·√remain`), arredonda os cantos, pinga gotas (`#8FD8F5`) e forma poça (magenta se `alert`). O conteúdo fica plano e de frente: `"$"` (42% do tamanho) ou o número (24%, nunca abaixo de 75% da escala, sempre branco). `freezeAt` para o derretimento: brilho e flocos girando. Ver §15. |
| `glass` | `level` (0..1), `moves[{to, duration, ease}]`, `liquid` (`water`/`whiskey`/`beer`), `ice` (cubinhos boiando), `width`/`height` (300×420), `caption` | Copo de vidro em SVG com líquido em degradê, superfície ondulando, bolhas (cerveja) e cubinhos; o nível anda pelos `moves` (salário enchendo o copo). |
| `dominoes` | `items[{icon, label}]`, `fallAt` (beat), `fall` (quantas caem; padrão todas), `every` (0,22 s), `size` (altura 300), `gap` | Peças de vidro escuro com ícone; caem pra direita encostando na próxima (a última deita), ficam em acento e soltam poeira. A caixa já reserva o espaço da última deitada, pra fila inteira caber no quadro. |
| `cycle` | `items[{icon, label}]`, `radius` (300), `every` (0,5 s entre itens), `speed` (voltas/s do brilho) | Anel pontilhado com setas, um trecho de acento e um ponto branco girando; cada item acende quando o brilho passa. |
| `timeline` | `items[{year, label, cut}]`, `every` (0,28 s), `cutAt` (beat), `width`/`height` | Linha do tempo vertical: ano em mono 700 (conferido pela revisão: aparece exatamente como no JSON, sem ponto de milhar), nome da moeda em Inter 800, ponto de acento nas trocas com corte; em `cutAt` (uma troca a cada 0,16 s) a tesoura fecha e o "000" riscado cai. |
| `shape: "sun"` | `w` | Sol forte: disco quente (`#FFF6C8 → #FFD050 → #FF8A2A → #E5521C`), 14 raios girando, halo pulsando. |

#### 4.7.1 Estilos de foto (`KPhoto.tsx`)

Todas recebem nitidez leve + `saturate(0.82) contrast(1.06)`, retícula/grão de impressão e Ken Burns 1,0→1,1 durante o shot.

| `style` | Padrão | Uso na A |
|---|---|---|
| `cutout` | recorte do rembg com sombra, cabe em 620 × 620 | celular (500×760), arroz e feijão (520×520), carrinho (860×660) |
| `torn` | papel rasgado com borda cream, cabe em 760 | etiquetas de preço (420×320, rotate −6), carteira vazia (520×340, rotate 3) |
| `frame` | card branco (padding 10, raio 34); com `width`+`height` o card tem exatamente esse tamanho | calendário, portas de elevador, escada (com `tilt`) |
| `strip` | 3–4 fotos a 9 quadros (0,3 s) cada, flash branco, bolinhas de progresso; 760 × 900 | mercado (800×820), "quem empurra" (820×900) |
| `split` | meia tela (540 × 1920 em `left`/`right`; 1080 × 960 em `top`/`bottom`), abre em 12 quadros, borda de acento de 6 px | arranha-céu (`left`), átrio de elevadores (`top`) |
| `mask` | foto dentro de uma palavra em Anton, contorno branco 5 px; largura 980, fonte = `height` ou `min(560, w/letras·2,05)` | `"CARO"` (800), `"DO PIB"` (900×300) |

### 4.8 A analogia do prédio (`building`)

**Andar = preço, elevador = inflação (velocidade), escada = salário.** Campos: `floors` (10), `width`/`height` (860–900 × 840–920), `elevator { floor, cargo, label, moves }`, `stairs { floor, label, moves, icon }`, `markers [{ floor, icon, label, at/enterOnWord }]`, `gap { from, to, label, at }`, `speed { label }`.

- `moves`: `[{ "enterOnWord": "voando", "wordOffset": -0.45, "to": 10, "duration": 0.55, "ease": "fast" }]`; eases `fast` `(0.55,0,0.15,1)` com balanço na chegada, `slow` `(0.35,0,0.65,1)`, `smooth` (inOutCubic). Andares fracionados valem (`9.55` faz o elevador "ameaçar descer").
- Cabine em degradê de acento com até 2 ícones lucide de carga (`["wheat", "milk"]` ou `["shopping-cart"]`); `label` em pill branca mono 26 px caixa alta (`"preço"`, `"carrinho"`).
- Escada à esquerda com bonequinho (`person-standing` num círculo cream de raio 46, gotas de suor ao subir); `label` em pill escura.
- `markers` à direita (pill Inter 800 28 px com ícone); `gap` = chave de acento + rótulo Inter 900 34 px (aceita `\n`, ex. `"7\nandares"`); `speed` = velocímetro ligado à velocidade real do elevador.
- Sequência do 001: apresenta (s5b: sobe ao 6º em "andar"), voa (s6a: 1→3 devagar, →10 rápido em "voando"), sobe devagar (s6b), não desce (s6c: 10→9,55→10), comida (s7c: 8→9 com marcadores 2024/2025), salário na escada (s10b: escada 1→3 em 3 s), pergunta final (s11b/s11c: elevador no 10, dinheiro no 3, chave "7 andares").

### 4.9 Transições (`src/components/transitions/kineticTransitions.tsx`)

| Nome | Quadros | Visual | Som |
|---|---|---|---|
| `zoom` | 10 | entra de 0,7× (outBack); sai crescendo +0,9× com blur 14 | whoosh |
| `whip` | 10 | whip pan horizontal com blur direcional até 70 | whoosh |
| `circle` | 12 | círculo abrindo em (50%, 42%) | whoosh |
| `wipe` | 12 | diagonal com faixa de acento de 26 px | swipe |
| `glitch` | 4 | jitter ±40 px, hue-rotate, fatia em `screen` | glitch |
| `flash` | 2 | branco translúcido (0,55 saindo / 0,22 entrando), conteúdo sempre visível; **exclusiva** | hit |
| `invert` | 4 | os 2 últimos quadros da cena que sai invertidos (fundo incluído), depois corte seco; **exclusiva** | glitch |
| `slide` | 12 | entra de baixo com overshoot | swipe |
| `morph` | 14 | cena nova nasce num quadrado arredondado girando 45° | whoosh-long |
| `cut` | 0 | corte seco / match cut | — |

- O 1º shot é sempre `cut`. Sem `transition` (ou `"auto"`), sorteia do pool `zoom, whip, circle, wipe, glitch, flash, invert, slide, morph` com `random("<seed>-tr-<i>")`, sem repetir a anterior nem a próxima pedida.
- **Conflito de texto:** cada shot tem faixas verticais de texto grande — `text` ≥ 56 px não-outline (`size·1,1·linhas`), `ransom` (`size·1,4`, padrão 150), `clipping` (`size·(linhas+0,8)·1,15`, padrão 96), `number` (`size·1,1`, padrão 300), `bars` (`height + 140`), `line` (`height + 120`), `photo mask` (`height` ou 360). Se faixas de dois shots seguidos ficam a menos de 40 px uma da outra, o sorteio só usa `flash`/`invert`; transição pedida no JSON vira uma delas, exceto `cut`/`flash`/`invert`, que valem.
- Duração real = `min(quadros da transição, quadros do shot − 2, quadros do próximo − 2)`; a transição acontece por cima do começo do shot novo.

### 4.10 Pattern interrupts e paletas por shot

- `"interrupt": "black"` (`#07060c`), `"white"` (`#f4f1ea`, texto vira ink `#141416`) ou `"accent"`: fundo chapado no lugar do gradiente, com **riser** 36 quadros antes + **hit** no corte. Na A: s2b, s6d, s8d (preto: revelações com ransom sobre `blob` de acento) e s3c, s11a (branco). Interrupts nunca são espelhados na B.
- `"palette"` no shot troca a paleta do fundo com fade de 20 quadros; shot sem `palette` volta à paleta do vídeo.

### 4.11 Legendas (`KineticCaptions.tsx`, `CollageCaptions.tsx → toBlocks`)

- Blocos de **até 5 palavras e 34 caracteres** (no máximo 2 linhas), cortados por frase (`. ! ? …`) e por custo: penalidade +100 para bloco que termina em palavra "pendurada" (artigos, um/uma, preposições e contrações, conjunções, possessivos, "não", "mais/menos/muito", "é/são/foi/era/está/tá/vai/vão"…), +50 para separar faixas numéricas ("entre 4 | e 5%"), −4 para terminar em vírgula/ponto e vírgula/dois pontos, +15/+6 para blocos de 1/2 palavras em frases com 3+, e `(n−4)²·0,3`.
- Caixa centrada em y 1380, largura 840, Inter 800 **56 px**, `lineHeight 1.18`, `letterSpacing −0.02em`, branco sobre placa `rgba(14,10,28,0.62)` com raio 28 e sombra; entra em 7 quadros subindo 22 px; fica 250 ms depois da última palavra.
- Palavra falada: destaque de acento que cobre a palavra inteira (só altura 0,7→1 e opacidade animam) com glow; o texto da palavra ativa fica `#fff`.

### 4.12 Fundo (`FluidBackground.tsx`)

Gradiente fluido WebGL (fbm com domain warping, canvas 270 × 480 ampliado), 5 cores com áreas escuras de verdade e vinheta, velocidade `speed` 0,3, pulso nos impactos; por cima, 9 formas de contorno branco (16–28%) flutuando e `textures/grain.png` a 16%.

### 4.13 Roteiro de referência da A (`rikuai-001-elevador`)

Voz Liam, 12 cenas, 37 shots. Durações = valores do JSON (antes do retiming).

| Shot | Dur. | Transição | Paleta / interrupt | Composição |
|---|---|---|---|---|
| s1a | 1.5 | (1º) | — | `dots` + `ring` no fundo, `text` impact "INFLAÇÃO" 186 (at −0.15), ícone `percent` spin3d, `label` |
| s1b | 2.0 | zoom | — | `diagonals`, 2 `card` (2019–2022 / 2023–2025), "VS" display com plate, ícone `chart-line` chartUp, `underline`, `clipping` "INFLAÇÃO\nMENOR" 66, label no canto (235, 310) |
| s1c | 1.5 | auto | — | `ghost` landmark, `card` 820×440 zoom+tilt, ícone trending-up, underline, label |
| s2a | 2.4 | whip | — | `disc` acento, `text` mask 2 linhas 92 @365, foto `cutout` celular, `bubbles` (5 comentários), pill "comentários" @1225 |
| s2b | 2.1 | glitch | black | `ring` acento, `text` type mono 58 @540, `ransom` "IBGE" 200, 2 `cross`, label |
| s3a | 2.4 | flash | heat | `text` scale "EM 2021" @400, foto `torn`, termômetro 0.95, `number` 10.06% 300 (`sfx: riser`), label no canto |
| s3b | 2.7 | cut | — | `bars` 2019–2025 (y 810) com `morphFrom: 2` e `bracket` "4 a 5% ao ano", `text` scale/line "DE 2023\nPRA CÁ" 72 em (790, 500) (fora da faixa dos valores das barras), label |
| s3c | 0.8 | auto | white | `ransom` "4 A 5%" 190, underline |
| s3d | 1.1 | auto | — | foto `frame` calendário, `text` mask "AO\nANO" 160, ícone calendar-days |
| s4a | 1.4 | circle | — | "ENTÃO POR QUE" 84 @330, foto `strip` (4), pill "mercado" (drive) |
| s4b | 2.1 | slide | — | `diagonals`, `text` blur 74 @320, foto `mask` "CARO" (impact), "?" display acento 190, pill "carrinho" |
| s5a | 2.0 | invert | — | foto `split` left, `clipping` "PENSA\nNUM\nPRÉDIO" 84, ícone building-2 grow |
| s5b | 3.2 | auto (`cutOnWord: "O"`) | — | "PREÇO = ANDAR" 74 @300, `building` (sobe ao 6º, marcador) |
| s5c | 2.8 | invert | — | `text` mask com `highlight` VELOCIDADE @400, foto `frame` portas, `gauge` 0.85, ícone arrow-big-up |
| s6a | 2.8 | auto | heat | `building` + `speed`, `ransom` "VOANDO" 110 @365 |
| s6b | 2.2 | auto | — | "AGORA: DEVAGAR" 88 @300, `building`, ícone snail |
| s6c | 1.6 | auto | — | `building` scale 1.45 em y 1150, ícone arrow-big-down shake, `line` acento |
| s6d | 1.4 | glitch | black | `blob`, `ransom` "NÃO DESCE" 150, ícone ban |
| s7a | 2.6 | auto | heat | `outline` "COMIDA" 330, foto `cutout` comida, `number` +7.69% 250 com label, ícones |
| s7b | 2.6 | auto | — | `clipping` "DESACELEROU" 74 @370, `bars` 720×470 em y 950 com `display`, `arrow` (430, 685)→(640, 910), ícone, label |
| s7c | 2.8 | glitch | — | `building` 8→9 com 2 marcadores |
| s8a | 2.2 | auto | — | foto `split` top, `text` line "QUEM EMPURRA\nESSE ELEVADOR?" 88 @1110 |
| s8b | 1.3 | invert | — | foto `strip` energia/combustível/caminhão/dólar |
| s8c | 2.9 | auto (`cutOnWord: "transporte,"`) | — | `dots`, 4 pills (energia, combustível, transporte, dólar), arrow-big-up 220 |
| s8d | 1.6 | glitch | black | `blob`, type "e…", `ransom` "IMPOSTO" 120, ícone landmark shake |
| s9a | 2.4 | auto | heat | `ghost`, `diagonals`, type "EM 2024", mask "CARGA\nTRIBUTÁRIA" 132, ícones landmark/weight |
| s9b | 2.6 | cut (`cutOnWord: "32,2%"`) | — | título 54 @320, `number` 32.2% 300 @590, foto `mask` "DO PIB", label |
| s9c | 2.6 | cut (`cutOnWord: "A"`) | — | type "% DO PIB", `bars` 2023/2024 + bracket "+1,98 p.p.", ícone, label |
| s9d | 2.2 | cut (`cutOnWord: "segundo"`) | — | `dots`, `outline` "22" 640, `clipping` "A MAIOR\nEM 22 ANOS" 100, underline, ícone, label |
| s10a | 2.4 | invert | — | type "enquanto isso…", foto `frame` escada, `ransom` "SALÁRIO" 130 @1110 |
| s10b | 3.6 | auto (`cutOnWord: "vai"`) | — | `building`: elevador no 9 com carrinho, escada 1→3 "salário" |
| s11a | 2.8 | flash | white | type "a pergunta não é:", `clipping` "QUANTO FOI A\nINFLAÇÃO?", `line` riscando (impact), foto `torn` carteira |
| s11b | 2.0 | cut (`cutOnWord: "É:"`) | — | `text` impact "ATÉ QUE ANDAR?" 104 @310, `building` scale 0.92 |
| s11c | 3.2 | zoom (`cutOnWord: "seu"`) | — | `building` com `gap` 3→10 "7\nandares" |
| s12a | 1.6 | auto | — | `outline` "%" 1000, `text` line "NÃO VIVE DE\nPERCENTUAL" 110, `line` acento |
| s12b | 2.2 | auto | — | título 58 @290, `ransom` "CARRINHO" 112 @450, foto `cutout` carrinho, 3 ícones `drop` (apple, milk, wheat) |
| s12c | 2.2 | auto (`cutOnWord: "Quer"`) | rikuai | `dots`, `disc`, "pra onde o seu tá indo?" 58 @380, "RikuAI" display impact 210, `particles` sparks, pill "LINK NA BIO" 150 @1040 |

Padrões que se repetem: abrir com palavra de impacto já em movimento (`at` negativo); número herói sempre com `impact` e, quando é revelação, `"sfx": "riser"`; revelações curtas (0,8–1,6 s) em interrupt preto/branco com `ransom`; gráficos sempre com `label` de fonte; o CTA final é `"RikuAI"` + pill `"LINK NA BIO"` (o `cta` da marca é "Link na bio").

---

## 5. Versão B — o que muda em relação à A

Derivada por `deriveB` em `scripts/make-all.mjs`:

| Campo | Valor na B |
|---|---|
| `id` / `composition` / `title` | `<id>-b` / `<composition>B` / `<title> (B)` |
| `baseOf` | id da A |
| `background` | o da A com `"palette": "rikuai"` (mantém `speed` 0.3) |
| paletas dos shots | `sunset-dark` → `rikuai`, `sunset` → `rikuai`, `heat` → `rikuai-heat` (outras ficam, ex.: o `rikuai` do CTA) |
| `seed` | `<id>-b` (muda o sorteio das transições `auto`; as pedidas no JSON continuam iguais) |
| `layout` | `{ "seed": "<id>-b", "mirror": 0.5 }` |
| `photos` | `{ "avoidFrom": ["<id>"] }` |
| `voice` | cópia de `brand.voices.b` (Sarah) |
| `audio` / `captions` | `null` até rodar `voice:generate` |
| `hookAlt` / `altB` | removidos; cada item (`{ scene, narration, shots? }`) troca a `narration` da cena indicada e, se tiver `shots`, os shots dela. `hookAlt` é o gancho; `altB` serve pra qualquer outra cena (no 002: cena 12 sem "Meu irmão", cena 18 sem a história pessoal, cena 20 com o CTA RikuAI) |
| `voice.pronunciation` | as da marca (`voices.b`) somadas às do roteiro A (ex.: `iFood`, `Shopee`) |

**Espelhamento** (`src/templates/variant.ts`): para cada shot, se `random("<seed>-mirror-<shotId>") < 0.5`, todos os elementos ganham `x → 1000 − x`, `rotate → −rotate`, `toX` espelhado nas formas e `side` trocado (`left`↔`right`) na foto `split`. Nunca espelha o 1º shot, shots com `interrupt` nem shots com `"mirror": false`. Marque `"mirror": false` em shots que, espelhados, ficariam ruins (na B do 001: s5c e s11c).

**Gancho alternativo:** escrito no roteiro A como `hookAlt`. No 001:

```jsonc
"hookAlt": [
  { "scene": "governo", "narration": "A inflação no Brasil tá menor do que nos últimos anos.",
    "shots": [ /* s1a: disc + dots + "INFLAÇÃO" impact 180 + pill "Brasil" (map-pin bounce);
                  s1b (cutOnWord "menor"): "MENOR" 150 @360 + trending-down + line 2021–2025 + label */ ] },
  { "scene": "comentarios", "narration": "E isso não é opinião: quem diz é o IBGE.",
    "shots": [ /* s2a (whip): diagonals + type "não é" + clipping "OPINIÃO" (sub ACHISMO) + risco de acento;
                  s2b (glitch, black, cutOnWord "quem"): blob + type "quem diz é o" + ransom "IBGE" + label */ ] }
]
```

O gancho da B troca a comparação política por uma afirmação neutra + autoridade da fonte; os shots trocados repetem a receita da A (palavra de impacto, gráfico com fonte, revelação em interrupt preto).

**Voz da B:** feminina calma, escolhida entre no máximo 3 candidatas *premade* testadas: Sarah `EXAVITQu4vr4xnSDxMaL`, Matilda `XrExE9yKIg1WjnnlVkGX`, Lily `pFZP5JQG7iQjIQuC4Bku` (`voice.candidates`, `voice.testText` e `npm run voice:generate -- <id>-b --test`). Escolhida: **Sarah**, `stability 0.55`, `similarity_boost 0.75`, `style 0.2`, `speed 1.0`.

**Fotos:** todas diferentes das da A (`avoidFrom`). Um `image.id` fixado que caia nas fotos da A é ignorado e a foto é buscada de novo pela `query`. Na B do 001 algumas buscas foram trocadas à mão por fotos equivalentes (`"supermarket shelves"`, `"elevator door"`, `"rice bag isolated"` em 420×430, `"cable winch machine"`, `"fuel nozzle"`), fixadas com `id`.

**Ajustes manuais permitidos depois da derivação** (exemplos da B do 001, feitos para passar na revisão): mover elementos alguns px (barras de s3b em y 850 na B contra 810 na A; textos de s2a), `mirror: false`, `at` de uma foto. Esses ajustes se perdem com `--rederive`; correções que valem para as duas versões (ex.: s3b e s7b do 001) devem ser feitas no roteiro A **e** na B.

---

## 6. Versão C — WireframeExplainer (holograma 3D)

"Visualização científica": objetos em malha (triângulos brancos translúcidos + bordas ciano com bloom), sala com chão de grade infinito e paredes de hexágono, partículas, arcos de luz orbitando, scanlines, glitch nos cortes e câmera sempre em movimento (`src/templates/WireframeExplainer.tsx`, `WireShot.tsx`, `src/components/wire/*`).

### 6.1 Derivação e áudio

`deriveC` (a partir da **B**): `id` `<id>-c`, `composition` `<composition>C`, título `(C)`, `"template": "WireframeExplainer"`, `"audioFrom": "<id>-b"`, `audio`/`captions` = os da B, remove `voice`, `photos` e `layout`, `seed` = `<id>-c`. A C **não gera narração**: as cenas precisam ter exatamente a mesma `narration` da B (mesmo número de palavras), senão o retiming é desligado com aviso. O derivado é só um ponto de partida: no 001, todos os shots da C foram reescritos à mão (ids `c1a…c12c`, elementos `keyword`, bloco `wire`).

### 6.2 Cores (`src/components/wire/theme.ts`)

| Token | Hex | Uso |
|---|---|---|
| `bg0` | `#02060D` | fundo, névoa, cor do texto ativo da legenda |
| `bg1` | `#061A2E` | topo do domo de fundo (degradê `smoothstep(−0.3, 0.6, y)`) |
| `white` | `#E8F4FF` | triângulos da malha, partículas brancas |
| `cyan` | `#2EE6F0` | bordas, arcos, HUD, destaque da legenda |
| `cyanDim` | `#0E5A66` | linhas secundárias da grade, hastes |
| `alert` | `#FF2E63` | **tudo que é negativo**: preço subindo, imposto, carrinho caro, barra destacada, palavra-chave com `alert` |

As cores "acima de 1" (`glow(hex, k)`, materiais com `toneMapped={false}`) é que fazem o bloom pegar.

### 6.3 Palcos (`wire.stage`)

Sem `wire.stage`, o palco é deduzido: `building` → building; `bars` → bars; `line` → line; `number` ou termômetro → number; ícone `shopping-cart` ou foto com "cart/carrinho" → cart; resto → core.

| Palco | O que mostra | Câmera inicial (`STAGE_CAM`: órbita°, raio, altura) | Paredes por padrão |
|---|---|---|---|
| `head` | cabeça escaneada (LeePerrySmith, escala 0.3) em malha + cérebro procedural que acende em magenta com faíscas de sinapse a partir de `alertAt`; 3 arcos r 1.95, pedestal r 1.8, feixe | [−32, 18], [7.6, 6.8], [0.3, 0.7], fov 38 | sim |
| `bars` | barras 3D (largura 6,6, altura 5, topo = máx × 1,08), destacada em magenta; base em malha | [−26, 22], [17, 15.5], [2.4, 3.2] | sim |
| `line` | tubo ciano que se desenha em 1,1 s, pontos em malha (o 1º em magenta), hastes até o chão | [−14, 14], [14, 12.8], [1.4, 1.9] | não |
| `number` | termômetro (se o shot tem `meter` thermometer; líquido magenta sobe em 1 s) ou núcleo magenta; pedestal magenta r 0.8 | [−30, 30], [12, 11], [1.0, 1.4] | não |
| `cart` | carrinho construído por código; as compras (miolo) acendem em magenta a partir de `alertAt`; `priceTag` = etiqueta magenta balançando em (1.5, 2.7); 2 arcos r 2.3, pedestal r 2.3 | [38, −16], [14, 12.5], [2.2, 2.8] | sim |
| `core` | núcleo genérico (icosaedro + octaedro girando); 3 arcos r 2.55, pedestal r 2, feixe | [−25, 25], [8.5, 7.5], [0.8, 1.4] | não |
| `building` | prédio em corte (§6.6) | [−22, 18], [14, 12.5], [1.2, 2.0] | sim |
| `food` | saco de arroz + caixa de leite girando; 2 arcos r 2.25, pedestal r 2.25 | [−30, 30], [8, 7], [0.8, 1.2] | não |
| `cables` | casa de máquinas: motor girando no topo, 3 cabos, cabine magenta puxada pra cima a cada etiqueta (`tags`) | [−18, 18], [11, 10], [0.6, 1.2] | não |
| `end` | núcleo pequeno (0,6×) + arcos r 1.6 + pedestal + feixe; logo "RikuAI" em holograma | [−20, 20], [8.5, 7.5], [0.6, 1] | não |
| `ice` | **bancada**: os elementos `ice` (cubo de malha 2,1 com cifrão em tubo ciano dentro, derretendo em partículas, poça no chão; magenta se `alert`; `freezeAt` = faíscas brancas) e `glass` (copo de malha com líquido aditivo ciano/âmbar e cubinhos), lado a lado a cada 3,1; `wire.sun` = sol de malha âmbar `#FFB547` com halo e raios, no alto à direita do 1º cubo; `wire.freezer` = freezer de malha à direita | [−22, 18], [9, 8], [1.6, 2.2] | não |
| `dominoes` | dominós de malha (2,2 × 1,2 × 0,3, passo 1,5) caindo pra direita a partir de `fallAt`; os caídos ficam magenta | [−28, 10], [10, 9], [1.4, 2.0] | não |
| `cycle` | anel de luz (raio 2,2) com os nós (octaedros) entrando a cada `every`, um arco ciano e um ponto branco girando (`speed`); `wire.alert` = tudo magenta | [−16, 16], [9, 8.2], [0.2, 0.6] | não |
| `zeros` | três zeros 3D caem; em `cutAt` um laser magenta passa e cada zero parte ao meio (a metade de cima sobe, a de baixo cai), em magenta. A linha do tempo (`timeline`) vira HUD à esquerda (anos conferidos); o 3D fica em x 600–960 | [−24, 12], [9, 8], [0.4, 1.0] | não |
| `pizza` | pizza de malha âmbar com 8 fatias e pepperonis (magenta se `alert`) + arcos | [−30, 30], [8, 7], [1.2, 1.8] | não |
| `clock` | relógio de malha com ponteiros girando rápido (trabalhar mais) | [−20, 20], [8, 7.2], [0.2, 0.5] | não |

Palcos da Odisseia (`src/components/wire/odyssey.tsx`, rikuai-003), todos com o **mar em malha** no lugar da grade (menos `temptation`):

| Palco | O que mostra | Campos de `wire` (`WireSpec` em `kineticTypes.ts`): `stage`, `alert` (acende o objeto em magenta desde o início), `alertAt` (beat: `at`/`enterOnWord`/`wordOffset`; acende o miolo — cérebro, compras, etiqueta — nessa palavra), `walls`, `priceTag`, `tags` (cables: `[{ text, enterOnWord, wordOffset, alert, big }]`), `sun` e `freezer` (palco `ice`), `camera` (`orbit`, `radius`, `height`, `travel`, `fov`). Sem `wire.stage`: `ice`/`glass` → ice, `dominoes` → dominoes, `cycle` → cycle, `timeline` → zeros.

### 6.4 Câmera e enquadramento automático (`src/components/wire/camera.ts`)

- `camera`: `orbit` [graus início, fim], `radius` [início, fim], `height` [início, fim], `travel` [x, y, z], `fov` (padrão 40). Padrão geral: órbita [−18, 18], raio [9, 8], altura [1.2, 1.6]. **O alvo é sempre o centro do palco** (não há `target` no JSON: o `fitCamera` o substitui), e `radius`/`height` valem só como **proporção** início→fim e entre si (a escala vem do enquadramento): `[10, 14]` afasta durante o shot, `[13, 11.2]` aproxima.
- Movimento: interpolação `bezier(0.45, 0, 0.25, 1)` ao longo do shot; **punch-in** de 12% mais longe que assenta em 9 quadros; deriva de ±1,5° na órbita e ±0,05 no alvo. Câmera nunca parada.
- **`fitCamera`**: o alvo vai pro centro da caixa do palco (`stageBox`: objeto + arcos + rótulos projetados), a imagem é deslocada (`setViewOffset`) para esse centro cair no meio de `stageRect`, e a distância (raio e altura juntos) é a **menor** em que a caixa inteira cabe no retângulo em **todos** os quadros do shot (amostra a cada 3 quadros; busca binária do multiplicador entre 0,25 e 8, 22 iterações). Se não cabe, a câmera recua. Por isso os arcos de luz nunca cruzam texto: eles estão dentro da caixa, e a caixa fica fora das zonas de texto.
- `stageRect` (área permitida do objeto): topo **575** se o shot tem texto digitado/mono, senão **495**; `number` x 640–960, y topo–1215; `food` x 70–960, y 770–1215; `end` x 120–960, y 800–1120; demais x 60–960, y topo–(1215 − 56·(nº de labels − 1)); `building` sem nenhum `label` desce até 1255. A borda direita nunca passa de **x 960** (abaixo de y 1100 ficam os botões do TikTok), por isso o centro do objeto fica perto de x 510.
- Névoa relativa à câmera: `fog(bg0, max(8, dist − 4), max(34, dist + 22))`, assim uma câmera afastada não apaga o objeto.

### 6.5 Sala, malha e pós (`Room.tsx`, `Wire.tsx`, `WireframeExplainer.tsx`)

- Chão: `gridHelper` 160 × 80 divisões em y −2.2 (cyan/cyanDim), deslizando 0,4/s. Paredes: grade de hexágonos 26 × 16 (lado 0,9) a 14 de distância em três lados, opacidade 0,32 pulsando. 420 partículas subindo (70% ciano 0,05, 30% brancas 0,035).
- Malha (`WireMesh`): `wireframe` aditivo com opacidade 0,14 (padrão) + `EdgesGeometry` (ângulo 25° padrão) em ciano com glow 1,6; `alert` troca ambos por magenta. `Core` = sólido aditivo magenta (o "miolo").
- Arcos (`OrbitArcs`): toros de 0,55π com ponta de cone, girando em sentidos alternados.
- Pós-processamento: **Bloom** intensity 1.25, luminanceThreshold 0.22, smoothing 0.2, mipmapBlur, radius 0.7; **ChromaticAberration** 0.0006 constante, subindo para `0.012·(1 − k/4) + 0.002` nos 4 quadros de um corte glitch.
- Overlay HTML: scanlines ciano `#9FF6FF` a 9% (com flicker), vinheta radial, faixa de varredura descendo, faixa de glitch (140 px ciano a 18% + tremida ±30 px) nos cortes glitch, flash `#DFFBFF` (0,42 e 0,2) nos cortes flash.
- Canvas: antialias, `fov 40`, near 0.1, far 400; domo de fundo de raio 200.
- Abertura com trechos de filme: monitor holográfico (`holoIntro`, `src/components/wire/HoloMonitor.tsx`) nos primeiros 5 s — ver **§17.2**.

### 6.6 Prédio 3D (`src/components/wire/building.tsx`)

Mesmos campos do `building` do Kinetic. Andar 0,55, largura 3, profundidade 1,8; janelas piscando; poço e cabo ciano; **cabine magenta quando `alert` ou velocidade > 3 andares/s**, com linhas de velocidade magenta; carga 3D (`"milk"` → caixa de leite, `"shopping-cart"` → carrinho magenta, qualquer outro → saco de arroz; padrão `["wheat", "milk"]`); escada em linha ciano com o **X Bot** (Mixamo) andando (`walk`) quando sobe e em `sad_pose` parado; marcadores = traço ciano + HUD; `gap` = chave magenta + HUD magenta 36 px; `speed` = velocímetro 3D com ponteiro (magenta acima de 30%). Rótulos HTML: marcadores HUD 34 px ancorados à esquerda e afastados no mínimo 78 px na vertical; velocímetro 28 px; elevador e escada 30 px seguindo o objeto. Todo HUD preso a objeto é empurrado pra dentro do quadro (x 40–1040; até x 950 quando passa de y 1100), pela largura estimada do texto mono.

### 6.7 Texto na C (`WireShotHtml`)

| Elemento do shot | Vira |
|---|---|
| `keyword`, `ransom`, `clipping`, `text` ≥ 56 px (não outline, não `type`, não mono) | **palavra-chave**: Inter 900, caixa alta, branca, contorno preto `max(6, 7% do tamanho)` (`paint-order: stroke fill`), sombra `0 10px 0 rgba(0,0,0,0.55)` + glow ciano (magenta se `alert`, `clipping` ou `ransom`); tamanho `min(size ?? 150, 170, 930 / max(3, letras·0,74))`; entra com mola (damping 11, stiffness 220, mass 0,6) de 1,25× e glitch de 3 quadros com cópias ciano/magenta deslocadas 10 px. **Uma por vez**: some quando entra a próxima. |
| `text` com `effect: "type"`, ou `font: "mono"`, ou < 56 px | **HUD** em (540, 520), Space Mono 700 34 px, caixa alta, borda 2 px ciano a 75%, fundo `rgba(2,6,13,0.78)`, quadradinho piscando a cada 8 quadros; com `type`, revela **palavra inteira** a cada 4 quadros |
| `label` | HUD 26 px em y 1262 (empilha −56 px) |
| `icon` com `label` (e nenhum `label` no shot) | HUD 30 px em y 1262 (44 px em y 1180 no palco `end`) |
| `number` | **número herói** (encolhe pra caber na área à esquerda do objeto: largura `2·(x − 50)`, dígito ≈ 0,55 do tamanho) em Space Mono 700, `#EFFFFF`, contorno preto 6 px, `letterSpacing −0.1em`, glow ciano (magenta se `wire.alert`); conta em ≤ 0,4 s; `label` em mono 700 34 px |
| `bars`/`line` | **NumTag** colado no topo de cada barra/ponto (projetado do 3D): mono 700 branco, fundo `rgba(2,6,13,0.86)`, borda 2 px ciano (magenta no destaque / 1º ponto); tamanho = o maior que cabe entre colunas, `min(46, max(principal ? 34 : 20, …))`; principais = destacadas + 1ª + última (linha: 1º e último). Anos embaixo em mono 700 ciano `min(34, max(26, …))`. Barra: valor aparece com pop 12 quadros depois de a barra começar a crescer. |
| palco `end` | logo **"RikuAI"** Anton 210 px em (540, 690), `#EFFFFF`, contorno ciano 3 px, glow, flicker |
| `photo`, `shape`, `ghost`, `card`, `bubbles`, `particles`, `meter` (não-termômetro), ícone sem rótulo | ignorados |

Consequências práticas: palavras-chave curtas (1–3 palavras, ≤ ~15 letras para ficarem grandes); `number` só nos palcos `number` e `food` (nos outros ele cai em (540, 760), dentro da área do objeto, e a revisão reprova a sobreposição); texto digitado empurra o objeto para baixo (topo 575).

### 6.8 Cortes da C

Todos os cortes são secos (shots em `Sequence`, sem sobreposição); o efeito fica por conta da câmera e do overlay.

| Corte | Quadros | Visual | Som |
|---|---|---|---|
| `glitch` | 4 | aberração cromática forte + faixa ciano + tremida | glitch |
| `zoom` | 8 | punch-in da câmera (que todo shot já tem) | whoosh |
| `flash` | 2 | lavagem `#DFFBFF` em `screen` | hit |
| `cut` | 0 | — | — |

Sem `transition`, sorteia entre `glitch` e `zoom` sem repetir o anterior (`random("<seed>-cut-<i>")`). No JSON: `glitch` → glitch, `invert` → glitch, `flash` → flash, `cut` → cut, **qualquer outro** → zoom. **Flash só quando pedido** (num fundo escuro vira um quadro cinza; a C do 001 não usa). O 1º shot é sempre `cut`.

### 6.9 Como escrever um shot da C

```jsonc
// palco "cart": carrinho que acende em magenta na palavra "caro?"
{ "id": "c4b", "duration": 2.1, "cutOnWord": "continua", "transition": "glitch",
  "wire": { "stage": "cart", "alert": false, "priceTag": true,
            "alertAt": { "enterOnWord": "caro?", "wordOffset": -0.15 },
            "camera": { "orbit": [-24, -6], "radius": [13, 11.2], "height": [2.0, 2.6] } },
  "elements": [
    { "type": "keyword", "text": "CARO", "enterOnWord": "caro?", "wordOffset": -0.15, "size": 230, "alert": true, "impact": true },
    { "type": "label", "text": "PREÇO ↑", "at": 0.4 }
  ] }

// palco "number": termômetro à direita, número herói à esquerda
{ "id": "c3a", "duration": 3.6,
  "wire": { "stage": "number", "alert": true,
            "camera": { "orbit": [-10, 24], "radius": [12.5, 11.2], "height": [0.8, 1.4] } },
  "elements": [
    { "type": "keyword", "text": "EM 2021", "at": -0.1 },
    { "type": "number", "value": 10.06, "suffix": "%", "size": 250, "enterOnWord": "10%.", "wordOffset": -0.35, "impact": true },
    { "type": "meter", "kind": "thermometer", "value": 0.95, "at": 0.2 },
    { "type": "label", "text": "Fonte: IBGE (IPCA)", "at": 0.6 }
  ] }

// palco "cables": cada etiqueta entra na sua palavra; a do imposto é grande e magenta
{ "id": "c8b", "duration": 5.8, "cutOnWord": "Energia,",
  "wire": { "stage": "cables", "camera": { "orbit": [-12, 16], "height": [0.4, 1.4] },
            "tags": [
              { "text": "energia", "enterOnWord": "Energia,", "wordOffset": -0.05 },
              { "text": "combustível", "enterOnWord": "combustível,", "wordOffset": -0.05 },
              { "text": "transporte", "enterOnWord": "transporte,", "wordOffset": -0.05 },
              { "text": "dólar", "enterOnWord": "dólar…", "wordOffset": -0.05 },
              { "text": "IMPOSTO", "enterOnWord": "imposto.", "wordOffset": -0.15, "alert": true, "big": true } ] },
  "elements": [
    { "type": "keyword", "text": "O QUE EMPURRA", "at": 0.0 },
    { "type": "keyword", "text": "IMPOSTO", "enterOnWord": "imposto.", "wordOffset": -0.25, "alert": true, "impact": true }
  ] }
```

Receita usada em toda a C do 001: cada shot tem **um** palco, **uma** palavra-chave por vez (às vezes duas em sequência), opcionalmente um HUD digitado com a frase de apoio em minúsculas (`"effect": "type", "font": "mono", "size": 40`) e um `label` de fonte. `alert: true` na palavra-chave e no `wire` para o que é negativo. Câmera variando de lado entre shots seguidos (órbitas positivas e negativas alternadas). Cortes entram em `cutOnWord` para cair na fala da B.

### 6.10 Roteiro de referência da C

| Shot | Dur. | Corte | Palco (`wire`) | Elementos |
|---|---|---|---|---|
| c1a | 1.6 | (1º) | head, walls, `alertAt` "inflação" +0.1 | keyword INFLAÇÃO (impact, at −0.1), keyword NO BRASIL |
| c1b | 2.4 | auto | line | keyword MENOR, line 2021–2025, label |
| c2a | 1.6 | glitch | head, `alertAt` "opinião:" | HUD "não é", keyword OPINIÃO (alert) |
| c2b | 1.8 | zoom | core, walls | HUD "quem diz é o", keyword IBGE 230 (impact), label |
| c3a | 3.6 | auto | number, alert | keyword EM 2021, number 10,06%, termômetro, label |
| c3b | 2.8 | glitch | bars, walls | keyword DESDE 2023, bars 2019–2025, label |
| c3c | 1.8 | auto | bars (de cima: órbita [24, 40], altura [4.0, 4.6]) | keyword 4 A 5% AO ANO, bars com `at: -1` (já crescidas) |
| c4a | 1.4 | zoom | cart, walls | keyword POR QUÊ?, ícone com label "mercado" |
| c4b | 2.1 | glitch | cart, priceTag, `alertAt` "caro?" | keyword CARO (alert), label PREÇO ↑ |
| c5a | 2.0 | glitch | building | HUD "pensa num", keyword PRÉDIO |
| c5b | 3.2 | auto | building | keyword PREÇO = ANDAR, elevador 1→6, marcador |
| c5c | 2.8 | zoom | building | HUD "a inflação é a", keyword VELOCIDADE (alert), velocímetro, elevador 6→9 fast |
| c6a | 2.8 | glitch | building | keywords EM 2021 / VOANDO (alert), elevador 1→3→10, escada 1→1.6, marcador 2021 |
| c6b | 2.2 | auto | building | HUD "agora ele sobe", keyword DEVAGAR, elevador 5→6.2→8, escada 1.6→2.1 |
| c6c | 3.0 | glitch | building | HUD "mas repara:", keyword NÃO DESCE (alert), elevador 10→9.55→10 |
| c7a | 2.6 | zoom | food, alert | keyword COMIDA, number +7,69% (label ALIMENTOS · 2024, riser), label |
| c7b | 2.6 | glitch | food | keyword DESACELEROU, number +2,95%, label |
| c7c | 2.8 | auto | building | keyword NÃO VOLTOU (alert), elevador 8→9, marcadores 2024/2025 |
| c8a | 2.2 | zoom | cables (sem etiquetas) | keyword QUEM EMPURRA? |
| c8b | 5.8 | auto | cables + 5 tags | keywords O QUE EMPURRA / IMPOSTO (alert) |
| c9a | 3.6 | glitch | core, alert, walls | HUD "em 2024", keyword CARGA TRIBUTÁRIA (alert) |
| c9b | 2.6 | cut | number, alert | keyword DO PIB, number 32,2% (label CARGA · 2024), label |
| c9c | 3.6 | cut | bars, alert, walls | keyword MAIOR EM 22 ANOS (alert), bars 2023/2024, label |
| c10a | 6.0 | zoom | building | HUD "enquanto isso,", keywords SALÁRIO / VAI DE ESCADA, escada 1→3 "salário" |
| c11a | 2.8 | glitch | head, `alertAt` "inflação'." | HUD "a pergunta não é", keyword INFLAÇÃO? (alert) |
| c11b | 5.2 | cut | building (raio [10, 14]: dolly pra trás) | keyword ATÉ QUE ANDAR?, chave 3→10 "7 ANDARES" em "alcança?" |
| c12a | 1.6 | glitch | core, walls | HUD "o brasileiro não vive de", keyword PERCENTUAL (alert) |
| c12b | 2.2 | zoom | cart, priceTag, `alertAt` "carrinho." | HUD "vive do que cabe no", keyword CARRINHO |
| c12c | 2.2 | glitch | end | HUD "pra onde o seu tá indo?", ícone `link` com label "LINK NA BIO" |

### 6.11 Legendas da C

Mesmo componente e posição do Kinetic, com destaque ciano `#2EE6F0`, texto da palavra ativa `#02060D` e placa `rgba(2,8,18,0.72)`.

### 6.12 Modelos 3D

`npm run models:fetch` baixa dos exemplos do three.js **r180** para `public/models/` (os `.glb` não vão pro git; `--refresh` baixa de novo):

| Arquivo | Modelo | Autor | Licença |
|---|---|---|---|
| `head.glb` | Lee Perry-Smith head scan | Lee Perry-Smith / Infinite-Realities | **CC BY 3.0 — atribuição obrigatória**: "Cabeça 3D: Lee Perry-Smith / Infinite-Realities (CC BY 3.0)" |
| `xbot.glb` | X Bot (animações idle, walk, run, sad_pose) | Mixamo / Adobe | uso livre (inclusive comercial) dentro de projetos; não redistribuir o arquivo solto |

Créditos em `public/models/credits.json` (versionado). Todo o resto (prédio, elevador, escada, carrinho, arroz, leite, etiqueta, termômetro, gráficos, núcleo, cédula) é construído por código em `src/components/wire/`.

---

## 7. Narração

### 7.1 Vozes (`brands/rikuai.json → voices`)

| | A | B (e C) |
|---|---|---|
| Voz | Liam `TX3LPaxmHKxFdv7VOQHJ` (premade) | Sarah `EXAVITQu4vr4xnSDxMaL` (premade) |
| Modelo | `eleven_multilingual_v2` | `eleven_multilingual_v2` |
| stability | 0.4 | 0.55 |
| similarity_boost | 0.75 | 0.75 |
| style | 0.3 | 0.2 |
| speed | 1.08 | 1.0 |
| pronunciation | `{"IBGE": "IBGÊ", "PIB": "pib"}` | igual |
| candidatas testadas | Liam, Will `bIHbv24MWmeRgasZH58o`, Charlie `IKne3meq5aSn9XLyUdCD` | Sarah, Matilda `XrExE9yKIg1WjnnlVkGX`, Lily `pFZP5JQG7iQjIQuC4Bku` |

`use_speaker_boost: true` é sempre enviado. Bloco `voice` no JSON: `id`, `name`, `model`, `settings`, `pronunciation`, `candidates`, `testText`, `tempo` (opcional: acelera com `ffmpeg atempo` sem mudar o tom, para modelos sem `speed`).

### 7.2 `npm run voice:generate -- <id> [--test] [--dry-run] [--voice <id>] [--model <id>]` (`scripts/voice-generate.mjs`)

`--dry-run` mostra o texto exato que seria enviado (números por extenso, pronúncias) e quantos caracteres ele gasta, sem chamar a API: rode antes de gerar, porque o plano grátis tem 10.000 caracteres/mês (no 002: A 2.766, B 2.566).

1. Junta a narração das cenas num texto só, separando cenas com `<break time="0.35s" />` + quebra de linha (modelos v3/v4: parágrafo em branco).
2. Troca cada palavra pela forma falada, preservando a pontuação: siglas do mapa de pronúncia; números `^\d+([.,]\d+)?%?$` por extenso em pt-BR (`2021` → "dois mil e vinte e um", `10,06` → "dez vírgula zero seis", `32,2%` → "trinta e dois vírgula dois por cento"; decimais começando com 0 são lidos dígito a dígito). **Escreva os números com algarismos na narração**: a voz fala por extenso e a legenda mostra "10,06%".
3. `POST /v1/text-to-speech/<voice>/with-timestamps?output_format=mp3_44100_128`.
4. Converte o alinhamento por caractere em tempos por palavra (palavras não achadas são interpoladas).
5. Salva `public/audio/<id>.mp3` (fora do git), `videos/<id>-alignment.json` (modelo, voz, texto enviado, duração, palavras, alinhamento) e `videos/<id>-captions.json` (palavras **originais** com `startMs`/`endMs`/`timestampMs`), e grava `audio`/`captions` no JSON.

`--test`: gera só `voice.testText` (ou a 1ª frase do roteiro) com cada candidata em `public/audio/voice-tests/<id>/<n>-<nome>.mp3`. Para a B: no máximo 3 candidatas, escolha a mais calma e natural e copie para `voice.id`/`voice.name`.

### 7.3 Retiming (`src/templates/retime.ts`)

Os shots são desenhados contra uma narração estimada; com as legendas reais, `calculateMetadata` refaz a linha do tempo:

- Só roda se o número de palavras das legendas = número de palavras das narrações; senão avisa ("Rode de novo: npm run voice:generate") e usa as durações do JSON.
- Cada corte cai **0,12 s antes** (`LEAD`) da 1ª palavra falada do shot, ou da palavra em `cutOnWord` (1ª ocorrência na cena, depois de 0,1 s do corte anterior; compara exato e depois normalizado). Cortes são monotônicos (pelo menos 0,2 s entre eles).
- Os `at` dentro do shot passam por um *time warp* palavra a palavra (o que entrava numa palavra continua entrando nela); `at` negativo não muda; `enterOnWord` usa os tempos reais.
- O vídeo termina **1 s** (`TAIL`) depois da última palavra.
- Shot com menos de **0,6 s** (`MIN_SHOT`) pega tempo do vizinho mais longo (se o vizinho continuar com ≥ 1 s); senão é juntado a ele.
- No 001: A termina em ~77,6 s (última palavra em 76,614 s); B e C em ~83,4 s (82,407 s).

---

## 8. Sons e mixagem

### 8.1 Biblioteca (`scripts/sfx-generate.mjs`, versionada em `public/sfx/`)

Gerada **uma vez** pela ElevenLabs (`/v1/sound-generation`, `prompt_influence 0.6`, mp3 44,1 kHz) e processada: pico normalizado em −1 dBFS, silêncio aparado (início −42 dB, fim −48 dB), fade de 30 ms, completada com silêncio até 2,2 s, estéreo, 192 kbps. `public/sfx/manifest.json` lista as variações. `npm run sfx:generate` só gera o que falta (`--all` refaz tudo, `--pad` só completa a duração).

| Tipo | Variações | Duração pedida | Prompt |
|---|---|---|---|
| `whoosh` | 3 | 0,6 s | short clean UI whoosh, fast air swoosh, modern motion graphics, no reverb |
| `whoosh-long` | 2 | 1,3 s | smooth cinematic whoosh sweep passing by, clean, modern motion graphics, no reverb |
| `pop` | 3 | 0,5 s | short soft bubbly UI pop, clean digital pop, no reverb |
| `hit` | 3 | 0,9 s | short punchy impact hit, deep thump with a crisp snap, modern motion graphics, no reverb |
| `click` | 3 | 0,5 s | single crisp mechanical keyboard key click, dry, close mic, no reverb |
| `riser` | 2 | 1,5 s | short tension riser building up quickly, clean synth swell, ends abruptly, no reverb |
| `glitch` | 2 | 0,6 s | short digital glitch stutter, data corruption blip, clean, no reverb |
| `paper` | 2 | 0,7 s | quick paper cutout slapped on a table with a small paper rustle, dry, close mic |
| `swipe` | 3 | 0,5 s | quick UI swipe swish, short, clean, no reverb |

### 8.2 Mapeamento automático (`src/templates/sfxMap.ts`)

| Evento | Som | Quando | Ganho |
|---|---|---|---|
| Transição zoom/whip/circle · morph · slide/wipe · glitch/invert · flash (C: zoom, glitch, flash) | whoosh · whoosh-long · swipe · glitch · hit | 3 quadros antes do corte | 1 |
| Pattern interrupt | riser + hit | riser 36 quadros antes do corte, hit no corte | 1 |
| `icon` | pop | entrada + 2 quadros | 1 |
| `icons` | pop por ícone | +2 + 3·k | 0,8 |
| `bubbles` | pop por balão | + k·`every` | 0,85 |
| `number` | hit | no impacto (fim da contagem); sem `impact`, entrada + 0,4 s | 1 |
| `ransom` | paper + hit | paper na entrada; hit no impacto (ou +6) | 1 |
| `clipping` | paper | +2 | 1 |
| `text` `type` | click por palavra | + 4·k | 0,9 |
| `text` `impact` | hit | +2 | 0,9 |
| `photo` `strip` | swipe por foto | + 9·k | 0,8 |
| `clip` card · `bg` · `strip` | swipe · whoosh · swipe por corte | entrada · entrada · início de cada corte | 0,8 · 0,6 · 0,8 |
| C: monitor holográfico (`holoIntro`) | glitch por trecho · whoosh-long | início de cada trecho · início da dissolução | 0,75 |
| outras fotos | swipe (a menos que `"sfx": "whoosh"`) | entrada | 0,8 |
| `bars` | pop por barra | +4 + 3·k + 11 (quando o valor aparece) | 0,6 |
| `building`, move do elevador com `ease: "fast"` | whoosh-long | início do move | 1 |
| `shape` com `impact` | hit | +4 | 0,8 |
| C: `keyword` com `alert` ou `impact` | hit (como texto impact) | +2 | 0,9 |
| C: cada etiqueta dos cabos | pop | entrada da etiqueta + 2 | 1 |
| `"sfx": "riser"` no elemento | riser extra terminando no impacto | impacto − 36 quadros | 1 |
| `"sfx": "whoosh"` no elemento | whoosh extra | entrada | 0,9 |

Detalhes: só `"riser"` e `"whoosh"` em `sfx` de elemento acrescentam algo (`"hit"`, `"pop"` etc. já estão no mapeamento e são ignorados). No Kinetic, o whoosh-long do elevador só sai para moves `fast` com `at` explícito (moves por `enterOnWord` não têm `at` no mapa de sons); na C todos os moves `fast` soam. Eventos do mesmo tipo a menos de 5 quadros (click: 3) viram um só. As variações se alternam em rodízio (`n % variações`). `"sfx": { "hit": "sfx/meu-hit.mp3" }` no topo do vídeo troca o arquivo de um tipo.

### 8.3 Volumes e ducking

| Fonte | Volume |
|---|---|
| Narração | **1.0** |
| whoosh 0.32 · whoosh-long 0.30 · swipe 0.30 · pop 0.28 · **hit 0.38** · click 0.25 · riser 0.30 · glitch 0.30 · **paper 0.45** (outros 0.3) | × ganho do evento × ducking |
| Trilha opcional (`music.src` ou `public/audio/bg.mp3` se existir) | 0.06 padrão, loop, fade in 1,5 s e fade out nos últimos 2 s, × `(1 − 0.3·fala)` |

**Ducking:** envelope de fala = 1 de 1 quadro antes a 1 quadro depois de cada palavra, suavizado por média móvel de 7 quadros (R = 3); efeitos × `1 − 0.65·fala` (= −9,1 dB durante a voz). Cada efeito toca numa janela de 2 s. O 001 não tem trilha (`"music": null`).

**Master** (só no render final): loudnorm em duas passadas `I=-14 LUFS`, `TP=-1.5 dBTP`, `LRA=11`, `linear=true`, 48 kHz, AAC 320 kbps, `+faststart`, vídeo copiado sem recodificar.

---

## 9. Fotos

### 9.1 Busca (`npm run images:fetch -- <id> [--refresh]`, `scripts/images-fetch.mjs`)

- Todo objeto com `id` + `image` dentro de `shots` vira foto (inclui `images` do `strip`); chave = `<cena>/<id>`.
- `image`: `query` (em inglês), `treatment` (`cutout` → passa pelo rembg; `torn`/`taped` → não), `require` (tags obrigatórias), `exclude` (tags proibidas, ex.: `["euro"]`), `id` (fixa a foto), `pick` (n-ésima melhor), `allowPeople`, `fillHoles`.
- API: `image_type=photo`, `safesearch=true`, `per_page=60`, uma busca vertical + uma qualquer; descarta IA (`isAiGenerated`), baixa qualidade, **largura original < 1500 px**, tags de pessoas (`people|person|man|woman|girl|boy|child|kid|baby|face|portrait|selfie|model|lady|guy|human|crowd|politician|president|celebrity|family|couple|businessman|businesswoman|customer|shopper`…), fotos de `avoidFrom` e fotos já usadas no vídeo; prefere relevância ≥ 0,5.
- Nota: `relevância·6` + vertical 3 (cutout não-vertical 1) + `min(2, pixels/6e6)` + `log10(1 + likes + downloads/50)·0,6` + 3 para cutout com tags "isolated/white background/cut out/transparent".
- Pixabay entrega no máximo 1280 px no lado maior (nitidez leve aplicada no render). Erro 429: tenta de novo em 2, 4, 8, 16, 32 s.
- Escolhida a foto, o id fica fixado no `credits.json` (rodar de novo baixa a mesma). `--refresh` busca tudo de novo.
- Arquivos: `public/images/raw/<video>/<cena>--<id>.jpg|png`.

### 9.2 Recorte (`scripts/cutout.py`, `npm run images:cutout [-- <id>]`)

rembg `isnet-general-use` com `post_process_mask`; descarta fragmentos menores que 3% da maior parte; `fillHoles` preenche buracos internos com a foto original (ex.: tela branca do celular); corta justo com margem de 4%; gera `public/images/cut/<video>/<cena>--<id>.png` e `.sticker.png` (contorno branco de 2,8% do maior lado); grava caminhos e tamanhos no `credits.json`.

### 9.3 Créditos

`public/images/raw/<video>/credits.json` (versionado) guarda por foto: `pixabayId`, `query`, `treatment`, `file`, tamanhos, `author`, `authorUrl`, `pageUrl`, `tags`, `license: "Pixabay Content License"` e os campos do recorte. Os `.jpg`/`.png` e `public/images/cut/` estão no `.gitignore`.

### 9.5 Pinturas (Wikimedia Commons)

`"image": { "source": "commons", "file": "File:....jpg", "query": "busca se o título não existir", "treatment": "torn" }`. O `images:fetch` baixa a versão de até 2560 px **só se a licença do arquivo for domínio público ou CC0** (senão falha) e grava no mesmo `credits.json`: `source: "commons"`, `commonsFile`, autor, data, `pageUrl`, `license`, `licenseUrl`, `usageTerms`. Falha no Commons não impede as fotos do Pixabay (o script avisa e sai com erro no fim). Os arquivos não vão pro git. Precisa de `commons.wikimedia.org` e `upload.wikimedia.org` liberados na rede do ambiente.

Sem acesso ao Commons, o dono anexa o arquivo: salve em `public/images/paintings/` (fora do git) e use `"image": { "source": "local", "src": "paintings/<arquivo>.jpg", "treatment": "torn", "credit": { "title", "author", "date", "license", "pageUrl", "collection", "note" } }`. O `images:fetch` copia pra `raw/<video>/`, mede o tamanho e grava o crédito no `credits.json`; só aceita `license` de domínio público ou CC0. No 003: Waterhouse (A) e o vaso das sereias do Museu Britânico, foto de Jastrow (B). **Nenhuma imagem com nudez** em nenhuma versão (por isso o Draper saiu da B).

### 9.4 Critérios de escolha (manuais)

Sem rosto em close; nenhuma figura pública (políticos só como texto, ex.: cards "Bolsonaro"/"Lula"); nada de moeda estrangeira em notas/recibos (use `exclude`); objetos e lugares brasileiros genéricos (prateleira, carrinho, etiqueta, prédio, escada, carteira, moedas). Se a busca trouxer algo errado, troque a `query`, adicione `require`/`exclude` ou fixe um `id` revisado.

---

## 10. Checagens automáticas (`npm run check -- <id>`, `scripts/check-numbers.mjs`)

Roda sozinha antes de `render:video` e `preview:fast` (pule com `--skip-check`). Vale para `KineticExplainer` e `WireframeExplainer`. Faz o bundle, abre a composição com `numberCheck: true` e **monta todos os quadros** (sem screenshot, `concurrency` = núcleos). Na C o canvas 3D não é desenhado durante a revisão (tudo que ela mede vem da conta da câmera e da camada HTML), então a checagem da C leva ~1 min em vez de ~1 h. Em cada quadro o `NumberProbe` (`KineticShot.tsx`) registra no console: números (`[data-num]`, com texto, tamanho efetivo da fonte na tela, se está contando, se é principal, opacidade efetiva), caixas de texto grande (`[data-bigtext]`; ransom usa a união das letras), objetos 3D (`[data-avoid]`), tudo que precisa ficar na área segura (`[data-safe]`, `[data-bigtext]`, `[data-num]`, `[data-fulltext]`), textos digitados, palavras do ransom e palavras da legenda.

| Regra | Grupo | Limite |
|---|---|---|
| Valor de cada número (`number`, `bars`, `line`) = 0, ou o valor do JSON com as casas decimais do valor (ou exatamente o `display`), ou `number` contando | números | qualquer quadro com opacidade > 0,05 |
| Todo número aparece no último terço do shot (quadro local ≥ ⌈2/3 · quadros⌉); elementos com `exitAt` antes de 2/3 do shot ficam de fora | números | — |
| Tamanho dos valores principais (`data-main`) | números | ≥ 34 px (limite do código: 33,5) medidos no último terço, com opacidade ≥ 0,9 |
| Dois textos grandes ao mesmo tempo (todos os shots presentes no quadro, transições incluídas) | sobreposição | área em comum > 12% da área do menor; só textos com opacidade ≥ 0,3 |
| Texto grande × número de gráfico (fora dele) | sobreposição | > 5% |
| Texto grande × objeto 3D | sobreposição | > 12% |
| Digitação mostra só palavras inteiras do texto | palavras cortadas | qualquer quadro |
| Palavra do ransom incompleta | palavras cortadas | > 3 quadros |
| Destaque da legenda cobre a palavra | palavras cortadas | cobertura < 98% com destaque visível (≥ 0,3) falha |
| Palavra da legenda fora do quadro (x < 0 ou > 1080) | palavras cortadas | qualquer quadro |
| Trechos de filme (`clip` e `holoIntro`): no máximo 8 por vídeo; card e bg com 1–2 s; strip com 2–3 cortes de 0,3–0,8 s e total ≤ 2 s; nunca a mesma forma (card, bg, strip) duas vezes seguidas; no máximo 2 com `face`; arquivo existe em `public/`; nenhum momento do filme repetido entre versões do mesmo roteiro (A, B e C, por `baseOf`). Avisos que não reprovam: menos de 6 trechos na A/B, cobertura fora de 18–27% da duração, mais de 16 s seguidos sem trecho | clipes | — |
| Safe zone: dentro de x 30–1050, y 250–1500, e não (abaixo de y 1100 **e** à direita de x 960); só caixas com opacidade > 0,3; quadros de um shot depois do fim dele (saindo na transição) não contam | safe zone | falha se ficar fora por **mais de 15 quadros seguidos**; mostra a pior caixa |

Opções: `npm run check:numbers -- <id>` (`--numbers-only`), `npm run check:overlap -- <id>` (`--overlap-only`: sobreposição, palavras cortadas e safe zone), `--from=N` / `--to=N` (trecho em quadros). A saída lista cada falha com o shot, o texto e os intervalos em segundos.

---

## 11. Render (`scripts/render.mjs`)

| Comando | Parâmetros |
|---|---|
| `npm run render:video -- <id>` | `remotion render <composition> out/<id>-1080.mp4 --codec=h264 --concurrency=<núcleos> --crf=16 --x264-preset=medium --jpeg-quality=95 --audio-codec=aac --audio-bitrate=320k`, depois loudnorm −14 LUFS / −1,5 dBTP (§8.3) |
| `… --4k` | + `--scale=2 --timeout=120000` → `out/<id>-4k.mp4` (2160×3840) |
| `npm run preview:fast -- <id>` | `--scale=0.5 --crf=32 --x264-preset=veryfast` → `out/preview/<id>-fast.mp4` (sem loudnorm) |

Outras flags `--…` são repassadas ao `remotion render`. Se `REMOTION_BROWSER_EXECUTABLE` estiver no `.env`, usa esse Chrome. `remotion.config.ts`: Rspack, frames em JPEG, sobrescreve a saída. Prévia interativa: `npm run dev` (Remotion Studio).

---

## 12. Como fazer um roteiro novo

### 12.1 Checklist

1. **Roteiro (A):** crie `videos/rikuai-<nnn>-<slug>.json` (id = nome do arquivo; `composition` em PascalCase sem hífens, ex. `Rikuai002Aluguel`). `template: "KineticExplainer"`, `brand: "rikuai"`, `background: { "palette": "sunset-dark", "speed": 0.3 }`, `music: null`, `sfx: {}`.
2. **Narração:** frases curtas, tom de conversa ("tá", "pra"), números com algarismos e vírgula decimal (`10,06%`, `32,2%`, `2024`), siglas no mapa de pronúncia (acrescente em `voice.pronunciation` se surgir outra). Gancho forte na 1ª cena; fonte oficial citada logo depois; analogia visual no meio; CTA final "Link na bio". O 001 tem 12 cenas e ~80 s.
3. **Shots:** 1–3 s, 2–3 por frase; cada shot com um elemento principal de 70–80% da largura, título na faixa 290–420, apoio em 1040–1235; número herói com `impact`; gráficos com `label` de fonte; `"palette": "heat"` nos momentos de alerta; 3–5 pattern interrupts (`black`/`white`) nas revelações; uma foto a cada 5–8 s, estilos alternados; `ring` ≤ 2 e `disc` ≤ 2; transições pedidas só onde importam (`cut` em match cut com `morphFrom`, `flash`/`invert` entre textos na mesma faixa).
4. **`hookAlt`:** narração alternativa (neutra) das primeiras cenas + shots próprios.
5. `npm run make:all -- <id> --derive-only`.
6. **B:** confira `voice` (Sarah). Se quiser testar outra voz: `voice.candidates` (≤ 3 premade) + `voice.testText` e `npm run voice:generate -- <id>-b --test`.
7. **C:** reescreva os shots da `videos/<id>-c.json` com `wire` (§6.9), **sem mudar a narração** das cenas (tem que ser idêntica à da B). Ids `c<n><letra>`, `cutOnWord` em toda frase nova, palavras-chave em caixa alta.
8. `npm run make:all -- <id> --preview` → assista `out/preview/*-fast.mp4`. Corrija o que a revisão apontar (mover `x`/`y`, `exitAt`, trocar transição, `mirror: false`, ajustar câmera da C). Para conferir um trecho sem renderizar tudo: `npm run check -- <id> --from=N --to=N` e `npm run stills -- <CompositionId> <pasta> <quadros…>`.
9. `npm run timeline -- <id>` para conferir os cortes reais.
10. `npm run make:all -- <id>` → `out/<id>-1080.mp4`, `out/<id>-b-1080.mp4`, `out/<id>-c-1080.mp4`.
11. Versione: os 3 JSONs, `*-captions.json`, `*-alignment.json`, os `credits.json` das fotos. Não versione `public/audio/`, fotos, recortes, modelos `.glb` nem `.env`.

### 12.2 Esqueleto do roteiro (A)

```jsonc
{
  "id": "rikuai-002-exemplo",
  "composition": "Rikuai002Exemplo",
  "title": "Título do vídeo",
  "template": "KineticExplainer",
  "brand": "rikuai",
  "background": { "palette": "sunset-dark", "speed": 0.3 },
  "music": null,
  "sfx": {},
  "hookAlt": [
    { "scene": "gancho", "narration": "Frase alternativa do gancho para a versão B.",
      "shots": [ { "id": "s1a", "duration": 1.6, "elements": [ /* … */ ] } ] }
  ],
  "scenes": [
    {
      "id": "gancho",
      "narration": "Em 2021 a inflação passou de 10%.",
      "shots": [
        {
          "id": "s1a", "duration": 1.5,
          "elements": [
            { "type": "shape", "shape": "dots", "w": 980, "h": 1160, "x": 500, "y": 770, "depth": 0, "at": 0 },
            { "type": "text", "text": "INFLAÇÃO", "effect": "impact", "size": 186, "x": 500, "y": 760, "impact": true, "at": -0.15 },
            { "type": "icon", "icon": "percent", "preset": "spin3d", "size": 150, "x": 850, "y": 450, "at": 0.6 },
            { "type": "label", "text": "ÍNDICE OFICIAL · IPCA", "x": 500, "y": 1070, "at": 0.8 }
          ]
        },
        {
          "id": "s1b", "duration": 2.4, "transition": "flash", "palette": "heat", "cutOnWord": "passou",
          "elements": [
            { "type": "text", "text": "EM 2021", "effect": "scale", "size": 104, "x": 500, "y": 400, "at": -0.2 },
            { "id": "prices", "type": "photo", "style": "torn",
              "image": { "query": "supermarket price tags", "treatment": "torn", "require": ["price"] },
              "width": 420, "height": 320, "x": 260, "y": 1110, "rotate": -6, "at": 0.3 },
            { "type": "number", "value": 10.06, "suffix": "%", "size": 300, "x": 500, "y": 760,
              "enterOnWord": "10%.", "wordOffset": -0.35, "impact": true, "sfx": "riser" },
            { "type": "label", "text": "Fonte: IBGE (IPCA)", "x": 235, "y": 310, "at": 0.9 }
          ]
        },
        {
          "id": "s1c", "duration": 0.8, "interrupt": "black", "transition": "glitch",
          "elements": [
            { "type": "shape", "shape": "blob", "w": 720, "x": 500, "y": 780, "depth": 0, "color": "accent", "at": 0 },
            { "type": "ransom", "text": "10%", "size": 190, "x": 500, "y": 760, "at": -0.2, "impact": true }
          ]
        }
      ]
    }
  ]
}
```

### 12.3 Esqueleto de um shot da C

```jsonc
{ "id": "c3b", "duration": 2.8, "cutOnWord": "De", "transition": "glitch",
  "wire": { "stage": "bars", "walls": true,
            "camera": { "orbit": [-30, 22], "radius": [17, 15.5], "height": [2.0, 2.8] } },
  "elements": [
    { "type": "keyword", "text": "DESDE 2023", "at": 0.05 },
    { "type": "bars", "at": -0.2, "data": [
      { "label": "2021", "value": 10.06, "highlight": true },
      { "label": "2022", "value": 5.79 }, { "label": "2023", "value": 4.62 } ] },
    { "type": "label", "text": "Fonte: IBGE (IPCA)", "at": 0.3 }
  ] }
```

Na C, `x`/`y`/`width` dos elementos não são usados (posições fixas, §2.3); na câmera basta órbita e altura (o alvo e a distância vêm do `fitCamera`; `radius` só dá a direção/proporção do dolly).

---

## 13. Licenças e créditos

| Recurso | Licença | No git? |
|---|---|---|
| Fotos Pixabay | Pixabay Content License (não redistribuir os arquivos) | só `public/images/raw/<video>/credits.json` |
| Cabeça 3D `head.glb` | **CC BY 3.0** (Lee Perry-Smith / Infinite-Realities) — creditar onde o vídeo for publicado se a C usar o palco `head`: "Cabeça 3D: Lee Perry-Smith / Infinite-Realities (CC BY 3.0)" | só `public/models/credits.json` |
| X Bot `xbot.glb` | Mixamo / Adobe — uso livre em projetos, sem redistribuir o arquivo solto | só os créditos |
| Trechos de filme (trailer) | do estúdio; usados como comentário: sem áudio, até 2 s cada, sem logos nem letreiros, sempre com motion por cima, créditos no `creditos.txt` | só a lista em `credits.json → clips` (`npm run clips:credits`) |
| Efeitos sonoros | gerados na ElevenLabs para este projeto | sim (`public/sfx/`) |
| Narração | gerada na ElevenLabs (vozes premade) | não (`public/audio/`) |
| Fontes | Google Fonts (cache local em `public/fonts/google/`) | — |
| Ícones | lucide 1.59.0 | (dependência npm) |
| Chaves de API | `.env` (nunca versionar; nomes em `.env.example`) | não |

---

## 14. Máquina nova (`npm run setup`, `scripts/setup.mjs`)

Pré-requisitos: Node `^20.19.0 || ^22.13.0 || >=24`, Python 3, `ffmpeg`/`ffprobe`. Copie `.env.example` para `.env` e preencha `PIXABAY_API_KEY` e `ELEVENLABS_API_KEY` (opcional: `REMOTION_BROWSER_EXECUTABLE`).

O setup roda, em ordem: `npm install`; `pip install -r scripts/requirements.txt` se faltar algum de rembg/numpy/PIL/scipy (rembg 2.0.85, onnxruntime 1.29.0, numpy 2.5.3, pillow 12.3.0, scipy 1.18.1); `npx remotion browser ensure` (se não houver `REMOTION_BROWSER_EXECUTABLE`); `fonts:cache`; `textures` (se `public/textures/` não tiver PNG: `grain.png` 540×960 e `halftone.png` 1080×1920); `models:fetch`; `images:fetch` de todo vídeo com fotos (exceto Wireframe), se houver `PIXABAY_API_KEY`. A narração não é gerada (gasta créditos): o setup lista os `npm run voice:generate -- <id>` que faltam (para a C, o da B).

Dependências principais (`package.json`): remotion/@remotion/* 4.0.537, react 19.2.3, three 0.180.0, @react-three/fiber 9.8.2, @react-three/postprocessing 3.0.4, postprocessing 6.39.5, lucide 1.59.0, zod 4.5.4, typescript 5.9.3.

---

## 15. Analogia do gelo (roteiro 002, `rikuai-002-gelo`)

Segundo roteiro de referência: 20 cenas, ~151 s (A, Liam) e ~159 s (B, Sarah). Metáfora visual do começo ao fim: **dinheiro = cubo de gelo**, **inflação = gelo derretendo**, **Brasil = sol mais forte**, **cortar zeros = trocar de cubo**, **salário = água enchendo o copo**, **guardar dinheiro sem entender inflação = gelo fora do freezer**.

| Ideia | A/B (Kinetic) | C (3D) |
|---|---|---|
| dinheiro = gelo | `ice` com `"$"` girando (`spin` 40–45) | palco `ice`, cubo de malha com cifrão em tubo |
| derrete com o tempo | `melt` na palavra "derrete" (até 0,7) | idem, partículas caindo + poça |
| sol forte | `shape: "sun"` + cubo derretendo `fast` | `wire.sun` |
| R$100 → R$863 / R$12 | cubo com `value: 100`, número herói `R$ 863`, cubo derretido `remain: 0.3` com `value: 12` | idem (número no cubo vira NumTag 46 px conferido) |
| outros países derretem devagar | dois cubos lado a lado, `melt` até 0,45 (Brasil, `alert`) × 0,82 | dois cubos na bancada + sol no do Brasil |
| zeros cortados | `timeline` com `cutAt` em "cortar" | palco `zeros` (zeros 3D partidos por laser) + anos em HUD |
| salário × preços | cubo derretendo rápido + `glass` enchendo devagar | bancada com cubo + copo |
| efeito dominó | `dominoes` (1ª peça cai; depois cartão/parcelas/empréstimo/delivery a cada 0,75 s) | palco `dominoes` com rótulos HUD |
| ciclo | `cycle` com 4 itens | palco `cycle` |
| dólar | número herói `+27,9%` + `line` `[4.84, 6.19]` com `prefix: "R$ "`, `unit: ""` | palcos `number` e `line` |
| gelo fora do freezer | cubo "NO BALCÃO" + ícone `refrigerator` | bancada com `wire.freezer`; cubo vira poça magenta |
| derreter na sua mão | cubo com `freezeAt` em "mão." + ícone `hand` | cubo com `freezeAt` (faíscas brancas) |

Números conferidos em todos os quadros: 763,57% (herói), R$ 863 (herói), R$ 100 e R$ 12 (dentro do cubo), 5,0% (herói com `decimals: 1`), 5,0% × 3,3% (barras com `display`), 8 e 5 (heróis), anos da linha do tempo (1942, 1967, 1970, 1986, 1989, 1990, 1993, 1994), +27,9% (herói) e R$ 4,84 → R$ 6,19 (linha). Cada dado tem `label` "Fonte: …" (IBGE (IPCA), Banco Mundial, Banco Central, Banco Central / Banco Mundial).

Pronúncia (`voice.pronunciation` da A, herdada pela B): `IBGE → IBGÊ`, `iFood → ai-fúd`, `Shopee → xópi`, `whiskey → uísque` (a legenda mostra a palavra original).

Fotos: na A e na B os ids foram escolhidos à mão numa folha de candidatas (busca do Pixabay, 8 por consulta), descartando caveira, Pokémon, boneco, marca visível e cédula com retrato; o dólar da A é o verso da nota de 1 (sem rosto), o da B um cifrão 3D.

---

## 16. Entrega no Google Drive (3 marcas)

Sempre pelo conector do Google Drive (não usar rclone). **Cada vídeo (ID) tem as 3 versões, e cada versão vai para a pasta da sua marca** (cada marca posta no Instagram e no TikTok):

| Pasta | ID da pasta | Versão | Instagram | TikTok |
|---|---|---|---|---|
| 01 Ponto Cego (A) | `1fEKe0P_54DxhqLEXY5s0MYEMOplS0Xy3` | **A**: Kinetic `sunset-dark`, voz masculina (Liam) | @pontoceg0_brasil | @ponto.cego.br1 |
| 02 Cadê o Meu Dinheiro (B) | `1JRD9yiUnYHJz1bTQu-lotbGBCyMCxP7I` | **B**: Kinetic `rikuai`, voz feminina (Sarah) | @furonobolso.br (vai virar @cadeomeudinheiro.br) | @cadeomeudinheir0 |
| 03 Onde Foi Parar (C) | `1oJYhXPYDNNdm6zn1CIsk_4YbzKeolaNR` | **C**: Wireframe holográfico, voz feminina (o áudio da B) | @ondefoiparar.br | @ondefoiparar |

Resto da raiz:

| Pasta / arquivo | ID | Uso |
|---|---|---|
| Fábrica de Vídeos | `18PlX93jcNt7s4hb9m3V0Gb93D_ITz5rA` | raiz |
| _Em revisão | `1HStEvr3My6sCNaxN16oC2GZ_vqJJpOY3` | fica vazia (não apagar): os vídeos vão direto pra pasta da marca |
| _Arquivo | `1GHhTXK-2luyvOvqXwqc0rghfXmDKtLZk` | descartados (ex.: `noticia-001-prorrogacao`, a eleição já acabou) |
| _Masters 4K | `1qnqgsCSMM_X5A1VH0QjPbXi_js2LjqDi` | renders 4K |
| 04 Daily Mom Secrets · 05 Hook Company | `103RZ9nwt1x6VZMrsCsi8w8qfMu8skdID` · `12XDrQvwKhbMzo796sIKTS-bTb3i0CC5E` | outros perfis (não mexer) |
| Planilha "_Índice de vídeos" | `1xT00VG-Piuq5a_2s2i3fwAZCDf9YOmgWy48zKGWzsAg` | uma linha por vídeo × versão |

Fluxo:

1. Vídeo pronto → subpasta na pasta da marca da versão, chamada `AAAA-MM-DD · <id> · <versão> · <título>` (ex.: `2026-10-22 · rikuai-003-sereias · B · As sereias do seu dinheiro`), com:
   - `<id>-<versão>.mp4`: o render final 1080, versão em minúscula como já está no Drive (ex.: `rikuai-003-sereias-b.mp4`). O 4K vai pra **_Masters 4K**.
   - `legenda.txt`: legenda do Instagram (gancho forte na 1ª linha, 2–4 linhas, CTA da marca) + 5–8 hashtags do nicho em português. CTA: A = seguir; B e C = "link na bio".
   - `legenda-tiktok.txt`: a mesma legenda trocando "link na bio" (ou "link da bio") por "link no Insta da bio".
   - `creditos.txt`: fotos (autor/link), pinturas, modelos 3D com licença e trechos de filme usados (ex.: "Trechos: A Odisseia (2026), Christopher Nolan / Universal, usados sem áudio para comentário"), um por linha com tempos do arquivo, forma e o que aparece — o bloco sai pronto de `npm run clips:credits -- <id>`.
   - `hashtags.txt`, se houver.
2. Antes de criar ou renomear pasta: listar o pai e procurar pelo nome; se já existir, reutilizar (nunca criar duplicada). No Drive nada se apaga: só mover.
3. MP4 grande demais pro conector (o render 1080 tem 100–300 MB): montar a mesma árvore em `_drive-upload/` na raiz do repositório (fora do git), com o MP4 já com o nome final, mandar o MP4 na conversa e dizer ao dono o que arrastar pra qual pasta.
4. Planilha, a cada vídeo × versão: `Data`, `ID`, `Tema`, `Versão`, `Perfil` (a marca: Ponto Cego, Cadê o Meu Dinheiro, Onde Foi Parar), `Duração`, `Status` (`A conferir` / `Postado` / `Descartado`), `Pasta` (link da subpasta). O conector do Drive não edita células: com o conector do Google Sheets ligado, atualize direto; sem ele, entregue as linhas em TSV prontas pra colar.
5. Na tela, o CTA de cada versão usa a marca dela (o @ da A é o da Ponto Cego; a B e a C não mostram mais "RikuAI").
6. Se o conector do Google Drive não estiver disponível na sessão, avisar antes de continuar.

---

## 17. Trechos de filme (o 003 e todos os próximos vídeos com filme)

Vale quando o roteiro comenta um filme (no 003, o trailer de *A Odisseia* em `public/clips/odisseia-trailer.mp4`, fora do git). Sempre: **sem áudio**, **sem logos** de estúdio e **sem letreiros** (cartelas de crédito, data, título — confira na folha de contato), e **nenhum momento repetido entre as versões** do mesmo roteiro (A, B e C usam trechos diferentes; a checagem compara).

### 17.1 A e B

- **6 a 8 trechos por vídeo, de 1 a 2 s cada**, somando ~20–25% da duração (num vídeo de 64 s, ~13–16 s). Um trecho por shot.
- **Três formas**, nunca a mesma duas vezes seguidas no vídeo (`frame` e `torn` contam como a mesma forma, card):

| Forma | JSON | Como fica | Quando usar |
|---|---|---|---|
| card | `"style": "frame"` ou `"torn"`, `from`, `duration` | 860×360 (2,39:1) em card branco ou papel rasgado, retícula 0,12 + grão 0,3, rótulo mono, sai sozinho | a cena é o assunto ("essa cena aqui", "repara no mastro") |
| bg | `"style": "bg"`, `from`, `duration`, `focus` | tela cheia atrás de tudo do shot (camada própria, fora da câmera virtual: não gira nem dá zoom com ela), brilho 0,4 (`dim`), blur 5 px (`blur`), contraste 1,15, tom da marca em soft-light, vinheta, retícula 0,1 + grão 0,35; fade de 6 quadros na entrada e de 10 na saída, zoom lento 1,06 → 1,16; o shot continua por cima (ícones, textos) e o fundo da marca volta depois | atrás de um shot de ícone/texto, pra dar o clima da cena |
| strip | `"style": "strip"`, `cuts[{from, duration}]` | faixa de filme 960×400 (perfurações em cima e embaixo, contorno de acento), 2–3 cortes de ~0,5 s (0,3–0,8; total ≤ 2 s), cada corte com flash branco de 3 quadros, punch de zoom 1,16 → 1,03 e tranco lateral; bolinhas marcam o corte atual; entra sem animação (`instant`) | sequência rápida de "flashes" ("esquece a mitologia", "o maior inimigo") |

- **Distribua ao longo do vídeo inteiro**, não só no começo (aviso se passar de 16 s sem trecho).
- **Prioridade**: cenas ligadas à narração — navio, mar, mastro, tempestade, destroços. Depois, cenas ligadas a uma palavra da fala ("inimigo" → exército; "eu mereço" → banquete, fogo).
- **Rosto**: no máximo 2 trechos com rosto em destaque por vídeo, curtos e relevantes. Marque `"face": true` no elemento (no strip, se qualquer corte tiver rosto).
- **A e B** usam momentos diferentes; dá pra manter as mesmas posições e formas (no 003 a B troca só `from`/`cuts` por shot).
- **bg precisa de cena legível em ~1/4 da largura** (o vertical recorta o 2,39:1): `focus[0]` escolhe a parte do quadro. Cena escura ou lavada (névoa, noite, interior à luz de tocha) vira uma mancha sem forma — prefira cena clara ou com contraste (fogo, silhueta contra o céu, proa contra o mar, fortaleza contra as nuvens). Teste antes: `ffmpeg -ss <t> -i <trailer> -frames:v 1 -vf "crop=132:268:<x>:46,scale=270:480,eq=contrast=1.15,colorlevels=romax=0.4:gomax=0.4:bomax=0.4,boxblur=2" teste.png` (132 px de largura é o que o vertical mostra do quadro). Cena que já é escura (interior à luz de tocha, tempestade) pode subir o `dim` até 0,6: escurecida, ela continua mais escura que uma cena normal a 0,4.
- `note` em cada trecho (e em cada corte do strip): o que aparece. Vai pros créditos.
- Como achar os tempos (o trailer tem só 640×360, com o filme em 640×268 no meio): folhas de contato com o tempo a cada 0,5 s e a lista de cortes:

```
ffmpeg -ss 50 -t 25 -i public/clips/<arquivo>.mp4 -vf "fps=2,crop=640:268:0:46,scale=320:134,drawtext=text='%{eif\:t+50\:d}.%{eif\:mod(t*10\,10)\:d}':x=6:y=6:fontsize=22:fontcolor=yellow:box=1:boxcolor=black@0.7,tile=5x10" -frames:v 1 folha-50.png
ffmpeg -i public/clips/<arquivo>.mp4 -vf "crop=640:268:0:46,select='gt(scene,0.12)',metadata=print" -an -f null - 2>&1 | grep pts_time
```

  Comece pelo menos 0,05 s depois de um corte e termine antes do próximo (o trecho não pode atravessar um corte do filme).

Exemplo (003, versão A — card, bg, card, strip, bg, card, bg, strip; 12,9 s = 20%):

```json
{"type": "clip", "style": "bg", "from": 33.55, "duration": 1.35, "focus": [0.45, 0.5], "at": 0, "note": "figura sozinha numa planície sem fim"}
{"type": "clip", "style": "strip", "cuts": [{"from": 130.2, "duration": 0.55, "note": "redemoinho perto das pedras"}, {"from": 132.45, "duration": 0.55, "note": "homem subindo na vela"}, {"from": 113.05, "duration": 0.42, "note": "grito (rosto)"}], "face": true, "width": 900, "height": 380, "label": "A ODISSEIA · NOLAN", "x": 500, "y": 600, "rotate": -2, "at": -0.1}
```

### 17.2 C (holograma)

- Nos **primeiros 5 s**: 2–3 trechos do filme dentro de um **monitor holográfico**; no fim do último ele **se desmancha em partículas e malha wireframe** e vira a cena 3D. **Depois dos 5 s, a C é 100% 3D.** Trechos diferentes dos da A e da B.
- JSON (topo do vídeo da C): `"holoIntro": {"label": "ARQUIVO · A ODISSEIA (2026)", "clips": [{"from": 56.65, "duration": 1.3, "note": "…"}, …], "dissolve": 1.0}`. Cada trecho tem 1–2 s; a dissolução (padrão 1 s) acontece dentro do último trecho, e a soma tem que fechar antes dos 5 s (no 003: 1,3 + 1,3 + 2,0 = 4,6 s, partículas até ~4,9 s).
- Monitor (`HoloMonitor.tsx`): 860×430 px centrado em (515, 900) — a área do objeto dos shots com texto digitado (y 575–1215) —, a 3 unidades da câmera e preso a ela (a mesma conta da câmera dos shots), então fica parado na tela inclusive nos cortes. Véu escuro (`#02060D`, 0,72) entre a cena 3D e o monitor. Tela: luminância^1,2 em ciano + 30% da cor original, scanlines de 4 px, faixa clara correndo, vinheta e fio de borda, aberração cromática 0,0022 (até 0,013 no glitch), faixas de glitch nos 6 primeiros quadros de cada trecho e leves no meio; liga em 7 quadros com flash branco. Moldura de HUD (fio fino + cantoneiras) e rótulo HTML mono ciano ("ARQUIVO · …" digitado à esquerda, "● TRECHO n/N" à direita).
- Dissolução: blocos da imagem somem com borda brilhante e cada um vira partícula (grade de 144×72, com a cor do próprio quadro), que se espalha e afunda na cena; a malha do monitor (24×12) aparece, ondula em profundidade, abre e some; o véu cai junto; a moldura abre e apaga. O último quadro fica congelado por mais 10 quadros enquanto as partículas voam.
- Sons: glitch em cada trecho, whoosh-long no começo da dissolução.
- Render: o quadro do filme vira textura (`useOffthreadVideoTexture` dentro de um `<Sequence>` com o tempo do trecho + `<Freeze>` no rabo); como o `ThreeCanvas` só redesenha quando o quadro muda, o monitor segura o quadro (`delayRender`) até a textura chegar e redesenha (`advance`). Na revisão automática o 3D não é desenhado.

### 17.3 Checagem e créditos

- `npm run check -- <id>` aplica as regras de trechos (§10): máx. 8, cada um com no máximo 2 s, sem forma repetida em seguida, até 2 com rosto, sem repetir momento entre A, B e C; mostra a sequência de formas e a cobertura (ex.: `✓ clipes: 8 trecho(s), 12.9s (20% do vídeo), sem áudio, 1 com rosto: card → bg → card → strip → bg → card → bg → strip`).
- `npm run clips:credits -- <id>` (o `make:all` roda sozinho) grava a lista em `public/images/raw/<id>/credits.json → clips` (shot, forma, tempos de cada corte, rosto, o que aparece, filme) e imprime o bloco "Trechos" do `creditos.txt`. Filme novo: acrescente o arquivo em `FILMS` no script.

---

## Apêndice — onde está cada coisa

| Assunto | Arquivo |
|---|---|
| Registro das composições | `src/Root.tsx`, `src/videos.ts`, `src/index.ts` |
| Tipos do JSON | `src/templates/kineticTypes.ts`, `src/templates/types.ts` (`VideoFile`) |
| Template A/B | `src/templates/KineticExplainer.tsx`, `KineticShot.tsx`, `src/components/kinetic/*` (analogia do gelo: `Ice.tsx`) |
| Template C | `src/templates/WireframeExplainer.tsx`, `WireShot.tsx`, `src/components/wire/*` (analogia do gelo: `ice.tsx`) |
| Transições | `src/components/transitions/kineticTransitions.tsx` |
| Áreas da tela | `src/templates/safeZone.ts` |
| Espelhamento da B | `src/templates/variant.ts` |
| Retiming | `src/templates/retime.ts` |
| Sons | `src/templates/sfxMap.ts`, `public/sfx/` |
| Trechos de filme | `src/components/kinetic/KClip.tsx` (card, bg, strip), `src/components/wire/HoloMonitor.tsx` + `HoloLabel.tsx` (monitor da C), `scripts/clips-credits.mjs` |
| Ransom / recortes | `src/components/collage/Type.tsx`, `src/components/kinetic/Cards.tsx` |
| Legendas | `src/components/kinetic/KineticCaptions.tsx`, `src/components/collage/CollageCaptions.tsx` (`toBlocks`) |
| Marca, cores e fontes | `brands/rikuai.json`, `src/brand/collageTheme.tsx`, `src/brand/fonts.ts` |
| Scripts | `scripts/make-all.mjs`, `voice-generate.mjs`, `sfx-generate.mjs`, `images-fetch.mjs`, `cutout.py`, `models-fetch.mjs`, `render.mjs`, `check-numbers.mjs`, `clips-credits.mjs`, `timeline.mjs`, `setup.mjs`, `cache-fonts.mjs`, `make-textures.py` |

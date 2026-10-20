# Vídeos

Cada `*.json` aqui com `composition` + `scenes` vira uma composição no Remotion Studio (pasta **Videos**), sem mexer em código. O template padrão é o **KineticExplainer** (motion graphics). Também existem o **WireframeExplainer** (holograma 3D, `"template": "WireframeExplainer"`) e os anteriores `"CollageExplainer"` e `"PaperExplainer"`.

## 3 versões por roteiro (`npm run make:all`)

Cada roteiro vira 3 vídeos, pra postar em perfis diferentes sem ser marcado como duplicado:

| Versão | Arquivo | Visual | Voz | Gancho |
|---|---|---|---|---|
| **A** | `videos/<id>.json` (o roteiro) | Kinetic, paleta `sunset-dark` | masculina (`voices.a` da marca: Liam) | o do roteiro |
| **B** | `videos/<id>-b.json` | Kinetic, paleta `rikuai`, outra seed de transições, metade dos shots espelhados, fotos diferentes das da A | feminina calma (`voices.b`: Sarah) | `hookAlt` do roteiro |
| **C** | `videos/<id>-c.json` | WireframeExplainer (holograma 3D) | mesmo áudio e legendas da B | o da B |

```bash
npm run make:all -- <id>                 # deriva B e C, fotos, narrações, revisão e render 1080 das 3
npm run make:all -- <id> --derive-only   # só cria videos/<id>-b.json e <id>-c.json
npm run make:all -- <id> --only b,c --preview   # só B e C, em prévia rápida
npm run make:all -- <id> --rederive      # refaz B/C a partir do roteiro (apaga ajustes feitos à mão neles)
```

- No roteiro (versão A), escreva o gancho alternativo em `"hookAlt"`: `[{ "scene": "<id da cena>", "narration": "...", "shots": [...] }]`. A narração substitui a da cena na B (e na C); `shots` é opcional (sem isso, a B usa os shots do roteiro).
- As vozes de cada versão ficam na marca (`brands/<marca>.json`, campo `voices.a` / `voices.b`).
- B e C só são derivados se ainda não existirem: depois de derivados, dá pra ajustar à mão (ex.: os shots 3D da C, com `"wire"`). A narração só é gerada se o vídeo ainda não tiver áudio.
- A B usa `"photos": { "avoidFrom": ["<id>"] }`: o `images:fetch` nunca pega uma foto que a A já usa (nem repete foto dentro do vídeo). Um `id` fixo que caia nessa lista é ignorado e a foto é buscada de novo.
- A C não gera narração: usa `audio`/`captions` da B (`"audioFrom"`), então os cortes caem nas mesmas palavras.
- Render 3D é pesado: a C leva ~0,6s por quadro em meia escala e ~2s por quadro em 1080 (4 núcleos).

## Fluxo de um vídeo novo

```bash
# 1. escreva videos/<id>.json (formato abaixo)
npm run images:fetch -- <id>     # busca as fotos no Pixabay (+ remove fundo das cenas "cutout")
npm run voice:generate -- <id>   # narração (ElevenLabs) + timestamps por palavra; os shots se reajustam sozinhos
npm run sfx:generate             # biblioteca de efeitos sonoros em public/sfx/ (uma vez só)
npm run preview:fast -- <id>     # prévia rápida: out/preview/<id>-fast.mp4 (metade da escala)
npm run render:video -- <id>     # final: out/<id>-1080.mp4 (H.264 CRF 16, AAC 320k, -14 LUFS)
npm run render:video -- <id> --4k  # final 4K: out/<id>-4k.mp4 (2160x3840, --scale=2)
```

`npm run timeline -- <id>` mostra a linha do tempo real (shots já ajustados pela narração).

**Revisão automática** (`npm run check -- <id>`; roda sozinha antes de `preview:fast` e `render:video`, `--skip-check` pula). Monta TODOS os quadros do vídeo e:

- **números** (`npm run check:numbers`): todo número visível (`number`, `bars`, `line`) tem que ser 0, o valor do JSON, ou estar na contagem do número herói. Gráficos de comparação não contam: o valor aparece pronto quando a barra termina de crescer. Só o `number` (herói) conta, de 0 até o valor, em no máximo 0,4s. Também falha se um número não estiver na tela no último terço do shot.
- **sobreposição** (`npm run check:overlap`): dois textos grandes (títulos, ransom, recortes, número herói, palavra com foto) nunca ocupam a mesma área ao mesmo tempo, transições incluídas. Mostra o par de textos e os segundos.

## Narração, legendas e sons

- **Voz** (`"voice"` no JSON): `id`, `model` (`eleven_multilingual_v2`), `settings` (`stability` 0.4, `similarity_boost` 0.75, `style` 0.3, `speed` 1.08), `pronunciation` (`{"IBGE": "IBGÊ", "PIB": "pib"}`) e `candidates` (`npm run voice:generate -- <id> --test` gera a 1ª frase com cada candidata em `public/audio/voice-tests/`). Números vão por extenso pra voz ("dez vírgula zero seis por cento"); a legenda mostra "10,06%".
- O script salva `public/audio/<id>.mp3`, `videos/<id>-alignment.json` (texto enviado + alinhamento por caractere) e `videos/<id>-captions.json` (palavras com timestamp), e aponta `audio`/`captions` no JSON.
- **Retiming:** com a narração, cada corte cai logo antes da 1ª palavra do shot (ou da palavra em `"cutOnWord"` no shot) e as entradas dentro do shot esticam/encolhem com a fala; `enterOnWord` usa os timestamps reais. O vídeo termina 1s depois da última palavra. Shot com menos de 0,6s é juntado ao vizinho. Os `duration` do JSON viram só a proporção desejada.
- **Efeitos sonoros** automáticos (biblioteca `public/sfx/<tipo>-<n>.mp3`): transição → whoosh/swipe/glitch conforme o tipo, ícone → pop, número herói e ransom → hit (ransom também paper), digitação → click, pattern interrupt → riser + hit, tira de fotos → swipe por foto. As variações se alternam. `"sfx": "riser"` num elemento põe um riser terminando no impacto; `"sfx": { "hit": "sfx/meu-hit.mp3" }` no vídeo troca o arquivo de um tipo.
- **Mixagem:** narração 1.0, efeitos 0.25–0.45 com ducking (caem ~9 dB durante a fala). Trilha opcional: se existir `public/audio/bg.mp3`, toca em loop a 0.06 com fade in/out (abaixa um pouco na fala). O master final é normalizado em -14 LUFS.
- A chave fica em `.env` (`ELEVENLABS_API_KEY`). Áudios gerados não vão pro git.

Outros comandos: `npm run images:cutout` (refaz os recortes), `npm run fonts:cache` (baixa as fontes da marca pra `public/fonts/`), `npm run textures` (regera grão e halftone em `public/textures/`).

A chave do Pixabay fica em `.env` (`PIXABAY_API_KEY=...`), que não vai pro git.

## WireframeExplainer (holograma 3D)

Visual de "visualização científica": objetos em malha (triângulos brancos translúcidos + bordas ciano com bloom), sala com chão de grade infinito e paredes de hexágono, partículas, arcos de luz orbitando, scanlines, glitch nos cortes e câmera sempre em movimento (órbita, dolly, punch-in). Magenta `#FF2E63` pro que é negativo (preço subindo, imposto, carrinho caro).

Usa os mesmos shots e elementos do Kinetic. Cada shot ganha um palco 3D em `"wire"` (sem isso, o palco é deduzido dos elementos: `bars` → gráfico 3D, `number` → número + termômetro, `line` → linha 3D, carrinho → carrinho, resto → núcleo):

```jsonc
{ "id": "c4b", "duration": 2.1, "cutOnWord": "continua",
  "wire": {
    "stage": "cart",                 // head | bars | line | number | cart | core | building | food | cables | end
    "alertAt": { "enterOnWord": "caro?" },  // o miolo acende em magenta nessa palavra
    "priceTag": true, "walls": true,
    "camera": { "orbit": [-24, -6], "radius": [13, 11.2], "height": [2, 2.6], "target": [0, 0.6, 0] }
  },
  "elements": [
    { "type": "keyword", "text": "CARO", "enterOnWord": "caro?", "alert": true, "impact": true },
    { "type": "label", "text": "PREÇO ↑", "at": 0.4 }
  ] }
```

- **Texto:** `keyword` (e também `text` grande, `ransom`, `clipping`) vira a palavra-chave grande, branca, caixa alta, com contorno preto grosso e sombra; uma por vez, troca quando entra a próxima. `label` e textos mono/digitados viram HUD ciano. Números (`number`, `bars`, `line`) em mono, estilo HUD, colados nos objetos 3D. Legenda completa embaixo, igual ao Kinetic.
- **Modelos:** `npm run models:fetch` baixa a cabeça (Lee Perry-Smith, CC BY 3.0) e a figura humana (X Bot, Mixamo) dos exemplos do three.js pra `public/models/` (não vão pro git); créditos e licenças em `public/models/credits.json`. Carrinho, termômetro, gráficos, etiqueta, arroz, leite, cédula e o resto são construídos por código em `src/components/wire/`.
- **Câmera:** `orbit` (graus, início→fim do shot), `radius` (distância), `height`, `target`, `travel`, `fov`.

## KineticExplainer (padrão)

Cada cena (`narration`) é cortada em **shots de 1–3s** (2–3 cortes por frase). Cada shot tem layout próprio, câmera virtual (punch-in, deriva, rotação leve, tremida nos impactos, speed ramp na saída) e uma transição de entrada sorteada por seed, sem repetir a anterior. Exemplo completo: `videos/rikuai-001-elevador.json`.

```jsonc
{
  "id": "rikuai-001-elevador",
  "composition": "Rikuai001Elevador",
  "brand": "rikuai",
  "background": { "palette": "sunset-dark", "speed": 0.3 },  // ou "palette": ["#..", "#..", "#..", "#..", "#.."], ou "video": "bg/loop.mp4"
  "sfx": { "whoosh": "sfx/whoosh.mp3", "hit": "sfx/hit.mp3" }, // opcional; eventos sem arquivo ficam mudos
  "scenes": [
    {
      "id": "numeros",
      "narration": "Em 2021 a inflação passou de 10%.",
      "shots": [
        {
          "id": "s3a", "duration": 2.4,
          "transition": "flash",          // opcional (padrão: sorteada)
          "palette": "heat",              // opcional: troca a paleta do fundo (com fade)
          "interrupt": "black",           // opcional: black | white | accent (fundo chapado = pattern interrupt)
          "camera": { "zoom": [1, 1.08], "rotate": 0.8 },
          "elements": [
            { "type": "number", "value": 10.06, "suffix": "%", "y": 640, "enterOnWord": "passou", "impact": true, "sfx": "hit" }
          ]
        }
      ]
    }
  ]
}
```

- **Paletas prontas:** `sunset`, `sunset-dark` (mais fundo: roxo e quase preto dominando, laranja só nos brilhos), `electric`, `rikuai`, `heat`, `rikuai-heat` (alerta da linha roxa). Lista própria: 4 ou 5 cores em qualquer ordem (são ordenadas da mais clara pra mais escura; sem a 5ª, uma sombra profunda é criada). O fundo é um gradiente fluido (WebGL) com manchas grandes, áreas escuras de verdade, vinheta e grão; muda de paleta suavemente entre shots e pulsa nos impactos.
- **Transições:** `zoom`, `whip` (com motion blur), `circle`, `wipe` (diagonal), `glitch`, `flash` (2 quadros, conteúdo sempre visível), `invert` (os 2 últimos quadros da cena saem com as cores invertidas), `slide` (com overshoot), `morph`, `cut` (use `cut` pra match cut).
- **Tempo:** cada elemento entra em `at` (segundos desde o início do shot; negativo = já entra no meio da animação, bom pro gancho do 1º quadro) ou em `enterOnWord` (+ `wordOffset`). `exitAt` faz sair antes do fim, com antecipação.
- **Campos comuns** a todos os elementos: `x`, `y` (centro, em px de 1080x1920), `enter` (`pop`, `up`, `down`, `left`, `right`, `zoom`, `drop`, `blur`, `none`, `instant`), `depth` (0 fundo, 1 meio, 2 frente — parallax), `scale`, `rotate`, `tilt` (3D), `float` (px), `z`, `impact` (tremida + partículas + pulso do fundo), `sfx` (`whoosh`, `pop`, `hit`, `click`, `riser`...).

| Tipo | Campos próprios | O que é |
|---|---|---|
| `text` | `text`, `mode` (`word`/`line`/`letter`), `effect` (`scale`, `slide`, `mask`, `blur`, `impact`, `type`), `size`, `font` (`sans`/`display`/`mono`/`hand`), `color`, `highlight` (palavras), `plate`, `outline` (só contorno: números/palavras gigantes vazados) | texto cinético |
| `number` | `value`, `decimals`, `prefix`, `suffix`, `size`, `duration`, `particles`, `label` | número grande que conta, unidade menor, glow e partículas no fim |
| `bars` | `data` (`label`, `value`, `display`, `highlight`), `width`, `height`, `unit`, `morphFrom` (índice), `bracket` (`from`, `to`, `label`, `at`) | barras em cascata; `morphFrom` faz o número do shot anterior voar pra barra; `display` troca o texto final (ex: `"+7,69%"`) |
| `line` | `points`, `labels`, `width`, `height`, `unit` | linha que se desenha |
| `icon` | `icon` (nome do lucide.dev), `preset`, `size`, `container` (`circle`/`pill`/`none`), `label` | ícone animado (o traço se desenha) |
| `icons` | `icons`, `arrangement` (`grid`/`orbit`/`row`), `preset`, `size`, `radius` | grupo de ícones em cascata |
| `card` | `title`, `subtitle`, `kicker`, `icon`, `width`, `height`, `tone` (`glass`/`dark`/`accent`) | card de vidro 3D |
| `bubbles` | `items`, `every`, `size`, `spread`, `step` | balões de comentário pipocando |
| `shape` | `shape` (`ring`, `circle`, `square`, `cross`, `underline`, `bracket`, `line`, `arrow`, `dots`, `diagonals`, `blob`, `triangle`, `disc`), `w`, `h`, `toX`, `toY`, `color`, `stroke` | formas: as de traço se desenham; `dots` (grade de pontos com onda), `diagonals` (faixas deslizando), `blob`/`triangle`/`disc` (preenchidas, respirando) |
| `ghost` | `icon`, `size`, `opacity`, `blur` | ícone enorme, desfocado e translúcido, girando no fundo |
| `building` | `floors`, `width`, `height`, `elevator` (`floor`, `moves`, `cargo`, `label`), `stairs` (`floor`, `moves`, `label`, `icon`), `markers` (`floor`, `icon`, `label`, `at`/`enterOnWord`), `gap` (`from`, `to`, `label`), `speed` (`label`) | prédio da analogia: andar = preço, elevador = inflação, escada = salário. `moves`: `[{ "enterOnWord": "voando", "to": 10, "duration": 0.55, "ease": "fast" }]` (`fast`, `slow`, `smooth`); `speed` mostra um velocímetro ligado à velocidade do elevador |
| `particles` | `count`, `spread`, `kind` (`dots`/`sparks`/`confetti`) | explosão de partículas |
| `meter` | `kind` (`thermometer`/`gauge`/`progress`), `value` (0–1), `label` | medidores |
| `photo` | `style`, `image`, `images` (strip), `text` (mask), `side` (split), `width`, `height` | foto do Pixabay em movimento |
| `ransom` | `text`, `size` | letras de revista batendo uma a uma |
| `clipping` | `text`, `sub`, `size` | manchete de jornal recortada |
| `label` | `text` | rótulo mono (fonte do dado) |

- **Presets de ícone:** `draw`, `pop`, `bounce`, `spin`, `spin3d`, `float`, `pulse`, `shake`, `drive` (rodas girando), `trail` (rastro), `grow`, `rise`, `blink`, `chartUp`, `fill` (termômetro enchendo), `lock`.
- **Estilos de foto:** `cutout` (recorte com contorno), `torn` (papel rasgado), `mask` (foto dentro de uma palavra), `strip` (3–4 fotos a 0,3s cada), `split` (meia tela), `frame` (card 3D). Não repita o mesmo estilo em seguida; uma foto a cada 5–8s, 1–3s na tela.
- **Variações (versões B):** `"seed"` muda o sorteio das transições; `"layout": { "seed", "mirror": 0.5 }` espelha metade dos shots (o que estava à esquerda vai pra direita); `"mirror": false` num shot impede. Quando dois shots seguidos têm texto grande na mesma faixa da tela, o sorteio só usa transições em que eles nunca aparecem juntos (`flash`, `invert`).
- **Variedade:** o anel (`ring`) no máximo 2 vezes por vídeo; alterne com `dots`, `diagonals`, formas preenchidas, `ghost` e textos `outline`. Não repita o mesmo layout em dois shots seguidos.
- **Hierarquia:** o elemento principal de cada shot ocupa 70–80% da largura.
- **Contraste:** cards de vidro e contêineres de ícone são vidro escuro (`rgba(20,10,25,0.45)`) com borda clara; textos claros têm sombra escura.
- **Revisão antes de mostrar:** nenhum trecho com elemento parado ou tela vazia por mais de 0,5s.

## CollageExplainer

Cada cena é uma colagem de **2 a 4+ peças em camadas** (`layers`, em ordem de empilhamento: a última fica por cima). Receita: uma foto base (`torn` ou `taped`), um objeto `cutout` sobreposto saindo da borda da base, e pelo menos um elemento gráfico (número, etiqueta de preço, fita, rótulo mono, seta...). As peças podem sair da moldura e se sobrepor.

**Ritmo:** algo novo entra ou se move a cada 1–2 segundos. Cada peça entra num `at` (segundos desde o início da cena) ou numa palavra da narração (`enterOnWord`, primeira ocorrência na cena; `wordOffset` ajusta em segundos). `moves` faz a peça se mover depois de entrar (também por `at` ou `enterOnWord`). Todas as peças flutuam de leve depois de assentar (`float`: amplitude em px, `0` desliga).

```jsonc
{
  "id": "rikuai-001-elevador",        // = nome do arquivo
  "composition": "Rikuai001Elevador", // id no Studio
  "brand": "rikuai",                  // brands/rikuai.json
  "audio": "audio/rikuai-001.mp3",    // opcional, em public/
  "captions": "rikuai-001-captions.json", // opcional; sem isso, legendas saem da narração
  "music": { "src": "audio/bg.mp3", "volume": 0.08 }, // opcional
  "scenes": [
    {
      "id": "carrinho",
      "narration": "Todo mês o carrinho volta pra casa um pouco mais vazio.",
      "duration": 5,                  // segundos
      "transition": "swap",           // entrada: swap (padrão) | cut
      "layers": [
        {
          "id": "shelf", "type": "photo",
          "image": { "query": "supermarket shelves", "treatment": "torn", "require": ["supermarket"] },
          "x": 460, "y": 690, "width": 780, "rotate": -3, "at": 0.2
        },
        {
          "id": "cart", "type": "photo",
          "image": { "query": "shopping cart supermarket", "treatment": "cutout", "id": 3154060 },
          "x": 640, "y": 1000, "width": 560, "enterOnWord": "carrinho",
          "moves": [{ "enterOnWord": "volta", "x": 720, "rotate": 3 }]
        },
        { "type": "number", "value": 10, "suffix": "º", "x": 700, "y": 560, "size": 250, "color": "accent", "enterOnWord": "sobem" },
        { "type": "arrow", "x": 300, "y": 1150, "toX": 470, "toY": 1060, "enterOnWord": "pouco" },
        { "type": "hand", "text": "mais vazio?", "x": 250, "y": 1190, "enterOnWord": "mais" }
      ],
      "focus": { "x": 460, "y": 690 }  // opcional: centro do glow roxo (padrão: primeira foto)
    }
  ]
}
```

Tipos de peça (`type`) — todas aceitam `x`, `y`, `at`/`enterOnWord`, `wordOffset`, `scale`, `rotate`, `z`, `float`, `moves`:

| Tipo | Campos próprios | O que é |
|---|---|---|
| `photo` | `image` (busca), `width`, `height` | foto do Pixabay; `image.treatment`: `torn`, `taped` ou `cutout` |
| `number` | `value`, `prefix`, `suffix`, `decimals`, `size`, `color` (`accent`/`text`/`cream`), `countFrom`, `countDuration` | número grande que conta até o valor |
| `price` | `text`, `sub`, `size` | etiqueta de preço creme com barbante |
| `tape` | `width` | pedaço de fita adesiva |
| `strip` | `text`, `size` | manchete em faixa de papel rasgado |
| `ransom` | `text`, `size` | "ransom note": cada letra num recorte |
| `display` | `text`, `size` | título grande na fonte display |
| `chip` | `text`, `size` | etiqueta roxa |
| `mono` | `text`, `size` | rótulo tech (fonte de dado, data); `x` = borda esquerda |
| `hand` | `text`, `size` | anotação à mão, escrita na hora |
| `arrow` | `toX`, `toY` | seta desenhada de (x,y) até (toX,toY) |
| `circle` | `w`, `h` | círculo à mão em volta de (x,y) |
| `underline` | `w` | sublinhado à mão centrado em (x,y) |

- Coordenadas em px do quadro 1080x1920. Área segura do TikTok: 250px no topo, 420px na base, 140px à direita. O visual fica entre 15% e 65% da altura (y 288–1248); rótulos mono ficam no topo dessa faixa (y ≈ 300); legendas logo abaixo.
- Legendas: blocos de até 5 palavras (no máximo 2 linhas), quebrados por sentido — nunca terminam em artigo, preposição, "um/uma", "não" etc.
- Fotos: `images:fetch` só aceita originais com largura ≥ 1500px, evita pessoas pelas tags, e aceita `require` (tags obrigatórias), `exclude` (tags proibidas, ex: `["euro"]`) e `id` (fixa uma foto). A API do Pixabay entrega no máximo 1280px no lado maior. Os créditos ficam em `public/images/raw/<id>/credits.json`; as fotos não vão pro git (licença).
- O formato antigo (`image` + `layout` + `title` + `labels` + `marks` na cena) continua funcionando e vira camadas automaticamente.

## Fontes da marca

Em `brands/<marca>.json`, `fonts` define papéis: `display` (títulos e números grandes), `sans` (legendas), `mono` (fontes de dado, datas, rótulos), `hand` (anotações). `ransomFonts` são as fontes sorteadas por letra no ransom note.

- Google Fonts: `{ "family": "Anton", "weights": ["400"] }` e depois `npm run fonts:cache`.
- Arquivos próprios: coloque em `public/fonts/brand/` e use `{ "family": "Minha Fonte", "files": [{ "src": "fonts/brand/Minha-Bold.woff2", "weight": "700" }] }`.

## PaperExplainer (template antigo)

Ver `videos/demo-paper-explainer.json`. Visuais disponíveis em `src/visuals/registry.ts`: `TitleCard`, `Versus`, `StampSlam`, `BarChart`, `CartTag`, `ElevatorTower`, `EndCard`.

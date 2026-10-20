# Vídeos

Cada `*.json` aqui com `composition` + `scenes` vira uma composição no Remotion Studio (pasta **Videos**), sem mexer em código. O template padrão é o **KineticExplainer** (motion graphics). Os anteriores continuam disponíveis com `"template": "CollageExplainer"` ou `"template": "PaperExplainer"`.

## Fluxo de um vídeo novo

```bash
# 1. escreva videos/<id>.json (formato abaixo)
npm run images:fetch -- <id>     # busca as fotos no Pixabay (+ remove fundo das cenas "cutout")
npm run preview:fast -- <id>     # prévia rápida: out/preview/<id>-fast.mp4 (metade da escala)
npm run render:video -- <id>     # final: out/<id>.mp4 (H.264, 1080x1920, 30fps)
```

Outros comandos: `npm run images:cutout` (refaz os recortes), `npm run fonts:cache` (baixa as fontes da marca pra `public/fonts/`), `npm run textures` (regera grão e halftone em `public/textures/`).

A chave do Pixabay fica em `.env` (`PIXABAY_API_KEY=...`), que não vai pro git.

## KineticExplainer (padrão)

Cada cena (`narration`) é cortada em **shots de 1–3s** (2–3 cortes por frase). Cada shot tem layout próprio, câmera virtual (punch-in, deriva, rotação leve, tremida nos impactos, speed ramp na saída) e uma transição de entrada sorteada por seed, sem repetir a anterior. Exemplo completo: `videos/rikuai-001-elevador.json`.

```jsonc
{
  "id": "rikuai-001-elevador",
  "composition": "Rikuai001Elevador",
  "brand": "rikuai",
  "background": { "palette": "sunset", "speed": 0.3 },  // ou "palette": ["#..", "#..", "#..", "#.."], ou "video": "bg/loop.mp4"
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

- **Paletas prontas:** `sunset`, `electric`, `rikuai`, `heat`. O fundo é um gradiente fluido (WebGL) com grão; muda de paleta suavemente entre shots e pulsa nos impactos.
- **Transições:** `zoom`, `whip` (com motion blur), `circle`, `wipe` (diagonal), `glitch`, `flash`, `slide` (com overshoot), `morph`, `cut` (use `cut` pra match cut).
- **Tempo:** cada elemento entra em `at` (segundos desde o início do shot; negativo = já entra no meio da animação, bom pro gancho do 1º quadro) ou em `enterOnWord` (+ `wordOffset`). `exitAt` faz sair antes do fim, com antecipação.
- **Campos comuns** a todos os elementos: `x`, `y` (centro, em px de 1080x1920), `enter` (`pop`, `up`, `down`, `left`, `right`, `zoom`, `drop`, `blur`, `none`, `instant`), `depth` (0 fundo, 1 meio, 2 frente — parallax), `scale`, `rotate`, `tilt` (3D), `float` (px), `z`, `impact` (tremida + partículas + pulso do fundo), `sfx` (`whoosh`, `pop`, `hit`, `click`, `riser`...).

| Tipo | Campos próprios | O que é |
|---|---|---|
| `text` | `text`, `mode` (`word`/`line`/`letter`), `effect` (`scale`, `slide`, `mask`, `blur`, `impact`, `type`), `size`, `font` (`sans`/`display`/`mono`/`hand`), `color`, `highlight` (palavras), `plate` | texto cinético |
| `number` | `value`, `decimals`, `prefix`, `suffix`, `size`, `duration`, `particles`, `label` | número grande que conta, unidade menor, glow e partículas no fim |
| `bars` | `data` (`label`, `value`, `highlight`), `width`, `height`, `unit`, `morphFrom` (índice), `bracket` (`from`, `to`, `label`, `at`) | barras em cascata; `morphFrom` faz o número do shot anterior voar pra barra |
| `line` | `points`, `labels`, `width`, `height`, `unit` | linha que se desenha |
| `icon` | `icon` (nome do lucide.dev), `preset`, `size`, `container` (`circle`/`pill`/`none`), `label` | ícone animado (o traço se desenha) |
| `icons` | `icons`, `arrangement` (`grid`/`orbit`/`row`), `preset`, `size`, `radius` | grupo de ícones em cascata |
| `card` | `title`, `subtitle`, `kicker`, `icon`, `width`, `height`, `tone` (`glass`/`dark`/`accent`) | card de vidro 3D |
| `bubbles` | `items`, `every`, `size`, `spread`, `step` | balões de comentário pipocando |
| `shape` | `shape` (`ring`, `circle`, `square`, `cross`, `underline`, `bracket`, `line`, `arrow`), `w`, `h`, `toX`, `toY` | formas que se desenham |
| `particles` | `count`, `spread`, `kind` (`dots`/`sparks`/`confetti`) | explosão de partículas |
| `meter` | `kind` (`thermometer`/`gauge`/`progress`), `value` (0–1), `label` | medidores |
| `photo` | `style`, `image`, `images` (strip), `text` (mask), `side` (split), `width`, `height` | foto do Pixabay em movimento |
| `ransom` | `text`, `size` | letras de revista batendo uma a uma |
| `clipping` | `text`, `sub`, `size` | manchete de jornal recortada |
| `label` | `text` | rótulo mono (fonte do dado) |

- **Presets de ícone:** `draw`, `pop`, `bounce`, `spin`, `spin3d`, `float`, `pulse`, `shake`, `drive` (rodas girando), `trail` (rastro), `grow`, `rise`, `blink`, `chartUp`, `fill` (termômetro enchendo), `lock`.
- **Estilos de foto:** `cutout` (recorte com contorno), `torn` (papel rasgado), `mask` (foto dentro de uma palavra), `strip` (3–4 fotos a 0,3s cada), `split` (meia tela), `frame` (card 3D). Não repita o mesmo estilo em seguida; uma foto a cada 5–8s, 1–3s na tela.
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

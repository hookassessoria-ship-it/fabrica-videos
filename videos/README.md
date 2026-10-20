# Vídeos

Cada `*.json` aqui com `composition` + `scenes` vira uma composição no Remotion Studio (pasta **Videos**), sem mexer em código. O template padrão é o **CollageExplainer** (colagem mixed media); o antigo **PaperExplainer** continua disponível com `"template": "PaperExplainer"`.

## Fluxo de um vídeo novo

```bash
# 1. escreva videos/<id>.json (formato abaixo)
npm run images:fetch -- <id>     # busca as fotos no Pixabay (+ remove fundo das cenas "cutout")
npm run preview:fast -- <id>     # prévia rápida: out/preview/<id>-fast.mp4 (metade da escala)
npm run render:video -- <id>     # final: out/<id>.mp4 (H.264, 1080x1920, 30fps)
```

Outros comandos: `npm run images:cutout` (refaz os recortes), `npm run fonts:cache` (baixa as fontes da marca pra `public/fonts/`), `npm run textures` (regera grão e halftone em `public/textures/`).

A chave do Pixabay fica em `.env` (`PIXABAY_API_KEY=...`), que não vai pro git.

## CollageExplainer

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
      "narration": "Texto falado nesta cena.",
      "duration": 5,                  // segundos
      "transition": "swap",           // entrada: swap (padrão) | cut
      "image": {                      // foto principal (Pixabay)
        "query": "shopping cart supermarket", // em inglês
        "treatment": "cutout",        // cutout | torn | taped
        "require": ["cart"],          // opcional: tags obrigatórias
        "id": 3154060                 // opcional: fixa uma foto específica
      },
      "layout": { "x": 500, "y": 798, "width": 800, "height": 820, "rotate": -3 }, // opcional
      "title": { "style": "ransom", "text": "INFLAÇÃO", "x": 500, "y": 760, "at": 1.4 }, // strip | ransom | display
      "labels": [
        { "kind": "mono", "text": "Fonte: IBGE (IPCA)", "x": 96, "y": 300, "at": 0.5 }, // x = borda esquerda
        { "kind": "hand", "text": "mais vazio?", "x": 790, "y": 1190, "at": 1.6 },      // x,y = centro
        { "kind": "chip", "text": "+7,69%", "x": 700, "y": 500 }
      ],
      "marks": [
        { "kind": "arrow", "x": 760, "y": 1150, "toX": 660, "toY": 1010, "at": 1.4 },
        { "kind": "circle", "x": 330, "y": 840, "w": 320, "h": 120 },
        { "kind": "underline", "x": 500, "y": 900, "w": 300 }
      ],
      "focus": { "x": 500, "y": 768 }  // opcional: centro do glow roxo (padrão: centro da foto)
    }
  ]
}
```

- Tempos (`at`) em segundos desde o início da cena; coordenadas em px do quadro 1080x1920.
- Área segura do TikTok: 250px no topo, 420px na base, 140px à direita. O visual fica entre 15% e 65% da altura (y 288–1248); rótulos mono ficam bem no topo dessa faixa (y ≈ 300); legendas logo abaixo.
- Tratamentos: **torn** (papel rasgado com faixa creme), **cutout** (objeto sem fundo com contorno de adesivo), **taped** (foto com borda branca e fita). Todas recebem halftone, grão e ~20% de dessaturação.
- `images:fetch` evita fotos com pessoas pelas tags e prefere fotos verticais em alta resolução. Os créditos (autor, link, id) ficam em `public/images/raw/<id>/credits.json`. As fotos em si não vão pro git (licença do Pixabay); o `credits.json` fixa os ids, então `images:fetch` baixa de novo as mesmas.

## Fontes da marca

Em `brands/<marca>.json`, `fonts` define papéis: `display` (títulos e números grandes), `sans` (legendas), `mono` (fontes de dado, datas, rótulos), `hand` (anotações). `ransomFonts` são as fontes sorteadas por letra no ransom note.

- Google Fonts: `{ "family": "Anton", "weights": ["400"] }` e depois `npm run fonts:cache`.
- Arquivos próprios: coloque em `public/fonts/brand/` e use `{ "family": "Minha Fonte", "files": [{ "src": "fonts/brand/Minha-Bold.woff2", "weight": "700" }] }`.

## PaperExplainer (template antigo)

Ver `videos/demo-paper-explainer.json`. Visuais disponíveis em `src/visuals/registry.ts`: `TitleCard`, `Versus`, `StampSlam`, `BarChart`, `CartTag`, `ElevatorTower`, `EndCard`.

# Vídeos

Cada `*.json` aqui com `composition` + `scenes` vira uma composição no Remotion Studio (pasta **Videos**), sem mexer em código.

```jsonc
{
  "id": "rikuai-001-elevador",        // nome do arquivo, usado no render
  "composition": "Rikuai001Elevador", // id da composição no Studio
  "template": "PaperExplainer",
  "brand": "rikuai",                  // brands/rikuai.json
  "audio": "audio/rikuai-001.mp3",    // opcional, em public/
  "captions": "rikuai-001-captions.json", // opcional; sem isso, legendas saem da narração
  "music": { "src": "audio/bg.mp3", "volume": 0.08 }, // opcional
  "scenes": [
    {
      "id": "placar",
      "narration": "Texto falado nesta cena.",
      "duration": 4,                  // segundos
      "transition": "slide",          // entrada: slide | slide-left | slide-up | flip | cut
      "backdrop": "sheets",           // sheets | grid | city | plain
      "source": "IBGE (IPCA)",        // opcional: "Fonte: ..." no canto
      "sourceAt": 0.6,
      "camera": [{ "at": 0, "x": 540, "y": 960, "zoom": 1 }], // opcional
      "visual": { "type": "Versus", "props": { } }
    }
  ]
}
```

Tempos dentro de `props` (`at`, `keys[].at` etc.) são em segundos, contados do início da cena. Coordenadas são do palco 1080x1920.

## Visuais disponíveis (`visual.type`)

| Tipo | Props principais |
|---|---|
| `TitleCard` | `title`, `subtitle?`, `kicker?`, `tone?` |
| `Versus` | `header?`, `left`/`right`: `{ title, subtitle?, value?, tone? }`, `vs?` |
| `StampSlam` | `stamp`, `sub?`, `at?`, `docTitle?` |
| `BarChart` | `title?`, `data`: `[{ label, value, display?, highlight? }]`, `at?`, `stagger?` |
| `CartTag` | `price`, `sub?`, `items?` (`rice`/`milk`/`beans`/`box`), `tagAt?`, `leaveAt?` |
| `ElevatorTower` | `floors`, `floorHeight`, `elevator { keys, contents }`, `stairs { climber { keys, tired } }`, `tags`, `arrow`, `pullers`, `weight`, `cart` |
| `EndCard` | `headline?`, `cta?` (padrão: CTA da marca) |

Tons de papel (`tone`): `paper`, `raised`, `accent`, `light`, `muted`.

Visual novo: crie o componente em `src/visuals/` com `defineVisual` e registre em `src/visuals/registry.ts`. As peças de papel reutilizáveis ficam em `src/components/paper/`.

## Fontes

As fontes vêm do Google Fonts pelo nome escrito em `brands/*.json`. Depois de trocar a fonte de uma marca, rode `npm run fonts:cache` pra baixar os arquivos pra `public/fonts/` (o render usa o cache local e não depende da rede).

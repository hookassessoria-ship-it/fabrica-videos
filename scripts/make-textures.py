"""Gera uma vez as texturas de impressão usadas pelo CollageExplainer (via <Img>).

public/textures/grain.png     grão (pontinhos claros/escuros com alfa), 540x960, exibido em 2x
public/textures/halftone.png  retícula de pontos a 45°, com tamanho levemente irregular

Uso: npm run textures
"""
from pathlib import Path

import numpy as np
from PIL import Image

OUT = Path(__file__).resolve().parent.parent / "public" / "textures"
OUT.mkdir(parents=True, exist_ok=True)
rng = np.random.default_rng(7)

# Grão: branco onde o ruído é positivo, preto onde é negativo; alfa = intensidade.
h, w = 960, 540
n = rng.normal(0, 1, (h, w))
rgb = np.where(n > 0, 255, 0).astype(np.uint8)
alpha = np.clip(np.abs(n) * 90, 0, 255).astype(np.uint8)
grain = np.dstack([rgb, rgb, rgb, alpha])
Image.fromarray(grain, "RGBA").save(OUT / "grain.png", optimize=True)

# Halftone: grade a 45°, período 9px, raio modulado por ruído de baixa frequência.
H, W, S = 1920, 1080, 2  # supersample 2x pra suavizar os pontos
period = 9 * S
yy, xx = np.mgrid[0 : H * S, 0 : W * S].astype(np.float32)
u = (xx + yy) / np.sqrt(2)
v = (xx - yy) / np.sqrt(2)
du = (u % period) - period / 2
dv = (v % period) - period / 2
dist = np.sqrt(du**2 + dv**2)
low = rng.random((H // 60 + 2, W // 60 + 2)).astype(np.float32)
low_img = Image.fromarray((low * 255).astype(np.uint8)).resize((W * S, H * S), Image.BICUBIC)
radius = (1.2 + np.asarray(low_img, dtype=np.float32) / 255 * 1.6) * S
a = np.clip(radius - dist + 0.5, 0, 1)
a = (a * 255).astype(np.uint8)
dots = Image.fromarray(np.dstack([np.zeros_like(a)] * 3 + [a]), "RGBA").resize((W, H), Image.LANCZOS)
dots.save(OUT / "halftone.png", optimize=True)

for f in sorted(OUT.glob("*.png")):
    print(f"  ✓ {f.relative_to(OUT.parent.parent)} ({f.stat().st_size // 1024} KB)")

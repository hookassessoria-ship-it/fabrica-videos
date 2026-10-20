"""Remove o fundo das fotos com rembg: public/images/raw -> public/images/cut (PNG transparente).

Para cada foto gera:
  cut/<video>/<cena>.png          objeto sem fundo, recortado justo
  cut/<video>/<cena>.sticker.png  o mesmo com contorno branco grosso (adesivo)
e atualiza o credits.json do vídeo com os caminhos e tamanhos.

Uso:
  npm run images:cutout                      # todas as fotos de cenas "cutout" ainda sem recorte
  npm run images:cutout -- <video-id>        # só um vídeo
  python3 scripts/cutout.py arquivo.jpg ...  # arquivos específicos (o images:fetch usa assim)
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from rembg import new_session, remove
from scipy import ndimage

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / "public"
RAW = PUBLIC / "images" / "raw"
CUT = PUBLIC / "images" / "cut"
MODEL = "isnet-general-use"
STICKER_RATIO = 0.028  # espessura do contorno em relação ao maior lado
PAD_RATIO = 0.04


def sticker(rgba: Image.Image) -> Image.Image:
    a = np.asarray(rgba.getchannel("A"), dtype=np.float32) / 255
    border = max(6, round(max(rgba.size) * STICKER_RATIO))
    pad = border + 4
    a_pad = np.pad(a, pad)
    # Distância até o objeto -> contorno arredondado (não quadrado como um MaxFilter).
    dist = ndimage.distance_transform_edt(a_pad < 0.5)
    outline = np.clip(border + 0.5 - dist, 0, 1)
    rgb = np.pad(np.asarray(rgba.convert("RGB"), dtype=np.float32), ((pad, pad), (pad, pad), (0, 0)))
    white = np.full_like(rgb, 250)
    out_rgb = rgb * a_pad[..., None] + white * (1 - a_pad[..., None])
    out_a = np.maximum(outline, a_pad)
    out = np.dstack([out_rgb, out_a * 255]).astype(np.uint8)
    return Image.fromarray(out, "RGBA")


def keep_main_parts(rgba: Image.Image) -> Image.Image:
    """Descarta fragmentos soltos (sujeira do recorte), mantendo as partes grandes."""
    a = np.asarray(rgba.getchannel("A"))
    labels, n = ndimage.label(a > 32)
    if n <= 1:
        return rgba
    sizes = ndimage.sum(np.ones_like(a), labels, range(1, n + 1))
    keep = np.isin(labels, np.nonzero(sizes >= sizes.max() * 0.03)[0] + 1)
    out = np.asarray(rgba).copy()
    out[..., 3] = np.where(keep, a, 0)
    return Image.fromarray(out, "RGBA")


def process(raw: Path, session) -> dict:
    rel = raw.relative_to(RAW)
    out = CUT / rel.with_suffix(".png")
    out.parent.mkdir(parents=True, exist_ok=True)
    src = Image.open(raw)
    if src.mode in ("RGBA", "LA", "P") and np.asarray(src.convert("RGBA").getchannel("A")).min() < 128:
        cut = src.convert("RGBA")  # já vem sem fundo
    else:
        cut = remove(src.convert("RGB"), session=session, post_process_mask=True)
    cut = keep_main_parts(cut)
    bbox = cut.getchannel("A").point(lambda v: 255 if v > 16 else 0).getbbox()
    if bbox is None:
        raise SystemExit(f"rembg não encontrou objeto em {raw}")
    pad = round(max(cut.size) * PAD_RATIO)
    x0, y0, x1, y1 = bbox
    cut = cut.crop((max(0, x0 - pad), max(0, y0 - pad), min(cut.width, x1 + pad), min(cut.height, y1 + pad)))
    cut.save(out, optimize=True)
    st = sticker(cut)
    st_path = out.with_suffix(".sticker.png")
    st.save(st_path, optimize=True)
    print(f"  ✓ {out.relative_to(PUBLIC)} {cut.width}x{cut.height} (+ adesivo {st.width}x{st.height})")
    return {
        "cut": str(out.relative_to(PUBLIC)),
        "cutWidth": cut.width,
        "cutHeight": cut.height,
        "sticker": str(st_path.relative_to(PUBLIC)),
        "stickerWidth": st.width,
        "stickerHeight": st.height,
    }


def update_credits(raw: Path, info: dict) -> None:
    credits_path = raw.parent / "credits.json"
    if not credits_path.exists():
        return
    credits = json.loads(credits_path.read_text())
    file = str(raw.relative_to(PUBLIC))
    for entry in credits.get("images", {}).values():
        if entry.get("file") == file:
            entry.update(info)
    credits_path.write_text(json.dumps(credits, indent=2, ensure_ascii=False) + "\n")


def pending(video_id: str | None) -> list[Path]:
    files = []
    for credits_path in RAW.glob("*/credits.json"):
        if video_id and credits_path.parent.name != video_id:
            continue
        for entry in json.loads(credits_path.read_text()).get("images", {}).values():
            if entry.get("treatment") == "cutout":
                files.append(PUBLIC / entry["file"])
    return files


def main() -> None:
    args = sys.argv[1:]
    files = [Path(a).resolve() for a in args if a.lower().endswith((".jpg", ".jpeg", ".png"))]
    if not files:
        files = pending(args[0] if args else None)
    if not files:
        print("Nada pra recortar (nenhuma cena com treatment \"cutout\").")
        return
    session = new_session(MODEL)
    for raw in files:
        update_credits(raw, process(raw, session))


if __name__ == "__main__":
    main()

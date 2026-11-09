#!/usr/bin/env python3
# ponytail: mockup gerado via PIL puro, sem fonte custom (usa default) —
# trocar pela arte real depois que o cliente tiver fotos de banner de verdade.
import sys
from PIL import Image, ImageDraw, ImageFont

W, H = 1920, 650
BG = (250, 246, 240)      # off-white quente
ACCENT = (168, 92, 62)    # terracota (bate com o logo)
DARK = (40, 35, 32)

img = Image.new("RGB", (W, H), BG)
d = ImageDraw.Draw(img)

# faixa de cor sólida à esquerda (bloco de cor, estilo editorial)
d.rectangle([0, 0, W * 0.38, H], fill=ACCENT)

def font(size, bold=False):
    names = ["arialbd.ttf", "Arial Bold.ttf"] if bold else ["arial.ttf", "Arial.ttf"]
    for n in names:
        try:
            return ImageFont.truetype(n, size)
        except Exception:
            continue
    return ImageFont.load_default()

title_f = font(90, bold=True)
sub_f = font(34)
tag_f = font(28)

d.text((90, H * 0.30), "NOVA\nCOLEÇÃO", font=title_f, fill=(255, 255, 255), spacing=10)
d.text((90, H * 0.74), "Moda infantil do P ao GG", font=sub_f, fill=(255, 255, 255))

d.text((W * 0.44, H * 0.42), "LISA LA BELLE", font=font(64, bold=True), fill=DARK)
d.text((W * 0.44, H * 0.42 + 80), "Família, coragem e o primeiro passo", font=tag_f, fill=(90, 80, 75))

# marca d'água central indicando que é mockup
wm_f = font(24)
d.text((W * 0.44, H * 0.60), "[ espaço reservado — trocar por foto real do produto ]", font=wm_f, fill=(150, 140, 135))

img.save(sys.argv[1] if len(sys.argv) > 1 else "banner-mockup.jpg", quality=90)
print("ok")

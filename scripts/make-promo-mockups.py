#!/usr/bin/env python3
import sys
from PIL import Image, ImageDraw, ImageFont

W, H = 900, 900
BG1 = (40, 35, 32)       # preto quente
BG2 = (168, 92, 62)      # terracota

def font(size, bold=False):
    names = ["arialbd.ttf"] if bold else ["arial.ttf"]
    for n in names:
        try:
            return ImageFont.truetype(n, size)
        except Exception:
            continue
    return ImageFont.load_default()

def make(path, bg, title, sub):
    img = Image.new("RGB", (W, H), bg)
    d = ImageDraw.Draw(img)
    d.text((60, H * 0.72), title, font=font(56, bold=True), fill=(255, 255, 255))
    d.text((60, H * 0.72 + 70), sub, font=font(28), fill=(230, 225, 220))
    img.save(path, quality=90)

make(sys.argv[1], BG1, "MASCULINO", "Shorts, kits e básicos")
make(sys.argv[2], BG2, "PROMOÇÕES", "Até 30% OFF selecionados")
print("ok")

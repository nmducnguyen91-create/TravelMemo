"""Generates the TravelMemo app icon set (stamp mark on forest green). Usage: python3 -I tools/brand/make_icons.py"""
import os
from PIL import Image, ImageDraw

ROOT = os.path.join(os.path.dirname(__file__), "..", "..")
FOREST, PAPER, SAND, CLAY = (23, 59, 52), (245, 240, 229), (213, 198, 174), (168, 108, 76)


def icon(size, pad_ratio=0.0, bg=FOREST):
    s = 1024
    im = Image.new("RGBA", (s, s), bg)
    d = ImageDraw.Draw(im)
    pad = int(s * pad_ratio)
    c = s // 2
    r = (s - 2 * pad) * 0.34
    # outer stamp ring + inner ring
    d.ellipse([c - r, c - r, c + r, c + r], outline=PAPER, width=int(s * 0.035))
    r2 = r * 0.82
    d.ellipse([c - r2, c - r2, c + r2, c + r2], outline=PAPER, width=int(s * 0.012))
    # stylised globe: meridian + equator + latitude arcs
    g = r * 0.55
    w = int(s * 0.022)
    d.ellipse([c - g, c - g, c + g, c + g], outline=SAND, width=w)
    d.ellipse([c - g * 0.45, c - g, c + g * 0.45, c + g], outline=SAND, width=w)
    d.line([c - g, c, c + g, c], fill=SAND, width=w)
    d.arc([c - g, c - g * 0.6, c + g, c + g * 1.4], 200, 340, fill=SAND, width=w)
    # location pin dot
    p = r * 0.16
    d.ellipse([c + g * 0.35 - p, c - g * 0.55 - p, c + g * 0.35 + p, c - g * 0.55 + p], fill=CLAY)
    return im.resize((size, size), Image.LANCZOS)


img = os.path.join(ROOT, "assets", "images")
icon(1024).convert("RGB").save(os.path.join(img, "icon.png"))
icon(1024, bg=(0, 0, 0, 0)).save(os.path.join(img, "splash-icon.png"))
icon(1024, 0.12).save(os.path.join(img, "android-icon-foreground.png"))
icon(48).save(os.path.join(img, "favicon.png"))
pub = os.path.join(ROOT, "public")
os.makedirs(pub, exist_ok=True)
icon(192).convert("RGB").save(os.path.join(pub, "icon-192.png"))
icon(512).convert("RGB").save(os.path.join(pub, "icon-512.png"))
icon(512, 0.12).convert("RGB").save(os.path.join(pub, "icon-maskable-512.png"))
icon(180).convert("RGB").save(os.path.join(pub, "apple-touch-icon.png"))
print("icons written")

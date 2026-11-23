#!/usr/bin/env python3
"""Web-size copies of the product photos.

    python3 scripts/make-web-copies.py            # every photo that has no copy yet, or whose copy is older
    python3 scripts/make-web-copies.py --force    # remake all

Reads assets/products/<id>/**/N.webp (the originals, which are never touched) and writes
assets/products-sm/<id>/**/N.webp at WIDTH pixels wide for the shop cards, thumbnails and menu tiles.
The product page's main image keeps using the original. Then run
`node scripts/generate-images.mjs --sync` so js/image-manifest.js lists the copies.
"""
import os, re, sys, json
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "assets", "products")
DST = os.path.join(ROOT, "assets", "products-sm")
WIDTH = 800
QUALITY = 82
FORCE = "--force" in sys.argv
IMG = re.compile(r"\.(webp|png|jpe?g)$", re.I)

# only the live catalog's folders
catalog_src = open(os.path.join(ROOT, "js", "catalog.js"), encoding="utf-8").read()
ids = set(re.findall(r'"id":\s*"([^"]+)"', catalog_src))

made = skipped = 0
for pid in sorted(os.listdir(SRC)):
    if pid not in ids:
        continue
    for dirpath, _, files in os.walk(os.path.join(SRC, pid)):
        for f in files:
            if not IMG.search(f):
                continue
            src = os.path.join(dirpath, f)
            rel = os.path.relpath(src, SRC)
            dst = os.path.join(DST, os.path.splitext(rel)[0] + ".webp")
            if not FORCE and os.path.exists(dst) and os.path.getmtime(dst) >= os.path.getmtime(src):
                skipped += 1
                continue
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            with Image.open(src) as im:
                im = im.convert("RGB")
                h = round(im.height * WIDTH / im.width)
                im = im.resize((WIDTH, h), Image.LANCZOS)
                im.save(dst, "WEBP", quality=QUALITY, method=6)
            made += 1

total = sum(os.path.getsize(os.path.join(d, f)) for d, _, fs in os.walk(DST) for f in fs)
print(f"Web copies: {made} made, {skipped} already current, {WIDTH}px wide, q{QUALITY}; folder {total/1e6:.0f} MB")

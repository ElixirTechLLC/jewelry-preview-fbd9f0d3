#!/usr/bin/env python3
"""Builds js/catalog.js from the owners' design workbook.

    python3 scripts/import-catalog.py ~/Downloads/Jewelry_100_Designs_Pricing_Catalog.xlsx

Reads the "100 PRODUCTS" and "PRICE VARIANTS" sheets. The pricing model itself
(gold multiples, diamond benchmarks, shape factors) lives in js/pricing.js, so this
script only carries over what each design needs: reference 14K gold weight,
workshop labor, accent carats, the center-stone shape, and which options the
owners offer for it (gold purity, size or length, diamond selection, center carat).
Re-run it whenever the owners send a new workbook; edit js/catalog.js by hand for
small changes (names, descriptions, featured pieces).
"""
import json, re, sys
from collections import OrderedDict, defaultdict

try:
    import openpyxl
except ImportError:
    sys.exit("openpyxl is needed: python3 -m pip install openpyxl")

src = sys.argv[1] if len(sys.argv) > 1 else None
if not src:
    sys.exit(__doc__)

wb = openpyxl.load_workbook(src, data_only=True)
ws = wb["100 PRODUCTS"]
hdr = next(ws.iter_rows(min_row=1, max_row=1, values_only=True))
products = OrderedDict((r[0], dict(zip(hdr, r))) for r in ws.iter_rows(min_row=2, values_only=True) if r[0])

ws = wb["PRICE VARIANTS"]
vh = next(ws.iter_rows(min_row=1, max_row=1, values_only=True))
variants = [dict(zip(vh, r)) for r in ws.iter_rows(min_row=2, values_only=True) if r[0]]
per = defaultdict(lambda: {"opts": OrderedDict(), "labor": set(), "sizes": OrderedDict()})
for v in variants:
    d = per[v["Parent SKU"]]
    for n, val in [(v["Option1 Name"], v["Option1 Value"]), (v["Option2 Name"], v["Option2 Value"]), (v["Option3 Name"], v["Option3 Value"])]:
        if n:
            d["opts"].setdefault(n, [])
            if val not in d["opts"][n]:
                d["opts"][n].append(val)
    if (v["Center Diamond Carat"] or 1) == 1:
        d["labor"].add(v["Estimated Setting / Labor Cost USD"])
    if v["Length / Size"] and v["Length / Size"] not in d["sizes"]:
        d["sizes"][v["Length / Size"]] = round(float(v["Length / Size Weight Factor"]), 6)

CAT = {"Bracelets": ("bracelets", "bracelet"), "Chains": ("chains", "chain"), "Rings": ("rings", "ring"), "Wedding Bands": ("wedding", "band"), "Engagement Rings": ("engagement", "ring")}
STYLE_WORDS = ["solitaire", "halo", "three-stone", "bezel", "pave", "cathedral", "split", "twist", "bypass", "vintage", "east-west", "signet", "dome", "eternity", "channel", "milgrain", "hammered", "knife-edge", "brushed", "beveled", "braided", "groove", "chevron", "baguette", "scallop", "comfort", "cuban", "curb", "paperclip", "figaro", "mariner", "rope", "herringbone", "box", "wheat", "bead", "cuff", "tennis", "station", "bangle", "cable", "trace", "franco", "byzantine", "singapore", "snake", "omega", "ribbon", "wave", "step", "compass", "arc", "scatter", "bar", "ribbed"]
FEATURED = ["ER-001", "ER-004", "ER-011", "WB-012", "WB-001", "BR-005", "BR-016", "CH-004", "CH-007", "RG-003", "RG-011", "BR-011"]

def tags_for(p):
    title = p["Product Title"].lower().replace("pavé", "pave")
    t = []
    cls = p["Design Class"]
    t.append({"gold": "plain", "accent": "accent", "center": "center", "cuff": "cuff"}[cls])
    if cls in ("accent", "center"):
        t.append("diamond")
    if cls == "cuff":
        t.append("plain")
    shape = p["Center Stone Shape"]
    if shape and shape != "None":
        t.append(shape.lower())
    for w in STYLE_WORDS:
        if re.search(r"\b" + re.escape(w) + r"\b", title):
            t.append(w)
    if "hidden halo" in title or "double halo" in title:
        t.append("halo")
    return list(dict.fromkeys(t))

out = []
for sku, p in products.items():
    d = per[sku]
    assert len(d["labor"]) == 1, (sku, d["labor"])
    cat, typ = CAT[p["Category"]]
    opts = d["opts"]
    sizes = d["sizes"] or None
    size_label = None
    if sizes:
        size_label = "Length" if "in" in next(iter(sizes)) else "Size"
    diamonds = opts.get("Diamond Selection", [])
    carats = [int(c.split()[0]) for c in opts.get("Center Carat", [])] or None
    item = OrderedDict()
    item["id"] = p["Handle"]
    item["sku"] = sku
    item["name"] = p["Product Title"]
    item["cat"] = cat
    item["type"] = typ
    item["cls"] = p["Design Class"]
    item["tags"] = tags_for(p)
    if sku in FEATURED:
        item["featured"] = True
    item["shape"] = None if p["Center Stone Shape"] in (None, "None") else p["Center Stone Shape"]
    item["goldG"] = float(p["14K Gold Weight g (EST)"])
    item["widthMm"] = float(p["Width mm (ref)"])
    item["accentCtw"] = float(p["Accent Carat Total (ref)"] or 0)
    item["labor"] = float(next(iter(d["labor"])))
    item["ringSize"] = typ in ("ring", "band")
    item["sizes"] = {"label": size_label, "options": sizes} if sizes else None
    item["diamonds"] = diamonds
    item["carats"] = carats
    item["setting"] = p["Setting / Link Details"]
    item["clasp"] = None if p["Clasp / Fit"] in (None, "N/A") else p["Clasp / Fit"]
    item["finish"] = p["Finish Notes"]
    item["blurb"] = p["Short Description"]
    item["desc"] = p["Website Description"]
    item["brief"] = p["Design & Construction Brief"]
    item["prompt"] = p["Image / CAD Brief"]
    out.append(item)

header = """/* ------------------------------------------------------------------
   PRODUCT CATALOG: the owners' 100 designs.
   GENERATED by scripts/import-catalog.py from the owners' workbook
   (Jewelry_100_Designs_Pricing_Catalog.xlsx, dated 2026-11-18).
   Hand edits are fine for names, descriptions and "featured"; re-running the
   import overwrites this file.

   id        page address and image folder: assets/products/<id>/
   sku       the owners' parent SKU (ER-001 …); variant SKUs are built from it
   cat       engagement | wedding | rings | bracelets | chains
   type      ring | band | bracelet | chain       cls  gold | cuff | accent | center
   goldG     reference 14K gold weight in grams (10K and 18K are derived)
   labor     reference workshop labor in USD at the 1 ct / standard size
   accentCtw total carat weight of accent diamonds (0 = none)
   sizes     length or size options with the gold-weight factor each one applies
   diamonds  the diamond selections offered; carats: center-stone carat steps
   Every price on the site is computed from these fields by js/pricing.js,
   using the day's gold price. Nothing here is a price.
------------------------------------------------------------------- */
window.CATALOG = """
body = json.dumps(out, indent=2, ensure_ascii=False)
open("js/catalog.js", "w", encoding="utf-8").write(header + body + ";\n")
print(f"wrote js/catalog.js with {len(out)} designs")

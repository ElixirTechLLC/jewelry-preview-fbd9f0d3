# Jewelry website

Wolf's Fine Jewelry, Tappan NY: a made-to-order storefront. Plain HTML, CSS and JavaScript, no build step. Every price is computed in the browser from the owners' pricing model and the day's gold price.

## Preview

```bash
python3 -m http.server 4173
```

Then open http://localhost:4173.

## Where things live

| What | File |
| --- | --- |
| Brand name, phone, address, hours, **financing terms** | `js/config.js` |
| The 100 designs: reference gold weight, labor, diamonds, options, copy | `js/catalog.js` (generated, see below) |
| Pricing model: multiples, diamond benchmarks, shape factors, live quote | `js/pricing.js` |
| Today's gold price | `data/gold.js` (written daily by the gold-price workflow) |
| Header, mega menu, footer, shopping bag, search | `js/site.js` |
| Colors and layout | `css/styles.css` |
| Pages | `index.html`, `shop.html`, `product.html`, `financing.html`, `custom.html`, `visit.html`, `story.html`, `education.html` |
| Product photos | `assets/products/<product id>/1.webp`, `2.webp`, … (none yet for the 100 designs) |

## Design studio (Custom Design page)

Visitors sign up with an email, answer a few questions, get an AI picture of their piece (five per email), and submit the one they like. The page is in `js/design-studio.js`; the server side is a separate repo, https://github.com/ElixirTechLLC/jewelry-design-api, deployed on Vercel. Its README has the setup steps. Once it is deployed, put its address in `designApi` in `js/config.js`; until then the page shows a "coming soon" note in that spot.

## The look

One look, "Heritage", built page by page from the *Wolf's Fine Jewelry – Individual Pages* mockups (and the design blueprint's tokens): heritage-green bands with warm ivory shopping pages, brass hairlines, italic Cormorant headlines, tracked serif caps, full-bleed heroes, the dark consultation form, the 01–04 custom process and the diamond education cards. `js/theme.js` puts `data-theme="heritage"` and `data-page` on `<html>`; the colors and blocks are in `css/heritage.css`, the base layout in `css/styles.css`.

The home page is built around **stock photographs**: for now the slots use crops from the blueprint's concept mockups plus our own on-model product photos (see `js/stock-manifest.js`). Replace them with final AI photos when made: drop the files into `assets/stock/` and point the slot at them; an empty slot shows a labelled placeholder describing the shot. The tartan band is tiled from the showroom photo. Product photos keep their black backgrounds.

## Catalog and pricing

The catalog is the owners' **100-design workbook**, less the 15 designs they removed in their review of 2026-11-22 (listed as `REMOVED` in `scripts/import-catalog.py`, with the one rename), so 85 designs are live (`Jewelry_100_Designs_Pricing_Catalog.xlsx`, 2026-11-18): 20 each of engagement rings, wedding bands, rings, bracelets and chains. Nothing on the site is a stored price. For each design `js/catalog.js` carries the reference 14K gold weight, the workshop labor, accent diamond carats, the center-stone shape and the options the owners offer (10K / 14K / 18K; lengths or sizes; diamond selections; center carats 1–5). `js/pricing.js` turns a chosen configuration into a price with the workbook's own formulas:

- gold: estimated weight × today's gold price per gram × purity × sourcing allowance 1.15 × retail multiple 1.55
- labor: the design's workshop labor (+ $70 per carat over 1) × 1.65
- accent diamonds: carats × melee rate (lab $450, natural $2,100 per ctw) × 1.25
- center stone: the loose-diamond benchmark for that carat and origin × the quality tier (Natural Value 0.72, Select 1.0, Premium 1.6; Lab 1.0 / 1.25) × the shape factor × 1.12
- lab-grown engagement rings follow the owners' rule instead: $1,000 for the plain 14K solitaire setting + $400 per carat, plus the design's extra labor, gold and accents and the 10K/18K metal difference
- everything rounds **up** to the next $25

All of those numbers sit at the top of `js/pricing.js` under the same names as the workbook's PRICING INPUTS sheet; change one and every price on the site follows. The variant item numbers (for example `ER-001-18K-NS-2CT`) are the workbook's own, so a bag request can be matched to the owners' sheet line for line.

**Proof.** `node scripts/check-pricing.mjs <jewelry_variants_prices_REVIEW.csv>` re-prices every row of the owners' exported variants at the workbook's gold price ($3,738.20) and compares price, gold weight and SKU: 2,829 of 2,829 match.

**Re-importing.** When the owners send a new workbook: `python3 scripts/import-catalog.py <the .xlsx>` rewrites `js/catalog.js` (it needs `openpyxl`). Names, descriptions and the `featured` flags can also be edited by hand.

**Caveats the workbook itself states, still true here:** every price is a draft until the owners validate supplier quotes and margins; Lab Select and Lab Premium cost the same until `labPremiumExtraUsdPerCt` is set; ring sizes are not priced (US 7 reference); gold colors are a request, not a price; diamond grades are targets, not certificates. The pricing inputs are visible to anyone who reads the site's source, because the repo is public and prices are computed in the browser.

### Today's gold price

- `data/gold.js` holds the last fetched spot price. The GitHub Action `.github/workflows/gold-price.yml` runs `scripts/fetch-gold.mjs` every morning at 11:15 UTC (and on demand from the Actions tab), commits the new value, and Pages redeploys. Run it by hand with `node scripts/fetch-gold.mjs`.
- On top of that, each page asks the live feed (api.gold-api.com, free, no key) when it loads and re-prices cards, the product page and the bag the moment it answers. If the feed is unreachable the daily value stands.
- Every price on the site states its basis ("Gold at $3,705/oz, Nov 18, 2026"), and the bag's purchase request quotes it, so a jeweler can honor or requote.

## Product images

Each piece shows a gold line-art placeholder until it has a photo.

The 100 designs have no photographs yet; the owners' workbook gives a studio render brief for each (the `prompt` field in `js/catalog.js`, which currently asks for an off-white background; adjust `STYLE` in the script or the briefs before a shoot so the set matches).

1. `node scripts/generate-images.mjs --prompts` writes `image-prompts.md` — one ready-to-paste prompt per piece.
2. Generate each image in the tool of your choice (portrait, 4:5) and save it to the folder named in the prompt file, e.g. `assets/products/evermore-round-solitaire/1.webp`. PNG and JPG work too. Add `2`, `3`… for more angles.
3. `node scripts/generate-images.mjs --sync` so the site picks the new files up.

Or generate them automatically with an OpenAI key. The script picks the newest image model the key can use, skips pieces that already have a photo, and tests one image before doing the rest:

```bash
OPENAI_API_KEY=sk-... node scripts/generate-images.mjs
```

To redo particular pieces (edit their `prompt` in `js/catalog.js` first if the photo was wrong):

```bash
OPENAI_API_KEY=sk-... node scripts/generate-images.mjs --only evermore-round-solitaire,micro-cuban-chain --force
```

Photos are used on the site exactly as generated — do not re-compress them. These images are mostly smooth near-black gradients, and re-saving them at ordinary WebP/JPEG settings leaves visible square blotches around the reflections.

## Review copy on GitHub Pages

The repo is https://github.com/ElixirTechLLC/jewelry-preview-fbd9f0d3 and the site is served from the `main` branch at
https://elixirtechllc.github.io/jewelry-preview-fbd9f0d3/ (same setup as the Exodus Capital review copy).

It is unlisted, not locked: the address ends in a random code and every page carries a `noindex` tag, but anyone with the link can open it and the repo is public. To take the link down, set the repo back to private.

To update it after an edit:

```bash
git add -A && git commit -m "Update site" && git push
```

GitHub rebuilds the site a minute or two after each push.

## Publishing a change

GitHub Pages and browsers cache files for ten minutes. Before committing a change to `css/` or `js/`, run `node scripts/stamp-assets.mjs`: it adds a fresh `?v=` stamp to every stylesheet and script link in the HTML pages so a plain reload fetches the new files.

## Before go-live

- [ ] Remove the `<meta name="robots" content="noindex, nofollow">` line from all six pages so search engines can find the live site

- [ ] Real phone, email and hours in `js/config.js` (name and address are in)
- [ ] Real financing provider and terms in `js/config.js`, then set `financing.isPlaceholder` to `false` (removes every "placeholder" notice) and complete the bracketed `[…]` text in `financing.html`
- [ ] Owners approve the pricing model: supplier quotes against the diamond benchmarks, the multiples in `js/pricing.js`, whether Lab Premium carries a surcharge, and whether five-carat fashion rings should be offered online at all
- [ ] Replace the estimated gold weights in `js/catalog.js` with CAD or finished weights as designs are produced
- [ ] Product images for every piece (see above)
- [ ] Online checkout — the bag currently sends a "Request to Purchase" email; connect a payment provider when ready

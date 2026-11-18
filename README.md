# Jewelry website

Black-and-gold storefront for the shop. Plain HTML, CSS and JavaScript — no build step.

## Preview

```bash
python3 -m http.server 4173
```

Then open http://localhost:4173.

## Where things live

| What | File |
| --- | --- |
| Brand name, phone, address, hours, **financing terms** | `js/config.js` |
| Every product: price, gold weight, diamond weight, specs, image prompt | `js/catalog.js` |
| Header, mega menu, footer, shopping bag, search | `js/site.js` |
| Colors and layout | `css/styles.css` |
| Pages | `index.html`, `shop.html`, `product.html`, `financing.html`, `custom.html`, `visit.html` |
| Product photos | `assets/products/<product id>/1.webp`, `2.webp`, … |

## Design studio (Custom Design page)

Visitors sign up with an email, answer a few questions, get an AI picture of their piece (five per email), and submit the one they like. The page is in `js/design-studio.js`; the server side is a separate repo, https://github.com/ElixirTechLLC/jewelry-design-api, deployed on Vercel. Its README has the setup steps. Once it is deployed, put its address in `designApi` in `js/config.js`; until then the page shows a "coming soon" note in that spot.

## Looks

The site has four looks, switched with a footer link or a `?theme=` address, and remembered per visitor:

| Look | Address | Modelled on |
| --- | --- | --- |
| Hunter green (default) | `?theme=green` | The panelled showroom: green, brass, cream, serif type |
| Ivory | `?theme=ivory` | The same, on ivory walls |
| Maison | `?theme=maison` | Piaget: white, navy light serif, full-width editorial photos |
| Avenue | `?theme=avenue` | David Yurman, Blue Nile, Gabriel & Co: white, bold caps, model-led hero, perks strip |

Maison and Avenue have their own home page sections built around **stock photographs** that do not exist yet. Each slot shows a labelled placeholder describing the shot; drop AI-made photos into `assets/stock/` and list them in `js/stock-manifest.js`. The green and ivory looks share the panelled-room home page. Product photos keep their black backgrounds in every look.

- The footer has a "Look" switch. It is there for review; remove it from `js/site.js` once a look is chosen.
- `DEFAULT_THEME` at the top of `js/theme.js` sets which look a first-time visitor gets (`"dark"` or `"light"`).
- Green and ivory colors are in `css/styles.css`; Maison and Avenue are in `css/looks.css`.

## Product images

Each piece shows a gold line-art placeholder until it has a photo.

1. `node scripts/generate-images.mjs --prompts` writes `image-prompts.md` — one ready-to-paste prompt per piece, written to match the black-background studio style of the Sovereign ring photos.
2. Generate each image in the tool of your choice (portrait, 4:5) and save it to the folder named in the prompt file, e.g. `assets/products/eng-round-solitaire/1.webp`. PNG and JPG work too. Add `2`, `3`… for more angles.
3. `node scripts/generate-images.mjs --sync` so the site picks the new files up.

Or generate them automatically with an OpenAI key. The script picks the newest image model the key can use, skips pieces that already have a photo, and tests one image before doing the rest:

```bash
OPENAI_API_KEY=sk-... node scripts/generate-images.mjs
```

To redo particular pieces (edit their `prompt` in `js/catalog.js` first if the photo was wrong):

```bash
OPENAI_API_KEY=sk-... node scripts/generate-images.mjs --only eng-round-solitaire,men-rope-chain --force
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

## Before go-live

- [ ] Remove the `<meta name="robots" content="noindex, nofollow">` line from all six pages so search engines can find the live site

- [ ] Real phone, email and hours in `js/config.js` (name and address are in)
- [ ] Real financing provider and terms in `js/config.js`, then set `financing.isPlaceholder` to `false` (removes every "placeholder" notice) and complete the bracketed `[…]` text in `financing.html`
- [ ] Replace the sample prices, gold weights, diamond weights and stone counts in `js/catalog.js` with the real figures for each piece
- [ ] Product images for every piece (see above)
- [ ] Online checkout — the bag currently sends a "Request to Purchase" email; connect a payment provider when ready

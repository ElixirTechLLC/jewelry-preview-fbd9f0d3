#!/usr/bin/env node
/* ------------------------------------------------------------------
   Product image tooling.  No dependencies — needs Node 18+.

   node scripts/generate-images.mjs --sync
       Rescan assets/products/ and rebuild js/image-manifest.js.
       Run this any time you add, remove or rename image files.

   node scripts/generate-images.mjs --prompts
       Write image-prompts.md — the full prompt for every piece, built
       from the owners' design brief in js/catalog.js, ready to paste
       into whichever image generator you prefer. Save each result as
       assets/products/<id>/1.webp (or .png / .jpg), then run --sync.

   node scripts/generate-images.mjs --review
       Build reference/review.html: every generated photo beside the
       owners' source pick and the catalog spec, for approving or flagging
       photos before they go live. Redo a flagged one with
       --only <id> --photo <n> --force.

   OPENAI_API_KEY=sk-... node scripts/generate-images.mjs
       Generate every photo that is missing. Photo 1 of a piece (yellow
       gold) is made FROM the owners' chosen source photos in
       reference/sources/<SKU>/ (owners' pick first, then the rest of that
       listing's gallery), or from the text prompt when there are none;
       photos 2–5 (other angles, a close-up and an on-model shot) are made
       FROM photo 1, so they show the same piece. Then every yellow photo
       is recoloured into white and rose gold (same photo, only the metal
       changes) under assets/products/<id>/white/ and /rose/, so the gold
       colour swatches on the product page swap the real image.
       Options:  --views 5            photos per piece (default 1, max 5)
                 --colors white,rose  gold colours to derive (default both; "none" skips)
                 --refs 6             source photos sent as the reference for photo 1 (0 = text only)
                 --backdrop cream     cream/ivory (warm ivory stone, the guide's catalog backdrop), velvet (forest green
                                      velvet, the guide's editorial backdrop), marble (dark green marble) or black (mirror, default)
                 --secondary velvet   shoot some photo numbers on a second backdrop ...
                 --secondary-photos 2 ... these ones (default 2 when --secondary is given); the guide wants ivory
                                      primary shots with velvet secondary shots
                 --restage 3=velvet   photo 3 is photo 1 again (same angle, same piece) restaged on that backdrop,
                                      instead of the usual third view
                 --only <id>[,<id>]   just these pieces
                 --except <id>[,<id>] every piece but these
                 --photo 5            only this photo number (e.g. with --force to redo one)
                 --force              regenerate even if the photo exists
                 --dry-run            list what would be generated, without a key or any cost
                 --note "..."         a one-off correction added to every prompt of this run (per-piece
                                      corrections that should stick live in PIECE_NOTES inside this file)
                 --parallel 3         images generated at once
                 --size 1600x2000     pixel size (default 1024x1536)
       Env:      IMAGE_MODEL    force a model (default: newest image
                                model the key can use)
                 IMAGE_QUALITY  low | medium | high (default high)
------------------------------------------------------------------- */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PRODUCTS_DIR = path.join(ROOT, "assets", "products");
const SOURCES = path.join(ROOT, "reference", "sources.json"); // owners' picks and their listings' galleries (scripts/source-galleries.mjs)
const SOURCES_DIR = path.join(ROOT, "reference", "sources");
const TMP = path.join(os.tmpdir(), "jw-image-refs");
const COLORS = {
  white: "14K white gold: bright, cool, rhodium-white metal with silvery mirror highlights and neutral grey shadows, no yellow or warm tint anywhere in the metal",
  rose: "14K rose gold: warm pinkish-copper metal with soft rose highlights, clearly pink rather than yellow",
};
const MANIFEST = path.join(ROOT, "js", "image-manifest.js");
const SMALL_DIR = path.join(ROOT, "assets", "products-sm"); // web-size copies (scripts/make-web-copies.py)
const IMAGE_EXT = /\.(webp|png|jpe?g|avif)$/i;
const API = "https://api.openai.com/v1";
const MAX_VIEWS = 5;

const STYLES = {
  black: {
    still:
      "Resting on a glossy black mirror surface with a soft reflection beneath it, pure black background, " +
      "dramatic studio lighting with warm golden highlights, razor-sharp macro focus, brilliant sparkling white diamonds, " +
      "photorealistic high-end catalog photograph, the piece centered with generous dark space around it, portrait orientation. " +
      "No text, no lettering, no logos, no watermark, no hands, no people.",
    worn:
      "Dark, moody luxury editorial photograph: black clothing, near-black background, warm golden highlights on the jewelry, " +
      "razor-sharp focus on the piece with shallow depth of field, natural realistic skin, photorealistic, portrait orientation. " +
      "The face is not shown. No text, no lettering, no logos, no watermark.",
  },
  /* The brand guide's catalog backdrop: warm ivory limestone, soft diffused daylight, minimal composition. */
  cream: {
    still:
      "Resting on a warm ivory limestone surface (colour close to #F0E4D0) with a very subtle natural stone texture and a gentle soft natural shadow beneath it, " +
      "seamless warm ivory background with no props, soft diffused daylight, minimal composition, exceptional photographic detail with razor-sharp focus on the piece, " +
      "realistic diamond sparkle without exaggerated glows, the gold warm rather than bright yellow, understated old-money heritage jewelry house aesthetic, " +
      "medium-format catalog photograph, the piece centered with generous negative space around it, portrait orientation. " +
      "No text, no lettering, no logos, no watermark, no hands, no people.",
    worn:
      "Bright, elegant luxury editorial photograph with an understated old-money aesthetic: ivory or cream clothing, warm neutral background, soft diffused daylight, " +
      "razor-sharp focus on the piece with shallow depth of field, natural realistic skin, photorealistic, portrait orientation. " +
      "The face is not shown. No text, no lettering, no logos, no watermark.",
  },
  /* The brand guide's signature editorial backdrop, for secondary shots (--secondary velvet --secondary-photos 2). */
  velvet: {
    still:
      "Resting on rich forest green velvet (deep heritage green, close to #20291D) with natural soft folds, soft warm directional champagne lighting, deep shadows and delicate " +
      "diamond reflections, shallow depth of field, elegant negative space, cinematic yet restrained, understated old-money heritage jewelry house aesthetic, " +
      "realistic sparkle without exaggerated glows, the gold warm rather than bright yellow, photorealistic medium-format editorial photograph, portrait orientation. " +
      "No text, no lettering, no logos, no watermark, no hands, no people.",
    worn:
      "Dark, intimate luxury editorial photograph with an understated old-money aesthetic: deep forest green or black clothing, soft warm directional lighting, " +
      "razor-sharp focus on the piece with shallow depth of field, natural realistic skin, photorealistic, portrait orientation. " +
      "The face is not shown. No text, no lettering, no logos, no watermark.",
  },
  /* The brand guide's fine-jewelry backdrop for bracelets, chains and men's pieces. */
  marble: {
    still:
      "Resting on polished dark green marble with subtle natural veining and restrained reflections, a hint of antique brass detailing at the edge of the frame, " +
      "soft warm directional lighting, elegant negative space, understated old-money heritage jewelry house aesthetic, realistic sparkle without exaggerated glows, " +
      "the gold warm rather than bright yellow, photorealistic medium-format editorial photograph, portrait orientation. " +
      "No text, no lettering, no logos, no watermark, no hands, no people.",
    worn:
      "Dark, intimate luxury editorial photograph with an understated old-money aesthetic: deep forest green or black clothing, soft warm directional lighting, " +
      "razor-sharp focus on the piece with shallow depth of field, natural realistic skin, photorealistic, portrait orientation. " +
      "The face is not shown. No text, no lettering, no logos, no watermark.",
  },
};
STYLES.ivory = STYLES.cream;
let BACKDROP = STYLES[process.env.IMAGE_BACKDROP] ? process.env.IMAGE_BACKDROP : "black";
/* Some photo numbers can be shot on a second backdrop (the guide: ivory primary shots, velvet secondary shots). */
const SECONDARY = { backdrop: null, photos: new Set() };
const backdropFor = (n) => (SECONDARY.backdrop && SECONDARY.photos.has(n) ? SECONDARY.backdrop : BACKDROP);
const STYLE = (n = 1) => STYLES[backdropFor(n)].still;
const WORN_STYLE = (n = 1) => STYLES[backdropFor(n)].worn;

/* --restage N=backdrop: photo N is the master re-shot on another backdrop, same angle and framing. */
const RESTAGE = {}; // photo number -> backdrop name
function restagePrompt(p, n) {
  return (
    "The attached image is a product photograph of one piece of jewelry. Create the identical photograph of the identical piece: " +
    "the same camera angle, the same framing, scale and position in the frame, the same metal and stones. Change only the surface it rests on, " +
    `the background and the lighting mood, to this: ${STYLES[RESTAGE[n]].still} ${PRESERVE}`
  );
}

/* The brand guide's product-accuracy instruction, verbatim, on every edit of a real piece. */
const PRESERVE =
  "Preserve the exact jewelry design, gemstone shape, setting, prongs, metal color, proportions, and number of stones. " +
  "Change only the background, lighting, and surrounding environment. Do not redesign or alter the jewelry.";

/* Photos 2–5 for each kind of piece. The last one is always the on-model shot. */
const VIEWS = {
  ring: [
    "standing upright on the bottom of its band and photographed exactly from the side, at the level of the band, so that the band appears as one complete round circle facing the camera with the setting at the top of the circle. Because the camera looks at the ring from its side, the center stone is seen in profile, edge-on: its flat table on top, the sloping crown, the girdle, and the pointed pavilion going down between the prongs. From this angle the face-up outline of the stone cannot be seen at all: no heart, oval, round or square outline, only the stone's side silhouette, which is a low, wide shape, like a gem drawn in cross-section. The ring is one solid piece and the setting is not turned toward the camera",
    "standing upright on the surface on the bottom of its band with the stone at the top, turned about 60 degrees away from the camera and photographed from slightly below the level of the stone, so that the whole ring is visible at once: the band appears as a wide oval loop and the side of the setting, the prongs and the gallery under the stone are shown in profile. The ring is one solid piece; the band is a complete round loop that stays attached to the setting. It is not seen edge-on as a flat strip, not lying flat on the surface, and the setting is not tilted or turned on the band",
    "in an extreme macro close-up of the stones and the setting",
    (who) => `being worn properly on the ring finger of a ${who} hand that rests flat and relaxed on black fabric, fingers extended straight and slightly apart, photographed from directly above. The band wraps completely around the base of the ring finger, below the knuckle, crossing the finger at a right angle, so any shoulders, side stones or pavé on the band run around the finger, to the left and right of the center. The top of the ring sits flat and centered on the back of the finger. If the stone is elongated (oval, pear, marquise, emerald or radiant cut), its long axis runs along the length of the finger, pointing toward the fingertip. The ring is true to life size, so it is no wider than the finger. It is on no other finger, not turned, not tilted, and not held`,
  ],
  necklace: [
    "laid flat and viewed from directly above",
    "in an extreme macro close-up of the stones, links and clasp",
    "fastened closed around the neck of a black velvet jewelry display bust and hanging naturally from the neck at its true length, with the clasp at the back of the neck. It hangs down the chest of the bust the way a worn necklace does; it is not lying flat on the chest as a loop",
    (who) => `being worn properly by a ${who.replace("'s", "")}: fastened around the neck and lying flat against the skin of the chest, at true life size, not held in the hand. Black clothing with an open neckline, cropped from the chin to the chest`,
  ],
  earrings: [
    "as a single earring viewed from the side, showing the post and backing",
    "in an extreme macro close-up of one earring",
    "as the pair lying on the surface, viewed from directly above",
    (who) => `being worn properly on a ${who} ear: the post goes through the earlobe and the earring sits against or hangs from the lobe at true life size, not held in the fingers. Tight close-up of one ear and the jawline with the hair pulled back`,
  ],
  bracelet: [
    "laid flat in a straight line and viewed from directly above",
    "in an extreme macro close-up of the links, stones and clasp",
    "standing upright as a closed loop, three-quarter view",
    (who) => `being worn properly on a ${who} wrist: fastened closed and wrapped all the way around the wrist at true life size, not held or draped over the fingers. The hand is relaxed, with a black sleeve, tight close-up on the wrist`,
  ],
  watch: [
    "from a three-quarter angle, showing the side of the case and the crown",
    "in an extreme macro close-up of the dial and bezel",
    "lying on its side, showing the case profile and the bracelet or strap",
    (who) => `being worn properly on a ${who} wrist: strapped closed around the wrist with the dial facing up, at true life size, not held in the hand. The cuff of a black suit sleeve is just behind it, tight close-up on the wrist`,
  ],
};
VIEWS.band = VIEWS.ring;
VIEWS.pendant = VIEWS.necklace;
VIEWS.chain = VIEWS.necklace;

function loadCatalog() {
  const src = fs.readFileSync(path.join(ROOT, "js", "catalog.js"), "utf8");
  const window = {};
  new Function("window", src)(window);
  return window.CATALOG;
}

/* Per-piece corrections from the owners' and the user's photo review (2026-11-23). `center` replaces the centre-stone
   sentence; `note` is appended to every prompt for that piece. These survive any regeneration. */
const PIECE_NOTES = {
  "luna-east-west-emerald-ring": {
    center: "with a natural green emerald centre stone, emerald cut, about 1 carat, set horizontally (east-west) in a low full bezel, and a few small round white diamonds on each shoulder of the band",
    note: "The centre stone is a GREEN emerald, never a white diamond. Small white diamonds sit on the shoulders, as in the owners' reference.",
  },
  "arcadia-open-cuff": { note: "Both ends of the cuff are identical: the same rounded end-cap shape and size, exact mirror images of each other." },
  "lattice-pave-link-bracelet": { note: "The links alternate strictly: one polished plain oval link, then one rectangular link fully set with small white diamonds, repeating around the bracelet, with a lobster clasp. All links are high-polish, none brushed." },
  "regent-curb-chain": { note: "The curb links are slightly more open and individually visible, as in the owners' reference, not tightly packed." },
  "micro-cuban-chain": { note: "The link design is right; present the chain in a compact loop that fills the frame comfortably rather than a long loose one." },
  "nova-bezel-chain": { note: "No pendant at all. Seven small round white diamonds, each in a round gold bezel, spaced evenly along a fine cable chain." },
  "mosaic-pave-segment-chain": { note: "The polished chain sections are a round twisted rope chain like the owners' reference, not curb links; three slim bars fully set with small white diamonds sit between them." },
  "nova-pave-dome-ring": { note: "Every pavé diamond is colourless white; none are brown, champagne or coloured." },
  "open-horizon-ring": { note: "One single band, open at the front, the two ends finishing in smooth rounded polished gold tips; no beads, no second band, no stones." },
};
let RUN_NOTE = ""; // --note "..." adds a one-off correction to every prompt of this run

/* What the piece is, in words, built from the owners' design brief (js/catalog.js). */
function describe(p) {
  const kind = { ring: "ring", band: "wedding band", bracelet: p.cls === "cuff" ? "cuff bracelet" : "bracelet", chain: "chain necklace" }[p.type] || p.type;
  const detail = (p.brief || p.setting || "").replace(/\.$/, "");
  const parts = [`a ${kind} in polished 14K yellow gold (warm gold, not brassy bright yellow)`, detail];
  const fix = PIECE_NOTES[p.id] || {};
  if (fix.center) parts.push(fix.center);
  else if (p.carats) parts.push(`with a single ${p.shape.toLowerCase()}-cut ${p.carats[0]} carat white diamond center stone${p.accentCtw ? ` and about ${p.accentCtw.toFixed(2)} ct of small round accent diamonds` : " and no other stones at all: the band, shoulders, gallery and under-setting are plain polished gold with no pavé, no hidden halo and no accent diamonds"}`);
  else if (p.accentCtw) parts.push(`set with about ${p.accentCtw.toFixed(2)} ct of small round white diamonds`);
  else parts.push(p.type === "chain" || p.type === "bracelet" ? "no gemstones and no pendant, charm, bead or other attachment: the chain alone with its clasp" : "no gemstones");
  if (p.widthMm) parts.push(`about ${p.widthMm} mm wide`);
  if (p.type === "chain") parts.push("20 inches long, laid in a loose loop");
  if (p.type === "bracelet" && p.cls !== "cuff") parts.push("7.5 inches long, laid in a loose loop with the clasp visible");
  const text = parts.filter(Boolean).join(", ");
  const extra = [fix.note, RUN_NOTE].filter(Boolean).join(" ");
  return extra ? `${text}. ${extra}` : text;
}

/* Prompt for photo 1 (text only). */
function fullPrompt(p) {
  return `Luxury fine jewelry product photograph of ${describe(p)}. ${STYLE(1)}`;
}

/* Prompt for photo 1 when the owners' source photos are attached. */
function refPrompt(p, count) {
  return (
    `The ${count === 1 ? "attached photograph shows" : `${count} attached photographs show`} one piece of jewelry from a shop listing` +
    `${count > 1 ? "; the first is the primary reference and the others show the same piece from other angles" : ""}. ` +
    `Create a new luxury fine jewelry product photograph of this exact design: the same silhouette, setting, prongs, band profile, links, ` +
    `stone shapes, stone count and proportions as in the reference, rendered as ${describe(p)}. ` +
    `Reproduce the design faithfully; do not simplify, embellish or restyle it, and do not copy the reference's background, props, text or watermark. ` +
    `Where the reference differs from the description above in the number or placement of stones, in the metal colour, or by showing a pendant, charm or second piece, follow the description. All diamonds are colourless white unless the description says otherwise, even if the reference shows brown, yellow or coloured stones; otherwise ${PRESERVE.charAt(0).toLowerCase() + PRESERVE.slice(1)} ${STYLE(1)}`
  );
}

/* Prompt for a white or rose gold version of an existing yellow gold photo. */
function colorPrompt(p, color) {
  return (
    "The attached image is a product photograph of one piece of jewelry in yellow gold. Create the identical photograph " +
    "— the same piece, same angle, same framing, same lighting, same background and reflections, same stones — " +
    `with one change only: every part of the metal is now ${COLORS[color]}. ` +
    "The diamonds and gemstones keep their exact colour, cut and sparkle. Do not move, resize, redesign or re-light anything. " +
    "Preserve the exact jewelry design, gemstone shape, setting, prongs, proportions, and number of stones."
  );
}

/* The owners' chosen source photos for a piece, as upload-ready files: owners' pick first, then its listing's gallery, then any second listing. */
let sourcesIndex = null;
function referenceImages(p, max) {
  if (!max) return [];
  if (sourcesIndex === null) sourcesIndex = fs.existsSync(SOURCES) ? JSON.parse(fs.readFileSync(SOURCES, "utf8")) : {};
  const e = sourcesIndex[p.sku];
  if (!e || !e.images || !e.images.length) return [];
  const ordered = [...e.images.filter((i) => i.pick), ...e.images.filter((i) => !i.pick && !i.alt), ...e.images.filter((i) => !i.pick && i.alt)];
  const refs = [];
  for (const i of ordered) {
    if (refs.length >= max) break;
    let file = path.join(SOURCES_DIR, p.sku, i.file);
    if (!fs.existsSync(file)) continue;
    let ext = i.file.split(".").pop().toLowerCase();
    if (!["png", "jpg", "jpeg", "webp"].includes(ext)) {
      // OpenAI accepts png, jpeg and webp only; macOS sips converts avif and the rest.
      fs.mkdirSync(TMP, { recursive: true });
      const out = path.join(TMP, `${p.sku}-${i.file}.png`);
      try {
        if (!fs.existsSync(out)) execFileSync("sips", ["-s", "format", "png", file, "--out", out], { stdio: "ignore" });
        file = out; ext = "png";
      } catch (err) { continue; }
    }
    const buf = fs.readFileSync(file);
    if (buf.length < 6000 || buf.length > 20e6) continue;
    refs.push({ buf, mime: MIME[ext] || "image/png", name: `${refs.length + 1}.${ext}`, source: `reference/sources/${p.sku}/${i.file}`, pick: !!i.pick });
  }
  return refs;
}

/* Prompt for photos 2–5, sent together with photo 1 as the reference. */
function viewPrompt(p, view) {
  // A piece can override one view in the catalog: viewNotes: { 2: "…" } (keyed by photo number).
  const v = (p.viewNotes && p.viewNotes[view + 1]) || (VIEWS[p.type] || VIEWS.ring)[view - 1];
  const who = p.type === "chain" || p.tags.some((t) => ["signet", "cuban", "franco"].includes(t)) ? "man's" : "woman's";
  const worn = typeof v === "function";
  const what = worn ? v(who) : v;
  return (
    "The attached image is a product photograph of one piece of jewelry. Create a new photograph of this exact same piece — " +
    "the identical design, the identical metal and metal color, and the identical stones in the same number, shapes, sizes and arrangement — " +
    `now shown ${what}. Do not redesign, simplify or embellish the piece. ${PRESERVE.replace("Change only the background, lighting, and surrounding environment. ", "")} ${worn ? WORN_STYLE(view + 1) : STYLE(view + 1)}`
  );
}

function existingImages(id, color) {
  const dir = color && color !== "yellow" ? path.join(PRODUCTS_DIR, id, color) : path.join(PRODUCTS_DIR, id);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => IMAGE_EXT.test(f))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}
const photoFile = (id, n, color) => existingImages(id, color).find((f) => f.startsWith(`${n}.`));

function sync() {
  const catalog = loadCatalog();
  const manifest = {};
  let withImages = 0, photos = 0;
  for (const p of catalog) {
    const files = existingImages(p.id);
    if (files.length) {
      const set = { Yellow: files.map((f) => `assets/products/${p.id}/${f}`) };
      for (const c of Object.keys(COLORS)) {
        const cf = existingImages(p.id, c);
        if (cf.length) set[c[0].toUpperCase() + c.slice(1)] = cf.map((f) => `assets/products/${p.id}/${c}/${f}`);
        photos += cf.length;
      }
      manifest[p.id] = set;
      withImages++;
      photos += files.length;
    }
  }
  // web-size copies that exist, so the site can use them for cards and thumbnails
  const small = [];
  for (const set of Object.values(manifest)) for (const files of Object.values(set)) for (const src of files) {
    const rel = src.replace(/^assets\/products\//, "").replace(/\.[a-z]+$/i, ".webp");
    if (fs.existsSync(path.join(SMALL_DIR, rel))) small.push(`assets/products-sm/${rel}`);
  }
  const body =
    "/* AUTO-GENERATED by scripts/generate-images.mjs --sync. Do not edit by hand.\n" +
    "   Photos by piece id and gold colour: { Yellow: [...], White: [...], Rose: [...] } (yellow is photo 1..5 in the\n" +
    "   piece's folder; white and rose are the same photos recoloured, in white/ and rose/ sub-folders). */\n" +
    `window.IMAGES = ${JSON.stringify(manifest, null, 2)};\n` +
    `/* Web-size copies (800px) for cards and thumbnails; the originals above stay for the product page. */\n` +
    `window.IMAGES_SMALL = ${JSON.stringify(small)};\n`;
  fs.writeFileSync(MANIFEST, body);
  console.log(`Manifest updated: ${withImages} of ${catalog.length} pieces have images (${photos} photos in all${small.length ? `, ${small.length} with web-size copies` : ""}).`);
  const missing = catalog.filter((p) => !manifest[p.id]).map((p) => p.id);
  if (missing.length) console.log(`Still missing (${missing.length}): ${missing.join(", ")}`);
}

function writePrompts() {
  const catalog = loadCatalog();
  const lines = [
    "# Image prompts",
    "",
    "One prompt per piece. Generate in portrait (4:5 works best), save the result as",
    "`assets/products/<id>/1.webp` (png and jpg also work; add `2`, `3`… for more angles),",
    "then run `node scripts/generate-images.mjs --sync`.",
    "",
  ];
  for (const p of catalog) {
    lines.push(`## ${p.name}`, "", `Folder: \`assets/products/${p.id}/\``, "", "```", fullPrompt(p), "```", "");
  }
  const out = path.join(ROOT, "image-prompts.md");
  fs.writeFileSync(out, lines.join("\n"));
  console.log(`Wrote ${out} (${catalog.length} prompts).`);
}

/* Review sheet: generated photos next to the owners' pick and the spec. */
function writeReview() {
  const catalog = loadCatalog();
  if (sourcesIndex === null) sourcesIndex = fs.existsSync(SOURCES) ? JSON.parse(fs.readFileSync(SOURCES, "utf8")) : {};
  const esc = (t) => String(t == null ? "" : t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const cards = [];
  let pieces = 0, photos = 0;
  for (const p of catalog) {
    const yellow = existingImages(p.id);
    if (!yellow.length) continue;
    pieces++;
    const src = sourcesIndex[p.sku];
    const pick = src && src.images.find((i) => i.pick);
    const rows = [["Yellow", null, yellow], ...Object.keys(COLORS).map((c) => [c[0].toUpperCase() + c.slice(1), c, existingImages(p.id, c)])]
      .filter(([, , files]) => files.length)
      .map(([label, c, files]) => {
        photos += files.length;
        const cells = files.map((f) => `<a href="../assets/products/${p.id}/${c ? c + "/" : ""}${f}" target="_blank"><img src="../assets/products/${p.id}/${c ? c + "/" : ""}${f}" loading="lazy" alt=""><span>${esc(f.split(".")[0])}</span></a>`).join("");
        return `<div class="row"><b>${label}</b>${cells}</div>`;
      }).join("");
    const pickHtml = pick
      ? `<a href="../reference/sources/${p.sku}/${pick.file}" target="_blank" class="pick"><img src="../reference/sources/${p.sku}/${pick.file}" loading="lazy" alt=""><span>owners' pick</span></a>`
      : `<div class="pick none">no owners' pick</div>`;
    cards.push(`<article id="${p.id}"><header><span class="sku">${p.sku}</span><h3>${esc(p.name)}</h3><p class="spec">${esc(describe(p))}</p>${src && src.note ? `<p class="note">Owners: “${esc(src.note)}”</p>` : ""}</header><div class="body">${pickHtml}<div class="rows">${rows}</div></div></article>`);
  }
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Photo review</title>
<style>
body{margin:0;padding:24px;background:#f0e4d0;color:#20291d;font:15px/1.45 Georgia,serif}
h1{font-weight:normal;margin:0 0 4px}.lead{color:#5a5f4f;margin:0 0 22px}
article{background:#f6eedd;border:1px solid #d9ccb3;border-radius:6px;padding:16px 18px;margin:0 0 18px}
header h3{margin:0;font-weight:normal;font-size:22px}.sku{font:12px/1 Helvetica,Arial,sans-serif;letter-spacing:.14em;color:#8a8572}
.spec{margin:6px 0 0;color:#5a5f4f}.note{margin:6px 0 0;font-style:italic;color:#7e5e2a}
.body{display:grid;grid-template-columns:150px 1fr;gap:18px;margin-top:14px;align-items:start}
.pick{display:block;position:relative;border:2px solid #b08a50}.pick img{width:100%;display:block;aspect-ratio:1;object-fit:cover}
.pick.none{aspect-ratio:1;display:flex;align-items:center;justify-content:center;color:#8a8572;font-size:13px;text-align:center;padding:8px}
.pick span,.row a span{position:absolute;left:0;bottom:0;font:11px/1 Helvetica,Arial,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#f0e4d0;background:rgba(32,41,29,.8);padding:4px 6px}
.row{display:grid;grid-template-columns:60px repeat(auto-fill,150px);gap:10px;align-items:center;margin-bottom:10px}
.row b{font-weight:normal;color:#5a5f4f;font-size:13px}.row a{position:relative;display:block;border:1px solid #d9ccb3;background:#fff}.row a img{width:100%;display:block;aspect-ratio:2/3;object-fit:cover}
@media(max-width:700px){.body{grid-template-columns:1fr}}
</style></head><body>
<h1>Photo review</h1><p class="lead">${pieces} pieces, ${photos} photos. Each photo sits beside the owners' chosen source photo and the catalog spec it must match. To redo one: <code>node scripts/generate-images.mjs --only &lt;id&gt; --photo &lt;n&gt; --force</code> (add <code>--backdrop</code> / <code>--secondary</code> as used for the batch).</p>
${cards.join("\n")}
</body></html>`;
  const out = path.join(ROOT, "reference", "review.html");
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, html);
  console.log(`Wrote ${out}: ${pieces} pieces, ${photos} photos.`);
}

/* ---------------- OpenAI calls ---------------- */

/* Tidy a pasted key: drop stray whitespace / terminal paste codes, and undo an accidental double paste. */
function cleanKey(raw) {
  let k = String(raw || "")
    .replace(/\x1b\[[0-9;]*[~A-Za-z]/g, "")
    .replace(/[^\x21-\x7e]/g, "");
  for (let n = 4; n >= 2; n--) {
    if (k.length % n === 0 && k.slice(0, k.length / n).repeat(n) === k) {
      console.log(`Note: the key was pasted ${n} times in a row — using one copy.`);
      k = k.slice(0, k.length / n);
      break;
    }
  }
  return k;
}

const short = (err) => String(err.message).replace(/\s+/g, " ").replace(/\*{6,}/g, "…").slice(0, 300);
const isOutOfCredit = (err) => /insufficient_quota|billing|exceeded your current quota|hard limit/i.test(err.message);
const isAccess = (err) => err.status === 401 || err.status === 403;

/* Newest full-size image model first; lighter variants and dated snapshots after it. */
function rankModels(ids) {
  const ver = (id) => parseFloat(id.match(/^gpt-image-(\d+(?:\.\d+)?)/)[1]);
  const light = (id) => (/mini|nano|flare|fast|lite/.test(id) ? 1 : 0);
  const dated = (id) => (/\d{4}-\d{2}-\d{2}$/.test(id) ? 1 : 0);
  const gpt = ids
    .filter((id) => /^gpt-image-\d/.test(id))
    .sort((a, b) => ver(b) - ver(a) || light(a) - light(b) || dated(a) - dated(b) || a.length - b.length);
  const list = [process.env.IMAGE_MODEL, ...gpt, ...ids.filter((id) => id === "chatgpt-image-latest")].filter(Boolean);
  if (!list.length) list.push("gpt-image-2");
  return [...new Set(list)];
}

/* Request options, from preferred to bare minimum, in case a model rejects one of them. */
let SIZE = process.env.IMAGE_SIZE || "1024x1536"; // --size WIDTHxHEIGHT overrides (both divisible by 16)
const QUALITY = () => process.env.IMAGE_QUALITY || "high";
const OPTION_SETS = {
  generate: [
    () => ({ size: SIZE, quality: QUALITY(), output_format: "webp" }),
    () => ({ size: SIZE }),
    () => ({}),
  ],
  edit: [
    () => ({ size: SIZE, quality: QUALITY(), output_format: "webp" }),
    () => ({ size: SIZE }),
    () => ({}),
  ],
};
const working = { generate: null, edit: null }; // { model, set } once a combination has succeeded

async function callApi(kind, fields, key, ref) {
  let res;
  if (kind === "edit") {
    const form = new FormData();
    for (const [k, v] of Object.entries(fields)) form.append(k, String(v));
    const refs = Array.isArray(ref) ? ref : [ref];
    for (const r of refs) form.append(refs.length > 1 ? "image[]" : "image", new Blob([r.buf], { type: r.mime }), r.name);
    res = await fetch(`${API}/images/edits`, { method: "POST", headers: { Authorization: `Bearer ${key}` }, body: form });
  } else {
    res = await fetch(`${API}/images/generations`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify(fields),
    });
  }
  if (!res.ok) {
    const err = new Error(`${res.status} ${await res.text()}`);
    err.status = res.status;
    throw err;
  }
  const item = (await res.json()).data[0];
  if (item.b64_json) return Buffer.from(item.b64_json, "base64");
  return Buffer.from(await (await fetch(item.url)).arrayBuffer());
}

/* Retry rate limits and server hiccups; give up at once on anything else. */
async function callWithRetry(kind, fields, key, ref) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await callApi(kind, fields, key, ref);
    } catch (err) {
      const retryable = (err.status === 429 && !isOutOfCredit(err)) || err.status >= 500 || !err.status;
      if (!retryable || attempt >= 4) throw err;
      await new Promise((r) => setTimeout(r, 15000 * attempt));
    }
  }
}

async function makeImage(kind, prompt, key, models, ref) {
  const sets = OPTION_SETS[kind];
  const w = working[kind];
  if (w) return callWithRetry(kind, { model: w.model, prompt, n: 1, ...sets[w.set]() }, key, ref);
  let last;
  for (const model of models.slice(0, 4)) {
    for (let set = 0; set < sets.length; set++) {
      try {
        const buf = await callWithRetry(kind, { model, prompt, n: 1, ...sets[set]() }, key, ref);
        working[kind] = { model, set };
        console.log(`Using image model ${model}${set ? ` (option set ${set + 1})` : ""}${kind === "edit" ? " for edits" : ""}.`);
        return buf;
      } catch (err) {
        last = err;
        if (err.status !== 400 && err.status !== 404) throw err;
        console.log(`  ${model}, option set ${set + 1}: not accepted — ${short(err)}`);
        if (/does not exist|not found|do not have access/i.test(err.message)) break; // try the next model
      }
    }
  }
  throw last;
}

/* assets/products/<id>/meta.json: model, prompt and settings behind each photo, so a batch can be reproduced or audited. */
function recordMeta(id, photo, info) {
  const file = path.join(PRODUCTS_DIR, id, "meta.json");
  let meta = {};
  try { meta = JSON.parse(fs.readFileSync(file, "utf8")); } catch (e) { /* new */ }
  meta.photos = meta.photos || {};
  meta.photos[photo] = { ...info, approved: null };
  fs.writeFileSync(file, JSON.stringify(meta, null, 1));
}
function extensionOf(buf) {
  if (buf.subarray(0, 4).toString("latin1") === "RIFF") return "webp";
  if (buf[0] === 0x89 && buf[1] === 0x50) return "png";
  return "jpg";
}
const MIME = { webp: "image/webp", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg" };

async function generate(args) {
  const dry = !!args["dry-run"];
  const key = cleanKey(process.env.OPENAI_API_KEY);
  if (!key && !dry) {
    console.error("OPENAI_API_KEY is not set. See the header of this file, or use --prompts to generate elsewhere.");
    process.exit(1);
  }
  let models = [];
  if (!dry) {
  console.log(`Key received: ${key.length} characters, starting ${key.slice(0, 8)} and ending …${key.slice(-4)}`);

  // Free check that OpenAI accepts the key, and which image models it can use.
  const check = await fetch(`${API}/models`, { headers: { Authorization: `Bearer ${key}` } });
  if (check.status === 401) {
    console.error(
      "\nSTOPPED: OpenAI says this key is not valid. Compare the length and last four characters above with the key " +
        "on platform.openai.com → API keys. If they match, the key was deleted or mis-copied when created — make a new one."
    );
    process.exit(1);
  }
  let ids = [];
  try {
    ids = check.ok ? (await check.json()).data.map((m) => m.id) : [];
  } catch (e) { /* fall back to the default model */ }
  console.log(check.ok ? "Key accepted by OpenAI." : `Key check returned ${check.status}; continuing anyway.`);
  models = rankModels(ids);
  console.log(`Image models to try, in order: ${models.slice(0, 4).join(", ")}`);
  }

  if (args.size) SIZE = String(args.size);
  if (args.note) RUN_NOTE = String(args.note);
  if (args.backdrop) { if (!STYLES[args.backdrop]) { console.error(`--backdrop must be one of: ${Object.keys(STYLES).join(", ")}`); process.exit(1); } BACKDROP = args.backdrop; }
  for (const spec of String(args.restage || "").split(",").filter(Boolean)) {
    const [n, b] = spec.split("=");
    if (!STYLES[b] || !(Number(n) >= 2 && Number(n) <= MAX_VIEWS)) { console.error(`--restage wants <photo 2..${MAX_VIEWS}>=<${Object.keys(STYLES).join("|")}>`); process.exit(1); }
    RESTAGE[Number(n)] = b;
  }
  if (args.secondary) {
    if (!STYLES[args.secondary]) { console.error(`--secondary must be one of: ${Object.keys(STYLES).join(", ")}`); process.exit(1); }
    SECONDARY.backdrop = args.secondary;
    SECONDARY.photos = new Set(String(args["secondary-photos"] || "2").split(",").map(Number).filter((n) => n >= 1 && n <= MAX_VIEWS));
  }
  const maxRefs = args.refs == null ? 6 : Math.max(0, Math.min(Number(args.refs) || 0, 16));
  const colors = args.colors === "none" ? [] : String(args.colors || Object.keys(COLORS).join(",")).split(",").map((c) => c.trim().toLowerCase()).filter((c) => COLORS[c]);
  console.log(`Image size: ${SIZE} · backdrop: ${BACKDROP}${SECONDARY.backdrop ? ` (photo ${[...SECONDARY.photos].join(", ")} on ${SECONDARY.backdrop})` : ""}${Object.keys(RESTAGE).map((n) => ` (photo ${n} = master restaged on ${RESTAGE[n]})`).join("")} · references for photo 1: up to ${maxRefs} · colours: yellow${colors.length ? ", " + colors.join(", ") : ""}`);
  const only = args.only ? new Set(args.only.split(",")) : null;
  const except = new Set(args.except ? args.except.split(",") : []);
  const photos = args.photo ? new Set(String(args.photo).split(",").map(Number)) : null; // --photo 5: only that photo number
  const views = Math.max(1, Math.min(Number(args.views || (photos ? Math.max(...photos) : 1)), MAX_VIEWS));
  // Pieces marked ownPhotos in the catalog have real supplied photos. They are skipped unless named
  // with --only together with --photo, and even then only photos that do not exist yet are made.
  const catalog = loadCatalog().filter((p) => (!only || only.has(p.id)) && !except.has(p.id) && (!p.ownPhotos || (only && photos)));

  // Photo 1 jobs first (from the source photos, or text), then the extra views (each made from that piece's
  // photo 1), then the white and rose versions of every yellow photo.
  const first = [], extra = [], tints = [];
  let fromRefs = 0;
  for (const p of catalog) {
    for (let n = 1; n <= views; n++) {
      if (photos && !photos.has(n)) continue;
      const redo = args.force && !p.ownPhotos;
      if (!photoFile(p.id, n) || redo) {
        if (n === 1) { const refs = referenceImages(p, maxRefs); if (refs.length) fromRefs++; first.push({ p, n, refs }); }
        else extra.push({ p, n });
      }
      for (const color of colors) if (!photoFile(p.id, n, color) || redo) tints.push({ p, n, color });
    }
  }
  const total = first.length + extra.length + tints.length;
  if (!total) {
    console.log(`Every piece already has ${views} photo(s) in every colour. Use --force to regenerate.`);
    sync();
    return;
  }
  if (dry) {
    for (const j of first) console.log(`  ${j.p.id} (${j.p.sku}) photo 1 from ${j.refs.length ? `${j.refs.length} source photo(s)` : "text only"}`);
    const noRefs = first.filter((j) => !j.refs.length).map((j) => j.p.sku);
    console.log(`\nDry run: ${total} image(s) would be generated — ${first.length} main, ${extra.length} extra view(s), ${tints.length} white/rose version(s).` +
      (noRefs.length ? ` No source photos for: ${noRefs.join(", ")}.` : ""));
    return;
  }
  const workers = Math.max(1, Math.min(Number(args.parallel || 3), 6));
  console.log(`Generating ${total} image(s): ${first.length} main photo(s) (${fromRefs} from the owners' source photos), ${extra.length} extra view(s), ${tints.length} white/rose version(s). One runs alone as a test, then ${workers} at a time…`);

  let made = 0, failed = 0, done = 0, fatal = null;
  const yellowPhoto = (p, n) => {
    const f = photoFile(p.id, n);
    if (!f) throw new Error(`no yellow gold photo ${n} to work from — it failed or is missing`);
    const ext = f.split(".").pop().toLowerCase();
    return { buf: fs.readFileSync(path.join(PRODUCTS_DIR, p.id, f)), mime: MIME[ext] || "image/webp", name: f };
  };
  async function run({ p, n, refs, color }) {
    const label = `${p.id} photo ${n}${color ? ` ${color} gold` : ""}`;
    let kind = "edit", prompt, ref;
    if (color) { prompt = colorPrompt(p, color); }
    else if (n > 1 && RESTAGE[n]) { prompt = restagePrompt(p, n); }
    else if (n > 1) { prompt = viewPrompt(p, n - 1); }
    else if (refs && refs.length) { prompt = refPrompt(p, refs.length); ref = refs; }
    else { kind = "generate"; prompt = fullPrompt(p); }
    try {
      if (kind === "edit" && !ref) ref = yellowPhoto(p, color ? n : 1);
      const buf = await makeImage(kind, prompt, key, models, ref);
      const dir = color ? path.join(PRODUCTS_DIR, p.id, color) : path.join(PRODUCTS_DIR, p.id);
      fs.mkdirSync(dir, { recursive: true });
      const old = photoFile(p.id, n, color);
      if (old) fs.unlinkSync(path.join(dir, old));
      fs.writeFileSync(path.join(dir, `${n}.${extensionOf(buf)}`), buf);
      recordMeta(p.id, `${color ? color + "/" : ""}${n}`, {
        model: (working[kind] || {}).model || null, kind, prompt, size: SIZE, quality: QUALITY(),
        backdrop: color ? undefined : RESTAGE[n] || backdropFor(n), madeFrom: color ? `${n}` : n > 1 ? "1" : (ref || []).map((r) => r.source),
        createdAt: new Date().toISOString(),
      });
      made++;
      console.log(`[${++done}/${total}] ${label} ok`);
    } catch (err) {
      failed++;
      if (isAccess(err) || isOutOfCredit(err) || (err.status && !working[kind])) fatal = err;
      console.log(`[${++done}/${total}] ${label} FAILED: ${short(err)}`);
    }
  }

  for (const jobs of [first, extra, tints]) {
    if (!jobs.length || fatal) continue;
    await run(jobs.shift()); // test image: settles the model and options, and stops early if nothing works
    const worker = async () => { while (jobs.length && !fatal) await run(jobs.shift()); };
    if (!fatal) await Promise.all(Array.from({ length: workers }, worker));
  }

  if (fatal) {
    const why = isOutOfCredit(fatal)
      ? "the account is out of credit. Add funds on platform.openai.com → Billing, then run this again — it picks up where it stopped."
      : isAccess(fatal)
        ? "OpenAI refused access. The organization may not be verified for image generation yet (platform.openai.com → Settings → Organization → Verify)."
        : "no image model accepted the request — see the messages above.";
    console.log(`\nSTOPPED after ${done} of ${total}: ${why}`);
  }
  console.log(`\nFINISHED: ${made} generated, ${failed} failed, ${total - done} not attempted.`);
  sync();
}

const argv = process.argv.slice(2);
const args = {};
for (let i = 0; i < argv.length; i++) {
  if (!argv[i].startsWith("--")) continue;
  const k = argv[i].slice(2);
  const next = argv[i + 1];
  if (next && !next.startsWith("--")) {
    args[k] = next;
    i++;
  } else args[k] = true;
}

if (args.sync) sync();
else if (args.review) writeReview();
else if (args.prompts) writePrompts();
else await generate(args);

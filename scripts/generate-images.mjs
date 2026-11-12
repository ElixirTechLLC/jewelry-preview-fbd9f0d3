#!/usr/bin/env node
/* ------------------------------------------------------------------
   Product image tooling.  No dependencies — needs Node 18+.

   node scripts/generate-images.mjs --sync
       Rescan assets/products/ and rebuild js/image-manifest.js.
       Run this any time you add, remove or rename image files.

   node scripts/generate-images.mjs --prompts
       Write image-prompts.md — the full prompt for every piece, ready
       to paste into whichever image generator you prefer. Save each
       result as assets/products/<id>/1.webp (or .png / .jpg), then
       run --sync.

   OPENAI_API_KEY=sk-... node scripts/generate-images.mjs
       Generate every photo that is missing. Photo 1 of a piece is made
       from its text prompt; photos 2–5 (other angles, a close-up and an
       on-model shot) are made FROM photo 1, so they show the same piece.
       Options:  --views 5            photos per piece (default 1, max 5)
                 --only <id>[,<id>]   just these pieces
                 --except <id>[,<id>] every piece but these
                 --photo 5            only this photo number (e.g. with --force to redo one)
                 --force              regenerate even if the photo exists
                 --parallel 3         images generated at once
                 --size 1600x2000     pixel size (default 1024x1536)
       Env:      IMAGE_MODEL    force a model (default: newest image
                                model the key can use)
                 IMAGE_QUALITY  low | medium | high (default high)
------------------------------------------------------------------- */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PRODUCTS_DIR = path.join(ROOT, "assets", "products");
const MANIFEST = path.join(ROOT, "js", "image-manifest.js");
const IMAGE_EXT = /\.(webp|png|jpe?g|avif)$/i;
const API = "https://api.openai.com/v1";
const MAX_VIEWS = 5;

const STYLE =
  "Resting on a glossy black mirror surface with a soft reflection beneath it, pure black background, " +
  "dramatic studio lighting with warm golden highlights, razor-sharp macro focus, brilliant sparkling white diamonds, " +
  "photorealistic high-end catalog photograph, the piece centered with generous dark space around it, portrait orientation. " +
  "No text, no lettering, no logos, no watermark, no hands, no people.";

const WORN_STYLE =
  "Dark, moody luxury editorial photograph: black clothing, near-black background, warm golden highlights on the jewelry, " +
  "razor-sharp focus on the piece with shallow depth of field, natural realistic skin, photorealistic, portrait orientation. " +
  "The face is not shown. No text, no lettering, no logos, no watermark.";

/* Photos 2–5 for each kind of piece. The last one is always the on-model shot. */
const VIEWS = {
  ring: [
    "viewed straight on from the front, standing upright, the top of the ring facing the camera",
    "standing upright on the surface on the bottom of its band, with the stone at the top, photographed exactly from the side as a true side profile: the band is a single thin vertical loop seen edge-on, and the height of the setting, the prongs and the gallery under the stone are visible. The ring is one solid piece standing up; the band is not lying flat on the surface and the setting is not tilted or turned",
    "in an extreme macro close-up of the stones and the setting",
    (who) => `being worn properly on a ${who} hand: the band is slid all the way down onto the ring finger and wraps completely around that one finger at its base, below the knuckle, with the top of the ring facing up on the back of the finger. The ring is not held, pinched or resting between two fingers. It is true to life size, so the top of the ring is no wider than the finger it is on. The hand is relaxed against a black jacket, tight close-up on the hand`,
  ],
  necklace: [
    "laid flat and viewed from directly above",
    "in an extreme macro close-up of the stones, links and clasp",
    "draped on a black velvet jewelry bust",
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

/* Prompt for photo 1 (text only). */
function fullPrompt(p) {
  return `Luxury fine jewelry product photograph of ${p.prompt}. ${STYLE}`;
}

/* Prompt for photos 2–5, sent together with photo 1 as the reference. */
function viewPrompt(p, view) {
  // A piece can override one view in the catalog: viewNotes: { 2: "…" } (keyed by photo number).
  const v = (p.viewNotes && p.viewNotes[view + 1]) || (VIEWS[p.type] || VIEWS.ring)[view - 1];
  const who = p.tags.includes("him") ? "man's" : "woman's";
  const worn = typeof v === "function";
  const what = worn ? v(who) : v;
  return (
    "The attached image is a product photograph of one piece of jewelry. Create a new photograph of this exact same piece — " +
    "the identical design, the identical metal and metal color, and the identical stones in the same number, shapes, sizes and arrangement — " +
    `now shown ${what}. Do not redesign, simplify or embellish the piece. ${worn ? WORN_STYLE : STYLE}`
  );
}

function existingImages(id) {
  const dir = path.join(PRODUCTS_DIR, id);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => IMAGE_EXT.test(f))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}
const photoFile = (id, n) => existingImages(id).find((f) => f.startsWith(`${n}.`));

function sync() {
  const catalog = loadCatalog();
  const manifest = {};
  let withImages = 0, photos = 0;
  for (const p of catalog) {
    const files = existingImages(p.id);
    if (files.length) {
      manifest[p.id] = files.map((f) => `assets/products/${p.id}/${f}`);
      withImages++;
      photos += files.length;
    }
  }
  const body =
    "/* AUTO-GENERATED by scripts/generate-images.mjs --sync. Do not edit by hand. */\n" +
    `window.IMAGES = ${JSON.stringify(manifest, null, 2)};\n`;
  fs.writeFileSync(MANIFEST, body);
  console.log(`Manifest updated: ${withImages} of ${catalog.length} pieces have images (${photos} photos in all).`);
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
    () => ({ size: SIZE, quality: QUALITY(), output_format: "webp", input_fidelity: "high" }),
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
    form.append("image", new Blob([ref.buf], { type: ref.mime }), ref.name);
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
        console.log(`Using image model ${model}${set ? ` (option set ${set + 1})` : ""}${kind === "edit" ? " for the extra angles" : ""}.`);
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

function extensionOf(buf) {
  if (buf.subarray(0, 4).toString("latin1") === "RIFF") return "webp";
  if (buf[0] === 0x89 && buf[1] === 0x50) return "png";
  return "jpg";
}
const MIME = { webp: "image/webp", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg" };

async function generate(args) {
  const key = cleanKey(process.env.OPENAI_API_KEY);
  if (!key) {
    console.error("OPENAI_API_KEY is not set. See the header of this file, or use --prompts to generate elsewhere.");
    process.exit(1);
  }
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
  const models = rankModels(ids);
  console.log(`Image models to try, in order: ${models.slice(0, 4).join(", ")}`);

  if (args.size) SIZE = String(args.size);
  console.log(`Image size: ${SIZE}`);
  const only = args.only ? new Set(args.only.split(",")) : null;
  const except = new Set(args.except ? args.except.split(",") : []);
  const photos = args.photo ? new Set(String(args.photo).split(",").map(Number)) : null; // --photo 5: only that photo number
  const views = Math.max(1, Math.min(Number(args.views || (photos ? Math.max(...photos) : 1)), MAX_VIEWS));
  // Pieces marked ownPhotos in the catalog have real supplied photos and are never regenerated.
  const catalog = loadCatalog().filter((p) => (!only || only.has(p.id)) && !except.has(p.id) && !p.ownPhotos);

  // Photo 1 jobs first (from text), then the extra views (each made from that piece's photo 1).
  const first = [], extra = [];
  for (const p of catalog) {
    for (let n = 1; n <= views; n++) {
      if (photos && !photos.has(n)) continue;
      if (photoFile(p.id, n) && !args.force) continue;
      (n === 1 ? first : extra).push({ p, n });
    }
  }
  const total = first.length + extra.length;
  if (!total) {
    console.log(`Every piece already has ${views} photo(s). Use --force to regenerate.`);
    sync();
    return;
  }
  const workers = Math.max(1, Math.min(Number(args.parallel || 3), 6));
  console.log(`Generating ${total} image(s): ${first.length} main photo(s), ${extra.length} extra view(s). One runs alone as a test, then ${workers} at a time…`);

  let made = 0, failed = 0, done = 0, fatal = null;
  async function run({ p, n }) {
    const kind = n === 1 ? "generate" : "edit";
    try {
      let ref = null;
      if (kind === "edit") {
        const main = photoFile(p.id, 1);
        if (!main) throw new Error("no main photo (1) to work from — it failed or is missing");
        const ext = main.split(".").pop().toLowerCase();
        ref = { buf: fs.readFileSync(path.join(PRODUCTS_DIR, p.id, main)), mime: MIME[ext] || "image/webp", name: main };
      }
      const buf = await makeImage(kind, n === 1 ? fullPrompt(p) : viewPrompt(p, n - 1), key, models, ref);
      const dir = path.join(PRODUCTS_DIR, p.id);
      fs.mkdirSync(dir, { recursive: true });
      const old = photoFile(p.id, n);
      if (old) fs.unlinkSync(path.join(dir, old));
      fs.writeFileSync(path.join(dir, `${n}.${extensionOf(buf)}`), buf);
      made++;
      console.log(`[${++done}/${total}] ${p.id} photo ${n} ok`);
    } catch (err) {
      failed++;
      if (isAccess(err) || isOutOfCredit(err) || (err.status && !working[kind])) fatal = err;
      console.log(`[${++done}/${total}] ${p.id} photo ${n} FAILED: ${short(err)}`);
    }
  }

  for (const jobs of [first, extra]) {
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
else if (args.prompts) writePrompts();
else await generate(args);

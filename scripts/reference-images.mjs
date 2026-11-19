// Collects web reference photos for every design in js/catalog.js, so the owners
// can see what each piece is meant to look like before any photo is generated.
//
//   node scripts/reference-images.mjs            # search, then build reference/board.html
//   node scripts/reference-images.mjs --queries  # only print the search query per design
//   node scripts/reference-images.mjs --build    # rebuild the board from reference/refs.json
//
// Results (thumbnail, full image and source page per hit) go to reference/refs.json
// and the board to reference/board.html. The reference/ folder is git-ignored: these
// are other people's photographs, for internal comparison only, never for the site.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(ROOT, "reference");
const REFS = path.join(OUT_DIR, "refs.json");
const BOARD = path.join(OUT_DIR, "board.html");
const PER_DESIGN = 6;
const args = process.argv.slice(2);

const src = fs.readFileSync(path.join(ROOT, "js", "catalog.js"), "utf8");
const win = {};
new Function("window", src)(win);
const CATALOG = win.CATALOG;

/* The invented first word of most titles says nothing about the piece; the rest describes it. */
const FANCY = new Set(["solstice", "meridian", "portofino", "harbor", "atlas", "ridge", "lumen", "coast", "sable", "tempo", "arcadia", "celeste", "orion", "muse", "aurora", "riviera", "lattice", "starlight", "luna", "regent", "milano", "navigator", "sundial", "architect", "silk", "glide", "avenue", "fortress", "glow", "nova", "mosaic", "beacon", "helix", "serene", "flare", "prism", "dusk", "astoria", "cascade", "orbit", "lumiere", "spire", "forever", "infinity", "crown", "promise", "stellar", "petal", "harmony", "laurel", "secret", "evermore", "elara", "adeline", "seraphina", "isla", "vivienne", "aria", "eleanor", "verona", "monaco", "briar", "juliet", "solene", "iris", "cassia", "stella", "signature", "heritage", "artisan", "ribbon", "halo"]);

/* A few titles need a plainer search phrase than their words give */
const OVERRIDES = { "WB-020": "wedding band with single flush set diamond 14k gold", "RG-020": "open negative space gold ring 14k", "RG-019": "interlocking ribbon gold ring 14k", "CH-018": "diamond halo station necklace 14k gold", "CH-015": "byzantine chain solid 14k gold", "CH-008": "wheat chain solid 14k gold", "CH-001": "cable chain solid 14k gold", "RG-004": "oval diamond ring tapered band 14k gold", "RG-008": "cushion diamond ring thin band 14k gold", "BR-012": "wide ridged gold cuff bracelet 14k", "RG-017": "sculpted wave gold ring 14k", "RG-018": "polished dome gold ring 14k", "ER-016": "twisted band round diamond engagement ring 14k gold" };

export function queryFor(p) {
  if (OVERRIDES[p.sku]) return OVERRIDES[p.sku];
  let words = p.name.toLowerCase().replace(/[’']/g, "").replace(/-/g, " ").split(/\s+/);
  if (words[0] === "north" && words[1] === "star") words = words.slice(2);
  else if (FANCY.has(words[0]) && words.length > 2) words = words.slice(1);
  let q = words.join(" ");
  if (p.cat === "engagement") q = q.replace(/\bring\b/, "").trim() + " engagement ring";
  if (p.cat === "wedding" && !/band/.test(q)) q += " wedding band";
  if (p.cat === "rings" && !/ring/.test(q)) q += " ring";
  if (p.type === "chain" && !/chain/.test(q)) q += " chain";
  if (p.type === "bracelet" && !/bracelet|cuff|bangle/.test(q)) q += " bracelet";
  if ((p.accentCtw || p.carats) && !/diamond/.test(q)) q += " diamond";
  if (p.cls === "gold" || p.cls === "cuff") q += " solid 14k gold";
  else q += " 14k gold";
  return q.replace(/\s+/g, " ").trim();
}

async function search(q) {
  const url = `https://www.bing.com/images/search?q=${encodeURIComponent(q)}&form=HDRSC2&first=1`;
  const r = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36", "accept-language": "en-US,en;q=0.9" } });
  const html = await r.text();
  const hits = [];
  const re = /\sm="(\{&quot;[^"]+)"/g;
  let m;
  while ((m = re.exec(html)) && hits.length < PER_DESIGN) {
    try {
      const j = JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&amp;/g, "&"));
      if (j.murl && j.turl) hits.push({ title: j.t || "", image: j.murl, page: j.purl || "", thumb: j.turl });
    } catch (e) { /* skip a malformed entry */ }
  }
  return hits;
}

function buildBoard(refs) {
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
  const cats = { engagement: "Engagement Rings", wedding: "Wedding Bands", rings: "Rings", bracelets: "Bracelets", chains: "Chains" };
  const sections = Object.entries(cats).map(([cat, title]) => {
    const items = CATALOG.filter((p) => p.cat === cat).map((p) => {
      const r = refs[p.sku] || { query: queryFor(p), hits: [] };
      const imgs = r.hits.map((h) => `<a href="${esc(h.page || h.image)}" target="_blank" rel="noopener" title="${esc(h.title)}"><img src="${esc(h.thumb)}" alt="" loading="lazy"></a>`).join("");
      const stones = p.carats ? `${p.shape} center, 1–5 ct` : p.accentCtw ? `${p.accentCtw.toFixed(2)} ctw accents` : "no stones";
      return `<article id="${p.sku}"><header><span class="sku">${p.sku}</span><h3>${esc(p.name)}</h3><p>${esc(p.brief || p.setting)}. ${esc(stones)}, ${p.widthMm} mm, ${p.goldG} g in 14K.</p><small>Searched: “${esc(r.query)}”</small></header><div class="imgs">${imgs || "<em>No results</em>"}</div></article>`;
    }).join("");
    return `<section><h2>${title}</h2>${items}</section>`;
  }).join("");
  const when = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Reference board</title>
<style>
:root{--bg:#f0e4d0;--ink:#20291d;--muted:#5a5f4f;--brass:#9a7538;--line:rgba(32,41,29,.18)}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.5 Georgia,"Times New Roman",serif}
.wrap{max-width:1280px;margin:0 auto;padding:32px 20px}
h1{font-weight:400;font-size:32px;margin:0 0 6px}h1+p{color:var(--muted);margin:0 0 30px}
h2{font-weight:400;letter-spacing:.14em;text-transform:uppercase;font-size:15px;color:var(--brass);border-bottom:1px solid var(--line);padding-bottom:8px;margin:40px 0 18px}
article{display:grid;grid-template-columns:300px 1fr;gap:20px;padding:18px 0;border-bottom:1px solid var(--line)}
article h3{margin:2px 0 6px;font-weight:500;font-size:20px}article p{margin:0 0 6px;font-size:14px;color:var(--muted)}
.sku{font:11px/1 Arial,sans-serif;letter-spacing:.12em;color:var(--brass)}small{font:12px/1.4 Arial,sans-serif;color:var(--muted)}
.imgs{display:grid;grid-template-columns:repeat(6,1fr);gap:8px}.imgs a{display:block;aspect-ratio:1;background:#fff;border:1px solid var(--line);overflow:hidden}.imgs img{width:100%;height:100%;object-fit:cover}
@media(max-width:800px){article{grid-template-columns:1fr}.imgs{grid-template-columns:repeat(3,1fr)}}
</style></head><body><div class="wrap">
<h1>Reference board: the 100 designs</h1><p>Web photographs of similar pieces, gathered ${when}, for judging what each design should look like. Each image links to its source page. Internal use only; these are other sellers' photographs.</p>
${sections}</div></body></html>`;
}

if (args.includes("--queries")) {
  CATALOG.forEach((p) => console.log(`${p.sku}  ${queryFor(p)}`));
  process.exit(0);
}
fs.mkdirSync(OUT_DIR, { recursive: true });
let refs = fs.existsSync(REFS) ? JSON.parse(fs.readFileSync(REFS, "utf8")) : {};
if (!args.includes("--build")) {
  for (const p of CATALOG) {
    if (refs[p.sku] && refs[p.sku].hits.length && !args.includes("--force")) continue;
    const q = queryFor(p);
    try {
      const hits = await search(q);
      refs[p.sku] = { query: q, hits };
      console.log(`${p.sku}  ${hits.length} images  ${q}`);
    } catch (e) {
      console.error(`${p.sku}  failed: ${e.message}`);
    }
    fs.writeFileSync(REFS, JSON.stringify(refs, null, 1));
    await new Promise((r) => setTimeout(r, 900 + Math.random() * 600));
  }
}
fs.writeFileSync(BOARD, buildBoard(refs));
console.log(`Board: ${BOARD}`);

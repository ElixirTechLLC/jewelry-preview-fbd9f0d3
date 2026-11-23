// For every design whose owners picked a "closest" photo on the review board, visit that
// photo's source page and collect the product's whole gallery, so the design can be
// studied (and later fed to the image generator) from more than one angle.
//
//   node scripts/source-galleries.mjs            # fetch galleries, download images, build the board
//   node scripts/source-galleries.mjs --build    # rebuild reference/sources.html from what is on disk
//
// Inputs:  reference/answers.json (the owners' answers), reference/refs.json (the six photos per design)
// Outputs: reference/sources/<SKU>/*.jpg|png|webp, reference/sources.json, reference/sources.html
// Everything under reference/ is git-ignored: these are other shops' photographs, for internal study only.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REF = path.join(ROOT, "reference");
const OUT_DIR = path.join(REF, "sources");
const INDEX = path.join(REF, "sources.json");
const BOARD = path.join(REF, "sources.html");
const MAX_IMAGES = 14;
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
const args = process.argv.slice(2);

const win = {}; new Function("window", fs.readFileSync(path.join(ROOT, "js", "catalog.js"), "utf8"))(win);
const CATALOG = win.CATALOG;
const refs = JSON.parse(fs.readFileSync(path.join(REF, "refs.json"), "utf8"));
const answers = JSON.parse(fs.readFileSync(path.join(REF, "answers.json"), "utf8")).answers;
let index = fs.existsSync(INDEX) ? JSON.parse(fs.readFileSync(INDEX, "utf8")) : {};

const fetchText = async (url) => {
  const r = await fetch(url, { headers: { "user-agent": UA, accept: "text/html,application/json;q=0.9,*/*;q=0.8", "accept-language": "en-US,en;q=0.9" }, redirect: "follow", signal: AbortSignal.timeout(20000) });
  return { ok: r.ok, status: r.status, text: r.ok ? await r.text() : "", url: r.url };
};
const abs = (u, base) => { try { return new URL(u, base).href; } catch (e) { return null; } };
const IMG_RE = /\.(jpe?g|png|webp|avif)(\?|$)/i;
const BAD = /logo|icon|sprite|favicon|badge|payment|flag|loading|placeholder|swatch|arrow|star|pixel|blank|avatar|banner|promo|newsletter|\/emails?\/|1x1|tracking/i;

/* Candidate image URLs from a product page, best sources first */
function candidates(html, pageUrl) {
  const out = [];
  const push = (u) => { const a = u && abs(u.trim().replace(/^\/\//, "https://"), pageUrl); if (a && !out.includes(a)) out.push(a); };
  // JSON-LD Product images
  for (const m of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const walk = (o) => {
        if (!o || typeof o !== "object") return;
        if (Array.isArray(o)) return o.forEach(walk);
        if (o["@type"] && /Product/i.test(String(o["@type"])) && o.image) {
          (Array.isArray(o.image) ? o.image : [o.image]).forEach((i) => push(typeof i === "string" ? i : i && (i.url || i.contentUrl)));
        }
        Object.values(o).forEach(walk);
      };
      walk(JSON.parse(m[1].trim()));
    } catch (e) { /* not JSON */ }
  }
  // Open Graph
  for (const m of html.matchAll(/<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["']/gi)) push(m[1]);
  for (const m of html.matchAll(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image(?::secure_url)?["']/gi)) push(m[1]);
  // Gallery <img> tags: src, data-src, srcset (largest candidate)
  for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
    const tag = m[0];
    const attr = (n) => { const r = new RegExp(`\\s${n}=["']([^"']+)["']`, "i").exec(tag); return r ? r[1] : ""; };
    const srcset = attr("srcset") || attr("data-srcset");
    if (srcset) { const parts = srcset.split(",").map((s) => s.trim().split(/\s+/)); const best = parts.sort((a, b) => (parseInt(b[1]) || 0) - (parseInt(a[1]) || 0))[0]; if (best) push(best[0]); }
    push(attr("data-zoom-image") || attr("data-large_image") || attr("data-src") || attr("data-original") || attr("src"));
  }
  return out.filter((u) => IMG_RE.test(u) && !BAD.test(u) && !/\.svg|\.gif/i.test(u));
}

/* Shopify stores expose the whole gallery as JSON */
async function shopifyImages(pageUrl) {
  const m = /^(https?:\/\/[^/]+)(?:\/[^?#]*?)?\/products\/([^/?#]+)/.exec(pageUrl);
  if (!m) return null;
  try {
    const r = await fetchText(`${m[1]}/products/${m[2]}.js`);
    if (!r.ok) return null;
    const j = JSON.parse(r.text);
    const imgs = (j.images || []).map((u) => abs(u, pageUrl)).filter(Boolean);
    return imgs.length ? { images: imgs, title: j.title || "" } : null;
  } catch (e) { return null; }
}

/* The public image-search index often lists a listing's other photos; used when a page gave fewer than two */
const samePage = (a, b) => { const n = (u) => { try { const x = new URL(u); return (x.hostname + x.pathname).replace(/^www\./, "").replace(/\/$/, "").toLowerCase(); } catch (e) { return u; } }; return n(a) === n(b); };
async function searchGallery(entry) {
  let host = ""; try { host = new URL(entry.page).hostname.replace(/^www\./, ""); } catch (e) { return []; }
  const q = `${String(entry.pageTitle || "").replace(/[|–—-].*$/, "").trim()} site:${host}`;
  try {
    const r = await fetchText(`https://www.bing.com/images/async?q=${encodeURIComponent(q)}&first=0&count=35&mmasync=1`);
    if (!r.ok) return [];
    const out = [];
    for (const m of r.text.matchAll(/\sm="(\{&quot;[^"]+)"/g)) {
      try { const j = JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&amp;/g, "&")); if (j.murl && j.purl && samePage(j.purl, entry.page)) out.push(j.murl); } catch (e) { /* skip */ }
    }
    return out;
  } catch (e) { return []; }
}

/* Normalise a URL so size variants of the same image collapse to one */
const key = (u) => u.replace(/([?&])(w|h|width|height|size|v|quality|q|fit|crop|auto|format|fm|dpr|sw|sh|_sw|_sh|wid|hei)=[^&]*/gi, "$1").replace(/[?&]+$/, "").replace(/_(\d{2,4}x\d{0,4}|\d{2,4}x|x\d{2,4})(?=\.\w+(\?|$))/i, "").replace(/-(\d{2,4})x(\d{2,4})(?=\.\w+(\?|$))/i, "").toLowerCase();
const upsize = (u) => u.replace(/([?&])(width|w)=\d+/gi, "$11600").replace(/_(\d{2,4})x(\d{0,4})(?=\.\w+(\?|$))/i, "_1600x").replace(/\/w_\d+(,|\/)/, "/w_1600$1").replace(/ar_\d+:\d+,c_fill,[^/]*\/w_\d+/i, "w_1600");

async function download(url, dest, referer) {
  const headers = { "user-agent": UA, accept: "image/avif,image/webp,image/*,*/*;q=0.8" };
  if (referer) headers.referer = referer; // some shops serve their own photos only to their own pages
  const r = await fetch(url, { headers, redirect: "follow", signal: AbortSignal.timeout(25000) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const type = (r.headers.get("content-type") || "").split(";")[0];
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length < 6000) throw new Error("too small");
  const ext = type.includes("png") ? ".png" : type.includes("webp") ? ".webp" : type.includes("avif") ? ".avif" : ".jpg";
  fs.writeFileSync(dest + ext, buf);
  return { file: path.basename(dest + ext), bytes: buf.length };
}

async function collect(p) {
  const a = answers[p.sku];
  if (!a || a.cleared || a.pick == null) return null;
  const hit = refs[p.sku].hits[a.pick];
  const entry = { sku: p.sku, name: p.name, pick: a.pick, pickThumb: hit.thumb, pickImage: hit.image, page: hit.page || hit.image, pageTitle: hit.title, note: a.note || "", track: a.track || null, images: [], status: "" };
  const dir = path.join(OUT_DIR, p.sku);
  fs.mkdirSync(dir, { recursive: true });
  let urls = [];
  const sh = await shopifyImages(entry.page);
  if (sh) { urls = sh.images; entry.status = "shopify gallery"; }
  else {
    try {
      const r = await fetchText(entry.page);
      if (!r.ok) entry.status = `source blocked (HTTP ${r.status})`;
      else { urls = candidates(r.text, r.url); entry.status = urls.length ? "page gallery" : "no gallery found"; }
    } catch (e) { entry.status = `source unreachable (${e.name === "TimeoutError" ? "timeout" : e.message})`; }
  }
  if (urls.length < 2) {
    const more = await searchGallery(entry);
    if (more.length) { urls = urls.concat(more); entry.status += `; ${more.length} more from the search index`; }
  }
  // the owners' pick first, then the rest of the gallery, size variants collapsed
  const seen = new Set();
  const ordered = [entry.pickImage, ...urls].filter((u) => { const k = key(u); if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, MAX_IMAGES);
  let n = 0;
  for (const u of ordered) {
    const isPick = u === entry.pickImage;
    try {
      const got = await download(isPick ? u : upsize(u), path.join(dir, String(n + 1).padStart(2, "0")));
      entry.images.push({ file: got.file, url: u, pick: isPick, bytes: got.bytes }); n++;
    } catch (e) {
      if (!isPick) { try { const got = await download(u, path.join(dir, String(n + 1).padStart(2, "0"))); entry.images.push({ file: got.file, url: u, pick: false, bytes: got.bytes }); n++; } catch (e2) { /* skip */ } }
      else { try { const got = await download(entry.pickThumb.replace(/&pid=15\.1.*/, "") + "&w=800&h=800&c=7&pid=15.1", path.join(dir, "01")); entry.images.push({ file: got.file, url: entry.pickThumb, pick: true, bytes: got.bytes, thumbOnly: true }); n++; } catch (e3) { /* skip */ } }
    }
  }
  if (!entry.images.some((i) => i.pick)) entry.status += "; pick itself could not be saved";
  return entry;
}

function buildBoard() {
  const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
  const CATS = [["engagement", "Engagement Rings"], ["wedding", "Wedding Bands"], ["rings", "Rings"], ["bracelets", "Bracelets"], ["chains", "Chains"]];
  const total = Object.values(index).reduce((n, e) => n + e.images.length, 0);
  const sections = CATS.map(([cat, title]) => {
    const items = CATALOG.filter((p) => p.cat === cat && index[p.sku]).map((p) => {
      const e = index[p.sku];
      const imgs = e.images.map((i, k) => `<a href="sources/${p.sku}/${i.file}" target="_blank" class="${i.pick ? "pick" : i.alt ? "alt" : ""}"><img src="sources/${p.sku}/${i.file}" alt="" loading="lazy"><span>${i.pick ? "owners' pick" : i.alt ? "2nd listing" : k + 1}</span></a>`).join("");
      const altLine = e.alt ? ` · second listing: <a href="${esc(e.alt.page)}" target="_blank" rel="noopener">${esc((() => { try { return new URL(e.alt.page).hostname.replace(/^www\./, ""); } catch (x) { return e.alt.page; } })())}</a>` : "";
      const host = (() => { try { return new URL(e.page).hostname.replace(/^www\./, ""); } catch (x) { return e.page || "no owners' pick"; } })();
      return `<article id="${p.sku}"><header><span class="sku">${p.sku}</span><h3>${esc(p.name)}</h3><p>${esc(p.brief || p.setting)}.</p>${e.note ? `<p class="note">Owners: “${esc(e.note)}”</p>` : ""}<p class="src">${e.images.length} image${e.images.length === 1 ? "" : "s"} from <a href="${esc(e.page)}" target="_blank" rel="noopener">${esc(host)}</a> · ${esc(e.pageTitle).slice(0, 80)} <em>(${esc(e.status)})</em>${altLine}</p></header><div class="imgs">${imgs || "<em>Nothing could be saved from this source.</em>"}</div></article>`;
    }).join("");
    return items ? `<section id="${cat}"><h2>${title}</h2>${items}</section>` : "";
  }).join("");
  const when = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  fs.writeFileSync(BOARD, `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Source galleries</title>
<style>
:root{--bg:#f0e4d0;--ink:#20291d;--muted:#5a5f4f;--brass:#9a7538;--line:rgba(32,41,29,.18)}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.5 Georgia,"Times New Roman",serif}
.wrap{max-width:1320px;margin:0 auto;padding:32px 20px}
h1{font-weight:400;font-size:32px;margin:0 0 6px}h1+p{color:var(--muted);margin:0 0 10px;max-width:80ch}
nav{display:flex;gap:18px;flex-wrap:wrap;margin:16px 0 30px;font:500 12px/1 Arial,sans-serif;letter-spacing:.14em;text-transform:uppercase}nav a{color:var(--ink);text-decoration:none}
h2{font-weight:400;letter-spacing:.14em;text-transform:uppercase;font-size:15px;color:var(--brass);border-bottom:1px solid var(--line);padding-bottom:8px;margin:40px 0 18px}
article{padding:22px 0;border-bottom:1px solid var(--line)}
article h3{margin:2px 0 6px;font-weight:500;font-size:22px}article p{margin:0 0 6px;font-size:15px;color:var(--muted)}
.sku{font:11px/1 Arial,sans-serif;letter-spacing:.12em;color:var(--brass)}.note{color:var(--ink);font-style:italic}.src{font:13px/1.5 Arial,sans-serif}.src em{color:var(--muted)}
.imgs{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px;margin-top:12px}
.imgs a{position:relative;display:block;aspect-ratio:1;background:#fff;border:1px solid var(--line);overflow:hidden}
.imgs a.pick{outline:3px solid var(--brass);border-color:var(--brass)}
.imgs a.alt span{background:rgba(90,95,79,.85)}
.imgs img{width:100%;height:100%;object-fit:cover}
.imgs span{position:absolute;left:0;right:0;bottom:0;background:rgba(32,41,29,.72);color:#f0e4d0;font:600 9px/1 Arial,sans-serif;letter-spacing:.12em;text-transform:uppercase;text-align:center;padding:4px 0}
.imgs a.pick span{background:var(--brass)}
@media(max-width:600px){.imgs{grid-template-columns:repeat(3,1fr)}}
</style></head><body><div class="wrap">
<h1>Source galleries for the owners' picks</h1><p>For each design, the photo the owners chose as closest, framed in brass, followed by every other image of that same product from the shop it came from. ${total} images across ${Object.keys(index).length} designs, saved ${when}. Internal study only; these photographs belong to the shops linked.</p>
<nav>${CATS.map(([c, t]) => `<a href="#${c}">${t}</a>`).join("")}</nav>
${sections}</div></body></html>`);
  return total;
}

/* --alt SKU=search words[;SKU=…]: for a design whose source gave only one photo, find a second listing of
   the same kind of piece in a shop that serves its gallery, and add that gallery marked as a second listing. */
const BLOCKED_HOSTS = /etsy\.com|walmart\.com|1stdibs\.com|therealreal\.com|ebay\.com|amazon\.com|nordstrom\.com|macys\.com|bjs\.com|belk\.com|pinterest|facebook|instagram|tiktok|youtube|reddit|aliexpress|temu|shein|wish\.com/i;
async function galleryOf(pageUrl) {
  let urls = [];
  const sh = await shopifyImages(pageUrl);
  if (sh) urls = sh.images;
  else { try { const pg = await fetchText(pageUrl); if (pg.ok) urls = candidates(pg.text, pg.url); } catch (e) { /* none */ } }
  const seen = new Set();
  return urls.filter((u) => { const k = key(u); if (seen.has(k)) return false; seen.add(k); return true; });
}
async function findAlt(entry, query, skip = []) {
  if (/^https?:\/\//i.test(query)) {
    const urls = await galleryOf(query);
    return urls.length ? { page: query, title: "", image: urls[0], urls: urls.slice(1, 11) } : null;
  }
  const r = await fetchText(`https://www.bing.com/images/async?q=${encodeURIComponent(query)}&first=0&count=35&mmasync=1`);
  const hits = [];
  for (const m of r.text.matchAll(/\sm="(\{&quot;[^"]+)"/g)) {
    try { const j = JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&amp;/g, "&")); if (j.purl && j.murl && !BLOCKED_HOSTS.test(j.purl) && !samePage(j.purl, entry.page) && !skip.some((u) => samePage(j.purl, u))) hits.push(j); } catch (e) { /* skip */ }
  }
  const tried = new Set();
  for (const h of hits) {
    const pageKey = h.purl.replace(/[?#].*$/, "");
    if (tried.has(pageKey)) continue; tried.add(pageKey);
    if (tried.size > 12) break;
    const urls = await galleryOf(h.purl);
    if (urls.length >= 3) return { page: h.purl, title: h.t || "", image: h.murl, urls: urls.slice(0, 10) };
  }
  return null;
}
const altArg = args.indexOf("--alt");
if (altArg >= 0) {
  const specs = args[altArg + 1].split(";").map((s) => s.split("=")).map(([sku, q]) => [sku.trim(), (q || "").trim()]);
  for (const [sku, q] of specs) {
    let e = index[sku];
    const p = CATALOG.find((x) => x.sku === sku);
    if (!p) { console.log(`${sku}  not in catalog`); continue; }
    if (!e) { e = index[sku] = { sku, name: p.name, pick: null, page: "", pageTitle: "", note: (answers[sku] && answers[sku].note) || "", track: null, images: [], status: "no owners' pick" }; }
    const rejected = [...(e.altRejected || []), ...(e.alt ? [e.alt.page] : [])];
    const alt = await findAlt(e, q || `${p.name} 14k gold`, rejected);
    if (!alt) { console.log(`${sku}  no second listing with a gallery found`); continue; }
    const dir = path.join(OUT_DIR, sku); fs.mkdirSync(dir, { recursive: true });
    if (e.alt) {
      for (const i of e.images.filter((x) => x.alt)) { try { fs.unlinkSync(path.join(dir, i.file)); } catch (x) { /* gone */ } }
      e.images = e.images.filter((x) => !x.alt);
      e.altRejected = rejected;
    }
    let n = e.images.length, added = 0;
    for (const u of [alt.image, ...alt.urls]) {
      if (n >= MAX_IMAGES) break;
      try { const got = await download(u, path.join(dir, String(n + 1).padStart(2, "0")), alt.page); e.images.push({ file: got.file, url: u, pick: false, alt: true, bytes: got.bytes }); n++; added++; }
      catch (err) { try { const got = await download(upsize(u), path.join(dir, String(n + 1).padStart(2, "0")), alt.page); e.images.push({ file: got.file, url: u, pick: false, alt: true, bytes: got.bytes }); n++; added++; } catch (e2) { /* skip */ } }
    }
    e.alt = { page: alt.page, title: alt.title };
    e.status = e.status.replace(/;\s*\d+ from a second listing.*$/, "") + `; ${added} from a second listing`;
    console.log(`${sku}  +${added} from ${alt.page.slice(0, 90)}`);
    fs.writeFileSync(INDEX, JSON.stringify(index, null, 1));
  }
  console.log(`Board: ${BOARD}  (${buildBoard()} images)`);
  process.exit(0);
}

/* --import <file.json>: { "SKU": ["image url", …] } gathered by hand or from a browser session; images are added to that design */
const imp = args.indexOf("--import");
if (imp >= 0) {
  const lists = JSON.parse(fs.readFileSync(args[imp + 1], "utf8"));
  for (const [sku, urls] of Object.entries(lists)) {
    const e = index[sku]; if (!e) continue;
    const dir = path.join(OUT_DIR, sku); fs.mkdirSync(dir, { recursive: true });
    const seen = new Set(e.images.map((i) => key(i.url)));
    let n = e.images.length, added = 0;
    for (const u of urls) {
      const k = key(u); if (seen.has(k)) continue; seen.add(k);
      if (n >= MAX_IMAGES) break;
      try { const got = await download(u, path.join(dir, String(n + 1).padStart(2, "0")), e.page); e.images.push({ file: got.file, url: u, pick: false, bytes: got.bytes }); n++; added++; }
      catch (err) { try { const got = await download(upsize(u), path.join(dir, String(n + 1).padStart(2, "0")), e.page); e.images.push({ file: got.file, url: u, pick: false, bytes: got.bytes }); n++; added++; } catch (e2) { console.error(`  ${sku} skip ${u.slice(0, 80)}: ${e2.message}`); } }
    }
    if (added) e.status = e.status.replace(/;.*$/, "") + `; ${added} more read in a browser`;
    console.log(`${sku}  +${added}  now ${e.images.length}`);
  }
  fs.writeFileSync(INDEX, JSON.stringify(index, null, 1));
  console.log(`Board: ${BOARD}  (${buildBoard()} images)`);
  process.exit(0);
}

if (!args.includes("--build")) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const todo = CATALOG.filter((p) => !index[p.sku] || args.includes("--force"));
  let i = 0;
  async function worker() {
    while (todo.length) {
      const p = todo.shift();
      try {
        const e = await collect(p);
        if (e) { index[p.sku] = e; console.log(`${p.sku}  ${e.images.length} images  ${e.status}`); }
      } catch (err) { console.error(`${p.sku}  failed: ${err.message}`); }
      fs.writeFileSync(INDEX, JSON.stringify(index, null, 1));
      i++;
    }
  }
  await Promise.all(Array.from({ length: 4 }, worker));
}
console.log(`Board: ${BOARD}  (${buildBoard()} images)`);

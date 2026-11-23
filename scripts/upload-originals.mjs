#!/usr/bin/env node
/* Upload the full-size product photos to the Vercel Blob store, so the repo and GitHub Pages only carry the
   web-size copies (assets/products-sm) while the product page loads originals from Blob.

     node scripts/upload-originals.mjs            # upload what is not there yet (compares size)
     node scripts/upload-originals.mjs --force    # re-upload everything

   Token: BLOB_READ_WRITE_TOKEN from design-api/.env.local (never committed). Files are stored at
   products/<id>/<file> with the same layout as assets/products, so one base URL (js/config.js → imageBase)
   plus the manifest path gives the remote URL. Prints the base URL at the end.
   NOTE (2026-11-23): Blob is the pre-launch home for the originals; move them to the final host at go-live. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(path.join(ROOT, "design-api", "package.json"));
const { put, list } = require("@vercel/blob");

const env = fs.readFileSync(path.join(ROOT, "design-api", ".env.local"), "utf8");
const token = (env.match(/^BLOB_READ_WRITE_TOKEN="?([^"\n]+)"?/m) || [])[1];
if (!token) { console.error("BLOB_READ_WRITE_TOKEN not found in design-api/.env.local"); process.exit(1); }

const force = process.argv.includes("--force");
const SRC = path.join(ROOT, "assets", "products");
const IMG = /\.(webp|png|jpe?g)$/i;
const catalogSrc = fs.readFileSync(path.join(ROOT, "js", "catalog.js"), "utf8");
const ids = new Set([...catalogSrc.matchAll(/"id":\s*"([^"]+)"/g)].map((m) => m[1]));

// what is already there
const existing = new Map();
let cursor;
do {
  const page = await list({ token, prefix: "products/", cursor, limit: 1000 });
  for (const b of page.blobs) existing.set(b.pathname, b);
  cursor = page.hasMore ? page.cursor : undefined;
} while (cursor);

const files = [];
for (const id of fs.readdirSync(SRC)) {
  if (!ids.has(id)) continue;
  for (const f of fs.readdirSync(path.join(SRC, id), { recursive: true })) {
    if (!IMG.test(f)) continue;
    const abs = path.join(SRC, id, f);
    files.push({ abs, key: `products/${id}/${String(f).split(path.sep).join("/")}` });
  }
}
let done = 0, skipped = 0, failed = 0, base = null;
const todo = files.filter((x) => { const e = existing.get(x.key); if (!force && e && e.size === fs.statSync(x.abs).size) { skipped++; if (!base) base = e.url.slice(0, e.url.indexOf("/products/") + 1); return false; } return true; });
console.log(`${files.length} originals; ${todo.length} to upload, ${skipped} already in Blob.`);

const workers = 6;
let i = 0;
async function worker() {
  while (i < todo.length) {
    const x = todo[i++];
    for (let attempt = 1; ; attempt++) {
      try {
        const r = await put(x.key, fs.readFileSync(x.abs), {
          access: "public", token, addRandomSuffix: false, allowOverwrite: true,
          contentType: x.key.endsWith(".png") ? "image/png" : x.key.endsWith(".webp") ? "image/webp" : "image/jpeg",
          cacheControlMaxAge: 31536000,
        });
        if (!base) base = r.url.slice(0, r.url.indexOf("/products/") + 1);
        done++;
        if (done % 25 === 0 || done === todo.length) console.log(`  ${done}/${todo.length} uploaded`);
        break;
      } catch (err) {
        if (attempt >= 4) { failed++; console.log(`  FAILED ${x.key}: ${String(err.message).slice(0, 160)}`); break; }
        await new Promise((r) => setTimeout(r, 3000 * attempt));
      }
    }
  }
}
await Promise.all(Array.from({ length: workers }, worker));
console.log(`\nDone: ${done} uploaded, ${skipped} skipped, ${failed} failed.`);
if (base) console.log(`Image base URL: ${base}`);

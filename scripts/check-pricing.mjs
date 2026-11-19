// Proves js/pricing.js reproduces the owners' workbook: every row of the
// exported variants CSV (jewelry_variants_prices_REVIEW.csv) is re-priced at
// the workbook's gold price and compared, price and variant SKU.
//
//   node scripts/check-pricing.mjs ~/Downloads/jewelry_variants_prices_REVIEW.csv
import { readFileSync } from "node:fs";

const csvPath = process.argv[2];
if (!csvPath) { console.error("usage: node scripts/check-pricing.mjs <variants.csv>"); process.exit(2); }

globalThis.window = globalThis;
window.GOLD_SPOT = { usdPerOz: 3738.2, asOf: "2026-11-18" };
window.JW_NO_LIVE_GOLD = true;
new Function(readFileSync("js/catalog.js", "utf8"))();
new Function(readFileSync("js/pricing.js", "utf8"))();
const { CATALOG, JW_PRICE } = window;

function parseCsv(text) {
  const rows = []; let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; }
    else if (ch === '"') q = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
    else if (ch !== "\r") cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [h, ...rest] = rows;
  return rest.filter((r) => r.length > 1).map((r) => Object.fromEntries(h.map((k, i) => [k.replace(/^﻿/, ""), r[i]])));
}

const rows = parseCsv(readFileSync(csvPath, "utf8"));
const bySku = Object.fromEntries(CATALOG.map((p) => [p.sku, p]));
let ok = 0, bad = 0, missing = 0;
const examples = [];
for (const r of rows) {
  const p = bySku[r["Parent SKU"]];
  if (!p) { missing++; continue; }
  const choice = { karat: r["Option1 Value"] };
  [[r["Option2 Name"], r["Option2 Value"]], [r["Option3 Name"], r["Option3 Value"]]].forEach(([n, v]) => {
    if (n === "Diamond Selection") choice.diamond = v;
    if (n === "Center Carat") choice.carat = parseInt(v, 10);
    if (n === "Length / Size") choice.size = v;
  });
  const q = JW_PRICE.quote(p, choice);
  const want = Number(r["Suggested Retail Price USD"]);
  const wantG = Number(r["Estimated Gold Weight g"]);
  if (q.price === want && q.sku === r["Variant SKU"] && Math.abs(q.goldG - wantG) < 0.011 /* Excel's ROUND and JS differ on a few x.xx5 weights by 0.01 g; prices never do */) ok++;
  else { bad++; if (examples.length < 12) examples.push({ sku: r["Variant SKU"], ours: q.sku, want, got: q.price, wantG, gotG: q.goldG }); }
}
console.log(`${ok} of ${rows.length} variants match (price, gold weight and SKU); ${bad} differ; ${missing} rows had no catalog piece`);
if (examples.length) console.table(examples);
// a sample of what the engine says at the live/default gold price for the README
process.exit(bad || missing ? 1 : 0);

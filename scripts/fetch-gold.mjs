// Fetches the current gold spot price (USD per troy ounce) and writes data/gold.js,
// the value every page starts from before it checks the live feed itself.
// Run by .github/workflows/gold-price.yml each morning, or by hand:
//   node scripts/fetch-gold.mjs
import { readFileSync, writeFileSync } from "node:fs";

const SOURCES = [
  {
    name: "gold-api.com",
    url: "https://api.gold-api.com/price/XAU",
    pick: (j) => ({ usdPerOz: Number(j.price), asOf: j.updatedAt }),
  },
  {
    name: "metals.live",
    url: "https://api.metals.live/v1/spot/gold",
    pick: (j) => ({ usdPerOz: Number(Array.isArray(j) ? j[0]?.price ?? j[0]?.[1] : j.price), asOf: new Date().toISOString() }),
  },
];

const sane = (n) => Number.isFinite(n) && n > 1000 && n < 20000;
let result = null;
for (const s of SOURCES) {
  try {
    const r = await fetch(s.url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(15000) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const got = s.pick(await r.json());
    if (!sane(got.usdPerOz)) throw new Error(`unusable price ${got.usdPerOz}`);
    result = { usdPerOz: Math.round(got.usdPerOz * 100) / 100, asOf: got.asOf || new Date().toISOString(), source: s.name };
    break;
  } catch (e) {
    console.error(`${s.name}: ${e.message}`);
  }
}
if (!result) {
  console.error("No source answered; data/gold.js left unchanged.");
  process.exit(1);
}

const path = "data/gold.js";
const before = readFileSync(path, "utf8");
const after = before.replace(/window\.GOLD_SPOT = \{.*\};/, `window.GOLD_SPOT = ${JSON.stringify(result)};`);
if (after === before) {
  console.log(`unchanged: $${result.usdPerOz}/oz (${result.source})`);
} else {
  writeFileSync(path, after);
  console.log(`data/gold.js: $${result.usdPerOz}/oz as of ${result.asOf} (${result.source})`);
}

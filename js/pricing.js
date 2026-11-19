/* ------------------------------------------------------------------
   PRICING ENGINE
   Every price on the site is computed here, at the moment it is shown,
   from the piece's reference figures (js/catalog.js), the owners'
   pricing inputs below, and the day's gold price (data/gold.js, refreshed
   daily by the gold-price workflow and again live in the browser).

   The formulas are the ones in the owners' workbook
   (Jewelry_100_Designs_Pricing_Catalog.xlsx, sheet PRICE VARIANTS); the
   inputs are its PRICING INPUTS sheet, with the same names. Change a number
   here and every price on the site follows. scripts/check-pricing.mjs proves
   the engine reproduces all 2,829 workbook prices at the workbook's gold price.
------------------------------------------------------------------- */
(function () {
  const INPUTS = {
    gramsPerTroyOz: 31.1034768,
    goldSourcingAllowance: 1.15,      // waste, alloy and acquisition
    goldRetailMultiple: 1.55,
    laborRetailMultiple: 1.65,        // applied to the design's workshop labor
    centerDiamondAllowance: 1.12,     // benchmarks are already loose retail
    roundingUsd: 25,                  // prices round UP to this
    labMeleeUsdPerCtw: 450,           // small matching accent stones
    naturalMeleeUsdPerCtw: 2100,
    accentRetailFactor: 1.25,
    weightFactor10K: 0.95,            // finished weight vs the 14K reference
    weightFactor18K: 1.08,
    extraGoldGramsPerCtOver1: 0.45,   // larger head / setting strength
    extraLaborUsdPerCtOver1: 70,
    // Owner rule for lab-grown engagement centers: a flat setting price plus a flat per-carat rate
    labEngagementUsdPerCt: 400,
    plainSolitaireBase14KUsd: 1000,   // ER-001 in 14K, plain band
    referenceBandGoldG: 4.7,
    referenceBandLaborUsd: 310,
    labPremiumExtraUsdPerCt: 0,       // both lab tiers cost the same until the owners set this
  };

  /* Loose center-stone retail reference, USD, by carat (DIAMOND BENCHMARKS) */
  const BENCHMARKS = {
    1: { Lab: 710, Natural: 3810 },
    2: { Lab: 2350, Natural: 19850 },
    3: { Lab: 4350, Natural: 46730 },
    4: { Lab: 6100, Natural: 78160 },
    5: { Lab: 7970, Natural: 128000 },
  };

  /* Price factor vs a round center stone (SHAPE FACTORS) */
  const SHAPE_FACTORS = { Round: 1, Oval: 0.94, Emerald: 0.88, Cushion: 0.9, Pear: 0.94, Marquise: 1, Radiant: 0.92, Princess: 0.89, Asscher: 0.89, Heart: 0.9 };

  /* Diamond selections: origin, tier multiplier, grading target, SKU code */
  const DIAMONDS = {
    "Lab Select": { origin: "Lab", mult: 1, target: "IGI target F–H color, VS1–VS2 clarity", code: "LS" },
    "Lab Premium": { origin: "Lab", mult: 1.25, target: "IGI target D–F color, VVS2–VS1 clarity", code: "LP" },
    "Natural Value": { origin: "Natural", mult: 0.72, target: "GIA target I–J color, SI1–SI2 clarity, eye-clean", code: "NV" },
    "Natural Select": { origin: "Natural", mult: 1, target: "GIA target G–H color, VS2–SI1 clarity", code: "NS" },
    "Natural Premium": { origin: "Natural", mult: 1.6, target: "GIA target D–F color, VS1–VVS2 clarity", code: "NP" },
  };
  const KARATS = ["10K", "14K", "18K"];

  /* The gold price. data/gold.js sets window.GOLD_SPOT before this file runs;
     refresh() replaces it with a live quote when the browser can reach the feed. */
  const FALLBACK = { usdPerOz: 3738.2, asOf: "2026-11-18T18:27:00Z", source: "Kitco (owners' workbook)" };
  let gold = Object.assign({}, FALLBACK, window.GOLD_SPOT || {});
  const LIVE_FEED = "https://api.gold-api.com/price/XAU";

  const karatFactor = (k) => (k === "10K" ? INPUTS.weightFactor10K : k === "18K" ? INPUTS.weightFactor18K : 1);
  const purity = (k) => parseInt(k, 10) / 24;
  const goldUsdPerGram = () => (gold.usdPerOz / INPUTS.gramsPerTroyOz) * INPUTS.goldSourcingAllowance * INPUTS.goldRetailMultiple;
  const roundUp = (x) => Math.ceil(x / INPUTS.roundingUsd - 1e-9) * INPUTS.roundingUsd;
  const round2 = (x) => Math.round(x * 100) / 100;

  /* The default configuration of a piece: 14K, reference size, first diamond choice, 1 ct */
  function defaults(p) {
    const sizes = p.sizes ? Object.keys(p.sizes.options) : [];
    const ref = sizes.find((s) => p.sizes.options[s] === 1) || sizes[0] || null;
    return { karat: "14K", size: ref, diamond: p.diamonds.length ? p.diamonds[0] : null, carat: p.carats ? p.carats[0] : null };
  }

  /* Price one configuration. Returns the breakdown as well as the price. */
  function quote(p, choice) {
    const c = Object.assign(defaults(p), choice || {});
    const k = KARATS.includes(c.karat) ? c.karat : "14K";
    const sizeFactor = p.sizes && c.size && p.sizes.options[c.size] != null ? p.sizes.options[c.size] : 1;
    const dia = c.diamond && DIAMONDS[c.diamond] ? DIAMONDS[c.diamond] : null;
    const carat = p.carats && c.carat ? Number(c.carat) : 0;
    const over = Math.max(0, carat - 1);
    const goldG = round2(p.goldG * karatFactor(k) * sizeFactor + over * INPUTS.extraGoldGramsPerCtOver1);
    const laborUsd = p.labor + over * INPUTS.extraLaborUsdPerCtOver1;
    const meleeRate = dia ? (dia.origin === "Lab" ? INPUTS.labMeleeUsdPerCtw : INPUTS.naturalMeleeUsdPerCtw) : 0;
    const accentUsd = p.accentCtw * meleeRate * INPUTS.accentRetailFactor;
    let price, goldUsd, centerUsd = 0, laborRetail;

    if (p.cat === "engagement" && dia && dia.origin === "Lab" && carat) {
      // Owner rule: $1,000 plain 14K setting + $400 per lab carat, with the design's extra labor,
      // extra gold and accents added on top, and the 10K/18K metal difference applied to the reference weight.
      const perGram14 = goldUsdPerGram() * purity("14K");
      const extras = Math.max(0, (p.labor - INPUTS.referenceBandLaborUsd) * INPUTS.laborRetailMultiple + (p.goldG - INPUTS.referenceBandGoldG) * perGram14 + accentUsd);
      const metalDelta = p.goldG * goldUsdPerGram() * (karatFactor(k) * purity(k) - purity("14K"));
      const premium = c.diamond === "Lab Premium" ? carat * INPUTS.labPremiumExtraUsdPerCt : 0;
      centerUsd = carat * INPUTS.labEngagementUsdPerCt + premium;
      goldUsd = metalDelta;
      laborRetail = INPUTS.plainSolitaireBase14KUsd + extras;
      price = roundUp(INPUTS.plainSolitaireBase14KUsd + centerUsd + extras + metalDelta);
    } else {
      goldUsd = goldG * goldUsdPerGram() * purity(k);
      laborRetail = laborUsd * INPUTS.laborRetailMultiple;
      if (dia && carat) {
        const bench = (BENCHMARKS[carat] || {})[dia.origin] || 0;
        centerUsd = bench * dia.mult * (SHAPE_FACTORS[p.shape] || 1) * INPUTS.centerDiamondAllowance;
      }
      price = roundUp(goldUsd + laborRetail + accentUsd + centerUsd);
    }
    return { price, goldG, goldUsd, laborUsd: laborRetail, accentUsd, centerUsd, karat: k, size: c.size, diamond: c.diamond, carat: carat || null, sku: variantSku(p, { karat: k, size: c.size, diamond: c.diamond, carat }), gold };
  }

  /* The owners' variant SKU, e.g. ER-001-14K-LS-2CT, BR-001-10K-NO-7P5IN, WB-011-18K-NS-STD */
  function variantSku(p, c) {
    const d = c.diamond && DIAMONDS[c.diamond] ? DIAMONDS[c.diamond].code : "NO";
    let s = "STD";
    if (p.carats && c.carat) s = `${c.carat}CT`;
    else if (p.sizes && c.size) s = String(c.size).replace(/\s*in$/i, "IN").replace(".", "P").toUpperCase();
    return `${p.sku}-${c.karat}-${d}-${s}`;
  }

  /* Every configuration of a piece */
  function configurations(p) {
    const sizes = p.sizes ? Object.keys(p.sizes.options) : [null];
    const dias = p.diamonds.length ? p.diamonds : [null];
    const carats = p.carats || [null];
    const out = [];
    KARATS.forEach((karat) => sizes.forEach((size) => dias.forEach((diamond) => carats.forEach((carat) => out.push({ karat, size, diamond, carat })))));
    return out;
  }

  /* Lowest and highest price of a piece across its configurations, optionally only those
     within limits: { karats: ["14K"], origins: ["Lab"], carats: [lo, hi] }. Null when none fit. */
  function range(p, limits) {
    const L = limits || {};
    let lo = Infinity, hi = 0, loChoice = null, any = false;
    configurations(p).forEach((c) => {
      if (L.karats && L.karats.length && !L.karats.includes(c.karat)) return;
      if (L.origins && L.origins.length) {
        const d = c.diamond && DIAMONDS[c.diamond];
        if (!d || !L.origins.includes(d.origin)) return;
      }
      if (L.carats && c.carat != null && (c.carat < L.carats[0] || c.carat > L.carats[1])) return;
      any = true;
      const q = quote(p, c);
      if (q.price < lo) { lo = q.price; loChoice = c; }
      if (q.price > hi) hi = q.price;
    });
    if (!any) return null;
    return { from: lo, to: hi, choice: loChoice, single: lo === hi };
  }

  const listeners = new Set();
  function setGold(next) {
    if (!next || !(next.usdPerOz > 0)) return;
    gold = Object.assign({}, gold, next);
    listeners.forEach((fn) => { try { fn(gold); } catch (e) { /* a page handler failed; keep going */ } });
  }

  /* Live refresh from the public feed (CORS-enabled, no key). Falls back silently. */
  async function refresh() {
    try {
      const r = await fetch(LIVE_FEED, { cache: "no-store" });
      if (!r.ok) return gold;
      const j = await r.json();
      if (j && j.price > 1000 && j.price < 20000) setGold({ usdPerOz: j.price, asOf: j.updatedAt || new Date().toISOString(), source: "gold-api.com, live" });
    } catch (e) { /* offline or blocked: keep the daily value */ }
    return gold;
  }

  window.JW_PRICE = {
    INPUTS, BENCHMARKS, SHAPE_FACTORS, DIAMONDS, KARATS,
    quote, range, defaults, configurations, variantSku,
    gold: () => gold, setGold, refresh,
    onGold: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    goldLine() {
      const d = new Date(gold.asOf);
      const when = isNaN(d) ? "" : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
      return `Gold at $${Math.round(gold.usdPerOz).toLocaleString("en-US")}/oz${when ? `, ${when}` : ""}`;
    },
  };
  if (typeof window !== "undefined" && typeof document !== "undefined" && window.fetch && !window.JW_NO_LIVE_GOLD) refresh();
})();

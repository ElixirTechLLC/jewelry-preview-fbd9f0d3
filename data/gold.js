/* Today's gold price, used by js/pricing.js for every price on the site.
   Written by scripts/fetch-gold.mjs, which the gold-price workflow runs every
   morning (.github/workflows/gold-price.yml). The browser also asks the live
   feed on each page load and uses that when it answers. */
window.GOLD_SPOT = {"usdPerOz":3634.4,"asOf":"2026-11-23T22:38:12Z","source":"gold-api.com"};

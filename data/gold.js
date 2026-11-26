/* Today's gold price, used by js/pricing.js for every price on the site.
   Written by scripts/fetch-gold.mjs, which the gold-price workflow runs every
   morning (.github/workflows/gold-price.yml). The browser also asks the live
   feed on each page load and uses that when it answers. */
window.GOLD_SPOT = {"usdPerOz":3566.2,"asOf":"2026-11-26T20:10:18Z","source":"gold-api.com"};

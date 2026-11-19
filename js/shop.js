/* Category / search listing page (shop.html?cat=…&tag=…&max=…&q=…)
   Each card shows the piece's lowest price across its configurations,
   computed by js/pricing.js at the day's gold price. */
window.JW.pages.shop = function () {
  const { $, $$, esc, money, CATS, inCat, shopUrl, productCard, imagesFor, search, priceFrom } = window.JW;
  const params = window.JW.route.params;
  const cat = CATS[params.get("cat")] ? params.get("cat") : "all";
  const tag = params.get("tag") || "";
  const max = Number(params.get("max")) || 0;
  const q = (params.get("q") || "").trim();
  const meta = CATS[cat];

  /* ----- Base list from the URL ----- */
  let base = q ? search(q) : window.CATALOG.slice();
  base = base.filter((p) => inCat(p, cat));
  const tagMatch = (p, t) => p.tags.includes(t) || p.type === t || p.cls === t || (p.shape || "").toLowerCase() === t;
  if (tag) base = base.filter((p) => tagMatch(p, tag));
  if (max) base = base.filter((p) => priceFrom(p) <= max);

  /* ----- Heading ----- */
  const chip = (meta.chips || []).find(([, t]) => t === tag);
  let title = meta.title;
  if (q) title = `Results for “${q}”`;
  else if (max) title = `${chip ? `${meta.title} · ${chip[0]}` : meta.title} under ${money(max)}`;
  else if (chip) title = cat === "engagement" ? `${chip[0]} Engagement Rings` : `${meta.title} · ${chip[0]}`;
  $("#shopTitle").textContent = title;
  $("#shopIntro").textContent = q ? `${base.length} piece${base.length === 1 ? "" : "s"} found.` : meta.intro;
  $("#crumbs").innerHTML = `<a href="index.html">Home</a><span>/</span><a href="${shopUrl(cat)}">${esc(meta.title)}</a>${chip ? `<span>/</span>${esc(chip[0])}` : ""}`;
  document.title = `${title} | ${window.SITE.brand}`;
  if (!q && meta.chips && meta.chips.length) {
    $("#chips").innerHTML =
      `<a class="pill${!tag ? " is-active" : ""}" href="${shopUrl(cat)}">All</a>` +
      meta.chips.map(([l, t]) => `<a class="pill${t === tag ? " is-active" : ""}" href="${shopUrl(cat, t)}">${l}</a>`).join("");
  }

  /* ----- Sidebar filters ----- */
  const TYPE_LABEL = { ring: "Rings", band: "Bands", chain: "Chains", bracelet: "Bracelets" };
  const CLS_LABEL = { gold: "Plain gold", cuff: "Cuffs", accent: "Diamond accents", center: "Center stone" };
  const PRICES = [["Any price", 0, Infinity], ["Under $1,000", 0, 1000], ["$1,000 – $2,500", 1000, 2500], ["$2,500 – $5,000", 2500, 5000], ["$5,000 – $10,000", 5000, 10000], ["$10,000 +", 10000, Infinity]];
  const GROUPS = [
    { key: "type", title: "Category", get: (p) => TYPE_LABEL[p.type] },
    { key: "cls", title: "Design", get: (p) => CLS_LABEL[p.cls] },
    { key: "shape", title: "Center stone", get: (p) => p.shape || "" },
  ];
  const state = { type: new Set(), cls: new Set(), shape: new Set(), price: 0 };

  function renderFilters() {
    const groups = GROUPS.map((g) => {
      const counts = {};
      base.forEach((p) => { const k = g.get(p); if (k) counts[k] = (counts[k] || 0) + 1; });
      const keys = Object.keys(counts);
      if (keys.length < 2) return "";
      return `<div class="filter-group"><h4>${g.title}</h4>${keys
        .map((k) => `<label class="check"><input type="checkbox" data-group="${g.key}" value="${esc(k)}"${state[g.key].has(k) ? " checked" : ""}>${esc(k)}<small>${counts[k]}</small></label>`)
        .join("")}</div>`;
    }).join("");
    const price = `<div class="filter-group"><h4>Price (from)</h4>${PRICES.map(
      ([l], i) => `<label class="check"><input type="radio" name="price" value="${i}"${state.price === i ? " checked" : ""}>${l}</label>`
    ).join("")}</div>`;
    $("#filters").innerHTML = groups + price + `<button class="clear-filters" id="clearFilters">Clear filters</button>
      <button class="btn btn--gold btn--block filter-toggle" data-close style="margin-top:22px">Show results</button>`;
  }

  const diaWeight = (p) => (p.carats ? Math.max(...p.carats) + p.accentCtw : p.accentCtw);
  const score = (p) => (imagesFor(p.id).length ? 2 : 0) + (p.featured ? 1 : 0);
  function apply() {
    const [, lo, hi] = PRICES[state.price];
    let list = base.filter(
      (p) => GROUPS.every((g) => !state[g.key].size || state[g.key].has(g.get(p))) && priceFrom(p) >= lo && priceFrom(p) <= hi
    );
    const sort = $("#sort").value;
    const by = {
      "price-asc": (a, b) => priceFrom(a) - priceFrom(b),
      "price-desc": (a, b) => priceFrom(b) - priceFrom(a),
      "gold-desc": (a, b) => (b.goldG || 0) - (a.goldG || 0),
      "dia-desc": (a, b) => diaWeight(b) - diaWeight(a),
      featured: (a, b) => score(b) - score(a),
    }[sort];
    list = list.slice().sort(by);
    $("#resultCount").textContent = `${list.length} design${list.length === 1 ? "" : "s"}`;
    $("#results").innerHTML = list.length
      ? list.map(productCard).join("")
      : `<div class="empty"><h3>No pieces match those filters.</h3><p>We also make jewelry to order. Tell us what you are looking for.</p><p style="margin-top:22px"><a class="btn" href="custom.html">Request a custom piece</a></p></div>`;
  }

  renderFilters();
  apply();
  window.JW_PRICE.onGold(() => { window.JW.resetPrices(); apply(); });

  $("#filters").addEventListener("change", (e) => {
    const el = e.target;
    if (el.name === "price") state.price = +el.value;
    else if (el.dataset.group) state[el.dataset.group][el.checked ? "add" : "delete"](el.value);
    apply();
  });
  $("#filters").addEventListener("click", (e) => {
    if (e.target.id !== "clearFilters") return;
    GROUPS.forEach((g) => state[g.key].clear());
    state.price = 0;
    renderFilters();
    apply();
  });
  $("#sort").addEventListener("change", apply);
  $("#filterToggle").addEventListener("click", () => window.JW.openFilters());
};
if (!window.PREVIEW) window.JW.pages.shop();

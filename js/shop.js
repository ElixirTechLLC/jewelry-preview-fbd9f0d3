/* Category / search / sale listing page (shop.html?cat=…&tag=…&max=…&q=…) */
window.JW.pages.shop = function () {
  const { $, $$, esc, money, CATS, inCat, shopUrl, productCard, imagesFor, search } = window.JW;
  const params = window.JW.route.params;
  const cat = CATS[params.get("cat")] ? params.get("cat") : "all";
  const tag = params.get("tag") || "";
  const max = Number(params.get("max")) || 0;
  const q = (params.get("q") || "").trim();
  const meta = CATS[cat];

  /* ----- Base list from the URL ----- */
  let base = q ? search(q) : window.CATALOG.slice();
  base = base.filter((p) => inCat(p, cat));
  // "tag" matches either a tag or the piece type (rings, chains…)
  const tagMatch = (p, t) => p.tags.includes(t) || p.type === t || (t === "ring" && p.type === "band" && p.cat !== "wedding") || (t === "necklace" && (p.type === "pendant" || p.type === "chain"));
  if (tag) base = base.filter((p) => tagMatch(p, tag));
  if (max) base = base.filter((p) => p.price <= max);

  /* ----- Heading ----- */
  const chip = (meta.chips || []).find(([, t]) => t === tag);
  let title = meta.title;
  if (q) title = `Results for “${q}”`;
  else if (max) title = `${meta.title} under ${money(max)}`;
  else if (chip) title = cat === "engagement" ? `${chip[0]} Engagement Rings` : `${meta.title} · ${chip[0]}`;
  $("#shopTitle").textContent = title;
  $("#shopIntro").textContent = q ? `${base.length} piece${base.length === 1 ? "" : "s"} found.` : meta.intro;
  $("#crumbs").innerHTML = `<a href="index.html">Home</a><span>/</span><a href="${shopUrl(cat)}">${esc(meta.title)}</a>${chip ? `<span>/</span>${esc(chip[0])}` : ""}`;
  document.title = `${title} — ${window.SITE.brand}`;
  if (!q && meta.chips && meta.chips.length) {
    $("#chips").innerHTML =
      `<a class="pill${!tag ? " is-active" : ""}" href="${shopUrl(cat)}">All</a>` +
      meta.chips.map(([l, t]) => `<a class="pill${t === tag ? " is-active" : ""}" href="${shopUrl(cat, t)}">${l}</a>`).join("");
  }

  /* ----- Sidebar filters ----- */
  const TYPE_LABEL = { ring: "Rings", band: "Bands", necklace: "Necklaces", pendant: "Pendants", chain: "Chains", earrings: "Earrings", bracelet: "Bracelets", watch: "Watches" };
  const metalColor = (p) => (/&/.test(p.metal) ? "Two-Tone" : /Rose/.test(p.metal) ? "Rose Gold" : /White/.test(p.metal) ? "White Gold" : "Yellow Gold");
  const karat = (p) => (p.metal.match(/\d+K/) || ["—"])[0];
  const stone = (p) => (p.gem ? "Gemstone" : p.dia ? "Diamond" : "Plain Gold");
  const PRICES = [["Any price", 0, Infinity], ["Under $1,000", 0, 1000], ["$1,000 – $2,500", 1000, 2500], ["$2,500 – $5,000", 2500, 5000], ["$5,000 – $10,000", 5000, 10000], ["$10,000 +", 10000, Infinity]];
  const GROUPS = [
    { key: "type", title: "Category", get: (p) => TYPE_LABEL[p.type] },
    { key: "stone", title: "Stones", get: stone },
    { key: "color", title: "Metal", get: metalColor },
    { key: "karat", title: "Karat", get: karat },
  ];
  const state = { type: new Set(), stone: new Set(), color: new Set(), karat: new Set(), price: 0 };

  function renderFilters() {
    const groups = GROUPS.map((g) => {
      const counts = {};
      base.forEach((p) => (counts[g.get(p)] = (counts[g.get(p)] || 0) + 1));
      const keys = Object.keys(counts);
      if (keys.length < 2) return "";
      return `<div class="filter-group"><h4>${g.title}</h4>${keys
        .map((k) => `<label class="check"><input type="checkbox" data-group="${g.key}" value="${esc(k)}"${state[g.key].has(k) ? " checked" : ""}>${esc(k)}<small>${counts[k]}</small></label>`)
        .join("")}</div>`;
    }).join("");
    const price = `<div class="filter-group"><h4>Price</h4>${PRICES.map(
      ([l], i) => `<label class="check"><input type="radio" name="price" value="${i}"${state.price === i ? " checked" : ""}>${l}</label>`
    ).join("")}</div>`;
    $("#filters").innerHTML = groups + price + `<button class="clear-filters" id="clearFilters">Clear filters</button>
      <button class="btn btn--gold btn--block filter-toggle" data-close style="margin-top:22px">Show results</button>`;
  }

  function apply() {
    const [, lo, hi] = PRICES[state.price];
    let list = base.filter(
      (p) => GROUPS.every((g) => !state[g.key].size || state[g.key].has(g.get(p))) && p.price >= lo && p.price <= hi
    );
    const sort = $("#sort").value;
    const by = {
      "price-asc": (a, b) => a.price - b.price,
      "price-desc": (a, b) => b.price - a.price,
      "gold-desc": (a, b) => (b.goldG || 0) - (a.goldG || 0),
      "dia-desc": (a, b) => ((b.dia && b.dia.ctw) || 0) - ((a.dia && a.dia.ctw) || 0),
      featured: (a, b) => score(b) - score(a),
    }[sort];
    list = list.slice().sort(by);
    $("#resultCount").textContent = `${list.length} piece${list.length === 1 ? "" : "s"}`;
    $("#results").innerHTML = list.length
      ? list.map(productCard).join("")
      : `<div class="empty"><h3>Nothing in the case matches — yet.</h3><p>We make almost anything to order. Tell us what you are looking for.</p><p style="margin-top:22px"><a class="btn" href="custom.html">Request a Custom Piece</a></p></div>`;
  }
  const score = (p) => (imagesFor(p.id).length ? 2 : 0) + (p.featured ? 1 : 0);

  renderFilters();
  apply();

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

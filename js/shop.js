/* Category / search listing page (shop.html?cat=…&tag=…&q=… plus filter params)
   Filters live in a panel that opens from the Filter button in the toolbar; nothing is
   shown until it is opened. Applied filters appear as chips beside the count. Each card
   shows the piece's lowest price for the configurations the filters allow (gold purity,
   lab or natural, center carat), computed by js/pricing.js at the day's gold price. */
window.JW.pages.shop = function () {
  const { $, $$, esc, money, CATS, inCat, shopUrl, productCard, imagesFor, search, priceRange } = window.JW;
  const PR = window.JW_PRICE;
  const params = window.JW.route.params;
  const cat = CATS[params.get("cat")] ? params.get("cat") : "all";
  const tag = params.get("tag") || "";
  const q = (params.get("q") || "").trim();
  const meta = CATS[cat];

  /* ----- Base list from the URL ----- */
  let base = q ? search(q) : window.CATALOG.slice();
  base = base.filter((p) => inCat(p, cat));
  const tagMatch = (p, t) => p.tags.includes(t) || p.type === t || p.cls === t || (p.shape || "").toLowerCase() === t;
  if (tag) base = base.filter((p) => tagMatch(p, tag));

  /* ----- Heading ----- */
  const chip = (meta.chips || []).find(([, t]) => t === tag);
  let title = meta.title;
  if (q) title = `Results for “${q}”`;
  else if (chip) title = cat === "engagement" ? `${chip[0]} Engagement Rings` : `${meta.title} · ${chip[0]}`;
  $("#shopTitle").textContent = title;
  $("#shopIntro").textContent = q ? `${base.length} design${base.length === 1 ? "" : "s"} found.` : meta.intro;
  $("#crumbs").innerHTML = `<a href="index.html">Home</a><span>/</span><a href="${shopUrl(cat)}">${esc(meta.title)}</a>${chip ? `<span>/</span>${esc(chip[0])}` : ""}`;
  document.title = `${title} | ${window.SITE.brand}`;
  if (!q && meta.chips && meta.chips.length) {
    $("#chips").innerHTML =
      `<a class="pill${!tag ? " is-active" : ""}" href="${shopUrl(cat)}">All</a>` +
      meta.chips.map(([l, t]) => `<a class="pill${t === tag ? " is-active" : ""}" href="${shopUrl(cat, t)}">${l}</a>`).join("");
  }

  /* ----- What can be filtered in this list ----- */
  const SHAPES = ["Round", "Oval", "Emerald", "Cushion", "Pear", "Radiant", "Marquise", "Princess", "Asscher", "Heart"];
  const SHAPE_ICON = {
    Round: '<circle cx="16" cy="16" r="12"/><circle cx="16" cy="16" r="6"/><path d="M16 4v8M16 20v8M4 16h8M20 16h8M7.5 7.5l6 6M18.5 18.5l6 6M24.5 7.5l-6 6M13.5 18.5l-6 6"/>',
    Oval: '<ellipse cx="16" cy="16" rx="9" ry="13"/><ellipse cx="16" cy="16" rx="4.5" ry="7"/><path d="M16 3v6M16 23v6M7 16h4.5M20.5 16H25"/>',
    Emerald: '<path d="M9 4h14l4 4v16l-4 4H9l-4-4V8z"/><path d="M11 8h10l2 2v12l-2 2H11l-2-2V10z"/><path d="M13 12h6v8h-6z"/>',
    Cushion: '<rect x="5" y="5" width="22" height="22" rx="7"/><rect x="10" y="10" width="12" height="12" rx="4"/><path d="M5 16h5M22 16h5M16 5v5M16 22v5"/>',
    Pear: '<path d="M16 3c6 7 11 12 11 18a11 11 0 0 1-22 0c0-6 5-11 11-18z"/><path d="M16 11c3 4 6 7 6 10a6 6 0 0 1-12 0c0-3 3-6 6-10z"/>',
    Radiant: '<path d="M9 4h14l5 5v14l-5 5H9l-5-5V9z"/><path d="M11 9h10l2 2v10l-2 2H11l-2-2V11z"/><path d="M4 9l5 2M28 9l-5 2M4 23l5-2M28 23l-5-2"/>',
    Marquise: '<path d="M16 3c7 5 10 9 10 13s-3 8-10 13C9 24 6 20 6 16S9 8 16 3z"/><path d="M16 9c3.5 3 5 5 5 7s-1.5 4-5 7c-3.5-3-5-5-5-7s1.5-4 5-7z"/>',
    Princess: '<rect x="5" y="5" width="22" height="22"/><rect x="10" y="10" width="12" height="12"/><path d="M5 5l5 5M27 5l-5 5M5 27l5-5M27 27l-5-5"/>',
    Asscher: '<path d="M10 4h12l6 6v12l-6 6H10l-6-6V10z"/><path d="M12 9h8l3 3v8l-3 3h-8l-3-3v-8z"/><path d="M4 10l5 2M28 10l-5 2M4 22l5-2M28 22l-5-2"/>',
    Heart: '<path d="M16 28S4 19 4 11a6 6 0 0 1 12-2 6 6 0 0 1 12 2c0 8-12 17-12 17z"/><path d="M16 22s-7-5.5-7-10a3.5 3.5 0 0 1 7-1 3.5 3.5 0 0 1 7 1c0 4.5-7 10-7 10z"/>',
  };
  const CLS_LABEL = { gold: "Plain gold", cuff: "Cuffs", accent: "Diamond accents", center: "Center stone" };
  const STYLE_LABEL = { "three-stone": "Three-stone", "east-west": "East-west", "knife-edge": "Knife edge", pave: "Pavé" };
  const NOT_STYLE = new Set(["plain", "accent", "center", "diamond", "cuff", "round", "oval", "emerald", "cushion", "pear", "radiant", "marquise", "princess", "asscher", "heart"]);
  const KARATS = PR.KARATS;
  const hasShape = base.some((p) => p.carats && p.shape); // shape is a center-stone choice; accent stones are always round
  const hasDia = base.some((p) => p.diamonds.length);
  const hasCarat = base.some((p) => p.carats);
  const clsKeys = [...new Set(base.map((p) => p.cls))];
  const styleCounts = {};
  base.forEach((p) => p.tags.forEach((t) => { if (!NOT_STYLE.has(t)) styleCounts[t] = (styleCounts[t] || 0) + 1; }));
  const styles = Object.entries(styleCounts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 12).map(([t]) => t);
  const styleLabel = (t) => STYLE_LABEL[t] || t.charAt(0).toUpperCase() + t.slice(1);

  /* Price bounds of this list, over every configuration, rounded to $25 */
  const allFrom = base.map((p) => priceRange(p).from), allTo = base.map((p) => priceRange(p).to);
  const PMIN = Math.floor(Math.min(...allFrom) / 25) * 25 || 0, PMAX = Math.ceil(Math.max(...allTo) / 25) * 25 || 0;

  /* ----- Filter state, also kept in the address so a filtered list can be shared ----- */
  const state = { shape: new Set(), cls: new Set(), origin: new Set(), karat: new Set(), style: new Set(), carat: [1, 5], price: [PMIN, PMAX] };
  const list = (k) => (params.get(k) || "").split(",").filter(Boolean);
  list("shape").forEach((v) => SHAPES.includes(v) && state.shape.add(v));
  list("design").forEach((v) => CLS_LABEL[v] && state.cls.add(v));
  list("dia").forEach((v) => ["Lab", "Natural"].includes(v) && state.origin.add(v));
  list("karat").forEach((v) => KARATS.includes(v) && state.karat.add(v));
  list("style").forEach((v) => styles.includes(v) && state.style.add(v));
  const span = (k, lo, hi) => { const m = /^(\d+)-(\d+)$/.exec(params.get(k) || ""); return m ? [Math.max(lo, +m[1]), Math.min(hi, +m[2])] : [lo, hi]; };
  state.carat = span("ct", 1, 5);
  state.price = span("price", PMIN, PMAX);

  const limits = () => ({ karats: [...state.karat], origins: [...state.origin], carats: state.carat[0] > 1 || state.carat[1] < 5 ? state.carat : null });
  const caratActive = () => state.carat[0] > 1 || state.carat[1] < 5;
  const priceActive = () => state.price[0] > PMIN || state.price[1] < PMAX;
  const activeCount = () => state.shape.size + state.cls.size + state.origin.size + state.karat.size + state.style.size + (caratActive() ? 1 : 0) + (priceActive() ? 1 : 0);

  function matches(p) {
    if (state.shape.size && !(p.carats && state.shape.has(p.shape))) return false;
    if (state.cls.size && !state.cls.has(p.cls)) return false;
    if (state.origin.size && !p.diamonds.some((d) => state.origin.has(PR.DIAMONDS[d].origin))) return false;
    if (state.style.size && !p.tags.some((t) => state.style.has(t))) return false;
    if (caratActive() && !(p.carats && p.carats.some((c) => c >= state.carat[0] && c <= state.carat[1]))) return false;
    const r = priceRange(p, limits());
    if (!r) return false;
    return r.from >= state.price[0] && r.from <= state.price[1];
  }
  function current() {
    const L = limits();
    const found = base.filter(matches);
    const sort = $("#sort").value;
    const from = (p) => priceRange(p, L).from;
    const diaWeight = (p) => (p.carats ? Math.max(...p.carats) + p.accentCtw : p.accentCtw);
    const score = (p) => (imagesFor(p.id).length ? 2 : 0) + (p.featured ? 1 : 0);
    const by = {
      "price-asc": (a, b) => from(a) - from(b),
      "price-desc": (a, b) => from(b) - from(a),
      "gold-desc": (a, b) => (b.goldG || 0) - (a.goldG || 0),
      "dia-desc": (a, b) => diaWeight(b) - diaWeight(a),
      featured: (a, b) => score(b) - score(a),
    }[sort];
    return found.slice().sort(by);
  }

  /* ----- The panel ----- */
  const check = (group, value, label, extra = "") => `<label class="check"><input type="checkbox" data-group="${group}" value="${esc(value)}"${state[group].has(value) ? " checked" : ""}>${extra}<span>${esc(label)}</span></label>`;
  const swatch = (k) => `<i class="swatch swatch--${k}"></i>`;
  function panelHTML() {
    const cols = [];
    if (hasShape) cols.push(`<div class="fgroup fgroup--shapes"><h4>Shape</h4><div class="shapes">${SHAPES.filter((s) => base.some((p) => p.carats && p.shape === s)).map((s) => `<button type="button" class="shape${state.shape.has(s) ? " on" : ""}" data-shape="${s}" aria-pressed="${state.shape.has(s)}"><svg viewBox="0 0 32 32" aria-hidden="true">${SHAPE_ICON[s]}</svg><span>${s}</span></button>`).join("")}</div></div>`);
    const mid = [];
    if (clsKeys.length > 1) mid.push(`<div class="fgroup"><h4>Design</h4>${clsKeys.map((k) => check("cls", k, CLS_LABEL[k])).join("")}</div>`);
    mid.push(`<div class="fgroup"><h4>Gold</h4>${KARATS.map((k) => check("karat", k, `${k} gold`, swatch(k))).join("")}<p class="fnote">Prices shown for the gold you choose; every piece is made in all three.</p></div>`);
    if (hasDia) mid.push(`<div class="fgroup"><h4>Diamonds</h4>${check("origin", "Lab", "Lab-grown")}${check("origin", "Natural", "Natural")}</div>`);
    cols.push(`<div class="fcol">${mid.join("")}</div>`);
    if (styles.length) cols.push(`<div class="fgroup fgroup--styles"><h4>Style</h4><div class="styles">${styles.map((t) => check("style", t, styleLabel(t))).join("")}</div></div>`);
    const ranges = [];
    ranges.push(`<div class="fgroup"><h4>Price</h4><div class="range" data-range="price" data-min="${PMIN}" data-max="${PMAX}" data-step="25">
      <div class="boxes"><output id="priceLo">${money(state.price[0])}</output><output id="priceHi">${money(state.price[1])}</output></div>
      <div class="sliders"><div class="track"><div class="fill"></div></div><input type="range" min="${PMIN}" max="${PMAX}" step="25" value="${state.price[0]}" data-end="0" aria-label="Lowest price"><input type="range" min="${PMIN}" max="${PMAX}" step="25" value="${state.price[1]}" data-end="1" aria-label="Highest price"></div></div></div>`);
    if (hasCarat) ranges.push(`<div class="fgroup"><h4>Center carat</h4><div class="range" data-range="carat" data-min="1" data-max="5" data-step="1">
      <div class="boxes"><output id="caratLo">${state.carat[0]} ct</output><output id="caratHi">${state.carat[1]} ct</output></div>
      <div class="sliders"><div class="track"><div class="fill"></div></div><input type="range" min="1" max="5" step="1" value="${state.carat[0]}" data-end="0" aria-label="Smallest center carat"><input type="range" min="1" max="5" step="1" value="${state.carat[1]}" data-end="1" aria-label="Largest center carat"></div></div></div>`);
    cols.push(`<div class="fcol fcol--ranges">${ranges.join("")}</div>`);
    return `<div class="fpanel-head"><button type="button" class="freset" id="fReset">Reset</button><button type="button" class="fclose" id="fClose" aria-label="Close filters">×</button></div>
      <div class="fcols">${cols.join("")}</div>
      <div class="fpanel-foot"><button type="button" class="btn" id="fView">View designs</button></div>`;
  }

  const panel = $("#filters");
  const toggle = $("#filterToggle");
  panel.innerHTML = panelHTML();
  function fills() {
    $$(".range", panel).forEach((r) => {
      const [a, b] = $$("input", r); const min = +r.dataset.min, max = +r.dataset.max;
      const lo = (+a.value - min) / (max - min || 1) * 100, hi = (+b.value - min) / (max - min || 1) * 100;
      const f = $(".fill", r); f.style.left = lo + "%"; f.style.right = 100 - hi + "%";
    });
  }
  function paintApplied(n) {
    const chips = [];
    state.shape.forEach((v) => chips.push(["shape", v, v]));
    state.cls.forEach((v) => chips.push(["cls", v, CLS_LABEL[v]]));
    state.karat.forEach((v) => chips.push(["karat", v, v + " gold"]));
    state.origin.forEach((v) => chips.push(["origin", v, v === "Lab" ? "Lab-grown" : "Natural"]));
    state.style.forEach((v) => chips.push(["style", v, styleLabel(v)]));
    if (caratActive()) chips.push(["carat", "", `${state.carat[0]}–${state.carat[1]} ct`]);
    if (priceActive()) chips.push(["price", "", `${money(state.price[0])}–${money(state.price[1])}`]);
    $("#applied").innerHTML = chips.length
      ? chips.map(([g, v, l]) => `<button type="button" class="achip" data-group="${g}" data-value="${esc(v)}">${esc(l)}<span aria-hidden="true">×</span></button>`).join("") + `<button type="button" class="areset" id="aReset">Reset all</button>`
      : "";
    toggle.classList.toggle("on", chips.length > 0);
    $("#filterCount").textContent = chips.length ? chips.length : "";
    $("#fView").textContent = `View ${n} design${n === 1 ? "" : "s"}`;
  }
  function syncUrl() {
    const u = new URL(location.href);
    const set = (k, v) => (v ? u.searchParams.set(k, v) : u.searchParams.delete(k));
    set("shape", [...state.shape].join(",")); set("design", [...state.cls].join(",")); set("dia", [...state.origin].join(","));
    set("karat", [...state.karat].join(",")); set("style", [...state.style].join(","));
    set("ct", caratActive() ? state.carat.join("-") : ""); set("price", priceActive() ? state.price.join("-") : "");
    history.replaceState(null, "", u);
  }
  function apply() {
    const items = current();
    const L = limits();
    $("#resultCount").textContent = `${items.length} design${items.length === 1 ? "" : "s"}`;
    $("#results").innerHTML = items.length
      ? items.map((p) => productCard(p, L)).join("")
      : `<div class="empty"><h3>No designs match those filters.</h3><p>Loosen a filter, or tell us what you are looking for and we will make it.</p><p style="margin-top:22px"><a class="btn" href="custom.html">Request a custom piece</a></p></div>`;
    paintApplied(items.length);
    fills();
    syncUrl();
  }

  /* ----- Open / close ----- */
  const isOpen = () => !panel.hidden;
  function openPanel() { panel.hidden = false; toggle.setAttribute("aria-expanded", "true"); document.body.classList.toggle("fpanel-open", window.innerWidth <= 960); fills(); }
  function closePanel() { panel.hidden = true; toggle.setAttribute("aria-expanded", "false"); document.body.classList.remove("fpanel-open"); }
  toggle.addEventListener("click", () => (isOpen() ? closePanel() : openPanel()));
  panel.addEventListener("click", (e) => {
    if (e.target.closest("#fClose") || e.target.closest("#fView")) { closePanel(); return; }
    if (e.target.closest("#fReset")) { reset(); return; }
    const sh = e.target.closest("[data-shape]");
    if (sh) { const v = sh.dataset.shape; state.shape.has(v) ? state.shape.delete(v) : state.shape.add(v); sh.classList.toggle("on"); sh.setAttribute("aria-pressed", state.shape.has(v)); apply(); }
  });
  panel.addEventListener("change", (e) => {
    const el = e.target;
    if (el.dataset.group) { state[el.dataset.group][el.checked ? "add" : "delete"](el.value); apply(); }
  });
  panel.addEventListener("input", (e) => {
    const el = e.target;
    if (el.type !== "range") return;
    const r = el.closest(".range"); const [a, b] = $$("input", r); const key = r.dataset.range;
    let lo = +a.value, hi = +b.value;
    if (lo > hi) { if (el === a) { hi = lo; b.value = hi; } else { lo = hi; a.value = lo; } }
    state[key] = [lo, hi];
    if (key === "price") { $("#priceLo").textContent = money(lo); $("#priceHi").textContent = money(hi); } else { $("#caratLo").textContent = lo + " ct"; $("#caratHi").textContent = hi + " ct"; }
    fills();
    clearTimeout(apply._t); apply._t = setTimeout(apply, 120);
  });
  document.addEventListener("click", (e) => { if (isOpen() && !panel.contains(e.target) && !toggle.contains(e.target) && !e.target.closest("#applied")) closePanel(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && isOpen()) closePanel(); });
  $("#applied").addEventListener("click", (e) => {
    const c = e.target.closest(".achip");
    if (c) {
      const g = c.dataset.group, v = c.dataset.value;
      if (g === "carat") state.carat = [1, 5]; else if (g === "price") state.price = [PMIN, PMAX]; else state[g].delete(v);
      panel.innerHTML = panelHTML(); apply(); return;
    }
    if (e.target.closest("#aReset")) reset();
  });
  function reset() {
    ["shape", "cls", "origin", "karat", "style"].forEach((k) => state[k].clear());
    state.carat = [1, 5]; state.price = [PMIN, PMAX];
    panel.innerHTML = panelHTML(); apply();
  }
  $("#sort").addEventListener("change", apply);
  PR.onGold(() => { window.JW.resetPrices(); apply(); });

  apply();
  if (activeCount() && window.innerWidth > 960) openPanel();
};
if (!window.PREVIEW) window.JW.pages.shop();

/* ------------------------------------------------------------------
   Shared site behaviour: header + mega menu, footer, shopping bag,
   search, product cards and small helpers. Loaded on every page.
------------------------------------------------------------------- */
(function () {
  const S = window.SITE;
  const CATALOG = window.CATALOG || [];
  const IMAGES = window.IMAGES || {};

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const esc = (s) =>
    String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const money = (n) => "$" + Math.round(n).toLocaleString("en-US");
  const ctw = (n) => Number(n).toFixed(2);
  const grams = (n) => Number(n).toFixed(1) + " g";
  const getProduct = (id) => CATALOG.find((p) => p.id === id);
  // Which page we are on (file name without .html) and its ?query values.
  const initialRoute = {
    page: (location.pathname.split("/").pop() || "index.html").replace(/\.html$/, "") || "index",
    params: new URLSearchParams(location.search),
  };
  const imagesFor = (id) => IMAGES[id] || [];

  /* ---------- Financing estimate (driven by js/config.js) ---------- */
  function monthly(price, months, apr) {
    const F = S.financing;
    months = months || F.exampleTermMonths;
    apr = apr == null ? F.exampleApr : apr;
    if (!apr) return price / months;
    const r = apr / 100 / 12;
    return (price * r) / (1 - Math.pow(1 + r, -months));
  }
  const finLine = (price) => `From ${money(Math.ceil(monthly(price)))}/mo*`;

  /* ---------- Category definitions (menus, shop page, chips) ---------- */
  const CATS = {
    engagement: {
      title: "Engagement Rings",
      intro: "Solitaires, halos and three-stone rings in every diamond shape. Each ring is made to order in our shop, in your size.",
      chips: [["Round", "round"], ["Oval", "oval"], ["Emerald", "emerald"], ["Cushion", "cushion"], ["Princess", "princess"], ["Pear", "pear"], ["Radiant", "radiant"], ["Marquise", "marquise"]],
    },
    wedding: {
      title: "Wedding Bands",
      intro: "Gold bands, diamond eternity rings and men's bands. We can shape a band to fit your engagement ring.",
      chips: [["For Her", "her"], ["For Him", "him"], ["Eternity", "eternity"], ["Diamond", "diamond"], ["Classic Gold", "plain"]],
    },
    womens: {
      title: "Women's Jewelry",
      intro: "Rings, necklaces, earrings and bracelets in gold, diamonds and colored stones.",
      chips: [["Rings", "ring"], ["Necklaces", "necklace"], ["Earrings", "earrings"], ["Bracelets", "bracelet"], ["Gemstones", "gemstone"]],
    },
    mens: {
      title: "Men's Jewelry",
      intro: "Solid gold chains, rings, pendants and bracelets. Every link is solid, not hollow.",
      chips: [["Rings", "ring"], ["Chains", "chain"], ["Pendants", "pendant"], ["Bracelets", "bracelet"], ["Earrings", "earrings"]],
    },
    watches: {
      title: "Watches",
      intro: "Gold and diamond watches. All diamond setting is done in our shop.",
      chips: [["Men's", "him"], ["Women's", "her"], ["Diamond", "diamond"], ["Solid Gold", "solid-gold"]],
    },
    gifts: {
      title: "Gifts",
      intro: "Popular gifts for anniversaries, birthdays and graduations.",
      chips: [["For Her", "her"], ["For Him", "him"], ["Anniversary", "anniversary"]],
      filter: (p) => p.tags.includes("gift") || p.tags.includes("anniversary"),
    },
    sale: {
      title: "Sale",
      intro: "Reduced prices on selected pieces, while they last.",
      chips: [["For Her", "her"], ["For Him", "him"]],
      filter: (p) => !!p.was,
    },
    all: { title: "All Jewelry", intro: "Everything we currently offer.", chips: [], filter: () => true },
  };
  const inCat = (p, cat) => (CATS[cat] && CATS[cat].filter ? CATS[cat].filter(p) : p.cat === cat);
  const shopUrl = (cat, tag, extra) => `shop.html?cat=${cat}${tag ? "&tag=" + tag : ""}${extra || ""}`;

  const NAV = [
    {
      label: "Engagement", cat: "engagement", feature: "eng-oval-hidden-halo",
      cols: [
        { title: "Shop by Shape", links: [["Round", "round"], ["Oval", "oval"], ["Emerald", "emerald"], ["Cushion", "cushion"], ["Princess", "princess"], ["Pear", "pear"], ["Radiant", "radiant"], ["Marquise", "marquise"]] },
        { title: "Shop by Style", links: [["Solitaire", "solitaire"], ["Halo", "halo"], ["Three-Stone & Two-Stone", "three-stone"], ["Pavé Band", "pave"]] },
        { title: "Services", raw: [["All Engagement Rings", shopUrl("engagement")], ["Design Your Own Ring", "custom.html"], ["Financing", "financing.html"], ["Book an Appointment", "visit.html"]] },
      ],
      promo: { title: "Design your own ring", text: "Bring a stone, a photo or a sketch and we will make the ring.", href: "custom.html", cta: "Start a design" },
    },
    {
      label: "Wedding", cat: "wedding", feature: "wed-eternity-round",
      cols: [
        { title: "For Her", links: [["Women's Bands", "her"], ["Eternity Bands", "eternity"], ["Diamond Bands", "diamond"]] },
        { title: "For Him", links: [["Men's Bands", "him"], ["Classic Gold Bands", "plain"]] },
        { title: "Services", raw: [["All Wedding Bands", shopUrl("wedding")], ["Custom Matching Bands", "custom.html"], ["Anniversary Gifts", shopUrl("gifts", "anniversary")]] },
      ],
      promo: { title: "Matching bands", text: "We can shape a band to fit your engagement ring.", href: "custom.html", cta: "Custom design" },
    },
    {
      label: "Women's", cat: "womens", feature: "wom-tennis-bracelet",
      cols: [
        { title: "Shop by Category", links: [["Rings", "ring"], ["Necklaces & Pendants", "necklace"], ["Earrings", "earrings"], ["Bracelets", "bracelet"]] },
        { title: "Featured", links: [["Tennis Collection", "tennis"], ["Gemstones", "gemstone"], ["Gifts for Her", "gift"]] },
        { title: "More", raw: [["All Women's Jewelry", shopUrl("womens")], ["Women's Watches", shopUrl("watches", "her")], ["Women's Sale", shopUrl("sale", "her")]] },
      ],
      promo: { title: "Diamond tennis bracelet", text: "5.00 ctw in 14K yellow gold.", href: "product.html?id=wom-tennis-bracelet", cta: "Shop now" },
    },
    {
      label: "Men's", cat: "mens", feature: "men-sovereign-signet",
      cols: [
        { title: "Shop by Category", links: [["Rings", "ring"], ["Chains", "chain"], ["Pendants", "pendant"], ["Bracelets", "bracelet"], ["Earrings", "earrings"]] },
        { title: "Featured", links: [["Signature Pieces", "signature"], ["Diamond Tennis", "tennis"], ["Gifts for Him", "gift"]] },
        { title: "More", raw: [["All Men's Jewelry", shopUrl("mens")], ["Men's Wedding Bands", shopUrl("wedding", "him")], ["Men's Watches", shopUrl("watches", "him")]] },
      ],
      promo: { title: "The Sovereign signet ring", text: "5.20 ctw in 18.5 g of 14K gold.", href: "product.html?id=men-sovereign-signet", cta: "Shop now" },
    },
    {
      label: "Watches", cat: "watches", feature: "wat-meridian-41-diamond",
      cols: [
        { title: "Shop Watches", links: [["Men's Watches", "him"], ["Women's Watches", "her"]] },
        { title: "Featured", links: [["Diamond Watches", "diamond"], ["Solid Gold", "solid-gold"]] },
        { title: "Services", raw: [["All Watches", shopUrl("watches")], ["Custom Diamond Setting", "custom.html"], ["Financing", "financing.html"]] },
      ],
      promo: { title: "Custom diamond setting", text: "Bezels, dials and bracelets set in our shop.", href: "custom.html", cta: "Customize a watch" },
    },
    {
      label: "Gifts", cat: "gifts", feature: "wom-diamond-studs",
      cols: [
        { title: "Shop by Recipient", links: [["Gifts for Her", "her"], ["Gifts for Him", "him"], ["Anniversary", "anniversary"]] },
        { title: "Shop by Price", raw: [["Under $1,000", shopUrl("gifts", "", "&max=1000")], ["Under $2,500", shopUrl("gifts", "", "&max=2500")], ["Under $5,000", shopUrl("gifts", "", "&max=5000")]] },
        { title: "More", raw: [["All Gifts", shopUrl("gifts")], ["Custom & Engraved Gifts", "custom.html"], ["Sale", shopUrl("sale")]] },
      ],
      promo: { title: "Diamond stud earrings", text: "1.00 ctw in 14K yellow gold.", href: "product.html?id=wom-diamond-studs", cta: "Shop now" },
    },
    { label: "Sale", cat: "sale", sale: true },
  ];

  /* ---------- Line-art placeholders, shown until a piece has an image ---------- */
  const ART = {
    ring: '<circle cx="60" cy="74" r="29"/><circle cx="60" cy="74" r="24"/><path d="M47 33h26l8 9-21 19-21-19z"/><path d="M39 42h42M53 33l7 28 7-28M47 33l6 9 7-9 7 9 6-9"/>',
    band: '<circle cx="60" cy="60" r="34"/><circle cx="60" cy="60" r="26"/><path d="M36 36q24-14 48 0" opacity=".5"/>',
    necklace: '<path d="M24 22q36 82 72 0"/><path d="M28 22q32 72 64 0" opacity=".45"/><path d="M60 64l7 9-7 13-7-13z"/>',
    pendant: '<path d="M26 18q34 62 68 0"/><circle cx="60" cy="52" r="3"/><path d="M60 55l11 13-11 22-11-22z"/><path d="M49 68h22" />',
    chain: '<path d="M22 20q38 96 76 0" stroke-width="5" stroke-dasharray="7 4"/><path d="M22 20q38 96 76 0" stroke="#0a0a09" stroke-width="2.4" stroke-dasharray="7 4"/>',
    earrings: '<circle cx="40" cy="34" r="7"/><path d="M40 41v9"/><path d="M40 50q-12 18 0 30 12-12 0-30z"/><circle cx="80" cy="34" r="7"/><path d="M80 41v9"/><path d="M80 50q-12 18 0 30 12-12 0-30z"/>',
    bracelet: '<ellipse cx="60" cy="60" rx="40" ry="26" stroke-width="6" stroke-dasharray="1 8.2"/><ellipse cx="60" cy="60" rx="45" ry="31" opacity=".45"/><ellipse cx="60" cy="60" rx="35" ry="21" opacity=".45"/>',
    watch: '<path d="M46 34l3-22h22l3 22M46 86l3 22h22l3-22"/><circle cx="60" cy="60" r="27"/><circle cx="60" cy="60" r="21"/><path d="M60 46v14l9 6M87 56h4v8h-4"/>',
  };
  const placeholder = (type) => `<div class="ph" aria-hidden="true"><svg viewBox="0 0 120 120">${ART[type] || ART.ring}</svg></div>`;

  function mediaHTML(p, opts = {}) {
    const imgs = imagesFor(p.id);
    if (!imgs.length) return placeholder(p.type);
    const first = `<img src="${imgs[0]}" alt="${esc(p.name)}" ${opts.eager ? "" : 'loading="lazy"'}>`;
    const second = opts.hover && imgs[1] ? `<img class="alt" src="${imgs[1]}" alt="" loading="lazy">` : "";
    return first + second;
  }

  function specLine(p) {
    const parts = [p.metal];
    if (p.dia) parts.push(`${ctw(p.dia.ctw)} ctw`);
    else if (p.goldG) parts.push(grams(p.goldG));
    return parts.join(" · ");
  }

  function productCard(p) {
    const badge = p.was
      ? `<span class="badge badge--sale">Save ${money(p.was - p.price)}</span>`
      : p.badge ? `<span class="badge">${esc(p.badge)}</span>` : "";
    const price = p.was
      ? `<span class="now-sale">${money(p.price)}</span><s>${money(p.was)}</s>`
      : `<span>${money(p.price)}</span>`;
    return `<a class="card" href="product.html?id=${p.id}">
      <div class="card-media">${badge}${mediaHTML(p, { hover: true })}</div>
      <div class="card-body">
        <div class="card-name">${esc(p.name)}</div>
        <div class="card-spec">${esc(specLine(p))}</div>
        <div class="card-price">${price}</div>
        <div class="card-fin">${finLine(p.price)}</div>
      </div>
    </a>`;
  }

  /* ---------- Shopping bag (saved in the browser) ---------- */
  const BAG_KEY = "jw_bag_v1";
  const Bag = {
    items: (() => {
      try { return JSON.parse(localStorage.getItem(BAG_KEY)) || []; } catch (e) { return []; }
    })(),
    save() {
      try { localStorage.setItem(BAG_KEY, JSON.stringify(this.items)); } catch (e) { /* private mode */ }
      renderBag();
    },
    add(id, opts = "") {
      const line = this.items.find((l) => l.id === id && l.opts === opts);
      if (line) line.qty += 1;
      else this.items.push({ id, opts, qty: 1 });
      this.save();
    },
    lines() { return this.items.map((l) => ({ ...l, p: getProduct(l.id) })).filter((l) => l.p); },
    count() { return this.lines().reduce((n, l) => n + l.qty, 0); },
    total() { return this.lines().reduce((n, l) => n + l.qty * l.p.price, 0); },
  };

  function renderBag() {
    const body = $("#bagBody");
    if (!body) return;
    const lines = Bag.lines();
    const count = Bag.count();
    const badge = $("#bagCount");
    badge.textContent = count;
    badge.hidden = !count;
    if (!lines.length) {
      body.innerHTML = `<div class="bag-empty"><p>Your bag is empty.</p><a class="link-arrow" href="${shopUrl("all")}">Shop all jewelry</a></div>`;
      $("#bagFoot").hidden = true;
      return;
    }
    body.innerHTML = lines
      .map((l, i) => `<div class="bag-line">
          <a class="thumb" href="product.html?id=${l.p.id}">${mediaHTML(l.p)}</a>
          <div>
            <h4><a href="product.html?id=${l.p.id}">${esc(l.p.name)}</a></h4>
            <div class="meta">${esc(/Gold/.test(l.opts) ? l.opts : [l.p.metal, l.opts].filter(Boolean).join(" · "))}</div>
            <div class="qty"><button data-bag="dec" data-i="${i}" aria-label="Decrease quantity">–</button><span>${l.qty}</span><button data-bag="inc" data-i="${i}" aria-label="Increase quantity">+</button></div>
            <button class="remove" data-bag="rm" data-i="${i}">Remove</button>
          </div>
          <div class="price">${money(l.p.price * l.qty)}</div>
        </div>`)
      .join("");
    const total = Bag.total();
    const mail = [
      `Hello ${S.brand},`, "", "I would like to purchase the following:", "",
      ...lines.map((l) => `- ${l.p.name} (${l.p.sku})${l.opts ? ", " + l.opts : ""}, qty ${l.qty}: ${money(l.p.price * l.qty)}`),
      "", `Subtotal: ${money(total)}`, "", "Name:", "Phone:", "I am interested in financing: yes / no",
    ].join("\n");
    $("#bagFoot").hidden = false;
    $("#bagFoot").innerHTML = `
      <div class="bag-total"><span>Subtotal</span><strong>${money(total)}</strong></div>
      <div class="bag-fin">or ${finLine(total).toLowerCase()} with financing. <a class="text-link" href="financing.html">Details</a></div>
      <a class="btn btn--gold btn--block" href="mailto:${esc(S.contact.email)}?subject=${encodeURIComponent("Purchase request")}&body=${encodeURIComponent(mail)}">Request to purchase</a>
      <p class="bag-note">Online checkout is not open yet. Send us your bag and a jeweler will confirm sizing, timing and payment. You can also call ${esc(S.contact.phone)}.</p>`;
  }

  function toast(msg) {
    let t = $(".toast");
    if (!t) { t = document.createElement("div"); t.className = "toast"; t.setAttribute("role", "status"); document.body.appendChild(t); }
    t.textContent = msg;
    requestAnimationFrame(() => t.classList.add("is-on"));
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.classList.remove("is-on"), 2400);
  }

  /* ---------- Header, drawers, footer ---------- */
  const ICON = {
    search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l5 5"/></svg>',
    bag: '<svg viewBox="0 0 24 24"><path d="M5 8h14l-1 12H6L5 8z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></svg>',
    menu: '<svg viewBox="0 0 24 24"><path d="M3 7h18M3 12h18M3 17h18"/></svg>',
  };

  function megaHTML(item) {
    if (!item.cols) return "";
    const cols = item.cols
      .map((c) => {
        const links = c.raw
          ? c.raw.map(([l, h]) => `<li><a href="${h}">${l}</a></li>`)
          : c.links.map(([l, t]) => `<li><a href="${shopUrl(item.cat, t)}">${l}</a></li>`);
        return `<div><h4>${c.title}</h4><ul>${links.join("")}</ul></div>`;
      })
      .join("");
    const fp = getProduct(item.feature);
    const promo = item.promo
      ? `<a class="mega-feature" href="${item.promo.href}">
          <div class="thumb">${fp ? mediaHTML(fp) : ""}</div>
          <div><h5>${item.promo.title}</h5><p>${item.promo.text}</p><span class="link-arrow">${item.promo.cta}</span></div>
        </a>`
      : "";
    return `<div class="mega"><div class="wrap mega-inner">${cols}${promo}</div></div>`;
  }

  function renderChrome() {
    const header = document.createElement("div");
    header.innerHTML = `
      <div class="announce"><div class="wrap">
        <span><a href="financing.html">Financing available on every piece</a></span>
        <span>Made in our own shop</span>
        <span><a href="custom.html">Custom design</a></span>
      </div></div>
      <header class="site-header">
        <div class="wrap header-top">
          <div class="header-left">
            <button class="icon-btn menu-toggle" id="menuOpen" aria-label="Open menu">${ICON.menu}</button>
            <a class="header-link" href="custom.html">Custom Design</a>
            <a class="header-link" href="financing.html">Financing</a>
          </div>
          <a class="logo" href="index.html" aria-label="${esc(S.brand)} home">
            <span class="logo-name">${esc(S.brand)}</span>
            <span class="logo-tag">${esc(S.tagline)}</span>
          </a>
          <div class="header-right">
            <a class="header-link" href="visit.html">Visit Us</a>
            <button class="icon-btn" id="searchOpen" aria-label="Search">${ICON.search}</button>
            <button class="icon-btn" id="bagOpen" aria-label="Open shopping bag">${ICON.bag}<span class="bag-count" id="bagCount" hidden>0</span></button>
          </div>
        </div>
        <nav class="main-nav" aria-label="Main"><div class="wrap"><ul>
          ${NAV.map((n) => `<li class="nav-item${n.sale ? " nav-item--sale" : ""}" data-cat="${n.cat}">
              <a href="${shopUrl(n.cat)}">${n.label}</a>${megaHTML(n)}
            </li>`).join("")}
        </ul></div></nav>
      </header>

      <div class="scrim" id="scrim"></div>

      <aside class="drawer drawer--left" id="menuDrawer" aria-label="Menu">
        <div class="drawer-head"><h3>Menu</h3><button class="close-btn" data-close aria-label="Close">×</button></div>
        <div class="drawer-body mobile-nav">
          ${NAV.map((n) => n.cols
            ? `<details><summary>${n.label}</summary><div class="sub">
                <a href="${shopUrl(n.cat)}">Shop all ${n.label}</a>
                ${n.cols.flatMap((c) => c.raw ? c.raw.filter(([, h]) => h !== shopUrl(n.cat)).map(([l, h]) => `<a href="${h}">${l}</a>`) : c.links.map(([l, t]) => `<a href="${shopUrl(n.cat, t)}">${l}</a>`)).join("")}
              </div></details>`
            : `<a class="plain sale" href="${shopUrl(n.cat)}">${n.label}</a>`).join("")}
          <a class="plain" href="custom.html">Custom Design</a>
          <a class="plain" href="financing.html">Financing</a>
          <a class="plain" href="visit.html">Visit Us</a>
        </div>
      </aside>

      <aside class="drawer drawer--right" id="bagDrawer" aria-label="Shopping bag">
        <div class="drawer-head"><h3>Your Bag</h3><button class="close-btn" data-close aria-label="Close">×</button></div>
        <div class="drawer-body" id="bagBody"></div>
        <div class="drawer-foot" id="bagFoot" hidden></div>
      </aside>

      <div class="search-panel" id="searchPanel" role="dialog" aria-label="Search">
        <div class="wrap">
          <form class="search-row" id="searchForm" action="shop.html">
            <input type="hidden" name="cat" value="all">
            <input type="search" name="q" id="searchInput" placeholder="Search rings, chains, watches" autocomplete="off" aria-label="Search">
            <button type="button" class="close-btn" data-close aria-label="Close search">×</button>
          </form>
          <div class="search-results" id="searchResults"></div>
        </div>
      </div>`;
    document.body.prepend(...header.childNodes);

    const F = S.financing;
    const footer = document.createElement("footer");
    footer.className = "site-footer";
    footer.innerHTML = `<div class="wrap">
      <div class="footer-grid">
        <div class="footer-brand">
          <a class="logo" href="index.html"><span class="logo-name">${esc(S.brand)}</span></a>
          <p>We design, cast and set jewelry in our own shop.</p>
        </div>
        <div><h4>Shop</h4><ul>
          ${NAV.map((n) => `<li><a href="${shopUrl(n.cat)}">${n.label}</a></li>`).join("")}
        </ul></div>
        <div><h4>Services</h4><ul>
          <li><a href="custom.html">Custom Design</a></li>
          <li><a href="financing.html">Financing</a></li>
          <li><a href="visit.html">Book an appointment</a></li>
          <li><a href="visit.html#services">Sizing and repairs</a></li>
        </ul></div>
        <div><h4>Visit</h4><ul>
          <li><a href="visit.html">${esc(S.contact.addressLine1)}<br>${esc(S.contact.addressLine2)}</a></li>
          <li><a href="tel:${esc(S.contact.phone.replace(/[^\d+]/g, ""))}">${esc(S.contact.phone)}</a></li>
          <li><a href="mailto:${esc(S.contact.email)}">${esc(S.contact.email)}</a></li>
        </ul></div>
        <div class="footer-news">
          <h4>Email list</h4>
          <p class="muted" style="font-size:14px;margin-bottom:10px">New pieces and sale notices.</p>
          <form class="newsletter" id="newsForm"><input type="email" placeholder="Email address" aria-label="Email address" required><button>Join</button></form>
          <div class="footer-note" id="newsNote" role="status"></div>
        </div>
      </div>
      <div class="footer-bottom">
        <p>© ${new Date().getFullYear()} ${esc(S.brand)}. ${esc(S.imageNote)}</p>
        <p>*${esc(F.disclosure)}</p>
      </div>
    </div>`;
    document.body.appendChild(footer);
  }

  function markCurrent() {
    const { page, params } = JW.route;
    let cat = page === "shop" ? params.get("cat") : null;
    if (page === "product") { const p = getProduct(params.get("id")); cat = p && p.cat; }
    $$(".nav-item").forEach((li) => li.classList.toggle("is-current", !!cat && li.dataset.cat === cat));
  }

  function wireChrome() {
    const scrim = $("#scrim");
    // looked up when used: the filters panel is re-created on each shop view in the preview build
    const panels = { menu: "#menuDrawer", bag: "#bagDrawer", search: "#searchPanel", filters: "#filters" };
    const closeAll = () => {
      Object.values(panels).forEach((sel) => { const el = $(sel); if (el) el.classList.remove("is-open"); });
      scrim.classList.remove("is-open");
      document.body.classList.remove("no-scroll");
    };
    const open = (name) => {
      closeAll();
      const el = $(panels[name]);
      if (!el) return;
      el.classList.add("is-open");
      scrim.classList.add("is-open");
      document.body.classList.add("no-scroll");
      if (name === "search") setTimeout(() => $("#searchInput").focus(), 60);
    };
    $("#menuOpen").addEventListener("click", () => open("menu"));
    $("#bagOpen").addEventListener("click", () => open("bag"));
    $("#searchOpen").addEventListener("click", () => open("search"));
    scrim.addEventListener("click", closeAll);
    document.addEventListener("keydown", (e) => e.key === "Escape" && closeAll());
    document.addEventListener("click", (e) => {
      if (e.target.closest("[data-close]")) closeAll();
      const b = e.target.closest("[data-bag]");
      if (b) {
        const i = +b.dataset.i;
        const line = Bag.items[i];
        if (!line) return;
        if (b.dataset.bag === "inc") line.qty += 1;
        if (b.dataset.bag === "dec") line.qty -= 1;
        if (b.dataset.bag === "rm" || line.qty < 1) Bag.items.splice(i, 1);
        Bag.save();
      }
    });

    const results = $("#searchResults");
    $("#searchInput").addEventListener("input", (e) => {
      const hits = search(e.target.value).slice(0, 8);
      results.innerHTML = e.target.value.trim().length < 2 ? "" : hits.length
        ? hits.map((p) => `<a class="search-hit" href="product.html?id=${p.id}"><div class="thumb">${mediaHTML(p)}</div><div><b>${esc(p.name)}</b><span>${money(p.price)} · ${esc(specLine(p))}</span></div></a>`).join("")
        : `<p class="muted">No matches. <a class="text-link" href="custom.html">Ask us to make it</a>.</p>`;
    });

    $("#newsForm").addEventListener("submit", (e) => {
      e.preventDefault();
      $("#newsNote").textContent = "Thanks. The list opens at launch.";
      e.target.reset();
    });

    JW.openBag = () => open("bag");
    JW.openFilters = () => open("filters");
    JW.closePanels = closeAll;
  }

  function search(q) {
    const terms = q.toLowerCase().trim().split(/\s+/).filter(Boolean);
    if (!terms.length) return [];
    return CATALOG.filter((p) => {
      const hay = [p.name, p.metal, p.cat, p.type, p.sku, p.tags.join(" "), p.dia ? p.dia.shape + " diamond" : "", p.gem ? p.gem.name : ""].join(" ").toLowerCase();
      return terms.every((t) => hay.includes(t));
    });
  }

  /* Fill brand / contact / financing tokens written in the page HTML */
  function fillTokens(root = document) {
    const C = S.contact, F = S.financing;
    const text = { brand: S.brand, phone: C.phone, email: C.email, address1: C.addressLine1, address2: C.addressLine2, "fin-provider": F.provider, "fin-disclosure": F.disclosure, "fin-term": F.exampleTermMonths, "image-note": S.imageNote };
    Object.entries(text).forEach(([k, v]) => $$(`[data-${k}]`, root).forEach((el) => (el.textContent = v)));
    $$("[data-tel]", root).forEach((el) => (el.href = "tel:" + C.phone.replace(/[^\d+]/g, "")));
    $$("[data-mailto]", root).forEach((el) => (el.href = "mailto:" + C.email));
    $$("[data-fin-apply]", root).forEach((el) => (el.href = F.applyUrl));
    if (!F.isPlaceholder) $$("[data-fin-flag]", root).forEach((el) => el.remove());
    $$("[data-hours]", root).forEach((el) => (el.innerHTML = C.hours.map(([d, h]) => `<tr><td>${esc(d)}</td><td>${esc(h)}</td></tr>`).join("")));
    $$("[data-product-img]", root).forEach((el) => {
      const p = getProduct(el.dataset.productImg);
      if (p) el.innerHTML = mediaHTML(p, { eager: true }) + el.innerHTML;
    });
    $$("[data-grid]", root).forEach((el) => {
      const [kind, n] = el.dataset.grid.split(":");
      let list = kind === "featured" ? CATALOG.filter((p) => p.featured) : CATALOG.filter((p) => inCat(p, kind));
      // pieces that already have a photo lead the row
      list = list.slice().sort((a, b) => (imagesFor(b.id).length ? 1 : 0) - (imagesFor(a.id).length ? 1 : 0));
      el.innerHTML = list.slice(0, +n || 4).map(productCard).join("");
    });
    document.title = document.title.replace("{brand}", S.brand);
  }

  const JW = (window.JW = {
    $, $$, esc, money, ctw, grams, monthly, finLine, getProduct, imagesFor, mediaHTML, placeholder,
    specLine, productCard, CATS, inCat, shopUrl, Bag, toast, search,
    route: initialRoute, pages: {}, fillTokens, markCurrent,
  });

  renderChrome();
  wireChrome();
  renderBag();
  fillTokens();
  markCurrent();
})();

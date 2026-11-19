/* Product detail page (product.html?id=…)
   Prices are computed live by js/pricing.js from the chosen gold purity, size,
   diamond selection and center carat, at the day's gold price. */
window.JW.pages.product = function () {
  const { $, $$, esc, money, grams, monthly, getProduct, imagesFor, placeholder, productCard, CATS, shopUrl, Bag, toast } = window.JW;
  const S = window.SITE;
  const F = S.financing;
  const PR = window.JW_PRICE;
  const p = getProduct(window.JW.route.params.get("id"));
  const root = $("#pdp");

  if (!p) {
    root.style.display = "block";
    root.innerHTML = `<div class="empty" style="margin:40px 0"><h3>That piece was not found.</h3><p>It may no longer be available. We can make a similar piece to order.</p><p style="margin-top:22px"><a class="btn" href="shop.html?cat=all">Shop all jewelry</a></p></div>`;
    $("#relatedSection").remove();
    return;
  }

  const cat = CATS[p.cat];
  const imgs = imagesFor(p.id);
  const params = window.JW.route.params;
  document.title = `${p.name} | ${S.brand}`;
  $("#crumbs").innerHTML = `<a href="index.html">Home</a><span>/</span><a href="${shopUrl(p.cat)}">${esc(cat.title)}</a><span>/</span>${esc(p.name)}`;

  /* ----- The chosen configuration (a link can preset it: ?karat=18K&dia=Natural%20Select&ct=2) ----- */
  const choice = PR.defaults(p);
  if (PR.KARATS.includes(params.get("karat"))) choice.karat = params.get("karat");
  if (p.diamonds.includes(params.get("dia"))) choice.diamond = params.get("dia");
  if (p.carats && p.carats.includes(+params.get("ct"))) choice.carat = +params.get("ct");
  if (p.sizes && p.sizes.options[params.get("size")] != null) choice.size = params.get("size");
  let color = "Yellow";

  const ringSizes = [];
  for (let r = 4; r <= 13; r += 0.5) ringSizes.push(r);
  const DIA = PR.DIAMONDS;
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
  /* A sibling design in the same department with another center-stone shape, nearest in style */
  const STYLE_WORDS = ["solitaire", "halo", "three-stone", "bezel", "cathedral", "split", "twist", "bypass", "vintage", "east-west", "signet", "pave"];
  const myStyles = p.tags.filter((t) => STYLE_WORDS.includes(t));
  const sibling = (shape) => {
    const same = window.CATALOG.filter((x) => x.cat === p.cat && x.carats && x.shape === shape && x.id !== p.id);
    return same.sort((x, y) => y.tags.filter((t) => myStyles.includes(t)).length - x.tags.filter((t) => myStyles.includes(t)).length)[0] || null;
  };
  let engraving = "";

  const tile = (group, value, label, sub, on, extra = "") => `<button type="button" class="tile${on ? " on" : ""}" data-opt="${group}" data-value="${esc(String(value))}" aria-pressed="${on}"${extra}><b>${label}</b>${sub ? `<small>${esc(sub)}</small>` : ""}</button>`;
  function pickersHTML() {
    const groups = [];
    groups.push(`<div class="opt" data-group="color"><h3>Gold color <span>${esc(color)} gold</span></h3><div class="swatches">${["Yellow", "White", "Rose"].map((c) => `<button type="button" class="swatch-btn swatch-btn--${c.toLowerCase()}${c === color ? " on" : ""}" data-opt="color" data-value="${c}" aria-label="${c} gold" aria-pressed="${c === color}"></button>`).join("")}</div></div>`);
    groups.push(`<div class="opt" data-group="karat"><h3>Gold purity <span>${esc(choice.karat)}</span></h3><div class="tiles tiles--3">${PR.KARATS.map((k) => tile("karat", k, k, k === "10K" ? "Most durable" : k === "14K" ? "Most popular" : "Richest color", k === choice.karat)).join("")}</div></div>`);
    if (p.carats) {
      groups.push(`<div class="opt" data-group="shape"><h3>Shape <span>${esc(p.shape)}</span></h3><div class="shapes-row">${SHAPES.map((sh) => {
        const on = sh === p.shape; const sib = on ? null : sibling(sh);
        if (!on && !sib) return "";
        return `<a class="shape-tile${on ? " on" : ""}" href="${on ? "#" : `product.html?id=${sib.id}&karat=${choice.karat}&dia=${encodeURIComponent(choice.diamond)}&ct=${choice.carat}`}" title="${on ? esc(sh) : esc(sib.name)}" aria-current="${on}"><svg viewBox="0 0 32 32" aria-hidden="true">${SHAPE_ICON[sh]}</svg><span>${sh}</span></a>`;
      }).join("")}</div><p class="opt-note">Other shapes open the closest design in that shape, with your choices kept.</p></div>`);
    }
    if (p.diamonds.length) {
      const d = DIA[choice.diamond];
      groups.push(`<div class="opt" data-group="diamond"><h3>Diamonds <span>${esc(choice.diamond)}, ${d.origin === "Lab" ? "lab-grown" : "natural"}</span></h3><div class="tiles tiles--dia">${p.diamonds.map((n) => tile("diamond", n, `${esc(n.replace(/^(Lab|Natural) /, ""))}`, (DIA[n].origin === "Lab" ? "Lab-grown · " : "Natural · ") + DIA[n].target.replace(/^(IGI|GIA) target /, "").replace(" color", "").replace(" clarity", "").replace(", eye-clean", ""), n === choice.diamond)).join("")}</div></div>`);
    }
    if (p.carats) groups.push(`<div class="opt" data-group="carat"><h3>Center carat <span>${choice.carat} ct</span></h3><div class="tiles tiles--5">${p.carats.map((c) => tile("carat", c, `${c}`, "", c === choice.carat)).join("")}</div></div>`);
    if (p.sizes) groups.push(`<div class="opt" data-group="size"><h3>${esc(p.sizes.label)} <span>${esc(choice.size)}</span></h3><div class="tiles tiles--3">${Object.keys(p.sizes.options).map((sz) => tile("size", sz, esc(sz), "", sz === choice.size)).join("")}</div></div>`);
    if (p.ringSize) groups.push(`<div class="opt opt--row"><label for="optSize"><h3>Ring size</h3></label><select class="select" id="optSize"><option value="">Select</option>${ringSizes.map((r) => `<option>${r}</option>`).join("")}<option value="Size to be confirmed">Not sure yet</option></select><a class="text-link size-guide" href="education.html#sizing">Find your ring size</a></div>`);
    groups.push(`<div class="opt opt--engrave"><button type="button" class="engrave-toggle" id="engraveToggle" aria-expanded="${engraving ? "true" : "false"}"><span>+</span> Add engraving <small>complimentary</small></button><div class="engrave-field"${engraving ? "" : " hidden"}><input type="text" id="engraving" maxlength="24" placeholder="Up to 24 characters" value="${esc(engraving)}"><small class="field-note">Inside the band, in our script. Shown on your request before we engrave.</small></div></div>`);
    return groups.join("");
  }

  const ICONS = ['<svg viewBox="0 0 32 32"><circle cx="16" cy="19" r="8"/><path d="M12 11l4-6 4 6M12 11h8"/></svg>', '<svg viewBox="0 0 32 32"><path d="M6 12l5-6h10l5 6-10 14z"/><path d="M6 12h20M11 6l5 20 5-20"/></svg>', '<svg viewBox="0 0 32 32"><path d="M16 4v24M4 16h24M8 8l16 16M24 8L8 24"/><circle cx="16" cy="16" r="3"/></svg>'];

  root.innerHTML = `
    <div class="gallery">
      <div class="thumbs" id="thumbs">${imgs.length > 1 ? imgs.map((src, i) => `<button class="${i ? "" : "is-active"}" data-i="${i}" aria-label="View image ${i + 1}"><img src="${src}" alt=""></button>`).join("") : ""}</div>
      <div class="stage" id="stage">${imgs.length ? `<img src="${imgs[0]}" alt="${esc(p.name)}">` : placeholder(p.type) + `<div class="stage-note">Photography in production</div>`}</div>
    </div>

    <div class="pdp-info">
      <div class="pdp-cat"><a href="${shopUrl(p.cat)}">${esc(cat.title)}</a></div>
      <h1>${esc(p.name)}</h1>
      <div class="pdp-sku" id="vsku"></div>
      <div class="pdp-price"><span id="price"></span></div>
      <div class="pdp-fin"><span id="fin"></span> <a class="text-link" href="financing.html">Details</a></div>
      <p class="pdp-blurb">${esc(p.blurb)}</p>

      <div class="keyspecs" id="keyspecs"></div>

      <div class="options options--pickers" id="pickers">${pickersHTML()}</div>
      <p class="pdp-gold" id="goldLine"></p>
      <div class="pdp-actions">
        <button class="btn btn--gold btn--block" id="addToBag">Add to bag</button>
        <a class="btn btn--block" href="custom.html?piece=${p.id}">Customize this piece</a>
      </div>

      <p class="pdp-links"><a class="text-link" href="visit.html#appointment">Book an appointment</a><span>·</span><a class="text-link" href="custom.html?piece=${p.id}">Concierge service</a></p>

      <ul class="pdp-assure">
        <li>Made to order in our workshop. Final weight, dimensions and fit are confirmed before we start.</li>
        <li>${p.diamonds.length ? "Diamond grades are targets; you receive the report for the stone actually set." : "Solid gold throughout; white gold is rhodium finished."}</li>
        <li>Questions? Call <a class="text-link" href="tel:${esc(S.contact.phone.replace(/[^\d+]/g, ""))}">${esc(S.contact.phone)}</a></li>
      </ul>

      <div class="specs" style="margin-top:26px">
        <details class="acc">
          <summary>Details</summary>
          <div class="acc-body acc-body--specs">
            <p>${esc(p.desc)}</p>
            <table class="spec-table"><tbody id="specRows"></tbody></table>
            <p class="fine" style="margin-top:14px">${esc(S.imageNote)}</p>
          </div>
        </details>
        <details class="acc">
          <summary>Financing</summary>
          <div class="acc-body">
            <p>This piece can be financed through ${esc(F.provider)}. Example plans for the configuration shown:</p>
            <table class="spec-table"><tbody id="finRows"></tbody></table>
            <p class="fine" style="margin-top:12px">*${esc(F.disclosure)}</p>
          </div>
        </details>
        <details class="acc">
          <summary>Sizing and changes</summary>
          <div class="acc-body"><p>${p.ringSize ? "Prices are for a US size 7; most sizes cost the same, and we quote large differences before starting. " : ""}Other lengths, widths, gold colors or stone qualities are made to order. ${p.carats ? "Center stones between the listed carat weights are quoted on request. " : ""}Changes can affect the gold weight, diamond weight and price; we confirm all three in writing first.</p><p><a class="text-link" href="custom.html?piece=${p.id}">Ask about changes</a></p></div>
        </details>
        <details class="acc">
          <summary>Care and service</summary>
          <div class="acc-body"><p>Bring your piece in for cleaning and a check of the settings. Sizing, polishing and repairs are done in our shop.</p></div>
        </details>
      </div>
    </div>`;

  /* ----- Recompute everything that depends on the configuration or the gold price ----- */
  let q;
  function update() {
    q = PR.quote(p, choice);
    const metal = `${q.karat} ${color} Gold`;
    $("#price").textContent = money(q.price);
    $("#fin").textContent = `or from ${money(Math.ceil(monthly(q.price)))}/mo* with financing.`;
    $("#vsku").textContent = `Item ${q.sku}`;
    $("#goldLine").textContent = `${PR.goldLine()}. Prices follow the gold market and are confirmed when you order.`;

    const key = [[grams(q.goldG), "Gold weight (est.)"]];
    if (p.carats) key.push([`${q.carat} ct ${p.shape}`, "Center diamond"]);
    else if (p.accentCtw) key.push([`${p.accentCtw.toFixed(2)} ctw`, "Diamonds"]);
    else key.push([`${p.widthMm} mm`, "Width"]);
    key.push([metal.replace(" Gold", ""), "Gold"]);
    $("#keyspecs").innerHTML = key.map(([v, l], i) => `<div>${ICONS[i]}<b>${esc(v)}</b><span>${esc(l)}</span></div>`).join("");

    const dia = q.diamond ? DIA[q.diamond] : null;
    const rows = [["Metal", metal], ["Gold weight (est.)", grams(q.goldG), true], ["Width", `${p.widthMm} mm`]];
    if (p.carats) {
      rows.push(["Center diamond", `${q.carat} ct ${p.shape}`, true]);
      rows.push(["Diamond selection", `${q.diamond}: ${dia.origin === "Lab" ? "lab-grown" : "natural"}, ${dia.target}`]);
      if (p.accentCtw) rows.push(["Accent diamonds", `about ${p.accentCtw.toFixed(2)} ctw, round, matched to the center`]);
      rows.push(["Certification", dia.origin === "Lab" ? "IGI report (or current equivalent) for the center stone" : "GIA report for the center stone"]);
    } else if (p.accentCtw) {
      rows.push(["Diamonds", `about ${p.accentCtw.toFixed(2)} ctw ${dia ? (dia.origin === "Lab" ? "lab-grown" : "natural") : ""}, ${dia ? dia.target : ""}`, true]);
    }
    rows.push([p.type === "chain" || p.type === "bracelet" ? "Links" : "Setting", p.setting]);
    if (q.size) rows.push([p.sizes.label, q.size]);
    if (p.ringSize) rows.push(["Reference ring size", "US 7; your size is set at order"]);
    if (p.clasp) rows.push(["Clasp", p.clasp]);
    rows.push(["Finish", p.finish]);
    rows.push(["Item number", q.sku]);
    rows.push(["Price basis", `${PR.goldLine()}; made to order, confirmed before manufacture`]);
    $("#specRows").innerHTML = rows.map(([k, v, hl]) => `<tr${hl ? ' class="hl"' : ""}><th scope="row">${esc(k)}</th><td>${esc(v)}</td></tr>`).join("");
    $("#finRows").innerHTML = F.plans.map((pl) => `<tr><th scope="row">${esc(pl.label)}</th><td>about ${money(Math.ceil(monthly(q.price, pl.months)))}/mo* · ${esc(pl.note)}</td></tr>`).join("");
  }
  update();
  PR.onGold(update);

  /* Picking an option re-draws the pickers (so the headings show the choice) and re-prices */
  function repaint() {
    const size = $("#optSize") ? $("#optSize").value : "";
    const focusId = document.activeElement && document.activeElement.id;
    $("#pickers").innerHTML = pickersHTML();
    if ($("#optSize")) $("#optSize").value = size;
    if (focusId && $("#" + focusId)) $("#" + focusId).focus();
    update();
  }
  root.addEventListener("click", (e) => {
    const b = e.target.closest("[data-opt]");
    if (b) {
      const g = b.dataset.opt, v = b.dataset.value;
      if (g === "color") color = v;
      else if (g === "karat") choice.karat = v;
      else if (g === "diamond") choice.diamond = v;
      else if (g === "carat") choice.carat = +v;
      else if (g === "size") choice.size = v;
      repaint();
      return;
    }
    if (e.target.closest("#engraveToggle")) {
      const f = $(".engrave-field"); f.hidden = !f.hidden;
      $("#engraveToggle").setAttribute("aria-expanded", String(!f.hidden));
      if (!f.hidden) $("#engraving").focus();
    }
    if (e.target.closest(".shape-tile[aria-current=\"true\"]")) e.preventDefault();
  });
  root.addEventListener("input", (e) => { if (e.target.id === "engraving") engraving = e.target.value.trim(); });

  /* ----- Gallery ----- */
  $("#thumbs").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    $$("#thumbs button").forEach((x) => x.classList.toggle("is-active", x === b));
    $("#stage img").src = imgs[+b.dataset.i];
  });
  if (imgs.length < 2) { $(".gallery").style.gridTemplateColumns = "1fr"; $("#thumbs").remove(); }

  /* ----- Add to bag ----- */
  $("#addToBag").addEventListener("click", () => {
    const size = $("#optSize");
    if (size && !size.value) { size.focus(); toast("Please select a ring size"); return; }
    const parts = [`${q.karat} ${color} Gold`];
    if (q.diamond) parts.push(q.diamond + (q.carat ? ` ${q.carat} ct` : ""));
    if (q.size) parts.push(q.size);
    if (size) parts.push(/^\d/.test(size.value) ? "Size " + size.value : size.value);
    if (engraving) parts.push(`Engraved “${engraving}”`);
    Bag.add(p.id, parts.join(" · "), q.price, q.sku);
    window.JW.openBag();
  });

  /* ----- Related ----- */
  const related = window.CATALOG.filter((x) => x.cat === p.cat && x.id !== p.id)
    .sort((a, b) => (b.cls === p.cls) - (a.cls === p.cls) || imagesFor(b.id).length - imagesFor(a.id).length)
    .slice(0, 4);
  $("#related").innerHTML = related.map(productCard).join("");
  $("#relatedLink").href = shopUrl(p.cat);
  $("#relatedLink").textContent = `All ${cat.title}`;
};
if (!window.PREVIEW) window.JW.pages.product();

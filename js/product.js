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
  for (let s = 4; s <= 13; s += 0.5) ringSizes.push(s);
  const opt = (v, label, sel) => `<option value="${esc(String(v))}"${sel ? " selected" : ""}>${esc(label)}</option>`;
  const DIA = PR.DIAMONDS;

  const fields = [];
  fields.push(`<div class="field"><label for="optKarat">Gold</label><select class="select" id="optKarat">${PR.KARATS.map((k) => opt(k, `${k} solid gold`, k === choice.karat)).join("")}</select></div>`);
  fields.push(`<div class="field"><label for="optColor">Gold color</label><select class="select" id="optColor">${["Yellow", "White", "Rose"].map((c) => opt(c, `${c} gold`, c === color)).join("")}</select></div>`);
  if (p.diamonds.length) fields.push(`<div class="field field--wide"><label for="optDiamond">Diamonds</label><select class="select" id="optDiamond">${p.diamonds.map((d) => opt(d, `${d} · ${DIA[d].origin === "Lab" ? "lab-grown" : "natural"}`, d === choice.diamond)).join("")}</select><small class="field-note" id="diaNote"></small></div>`);
  if (p.carats) fields.push(`<div class="field"><label for="optCarat">Center diamond</label><select class="select" id="optCarat">${p.carats.map((c) => opt(c, `${c} carat${c > 1 ? "s" : ""}`, c === choice.carat)).join("")}</select></div>`);
  if (p.sizes) fields.push(`<div class="field"><label for="optLength">${esc(p.sizes.label)}</label><select class="select" id="optLength">${Object.keys(p.sizes.options).map((s) => opt(s, s, s === choice.size)).join("")}</select></div>`);
  if (p.ringSize) fields.push(`<div class="field"><label for="optSize">Ring size <a class="size-guide" href="education.html#sizing">Size guide</a></label><select class="select" id="optSize"><option value="">Select size</option>${ringSizes.map((s) => opt(s, s, false)).join("")}<option value="Size to be confirmed">Not sure, help me size</option></select></div>`);

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

      <div class="options">${fields.join("")}</div>
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
    if ($("#diaNote")) $("#diaNote").textContent = dia ? dia.target : "";
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

  root.addEventListener("change", (e) => {
    const el = e.target;
    if (el.id === "optKarat") choice.karat = el.value;
    else if (el.id === "optColor") color = el.value;
    else if (el.id === "optDiamond") choice.diamond = el.value;
    else if (el.id === "optCarat") choice.carat = +el.value;
    else if (el.id === "optLength") choice.size = el.value;
    else return;
    update();
  });

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

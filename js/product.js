/* Product detail page (product.html?id=…) */
window.JW.pages.product = function () {
  const { $, $$, esc, money, ctw, grams, monthly, getProduct, imagesFor, placeholder, productCard, CATS, shopUrl, Bag, toast } = window.JW;
  const S = window.SITE;
  const F = S.financing;
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
  const isRing = p.type === "ring" || p.type === "band";
  const isWatch = p.type === "watch";
  document.title = `${p.name} | ${S.brand}`;
  $("#crumbs").innerHTML = `<a href="index.html">Home</a><span>/</span><a href="${shopUrl(p.cat)}">${esc(cat.title)}</a><span>/</span>${esc(p.name)}`;

  /* ----- Spec table: gold weight, diamond weight and every other detail ----- */
  const D = S.diamondDefaults;
  const rows = [["Metal", p.metal]];
  if (p.goldG) rows.push(["Gold weight (approx.)", grams(p.goldG), true]);
  if (p.dia) {
    rows.push(["Total diamond weight", `${ctw(p.dia.ctw)} ctw`, true]);
    rows.push(["Diamond count", `${p.dia.count.toLocaleString("en-US")} stone${p.dia.count === 1 ? "" : "s"}`]);
    rows.push(["Diamond shape", p.dia.shape]);
    rows.push(["Diamond color", p.dia.color || D.color]);
    rows.push(["Diamond clarity", p.dia.clarity || D.clarity]);
    rows.push(["Diamond origin", p.dia.origin || D.origin]);
  }
  if (p.gem) {
    rows.push(["Gemstone", p.gem.name]);
    if (p.gem.ct) rows.push(["Gemstone weight", `${ctw(p.gem.ct)} ct`, true]);
    rows.push(["Gemstone shape", p.gem.shape]);
  }
  Object.entries(p.specs || {}).forEach(([k, v]) => rows.push([k, v]));
  rows.push(["Item number", p.sku]);

  const key = [];
  if (p.goldG) key.push([grams(p.goldG), "Gold weight"]);
  if (p.dia) key.push([`${ctw(p.dia.ctw)} ctw`, "Diamond weight"]);
  if (p.gem && p.gem.ct) key.push([`${ctw(p.gem.ct)} ct`, p.gem.name.replace(/^Natural /, "")]);
  key.push([p.metal.replace(" Gold", "").replace(" & Steel", " + Steel"), "Gold"]);
  const extra = p.specs && (p.specs.Length || p.specs["Case size"] || p.specs["Band width"]);
  if (key.length < 3 && extra) key.push([extra.replace(/ \(.*/, ""), p.specs.Length ? "Length" : p.specs["Case size"] ? "Case size" : "Band width"]);

  /* ----- Options ----- */
  const sizes = [];
  const [lo, hi] = p.tags.includes("him") ? [7, 14] : [4, 10];
  for (let s = lo; s <= hi; s += 0.5) sizes.push(s);
  const base = (p.metal.match(/\d+K/) || [""])[0];
  const sizeField = isRing
    ? `<div class="field"><label for="optSize">Ring size</label>
        <select class="select" id="optSize"><option value="">Select size</option>${sizes.map((s) => `<option>${s}</option>`).join("")}<option value="Size to be confirmed">Not sure, help me size</option></select></div>`
    : "";
  const colorField = !isWatch
    ? `<div class="field"><label for="optMetal">Gold color</label>
        <select class="select" id="optMetal"><option value="">As shown (${esc(p.metal)})</option>${["Yellow", "White", "Rose"]
          .filter((c) => !p.metal.includes(c))
          .map((c) => `<option value="${base} ${c} Gold">${base} ${c} Gold (made to order)</option>`)
          .join("")}</select></div>`
    : "";

  const price = p.was
    ? `<span class="now-sale">${money(p.price)}</span><s>${money(p.was)}</s><span class="save">Save ${money(p.was - p.price)}</span>`
    : `<span>${money(p.price)}</span>`;
  const m = Math.ceil(monthly(p.price));

  root.innerHTML = `
    <div class="gallery">
      <div class="thumbs" id="thumbs">${imgs.length > 1 ? imgs.map((src, i) => `<button class="${i ? "" : "is-active"}" data-i="${i}" aria-label="View image ${i + 1}"><img src="${src}" alt=""></button>`).join("") : ""}</div>
      <div class="stage" id="stage">${imgs.length ? `<img src="${imgs[0]}" alt="${esc(p.name)}">` : placeholder(p.type) + `<div class="stage-note">Image in production</div>`}</div>
    </div>

    <div class="pdp-info">
      <div class="pdp-cat"><a href="${shopUrl(p.cat)}">${esc(cat.title)}</a></div>
      <h1>${esc(p.name)}</h1>
      <div class="pdp-sku">Item ${esc(p.sku)}</div>
      <div class="pdp-price">${price}</div>
      <div class="pdp-fin">or from ${money(m)}/mo* with financing. <a class="text-link" href="financing.html">Details</a></div>
      <p class="pdp-blurb">${esc(p.blurb)}</p>

      <div class="keyspecs" style="grid-template-columns:repeat(${Math.min(key.length, 3)},1fr)">
        ${key.slice(0, 3).map(([v, l]) => `<div><b>${esc(v)}</b><span>${esc(l)}</span></div>`).join("")}
      </div>

      ${sizeField || colorField ? `<div class="options">${sizeField}${colorField}</div>` : ""}
      <div class="pdp-actions">
        <button class="btn btn--gold btn--block" id="addToBag">Add to bag</button>
        <a class="btn btn--block" href="custom.html?piece=${p.id}">Customize this piece</a>
      </div>

      <ul class="pdp-assure">
        <li>Made to order in our shop.</li>
        <li>Available in other sizes, gold colors and stone options on request.</li>
        <li>Questions? Call <a class="text-link" href="tel:${esc(S.contact.phone.replace(/[^\d+]/g, ""))}">${esc(S.contact.phone)}</a></li>
      </ul>

      <div class="specs">
        <h2>Details</h2>
        <table class="spec-table"><tbody>
          ${rows.map(([k, v, hl]) => `<tr${hl ? ' class="hl"' : ""}><th scope="row">${esc(k)}</th><td>${esc(v)}</td></tr>`).join("")}
        </tbody></table>
        <p class="fine" style="margin-top:14px">${esc(S.imageNote)}</p>
      </div>

      <div style="margin-top:26px">
        <details class="acc">
          <summary>Financing</summary>
          <div class="acc-body">
            <p>This piece can be financed through ${esc(F.provider)}. Example plans:</p>
            <table class="spec-table"><tbody>
              ${F.plans.map((pl) => `<tr><th scope="row">${esc(pl.label)}</th><td>about ${money(Math.ceil(monthly(p.price, pl.months)))}/mo* · ${esc(pl.note)}</td></tr>`).join("")}
            </tbody></table>
            <p class="fine" style="margin-top:12px">*${esc(F.disclosure)}</p>
          </div>
        </details>
        <details class="acc">
          <summary>Sizing and changes</summary>
          <div class="acc-body"><p>We can make this piece in a different ${isRing ? "ring size, " : isWatch ? "dial, " : "length, "}gold color, karat or stone quality. Changes can affect the gold weight, diamond weight and price. We confirm all three in writing before we start.</p><p><a class="text-link" href="custom.html?piece=${p.id}">Ask about changes</a></p></div>
        </details>
        <details class="acc">
          <summary>Care and service</summary>
          <div class="acc-body"><p>Bring your piece in for cleaning and a check of the settings. Sizing, polishing and repairs are done in our shop.</p></div>
        </details>
      </div>
    </div>`;

  /* ----- Gallery ----- */
  $("#thumbs").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    $$("#thumbs button").forEach((x) => x.classList.toggle("is-active", x === b));
    $("#stage img").src = imgs[+b.dataset.i];
  });
  if (imgs.length < 2) $(".gallery").style.gridTemplateColumns = "1fr";
  if (imgs.length < 2) $("#thumbs").remove();

  /* ----- Add to bag ----- */
  $("#addToBag").addEventListener("click", () => {
    const size = $("#optSize");
    if (size && !size.value) {
      size.focus();
      toast("Please select a ring size");
      return;
    }
    const opts = [size && (/^\d/.test(size.value) ? "Size " + size.value : size.value), $("#optMetal") && $("#optMetal").value].filter(Boolean).join(" · ");
    Bag.add(p.id, opts);
    window.JW.openBag();
  });

  /* ----- Related ----- */
  const related = window.CATALOG.filter((x) => x.cat === p.cat && x.id !== p.id)
    .sort((a, b) => (b.type === p.type) - (a.type === p.type) || imagesFor(b.id).length - imagesFor(a.id).length)
    .slice(0, 4);
  $("#related").innerHTML = related.map(productCard).join("");
  $("#relatedLink").href = shopUrl(p.cat);
  $("#relatedLink").textContent = `All ${cat.title}`;
};
if (!window.PREVIEW) window.JW.pages.product();

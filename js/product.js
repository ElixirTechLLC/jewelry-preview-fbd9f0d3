/* Product detail page (product.html?id=…) */
window.JW.pages.product = function () {
  const { $, $$, esc, money, ctw, grams, monthly, getProduct, imagesFor, placeholder, productCard, CATS, shopUrl, Bag, toast } = window.JW;
  const S = window.SITE;
  const F = S.financing;
  const p = getProduct(window.JW.route.params.get("id"));
  const root = $("#pdp");

  if (!p) {
    root.style.display = "block";
    root.innerHTML = `<div class="empty" style="margin:40px 0"><h3>We could not find that piece.</h3><p>It may have sold — but we can always make another.</p><p style="margin-top:22px"><a class="btn" href="shop.html?cat=all">Browse the Collection</a></p></div>`;
    $("#relatedSection").remove();
    return;
  }

  const cat = CATS[p.cat];
  const imgs = imagesFor(p.id);
  const isRing = p.type === "ring" || p.type === "band";
  const isWatch = p.type === "watch";
  document.title = `${p.name} — ${S.brand}`;
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
        <select class="select" id="optSize"><option value="">Select size</option>${sizes.map((s) => `<option>${s}</option>`).join("")}<option value="Size to be confirmed">Not sure — help me size</option></select></div>`
    : "";
  const colorField = !isWatch
    ? `<div class="field"><label for="optMetal">Gold color</label>
        <select class="select" id="optMetal"><option value="">As shown — ${esc(p.metal)}</option>${["Yellow", "White", "Rose"]
          .filter((c) => !p.metal.includes(c))
          .map((c) => `<option value="${base} ${c} Gold">${base} ${c} Gold (made to order)</option>`)
          .join("")}</select></div>`
    : "";

  const price = p.was
    ? `<span class="gold-text">${money(p.price)}</span><s>${money(p.was)}</s><span class="save">Save ${money(p.was - p.price)}</span>`
    : `<span>${money(p.price)}</span>`;
  const m = Math.ceil(monthly(p.price));

  root.innerHTML = `
    <div class="gallery">
      <div class="thumbs" id="thumbs">${imgs.length > 1 ? imgs.map((src, i) => `<button class="${i ? "" : "is-active"}" data-i="${i}" aria-label="View image ${i + 1}"><img src="${src}" alt=""></button>`).join("") : ""}</div>
      <div class="stage" id="stage">${imgs.length ? `<img src="${imgs[0]}" alt="${esc(p.name)}">` : placeholder(p.type) + `<div class="stage-note">Image in production</div>`}</div>
    </div>

    <div class="pdp-info">
      <span class="eyebrow">${esc(cat.title)}${p.badge ? " · " + esc(p.badge) : ""}</span>
      <h1>${esc(p.name)}</h1>
      <div class="pdp-sku">Item ${esc(p.sku)} · Made to order in our shop</div>
      <div class="pdp-price">${price}</div>
      <p class="pdp-blurb">${esc(p.blurb)}</p>

      <div class="keyspecs" style="grid-template-columns:repeat(${Math.min(key.length, 3)},1fr)">
        ${key.slice(0, 3).map(([v, l]) => `<div><b>${esc(v)}</b><span>${esc(l)}</span></div>`).join("")}
      </div>

      <div class="fin-box">
        <div>
          ${F.isPlaceholder ? '<span class="ph-flag">Placeholder terms</span><br>' : ""}
          <b>From ${money(m)}/mo*</b>
          <p>Example: ${F.exampleTermMonths} monthly payments with ${esc(F.provider)}. Financing is available on this piece.</p>
        </div>
        <a class="link-arrow" href="financing.html">How it works</a>
      </div>

      ${sizeField || colorField ? `<div class="options">${sizeField}${colorField}</div>` : ""}
      <div class="pdp-actions">
        <button class="btn btn--gold btn--block" id="addToBag">Add to Bag</button>
        <a class="btn btn--block" href="custom.html?piece=${p.id}">Customize This Piece</a>
      </div>

      <ul class="pdp-assure">
        <li>Designed, cast and hand-set in our own shop</li>
        <li>Gold weight and diamond weight documented with every piece</li>
        <li>Any size, gold color or stone — just ask</li>
        <li>Questions? Call <a class="gold-text" href="tel:${esc(S.contact.phone.replace(/[^\d+]/g, ""))}">&nbsp;${esc(S.contact.phone)}</a></li>
      </ul>

      <div class="specs">
        <h2>Piece Details</h2>
        <table class="spec-table"><tbody>
          ${rows.map(([k, v, hl]) => `<tr${hl ? ' class="hl"' : ""}><th scope="row">${esc(k)}</th><td>${esc(v)}</td></tr>`).join("")}
        </tbody></table>
        <p class="fine" style="margin-top:14px">${esc(S.imageNote)}</p>
      </div>

      <div style="margin-top:26px">
        <details class="acc">
          <summary>Financing</summary>
          <div class="acc-body">
            ${F.isPlaceholder ? '<span class="ph-flag">Placeholder — final terms at launch</span>' : ""}
            <p>This piece can be financed through ${esc(F.provider)}. Example plans:</p>
            <table class="spec-table"><tbody>
              ${F.plans.map((pl) => `<tr><th scope="row">${esc(pl.label)}</th><td>about ${money(Math.ceil(monthly(p.price, pl.months)))}/mo* · ${esc(pl.note)}</td></tr>`).join("")}
            </tbody></table>
            <p class="fine" style="margin-top:12px">*${esc(F.disclosure)}</p>
          </div>
        </details>
        <details class="acc">
          <summary>Made to Order &amp; Sizing</summary>
          <div class="acc-body"><p>Every piece is made in our shop, so it can be made your way: a different ${isRing ? "ring size, " : isWatch ? "dial, " : "length, "}gold color, karat or stone quality. Changes may alter the final gold weight, diamond weight and price — we confirm everything in writing before work begins.</p><p><a class="link-arrow" href="custom.html?piece=${p.id}">Ask about changes</a></p></div>
        </details>
        <details class="acc">
          <summary>Care &amp; Service</summary>
          <div class="acc-body"><p>Bring your piece to the shop any time for cleaning and a setting check. Sizing, polishing and repairs are done on site by the same jewelers who made it.</p></div>
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

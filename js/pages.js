/* Behaviour for the Financing, Custom Design and Visit pages. */
(function () {
  const JW = window.JW;
  const { $, $$, money, monthly, esc, getProduct } = JW;
  const S = window.SITE;

  JW.pages.financing = function () {
    const F = S.financing;
    const sample = 5000;
    $("#planPrice").textContent = money(sample);
    $("#plans").innerHTML = F.plans
      .map((p) => `<div class="plan"><b>${p.months}</b><span>months</span><p>${esc(p.note)}</p><div class="est">about ${money(Math.ceil(monthly(sample, p.months)))}/mo*</div></div>`)
      .join("");

    let term = F.exampleTermMonths;
    const amount = $("#estAmount");
    $("#estTerms").innerHTML = F.plans.map((p) => `<button class="pill" data-m="${p.months}">${esc(p.label)}</button>`).join("");
    function update() {
      $("#estAmountLabel").textContent = money(+amount.value);
      $("#estMonthly").textContent = money(Math.ceil(monthly(+amount.value, term)));
      $$("#estTerms .pill").forEach((b) => b.classList.toggle("is-active", +b.dataset.m === term));
    }
    amount.addEventListener("input", update);
    $("#estTerms").addEventListener("click", (e) => {
      const b = e.target.closest(".pill");
      if (b) { term = +b.dataset.m; update(); }
    });
    update();
  };

  JW.pages.custom = function () {
    const piece = getProduct(JW.route.params.get("piece"));
    if (piece) {
      $("#cRef").value = `${piece.name} (${piece.sku})`;
      $("#cIdea").placeholder = `What would you like to change about ${piece.name}?`;
    }
    $("#customForm").addEventListener("submit", (e) => {
      e.preventDefault();
      if (window.PREVIEW) {
        // The shared preview cannot open an email app, so say what the live site will do.
        $("#customNote").textContent = `Preview only: on the live site this opens an email to ${S.contact.email} with these answers filled in.`;
        return;
      }
      const v = (id) => $("#" + id).value.trim();
      const body = [
        `Name: ${v("cName")}`, `Phone: ${v("cPhone")}`, `Piece: ${v("cType")}`, `Budget: ${v("cBudget")}`, `Gold: ${v("cMetal")}`,
        v("cRef") ? `Based on: ${v("cRef")}` : "", `Interested in financing: ${$("#cFin").checked ? "Yes" : "No"}`, "", v("cIdea"),
      ].filter((l, i) => l !== "" || i > 5).join("\n");
      location.href = `mailto:${S.contact.email}?subject=${encodeURIComponent("Custom design request — " + v("cType"))}&body=${encodeURIComponent(body)}`;
    });
  };

  JW.pages.visit = function () {
    $("#apptLink").href =
      "mailto:" + S.contact.email + "?subject=" + encodeURIComponent("Appointment request") +
      "&body=" + encodeURIComponent("Name:\nPhone:\nPreferred day and time:\nWhat I would like to see:\n");
  };

  // On the normal multi-page site, run the one that belongs to this page.
  const own = ["financing", "custom", "visit"];
  if (!window.PREVIEW && own.includes(JW.route.page)) JW.pages[JW.route.page]();
})();

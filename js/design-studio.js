/* Design studio on custom.html: sign in with an email, answer a few questions,
   generate a picture of the piece, submit it to the shop. Talks to the design API
   (SITE.designApi), which holds the OpenAI key and the visitor's designs. */
(function () {
  const { $, esc } = window.JW;
  const S = window.SITE;
  const root = $("#studioRoot");
  if (!root) return;

  // For local testing: custom.html?api=http://localhost:8787 (remembered in this browser)
  const param = new URLSearchParams(location.search).get("api");
  try { if (param) localStorage.setItem("jw_api", param); } catch (e) { /* ignore */ }
  let API = S.designApi;
  try { API = param || localStorage.getItem("jw_api") || S.designApi; } catch (e) { /* ignore */ }
  API = String(API || "").replace(/\/$/, "");

  if (!API) {
    root.innerHTML = `<div class="studio-note">The design studio opens with the site. Until then, use the form below and we will send you pictures.</div>`;
    return;
  }

  const KEY = "jw_studio";
  const state = { token: null, name: "", email: "", remaining: 0, limit: 5, designs: [], current: null, answers: {}, busy: false };
  try { Object.assign(state, JSON.parse(localStorage.getItem(KEY)) || {}); } catch (e) { /* ignore */ }
  const persist = () => { try { localStorage.setItem(KEY, JSON.stringify({ token: state.token, name: state.name, email: state.email, answers: state.answers })); } catch (e) { /* ignore */ } };

  async function api(path, opts = {}) {
    const headers = { "Content-Type": "application/json" };
    if (state.token) headers.Authorization = `Bearer ${state.token}`;
    let res;
    try {
      res = await fetch(`${API}/api/${path}`, { method: opts.method || (opts.body ? "POST" : "GET"), headers, body: opts.body ? JSON.stringify(opts.body) : undefined });
    } catch (e) {
      throw Object.assign(new Error("Could not reach the design service. Check your connection and try again."), { status: 0 });
    }
    let data = {};
    try { data = await res.json(); } catch (e) { /* no body */ }
    if (!res.ok) {
      if (res.status === 401) { state.token = null; persist(); render(); }
      throw Object.assign(new Error(data.error || "Something went wrong."), { status: res.status, data });
    }
    return data;
  }

  const OPTIONS = {
    type: ["Engagement ring", "Wedding band", "Fashion ring", "Signet ring", "Pendant", "Chain", "Bracelet", "Earrings"],
    karat: ["14K", "10K", "18K"],
    color: ["yellow gold", "white gold", "rose gold", "two-tone gold"],
    stone: ["diamond", "none", "emerald", "sapphire", "ruby", "black onyx"],
    shape: ["round", "oval", "emerald cut", "cushion", "princess", "pear", "marquise", "radiant"],
    carat: ["1 carat", "0.5 carat", "1.5 carat", "2 carat", "3 carat", "5 carat"],
    accents: ["none", "pavé diamonds on the band", "a diamond halo around the center stone", "diamond side stones", "channel-set diamonds", "pavé diamonds covering the whole piece"],
    style: ["classic", "vintage with milgrain detail", "modern and minimal", "bold statement"],
  };
  const LABELS = { type: "Type of piece", karat: "Gold", color: "Gold color", stone: "Center stone", shape: "Stone shape", carat: "Approximate size", accents: "Accent diamonds", style: "Style" };
  const select = (k) => `<div class="field"><label for="st_${k}">${LABELS[k]}</label><select class="select" id="st_${k}" data-k="${k}">${OPTIONS[k].map((o) => `<option${state.answers[k] === o ? " selected" : ""}>${esc(o)}</option>`).join("")}</select></div>`;

  function render() {
    if (!state.token) return renderSignin();
    const hasStone = (state.answers.stone || OPTIONS.stone[0]) !== "none";
    const cur = state.current;
    const out = state.remaining <= 0;
    root.innerHTML = `
      <div class="studio-form">
        <div class="studio-user">Designing as ${esc(state.name || state.email)} <button type="button" id="stOut">Use a different email</button></div>
        <div class="row">${select("type")}${select("style")}</div>
        <div class="row">${select("karat")}${select("color")}</div>
        <div class="row">${select("stone")}${hasStone ? select("shape") : `<div class="field"></div>`}</div>
        <div class="row">${hasStone ? select("carat") : `<div class="field"></div>`}${select("accents")}</div>
        <div class="field"><label for="st_width">Width or length (optional)</label><input type="text" id="st_width" data-k="width" placeholder="e.g. 2 mm band, or 8 mm chain, 22 inches" value="${esc(state.answers.width || "")}"></div>
        <div class="field"><label for="st_engraving">Engraving (optional)</label><input type="text" id="st_engraving" data-k="engraving" maxlength="60" value="${esc(state.answers.engraving || "")}"></div>
        <div class="field"><label for="st_notes">Anything else</label><textarea id="st_notes" data-k="notes" maxlength="400" placeholder="Describe the look you want, or a piece you have seen">${esc(state.answers.notes || "")}</textarea></div>
        <div class="studio-actions">
          <button class="btn btn--gold" id="stGo" ${out || state.busy ? "disabled" : ""}>${cur ? "Make another design" : "Show me my design"}</button>
          <span class="studio-count">${state.remaining} of ${state.limit} designs left</span>
        </div>
        <div class="studio-msg${state.err ? " err" : ""}" id="stMsg">${esc(state.msg || "")}</div>
        ${out ? `<div class="studio-note" style="margin-top:14px">You have used your ${state.limit} designs. Submit one you like below, or tell us what you are looking for and we will send you pictures. After a purchase, we reset your designs.</div>` : ""}
      </div>
      <div class="studio-stage">
        <div class="studio-image">
          ${cur ? `<img src="${esc(cur.url)}" alt="Your design">` : `<div class="empty">Your design appears here.<br>Choose the options and press the button.</div>`}
          ${state.busy ? `<div class="busy"><div class="spinner"></div><div>Designing your piece, about half a minute</div></div>` : ""}
        </div>
        ${cur ? `<div class="btns">
            <button class="btn btn--gold" id="stSubmit" ${cur.submitted ? "disabled" : ""}>${cur.submitted ? "Submitted to the shop" : "Submit this design for a quote"}</button>
          </div>` : ""}
        ${state.designs.length ? `<div class="studio-thumbs">${state.designs.map((d) => `<button type="button" data-id="${esc(d.id)}" class="${cur && cur.id === d.id ? "is-active" : ""}" title="${d.submitted ? "Submitted" : ""}"><img src="${esc(d.url)}" alt=""></button>`).join("")}</div>` : ""}
        <div id="stSub"></div>
        <p class="studio-msg" style="margin-top:14px"><button type="button" class="text-link" id="stReq" style="color:var(--muted)">Can't get what you want? Tell us and we will send you pictures.</button></p>
        <div id="stReqForm"></div>
      </div>`;

    root.querySelectorAll("[data-k]").forEach((el) => el.addEventListener("change", () => {
      state.answers[el.dataset.k] = el.value; persist();
      if (el.dataset.k === "stone") render();
    }));
    $("#stOut").addEventListener("click", () => { state.token = null; state.current = null; state.designs = []; persist(); render(); });
    $("#stGo").addEventListener("click", generate);
    root.querySelectorAll(".studio-thumbs button").forEach((b) => b.addEventListener("click", () => { state.current = state.designs.find((d) => d.id === b.dataset.id); render(); }));
    if ($("#stSubmit")) $("#stSubmit").addEventListener("click", () => showSubmit());
    $("#stReq").addEventListener("click", () => showRequest());
  }

  function renderSignin() {
    root.innerHTML = `
      <form class="studio-signin form" id="stSignin">
        <div class="field"><label for="si_name">Name</label><input type="text" id="si_name" autocomplete="name" value="${esc(state.name || "")}"></div>
        <div class="field"><label for="si_phone">Phone (optional)</label><input type="tel" id="si_phone" autocomplete="tel"></div>
        <div class="field full"><label for="si_email">Email</label><input type="email" id="si_email" required autocomplete="email" value="${esc(state.email || "")}"></div>
        <input type="text" name="website" id="si_hp" tabindex="-1" autocomplete="off" style="position:absolute;left:-9999px" aria-hidden="true">
        <div class="full studio-actions"><button class="btn btn--gold" type="submit">Start designing</button><span class="studio-count">Your email is used to save your designs and send you the quote.</span></div>
        <div class="full studio-msg err" id="siMsg"></div>
      </form>`;
    $("#stSignin").addEventListener("submit", async (e) => {
      e.preventDefault();
      const msg = $("#siMsg"); msg.textContent = "";
      const email = $("#si_email").value.trim(), name = $("#si_name").value.trim(), phone = $("#si_phone").value.trim();
      try {
        const r = await api("signin", { body: { email, name, phone, website: $("#si_hp").value } });
        if (r.needsCode) return renderCode(email, name);
        signedIn(r, email);
      } catch (err) { msg.textContent = err.message; }
    });
  }

  function renderCode(email, name) {
    root.innerHTML = `
      <form class="studio-signin form" id="stCode">
        <div class="field full"><label for="si_code">We emailed a 6-digit code to ${esc(email)}. Enter it here.</label><input type="text" id="si_code" inputmode="numeric" maxlength="6" required autocomplete="one-time-code"></div>
        <div class="full studio-actions"><button class="btn btn--gold" type="submit">Confirm</button><button class="btn" type="button" id="siBack">Use a different email</button></div>
        <div class="full studio-msg err" id="siMsg"></div>
      </form>`;
    $("#siBack").addEventListener("click", () => renderSignin());
    $("#stCode").addEventListener("submit", async (e) => {
      e.preventDefault();
      try { signedIn(await api("verify", { body: { email, code: $("#si_code").value.trim() } }), email); }
      catch (err) { $("#siMsg").textContent = err.message; }
    });
  }

  function signedIn(r, email) {
    Object.assign(state, { token: r.token, name: r.name, email, remaining: r.remaining, limit: r.limit, designs: r.designs || [], current: (r.designs || [])[0] || null, msg: "", err: false });
    persist(); render();
  }

  async function generate() {
    if (state.busy) return;
    root.querySelectorAll("[data-k]").forEach((el) => (state.answers[el.dataset.k] = el.value)); persist();
    state.busy = true; state.msg = ""; state.err = false; render();
    try {
      const r = await api("generate", { body: { answers: state.answers } });
      state.designs.unshift(r.design); state.current = r.design; state.remaining = r.remaining;
      state.msg = r.remaining > 0 ? `Design saved. ${r.remaining} left.` : "That was your last design.";
    } catch (err) {
      state.msg = err.message; state.err = true;
      if (err.data && err.data.limit) state.remaining = 0;
    }
    state.busy = false; render();
    if (window.innerWidth < 960) $(".studio-stage").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function showSubmit() {
    const cur = state.current; if (!cur) return;
    const isRing = /ring|band/i.test(state.answers.type || cur.answers?.type || "ring");
    $("#stSub").innerHTML = `
      <form class="studio-sub" id="stSubForm">
        <h3>Submit this design</h3>
        <div class="field"><label for="sb_size">${isRing ? "Ring size" : "Length or size"}</label><input type="text" id="sb_size" placeholder="${isRing ? "e.g. 7, or not sure" : "e.g. 20 inches, 7 inch wrist"}"></div>
        <div class="field"><label for="sb_budget">Budget</label><select class="select" id="sb_budget"><option>Not sure yet</option><option>Under $1,000</option><option>$1,000 – $2,500</option><option>$2,500 – $5,000</option><option>$5,000 – $10,000</option><option>$10,000 +</option></select></div>
        <div class="field"><label for="sb_phone">Phone (so we can call about the quote)</label><input type="tel" id="sb_phone" autocomplete="tel"></div>
        <div class="field"><label for="sb_notes">Notes for the jeweler (optional)</label><textarea id="sb_notes" maxlength="1500"></textarea></div>
        <div class="studio-actions"><button class="btn btn--gold" type="submit">Send to the shop</button><button class="btn" type="button" id="sbCancel">Cancel</button></div>
        <div class="studio-msg err" id="sbMsg"></div>
      </form>`;
    $("#sbCancel").addEventListener("click", () => ($("#stSub").innerHTML = ""));
    $("#stSubForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      try {
        await api("submit", { body: { designId: cur.id, size: $("#sb_size").value, budget: $("#sb_budget").value, phone: $("#sb_phone").value, notes: $("#sb_notes").value } });
        cur.submitted = true;
        render(); $("#stSub").innerHTML = `<div class="studio-done" style="margin-top:16px"><h3>Sent. Thank you.</h3><p class="muted" style="margin:0">A jeweler will get back to you at ${esc(state.email)} with a quote.</p></div>`;
      } catch (err) { $("#sbMsg").textContent = err.message; }
    });
  }

  function showRequest() {
    $("#stReqForm").innerHTML = `
      <form class="studio-sub" id="stReqF">
        <h3>Tell us what you are looking for</h3>
        <div class="field"><label for="rq_desc">Describe the piece, the look, and anything you have seen that is close</label><textarea id="rq_desc" required maxlength="1500"></textarea></div>
        <div class="field"><label for="rq_budget">Budget</label><select class="select" id="rq_budget"><option>Not sure yet</option><option>Under $1,000</option><option>$1,000 – $2,500</option><option>$2,500 – $5,000</option><option>$5,000 – $10,000</option><option>$10,000 +</option></select></div>
        <div class="studio-actions"><button class="btn btn--gold" type="submit">Send</button><button class="btn" type="button" id="rqCancel">Cancel</button></div>
        <div class="studio-msg err" id="rqMsg"></div>
      </form>`;
    $("#rqCancel").addEventListener("click", () => ($("#stReqForm").innerHTML = ""));
    $("#stReqF").addEventListener("submit", async (e) => {
      e.preventDefault();
      try {
        await api("submit", { body: { request: true, description: $("#rq_desc").value, budget: $("#rq_budget").value } });
        $("#stReqForm").innerHTML = `<div class="studio-done" style="margin-top:16px"><h3>Sent. Thank you.</h3><p class="muted" style="margin:0">We will email some pictures to ${esc(state.email)} based on what you described.</p></div>`;
      } catch (err) { $("#rqMsg").textContent = err.message; }
    });
  }

  // Returning visitor: refresh their designs and remaining count.
  if (state.token) {
    render();
    api("me").then((r) => { Object.assign(state, { name: r.name, email: r.email, remaining: r.remaining, limit: r.limit, designs: r.designs || [], current: (r.designs || [])[0] || null }); render(); }).catch(() => {});
  } else render();
})();

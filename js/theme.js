/* Picks the color scheme before the page paints (loaded in <head>).
   DEFAULT_THEME is what a first-time visitor sees: "dark" = hunter green,
   "light" = ivory. A link ending in ?theme=green or ?theme=ivory
   switches scheme and is remembered for that visitor. */
(function () {
  var DEFAULT_THEME = "dark";
  var KEY = "jw_theme";
  var names = { white: "light", light: "light", ivory: "light", cream: "light", black: "dark", dark: "dark", green: "dark", maison: "maison", piaget: "maison", avenue: "avenue", mix: "avenue" };
  var theme = DEFAULT_THEME;
  try {
    var asked = names[new URLSearchParams(location.search).get("theme")];
    if (asked) localStorage.setItem(KEY, asked);
    theme = asked || names[localStorage.getItem(KEY)] || DEFAULT_THEME;
  } catch (e) { /* storage blocked: use the default */ }
  document.documentElement.setAttribute("data-theme", theme);
  var page = (location.pathname.split("/").pop() || "index.html").replace(/\.html$/, "") || "index";
  document.documentElement.setAttribute("data-page", page);
  window.JW_THEME = {
    get: function () { return document.documentElement.getAttribute("data-theme"); },
    set: function (t) {
      t = names[t] || DEFAULT_THEME;
      document.documentElement.setAttribute("data-theme", t);
      try { localStorage.setItem(KEY, t); } catch (e) { /* ignore */ }
    },
  };
})();

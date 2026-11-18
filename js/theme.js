/* Sets two attributes on <html> before the page paints (loaded in <head>):
   data-theme="heritage" (the site's one look; the stylesheets key off it)
   and data-page (the file name, so pages can differ, e.g. ivory shopping pages). */
(function () {
  document.documentElement.setAttribute("data-theme", "heritage");
  var page = (location.pathname.split("/").pop() || "index.html").replace(/\.html$/, "") || "index";
  document.documentElement.setAttribute("data-page", page);
})();

// Adds ?v=<timestamp> to every local css/js link in the HTML pages so browsers
// fetch the new files after a deploy instead of using a cached copy.
// Run before committing a change to css/ or js/:  node scripts/stamp-assets.mjs
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
const v = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 12);
for (const f of readdirSync(".").filter((n) => n.endsWith(".html"))) {
  const before = readFileSync(f, "utf8");
  const after = before.replace(/(href|src)="((?:css|js)\/[\w./-]+?\.(?:css|js))(?:\?v=\d+)?"/g, `$1="$2?v=${v}"`);
  if (after !== before) { writeFileSync(f, after); console.log("stamped", f); }
}

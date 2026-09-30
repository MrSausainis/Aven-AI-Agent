import { copyFileSync, lstatSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const output = join(root, "dist");

// Only these reviewed public assets may reach Netlify's CDN. New pages/assets
// require an explicit addition; backend source and documentation are excluded.
const publicFiles = [
  "index.html", "account.html", "donate.html", "404.html",
  "privacy.html", "terms.html", "refunds.html", "cookies.html",
  "terms-2026-09-30.1.html", "privacy-2026-09-30.1.html",
  "terms-2026-10-01.1.html", "privacy-2026-10-01.1.html", "refunds-2026-10-01.1.html",
  "security.html", "accessibility.html",
  "site.css", "site.js", "account.js", "favicon.svg",
  "robots.txt", "sitemap.xml", "extensions_manifest.json",
  "_headers", ".well-known/security.txt",
];

// Validate before clearing the previous output; never follow source symlinks.
for (const relative of publicFiles) {
  const source = join(root, relative);
  if (!lstatSync(source).isFile()) throw new Error(`Public asset must be a regular file: ${relative}`);
  let parent = dirname(source);
  while (parent !== root.replace(/\/$/, "")) {
    if (!lstatSync(parent).isDirectory()) throw new Error(`Public asset directory must be real: ${relative}`);
    parent = dirname(parent);
  }
}

rmSync(output, { recursive: true, force: true });
for (const relative of publicFiles) {
  const destination = join(output, relative);
  mkdirSync(dirname(destination), { recursive: true });
  copyFileSync(join(root, relative), destination);
}
console.log(`Built ${publicFiles.length} public website files in dist/`);

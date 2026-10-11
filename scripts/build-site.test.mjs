import { test } from "node:test";
import assert from "node:assert/strict";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = fileURLToPath(new URL("../", import.meta.url));
const build = (directory) => spawnSync(process.execPath, [join(directory, "scripts/build-site.mjs")], { encoding: "utf8" });
const files = (directory) => readdirSync(directory, { recursive: true, withFileTypes: true })
  .filter((entry) => entry.isFile()).map((entry) => relative(directory, join(entry.parentPath, entry.name))).sort();
const put = (directory, file, content) => {
  mkdirSync(dirname(join(directory, file)), { recursive: true });
  writeFileSync(join(directory, file), content);
};

test("public build preserves assets/headers and excludes backend and unexpected files", () => {
  const built = build(root);
  assert.equal(built.status, 0, built.stderr);
  const output = join(root, "dist");
  const published = files(output);
  for (const required of ["index.html", "account.html", "account.js", "404.html", "_headers", ".well-known/security.txt", "extensions_manifest.json", "terms-2026-10-01.1.html", "privacy-2026-10-01.1.html", "refunds-2026-10-01.1.html"]) {
    assert.ok(published.includes(required), `Missing public entry point: ${required}`);
  }
  for (const file of published) {
    assert.deepEqual(readFileSync(join(output, file)), readFileSync(join(root, file)), `Asset altered: ${file}`);
  }
  // Check every local HTML asset/link against the output, including clean URLs.
  for (const file of published.filter((file) => file.endsWith(".html"))) {
    for (const [tag, src] of readFileSync(join(output, file), "utf8").matchAll(/<script\b[^>]*\bsrc="(https:\/\/[^\"]+)"[^>]*>/g)) {
      assert.equal(src, "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2/dist/umd/supabase.min.js", `${file}: external script must have a reviewed version and exact file path`);
      assert.ok(tag.includes('crossorigin="anonymous"'), `${file}: external SRI script requires CORS`);
      assert.ok(tag.includes('integrity="sha384-WgXwGL6fUsYJWNaKJgVbrJKGRQwc1vieh2oy4kw9nXqpNDz3tdSsqEYUgeHD/NuF"'), `${file}: external script lacks its reviewed content hash`);
    }
    for (const [, link] of readFileSync(join(output, file), "utf8").matchAll(/(?:href|src)="([^"#]+)"/g)) {
      const url = new URL(link, `https://site.invalid/${file}`);
      if (url.origin !== "https://site.invalid") continue;
      const target = decodeURIComponent(url.pathname.slice(1)) || "index.html";
      assert.ok(published.includes(target) || published.includes(`${target}.html`), `${file}: unpublished local link ${link}`);
    }
  }
  const fixture = mkdtempSync(join(tmpdir(), "website-publish-test-"));
  try {
    for (const file of [...published, "scripts/build-site.mjs"]) {
      mkdirSync(dirname(join(fixture, file)), { recursive: true });
      copyFileSync(join(root, file), join(fixture, file));
    }
    for (const unexpected of ["supabase/functions/private.ts", "supabase/migrations/private.sql", "internal-notes.md", "unexpected.html", "private-config.txt"]) {
      put(fixture, unexpected, "synthetic private marker");
    }
    assert.equal(build(fixture).status, 0);
    assert.deepEqual(files(join(fixture, "dist")), published, "Unexpected input reached the CDN output");
    // A symlink cannot smuggle a private file through an allowlisted asset.
    rmSync(join(fixture, "account.js"));
    symlinkSync(join(fixture, "private-config.txt"), join(fixture, "account.js"));
    assert.notEqual(build(fixture).status, 0, "Source symlink was followed");
    assert.deepEqual(readFileSync(join(fixture, "dist/account.js")), readFileSync(join(root, "account.js")), "Failed validation replaced safe output");
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

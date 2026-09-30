import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { verifyExtensionPackage } from "./verify-extension-package.mjs";

const bytes = Buffer.from("synthetic package bytes, never executable");
const entry = {
  id: "demo", version: "1.0.0",
  download_url: "https://github.com/MrSausainis/Aven-AI-Agent/releases/download/extensions/demo.zip",
  sha256: createHash("sha256").update(bytes).digest("hex"), package_size_bytes: bytes.length,
};
const manifest = { schema_version: 1, extensions: [entry] };

test("publishing verification reports the exact package identity without running code", () => {
  assert.deepEqual(verifyExtensionPackage(manifest, "demo", bytes),
    { id: "demo", version: "1.0.0", sha256: entry.sha256, size: bytes.length });
});
test("a same-size changed package and a truncated package both fail verification", () => {
  const tampered = Buffer.from(bytes); tampered[0] ^= 1;
  assert.throws(() => verifyExtensionPackage(manifest, "demo", tampered), /digest/);
  assert.throws(() => verifyExtensionPackage(manifest, "demo", bytes.subarray(1)), /size/);
});
test("missing, duplicated or unreviewed package identity cannot pass publishing verification", () => {
  assert.throws(() => verifyExtensionPackage(manifest, "missing", bytes), /exactly one/);
  assert.throws(() => verifyExtensionPackage({ ...manifest, extensions: [entry, entry] }, "demo", bytes), /exactly one/);
  for (const fields of [{sha256: ""}, {download_url: "https://evil.example/demo.zip"}, {package_size_bytes: 21*1024*1024}]) {
    assert.throws(() => verifyExtensionPackage({ ...manifest, extensions: [{...entry, ...fields}] }, "demo", bytes));
  }
});

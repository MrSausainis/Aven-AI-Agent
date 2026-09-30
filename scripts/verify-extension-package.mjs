import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const MAX_PACKAGE_BYTES = 20 * 1024 * 1024;

// A publishing check, not a desktop trust decision. The manifest may be mutable;
// an AVEN build must independently pin reviewed package bytes before installation.
export function verifyExtensionPackage(manifest, extensionId, bytes) {
  if (manifest?.schema_version !== 1 || !Array.isArray(manifest.extensions)) {
    throw new Error("Unsupported extension manifest");
  }
  const entries = manifest.extensions.filter(entry => entry.id === extensionId);
  if (entries.length !== 1) throw new Error("Expected exactly one matching extension");
  const entry = entries[0];
  if (!/^[a-z0-9_]{1,64}$/.test(entry.id) || !/^[0-9a-f]{64}$/.test(entry.sha256 || "")) {
    throw new Error("Missing or invalid package identity");
  }
  const url = new URL(entry.download_url);
  if (url.protocol !== "https:" || url.hostname !== "github.com" || url.username || url.password || url.port ||
      !url.pathname.startsWith("/MrSausainis/Aven-AI-Agent/releases/download/") || url.search || url.hash) {
    throw new Error("Unreviewed package location");
  }
  if (!Number.isSafeInteger(entry.package_size_bytes) || entry.package_size_bytes < 1 ||
      entry.package_size_bytes > MAX_PACKAGE_BYTES || bytes.length !== entry.package_size_bytes) {
    throw new Error("Package size does not match the manifest");
  }
  if (createHash("sha256").update(bytes).digest("hex") !== entry.sha256) {
    throw new Error("Package digest does not match the manifest");
  }
  return { id: entry.id, version: entry.version, sha256: entry.sha256, size: bytes.length };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [extensionId, zipPath] = process.argv.slice(2);
    if (!extensionId || !zipPath) throw new Error("Usage: node scripts/verify-extension-package.mjs <id> <zip-path>");
    if (statSync(zipPath).size > MAX_PACKAGE_BYTES) throw new Error("Package exceeds the desktop download limit");
    const manifest = JSON.parse(readFileSync(new URL("../extensions_manifest.json", import.meta.url), "utf8"));
    console.log(JSON.stringify(verifyExtensionPackage(manifest, extensionId, readFileSync(zipPath))));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

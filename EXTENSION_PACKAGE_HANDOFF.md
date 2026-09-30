# Extension package metadata and publishing verification (W13)

OBS package identity was checked on 30 September 2026 using both GitHub Release
metadata and the independently downloaded ZIP bytes:
- repo MrSausainis/Aven-AI-Agent, release tag extensions, asset549225259
- obs_streamer_tools version1.2.0, asset size12037 bytes
- SHA-256 60a3379072083d788d59a32953f1bf3d468124f93109b64a493521d6a2452aeb
- URL https://github.com/MrSausainis/Aven-AI-Agent/releases/download/extensions/obs_streamer_tools.zip
The ZIP contains six Python files. It was hashed/inspected as data; no package code
was executed and no desktop installation was attempted. No release asset was replaced.

extensions_manifest.json adds sha256 and package_size_bytes for that existing entry.
Schema version1, ID/version/URL/tier gate and description are preserved. Both the
production website branch and main must carry the same JSON, because the current
desktop fetches raw main/extensions_manifest.json rather than Netlify.

scripts/verify-extension-package.mjs is an offline publishing utility:
node scripts/verify-extension-package.mjs obs_streamer_tools /path/to/obs_streamer_tools.zip
It checks the expected entry, repository release URL, lowercase digest, bounded
size and actual byte hash. No network, extraction or code execution occurs.
Tests cover changed bytes of equal size, truncation, duplicate/missing entry and
unreviewed identity/location. Actual released ZIP passed; all three verifier tests
and the static-publication boundary test passed. Only the public JSON reaches
Netlify; utility/tests/handoff stay excluded by the21-file allowlist.

A hash inside a mutable manifest is METADATA, not independent authorization and
not a digital signature. The security authority remains the desktop's compiled
TRUSTED_PACKAGES pins. Do not populate those automatically from fetched JSON.
A reviewed desktop release must pin exact package bytes before enabling installs.
Current desktop source2cdbd2271e11983b47916d2e4bbd174949e2d602 in
MrSausainis/AVEN-Desktop has TRUSTED_PACKAGES={} and rejects this package before
download. That remains deliberately fail-closed; W30 is still OPEN for the
reviewed pin/desktop rollout and actual Windows install/startup/removal tests.
W13's missing manifest digest/size is implemented by this change; it does not
claim that the optional extension now works in already released desktop builds.

Rollback: remove only sha256 and package_size_bytes from the entry on both
production and main. Do not replace ZIP/version or weaken TRUSTED_PACKAGES.
For future packages: verify actual released ZIP bytes, update metadata and release
an independently reviewed desktop pin in a coordinated rollout; changed ZIPs
at a mutable URL will be refused by a fixed desktop digest.

## W08 investigation outcome

The live Supabase security advisor still reports Leaked Password Protection
Disabled. Organization rmxkjymekdviwznktmvd was retrieved through the connector and
reports plan=free, tier=tier_free. Current official docs restrict leaked-password
protection to Pro and above:
https://supabase.com/docs/guides/auth/password-security
The Management API provides password_hibp_enabled with auth-config write scope:
https://supabase.com/docs/reference/api/v1-update-auth-service-config
The connected Supabase toolset has no Auth-config read/write operation. No paid
upgrade, password setting, auth schema or workaround was applied. W08 remains
OPEN and requires a product/budget decision followed by supported server-side
configuration and a real compromised-password rejection check. A browser-only
check would not close that server-side security finding.

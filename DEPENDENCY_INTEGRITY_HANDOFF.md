# Account CDN dependency integrity (W12)

The account page now loads the exact Supabase JS 2.117.2 UMD file path with SHA-384 Subresource Integrity and crossorigin=anonymous. The version is unchanged. Previously only the package version was pinned and no content hash was enforced. Browser SRI refuses execution if the delivered bytes change; no unhashed fallback is added. The existing deferred script order still loads the SDK before account.js.

Reviewed URL: https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2/dist/umd/supabase.min.js

Verified on 2026-09-30 with two independent HTTP retrievals: 218237 decoded bytes, Access-Control-Allow-Origin: *, application/javascript, no sourceMappingURL. Both returned SHA-384 WgXwGL6fUsYJWNaKJgVbrJKGRQwc1vieh2oy4kw9nXqpNDz3tdSsqEYUgeHD/NuF. Hash the exact CDN response bytes, including its CDN-generated preamble, rather than assuming a hash of a different package artifact matches.

Publishing integration verifies the actual output's external script exact version/file path, reviewed integrity value and CORS attribute. Direct HTTP verification compares page-declared SRI with the fetched resource and confirms a modified resource fails the hash. Real browser loading and account flows remain in the agreed final live test. This mitigates CDN byte substitution, not a malicious dependency already present when reviewed, website-repository compromise, or CDN unavailability. There is no dependency-version upgrade, self-hosted copy or source map in this change.

Upgrade procedure: review the new release, fetch the intended immutable/versioned file, compute/verify its SHA-384 and CORS response, then update page and publishing-test expectations together. Do not delete the integrity attribute to work around a changed response. This handoff is excluded from the 19-file publish allowlist.

Primary guidance: https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Subresource_Integrity ; release https://github.com/supabase/supabase-js/releases/tag/v2.117.2

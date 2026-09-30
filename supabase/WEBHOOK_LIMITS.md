# W29: bounded public webhook body

Deployed 30 September 2026 to `upiadmvxzphegivqszvp`: stripe-webhook v11 ACTIVE,
verify_jwt=false remains intentional; the raw Stripe signature is mandatory.
Bundle SHA: `1ee879d4be965cbc05040fb631de1fc399ef4bb0a46f877a1a5e65138fd17743`.

The endpoint accepts only POST and rejects missing signatures before acquiring a
body reader. Bodies over 256 KiB return413; invalid Content-Length returns400;
non-identity Content-Encoding returns415. Content-Length is only an early check:
actual bytes are counted while streaming, so absent/understated lengths cannot
bypass the cap. A fixed256KiB buffer avoids retaining arbitrary chunk arrays.
There is no JSON parse/reserialize before signature verification. UTF-8 characters
split across chunks retain exact text; malformed UTF-8 is rejected.

Body reading has a10-second deadline (timer plus per-iteration clock check),
returning408 and cancelling on timeout. Cancellation is not awaited, so a stalled
producer cannot delay rejection. Oversized/read-failed streams are also cancelled.
Timer cleanup and reader-lock release run on success/failure. Signature verification
and every DB/Stripe reconciliation operation happen after these checks.

All19 isolated webhook tests pass:11 existing billing/order/dedupe tests plus8
groups for declared oversize, chunked/lying length, exact boundary, split UTF-8,
malformed length/unsupported compression, slow body/nonsettling cancellation,
read failure/malformed UTF-8 and early method/signature rejection.
Deployed source read-back matches the committed source. gitdiff--check passed.
No database migration, real Stripe event replay, payment or subscription mutation
was performed by development tests. Final signed-event/Deno-SDK HTTP tests remain
deferred to the user's final live session.

This bounds application body handling, not all upstream bandwidth/invocation
costs or platform-wide DDoS traffic. No unsupported platform rate-limit setting
was invented. The existing configured subscription/Checkout events normally have
small bodies; unusually large legitimate events will be rejected and Stripe will
retry. Review this explicit limit if event types or payload expansion change.

Recovery: redeploy `supabase/rollback/stripe-webhook-v10.ts` asindex.ts with
verify_jwt=false. This restores v10 reliability/reconciliation but removes body
limits; do not use the older v9 rollback for a body-limit-only rollback.
Static publication remains isolated by rootnetlify.toml and its allowlisted build.

References:
- https://docs.stripe.com/webhooks
- https://supabase.com/docs/guides/functions/limits

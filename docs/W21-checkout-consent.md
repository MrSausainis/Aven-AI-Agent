# W21: purchase-specific consent and durable purchase confirmation

Source implementation complete; operational activation is blocked by real trader / verified sender configuration and coordinated acceptance. This is not a legal launch certification. No production deployment, real email, payment or schema change has occurred in this draft.

## Resulting behavior

Account presents two separate unchecked inputs using server-versioned text. Acceptance of general Terms and signup metadata never substitute for a purchase-specific request. Requesting immediate access preserves applicable statutory withdrawal/refund rights. The flow does not claim a digital-content waiver or full performance at recurring subscription activation.

The selected plan, exact notice text/version/hash, legal release, verified account and server time are archived. A frozen attempt binds this evidence under its account reservation before any Stripe customer/session creation. Its public offer includes the server-validated Stripe Price/currency/interval and configured real trader identity. Secret API credentials are never copied into an offer or export.

Retries retain their original receipt and frozen Stripe parameters. An expired intent can recover only its exact already-bound persisted attempt within the conservative 23-hour window; it cannot authorize a replacement purchase. A known open plan switch expires the verified old link before creating a new purchase with fresh evidence. Ambiguous creates cannot switch plan or receipt. Legacy unbound sessions/attempts require support and are left intact.

New subscription metadata carries the binding into every subscription event. The signed Stripe webhook still reconciles current Stripe state rather than stale event snapshots. Before granting a new paid tier, it retrieves the subscription and completed paid Checkout, checks account/customer/subscription/metadata and exact line-item price/quantity, archives the immutable confirmation, sends the confirmation email, and records the provider acknowledgement. Email failures leave the billing event retryable and do not grant new access. Existing legacy subscription reconciliation, revocation and past-due grace are preserved without inventing consent.

The email includes readable trader/contact, plan, amount/currency, renewal and cancellation information, exact early-access wording/time/version, a withdrawal-notice option and explicit rights preservation. It attaches the exact confirmation bytes and complete archived Terms, Privacy and Refund HTML documents, rather than relying on changeable links. A SHA-256 digest identifies the saved confirmation. Provider acceptance is recorded accurately; it is not represented as proof of inbox delivery.

A separate delivery record serializes mail attempts. The entire outgoing message and sender are frozen before sending. Retries use the same Resend idempotency key and payload even after template/config changes. Busy workers or lease loss cannot mark a send accepted. Ambiguous sends older than 23 hours require provider reconciliation rather than blind retries, because Resend idempotency lasts 24 hours. Monitor bounces/delivery failures through the provider operationally; an acknowledgement does not waive consumer rights.

Account provides a saved confirmation download and basic export schema v3, including complete own legal, purchase-consent and confirmation history. Failed or cross-account reads do not produce misleading partial exports. Account change is rechecked before download. Authentication/session tokens and provider credentials remain excluded.

## Documents and retention

New pinned release 2026-10-01.1 contains byte-identical public/archive Terms and Privacy, plus an archived Refund document. Exact digests are checked by SQL and source tests. Old 2026-09-30.1 copies and ledger evidence remain intact.

Privacy describes consent/contract records, transactional Resend delivery, browser retry storage, purpose, export and retention. sessionStorage plus an in-memory fallback preserves retry identity without prechecking consent controls. Unbound expired intents are eligible for removal after 30 days through the bounded service-only purge_unused_purchase_intents procedure (at most 500 per invocation). Run this maintenance regularly after activation. Bound purchase/confirmation records survive that purge. Their final statutory retention and coordinated account deletion remain part of the trader/account lifecycle setup (W24); the schema blocks a raw Auth delete from erasing linked transaction evidence accidentally.

## Verification

97 Node tests pass: 16 purchase UI, 8 legal/account regressions, 7 account export, 3 confirmation download, 37 checkout integration, 13 webhook regressions/gating and 12 actual shared confirmation-helper tests, plus the public build/link/source-exclusion check. These execute the actual JS/TS source with mocked service boundaries; no actual payment or email is sent. Node stripTypeScriptTypes verifies/transforms TS syntax; a full Deno typecheck and real browser/provider acceptance remain required.

78 SQL assertions pass using actual authenticated/service_role/anon roles in a BEGIN/ROLLBACK transaction on Supabase upiadmvxzphegivqszvp. Covers account/role boundaries, explicit flags, version/Price/time snapshots, nonce identity, lease binding, policy/legal rotation, expiry recovery, rate limiting, immutable contracts, exact document bytes/hash, mail serialization/frozen content/recipient, stale token denial, provider retry horizon, retention and own-record access. Temporary document-current flags, synthetic users and every proposed schema object were rolled back; the live legal release remains 2026-09-30.1.

Run tests from repository root:

```sh
node --test scripts/checkout-consent.test.cjs scripts/legal-acceptance.test.cjs scripts/account-export.test.cjs scripts/purchase-confirmations.test.cjs supabase/tests/create-checkout.test.cjs supabase/tests/stripe-webhook.test.cjs supabase/tests/purchase-confirmation.test.cjs
node scripts/checkout-consent-test-query.mjs > /tmp/w21-test.sql
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f /tmp/w21-test.sql
```

Use a disposable database with the existing account/legal/checkout/webhook reservation schema. Do not apply a proposal separately to production as a test.

## Activation prerequisites and procedure

Existing deployed foundation: legal-acceptance ledger, checkout_attempts and webhook atomic reservation RPCs. The checkout guard source is in backend draft PR20 (fix/checkout-legal-evidence, head 62a6682397aeba152c3749b2c368e1d6b4930ad9). Coordinate overlapping backend drafts; deploying an older checkout or webhook after this one would bypass confirmation enforcement.

Required Supabase Edge Function secrets/config, supplied through secure project settings, never in Git or this chat:

- RESEND_API_KEY: a transactional sending key for a verified domain.
- PURCHASE_CONFIRMATION_FROM: a verified sender email address on that domain.
- PURCHASE_TRADER_JSON: the actual trader's legal_name, geographic_address, country, support_email and telephone; registration_id/vat_id only if applicable. The implementation does not create a trader identity or make tax assumptions.

Config is validated before claiming checkout or creating a Stripe customer/session. A missing config yields 503 without billing mutations. Verify the sender and private reply/contact route before enabling purchases. There is no configured sender/domain or trader JSON in this draft; live configuration has not been inferred or fabricated.

Generate actual migrations with supabase migration new before deploying. Apply proposals in this order: purchase-legal-release.sql, checkout-consent.sql, purchase-confirmations.sql. Preserve existing migration history; these proposal filenames are not invented migration versions.

Deploy create-checkout and stripe-webhook with _shared/purchase-confirmation.ts bundled. Keep create-checkout JWT verification on; webhook JWT verification stays off solely because it validates the raw-body Stripe signature. Deploy Account/public/pinned documents matching 2026-10-01.1 together with the new legal release. Pause new purchases during a coordinated legal/function/UI update so old clients cannot silently use the wrong gate. Billing management and account data remain available.

Complete W35 browser/login/provider/live billing acceptance before claiming operational completion. Exercise lost Stripe responses, simultaneous clicks, email failures/acceptance-commit loss, original attempts, cancellation, old legacy records and legal/policy rotation. Verify actual received attachments and subsequent entitlement state. Do not simulate these by charging customers or emailing synthetic fixture users.

Baseline rollback references: production website 5d02fd7c725d82dca2dba0bcee92ed7759f46b05; create-checkout v12 SHA a002e4316c49b1ca103b046bb9f3bfd24e9be724aef07c3c75808a4dbb484c2d; stripe-webhook v11 SHA 1ee879d4be965cbc05040fb631de1fc399ef4bb0a46f877a1a5e65138fd17743. Rolling back only to these older functions would remove new confirmation enforcement. Keep new purchases paused during coordinated rollback and retain immutable evidence/delivery records. Do not discard a paid confirmation or reset an ambiguous provider idempotency key to force progress.

## Sources

- EU Consumer Rights Directive: https://eur-lex.europa.eu/eli/dir/2011/83/oj/eng (Articles 8, 13, 14 and 16; current consolidation also consulted).
- Commission guidance on durable confirmation: https://eur-lex.europa.eu/legal-content/EN/TXT/PDF/?uri=CELEX%3A52021XC1229%2804%29.
- Resend send/attachments: https://resend.com/docs/api-reference/emails/send-email.
- Resend 24-hour idempotency: https://resend.com/docs/dashboard/emails/idempotency-keys.
- Stripe subscription-filtered Checkout reads: https://docs.stripe.com/api/checkout/sessions/list.

W21 source work is complete. Actual sender/trader configuration and live activation cannot be represented as completed without those real prerequisites; trader/tax readiness and W35 acceptance remain separate launch blockers.

# Account-wide Checkout creation guard

Deployed 30 September 2026 to `upiadmvxzphegivqszvp`: `create-checkout` v10
ACTIVE, `verify_jwt=true`. Migration `20260930144216_checkout_attempt_guard`.
Deployed bundle SHA: `e3fc036410ebf9a0d8664c4a50b9224f288105353af8fe33c78f1a2a3f50ddec`.

The verified Supabase user ID owns one durable attempt and a 120-second fenced
lease across both plans. Request parameters and random attempt ID are committed
before Stripe calls. Customer/session creation uses that attempt's idempotency
keys; retries reuse the exact stored parameters, including email and integration
identifier. A lost Stripe response or failed session-ID commit is recovered from
the customer's open sessions or by the original idempotent request.

Repeated clicks return the same current open session URL. Plan changes expire
the old session before replacing it. If completion wins the expiration race,
Stripe/DB is unavailable, a scan is incomplete, or worker ownership expires,
the request cannot create a replacement. Stripe subscriptions are read directly
before creating sessions, covering webhook lag and incomplete/paused/unpaid
subscriptions. Completed checkout requires a confirmed terminal subscription
before another purchase. Canceled subscriptions can be repurchased after the
entitlement reflects cancellation. No checkout grants access directly.

A single pre-deployment open subscription checkout is adopted only after checking
customer, client_reference_id, exactly one supported price and quantity=1.
Multiple legacy links, foreign ownership or unknown plans block new creation;
they require manual billing recovery. No historical cleanup/replay was performed.

Stripe can prune idempotency keys after 24 hours. An unresolved create older than
23 hours is blocked instead of risking another charge. Billing support must inspect
Stripe and the backend attempt before deciding how to recover. Open sessions with
known IDs remain reusable until Stripe confirms expiration/completion. A recovered
ambiguous old-plan create returns 409; retry retrieves it and safely changes plans.
Idempotently cached responses are followed by retrieval of current session state,
so stale complete/expired responses do not return obsolete checkout URLs.

`checkout_attempts` has RLS, no client grants/policies and one row per account.
Its snapshots may contain the user's billing email. They remain backend-only,
are overwritten by subsequent attempts and cascade on auth-user deletion.
claim_checkout/save_checkout_attempt/release_checkout use SECURITY INVOKER,
empty search_path and service_role-only EXECUTE. Customer binding and attempt
snapshot save are atomic and cannot overwrite a different existing customer.
Each save renews the lease; token fencing protects commits and release.
Stripe calls use a 20-second timeout and one network retry.

Dependencies: Stripe22.6.0 / API2026-08-26.dahlia; Supabase JS2.95.0 pinned.
Existing plan IDs, JWT checks, Netlify origin/return URLs, metadata whitelist,
and managed_payments=false workaround are preserved. Dynamic payment methods
remain enabled; no payment_method_types allowlist or automatic_tax was added.

Validation: 19 isolated handler tests passed, plus all 11 webhook regression tests.
SQL assertions in `supabase/tests/checkout-guard.sql` passed under service_role and
authenticated roles inside BEGIN/ROLLBACK: busy claim, snapshot persistence,
lease expiry, fencing, wrong-owner release, conflicting customer binding atomicity,
and denied client access. Follow-up query found 0 committed test attempts.
All three RPCs were verified SECURITY INVOKER and service_role-only; table RLS
and grants were verified. Security advisor no-policy INFO is intentional for
backend-only tables. The pre-existing leaked-password warning remains separate:
https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

Real Stripe sandbox/session lifecycle, Deno SDK integration, double browser clicks,
simultaneous network requests, plan-switch/completion race and webhook lag remain
final live-test gates. No real customer, session, payment or subscription was
created/expired by this development session. Tax/VAT configuration remains a
separate unresolved commercial gate; do not enable Stripe Tax without registrations.

Recovery: redeploy `supabase/rollback/create-checkout-v9.ts` as index.ts with
verify_jwt=true. The additive migration can remain, but reverting the handler
removes the new duplicate-session protection. Preserve attempt snapshots for
recovery. Do not merge backend source into the Netlify static publish branch until
it is excluded from public publication; GitHub PR merges do not deploy Supabase.

Official references:
- https://docs.stripe.com/api/idempotent_requests
- https://docs.stripe.com/api/checkout/sessions/expire
- https://docs.stripe.com/api/checkout/sessions/create
- https://docs.stripe.com/api/checkout/sessions/list
- https://docs.stripe.com/api/subscriptions/list
- https://supabase.com/docs/guides/api/securing-your-api

Supabase CLI was unavailable; remote schema was applied through MCP and the SQL
filename uses actual migration history. The required changelog.md lookup returned
unsupported content-type; current database security docs were retrieved via MCP.

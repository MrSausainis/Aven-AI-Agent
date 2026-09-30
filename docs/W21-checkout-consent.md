# W21 purchase consent integration

Status: draft, not deployed. W21 remains open pending durable contract confirmation and final legal design.

Signup metadata and acceptance of general Terms do not establish a purchase-specific early-access request. This change records two separate affirmative inputs against exact server-owned wording, the current legal release, a server-mapped plan/Price, the authenticated confirmed account, and server timestamps.

The proposed wording preserves statutory withdrawal/refund rights. It is not a digital-content withdrawal waiver, does not assert that activating a recurring subscription fully performs the contract, and is not a substitute for final contract classification or durable purchase confirmation.

## Account and checkout behavior

Account loads policy text from the server and renders it as text, with two unchecked labelled inputs. A changed account, policy or hash clears the inputs. General Terms are checked independently. Concurrent clicks are fenced across both plans. The selected plan records an account-scoped nonce; session storage and an in-memory fallback preserve the same request after lost responses without restoring checked controls. A reload requires affirmative inputs again. Errors and returned Stripe URLs are validated before redirecting.

create-checkout verifies the user's JWT, current legal acceptance and own matching consent before claiming the account reservation. A new immutable attempt includes consentId and binds evidence under its fenced lease before customer/session creation. Frozen Checkout metadata includes consent, policy, legal release and attempt identities. Client flags and arbitrary client identity cannot substitute for evidence.

Retries retain their original receipt and Stripe parameters. An unresolved create cannot switch plan or receipt. A bound open same-plan session requires its original receipt. A plan switch expires the verified old link before creating a replacement with a fresh plan-specific receipt. Lost responses recover only matching attempt/consent metadata. Legacy unbound attempts or sessions are left intact and require support; they are never adopted as consent.

An expired intent can recover only its exact already-bound persisted attempt within the conservative 23-hour window. It cannot start a replacement. Resolved attempts require a fresh receipt; the server returns new_consent_required without saving a poisoned replacement attempt. Policy/legal rotation or loss of account confirmation blocks binding, including retries.

## Database foundation

- Own-account read RLS; no direct client or service-role evidence insert/update/delete.
- Strict true flags, exact policy version/hash, thirty-minute new-intent expiry and immutable wording/legal snapshots.
- A separate append-only binding requires the saved attempt identity/plan/consentId and current lease token.
- Ten new intents per account per ten minutes, serialized by a transaction advisory lock. Existing nonce retries remain available at that limit.
- Private definer helpers with empty search paths and minimally granted public invoker wrappers.

The SQL remains a proposal, not an applied migration. Generate the migration using the Supabase CLI before deployment. Prerequisites are the deployed legal-acceptance ledger and checkout-attempt schema/functions. The latter source is in backend draft PR20 (fix/checkout-legal-evidence, head62a6682397aeba152c3749b2c368e1d6b4930ad9), including supabase/migrations/20260930144216_checkout_attempt_guard.sql. Coordinate overlapping backend drafts; do not deploy an older create-checkout after this one.

The function used as this change's baseline is live create-checkout v12, SHA256 a002e4316c49b1ca103b046bb9f3bfd24e9be724aef07c3c75808a4dbb484c2d. It is copied into this website draft so the proposed frontend and backend can be reviewed together. Production remains that baseline.

## Verification

59 Node tests passed: 16 purchase UI, 8 existing legal/account regressions and 35 checkout integration tests with mocked Supabase/Stripe. These execute the actual frontend functions and transpiled Edge Function source. They do not replace live Stripe or browser acceptance. TypeScript syntax was transformed by Node's stripTypeScriptTypes; no full Deno typecheck was available.

46 SQL assertions passed on Supabase project upiadmvxzphegivqszvp in one BEGIN/ROLLBACK transaction using authenticated, service_role and anon roles. Synthetic auth accounts, proposed schema objects and temporary policy/legal-release rotations were rolled back. A final query confirmed public.checkout_consents does not exist.

Coverage includes independent Terms, missing/unchecked flags, stale wording, plan/Price identity, nonce reuse, exact archived wording, server clock, foreign-account access, direct writes, unconfirmed accounts, reservation ownership, attempt binding, replay, policy/legal rotation at validation and binding, expiry recovery, new-attempt denial, account rate limit, anonymous access, concurrent clicks, lease loss, lost Stripe/customer-bind responses, frozen parameters, legacy refusal and redirect validation.

Run source tests:

```sh
node --test scripts/checkout-consent.test.cjs scripts/legal-acceptance.test.cjs supabase/tests/create-checkout.test.cjs
```

Reproduce SQL assertions against a disposable database with the prerequisite schema:

```sh
node scripts/checkout-consent-test-query.mjs > /tmp/checkout-consent-test.sql
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f /tmp/checkout-consent-test.sql
```

Do not apply the proposal separately to a live database as a test.

## Remaining acceptance and deployment blockers

- Produce and retain a durable purchase/contract confirmation containing exact consent evidence and applicable contract information. A browser redirect or Stripe metadata alone is not that confirmation.
- Finalize contract classification and applicable withdrawal behavior, trader details, private support route and VAT setup before paid launch. This draft introduces no blanket waiver.
- Update the privacy disclosure and pinned legal release to describe purchase-consent records and browser retry storage before enabling the new flow; include the new evidence in appropriate account exports and determine retention/account deletion handling. Existing pinned documents were deliberately left unchanged.
- Generate/apply the proposal migration, deploy the function and Account together after prerequisites and confirmation are complete. Rollback must not point a consent-enforcing frontend at a backend that ignores consent.
- Coordinate W35 real browser/Windows/login/billing acceptance. Source tests are not real payment acceptance.

No production database migration, UI/function deployment, Stripe setting, payment, legal release or installer was changed by this draft.

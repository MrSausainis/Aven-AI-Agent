# W21 purchase consent foundation

Status: draft, not deployed. W21 remains open.

Signup metadata and acceptance of general Terms do not establish a purchase-specific early-access request. This proposal records two separate affirmative inputs against exact server-owned wording, the current legal release, a server-mapped plan/Price, the authenticated confirmed account, and a server timestamp.

The proposed wording preserves statutory withdrawal/refund rights. It is not a digital-content withdrawal waiver, does not assert that activating a recurring subscription fully performs the contract, and is not a substitute for final contract classification or durable purchase confirmation.

## Included behavior

- Read-only own-account evidence; no direct client or service-role evidence mutation.
- Version/hash checks, strict true flags, thirty-minute intent expiry, and retry identity scoped to account and purchase.
- An append-only binding to the exact immutable checkout attempt under its current fenced lease. Another attempt cannot reuse that evidence.
- Account confirmation rechecked when the backend binds evidence, including retries.
- Private definer helpers with empty search paths and minimally granted public invoker wrappers.

The SQL is a proposal, not an applied migration. Generate the migration using the Supabase CLI before deployment. Its prerequisites are the existing legal-acceptance ledger and checkout-attempt reservation schema on the website compliance branch.

## Verification

39 SQL assertions passed on Supabase project upiadmvxzphegivqszvp in one BEGIN/ROLLBACK transaction using authenticated, service_role, and anon roles. Synthetic auth accounts and every proposed schema object were rolled back. A subsequent query confirmed public.checkout_consents does not exist.

Assertions cover independent Terms acceptance, missing/unchecked consent flags, stale wording, plan/Price identity, nonce reuse, exact archived wording, server time, foreign-account access, direct writes, unconfirmed accounts, lease ownership, attempt binding, retry behavior, expiry, and anonymous access.

Reproduce against a disposable database with the prerequisite schema:

```sh
node scripts/checkout-consent-test-query.mjs > /tmp/checkout-consent-test.sql
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f /tmp/checkout-consent-test.sql
```

Use a disposable test database. Do not apply the proposal separately to a live database as a test.

## Remaining integration and acceptance

1. Render the server policy in Account with two separate unchecked inputs. Clear inputs on policy/account changes. Do not reuse Terms checkboxes or signup metadata.
2. Record only the selected plan after both inputs are affirmed. Validate the consent under the user's JWT before acquiring a checkout lease.
3. Save consentId in a new immutable attempt, then bind under its lease before any Stripe customer/session creation. Record the binding identity in frozen Checkout metadata.
4. Preserve the original consent and frozen Stripe parameters on retry. Do not adopt a legacy unbound open session or overwrite an ambiguous attempt. Define expired-intent recovery without double billing; the current validation deliberately rejects expired intents even if previously bound.
5. Produce and retain a durable purchase/contract confirmation with exact consent evidence. A browser redirect alone is insufficient evidence.
6. Complete contract classification, applicable withdrawal behavior, trader details and VAT setup before paid launch. Confirm wording rather than introducing a blanket waiver.
7. Exercise two simultaneous submissions, wrong-account IDs, policy rotation, lease expiry, lost Stripe responses and original-attempt retries in mocked integration tests, followed by the coordinated W35 real acceptance run.

No Account UI, create-checkout function, legal release, Stripe setting, payment, production deployment or installer was changed by this foundation.

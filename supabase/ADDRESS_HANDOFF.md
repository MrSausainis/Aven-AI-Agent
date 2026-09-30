# Checkout billing address persistence (W23)

Deployed 30 September 2026: create-checkout v11 ACTIVE, verify_jwt=true.
Project: upiadmvxzphegivqszvp.
Bundle SHA: 06448a7f9312e38f6175d58659dcc99a7dd27da4f7f6321bdffc13f7547a2b59.
Remote source was retrieved after deployment and matched the local source exactly.

New monthly and annual subscription session snapshots set:
- billing_address_collection: required
- customer_update.address: auto

Checkout always receives the Stripe Customer linked to the authenticated account,
including accounts whose Customer is created during this request. Stripe collects
the full billing address and may update customer.address on Checkout completion,
so subscription billing has a saved customer location. Address values are not
accepted from the website request or copied to Supabase. The privacy notice now
explains collection and Stripe storage.

Existing open Checkout links are reused with their earlier settings. Ambiguous
creation retries retain the original frozen parameters and idempotency key:
adding new fields to a previous request could break recovery. Confirmed expiration
starts a new attempt with the address policy. No historical customers/invoices
were backfilled, no live checkout was created/completed, and no payment was made.

Automatic Tax, registrations, tax IDs, prices, Managed Payments, and customer
name/shipping update permissions were not changed. This implements W23's
new-checkout persistence path; tax/legal findings W18/W24 remain separate.
A final Stripe sandbox/browser purchase must verify customer.address and invoice
customer_address after completion, including a repeat/renewal invoice. W23's real
end-to-end acceptance is still deferred with the other final live tests.

Validation: 21 actual-handler Checkout tests, including both plans, existing/new
Customers, ignored forged client settings, pre-Stripe parameter persistence,
and old frozen retries followed by expiration/new policy. Full regression run:
58 passing tests across Checkout, webhook, portal, account export/name and
static-publication boundary. These are isolated mocks, not Stripe/Deno integration.

Rollback: redeploy supabase/rollback/create-checkout-v10.ts as index.ts with
verify_jwt=true. This captured byte-identical pre-change deployed source retains
the account-wide duplicate-checkout guard. Keep stored attempt snapshots unchanged.
This supersedes CHECKOUT_HANDOFF.md's deployed-version statement; its v10 guard
and database migration documentation still apply. GitHub merges do not deploy
Supabase functions. Backend files stay excluded from Netlify's public dist.

Official source:
https://docs.stripe.com/api/checkout/sessions/create.md?query=customer_update
customer_update.address defaults to never; auto enables Stripe's address update.
billing_address_collection=required always collects the full billing address.

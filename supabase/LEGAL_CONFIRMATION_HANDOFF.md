# W02 explicit Terms confirmation integration

Completed 30 September 2026, following the database foundation in
LEGAL_LEDGER_HANDOFF.md and migration 20260930194220.
W02 implementation is complete; final authenticated browser/Stripe acceptance
remains part of the deferred live test round. No record was accepted on any user's
behalf, and no legacy metadata was backfilled.

## Website

Production PR19: https://github.com/MrSausainis/Aven-AI-Agent/pull/19
Commit: 05a2459a8f3109612999199e47e19f3e3567fd65
Netlify deploy: 6abd6c4e8680f900088e4a8c READY, published 2026-09-30T20:08:59.996Z.

Accounts without current evidence see separate unchecked Terms acceptance and
Privacy acknowledgement controls. Links point to the exact archived source copies:
terms-2026-09-30.1.html / privacy-2026-09-30.1.html.
Both archive bodies/hashes match the migration and frontend LEGAL_RELEASE object.
Current generic Terms/Privacy pages remain available; they are not silently used
as a different document version during confirmation.

After getUser verification, status is read from get_legal_acceptance_status.
The version and both hashes must match the pinned release. Confirmation calls
accept_current_legal with that exact version/hashes and two explicit booleans.
The request has no user-ID, timestamp or source parameter; the server owns these.
Accepted status requires a valid server timestamp. Missing/failed/mismatched
status keeps confirmation/purchase/website desktop handoff closed with an error.
A stale release requires updated website assets and reload, rather than accepting
a new version against old displayed links. Confirmation status is reread on retry.

The dashboard remains available when evidence is absent or status fails. Billing
portal cancellation/payment methods/invoices, basic export, review deletion and
other account settings do not require fresh Terms confirmation. Website desktop
callback token handoff waits for current acceptance; this does not revoke existing
desktop sessions or impose an app-wide authorization policy. Existing paid access
is not removed. Signup no longer sends legal_version/terms_accepted_at metadata;
its explanatory text directs users to verified-account confirmation.

Basic export schema_version=2 adds all own legal_acceptances rows, with explicit
fields and user_id filter. A foreign row, failed query or malformed missing history
aborts export. Empty history is valid. Authentication/provider tokens stay excluded.
The old user-editable metadata remains exportable as user data, not legal evidence.

Static publication grows from 19 to 21 allowlisted files for the two snapshots.
All migration, tests, internal handoffs and rollback files stay excluded. Netlify
rewrites HTML internal links/attribute formatting: public page TEXT was compared
with local; account.js was byte-identical. All four public entry points returned200.

## Server purchase gate

create-checkout v12 ACTIVE, verify_jwt=true, project upiadmvxzphegivqszvp.
Bundle SHA a002e4316c49b1ca103b046bb9f3bfd24e9be724aef07c3c75808a4dbb484c2d.
Retrieved deployed source matches exactly. Website publication was confirmed
before activating this guard so users have the confirmation controls available.

After verified getUser, the authenticated user's Supabase client reads current
ledger status before acquiring a billing lease or mutating Stripe. Missing current
acceptance returns403; RPC failure/missing status returns503. Client consent flags
and mutable metadata cannot bypass this check. Prior idempotency snapshots and
billing address policy stay unchanged. Existing Checkout URLs issued before this
deployment may still be completed directly at Stripe; no historical sessions were
expired or rewritten. This is a new-request gate, not historical payment cleanup.

Backend source/test/rollback are stacked on draft PR16 in fix/checkout-legal-evidence.
GitHub merge alone does not deploy the Edge Function. The existing portal function
is unchanged and does not call the Terms gate.

## Verification

69 automated tests passed: 8 actual UI-handler/archive groups, 6 basic export,
3 account-name, 1 publication boundary, 23 actual checkout-handler, 9 portal,
19 webhook. Tested unchecked old accounts, document drift, failed auth/status,
exact evidence fields, malformed server time, failed confirmation/repeated clicks,
new purchase blocking, real session-renderer desktop handoff and dashboard
availability, own-history export and empty/error/foreign history. Checkout tests
verify both unaccepted plans and status outage stop before any Stripe creation or
billing lease. Prior billing/address/retry and portal/webhook regressions passed.
node --check account.js and git diff --check passed; builder produced21 public files.
These are mocked browser/Stripe boundaries, not authenticated end-to-end testing.
The foundation's actual database-role/identity/time/RLS tests remain applicable;
no database functions or schema were changed in this stage.

Final live checks: old and new confirmed-account confirmation/retry/reload, record
version/hash/time readback, duplicate idempotency, desktop callback, account export,
new Checkout403->confirmation->Checkout success, and portal cancellation/export
without acceptance. No actual customer/session/payment or real-user acceptance
was created by this development stage. W21 EU purchase consent is separate; Privacy
acknowledgement is not blanket processing consent or a withdrawal-right waiver.

Recovery: redeploy supabase/rollback/create-checkout-v11.ts as index.ts,
verify_jwt=true, to remove only the legal purchase gate while keeping address and
duplicate-checkout protection. Preserve ledger evidence and document snapshots.
If restoring the prior website (commit80634698c92213362fe7c60023afa30a7868435b),
first remove the server purchase gate to avoid requiring missing UI controls.
Do not disable/drop ledger RPCs while this website depends on them.

# Stripe webhook reliability

Deployed on 30 September 2026 to `upiadmvxzphegivqszvp`: `stripe-webhook` v10.
Migration: `20260930105612_stripe_webhook_reconciliation`.

Signed events are reconciliation signals. Event timestamps are audit metadata,
not ordering keys: distinct events can share a second. The handler obtains a
120-second per-customer lease before reading current Stripe subscriptions.
Entitlement update, event-ID dedupe and lease release commit atomically via RPC.
The lease token fences late workers after expiry or ownership replacement.
If Stripe/DB fails or the customer is busy, return non-2xx for Stripe retry.

Current active/trialing subscriptions take precedence over canceled ones; retain
the selected active subscription when multiple supported subscriptions exist.
`past_due` preserves the existing grace policy; paused is suspended, and terminal
states are free only when no supported active/grace/paused subscription exists.
Persist subscription ID/status and update the entitlement timestamp. Expiry uses
the supported subscription item's current period end, or trial_end for trials.

The two exact existing production price IDs remain the only supported paid plans.
Stripe SDK is pinned to 22.6.0 / API 2026-08-26.dahlia; Supabase JS to 2.95.0.
Signature verification remains mandatory and `verify_jwt=false` is intentional.
RPCs use SECURITY INVOKER and are executable only by service_role. Ledger/lease
tables have RLS and no client access policies or grants. The no-policy advisor
INFO is intentional for these backend-only tables.

Validation: 11 isolated handler tests passed (`node supabase/tests/stripe-webhook.test.cjs`).
Synthetic SQL claim/busy/expired-token/dedupe/failure-atomicity tests passed in a
transaction that was rolled back. RPC grants and RLS were inspected, and the
deployed source matched exactly. No real Stripe webhook replay or payment was run.

Remaining final runtime gates: signed webhook replay, simultaneous deliveries,
Stripe API outage/retry, genuine subscription lifecycle and multiple-subscription
behavior, Deno SDK integration, billing expiry, and final end-to-end checkout.
No historic event backfill or current-account reconciliation was triggered.
Duplicate Checkout Session prevention (audit W04) remains a separate task.
Tax/VAT configuration remains a separate unresolved commercial gate.

Recovery: deploy `supabase/rollback/stripe-webhook-v9.ts` as index.ts with
verify_jwt=false to restore the previous handler. The additive migration can stay;
do not drop the ledger or subscription columns during emergency rollback.
Do not merge backend source into the Netlify publish branch until server source
is excluded from static publication. This PR does not trigger Supabase deployment.

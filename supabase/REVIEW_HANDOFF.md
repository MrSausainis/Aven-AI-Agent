# W07: server-controlled review identity and timestamps

Applied to `upiadmvxzphegivqszvp` on 30 September 2026, migration
`20260930145659_review_identity_timestamps`.

The previous review policies protected row ownership and body/rating constraints,
but clients could submit any account_name or future created_at. A single BEFORE
INSERT OR UPDATE trigger now derives account_name from the row owner's profile,
sets insert creation/update timestamps from clock_timestamp(), preserves the
original created_at on edits/upserts and rejects changes to review ownership.
It replaces the previous timestamp-only update trigger. No RLS/grant changes
were made to reviews or profiles; public review reads still work.

The trigger function is SECURITY INVOKER with empty search_path. Authenticated
writes look up only the caller's profile through existing RLS. The trigger is
not a public RPC: direct EXECUTE is revoked from PUBLIC/anon/authenticated;
trigger invocation through ordinary INSERT/UPDATE still works and was tested.
No SECURITY DEFINER privilege bypass was introduced.

Existing account.js remains compatible: it may send account_name, but the server
ignores that supplied identity. Clients may also omit account_name entirely.
Identity is a profile snapshot on review write; changing a profile name alone
does not rewrite historical review names until the review is saved again.
Deleting/reposting a review still creates a genuinely new timestamp under the
existing delete policy. This fix does not add spam limits or verified-purchase badges.

Baseline contained one review, zero profile-name mismatches and zero future dates.
No historical repair/backfill was needed or performed.

Validation: `supabase/tests/review-integrity.sql` passed direct authenticated
INSERT, UPDATE and browser-style UPSERT with forged names/future timestamps,
server-derived identity without client account_name, body/rating edits, rejected
ownership reassignment/foreign profile, existing constraints, anonymous public
read and denied anonymous write. It ran inside BEGIN/ROLLBACK. Whole-review-set
fingerprint and count matched before/after, confirming published data was restored.
Trigger read-back, function invoker/search_path/EXECUTE permissions and migration
history were verified. Security advisor reported no new warning; pre-existing
leaked-password protection warning remains separate:
https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

User-facing browser save/edit/display testing remains deferred to the final live
session. No frontend, Checkout or webhook code changed in this batch.

Recovery: apply `supabase/rollback/review-integrity.sql` to restore the old
timestamp-only trigger. This removes W07 protection; the old touch function was
retained. The new unused function can remain with direct client EXECUTE revoked.

Keep backend PRs draft until backend source is excluded from Netlify static
publication. Schema was applied through MCP because Supabase CLI is unavailable;
the stored migration filename matches actual remote migration history.
Reference: https://supabase.com/docs/guides/database/functions

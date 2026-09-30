# W02 Terms acceptance ledger — database foundation

Applied migration 20260930194220_legal_acceptance_ledger on 30 September 2026
to Supabase project upiadmvxzphegivqszvp. This is a bounded database-only stage.
W02 is still OPEN until the website's explicit acceptance/reacceptance action
uses these RPCs. Current signup metadata remains client-written and must not
be treated as evidence. No existing metadata was imported, and no production
user was recorded as having accepted anything.

## Stored evidence

jysen_private.legal_releases archives the exact Terms and Privacy HTML source
from production commit 4198ce1c0632c635af8f01fb6f343e49c5aa5745 in migration SQL.
Version 2026-09-30.1 identifies this pair, not a claim of materially updated Terms.
Terms last-updated date is 29 September; Privacy date is 30 September.
SHA-256 values:
- Terms: 3390697fbee06f6aec3b48b3dbf37366c7a7b31895d77a1007e12155d2b62eb7
- Privacy: fbef50b2959feef42de1cfa7ef920d4ecefbfeeca7d1e0972c3d8fa35124eac6

Database CHECKs compute SHA-256 over UTF-8 archive bytes. A partial unique index
allows one current release. Publisher operations must append a new version,
retain old bodies/hashes and atomically change is_current; never rewrite a release
that already has acceptance evidence. Netlify may rewrite HTML links on delivery;
these hashes identify archived repository source, not transformed CDN bytes.

public.legal_acceptances stores authenticated user ID, exact document version and
hashes, server clock timestamp, and source authenticated_confirmation. One row
per user/version makes retries idempotent without resetting the first timestamp.
Client and ordinary backend roles cannot INSERT, UPDATE or DELETE these records.
Only SELECT is granted: authenticated sees its own rows through RLS; service_role
can inspect records. Account deletion cascades the records as currently defined;
coordinated legal-retention/deletion policy remains a separate launch decision.
A trusted database administrator can still change database state; this is server
controlled append-only evidence for application roles, not a tamper-proof notarization.

## RPC contract for the next bounded stage

get_legal_acceptance_status() requires a confirmed, non-anonymous account that
still exists in auth.users. Returns version, terms_sha256, privacy_sha256,
accepted and accepted_at. No client user-ID parameter is accepted.

accept_current_legal(p_version text, p_terms_sha256 text, p_privacy_sha256 text,
p_accept_terms boolean, p_ack_privacy boolean) requires both booleans=true and
exact current version/hashes. It inserts a server-derived record or returns the
original row. A stale version/digest fails with 22023; missing/unconfirmed identity
fails with 42501. Current release is locked FOR SHARE during acceptance, fencing
concurrent document publication. Status has no side effects.

The public RPCs are SECURITY INVOKER wrappers with empty search_path. The required
SECURITY DEFINER insert/read helpers live in jysen_private, with explicit auth.uid()
plus auth.users confirmation checks and empty search_path. All EXECUTE grants are
revoked from PUBLIC/anon/service_role and granted only to authenticated. Client
USAGE on jysen_private permits wrappers to invoke helpers but no table read grant.
The namespace is intended to stay outside Data API exposed schemas; do not expose
it. MCP did not reveal configured exposed schemas, so that setting was not asserted
as observed. Table permissions plus RLS protect archive bodies even if exposed.

## Verification and remaining work

Actual SQL tests under authenticated, anon and service_role passed:
missing/foreign identity, unconfirmed user, explicit checkbox values, stale version,
wrong hash, server time, duplicate retry, own-row RLS, direct-write denial,
metadata editing not rewriting evidence, new-version reacceptance, and archive
access restrictions. All synthetic users/releases/records ran in BEGIN/ROLLBACK.
After tests: original 3 users, zero acceptance rows, one original release, both
archived hashes verified. Helper/wrapper security mode, ACL and search_path checked.
Security advisor has only the pre-existing leaked-password warning plus INFO
no-policy notices for deliberately backend-only tables including legal_releases.
https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy

Next stage: present exact version/digest-bound document links and explicit controls
after verified sign-in, require reacceptance for old users without evidence, remove
metadata timestamp as the supposed record, include own ledger rows in basic export,
and gate new paid checkout/desktop login appropriately without blocking billing
cancellation or data access. Add actual frontend and checkout handler regressions.
No legal consent was accepted on anyone's behalf. No website/desktop/payment flow
was changed in this foundation stage. EU digital-content purchase consent W21
remains separate; a Privacy acknowledgement is not blanket processing consent.

Rollback file disables RPC EXECUTE without deleting evidence or archives. It was
not executed. Netlify's 19-file public allowlist excludes migration/tests/handoff
and rollback; GitHub merge does not apply database migrations.

Official references:
https://supabase.com/docs/guides/database/functions
https://supabase.com/docs/guides/auth/managing-user-data
https://supabase.com/docs/guides/api/securing-your-api
Supabase CLI unavailable; remote migration's actual history timestamp names the file.
Changelog.md web retrieval returned unsupported markdown content type.

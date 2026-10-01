# Support availability (W31)

The account dashboard previously displayed Priority support from tiers.priority_support, while the only implemented website support route was the shared public GitHub issue tracker. It now omits that unavailable benefit and does not request the unused priority_support field for active or expired-tier rendering. The support panel explicitly describes the same route for every plan and tells users to keep secrets/payment details out of public issues.

The Supabase field and stored entitlements remain intact for compatibility and a future real rollout. No new private support address, guaranteed response time or staff capacity is invented. Before restoring the benefit, implement and publish a real differentiated/private support channel and verify eligible-account routing. Private billing/privacy contact remains an independent launch requirement already stated in legal pages.

Verification: JavaScript syntax; actual renderFeatures function exercised with priority_support true/false and other tier benefits; existing export/name tests and publishing integration. No database changes or desktop changes. Final browser acceptance remains in the agreed live pass. This handoff is excluded from the public build allowlist.


## Private support and working-brand publication (2026-10-01)

The owner created jysenai.support@gmail.com, renamed the account to Jysen AI Support and confirmed mail works. support.html publishes this contact for account, billing, refund/withdrawal, privacy, accessibility and private security requests. Account failure/help links, the homepage navigation/footer and current refund/security/accessibility pages lead to private support; security.txt adds a mailto contact. Email links open the user's own mail client and do not submit content to this website. GitHub remains the public route for non-sensitive bugs. No priority routing, response-time SLA or automatic email delivery is claimed.

Current non-versioned website presentation uses Jysen AI. The current Windows release and wake word remain AVEN, stated on the homepage and Support page; existing installer filenames, repository URLs, desktop login protocol and API identifiers remain intact. Current Terms/Privacy pages and 2026-09-30.1 archives remain byte-identical to the live acceptance release. No Supabase migration, function or W21 draft activation is part of this publication.

Verification: node --check account.js; existing build-site integration test passes, including all local links, pinned dependency integrity, private-source exclusion and symlink refusal. Immutable legal bytes and acceptance hash constants are compared to the production baseline. No user runtime acceptance or email credentials are needed for this static update.

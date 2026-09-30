# Support availability (W31)

The account dashboard previously displayed Priority support from tiers.priority_support, while the only implemented website support route was the shared public GitHub issue tracker. It now omits that unavailable benefit and does not request the unused priority_support field for active or expired-tier rendering. The support panel explicitly describes the same route for every plan and tells users to keep secrets/payment details out of public issues.

The Supabase field and stored entitlements remain intact for compatibility and a future real rollout. No new private support address, guaranteed response time or staff capacity is invented. Before restoring the benefit, implement and publish a real differentiated/private support channel and verify eligible-account routing. Private billing/privacy contact remains an independent launch requirement already stated in legal pages.

Verification: JavaScript syntax; actual renderFeatures function exercised with priority_support true/false and other tier benefits; existing export/name tests and publishing integration. No database changes or desktop changes. Final browser acceptance remains in the agreed live pass. This handoff is excluded from the public build allowlist.

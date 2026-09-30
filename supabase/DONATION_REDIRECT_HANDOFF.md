# Support Payment Link redirect (W25, partial)

On 2026-09-30 the existing live Stripe Payment Link plink_1UD8DRJ78TGxjoZzE6ZWhmpy (public URL https://buy.stripe.com/fZufZibQQ4Qr4uUd154ko00) was still redirecting completed checkout to https://mrsausainis.github.io/Aven-AI-Agent/ . Updated only after_completion to redirect to https://get-avenai.netlify.app/donate.html . The same public link remains active; no new payment link or checkout was created.

Verified the destination with a real HTTP 200 and its support-page content before changing the setting. Retrieved the link again after updating and compared every returned top-level field with the previous snapshot: only after_completion changed. Existing payment amounts, currency, tax/Managed Payments, invoice creation, customer/consent settings and branding remain untouched. No payment or real customer transaction was used to test this change. The destination does not interpret query parameters as payment confirmation or grant access.

Rollback API request is captured in rollback/donation-redirect.json. It deliberately restores the previous legacy destination; do not apply unless reverting this change. The JSON contains configuration only, no API keys. This handoff and rollback are excluded from the public 19-file build allowlist.

W25 remains OPEN for its coordinated Jysen donation/product/invoice branding changes, and W19 remains OPEN for the related broader billing rename. This fixes the stale redirect subpart; it does not finish the rename or reduce the number of open audit findings. Real successful/delayed-payment return behavior remains in the agreed final live pass.

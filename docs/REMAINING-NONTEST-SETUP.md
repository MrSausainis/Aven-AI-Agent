# Remaining non-test setup

Status: preparation only. No remaining audit point is closed by committing these files. Production branch 5d02fd7c725d82dca2dba0bcee92ed7759f46b05 remains unchanged. W21 source is in draft PR22; source completion does not mean live activation.

## W11: production branch protection

Current GitHub branch listing reports protected=false for wip/website-compliance-security and repository rulesets list is empty. ops/production-branch-ruleset.json is the exact proposed REST create-ruleset body: PR-only updates, squash merges, resolved review threads, blocked force-push/deletion, no bypass actors. Zero required approvals avoids requiring a second maintainer in this solo-maintained repository. It does not require invented status-check names; CI enforcement must be added only after identifying the actual working checks.

Apply with an account holding Administration:write. The connected GitHub app cannot write administration settings; gh is unavailable in this workspace.

```sh
gh api --method POST repos/MrSausainis/Aven-AI-Agent/rulesets --input ops/production-branch-ruleset.json
```

Do not rerun the POST blindly: it creates a new ruleset. Record the returned ID and inspect it at repository Settings > Rules > Rulesets. Normal publication continues through PR merges; direct pushes to this production branch will be rejected. Roll back only the recorded ruleset ID through Settings if necessary. This preparation does not claim protection is enabled.

Official API: https://docs.github.com/en/rest/repos/rules#create-a-repository-ruleset
Settings: https://github.com/MrSausainis/Aven-AI-Agent/settings/rules

## W08: leaked-password protection

Supabase documentation says this hosted feature requires Pro or above. The current project is Free. No subscription upgrade was purchased and no client-side password check is substituted for server enforcement. Enable through Auth settings only after the owner chooses the paid plan. The available connector cannot update Auth configuration.

https://supabase.com/docs/guides/auth/password-security
https://supabase.com/dashboard/project/upiadmvxzphegivqszvp/auth/providers

## W18/W24 and W21: required real operator configuration

Required non-secret operator facts:
- actual legal seller name and geographic address;
- seller country, private support email and telephone;
- registration/VAT identifiers only where applicable;
- actual tax registration/regime applicable to the seller;
- verified transactional sender address/domain.

Jysen AI is the working product brand, not evidence of a legal seller identity or tax registration. Do not derive a business address/name from personal conversation memory.

W21 expects PURCHASE_TRADER_JSON with legal_name, geographic_address, country, support_email and telephone; optional registration_id/vat_id. Set PURCHASE_CONFIRMATION_FROM to the verified sender. Set RESEND_API_KEY only through secure Supabase function-secret settings. Never paste a key into chat, Git or a public form. See draft PR22 docs/W21-checkout-consent.md for exact coordinated migrations/function/legal UI activation and retained evidence. Missing configuration fails closed before creating Stripe checkout/customer state.

W24 is the tax evidence upgrade from the original audit, not account deletion. Full coordinated account deletion/retention is an additional lifecycle blocker. Do not invent retention years or erase linked transaction evidence.

No Automatic Tax switch should be enabled merely to clear the audit: actual registrations and treatment must match the seller. No registration, legal identity or tax determination has been fabricated.

## W19/W25: coordinated working-brand change

Desired customer-facing names after the release is coordinated:
- product/account display brand: Jysen AI;
- monthly product: Jysen AI Monthly;
- annual product: Jysen AI Annual;
- one-time support description: Support Jysen AI.

Preserve existing account, product and Price IDs, price amounts/currency/intervals, subscription history and payment links. Display branding does not change the legal seller name or manufacture a statement descriptor; descriptor changes require the actual seller setup.

Known monthly Price: price_1UCPzSJ78TGxjoZzD8Pc4ppZ.
Known annual Price: price_1UD87kJ78TGxjoZzyIHNEkQG.
Existing support link: plink_1UD8DRJ78TGxjoZzE6ZWhmpy.
Its return URL was already fixed to https://get-avenai.netlify.app/donate.html.

Customer-facing website/desktop and billing still use AVEN. Prepare the rename together with the release rather than leaving different product names across active surfaces. No live billing rename is claimed in this preparation. Working-brand selection also does not constitute trademark clearance.

## W32: latent quota field

The desktop metadata draft PR2 already transports monthly_request_cap accurately (0/150/null). No hosted, operator-paid AI request endpoint or settled quota period/consumption policy has been identified. Ordinary BYOK calls must not consume an invented commercial quota; null is not zero.

Before enforcement can be implemented, define the hosted billable operation and reset/accounting policy. A server quota RPC without a real hosted caller would not protect current BYOK traffic or close W32. Do not enable/promote the trial quota in the meantime. No speculative metering service was added.

## Excluded work

W35 Windows build/installer/OBS/account/billing acceptance is deliberately left outside this request. Desktop PR1/2/3/4 remain drafts. These operator files are outside the site's explicit publishing allowlist and must not be served as public assets.

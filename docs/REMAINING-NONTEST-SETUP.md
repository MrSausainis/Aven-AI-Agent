# Remaining non-test setup

Status updated 2026-10-01: W11 is closed after the owner applied active production protection. Private support and the Jysen AI website presentation are published through PR24, production commit 8a709f257f81b416c37000bf3898ade2fdc0800e. W21 source remains in draft PR22; source completion does not mean live activation. Commercial activation and registration are deferred by the owner.

## W11: production branch protection

The owner applied ruleset 24279878, Protect production website branch. Verified active: only refs/heads/wip/website-compliance-security, no bypass actors, deletion and force-push blocked, PR required, squash-only merge, resolved review threads, zero required approvals. W11 is closed. PR24 was published using an ordinary squash merge under this protection.

ops/production-branch-ruleset.json remains the reviewed setup body. Do not POST it again: that would create duplicate rulesets. Administration access is not needed for normal authorized PR updates. Record and inspect the existing ruleset ID; rollback only that ID if deliberately required.

Official API: https://docs.github.com/en/rest/repos/rules#create-a-repository-ruleset
Settings: https://github.com/MrSausainis/Aven-AI-Agent/settings/rules

## W08: leaked-password protection

Supabase documentation says this hosted feature requires Pro or above. The current project is Free. No subscription upgrade was purchased and no client-side password check is substituted for server enforcement. The owner declined the paid feature for now; keep W08 deferred/open. Do not buy an upgrade or substitute a browser-only check for hosted Auth enforcement. The available connector cannot update Auth configuration.

https://supabase.com/docs/guides/auth/password-security
https://supabase.com/dashboard/project/upiadmvxzphegivqszvp/auth/providers

## W18/W24 and W21: required real operator configuration

Required non-secret operator facts:
- actual legal seller name and geographic address;
- seller country and telephone; support_email is now jysenai.support@gmail.com;
- registration/VAT identifiers only where applicable;
- actual tax registration/regime applicable to the seller;
- verified transactional sender address/domain (the Gmail support contact does not verify a Resend sender).

The owner has deferred registration and commercial launch. Jysen AI is the working product brand, not evidence of a legal seller identity or tax registration. Do not derive a business address/name from personal conversation memory.

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

The current website uses Jysen AI and explains that the existing Windows installer/app/wake word still use AVEN. Existing Terms/Privacy acceptance bytes and archive names are preserved.

Verified live Stripe product names/descriptions now use Jysen AI Monthly, Jysen AI Annual and Support Jysen AI. Existing product/default Price IDs, tier metadata, tax codes, active flags and statement descriptors were verified unchanged. Monthly EUR 2 and annual EUR 20 remain intact. The support Payment Link keeps its existing ID and corrected Netlify return URL.

The Stripe account public business_profile.name still uses Aven AI Agent, its website URL is the old GitHub Pages URL and support_email/support_url are empty. Account branding/contact writes are not exposed by the available connector. W19/W25 therefore remain partially open; product renaming alone does not complete all account/invoice branding. No account legal identity, verification details, statement descriptor, tax treatment or commercial activation was changed. Working-brand selection does not constitute trademark clearance.

Exact remaining public profile values: business_profile.name = Jysen AI; business_profile.support_email = jysenai.support@gmail.com; business_profile.support_url = https://get-avenai.netlify.app/support.html; business_profile.url = https://get-avenai.netlify.app/. Do not apply these to the legal entity or account-login email fields.

## W32: latent quota field

The desktop metadata draft PR2 already transports monthly_request_cap accurately (0/150/null). No hosted, operator-paid AI request endpoint or settled quota period/consumption policy has been identified. Ordinary BYOK calls must not consume an invented commercial quota; null is not zero.

Before enforcement can be implemented, define the hosted billable operation and reset/accounting policy. A server quota RPC without a real hosted caller would not protect current BYOK traffic or close W32. Do not enable/promote the trial quota in the meantime. No speculative metering service was added.

## Excluded work

W35 real Windows/OBS/account/billing acceptance remains outside this request. The previously started automated Windows run 36793793096 for desktop PR4 head 4fbcc197d901bdc796f691911cf832badd2162a7 finished successfully: full regressions, smoke, EXE payload and Inno installer compilation passed. This validates the CI-recovery candidate, not an integrated desktop release or real OBS/user acceptance. Desktop PR1/2/3/4 remain drafts. These operator files are outside the site's explicit publishing allowlist and must not be served as public assets.

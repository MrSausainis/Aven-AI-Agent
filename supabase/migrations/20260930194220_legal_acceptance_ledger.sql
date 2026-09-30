-- W02 foundation. No existing metadata is imported as acceptance evidence.
create schema if not exists jysen_private;
revoke all on schema jysen_private from public, anon, authenticated, service_role;
grant usage on schema jysen_private to authenticated, service_role;

create table jysen_private.legal_releases (
  version text primary key,
  terms_sha256 text not null check (terms_sha256 ~ '^[0-9a-f]{64}$'),
  privacy_sha256 text not null check (privacy_sha256 ~ '^[0-9a-f]{64}$'),
  terms_html text not null,
  privacy_html text not null,
  published_at timestamptz not null default clock_timestamp(),
  is_current boolean not null default false,
  check (terms_sha256 = encode(sha256(convert_to(terms_html,'UTF8')),'hex')),
  check (privacy_sha256 = encode(sha256(convert_to(privacy_html,'UTF8')),'hex'))
);
create unique index legal_releases_one_current on jysen_private.legal_releases ((is_current)) where is_current;
alter table jysen_private.legal_releases enable row level security;
revoke all on jysen_private.legal_releases from public, anon, authenticated, service_role;
grant select on jysen_private.legal_releases to service_role;

insert into jysen_private.legal_releases(version,terms_sha256,privacy_sha256,terms_html,privacy_html,is_current)
values ('2026-09-30.1','3390697fbee06f6aec3b48b3dbf37366c7a7b31895d77a1007e12155d2b62eb7','fbef50b2959feef42de1cfa7ef920d4ecefbfeeca7d1e0972c3d8fa35124eac6',
$terms_archive$<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' https://api.github.com https://upiadmvxzphegivqszvp.supabase.co; object-src 'none'; base-uri 'self'; form-action 'self'; upgrade-insecure-requests" />
<meta name="referrer" content="strict-origin-when-cross-origin" />
<meta name="color-scheme" content="dark" />
<link rel="icon" href="favicon.svg" type="image/svg+xml" />
<meta name="description" content="Rules for using the AvenAI website, account service and distributed Windows application." /><meta name="theme-color" content="#05080d" /><link rel="canonical" href="https://get-avenai.netlify.app/terms.html" /><title>Terms of service — AvenAI</title><link rel="stylesheet" href="site.css" /></head>
<body><a class="skip-link" href="#main-content">Skip to content</a><header class="site-header"><div class="shell"><a class="brand" href="index.html" aria-label="AvenAI home"><span class="brand-mark">AI</span><span class="brand-word">AvenAI</span></a><div class="header-actions"><a class="btn btn-quiet" href="index.html">Back to product</a><a class="btn btn-secondary" href="account.html">Account</a></div></div></header>
<main class="legal-page" id="main-content"><div class="legal-shell"><section class="legal-hero"><div class="dash-kicker">Trust & legal</div><h1>Terms of service</h1><p>Rules for using the AvenAI website, account service and distributed Windows application.</p><div class="legal-meta">Last updated: 29 September 2026</div></section><div class="legal-grid"><nav class="legal-nav" aria-label="Legal and trust pages"><a href="privacy.html">Privacy</a><a href="terms.html" aria-current="page">Terms</a><a href="refunds.html">Refunds</a><a href="cookies.html">Tracking</a><a href="security.html">Security</a><a href="accessibility.html">Accessibility</a></nav><article class="legal-content"><section class="legal-section"><h2>1. Scope and status</h2><p>These terms cover the AvenAI website, account features and software distributed through official GitHub releases. AvenAI is under active development and some features are beta or may change.</p><div class="legal-callout warn">Before general paid launch, the operator/trader's legal identity, address and private support contact must be published. Mandatory consumer rights are not waived by these terms.</div></section><section class="legal-section"><h2>2. Accounts</h2><p>You are responsible for keeping login credentials secure and for information submitted through your account. Basic desktop use may be available without an account.</p></section><section class="legal-section"><h2>3. AI providers and BYOK</h2><p>AvenAI can use third-party AI or speech providers configured by the user. Their terms, pricing, quotas and privacy rules may apply separately.</p></section><section class="legal-section"><h2>4. Desktop actions</h2><p>You remain responsible for approving risky actions, keeping backups and reviewing important results. Do not rely on the software where failure could create unacceptable safety or legal consequences.</p></section><section class="legal-section"><h2>5. Paid plans</h2><p>Where paid plans are offered, price, billing interval and applicable taxes are shown before checkout. Stripe processes payments. See <a href="refunds.html">Refunds &amp; withdrawal</a>.</p></section><section class="legal-section"><h2>6. Reviews</h2><p>Submitting a review asks AvenAI to display the rating, review text and public account name. Do not submit illegal, abusive, infringing or private information belonging to someone else. You can edit or delete your own review.</p></section><section class="legal-section"><h2>7. Acceptable use</h2><p>Do not use the service to attack systems, bypass access controls, distribute malware, commit fraud, abuse third-party services or tamper with plan entitlements.</p></section><section class="legal-section"><h2>8. Consumer rights</h2><p>Nothing in these terms excludes rights that cannot legally be excluded, including mandatory EU consumer protections. Any limitation of liability applies only to the extent permitted by law.</p></section><section class="legal-section"><h2>9. Governing framework</h2><p>The project is operated from Lithuania and these terms are intended to be interpreted consistently with Lithuanian and applicable EU law, without depriving consumers of mandatory protections available to them.</p></section></article></div></div></main>
<footer class="site-footer"><div class="shell"><span>AvenAI · independent Windows software project</span><div class="footer-links"><a href="privacy.html">Privacy</a>
      <a href="terms.html">Terms</a>
      <a href="refunds.html">Refunds</a>
      <a href="cookies.html">Tracking</a>
      <a href="security.html">Security</a>
      <a href="accessibility.html">Accessibility</a><a href="https://github.com/MrSausainis/Aven-AI-Agent/issues">Support</a></div></div></footer></body></html>$terms_archive$,
$privacy_archive$<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' https://api.github.com https://upiadmvxzphegivqszvp.supabase.co; object-src 'none'; base-uri 'self'; form-action 'self'; upgrade-insecure-requests" />
<meta name="referrer" content="strict-origin-when-cross-origin" />
<meta name="color-scheme" content="dark" />
<link rel="icon" href="favicon.svg" type="image/svg+xml" />
<meta name="description" content="How AvenAI handles website and account data, and how desktop Local inference differs from the separate Local-only privacy setting." /><meta name="theme-color" content="#05080d" /><link rel="canonical" href="https://get-avenai.netlify.app/privacy.html" /><title>Privacy notice — AvenAI</title><link rel="stylesheet" href="site.css" /></head>
<body><a class="skip-link" href="#main-content">Skip to content</a><header class="site-header"><div class="shell"><a class="brand" href="index.html" aria-label="AvenAI home"><span class="brand-mark">AI</span><span class="brand-word">AvenAI</span></a><div class="header-actions"><a class="btn btn-quiet" href="index.html">Back to product</a><a class="btn btn-secondary" href="account.html">Account</a></div></div></header>
<main class="legal-page" id="main-content"><div class="legal-shell"><section class="legal-hero"><div class="dash-kicker">Trust & legal</div><h1>Privacy notice</h1><p>How the website and account service handle personal data, and how desktop inference and privacy settings affect cloud requests.</p><div class="legal-meta">Last updated: 30 September 2026</div></section><div class="legal-grid"><nav class="legal-nav" aria-label="Legal and trust pages"><a href="privacy.html" aria-current="page">Privacy</a><a href="terms.html">Terms</a><a href="refunds.html">Refunds</a><a href="cookies.html">Tracking</a><a href="security.html">Security</a><a href="accessibility.html">Accessibility</a></nav><article class="legal-content"><section class="legal-section"><h2>1. Who operates this service</h2><p>AvenAI is currently an independent software project published by the maintainer of the GitHub account <a href="https://github.com/MrSausainis">MrSausainis</a>. Ordinary support is handled through the project issue tracker.</p><div class="legal-callout warn"><strong>Before general commercial launch:</strong> the site must publish the legal trader/controller identity, geographic contact details and a private privacy-contact channel. Do not post sensitive personal data in a public GitHub issue; if you need privacy help now, open a minimal issue asking for a private contact route.</div></section>
<section class="legal-section"><h2>2. Data the website uses</h2><h3>Visitors</h3><p>The site code does not load advertising pixels or analytics trackers. The homepage requests public release metadata from GitHub and public AvenAI reviews from Supabase. Hosting and network providers may keep normal security/server logs under their own policies.</p><h3>Accounts</h3><ul><li>Email address, Supabase authentication identifier and optional phone number when present on your account.</li><li>Public account name, sign-in account dates and user-provided account metadata.</li><li>Preferred theme.</li><li>Plan entitlement, source and expiry.</li><li>Stripe customer and subscription identifiers and subscription status for paid subscriptions.</li><li>Review rating/text when you choose to publish a review.</li></ul><h3>Payments</h3><p>Stripe handles checkout and payment-card information. New subscription checkouts require a billing address, which Stripe saves to your Stripe customer record for subscription billing and invoices. Previously opened checkout links may use the earlier address-collection settings. AvenAI stores Stripe customer/subscription identifiers, subscription status and entitlement state needed to grant plan access; this website does not store card numbers.</p><h3>Desktop data</h3><p>This website does not automatically receive your desktop conversations, long-term memory, microphone audio, local AI models or personal API keys. If the desktop app uses a cloud AI/STT provider you configure, that provider receives the data needed for that request under its own terms and privacy information.</p><h3 id="desktop-modes">Local inference and Local-only privacy</h3><p><strong>Local inference</strong> selects a model running on your computer. It does not, by itself, block cloud requests: configured services such as voice transcription, speech output, web search or AI fallback may still contact external providers.</p><p><strong>Local-only</strong> is a separate desktop privacy setting that blocks cloud AI, cloud voice processing and web-search requests. If the required local component is unavailable or fails, the app refuses that cloud request rather than silently sending it to a provider. Enable this setting explicitly; selecting Local inference alone does not turn it on.</p><p>Local-only is not an internet-disconnection setting. Account and billing access, software or model downloads, updates and optional integrations have separate network needs. Obtain the required local models and voice components before relying on local processing. This setting does not control the privacy practices of other apps or services you choose to open.</p></section>
<section class="legal-section"><h2>3. Why data is used</h2><p>Account and entitlement data is used to provide the account/service you request. Security and abuse-prevention data may be used to protect the service. A public review is displayed because you choose to submit it. If marketing or non-essential analytics are introduced later, they will use an appropriate legal basis and this notice will be updated before they are enabled.</p></section>
<section class="legal-section"><h2>4. Storage and retention</h2><p>Account profile and entitlement data is kept while the account is active and as reasonably needed to operate the service. Reviews remain public until you edit or delete them. Billing and transaction records may be retained by Stripe and/or the operator where tax, accounting, fraud-prevention or legal obligations require it.</p></section>
<section class="legal-section"><h2>5. Service providers</h2><ul><li><strong>Netlify</strong> — website hosting and delivery.</li><li><strong>GitHub / GitHub API</strong> — releases and public project infrastructure.</li><li><strong>Supabase</strong> — authentication and account database. The current project is configured in an EU region (eu-central-1).</li><li><strong>Stripe</strong> — checkout, subscription billing and payment processing.</li></ul></section>
<section class="legal-section"><h2>6. Your choices and rights</h2><p>Depending on applicable law, you may have rights to access, correct, delete, restrict, object to certain processing, obtain a portable copy, or withdraw consent where consent is the basis.</p><p>Signed-in users can download a basic account export and delete their public review from <a href="account.html">Account &amp; security</a>. The export includes the profile, plan and Stripe billing identifiers, review and selected authentication fields including user-provided metadata. It excludes payment-provider records, server logs, authentication/session tokens and desktop data. Full account deletion requires server-side coordination so active billing and legally required records are handled correctly; this remains a pre-launch blocker.</p></section>
<section class="legal-section" id="tracking"><h2>7. Browser storage and tracking</h2><p>When you sign in, Supabase Auth persists your session in browser storage so the account page can remember the login. The site code currently has no advertising or analytics tracker and therefore does not present a non-essential tracking-consent banner. See the <a href="cookies.html">Tracking notice</a>.</p></section>
<section class="legal-section"><h2>8. Security</h2><p>Public database access is controlled with Supabase Row Level Security. The website uses a publishable Supabase key, which is designed to be public; private/service-role credentials are not placed in the frontend. See the <a href="security.html">Security page</a>.</p></section></article></div></div></main>
<footer class="site-footer"><div class="shell"><span>AvenAI · independent Windows software project</span><div class="footer-links"><a href="privacy.html">Privacy</a>
      <a href="terms.html">Terms</a>
      <a href="refunds.html">Refunds</a>
      <a href="cookies.html">Tracking</a>
      <a href="security.html">Security</a>
      <a href="accessibility.html">Accessibility</a><a href="https://github.com/MrSausainis/Aven-AI-Agent/issues">Support</a></div></div></footer></body></html>
$privacy_archive$,true);

create table public.legal_acceptances (
  user_id uuid not null references auth.users(id) on delete cascade,
  version text not null references jysen_private.legal_releases(version),
  terms_sha256 text not null,
  privacy_sha256 text not null,
  accepted_at timestamptz not null default clock_timestamp(),
  source text not null check (source = 'authenticated_confirmation'),
  primary key(user_id,version)
);
alter table public.legal_acceptances enable row level security;
revoke all on public.legal_acceptances from public, anon, authenticated, service_role;
grant select on public.legal_acceptances to authenticated, service_role;
create policy legal_acceptances_select_own on public.legal_acceptances
  for select to authenticated using ((select auth.uid()) = user_id);

-- Definers live outside the exposed public schema. They are needed because
-- authenticated clients cannot INSERT the ledger or read archived document bodies.
create function jysen_private.legal_status()
returns jsonb language plpgsql stable security definer set search_path = ''
as $function$
declare uid uuid := auth.uid(); release jysen_private.legal_releases%rowtype; accepted timestamptz;
begin
  if uid is null or not exists(select 1 from auth.users where id=uid and email_confirmed_at is not null and not coalesce(is_anonymous,false)) then
    raise exception 'A confirmed account is required' using errcode='42501';
  end if;
  select * into strict release from jysen_private.legal_releases where is_current;
  select accepted_at into accepted from public.legal_acceptances where user_id=uid and version=release.version;
  return jsonb_build_object('version',release.version,'terms_sha256',release.terms_sha256,
    'privacy_sha256',release.privacy_sha256,'accepted',accepted is not null,'accepted_at',accepted);
end $function$;

create function jysen_private.accept_legal(
  p_version text, p_terms_sha256 text, p_privacy_sha256 text, p_accept_terms boolean, p_ack_privacy boolean
) returns jsonb language plpgsql security definer set search_path = ''
as $function$
declare uid uuid := auth.uid(); release jysen_private.legal_releases%rowtype; accepted timestamptz;
begin
  if uid is null or not exists(select 1 from auth.users where id=uid and email_confirmed_at is not null and not coalesce(is_anonymous,false)) then
    raise exception 'A confirmed account is required' using errcode='42501';
  end if;
  if p_accept_terms is distinct from true or p_ack_privacy is distinct from true then
    raise exception 'Explicit Terms acceptance and Privacy acknowledgement are required' using errcode='22023';
  end if;
  select * into strict release from jysen_private.legal_releases where is_current for share;
  if p_version is distinct from release.version or p_terms_sha256 is distinct from release.terms_sha256
      or p_privacy_sha256 is distinct from release.privacy_sha256 then
    raise exception 'Document version changed; reload before confirming' using errcode='22023';
  end if;
  insert into public.legal_acceptances(user_id,version,terms_sha256,privacy_sha256,accepted_at,source)
    values(uid,release.version,release.terms_sha256,release.privacy_sha256,clock_timestamp(),'authenticated_confirmation')
    on conflict(user_id,version) do nothing;
  select accepted_at into strict accepted from public.legal_acceptances where user_id=uid and version=release.version;
  return jsonb_build_object('version',release.version,'terms_sha256',release.terms_sha256,
    'privacy_sha256',release.privacy_sha256,'accepted',true,'accepted_at',accepted);
end $function$;

revoke all on function jysen_private.legal_status() from public, anon, authenticated, service_role;
revoke all on function jysen_private.accept_legal(text,text,text,boolean,boolean) from public, anon, authenticated, service_role;
grant execute on function jysen_private.legal_status() to authenticated;
grant execute on function jysen_private.accept_legal(text,text,text,boolean,boolean) to authenticated;

create function public.get_legal_acceptance_status()
returns jsonb language sql stable security invoker set search_path = ''
as $function$ select jysen_private.legal_status() $function$;
create function public.accept_current_legal(
  p_version text, p_terms_sha256 text, p_privacy_sha256 text, p_accept_terms boolean, p_ack_privacy boolean
) returns jsonb language sql security invoker set search_path = ''
as $function$ select jysen_private.accept_legal(p_version,p_terms_sha256,p_privacy_sha256,p_accept_terms,p_ack_privacy) $function$;
revoke all on function public.get_legal_acceptance_status() from public, anon, authenticated, service_role;
revoke all on function public.accept_current_legal(text,text,text,boolean,boolean) from public, anon, authenticated, service_role;
grant execute on function public.get_legal_acceptance_status() to authenticated;
grant execute on function public.accept_current_legal(text,text,text,boolean,boolean) to authenticated;

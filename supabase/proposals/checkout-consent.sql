-- W21 foundation: separate, versioned early-access evidence per purchase intent.
-- No withdrawal waiver is inferred; integration must retain statutory rights.
create table jysen_private.checkout_consent_policies (
  version text primary key,
  request_text text not null,
  rights_notice text not null,
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  is_current boolean not null default false,
  check (sha256 = encode(sha256(convert_to(request_text || E'\n' || rights_notice, 'UTF8')), 'hex'))
);
create unique index checkout_consent_one_current on jysen_private.checkout_consent_policies(is_current) where is_current;
alter table jysen_private.checkout_consent_policies enable row level security;
revoke all on jysen_private.checkout_consent_policies from public,anon,authenticated,service_role;
grant select on jysen_private.checkout_consent_policies to service_role;

insert into jysen_private.checkout_consent_policies(version,request_text,rights_notice,sha256,is_current)
select '2026-10-01.early-access.1', request_text, rights_notice,
  encode(sha256(convert_to(request_text || E'\n' || rights_notice,'UTF8')),'hex'), true
from (values (
  'I expressly request paid access to start immediately after successful checkout, before the applicable withdrawal period ends.',
  'This request does not by itself waive my statutory withdrawal or refund rights. Any lawful exception needs its own applicable conditions and confirmation; activating a recurring subscription is not automatically full performance.'
)) as wording(request_text,rights_notice);

create table public.checkout_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  plan text not null check (plan in ('monthly','annual')),
  price_id text not null,
  policy_version text not null references jysen_private.checkout_consent_policies(version),
  policy_sha256 text not null,
  request_text text not null,
  rights_notice text not null,
  legal_version text not null references jysen_private.legal_releases(version),
  terms_sha256 text not null,
  privacy_sha256 text not null,
  requested_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null,
  source text not null check (source='authenticated_purchase_confirmation'),
  rights_preserved boolean not null default true check (rights_preserved),
  unique(user_id,request_id)
);
alter table public.checkout_consents enable row level security;
revoke all on public.checkout_consents from public,anon,authenticated,service_role;
grant select on public.checkout_consents to authenticated,service_role;
create policy checkout_consents_select_own on public.checkout_consents
  for select to authenticated using ((select auth.uid())=user_id);

-- A separate append-only binding does not rewrite the user's evidence.
create table jysen_private.checkout_consent_bindings (
  consent_id uuid primary key references public.checkout_consents(id),
  attempt_id uuid not null unique,
  bound_at timestamptz not null default clock_timestamp()
);
alter table jysen_private.checkout_consent_bindings enable row level security;
revoke all on jysen_private.checkout_consent_bindings from public,anon,authenticated,service_role;
grant select on jysen_private.checkout_consent_bindings to service_role;

create function jysen_private.checkout_consent_policy()
returns jsonb language plpgsql stable security definer set search_path=''
as $fn$
declare legal jsonb; policy jysen_private.checkout_consent_policies%rowtype;
begin
  legal:=jysen_private.legal_status(); -- checks real confirmed, non-anonymous account
  select * into strict policy from jysen_private.checkout_consent_policies where is_current;
  return jsonb_build_object('user_id',auth.uid(),'version',policy.version,'sha256',policy.sha256,
    'request_text',policy.request_text,'rights_notice',policy.rights_notice,
    'rights_preserved',true,'legal_version',legal->>'version','terms_accepted',legal->'accepted');
end $fn$;

create function jysen_private.record_checkout_consent(
  p_plan text,p_policy_version text,p_policy_sha256 text,
  p_request_early_access boolean,p_ack_rights_notice boolean,p_request_id uuid
) returns jsonb language plpgsql security definer set search_path=''
as $fn$
declare uid uuid:=auth.uid(); legal jsonb; policy jysen_private.checkout_consent_policies%rowtype;
  rec public.checkout_consents%rowtype; price text;
begin
  legal:=jysen_private.legal_status();
  if legal->>'accepted' is distinct from 'true' then
    raise exception 'Confirm current Terms separately first' using errcode='42501';
  end if;
  if p_request_early_access is distinct from true or p_ack_rights_notice is distinct from true or p_request_id is null then
    raise exception 'Separate explicit early-access request and rights acknowledgement required' using errcode='22023';
  end if;
  price:=case p_plan when 'monthly' then 'price_1UCPzSJ78TGxjoZzD8Pc4ppZ'
    when 'annual' then 'price_1UD87kJ78TGxjoZzyIHNEkQG' else null end;
  if price is null then raise exception 'Unknown plan' using errcode='22023'; end if;
  select * into strict policy from jysen_private.checkout_consent_policies where is_current for share;
  if p_policy_version is distinct from policy.version or p_policy_sha256 is distinct from policy.sha256 then
    raise exception 'Consent notice changed; reload before confirming' using errcode='22023';
  end if;
  -- Serialize new intents per account; idempotent retries do not consume quota.
  perform pg_advisory_xact_lock(hashtextextended(uid::text,21021));
  if not exists(select 1 from public.checkout_consents where user_id=uid and request_id=p_request_id)
      and (select count(*) from public.checkout_consents where user_id=uid
        and requested_at>clock_timestamp()-interval '10 minutes')>=10 then
    raise exception 'Too many purchase requests; wait before trying again' using errcode='54000';
  end if;
  insert into public.checkout_consents(user_id,request_id,plan,price_id,policy_version,policy_sha256,
    request_text,rights_notice,legal_version,terms_sha256,privacy_sha256,requested_at,expires_at,source)
  values(uid,p_request_id,p_plan,price,policy.version,policy.sha256,policy.request_text,policy.rights_notice,
    legal->>'version',legal->>'terms_sha256',legal->>'privacy_sha256',clock_timestamp(),
    clock_timestamp()+interval '30 minutes','authenticated_purchase_confirmation')
  on conflict(user_id,request_id) do nothing;
  select * into strict rec from public.checkout_consents where user_id=uid and request_id=p_request_id;
  if rec.plan is distinct from p_plan or rec.policy_version is distinct from policy.version
      or rec.policy_sha256 is distinct from policy.sha256 or rec.legal_version is distinct from legal->>'version'
      or rec.expires_at<=clock_timestamp() then
    raise exception 'Purchase intent changed or expired; confirm a new request' using errcode='22023';
  end if;
  return to_jsonb(rec);
end $fn$;

create function jysen_private.validate_checkout_consent(p_consent_id uuid,p_plan text)
returns jsonb language plpgsql stable security definer set search_path=''
as $fn$
declare legal jsonb; rec public.checkout_consents%rowtype; policy jysen_private.checkout_consent_policies%rowtype;
begin
  legal:=jysen_private.legal_status();
  select * into strict policy from jysen_private.checkout_consent_policies where is_current;
  select * into rec from public.checkout_consents where id=p_consent_id and user_id=auth.uid();
  if rec.id is null or rec.plan is distinct from p_plan
      or rec.policy_version is distinct from policy.version or rec.policy_sha256 is distinct from policy.sha256
      or rec.legal_version is distinct from legal->>'version' or legal->>'accepted' is distinct from 'true' then
    raise exception 'No current matching purchase consent' using errcode='42501';
  end if;
  -- Expired intents may only recover the already-bound, still persisted attempt.
  -- They can never authorize a replacement attempt or a new purchase.
  if rec.expires_at<=clock_timestamp() and not exists(
    select 1 from jysen_private.checkout_consent_bindings b
    join public.checkout_attempts a on a.user_id=rec.user_id
    where b.consent_id=rec.id and a.attempt->>'id'=b.attempt_id::text
      and a.attempt->>'consentId'=rec.id::text and a.attempt->>'plan'=p_plan
      and (a.attempt->>'startedAt')::numeric > extract(epoch from clock_timestamp()-interval '23 hours')*1000
  ) then raise exception 'Purchase consent expired' using errcode='42501'; end if;
  return to_jsonb(rec)||jsonb_build_object('bound_attempt_id',
    (select attempt_id from jysen_private.checkout_consent_bindings where consent_id=rec.id));
end $fn$;

create function jysen_private.bind_checkout_consent(p_user_id uuid,p_token uuid,p_consent_id uuid,p_attempt_id uuid,p_plan text)
returns jsonb language plpgsql security definer set search_path=''
as $fn$
declare lease public.checkout_attempts%rowtype; rec public.checkout_consents%rowtype;
  policy jysen_private.checkout_consent_policies%rowtype; release jysen_private.legal_releases%rowtype;
  existing jysen_private.checkout_consent_bindings%rowtype;
begin
  if p_user_id is null or p_token is null or p_consent_id is null or p_attempt_id is null then
    raise exception 'Binding identifiers required' using errcode='22023';
  end if;
  if not exists(select 1 from auth.users where id=p_user_id and email_confirmed_at is not null
      and is_anonymous is not true) then
    raise exception 'Confirmed non-anonymous account required' using errcode='42501';
  end if;
  select * into lease from public.checkout_attempts where user_id=p_user_id for update;
  if lease.user_id is null or lease.lease_token is distinct from p_token or lease.lease_expires_at<=clock_timestamp()
      or lease.attempt->>'id' is distinct from p_attempt_id::text or lease.attempt->>'plan' is distinct from p_plan
      or lease.attempt->>'consentId' is distinct from p_consent_id::text then
    raise exception 'Checkout lease or immutable attempt mismatch' using errcode='42501';
  end if;
  select * into strict policy from jysen_private.checkout_consent_policies where is_current for share;
  select * into strict release from jysen_private.legal_releases where is_current for share;
  select * into rec from public.checkout_consents where id=p_consent_id and user_id=p_user_id for update;
  if rec.id is null or rec.plan is distinct from p_plan or rec.policy_version is distinct from policy.version
      or rec.policy_sha256 is distinct from policy.sha256 or rec.legal_version is distinct from release.version
      or not exists(select 1 from public.legal_acceptances where user_id=p_user_id and version=release.version) then
    raise exception 'No matching consent evidence' using errcode='42501';
  end if;
  select * into existing from jysen_private.checkout_consent_bindings where consent_id=p_consent_id;
  if existing.consent_id is not null then
    if existing.attempt_id is distinct from p_attempt_id then
      raise exception 'Consent already bound to another purchase' using errcode='42501';
    end if;
    return to_jsonb(existing); -- retries retain their original evidence/time
  end if;
  if rec.expires_at<=clock_timestamp() then raise exception 'Purchase consent expired' using errcode='42501'; end if;
  insert into jysen_private.checkout_consent_bindings(consent_id,attempt_id)
    values(p_consent_id,p_attempt_id) returning * into existing;
  return to_jsonb(existing);
end $fn$;

revoke all on function jysen_private.checkout_consent_policy() from public,anon,authenticated,service_role;
revoke all on function jysen_private.record_checkout_consent(text,text,text,boolean,boolean,uuid) from public,anon,authenticated,service_role;
revoke all on function jysen_private.validate_checkout_consent(uuid,text) from public,anon,authenticated,service_role;
revoke all on function jysen_private.bind_checkout_consent(uuid,uuid,uuid,uuid,text) from public,anon,authenticated,service_role;
grant execute on function jysen_private.checkout_consent_policy() to authenticated;
grant execute on function jysen_private.record_checkout_consent(text,text,text,boolean,boolean,uuid) to authenticated;
grant execute on function jysen_private.validate_checkout_consent(uuid,text) to authenticated;
grant execute on function jysen_private.bind_checkout_consent(uuid,uuid,uuid,uuid,text) to service_role;

create function public.get_checkout_consent_policy() returns jsonb language sql stable security invoker set search_path=''
as $fn$ select jysen_private.checkout_consent_policy() $fn$;
create function public.record_checkout_consent(p_plan text,p_policy_version text,p_policy_sha256 text,p_request_early_access boolean,p_ack_rights_notice boolean,p_request_id uuid)
returns jsonb language sql security invoker set search_path=''
as $fn$ select jysen_private.record_checkout_consent(p_plan,p_policy_version,p_policy_sha256,p_request_early_access,p_ack_rights_notice,p_request_id) $fn$;
create function public.get_checkout_consent(p_consent_id uuid,p_plan text) returns jsonb language sql stable security invoker set search_path=''
as $fn$ select jysen_private.validate_checkout_consent(p_consent_id,p_plan) $fn$;
create function public.bind_checkout_consent(p_user_id uuid,p_token uuid,p_consent_id uuid,p_attempt_id uuid,p_plan text)
returns jsonb language sql security invoker set search_path=''
as $fn$ select jysen_private.bind_checkout_consent(p_user_id,p_token,p_consent_id,p_attempt_id,p_plan) $fn$;
revoke all on function public.get_checkout_consent_policy() from public,anon,authenticated,service_role;
revoke all on function public.record_checkout_consent(text,text,text,boolean,boolean,uuid) from public,anon,authenticated,service_role;
revoke all on function public.get_checkout_consent(uuid,text) from public,anon,authenticated,service_role;
revoke all on function public.bind_checkout_consent(uuid,uuid,uuid,uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.get_checkout_consent_policy() to authenticated;
grant execute on function public.record_checkout_consent(text,text,text,boolean,boolean,uuid) to authenticated;
grant execute on function public.get_checkout_consent(uuid,text) to authenticated;
grant execute on function public.bind_checkout_consent(uuid,uuid,uuid,uuid,text) to service_role;

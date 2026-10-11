-- Requires purchase-legal-release.sql and checkout-consent.sql first.
-- Contracts are append-only; delivery status is a separate restricted record.
create table public.purchase_confirmations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  consent_id uuid not null unique references public.checkout_consents(id),
  session_id text not null unique,
  recipient_email text not null,
  payload_text text not null,
  sha256 text not null check(sha256=encode(sha256(convert_to(payload_text,'UTF8')),'hex')),
  created_at timestamptz not null default clock_timestamp(),
  check((payload_text::jsonb)->>'user_id'=user_id::text),
  check((payload_text::jsonb)->>'session_id'=session_id)
);
alter table public.purchase_confirmations enable row level security;
revoke all on public.purchase_confirmations from public,anon,authenticated,service_role;
grant select on public.purchase_confirmations to authenticated,service_role;
create policy purchase_confirmations_own on public.purchase_confirmations for select to authenticated using((select auth.uid())=user_id);
create table jysen_private.purchase_confirmation_deliveries (
  confirmation_id uuid primary key references public.purchase_confirmations(id),
  from_address text not null,
  first_started_at timestamptz,
  lease_token uuid,
  lease_expires_at timestamptz,
  provider_id text,
  provider_accepted_at timestamptz,
  email_payload jsonb
);
alter table jysen_private.purchase_confirmation_deliveries enable row level security;
revoke all on jysen_private.purchase_confirmation_deliveries from public,anon,authenticated,service_role;
grant select on jysen_private.purchase_confirmation_deliveries to service_role;

create function jysen_private.archive_purchase_confirmation(p_user_id uuid,p_session_id text,p_subscription_id text,p_customer_id text,
  p_consent_id uuid,p_attempt_id uuid,p_amount_total bigint,p_currency text,p_invoice_id text)
returns jsonb language plpgsql security definer set search_path=''
as $fn$
declare consent public.checkout_consents%rowtype; binding jysen_private.checkout_consent_bindings%rowtype;
  rec public.purchase_confirmations%rowtype; document text; accepted timestamptz;
begin
  if p_session_id is null or p_subscription_id is null or p_customer_id is null or p_amount_total is null or p_amount_total<0
      or p_currency is null or p_currency!~'^[a-z]{3}$' then raise exception 'Invalid paid confirmation' using errcode='22023'; end if;
  select * into consent from public.checkout_consents where id=p_consent_id and user_id=p_user_id for update;
  select * into binding from jysen_private.checkout_consent_bindings where consent_id=p_consent_id and attempt_id=p_attempt_id;
  if consent.id is null or binding.consent_id is null or binding.offer->'price'->>'currency' is distinct from p_currency
      or not exists(select 1 from public.entitlements where id=p_user_id and stripe_customer_id=p_customer_id) then
    raise exception 'Confirmation owner, binding or currency mismatch' using errcode='42501';
  end if;
  document:=jsonb_build_object('schema_version',1,'kind','paid_purchase_confirmation','user_id',p_user_id,
    'session_id',p_session_id,'subscription_id',p_subscription_id,'customer_id',p_customer_id,'invoice_id',p_invoice_id,
    'amount_total',p_amount_total,'currency',p_currency,'plan',consent.plan,
    'consent',to_jsonb(consent),'offer',binding.offer,'documents',binding.documents,
    'rights_preserved',true)::text;
  insert into public.purchase_confirmations(user_id,consent_id,session_id,recipient_email,payload_text,sha256)
    values(p_user_id,p_consent_id,p_session_id,binding.recipient_email,document,encode(sha256(convert_to(document,'UTF8')),'hex'))
    on conflict(consent_id) do nothing;
  select * into strict rec from public.purchase_confirmations where consent_id=p_consent_id;
  if rec.session_id is distinct from p_session_id or rec.payload_text is distinct from document then
    raise exception 'Paid confirmation identity or amount changed' using errcode='42501';
  end if;
  insert into jysen_private.purchase_confirmation_deliveries(confirmation_id,from_address)
    values(rec.id,binding.offer->>'confirmation_from') on conflict do nothing;
  select provider_accepted_at into accepted from jysen_private.purchase_confirmation_deliveries where confirmation_id=rec.id;
  return to_jsonb(rec)||jsonb_build_object('payload',rec.payload_text::jsonb,'provider_accepted_at',accepted);
end $fn$;

create function jysen_private.claim_purchase_confirmation_delivery(p_confirmation_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $fn$
declare rec jysen_private.purchase_confirmation_deliveries%rowtype; token uuid:=gen_random_uuid();
begin
  select * into strict rec from jysen_private.purchase_confirmation_deliveries where confirmation_id=p_confirmation_id for update;
  if rec.provider_accepted_at is not null then return jsonb_build_object('state','accepted'); end if;
  if rec.first_started_at<=clock_timestamp()-interval '23 hours' then return jsonb_build_object('state','needs_reconciliation'); end if;
  if rec.lease_expires_at>clock_timestamp() then return jsonb_build_object('state','busy'); end if;
  update jysen_private.purchase_confirmation_deliveries set first_started_at=coalesce(first_started_at,clock_timestamp()),
    lease_token=token,lease_expires_at=clock_timestamp()+interval '60 seconds' where confirmation_id=p_confirmation_id;
  return jsonb_build_object('state','claimed','token',token,'from_address',rec.from_address);
end $fn$;
create function jysen_private.accept_purchase_confirmation_delivery(p_confirmation_id uuid,p_token uuid,p_provider_id text)
returns jsonb language plpgsql security definer set search_path=''
as $fn$
begin
  if p_provider_id is null or p_provider_id='' then raise exception 'Provider acknowledgement required' using errcode='22023'; end if;
  update jysen_private.purchase_confirmation_deliveries set provider_id=p_provider_id,provider_accepted_at=clock_timestamp(),lease_token=null,lease_expires_at=null
    where confirmation_id=p_confirmation_id and lease_token=p_token and lease_expires_at>clock_timestamp()
      and provider_accepted_at is null and email_payload is not null;
  if not found then raise exception 'Confirmation delivery lease lost' using errcode='42501'; end if;
  return jsonb_build_object('accepted',true);
end $fn$;
create function jysen_private.purge_unused_purchase_intents()
returns integer language plpgsql security definer set search_path=''
as $fn$
declare removed integer;
begin
  delete from public.checkout_consents c where c.id in (
    select c.id from public.checkout_consents c where c.expires_at<clock_timestamp()-interval '30 days'
      and not exists(select 1 from jysen_private.checkout_consent_bindings b where b.consent_id=c.id)
    order by c.expires_at limit 500 for update skip locked);
  get diagnostics removed=row_count; return removed;
end $fn$;

revoke all on function jysen_private.archive_purchase_confirmation(uuid,text,text,text,uuid,uuid,bigint,text,text) from public,anon,authenticated,service_role;
revoke all on function jysen_private.claim_purchase_confirmation_delivery(uuid) from public,anon,authenticated,service_role;
revoke all on function jysen_private.accept_purchase_confirmation_delivery(uuid,uuid,text) from public,anon,authenticated,service_role;
revoke all on function jysen_private.purge_unused_purchase_intents() from public,anon,authenticated,service_role;
grant execute on function jysen_private.archive_purchase_confirmation(uuid,text,text,text,uuid,uuid,bigint,text,text) to service_role;
grant execute on function jysen_private.claim_purchase_confirmation_delivery(uuid) to service_role;
grant execute on function jysen_private.accept_purchase_confirmation_delivery(uuid,uuid,text) to service_role;
grant execute on function jysen_private.purge_unused_purchase_intents() to service_role;
create function public.archive_purchase_confirmation(p_user_id uuid,p_session_id text,p_subscription_id text,p_customer_id text,p_consent_id uuid,p_attempt_id uuid,p_amount_total bigint,p_currency text,p_invoice_id text)
returns jsonb language sql security invoker set search_path='' as $fn$ select jysen_private.archive_purchase_confirmation(p_user_id,p_session_id,p_subscription_id,p_customer_id,p_consent_id,p_attempt_id,p_amount_total,p_currency,p_invoice_id) $fn$;
create function public.claim_purchase_confirmation_delivery(p_confirmation_id uuid) returns jsonb language sql security invoker set search_path=''
as $fn$ select jysen_private.claim_purchase_confirmation_delivery(p_confirmation_id) $fn$;
create function public.accept_purchase_confirmation_delivery(p_confirmation_id uuid,p_token uuid,p_provider_id text) returns jsonb language sql security invoker set search_path=''
as $fn$ select jysen_private.accept_purchase_confirmation_delivery(p_confirmation_id,p_token,p_provider_id) $fn$;
create function public.purge_unused_purchase_intents() returns integer language sql security invoker set search_path=''
as $fn$ select jysen_private.purge_unused_purchase_intents() $fn$;
revoke all on function public.archive_purchase_confirmation(uuid,text,text,text,uuid,uuid,bigint,text,text) from public,anon,authenticated,service_role;
revoke all on function public.claim_purchase_confirmation_delivery(uuid) from public,anon,authenticated,service_role;
revoke all on function public.accept_purchase_confirmation_delivery(uuid,uuid,text) from public,anon,authenticated,service_role;
revoke all on function public.purge_unused_purchase_intents() from public,anon,authenticated,service_role;
grant execute on function public.archive_purchase_confirmation(uuid,text,text,text,uuid,uuid,bigint,text,text) to service_role;
grant execute on function public.claim_purchase_confirmation_delivery(uuid) to service_role;
grant execute on function public.accept_purchase_confirmation_delivery(uuid,uuid,text) to service_role;
grant execute on function public.purge_unused_purchase_intents() to service_role;

create function jysen_private.freeze_purchase_confirmation_email(p_confirmation_id uuid,p_token uuid,p_email jsonb)
returns jsonb language plpgsql security definer set search_path=''
as $fn$
declare delivery jysen_private.purchase_confirmation_deliveries%rowtype; recipient text;
begin
  select * into strict delivery from jysen_private.purchase_confirmation_deliveries where confirmation_id=p_confirmation_id for update;
  select recipient_email into strict recipient from public.purchase_confirmations where id=p_confirmation_id;
  if delivery.lease_token is distinct from p_token or delivery.lease_expires_at<=clock_timestamp() or delivery.provider_accepted_at is not null then
    raise exception 'Delivery owner lost' using errcode='42501';
  end if;
  if p_email->>'from' is distinct from delivery.from_address or p_email->'to' is distinct from jsonb_build_array(recipient)
      or jsonb_typeof(p_email->'attachments') is distinct from 'array' or jsonb_array_length(p_email->'attachments')<>4
      or p_email->>'text' is null or p_email->>'subject' is null then
    raise exception 'Delivery recipient or contract contents mismatch' using errcode='42501';
  end if;
  update jysen_private.purchase_confirmation_deliveries set email_payload=coalesce(email_payload,p_email)
    where confirmation_id=p_confirmation_id returning email_payload into p_email;
  return p_email;
end $fn$;
revoke all on function jysen_private.freeze_purchase_confirmation_email(uuid,uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function jysen_private.freeze_purchase_confirmation_email(uuid,uuid,jsonb) to service_role;
create function public.freeze_purchase_confirmation_email(p_confirmation_id uuid,p_token uuid,p_email jsonb)
returns jsonb language sql security invoker set search_path='' as $fn$ select jysen_private.freeze_purchase_confirmation_email(p_confirmation_id,p_token,p_email) $fn$;
revoke all on function public.freeze_purchase_confirmation_email(uuid,uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.freeze_purchase_confirmation_email(uuid,uuid,jsonb) to service_role;

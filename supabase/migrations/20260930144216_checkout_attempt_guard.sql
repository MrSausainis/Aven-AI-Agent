-- Durable account-wide Checkout attempt and fenced worker ownership.
-- Applied via Supabase MCP; filename matches recorded migration version.
create table public.checkout_attempts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  attempt jsonb not null default '{}'::jsonb check (jsonb_typeof(attempt) = 'object'),
  lease_token uuid,
  lease_expires_at timestamptz,
  updated_at timestamptz not null default clock_timestamp()
);
alter table public.checkout_attempts enable row level security;
revoke all on public.checkout_attempts from public, anon, authenticated;
grant select, insert, update, delete on public.checkout_attempts to service_role;

create function public.claim_checkout(p_user_id uuid) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare r public.checkout_attempts; token uuid;
begin
  insert into public.checkout_attempts(user_id) values(p_user_id) on conflict do nothing;
  select * into r from public.checkout_attempts where user_id=p_user_id for update;
  if r.lease_token is not null and r.lease_expires_at > clock_timestamp() then
    return jsonb_build_object('state','busy');
  end if;
  token := gen_random_uuid();
  update public.checkout_attempts set lease_token=token,
    lease_expires_at=clock_timestamp()+interval '120 seconds', updated_at=clock_timestamp()
    where user_id=p_user_id;
  return jsonb_build_object('state','claimed','token',token,'attempt',r.attempt);
end $$;

-- Snapshot all Stripe request parameters before making an external request.
-- The optional customer binding commits with the snapshot, never overwriting
-- a different customer assigned by another process.
create function public.save_checkout_attempt(p_user_id uuid, p_token uuid,
  p_attempt jsonb, p_customer_id text default null) returns void
language plpgsql security invoker set search_path = '' as $$
declare r public.checkout_attempts; affected integer;
begin
  select * into r from public.checkout_attempts where user_id=p_user_id for update;
  if r.lease_token is distinct from p_token or p_token is null
     or r.lease_expires_at <= clock_timestamp() then
    raise exception 'Checkout worker no longer owns lease';
  end if;
  if p_customer_id is not null then
    update public.entitlements set stripe_customer_id=p_customer_id, updated_at=clock_timestamp()
      where id=p_user_id and (stripe_customer_id is null or stripe_customer_id=p_customer_id);
    get diagnostics affected=row_count;
    if affected <> 1 then raise exception 'Checkout customer binding conflict'; end if;
  end if;
  update public.checkout_attempts set attempt=p_attempt,
    lease_expires_at=clock_timestamp()+interval '120 seconds', updated_at=clock_timestamp()
    where user_id=p_user_id;
end $$;

create function public.release_checkout(p_user_id uuid, p_token uuid) returns void
language sql security invoker set search_path = '' as $$
  update public.checkout_attempts set lease_token=null, lease_expires_at=null,
    updated_at=clock_timestamp() where user_id=p_user_id and lease_token=p_token;
$$;
revoke all on function public.claim_checkout(uuid) from public, anon, authenticated;
revoke all on function public.save_checkout_attempt(uuid,uuid,jsonb,text) from public, anon, authenticated;
revoke all on function public.release_checkout(uuid,uuid) from public, anon, authenticated;
grant execute on function public.claim_checkout(uuid) to service_role;
grant execute on function public.save_checkout_attempt(uuid,uuid,jsonb,text) to service_role;
grant execute on function public.release_checkout(uuid,uuid) to service_role;

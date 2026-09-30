-- Ignore client-controlled display identity and timestamps on review writes.
-- Applied via Supabase MCP; version read from migration history.
create function public.enforce_review_identity() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare profile_name text;
begin
  if tg_op='UPDATE' and new.id is distinct from old.id then
    raise exception 'Review ownership cannot be changed';
  end if;
  select p.account_name into profile_name from public.profiles p where p.id=new.id;
  if profile_name is null then raise exception 'Review profile not accessible'; end if;
  new.account_name := profile_name;
  if tg_op='INSERT' then
    new.created_at := clock_timestamp();
  else
    new.created_at := old.created_at;
  end if;
  new.updated_at := clock_timestamp();
  return new;
end $$;
revoke all on function public.enforce_review_identity() from public, anon, authenticated;
grant execute on function public.enforce_review_identity() to service_role;

-- Replace the previous timestamp-only trigger with one canonical write guard.
drop trigger reviews_touch_updated_at on public.reviews;
create trigger reviews_enforce_identity before insert or update on public.reviews
for each row execute function public.enforce_review_identity();

-- Public names: 1–32 Unicode letters/ASCII digits, spaces, underscore, dot or hyphen.
create function public.enforce_account_name() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  new.account_name := normalize(regexp_replace(btrim(new.account_name),' +',' ','g'),NFC);
  if new.account_name is null or char_length(new.account_name) not between 1 and 32
      or new.account_name !~ '^[[:alpha:]0-9 _.-]+$' then
    raise exception using errcode='23514', message='account_name must contain 1–32 letters, digits, spaces, underscores, dots or hyphens';
  end if;
  return new;
end $$;
revoke all on function public.enforce_account_name() from public, anon, authenticated;
grant execute on function public.enforce_account_name() to service_role;
create trigger profiles_enforce_account_name before insert or update of account_name on public.profiles
for each row execute function public.enforce_account_name();
alter table public.profiles add constraint profiles_account_name_policy check (
  char_length(account_name) between 1 and 32 and account_name ~ '^[[:alpha:]0-9 _.-]+$'
  and account_name=normalize(regexp_replace(btrim(account_name),' +',' ','g'),NFC)
);
create unique index profiles_account_name_casefold_unique on public.profiles(lower(account_name));

-- Preserve the existing signup trigger's privileged row-creation boundary.
-- Read back the canonical profile name so entitlements never get the raw input.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare chosen_name text;
begin
  chosen_name := coalesce(new.raw_user_meta_data->>'account_name','user_' || substr(new.id::text,1,8));
  insert into public.profiles(id,account_name) values(new.id,chosen_name)
    returning account_name into chosen_name;
  insert into public.entitlements(id,tier_id,tier_source,account_name)
    values(new.id,'free','signup',chosen_name);
  return new;
end $$;

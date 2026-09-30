-- Run only to deliberately restore the pre-W26 name policy.
begin;
drop trigger profiles_enforce_account_name on public.profiles;
alter table public.profiles drop constraint profiles_account_name_policy;
drop index public.profiles_account_name_casefold_unique;
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  chosen_name text;
begin
  chosen_name := coalesce(new.raw_user_meta_data->>'account_name', 'user_' || substr(new.id::text, 1, 8));

  insert into public.profiles (id, account_name)
  values (new.id, chosen_name);

  insert into public.entitlements (id, tier_id, tier_source, account_name)
  values (new.id, 'free', 'signup', chosen_name);

  return new;
end;
$function$;
-- The unused INVOKER function remains revoked from clients.
commit;

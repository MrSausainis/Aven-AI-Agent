-- W27: explicit client access; existing RLS continues to enforce ownership.
revoke all privileges on table public.profiles, public.entitlements, public.tiers, public.reviews
  from public, anon, authenticated;
grant select on table public.tiers, public.reviews to anon, authenticated;
grant select on table public.profiles, public.entitlements to authenticated;
grant update(account_name, preferred_theme) on table public.profiles to authenticated;
-- Preserve browser UPSERT payloads. The existing review trigger enforces owner/name/times.
grant insert, update, delete on table public.reviews to authenticated;

alter policy tiers_public_read on public.tiers to anon, authenticated;
alter policy reviews_select_all on public.reviews to anon, authenticated;
alter policy profiles_select_own on public.profiles to authenticated;
alter policy entitlements_select_own on public.entitlements to authenticated;
alter policy profiles_update_own on public.profiles to authenticated
  using ((select auth.uid())=id) with check ((select auth.uid())=id);
alter policy reviews_insert_own on public.reviews to authenticated
  with check ((select auth.uid())=id);
alter policy reviews_update_own on public.reviews to authenticated
  using ((select auth.uid())=id) with check ((select auth.uid())=id);
alter policy reviews_delete_own on public.reviews to authenticated
  using ((select auth.uid())=id);

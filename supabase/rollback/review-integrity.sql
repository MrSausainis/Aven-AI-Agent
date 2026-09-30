-- Restore the previous timestamp-only write behavior. This removes the W07 guard.
drop trigger reviews_enforce_identity on public.reviews;
create trigger reviews_touch_updated_at before update on public.reviews
for each row execute function public.touch_review_updated_at();

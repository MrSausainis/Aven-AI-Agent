-- Synthetic DB assertions; all row and entitlement changes are rolled back.
begin;
set local role service_role;
do $test$
declare uid uuid; first jsonb; second jsonb; newer jsonb; snapshot jsonb;
  customer text; failed boolean; attempt jsonb := '{"id":"synthetic-test"}'::jsonb;
begin
  select id into uid from public.entitlements limit 1;
  if uid is null then raise exception 'DB test needs an existing entitlement'; end if;
  -- Isolate the synthetic test from any pre-existing attempt inside this rollback.
  delete from public.checkout_attempts where user_id=uid;
  first := public.claim_checkout(uid);
  assert first->>'state'='claimed', 'First claim';
  second := public.claim_checkout(uid);
  assert second->>'state'='busy', 'Concurrent worker must be busy';
  perform public.save_checkout_attempt(uid,(first->>'token')::uuid,attempt);
  perform public.release_checkout(uid,gen_random_uuid());
  select c.attempt into snapshot from public.checkout_attempts c where user_id=uid;
  assert snapshot=attempt, 'Wrong-owner release preserves snapshot';
  assert (public.claim_checkout(uid))->>'state'='busy', 'Wrong-owner release preserves lease';
  update public.checkout_attempts set lease_expires_at=clock_timestamp()-interval '1 second' where user_id=uid;
  newer := public.claim_checkout(uid);
  assert newer->>'state'='claimed' and newer->>'token'<>first->>'token', 'Expired lease reclaimed';
  assert newer->'attempt'=attempt, 'Snapshot survives worker replacement';
  failed := false;
  begin
    perform public.save_checkout_attempt(uid,(first->>'token')::uuid,'{"id":"stale"}'::jsonb);
  exception when raise_exception then failed := true;
  end;
  assert failed, 'Stale token fenced';
  perform public.release_checkout(uid,(first->>'token')::uuid);
  assert (public.claim_checkout(uid))->>'state'='busy', 'Stale release cannot unlock replacement';
  select stripe_customer_id into customer from public.entitlements where id=uid;
  if customer is null then
    customer := 'cus_synthetic_' || gen_random_uuid()::text;
    perform public.save_checkout_attempt(uid,(newer->>'token')::uuid,attempt,customer);
  end if;
  failed := false;
  begin
    perform public.save_checkout_attempt(uid,(newer->>'token')::uuid,'{"id":"bad-bind"}'::jsonb,
      'cus_conflict_' || gen_random_uuid()::text);
  exception when raise_exception then failed := true;
  end;
  assert failed, 'Conflicting customer cannot overwrite entitlement';
  select c.attempt into snapshot from public.checkout_attempts c where user_id=uid;
  assert snapshot=attempt, 'Customer conflict rolls back snapshot';
  assert (select stripe_customer_id=customer from public.entitlements where id=uid), 'Customer conflict rolls back entitlement';
  perform public.release_checkout(uid,(newer->>'token')::uuid);
  assert (public.claim_checkout(uid))->>'state'='claimed', 'Own release permits next claim';
end $test$;
set local role authenticated;
do $test$
declare failed boolean := false;
begin
  begin perform public.claim_checkout(gen_random_uuid());
  exception when insufficient_privilege then failed := true; end;
  assert failed, 'Authenticated client cannot claim checkout';
  failed := false;
  begin perform attempt from public.checkout_attempts;
  exception when insufficient_privilege then failed := true; end;
  assert failed, 'Authenticated client cannot read checkout snapshots';
end $test$;
rollback;

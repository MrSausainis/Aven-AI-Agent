-- Direct authenticated writes, including browser-style UPSERT; always rollback.
begin;
-- Use a real profile only as a fixture; its review and all changes are restored.
select set_config('request.jwt.claim.sub', (select id::text from public.profiles limit 1), true);
set local role authenticated;
do $test$
declare uid uuid := auth.uid(); profile_name text; original_time timestamptz;
  row_review public.reviews; failed boolean;
begin
  if uid is null then raise exception 'Review test requires a profile'; end if;
  select p.account_name into profile_name from public.profiles p where p.id=uid;
  delete from public.reviews where id=uid;
  insert into public.reviews(id,account_name,rating,body,created_at,updated_at)
    values(uid,'forged display identity',5,'Synthetic rollback test','2099-01-01','2099-01-01')
    returning * into row_review;
  assert row_review.account_name=profile_name, 'INSERT uses own profile name';
  assert row_review.created_at between statement_timestamp() and clock_timestamp(), 'INSERT uses server time';
  assert row_review.updated_at between statement_timestamp() and clock_timestamp(), 'INSERT update time';
  original_time := row_review.created_at;
  update public.reviews set account_name='another identity',created_at='2099-01-01',
    updated_at='1900-01-01',rating=4,body='Edited synthetic review' where id=uid
    returning * into row_review;
  assert row_review.account_name=profile_name and row_review.created_at=original_time, 'UPDATE preserves identity/date';
  assert row_review.body='Edited synthetic review' and row_review.rating=4, 'Rating/body editing works';
  assert row_review.updated_at between statement_timestamp() and clock_timestamp(), 'UPDATE time server controlled';
  insert into public.reviews(id,account_name,rating,body,created_at)
    values(uid,'forged upsert',3,'Browser-style upsert','2099-01-01')
    on conflict(id) do update set account_name=excluded.account_name,rating=excluded.rating,
      body=excluded.body,created_at=excluded.created_at returning * into row_review;
  assert row_review.created_at=original_time and row_review.account_name=profile_name, 'UPSERT protects original date';
  assert row_review.rating=3 and row_review.body='Browser-style upsert', 'UPSERT edit works';
  -- Clients can omit the server-derived display name entirely.
  delete from public.reviews where id=uid;
  insert into public.reviews(id,rating,body) values(uid,5,'No client name') returning * into row_review;
  assert row_review.account_name=profile_name, 'Server fills required account_name';
  failed := false;
  begin update public.reviews set id=gen_random_uuid() where id=uid;
  exception when raise_exception then failed := true; end;
  assert failed, 'Ownership cannot be reassigned';
  failed := false;
  begin insert into public.reviews(id,account_name,rating,body) values(gen_random_uuid(),'Other account',5,'Forged owner');
  exception when raise_exception or insufficient_privilege then failed := true; end;
  assert failed, 'Cannot write another profile review';
  failed := false;
  begin update public.reviews set rating=6 where id=uid;
  exception when check_violation then failed := true; end;
  assert failed, 'Rating constraint retained';
  failed := false;
  begin update public.reviews set body='' where id=uid;
  exception when check_violation then failed := true; end;
  assert failed, 'Body constraint retained';
end $test$;
select set_config('request.jwt.claim.sub', '', true);
set local role anon;
do $test$
declare failed boolean := false;
begin
  perform id from public.reviews limit 1;
  begin insert into public.reviews(id,account_name,rating,body) values(gen_random_uuid(),'Anon',5,'Anonymous write');
  exception when insufficient_privilege or raise_exception then failed := true; end;
  assert failed, 'Anonymous read remains available, writes denied';
end $test$;
rollback;

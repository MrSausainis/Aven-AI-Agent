-- Real client roles and synthetic signup fixtures; no persistent changes.
begin;
do $test$
declare uid uuid:=gen_random_uuid(); other_uid uuid:=gen_random_uuid();
  client text; relation text; operation text;
begin
  insert into auth.users(id,raw_user_meta_data) values
    (uid,jsonb_build_object('account_name','acl_'||substr(uid::text,1,12))),
    (other_uid,jsonb_build_object('account_name','acl_'||substr(other_uid::text,1,12)));
  perform set_config('request.jwt.claim.sub',uid::text,true);
  perform set_config('test.other_uid',other_uid::text,true);
  perform set_config('test.created_at',(select created_at::text from public.profiles where id=uid),true);
  foreach client in array array['anon','authenticated'] loop
    foreach relation in array array['profiles','entitlements','tiers','reviews'] loop
      foreach operation in array array['TRUNCATE','TRIGGER','REFERENCES'] loop
        assert not has_table_privilege(client,'public.'||relation,operation), 'Administrative privilege revoked';
      end loop;
    end loop;
    foreach relation in array array['checkout_attempts','stripe_webhook_events','stripe_webhook_leases','account_admin'] loop
      assert not has_table_privilege(client,'public.'||relation,'SELECT,INSERT,UPDATE,DELETE'), 'Internal tables/views remain inaccessible';
    end loop;
  end loop;
  assert has_column_privilege('authenticated','public.profiles','account_name','UPDATE'), 'Name update permitted';
  assert has_column_privilege('authenticated','public.profiles','preferred_theme','UPDATE'), 'Theme update permitted';
  assert not has_column_privilege('authenticated','public.profiles','created_at','UPDATE'), 'Creation date update denied';
  assert not has_column_privilege('authenticated','public.profiles','id','UPDATE'), 'Profile identity update denied';
  foreach relation in array array['profiles','entitlements','tiers','reviews'] loop
    foreach operation in array array['SELECT','INSERT','UPDATE','DELETE'] loop
      assert has_table_privilege('service_role','public.'||relation,operation), 'Service access retained';
    end loop;
  end loop;
end $test$;
set local role authenticated;
do $test$
declare uid uuid:=auth.uid(); other_uid uuid:=current_setting('test.other_uid')::uuid;
  failed boolean; affected integer; row_review public.reviews;
begin
  assert (select count(*)=1 from public.profiles), 'Only own profile visible';
  assert (select count(*)=1 from public.entitlements), 'Only own entitlement visible';
  perform tier_id from public.tiers;
  update public.profiles set account_name='renamed_'||substr(uid::text,1,12),preferred_theme='Obsidian' where id=uid;
  assert (select p.account_name=e.account_name and p.preferred_theme=e.preferred_theme from public.profiles p join public.entitlements e using(id)), 'Name/theme entitlement sync retained';
  assert (select created_at=current_setting('test.created_at')::timestamptz from public.profiles where id=uid), 'Creation date unchanged';
  failed:=false;
  begin update public.profiles set created_at='2099-01-01' where id=uid;
  exception when insufficient_privilege then failed:=true; end;
  assert failed, 'Direct creation date write rejected';
  failed:=false;
  begin update public.profiles set id=other_uid where id=uid;
  exception when insufficient_privilege then failed:=true; end;
  assert failed, 'Direct owner change rejected';
  update public.profiles set account_name='forged_other' where id=other_uid;
  get diagnostics affected=row_count;
  assert affected=0, 'Other profile updates remain blocked by RLS';
  failed:=false;
  begin update public.entitlements set tier_id='monthly' where id=uid;
  exception when insufficient_privilege then failed:=true; end;
  assert failed, 'Billing fields remain server owned';
  failed:=false;
  begin delete from public.profiles where id=uid;
  exception when insufficient_privilege then failed:=true; end;
  assert failed, 'Direct profile deletion denied';
  failed:=false;
  begin update public.tiers set cloud_enabled=true;
  exception when insufficient_privilege then failed:=true; end;
  assert failed, 'Catalog changes denied';
  insert into public.reviews(id,account_name,rating,body) values(uid,'forged display name',5,'Synthetic client test') returning * into row_review;
  assert row_review.account_name=(select account_name from public.profiles where id=uid), 'Review name still server derived';
  insert into public.reviews(id,account_name,rating,body) values(uid,'forged upsert',4,'Updated synthetic test')
    on conflict(id) do update set id=excluded.id,account_name=excluded.account_name,rating=excluded.rating,body=excluded.body returning * into row_review;
  assert row_review.rating=4 and row_review.account_name=(select account_name from public.profiles where id=uid), 'Browser-style upsert works';
  failed:=false;
  begin insert into public.reviews(id,account_name,rating,body) values(other_uid,'forged',5,'Other owner');
  exception when insufficient_privilege or raise_exception then failed:=true; end;
  assert failed, 'Other review insert denied';
  delete from public.reviews where id=uid;
  get diagnostics affected=row_count;
  assert affected=1, 'Own review deletion permitted';
end $test$;
set local role service_role;
do $test$
declare uid uuid:=auth.uid(); other_uid uuid:=current_setting('test.other_uid')::uuid; affected integer;
begin
  update public.entitlements set tier_id='free',tier_source='signup' where id=uid;
  get diagnostics affected=row_count;
  assert affected=1, 'Server entitlement writes retained';
  assert (select account_name='acl_'||substr(other_uid::text,1,12) from public.profiles where id=other_uid), 'Other profile unchanged';
end $test$;
select set_config('request.jwt.claim.sub','',true);
set local role anon;
do $test$
declare failed boolean; relation text;
begin
  perform tier_id from public.tiers;
  perform id from public.reviews;
  foreach relation in array array['profiles','entitlements'] loop
    failed:=false;
    begin execute format('select id from public.%I',relation);
    exception when insufficient_privilege then failed:=true; end;
    assert failed, 'Anonymous account reads denied';
  end loop;
  failed:=false;
  begin insert into public.reviews(id,rating,body) values(gen_random_uuid(),5,'Anonymous write');
  exception when insufficient_privilege then failed:=true; end;
  assert failed, 'Anonymous review writes denied';
end $test$;
rollback;

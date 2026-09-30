begin;
-- Exercise auth signup too; generated synthetic users never leave this rollback.
do $test$
declare uid uuid:=gen_random_uuid(); other_uid uuid:=gen_random_uuid(); canonical text;
  failed boolean; suffix text:=substr(uid::text,1,8);
begin
  insert into auth.users(id,raw_user_meta_data) values(uid,jsonb_build_object('account_name','  Ž  '||suffix||'  '));
  select account_name into canonical from public.profiles where id=uid;
  assert canonical='Ž '||suffix, 'Signup profile normalized';
  assert (select account_name=canonical from public.entitlements where id=uid), 'Signup entitlement uses normalized name';
  failed:=false;
  begin insert into auth.users(id,raw_user_meta_data) values(other_uid,jsonb_build_object('account_name',lower(canonical)));
  exception when unique_violation then failed:=true; end;
  assert failed, 'Case-variant signup rejected';
  assert not exists(select 1 from auth.users where id=other_uid), 'Duplicate signup atomic';
  perform set_config('request.jwt.claim.sub',uid::text,true);
end $test$;
set local role authenticated;
do $test$
declare uid uuid:=auth.uid(); row_name text; invalid text; failed boolean;
begin
  update public.profiles set account_name=U&'  Z\030C  Name_9.-  ' where id=uid returning account_name into row_name;
  assert row_name='Ž Name_9.-', 'Direct update normalized to NFC and collapsed spaces';
  assert (select account_name=row_name from public.entitlements where id=uid), 'Profile rename sync remains canonical';
  foreach invalid in array array['', '   ',repeat('a',33),'bad'||chr(10)||'name',U&'bad\200Bname',U&'bad\202Ename','<script>','name@domain','🤙'] loop
    failed:=false;
    begin update public.profiles set account_name=invalid where id=uid;
    exception when check_violation then failed:=true; end;
    assert failed, 'Invalid public name rejected';
  end loop;
  update public.profiles set account_name=repeat('a',32) where id=uid;
  assert (select char_length(account_name)=32 from public.profiles where id=uid), '32-character boundary';
  update public.profiles set account_name='汉字' where id=uid;
  assert (select account_name='汉字' from public.profiles where id=uid), 'Unicode letters remain supported';
  update public.profiles set account_name='Z' where id=uid;
  assert (select account_name='Z' from public.profiles where id=uid), 'Existing one-character names supported';
end $test$;
rollback;

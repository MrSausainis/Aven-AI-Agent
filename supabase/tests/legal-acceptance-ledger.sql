begin;
-- Synthetic accounts/acceptances are rolled back; never touch existing users.
do $test$
declare uid uuid:=gen_random_uuid(); other_uid uuid:=gen_random_uuid(); unconfirmed uuid:=gen_random_uuid();
begin
  insert into auth.users(id,email_confirmed_at,raw_user_meta_data)
    values(uid,now(),jsonb_build_object('account_name','legal_'||substr(uid::text,1,8))),
    (other_uid,now(),jsonb_build_object('account_name','legal_'||substr(other_uid::text,1,8))),
    (unconfirmed,null,jsonb_build_object('account_name','legal_'||substr(unconfirmed::text,1,8)));
  perform set_config('request.jwt.claim.sub',uid::text,true);
  perform set_config('test.other_uid',other_uid::text,true);
  perform set_config('test.unconfirmed_uid',unconfirmed::text,true);
  assert not exists(select 1 from public.legal_acceptances where user_id=uid), 'No inferred signup acceptance';
  -- Seed someone else's evidence to test SELECT ownership.
  insert into public.legal_acceptances(user_id,version,terms_sha256,privacy_sha256,source)
    select other_uid,version,terms_sha256,privacy_sha256,'authenticated_confirmation'
    from jysen_private.legal_releases where is_current;
end $test$;
set local role authenticated;
do $test$
declare status jsonb; first_record jsonb; repeated jsonb; failed boolean;
begin
  status:=public.get_legal_acceptance_status();
  assert status->>'accepted'='false', 'No acceptance without explicit confirmation';
  assert (select count(*) from public.legal_acceptances)=0, 'Foreign record hidden by RLS';
  foreach failed in array array[false] loop
    begin perform public.accept_current_legal(status->>'version',status->>'terms_sha256',status->>'privacy_sha256',false,true);
    exception when invalid_parameter_value then failed:=true; end;
    assert failed, 'Unchecked Terms refused';
  end loop;
  failed:=false;
  begin perform public.accept_current_legal(status->>'version',status->>'terms_sha256',status->>'privacy_sha256',true,null);
  exception when invalid_parameter_value then failed:=true; end;
  assert failed, 'Missing Privacy acknowledgement refused';
  failed:=false;
  begin perform public.accept_current_legal('stale-version',status->>'terms_sha256',status->>'privacy_sha256',true,true);
  exception when invalid_parameter_value then failed:=true; end;
  assert failed, 'Old client version refused';
  failed:=false;
  begin perform public.accept_current_legal(status->>'version',repeat('0',64),status->>'privacy_sha256',true,true);
  exception when invalid_parameter_value then failed:=true; end;
  assert failed, 'Wrong document digest refused';
  assert (select count(*) from public.legal_acceptances)=0, 'Rejected requests leave no record';
  first_record:=public.accept_current_legal(status->>'version',status->>'terms_sha256',status->>'privacy_sha256',true,true);
  repeated:=public.accept_current_legal(status->>'version',status->>'terms_sha256',status->>'privacy_sha256',true,true);
  assert first_record=repeated, 'Duplicate confirmation keeps original server time';
  assert (first_record->>'accepted_at')::timestamptz between transaction_timestamp() and clock_timestamp(), 'Timestamp comes from server';
  assert (select count(*) from public.legal_acceptances)=1, 'One own record per version';
  assert (select user_id=auth.uid() and terms_sha256=status->>'terms_sha256' and source='authenticated_confirmation' from public.legal_acceptances), 'Identity and evidence server-derived';
  failed:=false;
  begin insert into public.legal_acceptances(user_id,version,terms_sha256,privacy_sha256,source)
    values(auth.uid(),'forged','forged','forged','authenticated_confirmation');
  exception when insufficient_privilege then failed:=true; end;
  assert failed, 'Direct client insert refused';
  failed:=false;
  begin update public.legal_acceptances set accepted_at='2099-01-01';
  exception when insufficient_privilege then failed:=true; end;
  assert failed, 'Client timestamp rewrite refused';
  failed:=false;
  begin delete from public.legal_acceptances;
  exception when insufficient_privilege then failed:=true; end;
  assert failed, 'Client evidence deletion refused';
  failed:=false;
  begin perform * from jysen_private.legal_releases;
  exception when insufficient_privilege then failed:=true; end;
  assert failed, 'Archive not directly exposed to client';
end $test$;
reset role;
-- Changing mutable metadata must not change the independently stored evidence.
update auth.users set raw_user_meta_data=raw_user_meta_data||'{"legal_version":"forged","terms_accepted_at":"2099-01-01"}'::jsonb where id=auth.uid();
do $test$
begin
  assert (select version='2026-09-30.1' and accepted_at<now()+interval '1 minute'
    from public.legal_acceptances where user_id=auth.uid()), 'Mutable metadata cannot rewrite ledger';
  -- A new release invalidates current status without deleting prior evidence.
  update jysen_private.legal_releases set is_current=false where is_current;
  insert into jysen_private.legal_releases(version,terms_sha256,privacy_sha256,terms_html,privacy_html,is_current)
    select 'synthetic-next',terms_sha256,privacy_sha256,terms_html,privacy_html,true from jysen_private.legal_releases where version='2026-09-30.1';
end $test$;
set local role authenticated;
do $test$
declare status jsonb; failed boolean; own_uid text:=auth.uid()::text;
begin
  status:=public.get_legal_acceptance_status();
  assert status->>'accepted'='false', 'New document version needs reacceptance';
  assert (select count(*) from public.legal_acceptances)=1, 'Old evidence preserved';
  perform public.accept_current_legal(status->>'version',status->>'terms_sha256',status->>'privacy_sha256',true,true);
  assert (select count(*) from public.legal_acceptances)=2, 'New version appends evidence';
  perform set_config('request.jwt.claim.sub',current_setting('test.unconfirmed_uid'),true);
  failed:=false;
  begin perform public.get_legal_acceptance_status(); exception when insufficient_privilege then failed:=true; end;
  assert failed, 'Unconfirmed user refused';
  failed:=false;
  begin perform public.accept_current_legal(status->>'version',status->>'terms_sha256',status->>'privacy_sha256',true,true);
  exception when insufficient_privilege then failed:=true; end;
  assert failed, 'Unconfirmed user cannot insert evidence';
  perform set_config('request.jwt.claim.sub','',true);
  failed:=false;
  begin perform public.get_legal_acceptance_status(); exception when insufficient_privilege then failed:=true; end;
  assert failed, 'Missing identity refused';
  perform set_config('request.jwt.claim.sub',own_uid,true);
end $test$;
reset role;
set local role anon;
do $test$
declare failed boolean:=false;
begin
  begin perform public.get_legal_acceptance_status(); exception when insufficient_privilege then failed:=true; end;
  assert failed, 'Anon cannot invoke legal status';
  failed:=false;
  begin perform public.accept_current_legal('x','x','x',true,true); exception when insufficient_privilege then failed:=true; end;
  assert failed, 'Anon cannot confirm';
  failed:=false;
  begin perform * from public.legal_acceptances; exception when insufficient_privilege then failed:=true; end;
  assert failed, 'Anon cannot read records';
end $test$;
reset role;
set local role service_role;
do $test$
declare failed boolean:=false;
begin
  begin update public.legal_acceptances set accepted_at='2099-01-01'; exception when insufficient_privilege then failed:=true; end;
  assert failed, 'Ordinary backend role cannot rewrite acceptance';
  assert (select count(*) from jysen_private.legal_releases)>=2, 'Backend can inspect archive';
end $test$;
reset role;
rollback;
select 'legal ledger role/security/identity/time/reacceptance assertions passed; synthetic writes rolled back' as result;

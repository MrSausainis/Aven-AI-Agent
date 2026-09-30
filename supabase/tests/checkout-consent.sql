-- Run with proposal inside BEGIN; ROLLBACK. No existing customer is modified.
do $test$
declare uid uuid:=gen_random_uuid(); other_uid uuid:=gen_random_uuid(); unconfirmed uuid:=gen_random_uuid();
begin
  insert into auth.users(id,email_confirmed_at,raw_user_meta_data)
    values(uid,now(),jsonb_build_object('account_name','consent_'||substr(uid::text,1,8))),
    (other_uid,now(),jsonb_build_object('account_name','consent_'||substr(other_uid::text,1,8))),
    (unconfirmed,null,jsonb_build_object('account_name','consent_'||substr(unconfirmed::text,1,8)));
  perform set_config('request.jwt.claim.sub',uid::text,true);
  perform set_config('test.other',other_uid::text,true);
  perform set_config('test.unconfirmed',unconfirmed::text,true);
end $test$;
set local role authenticated;
do $test$
declare policy jsonb; legal jsonb; rec jsonb; replay jsonb; failed boolean; request uuid:=gen_random_uuid();
begin
  policy:=public.get_checkout_consent_policy();
  assert policy->>'user_id'=auth.uid()::text, 'Policy identity is server-derived';
  assert policy->>'terms_accepted'='false', 'Terms alone never infer early-access request';
  assert policy->>'rights_preserved'='true', 'No blanket withdrawal waiver';
  assert (select count(*) from public.checkout_consents)=0, 'No implicit signup evidence';
  failed:=false;
  begin perform public.record_checkout_consent('monthly',policy->>'version',policy->>'sha256',true,true,request);
  exception when insufficient_privilege then failed:=true; end;
  assert failed, 'Current Terms needed independently';
  legal:=public.get_legal_acceptance_status();
  perform public.accept_current_legal(legal->>'version',legal->>'terms_sha256',legal->>'privacy_sha256',true,true);
  failed:=false;
  begin perform public.record_checkout_consent('monthly',policy->>'version',policy->>'sha256',false,true,request);
  exception when invalid_parameter_value then failed:=true; end;
  assert failed, 'Unchecked request refused';
  failed:=false;
  begin perform public.record_checkout_consent('monthly',policy->>'version',policy->>'sha256',true,null,request);
  exception when invalid_parameter_value then failed:=true; end;
  assert failed, 'Missing separate rights acknowledgement refused';
  failed:=false;
  begin perform public.record_checkout_consent('monthly','stale',policy->>'sha256',true,true,request);
  exception when invalid_parameter_value then failed:=true; end;
  assert failed, 'Old notice version refused';
  failed:=false;
  begin perform public.record_checkout_consent('monthly',policy->>'version',repeat('0',64),true,true,request);
  exception when invalid_parameter_value then failed:=true; end;
  assert failed, 'Changed notice digest refused';
  failed:=false;
  begin perform public.record_checkout_consent('unknown',policy->>'version',policy->>'sha256',true,true,request);
  exception when invalid_parameter_value then failed:=true; end;
  assert failed, 'Unsupported plan refused';
  failed:=false;
  begin perform public.record_checkout_consent('monthly',policy->>'version',policy->>'sha256',true,true,null);
  exception when invalid_parameter_value then failed:=true; end;
  assert failed, 'Missing intent identity refused';
  assert (select count(*) from public.checkout_consents)=0, 'Denied requests leave no evidence';
  rec:=public.record_checkout_consent('monthly',policy->>'version',policy->>'sha256',true,true,request);
  replay:=public.record_checkout_consent('monthly',policy->>'version',policy->>'sha256',true,true,request);
  assert rec=replay, 'Idempotent retry preserves original evidence/time';
  assert (rec->>'requested_at')::timestamptz between transaction_timestamp() and clock_timestamp(), 'Server clock';
  assert rec->>'request_text'=policy->>'request_text' and rec->>'rights_notice'=policy->>'rights_notice', 'Exact wording archived';
  assert rec->>'legal_version'=legal->>'version' and rec->>'terms_sha256'=legal->>'terms_sha256', 'Terms version frozen';
  assert rec->>'price_id'='price_1UCPzSJ78TGxjoZzD8Pc4ppZ', 'Price identity server-mapped';
  assert (rec->>'expires_at')::timestamptz>(rec->>'requested_at')::timestamptz, 'Bounded intent expiry';
  assert public.get_checkout_consent((rec->>'id')::uuid,'monthly')=rec, 'Own exact plan can be validated';
  failed:=false;
  begin perform public.get_checkout_consent((rec->>'id')::uuid,'annual');
  exception when insufficient_privilege then failed:=true; end;
  assert failed, 'Wrong purchase plan refused';
  failed:=false;
  begin perform public.record_checkout_consent('annual',policy->>'version',policy->>'sha256',true,true,request);
  exception when invalid_parameter_value then failed:=true; end;
  assert failed, 'A nonce cannot authorize changed purchase';
  failed:=false;
  begin update public.checkout_consents set requested_at='2099-01-01';
  exception when insufficient_privilege then failed:=true; end;
  assert failed, 'Client cannot rewrite time/evidence';
  failed:=false;
  begin delete from public.checkout_consents;
  exception when insufficient_privilege then failed:=true; end;
  assert failed, 'Client cannot erase evidence';
  failed:=false;
  begin insert into public.checkout_consents select * from public.checkout_consents;
  exception when insufficient_privilege then failed:=true; end;
  assert failed, 'Direct client insert refused';
  failed:=false;
  begin perform public.bind_checkout_consent(auth.uid(),gen_random_uuid(),(rec->>'id')::uuid,gen_random_uuid(),'monthly');
  exception when insufficient_privilege then failed:=true; end;
  assert failed, 'Clients cannot reserve evidence for a checkout';
  perform set_config('test.consent_id',rec->>'id',true);
  perform set_config('test.own_uid',auth.uid()::text,true);
  perform set_config('request.jwt.claim.sub',current_setting('test.other'),true);
  assert (select count(*) from public.checkout_consents)=0, 'Another account cannot read evidence';
  failed:=false;
  begin perform public.get_checkout_consent((rec->>'id')::uuid,'monthly');
  exception when insufficient_privilege then failed:=true; end;
  assert failed, 'Another account cannot validate evidence';
  perform set_config('request.jwt.claim.sub',current_setting('test.unconfirmed'),true);
  failed:=false;
  begin perform public.get_checkout_consent_policy();
  exception when insufficient_privilege then failed:=true; end;
  assert failed, 'Unconfirmed account refused';
  perform set_config('request.jwt.claim.sub',current_setting('test.own_uid'),true);
end $test$;
reset role;
do $test$
declare uid uuid:=auth.uid(); token uuid:=gen_random_uuid(); attempt uuid:=gen_random_uuid(); consent uuid:=current_setting('test.consent_id')::uuid;
begin
  insert into public.checkout_attempts(user_id,lease_token,lease_expires_at,attempt)
  values(uid,token,clock_timestamp()+interval '120 seconds',jsonb_build_object('id',attempt,'plan','monthly','consentId',consent));
  perform set_config('test.token',token::text,true);
  perform set_config('test.attempt',attempt::text,true);
end $test$;
set local role service_role;
do $test$
declare failed boolean; bound jsonb; uid uuid:=current_setting('test.own_uid')::uuid;
  consent uuid:=current_setting('test.consent_id')::uuid; attempt uuid:=current_setting('test.attempt')::uuid; token uuid:=current_setting('test.token')::uuid;
begin
  failed:=false;
  begin perform public.bind_checkout_consent(uid,gen_random_uuid(),consent,attempt,'monthly');
  exception when insufficient_privilege then failed:=true; end;
  assert failed, 'Stale/wrong lease token refused';
  failed:=false;
  begin perform public.bind_checkout_consent(uid,token,consent,attempt,'annual');
  exception when insufficient_privilege then failed:=true; end;
  assert failed, 'Attempt plan mismatch refused';
  failed:=false;
  begin perform public.bind_checkout_consent(current_setting('test.other')::uuid,token,consent,attempt,'monthly');
  exception when insufficient_privilege then failed:=true; end;
  assert failed, 'Wrong owner refused';
  bound:=public.bind_checkout_consent(uid,token,consent,attempt,'monthly');
  assert public.bind_checkout_consent(uid,token,consent,attempt,'monthly')=bound, 'Reservation retry idempotent';
  assert bound->>'attempt_id'=attempt::text, 'Evidence binds exact purchase attempt';
  failed:=false;
  begin update public.checkout_consents set rights_preserved=false;
  exception when insufficient_privilege then failed:=true; end;
  assert failed, 'Backend cannot rewrite user acknowledgement';
end $test$;
reset role;
-- New attempts cannot reuse evidence previously bound to another purchase.
update auth.users set email_confirmed_at=null where id=auth.uid();
set local role service_role;
do $test$
declare failed boolean:=false;
begin
  begin perform public.bind_checkout_consent(current_setting('test.own_uid')::uuid,current_setting('test.token')::uuid,
    current_setting('test.consent_id')::uuid,current_setting('test.attempt')::uuid,'monthly');
  exception when insufficient_privilege then failed:=true; end;
  assert failed, 'Binding rechecks account confirmation even for retries';
end $test$;
reset role;
update auth.users set email_confirmed_at=now() where id=auth.uid();
update public.checkout_attempts set attempt=jsonb_set(attempt,'{id}',to_jsonb(gen_random_uuid()::text)) where user_id=auth.uid();
set local role service_role;
do $test$
declare failed boolean:=false; attempt uuid;
begin
  select (a.attempt->>'id')::uuid into attempt from public.checkout_attempts a where user_id=current_setting('test.own_uid')::uuid;
  begin perform public.bind_checkout_consent(current_setting('test.own_uid')::uuid,current_setting('test.token')::uuid,current_setting('test.consent_id')::uuid,attempt,'monthly');
  exception when insufficient_privilege then failed:=true; end;
  assert failed, 'One consent cannot authorize a new purchase';
end $test$;
reset role;
update public.checkout_consents set expires_at=clock_timestamp()-interval '1 second' where id=current_setting('test.consent_id')::uuid;
set local role authenticated;
do $test$
declare failed boolean:=false;
begin
  begin perform public.get_checkout_consent(current_setting('test.consent_id')::uuid,'monthly');
  exception when insufficient_privilege then failed:=true; end;
  assert failed, 'Expired intent refused';
end $test$;
reset role;
set local role anon;
do $test$
declare failed boolean:=false;
begin
  begin perform public.get_checkout_consent_policy(); exception when insufficient_privilege then failed:=true; end;
  assert failed, 'Anon RPC refused';
  failed:=false;
  begin perform * from public.checkout_consents; exception when insufficient_privilege then failed:=true; end;
  assert failed, 'Anon ledger read refused';
end $test$;
reset role;

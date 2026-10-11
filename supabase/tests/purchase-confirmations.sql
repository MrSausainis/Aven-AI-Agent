-- Runs after checkout-consent.sql assertions, in the same rollback transaction.
update public.entitlements set stripe_customer_id='cus_fixture_'||id::text where id=current_setting('test.own_uid')::uuid;
set local role service_role;
do $test$
declare uid uuid:=current_setting('test.own_uid')::uuid; consent uuid:=current_setting('test.consent_id')::uuid;
  attempt uuid:=current_setting('test.attempt')::uuid; rec jsonb; failed boolean; claim jsonb; email jsonb; frozen jsonb;
begin
  failed:=false;
  begin perform public.archive_purchase_confirmation(uid,'cs_fixture','sub_fixture','cus_foreign',consent,attempt,200,'eur',null);
  exception when insufficient_privilege then failed:=true; end;
  assert failed, 'Foreign billing customer cannot archive a contract';
  failed:=false;
  begin perform public.archive_purchase_confirmation(uid,'cs_fixture','sub_fixture','cus_fixture_'||uid::text,consent,gen_random_uuid(),200,'eur',null);
  exception when insufficient_privilege then failed:=true; end;
  assert failed, 'Only the exact bound purchase may be confirmed';
  failed:=false;
  begin perform public.archive_purchase_confirmation(uid,'cs_fixture','sub_fixture','cus_fixture_'||uid::text,consent,attempt,-1,'eur',null);
  exception when invalid_parameter_value then failed:=true; end;
  assert failed, 'Invalid paid total cannot be archived';
  rec:=public.archive_purchase_confirmation(uid,'cs_fixture','sub_fixture','cus_fixture_'||uid::text,consent,attempt,200,'eur','in_fixture');
  assert rec=public.archive_purchase_confirmation(uid,'cs_fixture','sub_fixture','cus_fixture_'||uid::text,consent,attempt,200,'eur','in_fixture'), 'Retry keeps exact archived contract';
  assert rec->>'recipient_email'=uid::text||'@example.invalid', 'Email recipient comes from confirmed account binding';
  assert rec->'payload'->'consent'->>'request_text' is not null, 'Exact affirmative wording is included';
  assert rec->'payload'->'documents'->>'terms_html' is not null and rec->'payload'->'documents'->>'privacy_html' is not null
    and rec->'payload'->'documents'->>'refunds_html' is not null, 'Entire versioned documents are copied, not hyperlinks';
  assert rec->>'sha256'=encode(sha256(convert_to(rec->>'payload_text','UTF8')),'hex'), 'Download bytes have a matching server digest';
  assert rec->'payload'->>'rights_preserved'='true', 'No waiver is introduced in paid confirmation';
  failed:=false;
  begin perform public.archive_purchase_confirmation(uid,'cs_changed','sub_fixture','cus_fixture_'||uid::text,consent,attempt,200,'eur','in_fixture');
  exception when insufficient_privilege then failed:=true; end;
  assert failed, 'Another payment cannot reuse the consent';
  failed:=false;
  begin perform public.archive_purchase_confirmation(uid,'cs_fixture','sub_fixture','cus_fixture_'||uid::text,consent,attempt,201,'eur','in_fixture');
  exception when insufficient_privilege then failed:=true; end;
  assert failed, 'Paid amount cannot overwrite original confirmation';
  failed:=false;
  begin update public.purchase_confirmations set payload_text='{}';
  exception when insufficient_privilege then failed:=true; end;
  assert failed, 'Backend cannot directly rewrite confirmation';
  claim:=public.claim_purchase_confirmation_delivery((rec->>'id')::uuid);
  assert claim->>'state'='claimed' and claim->>'from_address'='receipts@example.invalid', 'Delivery freezes original sender';
  assert public.claim_purchase_confirmation_delivery((rec->>'id')::uuid)->>'state'='busy', 'Parallel delivery cannot create another send';
  email:=jsonb_build_object('from','receipts@example.invalid','to',jsonb_build_array(rec->>'recipient_email'),
    'subject','Fixture','text','Original confirmation','attachments',jsonb_build_array('{}'::jsonb,'{}'::jsonb,'{}'::jsonb,'{}'::jsonb));
  frozen:=public.freeze_purchase_confirmation_email((rec->>'id')::uuid,(claim->>'token')::uuid,email);
  assert frozen=email, 'Exact outgoing message is frozen before sending';
  assert public.freeze_purchase_confirmation_email((rec->>'id')::uuid,(claim->>'token')::uuid,
    jsonb_set(email,'{text}','"Changed template"'))=frozen, 'Template changes cannot alter ambiguous retry payload';
  failed:=false;
  begin perform public.freeze_purchase_confirmation_email((rec->>'id')::uuid,(claim->>'token')::uuid,
    jsonb_set(email,'{to}','["other@example.invalid"]'));
  exception when insufficient_privilege then failed:=true; end;
  assert failed, 'Confirmation cannot be sent to a forged recipient';
  failed:=false;
  begin perform public.accept_purchase_confirmation_delivery((rec->>'id')::uuid,gen_random_uuid(),'email_fixture');
  exception when insufficient_privilege then failed:=true; end;
  assert failed, 'Wrong delivery token cannot grant accepted state';
  perform set_config('test.confirmation',rec->>'id',true);
  perform set_config('test.delivery_token',claim->>'token',true);
end $test$;
reset role;
update jysen_private.purchase_confirmation_deliveries set lease_expires_at=clock_timestamp()-interval '1 second' where confirmation_id=current_setting('test.confirmation')::uuid;
set local role service_role;
do $test$
declare claim jsonb; failed boolean:=false;
begin
  claim:=public.claim_purchase_confirmation_delivery(current_setting('test.confirmation')::uuid);
  assert claim->>'state'='claimed', 'Lost delivery acknowledgement can retry within the provider window';
  begin perform public.accept_purchase_confirmation_delivery(current_setting('test.confirmation')::uuid,current_setting('test.delivery_token')::uuid,'email_fixture');
  exception when insufficient_privilege then failed:=true; end;
  assert failed, 'Stale delivery owner cannot commit after replacement';
  perform set_config('test.delivery_token',claim->>'token',true);
end $test$;
reset role;
update jysen_private.purchase_confirmation_deliveries set first_started_at=clock_timestamp()-interval '24 hours',lease_expires_at=clock_timestamp()-interval '1 second' where confirmation_id=current_setting('test.confirmation')::uuid;
set local role service_role;
do $test$
begin
  assert public.claim_purchase_confirmation_delivery(current_setting('test.confirmation')::uuid)->>'state'='needs_reconciliation', 'Ambiguous old send cannot outlive provider idempotency';
end $test$;
reset role;
update jysen_private.purchase_confirmation_deliveries set first_started_at=clock_timestamp(),lease_expires_at=clock_timestamp()+interval '60 seconds' where confirmation_id=current_setting('test.confirmation')::uuid;
set local role service_role;
do $test$
begin
  assert public.accept_purchase_confirmation_delivery(current_setting('test.confirmation')::uuid,current_setting('test.delivery_token')::uuid,'email_fixture')->>'accepted'='true', 'Only acknowledged provider send is accepted';
  assert public.claim_purchase_confirmation_delivery(current_setting('test.confirmation')::uuid)->>'state'='accepted', 'Accepted confirmation does not resend';
end $test$;
reset role;
set local role authenticated;
do $test$
declare failed boolean;
begin
  assert (select count(*) from public.purchase_confirmations)=1, 'Own paid confirmations are readable';
  failed:=false;
  begin perform public.claim_purchase_confirmation_delivery(current_setting('test.confirmation')::uuid);
  exception when insufficient_privilege then failed:=true; end;
  assert failed, 'Client cannot trigger transactional mail';
  failed:=false;
  begin delete from public.purchase_confirmations;
  exception when insufficient_privilege then failed:=true; end;
  assert failed, 'Client cannot delete transaction evidence';
  failed:=false;
  begin perform public.purge_unused_purchase_intents();
  exception when insufficient_privilege then failed:=true; end;
  assert failed, 'Client cannot run retention maintenance';
  perform set_config('request.jwt.claim.sub',current_setting('test.other'),true);
  assert (select count(*) from public.purchase_confirmations)=0, 'Other accounts cannot read paid confirmation';
  perform set_config('request.jwt.claim.sub',current_setting('test.own_uid'),true);
end $test$;
reset role;
update public.checkout_consents c set expires_at=clock_timestamp()-interval '31 days' where c.user_id=auth.uid()
  and not exists(select 1 from jysen_private.checkout_consent_bindings b where b.consent_id=c.id);
set local role service_role;
do $test$
begin
  assert public.purge_unused_purchase_intents()=9, 'Old unbound intents are removed by bounded maintenance';
  assert exists(select 1 from public.checkout_consents where id=current_setting('test.consent_id')::uuid), 'Bound purchase evidence survives retention maintenance';
  assert (select count(*) from public.purchase_confirmations)=1, 'Paid confirmations survive intent cleanup';
end $test$;
reset role;
set local role anon;
do $test$
declare failed boolean:=false;
begin
  begin perform * from public.purchase_confirmations;
  exception when insufficient_privilege then failed:=true; end;
  assert failed, 'Anonymous users cannot read purchase confirmations';
end $test$;
reset role;

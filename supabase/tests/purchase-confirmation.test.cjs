const {test}=require('node:test');const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');const {stripTypeScriptTypes}=require('node:module');
const source=fs.readFileSync(path.join(__dirname,'../functions/_shared/purchase-confirmation.ts'),'utf8');
function setup(){
 const s={metadata:{checkout_consent:'consent-own',checkout_attempt:'attempt-own'},calls:[],requests:[],claim:'claimed',accepted:false,linePrice:'price-own',linesMore:false,linesQuantity:1,pagesMore:false,providerOk:true,providerId:'email-own',env:{RESEND_API_KEY:'synthetic-key',PURCHASE_CONFIRMATION_FROM:'receipts@example.invalid',PURCHASE_TRADER_JSON:JSON.stringify({legal_name:'Fixture',geographic_address:'Fixture address',country:'LT',support_email:'support@example.invalid',telephone:'+000',secret:'must-not-copy'})}};
 s.session={id:'cs_own',status:'complete',payment_status:'paid',mode:'subscription',customer:'cus_own',subscription:'sub_own',client_reference_id:'own',metadata:s.metadata,amount_total:200,currency:'eur',invoice:'in_own'};
 s.payload={session_id:'cs_own',plan:'monthly',amount_total:200,currency:'eur',offer:{trader:JSON.parse(s.env.PURCHASE_TRADER_JSON),price:{interval:'month',interval_count:1},description:'Fixture access'},consent:{request_text:'Start now',rights_notice:'Rights preserved',requested_at:'2026-10-01',policy_version:'v1',legal_version:'v1'},documents:{terms_html:'<html>Terms ž</html>',privacy_html:'<html>Privacy</html>',refunds_html:'<html>Refunds</html>'}};
 s.receipt={id:'receipt-own',recipient_email:'owner@example.invalid',payload:s.payload,payload_text:JSON.stringify(s.payload),sha256:'digest'};
 const admin={from:()=>{const q={select:()=>q,eq:()=>q,maybeSingle:async()=>({data:s.consentMissing?null:{price_id:'price-own'},error:s.consentError})};return q;},rpc:async(name,p)=>{
   s.calls.push({name,p});if(s.rpcError===name)return {error:{code:'08006'}};
   if(name==='archive_purchase_confirmation')return {data:{...s.receipt,provider_accepted_at:s.accepted?'2026-10-01':null}};
   if(name==='claim_purchase_confirmation_delivery')return {data:{state:s.claim,token:'lease-own',from_address:'original@example.invalid'}};
   if(name==='freeze_purchase_confirmation_email'){s.frozen??=structuredClone(p.p_email);return {data:s.frozen};}
   if(name==='accept_purchase_confirmation_delivery'){s.accepted=true;return {data:{accepted:true}};}
   throw Error('Unknown '+name);
 }};
 const stripe={subscriptions:{retrieve:async()=>({metadata:s.metadata})},checkout:{sessions:{list:async()=>({data:s.noSession?[]:s.duplicate?[s.session,s.session]:[s.session],has_more:s.pagesMore}),retrieve:async()=>({...s.session,...s.retrievedChange}),listLineItems:async()=>({data:[{price:{id:s.linePrice},quantity:s.linesQuantity}],has_more:s.linesMore})}}};
 const ctx={Deno:{env:{get:k=>s.env[k]}},TextEncoder,btoa,AbortSignal,fetch:async(url,p)=>{s.requests.push({url,...p});if(s.loseResponse)throw Error('Response lost');return {ok:s.providerOk,json:async()=>({id:s.providerId})};}};
 vm.runInNewContext(stripTypeScriptTypes(source.replace(/^export /gm,'')),ctx);
 return {s,ctx,send:()=>ctx.providePurchaseConfirmation(admin,stripe,'sub_own','own','cus_own')};
}
test('confirmation includes original terms and exact contract bytes as attachments, no remote document fetch',async()=>{
 const {s,send}=setup();await send();assert.equal(s.accepted,true);assert.equal(s.requests.length,1);const req=s.requests[0];assert.equal(req.url,'https://api.resend.com/emails');assert.equal(req.headers['Idempotency-Key'],'purchase-confirmation/receipt-own');const email=JSON.parse(req.body);assert.deepEqual(email.to,['owner@example.invalid']);assert.equal(email.from,'original@example.invalid');assert.equal(email.attachments.length,4);assert.equal(Buffer.from(email.attachments[0].content,'base64').toString('utf8'),s.receipt.payload_text);assert.equal(Buffer.from(email.attachments[1].content,'base64').toString('utf8'),s.payload.documents.terms_html);assert.ok(email.text.includes('not a withdrawal waiver'));assert.ok(email.text.includes('digest'));
});
test('legacy subscriptions never receive invented consent or transactional messages',async()=>{const {s,send}=setup();s.metadata={};await send();assert.equal(s.calls.length,0);assert.equal(s.requests.length,0);});
test('unpaid, incomplete, duplicate or absent sessions never send or grant accepted state',async()=>{
 for(const mode of ['unpaid','open','missing','duplicate']){const {s,send}=setup();if(mode==='unpaid')s.session.payment_status='unpaid';if(mode==='open')s.session.status='open';if(mode==='missing')s.noSession=true;if(mode==='duplicate')s.duplicate=true;await assert.rejects(send);assert.equal(s.requests.length,0);assert.equal(s.accepted,false);}
});
test('fresh retrieval validates customer, account, subscription and metadata instead of trusting list snapshot',async()=>{
 for(const retrievedChange of [{customer:'cus_foreign'},{client_reference_id:'foreign'},{subscription:'sub_foreign'},{payment_status:'unpaid'},{metadata:{checkout_consent:'foreign',checkout_attempt:'attempt-own'}},{amount_total:-1},{currency:'invalid'}]){const {s,send}=setup();s.retrievedChange=retrievedChange;await assert.rejects(send);assert.equal(s.calls.length,0);assert.equal(s.requests.length,0);}
});
test('price, quantity and complete line items are checked against server evidence',async()=>{
 for(const mode of ['price','quantity','partial','missing','db']){const {s,send}=setup();if(mode==='price')s.linePrice='foreign';if(mode==='quantity')s.linesQuantity=2;if(mode==='partial')s.linesMore=true;if(mode==='missing')s.consentMissing=true;if(mode==='db')s.consentError={code:'08006'};await assert.rejects(send);assert.equal(s.calls.length,0);assert.equal(s.requests.length,0);}
});
test('partial checkout scan fails closed before archive',async()=>{const {s,send}=setup();s.pagesMore=true;await assert.rejects(send);assert.equal(s.calls.length,0);});
test('already accepted confirmation is idempotent without another email',async()=>{const {s,send}=setup();await send();await send();assert.equal(s.requests.length,1);});
test('busy or old ambiguous delivery never retries outside database safety decision',async()=>{
 for(const claim of ['busy','needs_reconciliation']){const {s,send}=setup();s.claim=claim;await assert.rejects(send);assert.equal(s.requests.length,0);assert.equal(s.accepted,false);}
});
test('provider failure or invalid acknowledgement remains retryable and unaccepted',async()=>{
 for(const mode of ['reject','response','bad-id','commit']){const {s,send}=setup();if(mode==='reject')s.providerOk=false;if(mode==='response')s.loseResponse=true;if(mode==='bad-id')s.providerId=null;if(mode==='commit')s.rpcError='accept_purchase_confirmation_delivery';await assert.rejects(send);assert.equal(s.accepted,false);}
});
test('ambiguous retries use frozen payload/key even when sender config, template data or credentials change',async()=>{
 const {s,send}=setup();s.loseResponse=true;await assert.rejects(send);const first=s.requests[0];s.loseResponse=false;s.env.PURCHASE_CONFIRMATION_FROM='changed@example.invalid';s.env.RESEND_API_KEY='changed-key';s.payload.offer.description='Changed template';await send();assert.equal(s.requests[1].body,first.body);assert.equal(s.requests[1].headers['Idempotency-Key'],first.headers['Idempotency-Key']);assert.equal(s.accepted,true);
});
test('unconfigured mail/trader gate fails closed and public trader snapshot excludes extra fields',()=>{
 const {s,ctx}=setup();assert.equal(ctx.commerceConfig().trader.secret,undefined);
 for(const key of ['RESEND_API_KEY','PURCHASE_CONFIRMATION_FROM','PURCHASE_TRADER_JSON']){const old=s.env[key];delete s.env[key];assert.throws(()=>ctx.commerceConfig());s.env[key]=old;}
 s.env.PURCHASE_TRADER_JSON='{}';assert.throws(()=>ctx.commerceConfig());
});
test('missing configuration after purchase does not bypass confirmation acceptance',async()=>{const {s,send}=setup();delete s.env.RESEND_API_KEY;await assert.rejects(send);assert.equal(s.requests.length,0);assert.equal(s.accepted,false);});

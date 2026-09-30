const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {stripTypeScriptTypes} = require('node:module');
const {webcrypto} = require('node:crypto');
const source = fs.readFileSync(path.join(__dirname,'../functions/create-checkout/index.ts'),'utf8');
const prices = {monthly:'price_1UCPzSJ78TGxjoZzD8Pc4ppZ',annual:'price_1UD87kJ78TGxjoZzyIHNEkQG'};
function setup() {
  const s = {consents:new Map(),bindings:new Map(),bindCalls:[],consentReads:0,attempt:{},owner:null,tokens:0,email:'test@example.invalid',customer:'cus_test',subs:[],sessions:new Map(),idem:new Map(),customers:new Map(),creates:[],customerCreates:[],expires:[],busyReads:0,failSaveSession:false,failCustomerBind:false,failSnapshot:false,loseCreateResponse:false,failList:false,hasMore:false,expireRace:false,auth:true,priceActive:true,foreign:false,row:{id:'account-test',tier_id:'free',tier_source:'signup'}};
  let handler;
  const admin = {
    from:()=>{const q={select:()=>q,eq:()=>q,maybeSingle:async()=>({data:{...s.row,stripe_customer_id:s.customer},error:null})};return q;},
    rpc:async(name,p)=>{
      if(name==='claim_checkout') {
        if(s.owner)return {data:{state:'busy'}};
        s.owner=`token-${++s.tokens}`;
        return {data:{state:'claimed',token:s.owner,attempt:structuredClone(s.attempt)}};
      }
      if(name==='release_checkout'){if(s.owner===p.p_token)s.owner=null;return {data:null};}
      if(name==='bind_checkout_consent') {
        s.bindCalls.push(p);
        if(s.bindError || s.owner!==p.p_token || s.attempt.id!==p.p_attempt_id || s.attempt.consentId!==p.p_consent_id || s.attempt.plan!==p.p_plan) return {error:{code:'42501'}};
        const previous=s.bindings.get(p.p_consent_id);
        if(previous && previous!==p.p_attempt_id)return {error:{code:'42501'}};
        s.bindings.set(p.p_consent_id,p.p_attempt_id);
        return {data:{consent_id:p.p_consent_id,attempt_id:p.p_attempt_id}};
      }
      assert.equal(name,'save_checkout_attempt');
      if(s.owner!==p.p_token || s.failSnapshot || (s.failCustomerBind && p.p_customer_id) || (s.failSaveSession && p.p_attempt.sessionId))return {error:{message:'DB unavailable or stale token'}};
      s.attempt=structuredClone(p.p_attempt);if(p.p_customer_id)s.customer=p.p_customer_id;return {data:null};
    },
  };
  class Stripe {
    constructor(){
      this.prices={retrieve:async(id)=>({active:s.priceActive,type:'recurring',recurring:{interval:'month'},metadata:{tier_id:id===prices.monthly?'monthly':'annual'},product:{active:true}})};
      this.customers={create:async(p,o)=>{
        assert.equal(s.bindings.get(s.attempt.consentId),s.attempt.id,'Evidence bound before customer creation');
        s.customerCreates.push({p:structuredClone(p),key:o.idempotencyKey});
        if(!s.customers.has(o.idempotencyKey))s.customers.set(o.idempotencyKey,{id:`cus_${s.customers.size+1}`});
        return s.customers.get(o.idempotencyKey);
      }};
      this.subscriptions={list:async()=>{s.busyReads++;if(s.listGate)await s.listGate;if(s.failList)throw Error('Stripe down');return {data:s.subs,has_more:s.hasMore};},retrieve:async(id)=>s.subs.find(x=>x.id===id)};
      this.checkout={sessions:{
        list:async()=>({data:[...s.sessions.values()].filter(x=>x.status==='open'),has_more:false}),
        listLineItems:async(id)=>({data:[{price:{id:s.sessions.get(id).price},quantity:1}],has_more:false}),
        retrieve:async(id)=>{const session=s.sessions.get(id);if(!session)throw Error('Missing session');return structuredClone(session);},
        expire:async(id)=>{s.expires.push(id);const session=s.sessions.get(id);if(s.expireRace){session.status='complete';throw Error('Session completed');}session.status='expired';session.url=null;return structuredClone(session);},
        create:async(p,o)=>{
          assert.deepEqual(structuredClone(p),s.attempt.sessionParams,'exact session parameters are committed before Stripe creation');
          assert.equal(s.bindings.get(s.attempt.consentId),s.attempt.id,'Evidence bound before session creation');
          s.creates.push({p:structuredClone(p),key:o.idempotencyKey});
          const previous=s.idem.get(o.idempotencyKey);
          if(previous){assert.deepEqual(p,previous.params);return structuredClone(previous.response);}
          const session={id:`cs_${s.sessions.size+1}`,status:'open',mode:p.mode,customer:p.customer,client_reference_id:p.client_reference_id,metadata:p.metadata,url:`https://checkout.stripe.com/test/${s.sessions.size+1}`,price:p.line_items[0].price};
          s.sessions.set(session.id,session);s.idem.set(o.idempotencyKey,{params:structuredClone(p),response:structuredClone(session)});
          if(s.loseCreateResponse){s.loseCreateResponse=false;throw Error('Response lost');}
          return structuredClone(session);
        },
      }};
    }
  }
  const asUser={auth:{getUser:async()=>s.auth?{data:{user:{id:'account-test',email:s.email}}}:{error:{message:'bad token'}}},
    rpc:async (name,p)=>{
      if(name==='get_legal_acceptance_status')return s.legalError?{error:{message:'Unavailable'}}:{data:s.legalMissing?null:{accepted:s.legalAccepted!==false}};
      assert.equal(name,'get_checkout_consent');s.consentReads++;
      const rec=s.consents.get(p.p_consent_id);
      if(s.consentOutage)return {error:{code:'08006'}};
      if(s.consentDenied || !rec || rec.plan!==p.p_plan)return {error:{code:'42501'}};
      return {data:{...rec,bound_attempt_id:s.bindings.get(rec.id)||null}};
    }};
  vm.runInNewContext(stripTypeScriptTypes(source.replace(/^import .*;\n/gm,'')),{Stripe,createClient:(_url,_key,options)=>options?asUser:admin,Deno:{env:{get:()=> 'mock'},serve:fn=>handler=fn},Request,Response,crypto:webcrypto,Uint8Array,Date,console:{error:()=>{}}});
  function nextConsent(plan='monthly') {
    const id=webcrypto.randomUUID();s.consents.set(id,{id,user_id:'account-test',plan,price_id:prices[plan],rights_preserved:true,policy_version:'policy1',legal_version:'legal1',expires_at:new Date(Date.now()+1800000).toISOString()});s.current??={};s.current[plan]=id;return id;
  }
  nextConsent('monthly');nextConsent('annual');
  const send=(body={plan:'monthly'})=>{if(body && typeof body==='object' && !Array.isArray(body) && body.consent_id===undefined && (body.plan||body.price_id))body={...body,consent_id:s.current[body.plan||Object.keys(prices).find(k=>prices[k]===body.price_id)]};return handler(new Request('https://example.invalid',{method:'POST',body:JSON.stringify(body)}));};
  const legacy=(plan='monthly')=>({id:'cs_legacy',status:'open',mode:'subscription',customer:s.customer,client_reference_id:'account-test',metadata:{aven_plan:plan},price:prices[plan],url:'https://checkout.stripe.com/legacy'});
  return {s,send,legacy,nextConsent};
}
test('repeated requests reuse the same open session and key',async()=>{
  const {s,send}=setup();const a=await send();const b=await send({price_id:prices.monthly});assert.equal(a.status,200);assert.deepEqual(await a.json(),await b.json());assert.equal(s.creates.length,1);assert.ok(s.creates[0].key.includes(s.attempt.id));assert.equal(s.owner,null);
});
test('simultaneous requests serialize account-wide across plans',async()=>{
  const {s,send}=setup();let release;s.listGate=new Promise(r=>release=r);const a=send();while(!s.busyReads)await new Promise(r=>setImmediate(r));assert.equal((await send({plan:'annual'})).status,409);assert.equal(s.creates.length,0);release();assert.equal((await a).status,200);assert.equal(s.creates.length,1);
});
test('switching plans expires the old link before creating replacement',async()=>{
  const {s,send}=setup();await send();const previous=s.attempt.sessionId;assert.equal((await send({plan:'annual'})).status,200);assert.deepEqual(s.expires,[previous]);assert.equal(s.sessions.get(previous).status,'expired');assert.notEqual(s.creates[0].key,s.creates[1].key);assert.equal(s.creates[1].p.line_items[0].price,prices.annual);
});
test('completion racing expiration blocks replacement',async()=>{
  const {s,send}=setup();await send();s.expireRace=true;assert.equal((await send({plan:'annual'})).status,500);assert.equal(s.creates.length,1);
});
test('response lost after Stripe create is recovered without another session',async()=>{
  const {s,send}=setup();s.loseCreateResponse=true;assert.equal((await send()).status,500);const id=s.attempt.id;assert.equal((await send()).status,200);assert.equal(s.attempt.id,id);assert.equal(s.sessions.size,1);assert.equal(s.creates.length,1);
});
test('DB failure after create preserves snapshot and retry reuses session',async()=>{
  const {s,send}=setup();s.failSaveSession=true;assert.equal((await send()).status,500);const params=structuredClone(s.attempt.sessionParams);assert.ok(params);s.failSaveSession=false;s.email='changed@example.invalid';assert.equal((await send()).status,200);assert.deepEqual(s.attempt.sessionParams,params);assert.equal(s.sessions.size,1);
});
test('ambiguous creation retries with frozen parameters and key',async()=>{
  const {s,send,nextConsent}=setup();s.failSaveSession=true;await send();const session=s.sessions.get('cs_1');session.status='expired';s.failSaveSession=false;assert.equal((await send()).status,409);assert.equal(s.creates.length,2);assert.equal(s.creates[0].key,s.creates[1].key);assert.deepEqual(s.creates[0].p,s.creates[1].p);assert.equal(s.sessions.size,1);nextConsent();assert.equal((await send()).status,200);assert.equal(s.sessions.size,2);
});
test('Stripe subscription blocks checkout before webhook entitlement catches up',async()=>{
  const {s,send}=setup();for(const status of ['active','trialing','past_due','unpaid','paused','incomplete']){s.subs=[{id:'sub_existing',status}];assert.equal((await send()).status,409);}assert.equal(s.creates.length,0);
});
test('completed checkout blocks another purchase with webhook lag',async()=>{
  const {s,send}=setup();await send();const old=s.sessions.get('cs_1');old.status='complete';assert.equal((await send()).status,409);assert.equal(s.creates.length,1);
});
test('expired sessions rotate key; canceled subscription can resubscribe',async()=>{
  const {s,send,nextConsent}=setup();await send();s.sessions.get('cs_1').status='expired';nextConsent();assert.equal((await send()).status,200);const current=s.sessions.get('cs_2');current.status='complete';current.subscription='sub_old';s.subs=[{id:'sub_old',status:'canceled',customer:s.customer}];nextConsent();assert.equal((await send()).status,200);assert.equal(s.sessions.size,3);
});
test('unbound legacy, duplicate and foreign checkouts cannot be adopted',async()=>{
  const {s,send,legacy}=setup();s.sessions.set('cs_legacy',legacy());assert.equal((await send()).status,409);assert.equal(s.creates.length,0);s.sessions.set('cs_other',{...legacy(),id:'cs_other'});assert.equal((await send()).status,409);s.sessions.delete('cs_other');s.sessions.get('cs_legacy').client_reference_id='someone-else';assert.equal((await send()).status,409);assert.equal(s.expires.length,0);
});
test('old unresolved attempts stop before Stripe idempotency keys can expire',async()=>{
  const {s,send}=setup();s.attempt={id:'old',startedAt:Date.now()-24*3600000,plan:'monthly',customerParams:{}};assert.equal((await send()).status,409);assert.equal(s.creates.length,0);assert.equal(s.customerCreates.length,0);
});
test('snapshot failure and Stripe outages cannot create sessions',async()=>{
  const {s,send}=setup();s.failSnapshot=true;assert.equal((await send()).status,500);assert.equal(s.creates.length,0);s.failSnapshot=false;s.failList=true;assert.equal((await send()).status,500);assert.equal(s.creates.length,0);assert.equal(s.owner,null);
});
test('incomplete pagination fails closed',async()=>{
  const {s,send}=setup();s.hasMore=true;s.subs=[{id:'sub_canceled',status:'canceled'}];assert.equal((await send()).status,503);assert.equal(s.busyReads,5);assert.equal(s.creates.length,0);
});
test('invalid body, plan mismatch and unauthenticated callers never create',async()=>{
  const {s,send}=setup();for(const body of [null,[],{}, {plan:'monthly',price_id:prices.annual}])assert.equal((await send(body)).status,400);s.auth=false;assert.equal((await send()).status,401);assert.equal(s.owner,null);assert.equal(s.creates.length,0);
});
test('customer creation parameters persist before Stripe call',async()=>{
  const {s,send}=setup();s.customer=null;assert.equal((await send()).status,200);assert.equal(s.customers.size,1);assert.equal(s.customer,s.creates[0].p.customer);assert.equal(s.customerCreates[0].p.email,'test@example.invalid');assert.ok(s.customerCreates[0].key.includes(s.attempt.id));
});
test('customer binding failure retries original customer parameters despite email change',async()=>{
  const {s,send}=setup();s.customer=null;s.failCustomerBind=true;assert.equal((await send()).status,500);assert.equal(s.creates.length,0);s.failCustomerBind=false;s.email='updated@example.invalid';assert.equal((await send()).status,200);assert.equal(s.customers.size,1);assert.equal(s.customerCreates[0].key,s.customerCreates[1].key);assert.deepEqual(s.customerCreates[0].p,s.customerCreates[1].p);
});
test('expired lease cannot create a session or release a replacement owner',async()=>{
  const {s,send}=setup();let release;s.listGate=new Promise(r=>release=r);const a=send();while(!s.busyReads)await new Promise(r=>setImmediate(r));s.owner='replacement-worker';release();assert.equal((await a).status,500);assert.equal(s.creates.length,0);assert.equal(s.owner,'replacement-worker');
});
test('supported price validation and existing paid entitlement are preserved',async()=>{
  const {s,send}=setup();s.priceActive=false;assert.equal((await send()).status,503);s.priceActive=true;s.row.tier_source='stripe';s.row.tier_id='annual';assert.equal((await send()).status,409);assert.equal(s.creates.length,0);
});
test('both plans collect and persist the address on the server-bound customer',async()=>{
  for(const plan of ['monthly','annual'])for(const existingCustomer of ['cus_test',null]) {
    const {s,send}=setup();s.customer=existingCustomer;
    assert.equal((await send({plan,customer:'cus_foreign',customer_update:{name:'auto'},automatic_tax:{enabled:true}})).status,200);
    const p=s.creates[0].p;
    assert.equal(p.billing_address_collection,'required');
    assert.deepEqual(p.customer_update,{address:'auto'});
    assert.equal(p.customer,s.customer);
    assert.equal(p.line_items[0].price,prices[plan]);
    assert.equal(p.automatic_tax,undefined);
    assert.deepEqual(p.managed_payments,{enabled:false});
  }
});
test('legacy frozen attempts are left intact and require support rather than inferred consent',async()=>{
  const {s,send}=setup();
  const params={mode:'subscription',customer:s.customer,metadata:{checkout_attempt:'legacy-attempt'}};
  s.attempt={id:'legacy-attempt',startedAt:Date.now(),plan:'monthly',customerParams:{},sessionParams:structuredClone(params)};
  const old=structuredClone(s.attempt);
  assert.equal((await send()).status,409);assert.deepEqual(s.attempt,old);
  assert.equal(s.creates.length,0);assert.equal(s.customerCreates.length,0);assert.equal(s.expires.length,0);
});
test('missing current Terms acceptance blocks both plans before billing mutations',async()=>{
  for(const plan of ['monthly','annual']) {
    const {s,send}=setup();s.legalAccepted=false;
    assert.equal((await send({plan,terms_accepted:true})).status,403);
    assert.equal(s.creates.length,0);assert.equal(s.customerCreates.length,0);assert.equal(s.owner,null);assert.equal(s.busyReads,0);
  }
});
test('legal status outage or missing response fails closed without billing mutations',async()=>{
  for(const mode of ['legalError','legalMissing']) {
    const {s,send}=setup();s[mode]=true;
    assert.equal((await send()).status,503);
    assert.equal(s.creates.length,0);assert.equal(s.customerCreates.length,0);assert.equal(s.owner,null);
  }
});


test('missing or malformed consent IDs block before claim or Stripe',async()=>{
  for(const consent_id of [null,'',true,'not-a-uuid']) {
    const {s,send}=setup();assert.equal((await send({plan:'monthly',consent_id,request_early_access:true})).status,400);
    assert.equal(s.tokens,0);assert.equal(s.busyReads,0);assert.equal(s.creates.length,0);
  }
});
test('foreign, expired and policy-changed consent fails before lease and billing',async()=>{
  for(const mode of ['denied','foreign','plan','price','rights','missing']) {
    const {s,send}=setup();const id=s.current.monthly;
    if(mode==='denied')s.consentDenied=true;
    if(mode==='missing')s.consents.delete(id);
    if(mode==='foreign')s.consents.get(id).user_id='other';
    if(mode==='plan')s.consents.get(id).plan='annual';
    if(mode==='price')s.consents.get(id).price_id=prices.annual;
    if(mode==='rights')s.consents.get(id).rights_preserved=false;
    assert.equal((await send()).status,403);assert.equal(s.tokens,0);assert.equal(s.customerCreates.length,0);assert.equal(s.creates.length,0);
  }
});
test('evidence service outage is distinct from denial and leaves receipt recoverable',async()=>{
  const {s,send}=setup();s.consentOutage=true;const r=await send();assert.equal(r.status,503);assert.equal((await r.json()).code,undefined);assert.equal(s.tokens,0);
});
test('reservation failure stops before creating even a new Stripe customer',async()=>{
  const {s,send}=setup();s.customer=null;s.bindError=true;assert.equal((await send()).status,403);assert.equal(s.customerCreates.length,0);assert.equal(s.creates.length,0);assert.equal(s.owner,null);
});
test('new checkout carries exact bound evidence in frozen Stripe metadata',async()=>{
  const {s,send}=setup();assert.equal((await send()).status,200);
  const m=s.creates[0].p.metadata;assert.equal(m.checkout_consent,s.current.monthly);assert.equal(m.checkout_attempt,s.attempt.id);assert.equal(m.consent_policy,'policy1');assert.equal(m.legal_version,'legal1');
});
test('unresolved create refuses a new consent without changing original snapshot',async()=>{
  const {s,send,nextConsent}=setup();s.failCustomerBind=true;s.customer=null;await send();const old=structuredClone(s.attempt);nextConsent();s.failCustomerBind=false;
  assert.equal((await send()).status,409);assert.deepEqual(s.attempt,old);assert.equal(s.customerCreates.length,1);assert.equal(s.creates.length,0);
});
test('same-plan open session requires original consent; new consent cannot replace it',async()=>{
  const {s,send,nextConsent}=setup();await send();const old=structuredClone(s.attempt);nextConsent();assert.equal((await send()).status,409);assert.deepEqual(s.attempt,old);assert.equal(s.expires.length,0);assert.equal(s.creates.length,1);
});
test('expired or completed-canceled session requires a fresh receipt, never binds old proof to new attempt',async()=>{
  const {s,send,nextConsent}=setup();await send();s.sessions.get('cs_1').status='expired';
  const r=await send();assert.equal(r.status,409);assert.equal((await r.json()).code,'new_consent_required');assert.deepEqual(s.attempt,{});assert.equal(s.creates.length,1);
  nextConsent();assert.equal((await send()).status,200);assert.equal(s.creates.length,2);
});
test('a receipt already bound elsewhere never leaves a new poisoned checkout attempt',async()=>{
  const {s,send}=setup();s.bindings.set(s.current.monthly,'different-attempt');const r=await send();assert.equal(r.status,409);assert.equal((await r.json()).code,'new_consent_required');assert.deepEqual(s.attempt,{});assert.equal(s.creates.length,0);
});
test('lost response recovery rejects changed session evidence instead of adopting it',async()=>{
  const {s,send}=setup();s.loseCreateResponse=true;await send();s.sessions.get('cs_1').metadata.checkout_consent='other';assert.equal((await send()).status,409);assert.equal(s.creates.length,1);assert.equal(s.attempt.sessionId,undefined);
});
test('frozen metadata tampering refuses a retry without rewriting Stripe parameters',async()=>{
  const {s,send}=setup();s.failSaveSession=true;await send();s.sessions.clear();s.failSaveSession=false;s.attempt.sessionParams.metadata.checkout_consent='other';const old=structuredClone(s.attempt.sessionParams);
  assert.equal((await send()).status,500);assert.deepEqual(s.attempt.sessionParams,old);assert.equal(s.creates.length,1);
});
test('changed policy binding blocks session expiration and all new billing mutations',async()=>{
  const {s,send}=setup();await send();s.bindError=true;assert.equal((await send({plan:'annual'})).status,403);assert.equal(s.expires.length,0);assert.equal(s.creates.length,1);
});

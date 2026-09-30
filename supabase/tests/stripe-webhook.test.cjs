const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const {stripTypeScriptTypes} = require('node:module');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname,'../functions/stripe-webhook/index.ts'),'utf8');
const monthly = 'price_1UCPzSJ78TGxjoZzD8Pc4ppZ';

function sub(id,status,created=1) {
  return {id,status,created,customer:'cus_test',items:{data:[{price:{id:monthly},current_period_end:1900000000}]}};
}
function event(id,type='customer.subscription.updated',status='active') {
  return {id,type,created:100,data:{object:{...sub('sub_old',status),mode:'subscription',client_reference_id:'account-test'}}};
}
function setup() {
  const state = {subs:[sub('sub_old','active')],events:new Set(),owner:null,nextToken:0,failFinish:false,failList:false,invalidSignature:false,hasMore:false,reads:0, row:{id:'account-test',stripe_customer_id:'cus_test',stripe_subscription_id:null,tier_id:'free',tier_expires_at:null},finishes:[]};
  let handler;
  const admin = {
    from: () => {const lookup={select:()=>lookup,eq:()=>lookup,maybeSingle:async()=>({data:state.row,error:null})}; return lookup;},
    rpc: async (name,p) => {
      if (name==='claim_stripe_webhook') {
        if (state.events.has(p.p_event_id)) return {data:{state:'duplicate'}};
        if (state.owner) return {data:{state:'busy'}};
        state.owner=`token-${++state.nextToken}`;
        return {data:{state:'claimed',token:state.owner}};
      }
      if (name==='release_stripe_webhook') {
        if (state.owner===p.p_token) state.owner=null;
        return {data:null};
      }
      assert.equal(name,'finish_stripe_webhook');
      if (state.failFinish || state.owner!==p.p_token) return {error:{message:'mock transaction failure'}};
      state.finishes.push(p);
      state.row.stripe_subscription_id=p.p_subscription_id;
      if (p.p_tier_id!==null) {state.row.tier_id=p.p_tier_id;state.row.tier_expires_at=p.p_expires_at;}
      state.events.add(p.p_event_id);state.owner=null;
      return {data:null};
    },
  };
  class Stripe {
    constructor() {
      this.webhooks={constructEventAsync:async(body)=>{if(state.invalidSignature) throw Error('bad');return JSON.parse(body);}};
      this.subscriptions={list:async()=>{state.reads++;if(state.failList)throw Error('network');return {data:state.subs,has_more:state.hasMore};}};
      this.prices={retrieve:async()=>({metadata:{tier_id:'monthly'},product:{metadata:{tier_id:'monthly'}}})};
    }
  }
  const context={Request,Response,console:{error:()=>{}},Stripe,createClient:()=>admin,Deno:{env:{get:()=> 'mock-secret'},serve:fn=>handler=fn}};
  vm.runInNewContext(stripTypeScriptTypes(source.replace(/^import .*;\n/gm,'')),context);
  const send=ev=>handler(new Request('https://example.test',{method:'POST',headers:{'stripe-signature':'mock'},body:JSON.stringify(ev)}));
  return {state,send,handler,context};
}

test('older active event cannot restore a currently canceled subscription',async()=>{
  const {state,send}=setup();state.subs=[sub('sub_old','canceled')];
  assert.equal((await send(event('evt_stale'))).status,200);
  assert.equal(state.row.tier_id,'free');assert.ok(state.events.has('evt_stale'));
});
test('duplicate event ID skips Stripe lookup and writes',async()=>{
  const {state,send}=setup();await send(event('evt_same'));const reads=state.reads;
  assert.equal((await send(event('evt_same'))).status,200);assert.equal(state.reads,reads);assert.equal(state.finishes.length,1);
});
test('cancel of old subscription does not revoke a second active one',async()=>{
  const {state,send}=setup();state.subs=[sub('sub_old','canceled'),sub('sub_new','active',2)];
  assert.equal((await send(event('evt_delete','customer.subscription.deleted','canceled'))).status,200);
  assert.equal(state.row.tier_id,'monthly');assert.equal(state.row.stripe_subscription_id,'sub_new');
});
test('expiry uses current subscription item period; trial uses trial_end',async()=>{
  const {state,send,context}=setup();await send(event('evt_expiry'));
  assert.equal(state.row.tier_expires_at,new Date(1900000000000).toISOString());
  context.trial={...sub('trial','trialing'),trial_end:1800000000};
  assert.equal(vm.runInNewContext('expiryOf(trial)',context),new Date(1800000000000).toISOString());
});
test('past_due preserves previous grace access and expiry',async()=>{
  const {state,send}=setup();state.row.tier_id='monthly';state.row.tier_expires_at='previous-expiry';state.subs=[sub('sub_old','past_due')];
  await send(event('evt_grace'));assert.equal(state.row.tier_id,'monthly');assert.equal(state.row.tier_expires_at,'previous-expiry');
});
test('busy customer returns 503 without acknowledgment or Stripe work',async()=>{
  const {state,send}=setup();state.owner='other-worker';
  assert.equal((await send(event('evt_busy'))).status,503);assert.equal(state.reads,0);assert.equal(state.events.size,0);assert.equal(state.owner,'other-worker');
});
test('failed atomic commit leaves event retryable and releases own lease',async()=>{
  const {state,send}=setup();state.failFinish=true;
  assert.equal((await send(event('evt_retry'))).status,500);assert.equal(state.events.size,0);assert.equal(state.owner,null);assert.equal(state.row.tier_id,'free');
  state.failFinish=false;assert.equal((await send(event('evt_retry'))).status,200);assert.ok(state.events.has('evt_retry'));
});
test('Stripe outage cannot revoke existing access or acknowledge event',async()=>{
  const {state,send}=setup();state.failList=true;state.row.tier_id='monthly';
  assert.equal((await send(event('evt_outage'))).status,500);assert.equal(state.row.tier_id,'monthly');assert.equal(state.events.size,0);assert.equal(state.owner,null);
});
test('invalid signature never reaches database or Stripe retrieval',async()=>{
  const {state,send}=setup();state.invalidSignature=true;
  assert.equal((await send(event('evt_bad'))).status,400);assert.equal(state.owner,null);assert.equal(state.reads,0);assert.equal(state.events.size,0);
});
test('partial pagination never produces a free entitlement',async()=>{
  const {state,send}=setup();state.hasMore=true;state.row.tier_id='monthly';
  assert.equal((await send(event('evt_partial'))).status,500);assert.equal(state.reads,5);assert.equal(state.row.tier_id,'monthly');assert.equal(state.events.size,0);
});
test('paused is suspended and unsupported prices fail closed',async()=>{
  const {state,send}=setup();state.subs=[sub('sub_old','paused')];await send(event('evt_paused'));assert.equal(state.row.tier_id,'suspended');
  state.subs=[{...sub('sub_other','active'),items:{data:[{price:{id:'unknown'}}]}}];
  assert.equal((await send(event('evt_unknown'))).status,500);assert.equal(state.row.tier_id,'suspended');
});

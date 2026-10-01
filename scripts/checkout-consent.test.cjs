const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {webcrypto}=require('node:crypto');
const source=fs.readFileSync(path.join(__dirname,'../account.js'),'utf8');
const frontend=source.slice(source.indexOf('// Purchase evidence is independent'),source.indexOf('async function openBillingPortal()'));
function setup(storage=new Map()) {
 const s={user:{id:'own'},policy:{user_id:'own',version:'v1',sha256:'a'.repeat(64),legal_version:'legal1',rights_preserved:true,request_text:'Start immediately',rights_notice:'Rights preserved'},calls:[],invokes:[],legal:true,records:new Map(),result:{data:{url:'https://checkout.stripe.com/c/test'}},location:{href:'account'}};
 const nodes={};const el=id=>nodes[id]??=({checked:false,disabled:false,textContent:'',classList:{hidden:true,toggle(){this.hidden=!this.hidden;},contains(){return this.hidden;}}});
 const ctx={el,showMsg:(_id,msg)=>s.message=msg,hideMsg:()=>{},LEGAL_RELEASE:{version:'legal1'},refreshLegalState:async()=>s.legal,Date,URL,crypto:webcrypto,sessionStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>{if(s.storageError)throw Error('Unavailable');storage.set(k,v);},removeItem:k=>storage.delete(k)},window:{location:s.location},supa:{auth:{getUser:async()=>({data:{user:s.user},error:s.authError})},rpc:async(name,p)=>{
   s.calls.push({name,p});if(s.gate && name===s.gateName)await s.gate;
   if(s.rpcError)return {error:s.rpcError};
   if(name==='get_checkout_consent_policy')return {data:structuredClone(s.policy)};
   if(name==='record_checkout_consent'){
    if(!s.records.has(p.p_request_id))s.records.set(p.p_request_id,{id:webcrypto.randomUUID(),user_id:s.user.id,plan:p.p_plan,policy_version:p.p_policy_version,policy_sha256:p.p_policy_sha256,legal_version:s.policy.legal_version,rights_preserved:true});
    if(s.lostRecord){s.lostRecord=false;return {error:{code:'08006'}};}
    return {data:{...s.records.get(p.p_request_id),...s.receiptChange}};
   }
   if(name==='get_checkout_consent')return s.validationError?{error:s.validationError}:{data:[...s.records.values()].find(r=>r.id===p.p_consent_id)};
   throw Error('Unknown RPC '+name);
 },functions:{invoke:async(name,p)=>{s.invokes.push({name,p});if(s.invokeGate)await s.invokeGate;if(s.networkError)throw Error('Offline');return s.result;}}}};
 vm.runInNewContext(frontend,ctx);
 const ready=async()=>{await ctx.refreshPurchasePolicy();el('purchaseEarlyAccess').checked=el('purchaseRightsNotice').checked=true;};
 return {s,ctx,el,storage,ready};
}
test('initial policy load always renders separate unchecked request and notice as text',async()=>{
 const {s,ctx,el}=setup();s.policy.request_text='<img src=x onerror=alert(1)>';el('purchaseEarlyAccess').checked=true;
 await ctx.refreshPurchasePolicy();assert.equal(el('purchaseEarlyAccess').checked,false);assert.equal(el('purchaseRightsNotice').checked,false);assert.equal(el('purchaseRequestText').textContent,s.policy.request_text);assert.equal(el('purchaseConsent').disabled,false);
});
test('Terms alone, unknown plan or either unchecked purchase input never invokes checkout',async()=>{
 for(const mode of ['terms','request','rights','plan']){const {s,ctx,el,ready}=setup();await ready();if(mode==='terms')s.legal=false;if(mode==='request')el('purchaseEarlyAccess').checked=false;if(mode==='rights')el('purchaseRightsNotice').checked=false;await ctx.startCheckout(mode==='plan'?'unknown':'monthly');assert.equal(s.invokes.length,0);assert.equal(s.records.size,0);}
});
test('affirmed inputs record only notice identity, selected plan and nonce then send evidence ID',async()=>{
 const {s,ctx,ready}=setup();await ready();await ctx.startCheckout('annual');
 const call=s.calls.find(c=>c.name==='record_checkout_consent');assert.deepEqual(Object.keys(call.p).sort(),['p_ack_rights_notice','p_plan','p_policy_sha256','p_policy_version','p_request_early_access','p_request_id'].sort());assert.equal(call.p.p_plan,'annual');assert.equal(call.p.p_request_early_access,true);assert.equal(call.p.p_ack_rights_notice,true);
 assert.equal(s.invokes.length,1);assert.deepEqual(JSON.parse(JSON.stringify(s.invokes[0].p.body)),{plan:'annual',consent_id:[...s.records.values()][0].id});assert.equal(s.location.href,s.result.data.url);
});
test('double clicks across plans are fenced until the first attempt finishes',async()=>{
 const {s,ctx,ready}=setup();await ready();let release;s.gate=new Promise(r=>release=r);s.gateName='get_checkout_consent_policy';const pending=ctx.startCheckout('monthly');await ctx.startCheckout('annual');release();await pending;assert.equal(s.invokes.length,1);assert.equal(s.records.size,1);assert.equal(s.invokes[0].p.body.plan,'monthly');
});
test('same-account retries preserve receipt and never record a new consent',async()=>{
 const {s,ctx,ready}=setup();await ready();s.networkError=true;await ctx.startCheckout('monthly');s.networkError=false;await ctx.startCheckout('monthly');assert.equal(s.records.size,1);assert.equal(s.calls.filter(c=>c.name==='record_checkout_consent').length,1);assert.equal(s.invokes[0].p.body.consent_id,s.invokes[1].p.body.consent_id);
});
test('lost record response retries the exact original nonce',async()=>{
 const {s,ctx,ready}=setup();await ready();s.lostRecord=true;await ctx.startCheckout('monthly');await ctx.startCheckout('monthly');const calls=s.calls.filter(c=>c.name==='record_checkout_consent');assert.equal(calls.length,2);assert.equal(calls[0].p.p_request_id,calls[1].p.p_request_id);assert.equal(s.records.size,1);assert.equal(s.invokes.length,1);
});
test('policy or account changes clear previously checked controls before any record',async()=>{
 for(const change of [s=>s.policy.version='v2',s=>s.policy.sha256='b'.repeat(64),s=>{s.user.id='other';s.policy.user_id='other';}]){const {s,ctx,el,ready}=setup();await ready();change(s);await ctx.startCheckout('monthly');assert.equal(s.invokes.length,0);assert.equal(s.records.size,0);if(s.user.id==='own')assert.equal(el('purchaseEarlyAccess').checked,false);}
});
test('malformed, cross-account, stale legal and unavailable policies fail closed',async()=>{
 for(const change of [s=>s.policy.user_id='other',s=>s.policy.legal_version='old',s=>s.policy.rights_preserved=false,s=>s.policy.sha256='bad',s=>s.policy.request_text='',s=>s.rpcError={code:'08006'}]){const {s,ctx,ready}=setup();await ready();change(s);await ctx.startCheckout('monthly');assert.equal(s.invokes.length,0);assert.equal(s.records.size,0);}
});
test('logout/account reset while recording or invoking prevents redirect',async()=>{
 for(const stage of ['record','invoke']) {
  const {s,ctx,ready}=setup();await ready();let release;const gate=new Promise(r=>release=r);
  if(stage==='record'){s.gate=gate;s.gateName='record_checkout_consent';}else s.invokeGate=gate;
  const pending=ctx.startCheckout('monthly');while(stage==='record'?!s.calls.some(c=>c.name==='record_checkout_consent'):!s.invokes.length)await new Promise(r=>setImmediate(r));ctx.resetPurchaseConsent();release();await pending;assert.equal(s.location.href,'account');if(stage==='record')assert.equal(s.invokes.length,0);
 }
});
test('foreign or tampered receipt cannot reach the Edge Function',async()=>{
 for(const receiptChange of [{user_id:'other'},{plan:'annual'},{policy_sha256:'b'.repeat(64)},{rights_preserved:false},{legal_version:'old'},{id:'bad'}]) {const {s,ctx,ready}=setup();await ready();s.receiptChange=receiptChange;await ctx.startCheckout('monthly');assert.equal(s.invokes.length,0);}
});
test('network/server failures always unlock both plan buttons',async()=>{
 for(const mode of ['rpc','invoke','network']){const {s,ctx,el,ready}=setup();await ready();if(mode==='rpc')s.rpcError={code:'08006'};if(mode==='invoke')s.result={error:{context:{json:async()=>({error:'Retry original plan'})}}};if(mode==='network')s.networkError=true;await ctx.startCheckout('monthly');assert.equal(el('upgradeMonthlyBtn').disabled,false);assert.equal(el('upgradeAnnualBtn').disabled,false);assert.equal(s.location.href,'account');}
});
test('new-consent-required clears saved intent only after explicit server denial',async()=>{
 const {s,ctx,ready}=setup();await ready();s.result={error:{context:{json:async()=>({code:'new_consent_required',error:'Confirm a new request'})}}};await ctx.startCheckout('monthly');const first=[...s.records.keys()][0];s.result={data:{url:'https://checkout.stripe.com/c/test'}};await ctx.startCheckout('monthly');assert.equal(s.records.size,2);assert.notEqual([...s.records.keys()][1],first);
});
test('expired validation requires next explicit click; outages retain original receipt',async()=>{
 for(const denied of [true,false]){const {s,ctx,ready}=setup();await ready();s.networkError=true;await ctx.startCheckout('monthly');s.networkError=false;s.validationError={code:denied?'42501':'08006'};await ctx.startCheckout('monthly');assert.equal(s.records.size,1);assert.equal(s.invokes.length,1);s.validationError=null;await ctx.startCheckout('monthly');assert.equal(s.records.size,denied?2:1);}
});
test('redirect accepts only HTTPS Stripe Checkout without credentials or custom port',async()=>{
 for(const url of ['http://checkout.stripe.com/x','https://checkout.stripe.com.evil.invalid/x','https://u:p@checkout.stripe.com/x','https://checkout.stripe.com:444/x','javascript:alert(1)',undefined]){const {s,ctx,ready}=setup();await ready();s.result={data:{url}};await ctx.startCheckout('monthly');assert.equal(s.location.href,'account');}
});
test('page reload keeps retry identity but never restores checked inputs',async()=>{
 const a=setup();await a.ready();a.s.networkError=true;await a.ctx.startCheckout('monthly');const b=setup(a.storage);b.s.records=a.s.records;await b.ctx.refreshPurchasePolicy();assert.equal(b.el('purchaseEarlyAccess').checked,false);await b.ctx.startCheckout('monthly');assert.equal(b.s.invokes.length,0);await b.ready();await b.ctx.startCheckout('monthly');assert.equal(b.s.calls.filter(c=>c.name==='record_checkout_consent').length,0);assert.equal(b.s.invokes[0].p.body.consent_id,a.s.invokes[0].p.body.consent_id);
});
test('blocked browser storage does not bypass purchase consent',async()=>{
 const {s,ctx,ready}=setup();await ready();s.storageError=true;await ctx.startCheckout('monthly');assert.equal(s.invokes.length,1);assert.equal(s.records.size,1);await ctx.startCheckout('monthly');assert.equal(s.records.size,1);assert.equal(s.invokes.length,2);
});

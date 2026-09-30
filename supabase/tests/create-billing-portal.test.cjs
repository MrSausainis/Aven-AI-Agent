const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {stripTypeScriptTypes}=require('node:module');
const source=fs.readFileSync(path.join(__dirname,'../functions/create-billing-portal/index.ts'),'utf8');
function setup(){
  const s={user:{id:'own-user'},row:{id:'own-user',stripe_customer_id:'cus_own'},customer:{id:'cus_own',metadata:{supabase_uid:'own-user'}},config:{active:true,livemode:true,features:{subscription_cancel:{enabled:true,mode:'at_period_end'},subscription_update:{enabled:false},customer_update:{enabled:false},payment_method_update:{enabled:true},invoice_history:{enabled:true}}},creates:[],customerReads:[],filters:[],configReads:[],url:'https://billing.stripe.com/p/session/synthetic',authError:null,dbError:null};
  const asUser={auth:{getUser:async()=>({data:{user:s.user},error:s.authError})}};
  const admin={from:table=>({select:columns=>({eq:(column,id)=>({maybeSingle:async()=>{s.filters.push({table,columns,column,id});return {data:s.row,error:s.dbError};}})})})};
  function Stripe(){return {customers:{retrieve:async id=>{s.customerReads.push(id);if(s.networkError)throw Error('secret provider message');return s.customer;}},billingPortal:{configurations:{retrieve:async id=>{s.configReads.push(id);return s.config;}},sessions:{create:async(params,options)=>{s.creates.push({params,options});return {url:s.url};}}}};}
  let handler;
  vm.runInNewContext(stripTypeScriptTypes(source.replace(/^import .*;\n/gm,'')),{Stripe,createClient:(_u,key)=>key==='anon'?asUser:admin,Deno:{env:{get:key=>key==='SUPABASE_ANON_KEY'?'anon':'server'},serve:fn=>handler=fn},Request,Response,URL,Date,console:{error:()=>{}}});
  return {s,send:(options={})=>handler(new Request('https://edge.invalid/create-billing-portal',{method:'POST',headers:{Authorization:'Bearer test','Origin':'https://get-avenai.netlify.app',...options.headers},body:options.method==='GET'||options.method==='OPTIONS'?undefined:JSON.stringify(options.body||{}),...options}))};
}
test('verified owner gets only server-linked customer/config/return URL; ignores forged client identity',async()=>{
  const {s,send}=setup();const r=await send({body:JSON.stringify({customer:'cus_other',user_id:'other',configuration:'bpc_other',return_url:'https://evil.invalid'})});assert.equal(r.status,200);assert.equal((await r.json()).url,s.url);assert.deepEqual(s.customerReads,['cus_own']);assert.equal(s.filters[0].id,'own-user');assert.equal(s.filters[0].table,'entitlements');assert.equal(s.creates[0].params.customer,'cus_own');assert.equal(s.creates[0].params.configuration,'bpc_1ULRoQJ78TGxjoZzUbrnIpXH');assert.equal(s.creates[0].params.return_url,'https://get-avenai.netlify.app/account?billing=return');assert.equal(r.headers.get('Cache-Control'),'no-store');
});
test('method/origin/authorization guards stop work before Stripe',async()=>{
  const {s,send}=setup();assert.equal((await send({method:'GET'})).status,405);assert.equal((await send({method:'OPTIONS'})).status,204);assert.equal((await send({headers:{Origin:'https://evil.invalid'}})).status,403);assert.equal((await send({headers:{Authorization:''}})).status,401);assert.equal(s.creates.length,0);assert.equal(s.customerReads.length,0);
});
test('expired auth and database failures never open a portal',async()=>{
  for(const mode of ['user','auth','db','foreign','missing','unlinked']){const {s,send}=setup();if(mode==='user')s.user=null;if(mode==='auth')s.authError={message:'Expired'};if(mode==='db')s.dbError={message:'Denied'};if(mode==='foreign')s.row.id='someone-else';if(mode==='missing')s.row=null;if(mode==='unlinked')s.row.stripe_customer_id=null;assert.notEqual((await send()).status,200);assert.equal(s.creates.length,0);assert.equal(s.customerReads.length,0);}
});
test('deleted or conflicting customer refuses; legacy missing metadata trusts server-owned link',async()=>{
  for(const mode of ['deleted','conflict']){const {s,send}=setup();if(mode==='deleted')s.customer.deleted=true;else s.customer.metadata.supabase_uid='other';assert.equal((await send()).status,409);assert.equal(s.creates.length,0);}
  const {s,send}=setup();s.customer.metadata={};assert.equal((await send()).status,200);
});
test('configuration drift rejects immediate cancellation, plan changes and inactive/wrong-mode config',async()=>{
  for(const change of [s=>s.config.active=false,s=>s.config.livemode=false,s=>s.config.features.subscription_cancel.mode='immediately',s=>s.config.features.subscription_cancel.enabled=false,s=>s.config.features.subscription_update.enabled=true,s=>s.config.features.customer_update.enabled=true,s=>s.config.features.payment_method_update.enabled=false,s=>s.config.features.invoice_history.enabled=false]){const {s,send}=setup();change(s);assert.equal((await send()).status,503);assert.equal(s.creates.length,0);}
});
test('repeated session requests share an idempotency key within the time bucket',async()=>{
  const {s,send}=setup();await send();await send();assert.equal(s.creates[0].options.idempotencyKey,s.creates[1].options.idempotencyKey);assert.ok(s.creates[0].options.idempotencyKey.startsWith('portal:own-user:cus_own:'));
});
test('untrusted returned URL and Stripe exception fail without leaking details',async()=>{
  for(const url of ['http://billing.stripe.com/p/session/x','https://billing.stripe.com.evil.invalid/x','https://user:secret@billing.stripe.com/x','https://billing.stripe.com:444/x']){const {s,send}=setup();s.url=url;assert.equal((await send()).status,503);}
  const {s,send}=setup();s.networkError=true;const r=await send();assert.equal(r.status,503);assert.ok(!(await r.text()).includes('secret provider message'));
});

const account=fs.readFileSync(path.join(__dirname,'../../account.js'),'utf8');
const frontend=account.slice(account.indexOf('async function openBillingPortal()'),account.indexOf('el("billingManageBtn").onclick'));
function client(){const s={busy:[],messages:[],result:{data:{url:'https://billing.stripe.com/p/session/synthetic'},error:null},location:{href:'account'}};const ctx={supa:{functions:{invoke:async()=>{if(s.throwError)throw Error('Offline');return s.result;}}},el:()=>({}),hideMsg:()=>{},showMsg:(_id,msg)=>s.messages.push(msg),setBusy:(_e,b)=>s.busy.push(b),URL,window:{location:s.location}};vm.runInNewContext(frontend,ctx);return {s,open:ctx.openBillingPortal};}
test('frontend redirects to Stripe and always resets busy state',async()=>{const {s,open}=client();await open();assert.equal(s.location.href,s.result.data.url);assert.deepEqual(s.busy,[true,false]);});
test('frontend handles server/network errors and refuses foreign URLs',async()=>{
  for(const mode of ['server','network','foreign','missing']){const {s,open}=client();if(mode==='server')s.result.error={context:{json:async()=>({error:'No Stripe billing account'})}};if(mode==='network')s.throwError=true;if(mode==='foreign')s.result.data.url='https://evil.invalid';if(mode==='missing')s.result.data={};await open();assert.equal(s.location.href,'account');assert.equal(s.busy.at(-1),false);assert.equal(s.messages.length,1);if(mode==='server')assert.equal(s.messages[0],'No Stripe billing account');}
});

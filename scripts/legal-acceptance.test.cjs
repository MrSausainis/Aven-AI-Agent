const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const {createHash}=require('node:crypto');
const source=fs.readFileSync(path.join(__dirname,'../account.js'),'utf8');
const releaseCode=source.slice(source.indexOf('const LEGAL_RELEASE ='),source.indexOf('const THEME_COLORS'));
function setup() {
 const s={user:{id:'own'},status:null,calls:[],error:null,authError:null,refreshes:0,invokes:0,handed:0};
 const nodes={};const el=id=>nodes[id]??=({checked:false,disabled:false,textContent:'',scrollIntoView:()=>{},classList:{hidden:false,add(c){if(c==='hidden')this.hidden=true;},remove(c){if(c==='hidden')this.hidden=false;},contains(c){return c==='hidden'&&this.hidden;}}});
 const context={el,Date,Number,showMsg:(id,msg)=>el(id).textContent=msg,hideMsg:()=>{},setBusy:(node,on)=>node.disabled=on,
  refreshSession:async()=>{s.refreshes++;el('legalConfirmBtn').disabled=true;},
  supa:{auth:{getUser:async()=>({data:{user:s.user},error:s.authError})},rpc:async(name,p)=>{s.calls.push({name,p});return {data:s.status,error:s.error};},functions:{invoke:async()=>{s.invokes++;return {data:{url:'https://checkout.stripe.com/test'}};}}},
  window:{location:{}},
 };
 vm.runInNewContext(releaseCode+'\nthis.release=LEGAL_RELEASE;',context);
 s.status={...context.release,accepted:false,accepted_at:null};
 vm.runInNewContext(source.slice(source.indexOf('async function refreshLegalState('),source.indexOf('function renderFeatures(')),context);
 vm.runInNewContext(source.slice(source.indexOf('// Purchase evidence is independent'),source.indexOf('async function openBillingPortal(')),context);
 return {s,context,el};
}
test('pinned public document copies match the archived SQL bodies and frontend hashes',()=>{
 const {context}=setup();
 const sql=fs.readFileSync(path.join(__dirname,'../supabase/proposals/purchase-legal-release.sql'),'utf8');
 for(const name of ['terms','privacy']) {
  const content=fs.readFileSync(path.join(__dirname,'../'+name+'-'+context.release.version+'.html'),'utf8');
  const tag='$'+name+'_archive$';
  assert.equal(content,sql.split(tag)[1]);
  assert.equal(createHash('sha256').update(content).digest('hex'),context.release[name+'_sha256']);
 }
});
test('existing accounts with no ledger evidence get unchecked controls; status never accepts',async()=>{
 const {s,context,el}=setup();
 assert.equal(await context.refreshLegalState('own'),false);
 assert.equal(el('legalConfirmBtn').disabled,false);assert.equal(el('legalTerms').checked,false);assert.equal(el('legalPrivacy').checked,false);
 assert.deepEqual(s.calls.map(c=>c.name),['get_legal_acceptance_status']);
});
test('acceptance hides controls only after matching version/hashes and a valid server time',async()=>{
 const {s,context,el}=setup();s.status.accepted=true;s.status.accepted_at='2026-09-30T20:00:00Z';
 assert.equal(await context.refreshLegalState(),true);assert.equal(el('legalControls').classList.hidden,true);
 for(const change of [{version:'changed'},{terms_sha256:'changed'},{privacy_sha256:'changed'},{accepted_at:null}]) {
  const t=setup();Object.assign(t.s.status,{accepted:true,accepted_at:'2026-09-30T20:00:00Z'},change);
  assert.equal(await t.context.refreshLegalState(),false);
 }
});
test('offline, expired, changed-account and malformed status fail closed without losing dashboard controls',async()=>{
 for(const change of [{error:{message:'offline'}},{user:null},{authError:{message:'expired'}},{status:null},{user:{id:'other'}}]) {
  const {s,context,el}=setup();Object.assign(s,change);
  assert.equal(await context.refreshLegalState('own'),false);assert.equal(el('legalConfirmBtn').disabled,true);
  assert.equal(el('legalControls').classList.hidden,false);
 }
});
test('explicit checkboxes submit only pinned document evidence, never client identity or time',async()=>{
 const {s,context,el}=setup();await context.refreshLegalState();s.calls=[];
 await context.confirmCurrentLegal();assert.equal(s.calls.length,0);
 el('legalTerms').checked=true;await context.confirmCurrentLegal();assert.equal(s.calls.length,0);
 el('legalPrivacy').checked=true;s.status={...context.release,accepted:true,accepted_at:'2026-09-30T20:00:00Z'};
 await context.confirmCurrentLegal();
 assert.equal(s.refreshes,1);assert.equal(el('legalConfirmBtn').disabled,true);
 const call=s.calls[0];assert.equal(call.name,'accept_current_legal');
 assert.deepEqual(JSON.parse(JSON.stringify(call.p)),{p_version:context.release.version,p_terms_sha256:context.release.terms_sha256,p_privacy_sha256:context.release.privacy_sha256,p_accept_terms:true,p_ack_privacy:true});
});
test('failed or changed confirmation does not navigate or report success; repeated clicks are fenced',async()=>{
 for(const mode of ['error','changed','offline']) {
  const {s,context,el}=setup();await context.refreshLegalState();el('legalTerms').checked=el('legalPrivacy').checked=true;
  if(mode==='error')s.error={message:'unavailable'};else if(mode==='changed')s.status.version='new';else s.user=null;
  await context.confirmCurrentLegal();assert.equal(s.refreshes,0);assert.equal(el('legalConfirmBtn').disabled,false);
 }
 const {s,context,el}=setup();el('legalConfirmBtn').disabled=true;await context.confirmCurrentLegal();assert.equal(s.calls.length,0);
});
test('new checkout waits for ledger acceptance and fails closed on server status outage',async()=>{
 const {s,context}=setup();await context.startCheckout('monthly');assert.equal(s.invokes,0);
 s.status.accepted=true;s.status.accepted_at='2026-09-30T20:00:00Z';await context.startCheckout('annual');assert.equal(s.invokes,0);
 s.error={message:'offline'};await context.startCheckout('monthly');assert.equal(s.invokes,0);
});
test('actual session renderer keeps billing/data dashboard available while gating desktop token handoff',async()=>{
 for(const accepted of [false,true]) {
  const {s,context}=setup();
  const session={user:{id:'own',email:'test@example.invalid'},access_token:'synthetic',refresh_token:'synthetic'};
  context.supa.auth.getSession=async()=>({data:{session}});
  context.supa.from=table=>{const q={select:()=>q,eq:()=>q,maybeSingle:async()=>({data:table==='profiles'?{account_name:'Example'}:{tier_id:'free',tier_source:'signup',tiers:{allowed_themes:['Frost']}}})};return q;};
  context.refreshLegalState=async uid=>{assert.equal(uid,'own');return accepted;};
  context.PAGE_PARAMS=new URLSearchParams('desktop_callback=http://localhost:1234/callback&desktop_state=state&desktop_handoff=post-v2');
  context.LEGACY_THEME_ALIASES={};context.showWrap=which=>s.wrap=which;
  context.renderFeatures=()=>{};context.renderThemeSwatches=()=>{};context.loadOwnReview=()=>{};
  context.validatedDesktopCallback=()=>new URL('http://localhost:1234/callback');
  context.postDesktopSession=()=>s.handed++;
  vm.runInNewContext(source.slice(source.indexOf('async function refreshSession(){'),source.indexOf('// Server RPCs')),context);
  await context.refreshSession();
  assert.equal(s.handed,accepted?1:0);
  if(!accepted)assert.equal(s.wrap,'dash');
 }
});


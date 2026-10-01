const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname,'../account.js'),'utf8');
// Execute the actual standalone handler, with browser/Supabase boundaries mocked.
const handlerSource = source.slice(source.indexOf('async function exportAccountData(){'),source.indexOf('async function deleteOwnReview(){'));
function setup() {
  const s = {
    user:{id:'own-account',email:'user@example.invalid',created_at:'2026-01-01',user_metadata:{account_name:'Example',legal_version:'2026-09-29'},access_token:'must-not-export-access',refresh_token:'must-not-export-refresh',provider_token:'must-not-export-provider'},
    rows:{profiles:{id:'own-account',account_name:'Example',created_at:'2026-01-01',preferred_theme:'Obsidian'},entitlements:{id:'own-account',account_name:'Example',tier_id:'monthly',stripe_customer_id:'cus_mock',stripe_subscription_id:'sub_mock',stripe_subscription_status:'active'},reviews:null,checkout_consents:[],purchase_confirmations:[],legal_acceptances:[{user_id:'own-account',version:'2026-09-30.1',accepted_at:'2026-09-30T20:00:00Z'}]},
    queries:[],messages:[],busy:[],blobs:[],clicks:0,revoked:[],errors:{},authError:null,
  };
  const supa={auth:{getUser:async()=>({data:{user:s.user},error:s.authError})},from:(table)=>{
    const query={table};const execute=async()=>{s.queries.push(query);if(s.rejectQuery)throw Error('Offline');return {data:s.rows[table],error:s.errors[table]||null};};const q={select:(columns)=>{query.columns=columns;return q;},eq:(column,id)=>{query.column=column;query.id=id;return q;},maybeSingle:execute,then:(resolve,reject)=>execute().then(resolve,reject)};return q;
  }};
  const context={supa,Blob,URL:{createObjectURL:(blob)=>{s.blobs.push(blob);return 'blob:synthetic';},revokeObjectURL:(url)=>s.revoked.push(url)},document:{createElement:()=>({click:()=>s.clicks++,remove:()=>{}}),body:{appendChild:()=>{}}},el:()=>({}),hideMsg:()=>{},showMsg:(_id,message,type)=>s.messages.push({message,type}),setBusy:(_el,busy,label)=>s.busy.push({busy,label})};
  vm.runInNewContext(handlerSource,context);
  return {s,send:()=>context.exportAccountData()};
}
test('export includes billing identifiers and metadata without SDK credentials',async()=>{
  const {s,send}=setup();await send();assert.equal(s.clicks,1);const text=await s.blobs[0].text();const result=JSON.parse(text);
  assert.equal(result.schema_version,3);assert.equal(result.scope,'basic_account');assert.equal(result.entitlement.stripe_customer_id,'cus_mock');assert.equal(result.entitlement.stripe_subscription_id,'sub_mock');assert.equal(result.entitlement.stripe_subscription_status,'active');assert.equal(result.account.user_metadata.legal_version,'2026-09-29');assert.equal(result.review,null);assert.equal(result.legal_acceptances[0].version,'2026-09-30.1');
  for(const key of ['must-not-export-access','must-not-export-refresh','must-not-export-provider'])assert.ok(!text.includes(key));
  assert.ok(s.queries.every(q=>q.column===(['legal_acceptances','checkout_consents','purchase_confirmations'].includes(q.table)?'user_id':'id')&&q.id==='own-account'));assert.ok(s.queries.every(q=>!q.columns.includes('*')));assert.deepEqual(s.revoked,['blob:synthetic']);assert.equal(s.busy.at(-1).busy,false);assert.equal(s.messages.at(-1).type,'ok');
});
test('query error never produces a misleading partial successful download',async()=>{
  for(const table of ['profiles','entitlements','reviews','legal_acceptances','checkout_consents','purchase_confirmations']){const {s,send}=setup();s.errors[table]={message:'Denied'};await send();assert.equal(s.clicks,0);assert.equal(s.blobs.length,0);assert.equal(s.messages.at(-1).type,'error');assert.equal(s.busy.at(-1).busy,false);}
});
test('missing required rows and wrong owner fail; optional review remains optional',async()=>{
  for(const table of ['profiles','entitlements']){const {s,send}=setup();s.rows[table]=null;await send();assert.equal(s.clicks,0);assert.equal(s.messages.at(-1).type,'error');}
  const {s,send}=setup();s.rows.reviews={id:'another-account',rating:5};await send();assert.equal(s.clicks,0);
});
test('unauthenticated or unavailable auth prevents data reads and resets the button',async()=>{
  for(const mode of ['missing','error']){const {s,send}=setup();if(mode==='missing')s.user=null;else s.authError={message:'Network or expired'};await send();assert.equal(s.queries.length,0);assert.equal(s.clicks,0);assert.equal(s.messages.at(-1).type,'error');assert.equal(s.busy.at(-1).busy,false);}
});
test('network exceptions fail cleanly without download',async()=>{
  const {s,send}=setup();s.rejectQuery=true;await send();assert.equal(s.clicks,0);assert.equal(s.messages.at(-1).type,'error');assert.equal(s.busy.at(-1).busy,false);
});

test('export requires complete own acceptance history, including an empty history',async()=>{
 for(const value of [null,[{user_id:'another-account'}]]) {const {s,send}=setup();s.rows.legal_acceptances=value;await send();assert.equal(s.clicks,0);}
 const {s,send}=setup();s.rows.legal_acceptances=[];await send();assert.equal(s.clicks,1);assert.deepEqual(JSON.parse(await s.blobs[0].text()).legal_acceptances,[]);
});
test('new purchase evidence is complete, own-account-scoped and present in schema v3',async()=>{
 const {s,send}=setup();s.rows.checkout_consents=[{user_id:'own-account',id:'consent',request_text:'Start now'}];s.rows.purchase_confirmations=[{user_id:'own-account',id:'receipt',payload_text:'immutable copy'}];await send();const copy=JSON.parse(await s.blobs[0].text());assert.equal(copy.purchase_consents[0].request_text,'Start now');assert.equal(copy.purchase_confirmations[0].payload_text,'immutable copy');
 for(const table of ['checkout_consents','purchase_confirmations'])for(const data of [null,[{user_id:'foreign'}]]){const t=setup();t.s.rows[table]=data;await t.send();assert.equal(t.s.blobs.length,0);}
});

const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname,'../account.js'),'utf8');
const helper = source.slice(source.indexOf('function canonicalPublicName('),source.indexOf('if (DESKTOP_LOGIN_MODE)'));
function setup() {
  const nodes = Object.fromEntries(['su_name','su_email','su_pass','su_legal','su_submit','settingsSave','settingsName','dashName','dashAvatar'].map(id=>[id,{value:'',checked:true}]));
  nodes.su_email.value='test@example.invalid';nodes.su_pass.value='synthetic-password';
  const calls=[];const messages=[];
  const context={el:id=>nodes[id],hideMsg:()=>{},showMsg:(_id,msg)=>messages.push(msg),setBusy:()=>{},LEGAL_VERSION:'2026-09-29',Date,
    supa:{auth:{signUp:async args=>{calls.push(args);return {error:{message:'synthetic stop'}};},getSession:async()=>({data:{session:{user:{id:'own-id'}}}})},from:table=>({update:args=>({eq:async(column,id)=>{calls.push({table,args,column,id});return {error:null};}})})}};
  vm.runInNewContext(helper,context);
  for(const [start,end] of [['el("su_submit").onclick =','el("li_submit").onclick ='],['el("settingsSave").onclick =','el("settingsPassSave").onclick =']]) vm.runInNewContext(source.slice(source.indexOf(start),source.indexOf(end)),context);
  return {nodes,calls,messages,canonical:context.canonicalPublicName};
}
test('canonical names preserve letters and normalize NFC and ASCII spaces',()=>{
  const {canonical}=setup();assert.equal(canonical('  Z\u030C  Name_9.-  '),'Ž Name_9.-');assert.equal(canonical('汉字'),'汉字');assert.equal(canonical('Z'),'Z');
  assert.equal(canonical('\u{10400}'.repeat(32)),'\u{10400}'.repeat(32));assert.equal(canonical('a'.repeat(32)),'a'.repeat(32));
});
test('invalid input cannot reach either signup or profile update',async()=>{
  for(const name of ['', '   ','a'.repeat(33),'line\nbreak','zero\u200Bwidth','bidi\u202Ename','<script>','email@name','🙂','\tname','name\u00A0']){
    const {nodes,calls}=setup();nodes.su_name.value=name;nodes.settingsName.value=name;
    await nodes.su_submit.onclick();await nodes.settingsSave.onclick();assert.equal(calls.length,0,name);
  }
});
test('signup sends canonical metadata and settings updates only the current profile',async()=>{
  const {nodes,calls}=setup();nodes.su_name.value='  Z\u030C  Name  ';await nodes.su_submit.onclick();assert.equal(calls[0].options.data.account_name,'Ž Name');
  nodes.settingsName.value='  New  Name  ';await nodes.settingsSave.onclick();assert.equal(calls[1].table,'profiles');assert.equal(calls[1].args.account_name,'New Name');assert.equal(calls[1].column,'id');assert.equal(calls[1].id,'own-id');assert.equal(nodes.settingsName.value,'New Name');assert.equal(nodes.dashName.textContent,'New Name');
});

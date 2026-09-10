const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const moduleCode=fs.readFileSync('iphone-app-v13/secure-auth-v1.js','utf8');
const resetHtml=fs.readFileSync('reset-password/index.html','utf8');
const resetCode=resetHtml.match(/<script>\s*([\s\S]*?)<\/script>/)[1];
function environment(html='',url='https://example.test/reset-password/',respond=()=>({})){
 const els=new Map(),requests=[],successes=[],replaced=[];
 function element(id){
  if(els.has(id))return els.get(id);
  const flags=new Set();
  const e={id,value:'',textContent:'',disabled:false,isConnected:true,reportValidity:()=>true,
   classList:{toggle:(c,on)=>{if(on)flags.add(c);else flags.delete(c)},contains:c=>flags.has(c)}};
  let markup='';
  Object.defineProperty(e,'innerHTML',{get:()=>markup,set:v=>{markup=v;for(const m of v.matchAll(/id="([^"]+)"[^>]*>/g)){const item=element(m[1]);const val=m[0].match(/value="([^"]*)"/);if(val)item.value=val[1]}}});
  els.set(id,e);return e;
 }
 const app=element('app');app.innerHTML=html;
 const ctx={app,document:{getElementById:element},console,URLSearchParams,URL,AbortController,setTimeout,clearTimeout,
  location:new URL(url),history:{replaceState:(_a,_b,path)=>replaced.push(path)},
  U:'https://whgziwaegjzqsgcntesr.supabase.co',K:'public-key',esc:x=>String(x??''),
  authSuccess:(...args)=>successes.push(args),login:()=>{},
  localStorage:{getItem:()=>{throw Error('Must not read an existing account session')}},
  sessionStorage:{getItem:()=>{throw Error('Must not read session storage')}},
  boot:()=>{throw Error('Recovery must not log in')},
  sb:{auth:{signInWithPassword:()=>{throw Error('Recovery must not sign in')},updateUser:()=>{throw Error('Do not use a stored browser session')}}},
  fetch:async(url,options)=>{requests.push({url,options});const r=await respond(url,options);return {ok:r.status===undefined||r.status<400,status:r.status||200,json:async()=>r.body??r}}
 };
 vm.createContext(ctx);return {ctx,els,requests,successes,replaced,element};
}
const event={preventDefault(){}};
const settle=()=>new Promise(r=>setImmediate(r));
test('recovery asks only for email and sends no password or session',async()=>{
 const e=environment();vm.runInContext(moduleCode,e.ctx);e.ctx.forgotScreen('Alice@Example.test');
 assert(!e.ctx.app.innerHTML.includes('type="password"'));
 assert(e.ctx.app.innerHTML.includes('INVIA LINK DI RECUPERO'));
 await e.element('recoveryRequestForm').onsubmit(event);
 assert.equal(e.requests.length,1);
 const q=e.requests[0];assert(q.url.includes('/recover?redirect_to='));
 assert.deepEqual(JSON.parse(q.options.body),{email:'alice@example.test'});
 assert(!('Authorization' in q.options.headers));assert.equal(e.successes.length,1);
});
test('a mail service error is not reported as a sent link',async()=>{
 const e=environment('','https://example.test',()=>({status:503,body:{code:'unexpected_failure'}}));
 vm.runInContext(moduleCode,e.ctx);e.ctx.forgotScreen('alice@example.test');
 await e.element('recoveryRequestForm').onsubmit(event);
 assert.equal(e.successes.length,0);assert.equal(e.element('forgotGo').disabled,false);
 assert(e.element('forgotErr').textContent.includes('non disponibile'));
});
test('registration uses native confirmation, never an admin reset or auto-login',async()=>{
 const e=environment();vm.runInContext(moduleCode,e.ctx);e.ctx.registerScreen('alice@example.test');
 for(const [id,v] of Object.entries({regName:'Alice',regSurname:'Test',regPhone:'1234567890',regPassword:'a-test-password-1',regPassword2:'a-test-password-1'}))e.element(id).value=v;
 await e.element('secureRegistrationForm').onsubmit(event);
 assert.equal(e.requests.length,1);assert(e.requests[0].url.includes('/auth/v1/signup?'));
 assert(!e.requests[0].url.includes('admin'));assert.equal(e.successes.length,1);
 assert(!JSON.parse(e.requests[0].options.body).data.optyker_client_id);
});
test('a misconfigured auto-confirm response is never persisted',async()=>{
 const e=environment('','https://example.test',()=>({access_token:'must-not-be-used'}));
 vm.runInContext(moduleCode,e.ctx);
 await assert.rejects(e.ctx.optykerPublicAuth('signup',{email:'alice@example.test'}),/conferma email/);
});
test('opening reset without a link cannot reuse a logged-in account',async()=>{
 const e=environment(resetHtml);vm.runInContext(resetCode,e.ctx);await settle();
 assert.equal(e.requests.length,0);assert.equal(e.element('invalid').classList.contains('hidden'),false);
 assert.deepEqual(e.replaced,['/reset-password/']);
});
test('a forged or expired bearer cannot show the password form',async()=>{
 const e=environment(resetHtml,'https://example.test/reset-password/#type=recovery&access_token=invalid&refresh_token=invalid',()=>({status:401,body:{code:'bad_jwt'}}));
 vm.runInContext(resetCode,e.ctx);await settle();
 assert.equal(e.requests.length,1);assert.equal(e.requests[0].options.method,'GET');
 assert.equal(e.element('passwordSection').classList.contains('hidden'),true);
});
test('a reset link changes only the bearer account, never a supplied email/id',async()=>{
 const user={id:'account-a',email:'alice@example.test',email_confirmed_at:'2026-01-01'};
 const e=environment(resetHtml,'https://example.test/reset-password/?email=bob@example.test&user_id=account-b#type=recovery&access_token=token-a&refresh_token=refresh-a',url=>({body:url.includes('/user')?user:{}}));
 vm.runInContext(resetCode,e.ctx);await settle();
 assert(e.element('accountEmail').textContent.includes('alice@example.test'));
 e.element('pwd1').value=e.element('pwd2').value='new-password-for-a';
 await e.element('passwordForm').onsubmit(event);
 const writes=e.requests.filter(r=>r.options.method==='PUT');
 assert.equal(writes.length,1);assert.deepEqual(JSON.parse(writes[0].options.body),{password:'new-password-for-a'});
 assert.equal(writes[0].options.headers.Authorization,'Bearer token-a');
 assert(e.requests.some(r=>r.url.endsWith('/logout?scope=global')));
 const count=e.requests.length;await e.element('passwordForm').onsubmit(event);assert.equal(e.requests.length,count);
 assert.equal(e.element('done').classList.contains('hidden'),false);
});
test('used token hashes are refused and no password change is attempted',async()=>{
 const e=environment(resetHtml,'https://example.test/reset-password/?type=recovery&token_hash=used',()=>({status:403,body:{code:'otp_expired'}}));
 vm.runInContext(resetCode,e.ctx);await settle();
 assert.equal(e.requests.length,1);assert(e.requests[0].url.endsWith('/verify'));
 assert.equal(e.element('invalid').classList.contains('hidden'),false);
});
test('signup confirmation never opens password reset or creates app login',async()=>{
 const e=environment(resetHtml,'https://example.test/reset-password/#type=signup&access_token=signup-a&refresh_token=refresh-a',url=>({body:url.includes('/user')?{id:'a',email:'alice@example.test',email_confirmed_at:'2026-01-01'}:{}}));
 vm.runInContext(resetCode,e.ctx);await settle();
 assert.equal(e.element('confirmed').classList.contains('hidden'),false);
 assert.equal(e.element('passwordSection').classList.contains('hidden'),true);
 assert(!e.requests.some(r=>r.options.method==='PUT'));
});
test('legacy endpoint rejects all unauthenticated password-write variants',async()=>{
 let handler;
 const code=fs.readFileSync('supabase/functions/optyker-customer-auth/index.ts','utf8').replace(/^import.*\n/m,'').replace('(req: Request)','(req)');
 vm.runInNewContext(code,{Deno:{serve:fn=>handler=fn},Response,JSON});
 for(const action of ['reset','register','update','password_reset']){
  const response=await handler(new Request('https://example.test',{method:'POST',body:JSON.stringify({action,email:'another@example.test',password:'arbitrary-password'})}));
  assert.equal(response.status,403);const data=await response.json();assert.equal(data.ok,false);assert(!data.access_token);
 }
});
test('deployment contains the new flow and preserves both app interfaces',()=>{
 const app=fs.readFileSync('_site/iphone-app-v13/index.html','utf8');
 for(const s of ['OPTYKER_VERIFIED_EMAIL_RECOVERY_V1','OPTYKER_IPHONE_STAFF_REFERENCE_V1','OPTYKER_IPHONE_REFERENCE_UI_V2','refNewsDrawer'])assert(app.includes(s),s);
 for(const s of ["customerAuth('reset'","customerAuth('register'",'forgotPwd1','nessun link email'])assert(!app.includes(s),s);
 assert(app.indexOf('optykerRecoveryHandoffV1')<app.indexOf('id="optykerLocalAuth"'));
 assert(fs.readFileSync('_site/reset-password/index.html','utf8').includes('OPTYKER_ISOLATED_PASSWORD_RECOVERY_V1'));
 for(const [i,m] of [...app.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].entries())new vm.Script(m[1],{filename:'app-script-'+i});
});

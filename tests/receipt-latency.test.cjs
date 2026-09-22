const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../_site/rch-cloud-relay.js'),'utf8');
assert.ok(source.includes('OPTYKER_RCH_LATENCY_20260922'),'Build before running this test');
const tick=ms=>new Promise(r=>setTimeout(r,ms));
const ready={ok:true,mode:'REG',idleState:'0',busy:0,errorCode:0,printerError:0,paperEnd:0,coverOpen:0};
function env(config={}){
 const calls=[],events=[],elements=new Map();let localCalls=0,legacyIssues=0,legacyChecks=0;
 function element(){const children=new Map();return {textContent:'',innerHTML:'',disabled:false,style:{setProperty(){}},dataset:{},classList:{add(){},remove(){},toggle(){}},setAttribute(){},appendChild(){},remove(){},querySelector(s){if(!children.has(s))children.set(s,element());return children.get(s)},querySelectorAll(){return []}}}
 const document={readyState:'loading',documentElement:element(),body:element(),getElementById(id){return elements.get(id)||null},createElement(){return element()},addEventListener(){}};
 const window={addEventListener(){},OPTYKER_CLOUD:{username:'TEST_ONLY',password:'FIXTURE_NOT_REAL'},OPTYKER_FISCAL:{checkReady:async()=>{legacyChecks++;return true},issuePayment:async()=>{legacyIssues++;await tick(10);return {state:'completed',path:'legacy'}},openSale:async()=>{},openTs:()=>{}}};
 const ctx=vm.createContext({window,document,console,setTimeout,clearTimeout,AbortController,Promise,Date,Intl,Map,Set,MutationObserver:class{observe(){}},fetch:async(url,init)=>{
  const body=init?.body?JSON.parse(init.body):{},a=body.action||new URL(url).pathname;calls.push(a);events.push(a+' start');
  let data;if(a==='/health'){localCalls++;await tick(config.healthDelay||1);if(!config.local)throw new Error('NO_LOCAL');return {ok:true,json:async()=>({ok:true,version:'1.8-auto-receipt'})}}
  if(a==='status'){await tick(config.statusDelay||1);data={online:true,status:config.status||ready};events.push(a+' end')}
  else if(a==='prepare'){await tick(config.prepareDelay||1);data={job:{id:'TEST_JOB',state:config.jobState||'prepared'},...(!config.jobState?{claim_token:'TEST_CAPABILITY'}:{})};events.push(a+' end')}
  else if(a==='queue_fiscal'){data={id:'TEST_COMMAND'};events.push(a+' end')}
  else if(a==='job'){await tick(config.jobDelay||1);data={job:{id:'TEST_JOB',state:config.finalState||'completed'}}}
  else if(a==='command_status'){await tick(config.commandDelay||1);data={state:config.commandState||'completed'}}
  else throw Error('Unexpected action '+a);
  return {ok:true,json:async()=>({ok:true,data})};
 }});
 const exposed=source.replace(/\}\)\(\);\s*$/,"window.__test={localAvailable,wrapFiscal,queueFiscal,cloudReady};})();");
 assert.notEqual(exposed,source);vm.runInContext(exposed,ctx);window.__test.wrapFiscal();
 return {window,calls,events,counts:()=>({localCalls,legacyIssues,legacyChecks})};
}
test('capability discovery is coalesced; REG readiness is not cached',async()=>{
 const e=env({healthDelay:20});await Promise.all([e.window.__test.localAvailable(),e.window.__test.localAvailable()]);await e.window.OPTYKER_FISCAL.checkReady();await e.window.OPTYKER_FISCAL.checkReady();
 assert.equal(e.counts().localCalls,1);assert.equal(e.calls.filter(x=>x==='status').length,2);assert.equal(e.calls.filter(x=>x==='prepare').length,0);
});
test('cloud prepare and readiness overlap but enqueue waits for BOTH; repeated click shares one attempt',async()=>{
 const e=env({statusDelay:80,prepareDelay:70});const p=e.window.OPTYKER_FISCAL.issuePayment('sale','pay'),p2=e.window.OPTYKER_FISCAL.issuePayment('sale','pay');assert.strictEqual(p,p2);await p;
 assert.ok(e.events.indexOf('prepare start')<e.events.indexOf('status end'));assert.ok(e.events.indexOf('status start')<e.events.indexOf('prepare end'));
 assert.ok(e.events.indexOf('queue_fiscal start')>e.events.indexOf('status end'));assert.ok(e.events.indexOf('queue_fiscal start')>e.events.indexOf('prepare end'));
 assert.equal(e.calls.filter(x=>x==='prepare').length,1);assert.equal(e.calls.filter(x=>x==='queue_fiscal').length,1);
});
test('busy or Z printer never receives a queue command even when prepare succeeds',async()=>{
 for(const status of [{...ready,mode:'Z'},{...ready,busy:1,ok:false}]){const e=env({status,prepareDelay:15});await assert.rejects(e.window.OPTYKER_FISCAL.issuePayment('sale','pay'),/non risulta pronta/);await tick(20);assert.ok(!e.calls.includes('queue_fiscal'));}
});
test('uncertain and cancelled payments are never re-enqueued',async()=>{
 for(const jobState of ['uncertain','cancelled']){const e=env({jobState});const result=await e.window.OPTYKER_FISCAL.issuePayment('sale','pay');assert.equal(result.state,jobState);assert.ok(!e.calls.includes('queue_fiscal'));}
});
test('terminal fiscal state does not wait for the slower command read',async()=>{
 const e=env({commandDelay:250});const start=performance.now();const r=await e.window.OPTYKER_FISCAL.issuePayment('sale','pay');assert.equal(r.state,'completed');assert.ok(performance.now()-start<200,'terminal fiscal read waited for unrelated relay read');
});
test('local path preserves the native POS5 handlers and never falls back after a fiscal call',async()=>{
 const e=env({local:true});await e.window.OPTYKER_FISCAL.checkReady();await e.window.OPTYKER_FISCAL.issuePayment('sale','pay');assert.equal(e.counts().legacyChecks,1);assert.equal(e.counts().legacyIssues,1);assert.ok(!e.calls.includes('prepare'));assert.ok(!e.calls.includes('queue_fiscal'));
});
test('relay completion is not treated as a completed fiscal document',async()=>{
 const e=env({finalState:'uncertain',commandState:'completed'});const r=await e.window.OPTYKER_FISCAL.issuePayment('sale','pay');assert.equal(r.state,'uncertain');assert.equal(e.calls.filter(x=>x==='queue_fiscal').length,1);
});

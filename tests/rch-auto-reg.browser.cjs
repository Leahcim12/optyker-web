// Automatic return to REG before receipts and the one-time PC cassa update button.
// Every network call is intercepted: no login, no printer, no fiscal document.
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
const base='http://127.0.0.1:8766',out='/tmp/cash-sessions';fs.mkdirSync(out,{recursive:true});
const WINDOWS='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';
const IPAD='Mozilla/5.0 (iPad; CPU OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1';
const ready=mode=>({ok:true,mode,idleState:'0',busy:0,errorCode:0,printerError:0,paperEnd:0,coverOpen:0,lastCmd:1,error:''});
(async()=>{
 const browser=await chromium.launch({headless:true}),results=[];
 const scenarios=[
  {name:'pc-old-relay',ua:WINDOWS,local:true,revision:'',mode:'REG',button:'download'},
  {name:'pc-updated-relay',ua:WINDOWS,local:true,revision:'2.3-reg-auto',mode:'REG',button:'none'},
  {name:'ipad-old-relay',ua:IPAD,local:false,revision:'',mode:'REG',button:'hint'},
  {name:'ipad-z-idle-back-to-reg',ua:IPAD,local:false,revision:'2.3-reg-auto',mode:'Z',button:'none',ensure:true},
  {name:'pc-reg-no-command',ua:WINDOWS,local:true,revision:'2.3-reg-auto',mode:'REG',button:'none',ensure:true}
 ];
 for(const sc of scenarios){
  const context=await browser.newContext({userAgent:sc.ua,viewport:{width:1280,height:800}});const page=await context.newPage();page.setDefaultTimeout(9000);
  const calls=[],errors=[];let mode=sc.mode,commandState='queued';
  page.on('pageerror',e=>errors.push(String(e)));page.on('dialog',d=>d.accept());
  await page.route('**/*',async route=>{
   const req=route.request(),u=new URL(req.url());
   if(u.origin===base&&u.pathname==='/auto-reg-fixture')return route.fulfill({contentType:'text/html; charset=utf-8',body:'<!doctype html><html><head><meta charset="utf-8"></head><body><div class="optykerCashHeaderRight"><span id="optykerCashRch">RCH</span><button id="optykerRchRegBtn">Porta RCH in REG</button></div><script>window.OPTYKER_CLOUD={username:"FIXTURE",password:"NOT_A_REAL_PASSWORD"};window.innerChecks=[];window.OPTYKER_FISCAL=Object.freeze({checkReady:function(){window.innerChecks.push(Date.now());return Promise.resolve(true)},issuePayment:function(){throw new Error("never")},__cloudRelay:true});</script><script src="/rch-auto-reg.js"></script></body></html>'});
   if(u.origin===base)return route.continue();
   if(u.hostname==='127.0.0.1'&&u.port==='8765'){
    calls.push('local '+u.pathname);if(!sc.local)return route.abort('connectionrefused');
    if(u.pathname==='/status')return route.fulfill({json:ready(mode)});
    return route.fulfill({json:{ok:true}});
   }
   assert.equal(req.method(),'POST','Unexpected external request '+u.href);
   assert.ok(u.pathname.endsWith('/optyker-rch-relay-api'),'Only the relay may be called: '+u.pathname);
   const b=req.postDataJSON(),a=b.action;calls.push(a+(a==='queue_aux'?':'+b.payload.kind:''));
   assert.equal(b.username,'FIXTURE');
   assert.ok(['status','queue_aux','command_status'].includes(a),'Forbidden relay action '+a);
   if(a==='status')return route.fulfill({json:{ok:true,data:{online:true,connector_version:'2.2-daily-closure',status:{...ready(mode),workerRevision:sc.revision,autoReg:!!sc.revision}}}});
   if(a==='queue_aux'){assert.equal(b.payload.kind,'restore_reg');assert.equal(mode,'Z');commandState='completed';mode='REG';return route.fulfill({json:{ok:true,data:{id:'00000000-0000-4000-8000-000000000777',state:'queued',kind:'restore_reg'}}})}
   if(a==='command_status')return route.fulfill({json:{ok:true,data:{id:'00000000-0000-4000-8000-000000000777',kind:'restore_reg',state:commandState,result:{ok:true,state:'completed',mode:'REG'}}}});
  });
  try{
   await page.goto(base+'/auto-reg-fixture');
   await page.waitForFunction(()=>window.OPTYKER_RCH_AUTO_REG&&window.OPTYKER_FISCAL.__autoReg===true);
   if(sc.button==='none'){await page.waitForTimeout(2600);assert.equal(await page.locator('#optykerRchRelayUpdate').count(),0,'No update button')}
   else{
    const a=page.locator('#optykerRchRelayUpdate');await a.waitFor({timeout:6000});assert.equal(await a.innerText(),'Aggiorna connettore RCH');
    const href=await a.getAttribute('href'),dl=await a.getAttribute('download');
    if(sc.button==='download'){assert.match(href,/^\/rch-connector\/Aggiorna-Relay-REG\.bat\?v=/);assert.equal(dl,'Aggiorna-Relay-REG.bat')}
    else{assert.equal(href,'#');assert.equal(dl,null,'No .bat download on an iPad')}
    const order=await page.evaluate(()=>{const b=document.getElementById('optykerRchRegBtn');return b.nextElementSibling&&b.nextElementSibling.id});assert.equal(order,'optykerRchRelayUpdate','Placed next to Porta RCH in REG');
   }
   if(sc.ensure){
    await page.evaluate(()=>window.OPTYKER_FISCAL.checkReady());
    assert.equal(await page.evaluate(()=>window.innerChecks.length),1,'Original readiness check still runs');
    const restore=calls.filter(c=>c==='queue_aux:restore_reg').length;
    if(sc.mode==='Z'){assert.equal(restore,1,'Exactly one return to REG');assert.equal(mode,'REG')}
    else assert.equal(restore,0,'No command when the RCH is already in REG');
   }
   assert.ok(!calls.some(c=>/fiscal|closure|drawer|gift/.test(c)),'No fiscal or closure command: '+calls.join(','));
   assert.equal(errors.length,0,errors.join('\n'));
   await page.screenshot({path:out+'/auto-reg-'+sc.name+'.png'});results.push({scenario:sc.name,passed:true,calls});console.log('RCH_AUTO_REG_PASS',sc.name,calls.join(','));
  }catch(e){await page.screenshot({path:out+'/auto-reg-'+sc.name+'-error.png'}).catch(()=>{});fs.writeFileSync(out+'/auto-reg-'+sc.name+'-error.json',JSON.stringify({error:String(e),calls,errors},null,2));throw e}
  await context.close();
 }
 fs.writeFileSync(out+'/auto-reg-results.json',JSON.stringify(results,null,2));await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});

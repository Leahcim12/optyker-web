/* All API and hardware calls are mocked. No production login, prints, payments or closures. */
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const OUT='/tmp/rch-reg-check';fs.mkdirSync(OUT,{recursive:true});
const base='http://127.0.0.1:8766/';
const watchdog=setTimeout(()=>{console.error('RCH UI watchdog: browser stopped responding');process.exit(1)},100000);
(async()=>{
 const browser=await chromium.launch({headless:true});const results=[];
 for(const size of [{name:'desktop-local',width:1440,height:1000,local:true},{name:'mobile-relay',width:390,height:844,local:false}]){
  let st={ok:false,mode:'',idleState:'',errorCode:0,printerError:0,paperEnd:0,coverOpen:0,busy:1,lastCmd:0},online=true,queues=0,malformed=false;
  const zero={ok:true,mode:'Z',idleState:'0',errorCode:0,printerError:0,paperEnd:0,coverOpen:0,busy:0,lastCmd:0};
  const context=await browser.newContext({viewport:{width:size.width,height:size.height},serviceWorkers:'block'});
  const page=await context.newPage();page.setDefaultTimeout(7000);const calls=[],errors=[];
  page.on('pageerror',e=>errors.push(String(e).slice(0,200)));
  await context.route('**/*',async r=>{
   const q=r.request(),u=new URL(q.url());
   if(u.origin==='http://127.0.0.1:8766'&&['GET','HEAD'].includes(q.method()))return r.continue();
   if(u.origin==='http://127.0.0.1:8765'){
    calls.push({endpoint:'hardware-mock',action:u.pathname});
    assert.ok(q.method()==='GET','No direct hardware write is allowed');
    if(!size.local)return r.abort();
    return r.fulfill({json:u.pathname==='/health'?{ok:true,version:'1.8-auto-receipt'}:st});
   }
   if(q.method()==='POST'){
    let b={};try{b=q.postDataJSON()||{}}catch(_){}
    const a=b.action||'';calls.push({endpoint:u.pathname,action:a,kind:b.payload?.kind});
    if(u.pathname.endsWith('/optyker-rch-relay-api')){
     if(a==='status')return r.fulfill({json:{ok:true,data:{online,connector_version:'2.2-daily-closure',status:st,last_seen_at:new Date().toISOString()}}});
     if(a==='queue_aux'){
      assert.equal(b.payload.kind,'restore_reg');assert.deepEqual(st,zero,'No command may be queued without safe Z');queues++;
      return r.fulfill({json:{ok:true,data:{id:'00000000-0000-4000-8000-000000000123',state:'queued'}}});
     }
     if(a==='command_status'){
      if(!malformed)st={...zero,mode:'REG (OP 1)'};
      return r.fulfill({json:{ok:true,data:{state:'completed',result:malformed?{}:{ok:true,mode:'REG (OP 1)',dailyClosureExecuted:false,emittedFiscalDocument:false}}}});
     }
     throw Error('Unexpected relay write '+a);
    }
    if(u.pathname.endsWith('/optyker-staff-auth'))return r.fulfill({json:{ok:true,username:b.username||'Michael',has_email:true,needs_password:false}});
    if(a==='quote_lines')return r.fulfill({json:{ok:true,data:{ovc_version:'20260910-ovc2',lines:[],card:null}}});
    assert.ok(!['checkout','settle','prepare','queue_fiscal','daily_closure','drawer','gift_receipt','void','issue'].includes(a),'Unexpected fiscal operation '+a);
    return r.fulfill({json:{ok:true,data:[],clients:[],sheets:[],consents:[]}});
   }
   return r.abort();
  });
  try{
   await page.goto(base,{waitUntil:'domcontentloaded',timeout:20000});
   await page.waitForTimeout(600);
   const opts=await page.locator('#optykerLoginOperator option').evaluateAll(a=>a.map(x=>x.value).filter(Boolean));
   await page.locator('#optykerLoginOperator').selectOption(opts.find(x=>/michael/i.test(x))||opts[0]);
   await page.locator('#optykerAuthPassword').fill('LOCAL_FIXTURE_ONLY');await page.locator('.optykerLoginButton').click();
   await page.waitForFunction(()=>window.optykerAuthenticated===true);await page.waitForTimeout(1800);
   assert.equal(await page.evaluate(()=>window.OPTYKER_RCH_REG_UI_VERSION),'20260919-regui1');
   await page.locator('[data-vision-action="cash"]').click();await page.locator('#optykerCashOverlay').waitFor({state:'visible'});
   await page.waitForTimeout(500);await page.locator('#optykerCashRch').click();
   const modal=page.locator('#optykerRchCloudModal');await modal.waitFor({state:'visible'});
   await page.waitForFunction(()=>document.querySelector('#optykerRchCloudModal .orcBody')?.textContent.includes('busy 1'));
   assert.equal(await page.locator('#orcRestoreReg').isDisabled(),true);assert.equal(queues,0);
   // Physical busy status cannot be overwritten by a green badge or fabricated REG.
   assert.equal(await page.locator('#optykerCashRch').evaluate(b=>b.classList.contains('ok')),false);
   await page.screenshot({path:OUT+'/'+size.name+'-busy.png'});
   st={...zero};await page.locator('#orcRefreshStatus').click();
   await page.waitForFunction(()=>document.getElementById('orcRestoreReg')?.disabled===false);
   await page.locator('#orcRestoreReg').click();
   await page.waitForFunction(()=>document.querySelector('#optykerRchCloudModal .orcBody')?.textContent.includes('ha confermato il ritorno in REG'));
   assert.equal(queues,1);assert.ok((await page.locator('#optykerCashRch').innerText()).includes('REG'));
   await page.screenshot({path:OUT+'/'+size.name+'-reg.png'});
   await page.locator('#orcRefreshStatus').click();await page.locator('#orcRestoreReg').click();
   await page.waitForFunction(()=>document.querySelector('#optykerRchCloudModal .orcBody')?.textContent.includes('già pronta in REG'));
   assert.equal(queues,1,'Already-REG must not enqueue another command');
   // Missing flags must not count as zero; offline must never report READY.
   st={...zero,mode:'REG',busy:null};await page.locator('#orcRefreshStatus').click();
   await page.waitForTimeout(150);assert.equal(await page.locator('#orcRestoreReg').isDisabled(),true);
   online=false;await page.locator('#orcRefreshStatus').click();await page.waitForTimeout(150);
   assert.equal(await page.locator('#orcRestoreReg').isDisabled(),true);
   if(size.local){
    online=true;st={...zero};malformed=true;await page.locator('#orcRefreshStatus').click();
    await page.waitForTimeout(150);await page.locator('#orcRestoreReg').click();
    await page.waitForFunction(()=>document.querySelector('#optykerRchCloudModal .orcMsg')?.textContent.includes('conferma REG valida'));
    assert.equal(queues,2);assert.ok(!(await modal.innerText()).includes('ha confermato il ritorno'));
    await modal.locator('.optykerCashModalClose').click();await page.locator('#optykerRchRegBtn').click();
    await page.waitForFunction(()=>document.querySelector('#optykerRchCloudModal .orcMsg')?.textContent.includes('conferma REG valida'));
    assert.equal(queues,2,'Unconfirmed command must not be requeued');
   }
   const result={name:size.name,statusDialog:true,busyBlocked:true,regConfirmed:true,noRepeat:true,missingFlagsBlocked:true,offlineBlocked:true,hardwareWrites:0,fiscalWrites:0,errors};
   results.push(result);console.log('RCH_REG_UI_PASS',JSON.stringify(result));
  }catch(e){await page.screenshot({path:OUT+'/'+size.name+'-failure.png',timeout:3000}).catch(()=>{});throw e}
  finally{fs.writeFileSync(OUT+'/'+size.name+'-calls.json',JSON.stringify(calls,null,2));await context.close()}
 }
 fs.writeFileSync(OUT+'/results.json',JSON.stringify(results,null,2));await browser.close();clearTimeout(watchdog);
})().catch(e=>{console.error(e);process.exit(1)});

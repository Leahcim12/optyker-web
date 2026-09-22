// Native cashier UI; all remote calls intercepted. No live login, payments or RCH commands.
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
const base='http://127.0.0.1:8766',out='/tmp/cash-sessions';fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true}),results=[];
 for(const scenario of ['staff-desktop','staff-mobile','admin','network-recovery','pending','uncertain','failed','ledger-only','previous-day','cancel-confirmation']){
  const admin=scenario==='admin',page=await browser.newPage({viewport:scenario==='staff-mobile'?{width:390,height:844}:{width:1366,height:1000}});page.setDefaultTimeout(9000);
  const errors=[],calls=[],writes=[],dialogs=[],stored=new Map();let closed=true,count=1,pending=null,drop=scenario==='network-recovery';
  page.on('dialog',d=>{dialogs.push(d.message());return scenario==='cancel-confirmation'?d.dismiss():d.accept()});
  function metrics(){return {opened:true,closed,total_collected:120,cash_total:60,card_total:60,receipts_total:120,receipts_count:3,opening:{opening_cash:70,opening_checks:0},closure:{next_opening_cash:70,next_opening_checks:0},cash_session_capabilities:{fiscal_closure:true,version:'20260922-unified-rch1'},session:{closures_count:count,number:count+1,token:'fixture-'+count+'-'+closed,opening:{opening_cash:70,opening_checks:0},totals:{total_collected:0,cash_total:0,card_total:0},daily_totals:{total_collected:120},cash_expected:70,pending}}}
  function finish(r){if(!r.finished){if(r.a==='session_close'){closed=true;count++}else closed=false;r.finished=true}pending=null;return {state:'completed',operation_id:r.p.request_id,data:metrics(),fiscal_requested:r.p.fiscal===true,fiscal_confirmed:r.p.fiscal===true,closure:{fiscal_closure:r.p.fiscal===true}}}
  page.on('pageerror',e=>errors.push(String(e)));
  await page.route('**/*',async route=>{
   const req=route.request(),u=new URL(req.url());
   if(u.origin===base&&u.pathname==='/session-fixture')return route.fulfill({contentType:'text/html; charset=utf-8',body:'<!doctype html><html><head><meta charset="utf-8"></head><body><div id="optykerCashOverlay"><div class="optykerCashHeaderRight"></div></div>'+(admin?'<div id="optykerAdminCashPanel"><div class="optykerAdminCashTop"></div><table><tbody id="optykerAdminCashDays"></tbody></table></div>':'')+'<script>window.OPTYKER_CLOUD={username:"FIXTURE",password:"NOT_A_REAL_PASSWORD"};'+(admin?'sessionStorage.setItem("optyker_billing_admin_token","FIXTURE");':'')+'</script><script src="/cash-sessions.js"></script><script src="/cash-day-control.js"></script>'+(admin?'<script src="/admin-cash-today-controls.js"></script>':'')+'</body></html>'});
   if(u.origin===base)return route.continue();
   if(req.method()!=='POST')throw new Error('Unexpected external request '+u.host);
   if(!admin){assert.ok(u.pathname.endsWith('/optyker-cash-day-api'),'Cashier must not visit administration');assert.equal(req.headers().authorization,undefined)}
   const b=req.postDataJSON(),a=b.action,p=b.payload||b;calls.push(a);
   assert.ok(!['checkout','settle','queue_fiscal','queue_aux','daily_closure','bridge_claim'].includes(a));
   const reply=data=>route.fulfill({json:{ok:true,data}});
   if(a==='status'||a==='day'||a==='session_status')return reply(metrics());
   if(a==='session_history')return reply({history:[]});
   if(a==='session_result'){
    const r=stored.get(p.request_id);assert.ok(r);r.polls++;
    if(scenario==='uncertain')return reply({state:'attention',operation_id:p.request_id,error:'Esito RCH non confermato: non ripetere.'});
    if(scenario==='failed'){pending=null;return reply({state:'failed',operation_id:p.request_id,error:'RCH offline: chiusura non eseguita.'})}
    if(scenario==='pending'&&r.polls<3)return reply({state:'pending',operation_id:p.request_id});
    return reply(finish(r));
   }
   if(a==='session_close'||a==='session_open'){
    assert.ok(p.request_id);assert.ok(p.expected_token);assert.ok(!stored.has(p.request_id),'Duplicate network write');writes.push({a,p});
    if(a==='session_close'){assert.equal(p.cash_counted,70);assert.equal(p.safe_deposit_cash,0)}else assert.equal(p.opening_cash,70);
    const r={a,p,polls:0,finished:false};stored.set(p.request_id,r);await new Promise(resolve=>setTimeout(resolve,100));
    if(a==='session_open'||!p.fiscal)return reply(finish(r));
    pending={id:p.request_id,state:'pending',fiscal:true};if(drop){drop=false;return route.abort()}
    return reply({state:'pending',operation_id:p.request_id});
   }
   throw new Error('Unexpected action '+a);
  });
  try{
   await page.goto(base+'/session-fixture');
   const close=page.locator(admin?'#optykerAdminCashCloseToday':'#optykerCashDayCloseBtn');await close.waitFor();assert.equal(await close.isDisabled(),false);
   if(scenario==='previous-day')await page.evaluate(()=>window.OPTYKER_CASH_SESSIONS.open('close','2026-09-20',false));else await close.click();
   await page.locator('#csCount').waitFor();
   if(scenario==='previous-day')assert.equal(await page.locator('#csFiscal').count(),0);else assert.equal(await page.locator('#csFiscal').isChecked(),true,'RCH close is enabled by default');
   if(scenario==='ledger-only')await page.locator('#csFiscal').uncheck();
   await page.locator('#csNotes').fill('Fixture: unified closure');await page.evaluate(()=>{document.getElementById('csConfirm').click();document.getElementById('csConfirm')?.click()});
   if(scenario==='cancel-confirmation'){await page.waitForTimeout(250);assert.equal(writes.length,0)}else{
    if(scenario==='network-recovery'){await page.locator('#csCheck').waitFor();assert.ok(!(await page.locator('.csBody').innerText()).includes('RCH confermata'));await page.locator('#csCheck').click()}
    if(scenario==='pending'){await page.locator('#csResume').waitFor();assert.ok(!(await page.locator('.csBody').innerText()).includes('RCH confermata'))}
    if(scenario==='uncertain'||scenario==='failed'){
     await page.waitForFunction(()=>/Esito RCH non confermato|RCH offline/.test(document.querySelector('.csMessage')?.textContent));assert.ok(!(await page.locator('.csBody').innerText()).includes('RCH confermata'));assert.equal(count,1);assert.equal(writes.length,1);
    }else{
     await page.waitForFunction(()=>document.querySelector('.csMessage')?.textContent.includes('Operazione confermata'));assert.equal(writes.length,1);
     const fiscal=!['ledger-only','previous-day'].includes(scenario);assert.equal(writes[0].p.fiscal,fiscal);assert.ok(dialogs[0].includes(fiscal?'NUOVA chiusura fiscale Z':'NON verrà chiusa'),JSON.stringify(dialogs));
     assert.ok((await page.locator('.csBody').innerText()).includes(fiscal?'Chiusura RCH confermata':'Nessuna chiusura RCH richiesta'));
     if(['staff-desktop','staff-mobile','admin'].includes(scenario)){
      await page.locator('.csExit').click();await close.click();await page.locator('#csCount').waitFor();assert.equal(await page.locator('#csFiscal').isChecked(),true);await page.locator('#csConfirm').click();await page.waitForFunction(()=>document.querySelector('.csMessage')?.textContent.includes('Operazione confermata'));assert.equal(writes.length,2);assert.notEqual(writes[0].p.request_id,writes[1].p.request_id);
      await page.locator('.csExit').click();await page.locator(admin?'#optykerAdminCashOpenToday':'#optykerCashDayOpenBtn').click();await page.locator('#csOpening').waitFor();assert.equal(await page.locator('#csOpening').inputValue(),'70.00');await page.locator('#csConfirm').click();await page.waitForFunction(()=>document.querySelector('.csMessage')?.textContent.includes('Operazione confermata'));assert.equal(closed,false);assert.notEqual(writes[2].p.fiscal,true);
     }
    }
   }
   await page.screenshot({path:out+'/'+scenario+'.png'});assert.equal(errors.length,0,errors.join('\n'));results.push({scenario,passed:true,realPayments:0,realPrinterCommands:0});console.log('UNIFIED_CLOSURE_PASS',scenario);
  }catch(e){await page.screenshot({path:out+'/'+scenario+'-error.png'}).catch(()=>{});fs.writeFileSync(out+'/'+scenario+'-error.json',JSON.stringify({error:String(e),calls,writes,errors,dialogs},null,2));throw e}
  await page.close();
 }
 fs.writeFileSync(out+'/results.json',JSON.stringify(results,null,2));await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});

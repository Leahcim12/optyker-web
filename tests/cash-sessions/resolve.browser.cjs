// Verification of an unconfirmed RCH closure from the cashier. All remote calls are intercepted:
// no live login, no payment and no printer command. The resolution must never resend a closure.
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
const base='http://127.0.0.1:8766',out='/tmp/cash-sessions';fs.mkdirSync(out,{recursive:true});
const PENDING='00000000-0000-4000-8000-000000001015';
(async()=>{
 const browser=await chromium.launch({headless:true}),results=[];
 for(const scenario of ['printed-desktop','not-printed-mobile','cancel','open-allowed','no-capability','z-done','update-banner','updated-no-banner']){
  const mobile=scenario==='not-printed-mobile';
  const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1366,height:1000},timezoneId:'Europe/Rome',locale:'it-IT'});
  const page=await context.newPage();page.setDefaultTimeout(9000);
  const formOnly=['z-done','update-banner','updated-no-banner'].includes(scenario);let zClosedAt=scenario==='z-done'?'2026-10-12T18:29:30Z':null;
  const worker=scenario==='update-banner'?{online:true,updated:false,windows:true}:scenario==='not-printed-mobile'?{online:true,updated:false,windows:false}:scenario==='updated-no-banner'?{online:true,updated:true,windows:true}:null;
  const errors=[],calls=[],writes=[],dialogs=[];let pending={id:PENDING,business_date:'2026-10-07',state:'attention',kind:'close',fiscal:true,created_at:'2026-10-07T17:15:04Z',command_requested_at:'2026-10-07T17:15:04Z',operator_username:'GIORGIA',command_kind:'daily_closure',command_state:'completed',command_outcome:'uncertain',error:'Esito RCH non confermato: nessuna ripetizione automatica. Verifica il registratore.'};if(formOnly)pending=null;
  page.on('dialog',d=>{dialogs.push(d.message());return scenario==='cancel'?d.dismiss():d.accept()});
  page.on('pageerror',e=>errors.push(String(e)));
  const capabilities=scenario==='no-capability'?{fiscal_closure:true,version:'20260922-unified-rch1'}:{fiscal_closure:true,resolve_attention:true,version:'20261011-resolve1'};
  function metrics(){return {opened:true,closed:scenario==='open-allowed',total_collected:120,cash_total:60,card_total:60,receipts_total:120,receipts_count:3,opening:{opening_cash:70,opening_checks:0},closure:zClosedAt?{next_opening_cash:70,next_opening_checks:0,closed_at:zClosedAt,snapshot:{session:{fiscal_closure:true,closed_at:zClosedAt}}}:{next_opening_cash:70,next_opening_checks:0},cash_session_capabilities:capabilities,session:{closures_count:1,number:2,token:'fixture-token',opening:{opening_cash:70,opening_checks:0},totals:{total_collected:0,cash_total:0,card_total:0},daily_totals:{total_collected:120},cash_expected:70,pending}}}
  await page.route('**/*',async route=>{
   const req=route.request(),u=new URL(req.url());
   if(u.origin===base&&u.pathname==='/session-fixture')return route.fulfill({contentType:'text/html; charset=utf-8',body:'<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="optykerCashOverlay"><div class="optykerCashHeaderRight"></div></div><script>window.OPTYKER_CLOUD={username:"FIXTURE",password:"NOT_A_REAL_PASSWORD"};'+(worker?'window.OPTYKER_RCH_AUTO_REG={workerInfo:function(){return Promise.resolve('+JSON.stringify({...worker,revision:worker.updated?'2.3-reg-auto':'',url:'/rch-connector/Aggiorna-Relay-REG.bat?v=20261013-update1'})+')}};':'')+'</script><script src="/cash-sessions.js"></script><script src="/cash-day-control.js"></script></body></html>'});
   if(u.origin===base)return route.continue();
   if(req.method()!=='POST')throw new Error('Unexpected external request '+u.host);
   assert.ok(u.pathname.endsWith('/optyker-cash-day-api'),'Cashier must not visit administration');
   const b=req.postDataJSON(),a=b.action,p=b.payload||b;calls.push(a);
   assert.ok(!['checkout','settle','queue_fiscal','queue_aux','daily_closure','bridge_claim'].includes(a),'Forbidden action '+a);
   if(a==='session_close'){assert.equal(scenario,'z-done','Only the explicit ledger-only scenario may save a closure');assert.equal(p.fiscal,false,'No second Z by default');writes.push({a,p});return route.fulfill({json:{ok:true,data:{state:'completed',operation_id:p.request_id,fiscal_requested:false,fiscal_confirmed:false,data:metrics()}}})}
   const reply=data=>route.fulfill({json:{ok:true,data}});
   if(a==='status'||a==='day'||a==='session_status')return reply(metrics());
   if(a==='session_history')return reply({history:[]});
   if(a==='session_resolve'){
    writes.push({a,p});assert.equal(p.request_id,PENDING);assert.equal(typeof p.printed,'boolean');
    if(p.printed){pending=null;zClosedAt='2026-10-12T18:31:59Z';return reply({state:'completed',operation_id:PENDING,fiscal_requested:true,fiscal_confirmed:true,closure:{fiscal_closure:true,fiscal_confirmation:'manual'},data:metrics()})}
    pending=null;return reply({state:'failed',operation_id:PENDING,error:'Verifica di FIXTURE: chiusura Z non stampata. Nessuna chiusura gestionale registrata: puoi ripetere la chiusura.'});
   }
   if(a==='session_result'){assert.equal(p.request_id,PENDING);return reply({state:'attention',operation_id:PENDING,error:pending&&pending.error})}
   if(a==='session_open'){writes.push({a,p});assert.ok(p.request_id);assert.equal(p.opening_cash,70);return reply({state:'completed',operation_id:p.request_id,data:metrics()})}
   throw new Error('Unexpected action '+a);
  });
  try{
   await page.goto(base+'/session-fixture');
   if(scenario==='open-allowed'){
    const open=page.locator('#optykerCashDayOpenBtn');await open.waitFor();await open.click();
    await page.locator('#csOpening').waitFor();
    const notice=await page.locator('.csNotice').innerText();assert.match(notice,/07\/10\/2026/);assert.match(notice,/da verificare/);
    await page.locator('#csConfirm').click();await page.waitForFunction(()=>document.querySelector('.csMessage')?.textContent.includes('Operazione confermata'));
    assert.deepEqual(writes.map(w=>w.a),['session_open']);assert.notEqual(writes[0].p.fiscal,true);
   }else if(formOnly){
    const close=page.locator('#optykerCashDayCloseBtn');await close.waitFor();await close.click();await page.locator('#csCount').waitFor();
    if(scenario==='z-done'){
     assert.equal(await page.locator('#csFiscal').isChecked(),false,'After a Z today the RCH box starts unticked');
     assert.match(await page.locator('#csFiscalHelp').innerText(),/già stata chiusa oggi alle 20:29/);
     assert.equal(await page.locator('#csConfirm').innerText(),'Salva solo riepilogo gestionale');
     await page.locator('#csConfirm').click();await page.waitForFunction(()=>document.querySelector('.csMessage')?.textContent.includes('Operazione confermata'));
     assert.match(dialogs[0],/NON verrà chiusa/);assert.deepEqual(writes.map(w=>[w.a,w.p.fiscal]),[['session_close',false]]);
    }else{
     assert.equal(await page.locator('#csFiscal').isChecked(),true,'First closure of the day keeps the RCH box ticked');
     if(scenario==='update-banner'){
      await page.locator('.csUpdate').waitFor();const link=page.locator('.csUpdate a.csUpdateLink');
      assert.match(await link.getAttribute('href'),/\/rch-connector\/Aggiorna-Relay-REG\.bat/);assert.equal(await link.getAttribute('download'),'Aggiorna-Relay-REG.bat');
      assert.match(await page.locator('.csUpdate').innerText(),/una volta sola/);
     }else{await page.waitForTimeout(400);assert.equal(await page.locator('.csUpdate').count(),0,'No update prompt once the PC cassa is updated')}
    }
   }else{
    const close=page.locator('#optykerCashDayCloseBtn');await close.waitFor();await close.click();
    await page.waitForFunction(()=>/da verificare/.test(document.querySelector('.csBody')?.textContent||''));
    const body=await page.locator('.csBody').innerText();
    assert.match(body,/07\/10\/2026/);assert.match(body,/19:15/);assert.match(body,/GIORGIA/);assert.match(body,/chiusura giornaliera/);
    assert.ok(!body.includes('RCH confermata'));assert.equal(await page.locator('#csCount').count(),0,'No new closure form while the previous one is unverified');
    if(scenario==='no-capability'){
     assert.equal(await page.locator('#csPrinted').count(),0);await page.locator('#csResume').click();
     await page.waitForFunction(()=>/Esito RCH non confermato/.test(document.querySelector('.csMessage')?.textContent||''));
     assert.equal(writes.length,0);
    }else{
     for(const id of ['#csPrinted','#csNotPrinted']){const box=await page.locator(id).boundingBox();assert.ok(box&&box.x>=0&&box.x+box.width<=(mobile?390:1366)+1,id+' visible inside the screen')}
     if(mobile)assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),'No horizontal scroll on phone');
     await page.locator(scenario==='not-printed-mobile'?'#csNotPrinted':'#csPrinted').click();
     if(scenario==='cancel'){
      await page.waitForTimeout(300);assert.equal(writes.length,0,'Cancelled verification writes nothing');assert.equal(dialogs.length,1);
      assert.equal(await page.locator('#csPrinted').count(),1);
     }else if(scenario==='printed-desktop'){
      assert.match(dialogs[0],/stampata la chiusura giornaliera Z/);assert.match(dialogs[0],/senza inviare comandi/);
      await page.waitForFunction(()=>document.querySelector('.csMessage')?.textContent.includes('Verifica registrata'));
      assert.match(await page.locator('.csBody').innerText(),/Chiusura verificata e salvata/);
      assert.deepEqual(writes.map(w=>[w.a,w.p.printed]),[['session_resolve',true]]);
      assert.equal(await page.locator('#csReload').count(),0,'No path back into a new closure form');assert.match(await page.locator('.csBody').innerText(),/non serve un’altra chiusura fiscale/);
      await page.locator('#csDone').click();assert.equal(await page.locator('#optykerCashSessionsModal').count(),0,'Fatto closes the window');
      await page.locator('#optykerCashDayCloseBtn').click();await page.locator('#csCount').waitFor();
      assert.equal(await page.locator('#csFiscal').isChecked(),false,'A second Z is not proposed after the verified closure');assert.match(await page.locator('#csFiscalHelp').innerText(),/già stata chiusa oggi alle 20:31/);
     }else{
      assert.match(dialogs[0],/NON è stata stampata/);
      await page.waitForFunction(()=>/non stampata/.test(document.querySelector('.csMessage')?.textContent||''));
      assert.match(await page.locator('.csBody').innerText(),/Tentativo annullato/);
      assert.match(await page.locator('.csUpdate').innerText(),/Da fare sul PC della cassa/);assert.equal(await page.locator('.csUpdate a').count(),0,'No .bat download on a phone');
      assert.deepEqual(writes.map(w=>[w.a,w.p.printed]),[['session_resolve',false]]);
      await page.locator('#csReload').click();await page.locator('#csCount').waitFor();
     }
    }
   }
   assert.equal(writes.filter(w=>w.a==='session_resolve').length,['printed-desktop','not-printed-mobile'].includes(scenario)?1:0,'Exactly one verification, never repeated');
   await page.screenshot({path:out+'/resolve-'+scenario+'.png'});assert.equal(errors.length,0,errors.join('\n'));
   results.push({scenario,passed:true,realPayments:0,realPrinterCommands:0});console.log('ATTENTION_RESOLUTION_PASS',scenario);
  }catch(e){await page.screenshot({path:out+'/resolve-'+scenario+'-error.png'}).catch(()=>{});fs.writeFileSync(out+'/resolve-'+scenario+'-error.json',JSON.stringify({error:String(e),calls,writes,errors,dialogs},null,2));throw e}
  await context.close();
 }
 fs.writeFileSync(out+'/resolve-results.json',JSON.stringify(results,null,2));await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});

// Verify both real button IDs, including legacy inline handlers. No live authentication or printer.
const {chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true});
 for(const id of ['optykerCashDayCloseBtn','optykerCashClosureBtn','optykerCashDayOpenBtn']){
  const page=await browser.newPage();page.setDefaultTimeout(8000);page.on('dialog',d=>d.accept());
  const writes=[];const isOpen=id==='optykerCashDayOpenBtn';let requested=false;
  await page.route('**/*',async route=>{
   const req=route.request(),u=new URL(req.url());
   if(u.origin==='http://127.0.0.1:8766'&&u.pathname==='/buttons')return route.fulfill({contentType:'text/html',body:'<!doctype html><html><head></head><body><button id="'+id+'"><span>Chiusura cassa</span></button><script>window.legacyCalls=0;document.getElementById("'+id+'").onclick=function(){legacyCalls++};window.OPTYKER_CLOUD={username:"FIXTURE",password:"FAKE_PASSWORD_ONLY"}</script><script src="/cash-sessions.js"></script></body></html>'});
   if(u.origin==='http://127.0.0.1:8766')return route.continue();
   assert.equal(u.pathname,'/functions/v1/optyker-cash-day-api');assert.equal(req.method(),'POST');assert.equal(req.headers().authorization,undefined);
   const b=req.postDataJSON(),p=b.payload;const reply=data=>route.fulfill({json:{ok:true,data}});
   if(b.action==='session_status')return reply({opened:true,closed:true,cash_session_capabilities:{fiscal_closure:true},session:{closures_count:1,number:2,token:'fixture',opening:{opening_cash:70,opening_checks:0},cash_expected:70,totals:{},daily_totals:{},pending:null}});
   if(b.action==='session_close'||b.action==='session_open'){
    writes.push({a:b.action,p});requested=true;assert.equal(p.fiscal===true,!isOpen);
    return reply(isOpen?{state:'completed',operation_id:p.request_id,fiscal_requested:false,fiscal_confirmed:false}:{state:'pending',operation_id:p.request_id});
   }
   if(b.action==='session_result'){assert.ok(requested);return reply({state:'completed',operation_id:p.request_id,fiscal_requested:true,fiscal_confirmed:true})}
   throw new Error('Unexpected operation '+b.action);
  });
  await page.goto('http://127.0.0.1:8766/buttons');
  await page.locator('#'+id+' span').click();await page.locator(isOpen?'#csOpening':'#csCount').waitFor();assert.equal(await page.evaluate(()=>window.legacyCalls),0);assert.equal(writes.length,0);
  if(!isOpen)assert.equal(await page.locator('#csFiscal').isChecked(),true);
  await page.locator('#csConfirm').click();await page.waitForFunction(()=>document.querySelector('.csMessage')?.textContent.includes('Operazione confermata'));assert.equal(writes.length,1);assert.equal(await page.evaluate(()=>window.legacyCalls),0);
  console.log('CASH_BUTTON_PASS',id,'legacyCalls=0 adminRequests=0 realPrinterCommands=0');await page.close();
 }
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});

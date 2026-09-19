/* Exact built-page regression. Every external request is intercepted; fixtures
   never authenticate to production, read real customers, pay or reach hardware.
   Native MutationObserver is deliberately NOT replaced or disabled. */
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const OUT=process.env.CASH_TEST_OUTPUT||'/tmp/cash-opening';
const base=process.env.CASH_TEST_URL||'http://127.0.0.1:8766/';
const origin=new URL(base).origin;
fs.mkdirSync(OUT,{recursive:true});
const watchdog=setTimeout(()=>{console.error('FAIL: cashier stopped responding');process.exit(1)},115000);
const customer={id:'00000000-0000-4000-8000-000000000099',name:'Cliente',surname:'Dimostrativo',email:'cash-test@example.invalid',reference_no:'99999C'};
const forbidden=new Set(['checkout','settle','mark_delivery','order_missing_items','cancel_order_sheet','open_drawer','drawer','daily_closure','restore_reg','open','close','void','issue','issue_payment']);
(async()=>{
 const browser=await chromium.launch({headless:true});
 const results=[];
 for(const size of [{name:'desktop',width:1440,height:1000},{name:'tablet',width:1024,height:768},{name:'mobile',width:390,height:844}]){
  const context=await browser.newContext({viewport:{width:size.width,height:size.height},serviceWorkers:'block'});
  const page=await context.newPage();page.setDefaultTimeout(8000);
  const errors=[],calls=[];let stage='load';
  const save=extra=>fs.writeFileSync(OUT+'/'+size.name+'-report.json',JSON.stringify({name:size.name,stage,errors,calls,...extra},null,2));
  page.on('pageerror',e=>errors.push(String(e).slice(0,300)));
  await context.route('**/*',async route=>{
   const req=route.request(),url=new URL(req.url());
   if(url.origin===origin && ['GET','HEAD'].includes(req.method()))return route.continue();
   if(req.method()==='POST'){
    let body={};try{body=req.postDataJSON()||{}}catch(_){}
    calls.push({endpoint:url.pathname,action:body.action||''});
    if(url.pathname.endsWith('/optyker-staff-auth'))return route.fulfill({json:{ok:true,username:body.username||'Michael',has_email:true,needs_password:false}});
    if(body.action==='quote_lines')return route.fulfill({json:{ok:true,data:{ovc_version:'20260910-ovc2',lines:[],card:null}}});
    if(body.action==='client_cart_get'||body.action==='client_cart_save')return route.fulfill({json:{ok:true,data:{client_id:customer.id,items:body.payload?.items||[],updated_at:'2026-09-19T00:00:00Z'}}});
    if(body.action==='clients')return route.fulfill({json:{ok:true,data:[customer]}});
    if(body.action==='status')return route.fulfill({json:{ok:true,data:{opened:false,closed:false,suggested_opening_cash:0}}});
    return route.fulfill({json:{ok:true,data:[],clients:[],sheets:[],consents:[]}});
   }
   return route.abort();
  });
  await page.addInitScript(()=>{
   window.__cashOpeningTest={ticks:0,helpMutations:0};
   setInterval(()=>window.__cashOpeningTest.ticks++,100);
   new MutationObserver(ms=>{
    for(const m of ms)if(m.target.nodeType===1 && (m.target.matches('.optykerCashRchHelp')||m.target.closest('.optykerCashRchHelp')))window.__cashOpeningTest.helpMutations++;
   }).observe(document,{childList:true,subtree:true});
  });
  try{
   await page.goto(base,{waitUntil:'domcontentloaded',timeout:20000});
   assert.ok((await page.content()).includes('cash-receipt-separation.js?v=20260919-cash-open1'),'wrong cash asset version');
   await page.waitForTimeout(1000);
   const options=await page.locator('#optykerLoginOperator option').evaluateAll(a=>a.map(x=>x.value).filter(Boolean));
   await page.locator('#optykerLoginOperator').selectOption(options.find(x=>/michael/i.test(x))||options[0]);
   await page.locator('#optykerAuthPassword').fill('LOCAL_FIXTURE_ONLY');
   await page.locator('.optykerLoginButton').click();
   await page.waitForFunction(()=>window.optykerAuthenticated===true);
   await page.waitForTimeout(1800);
   stage='dashboard-open';save({});
   const before=await page.evaluate(()=>window.__cashOpeningTest.ticks);
   await page.locator('[data-vision-action="cash"]').click();
   await page.locator('#optykerCashOverlay').waitFor({state:'visible'});
   await page.waitForTimeout(500);
   await page.locator('#optykerCashNote').fill('PROVA LOCALE APERTURA CASSA');
   await page.waitForTimeout(1200);
   assert.equal(await page.locator('#optykerCashNote').inputValue(),'PROVA LOCALE APERTURA CASSA');
   assert.equal(await page.evaluate(()=>document.activeElement.id),'optykerCashNote','typing focus was lost');
   assert.ok(await page.evaluate(()=>window.__cashOpeningTest.ticks)>before+10,'event-loop timers starved');
   stage='product-picker';save({});
   await page.locator('#optykerCashFindProducts').click();
   await page.locator('#optykerCashProductPicker').waitFor({state:'visible'});
   await page.locator('#optykerCashSearch').fill('PRODOTTO DIMOSTRATIVO');
   await page.waitForTimeout(700);
   assert.equal(await page.locator('#optykerCashSearch').inputValue(),'PRODOTTO DIMOSTRATIVO');
   assert.ok(calls.some(x=>x.action==='products'),'product search did not call mocked catalog');
   await page.locator('#optykerCashPickerDone').click();
   await page.locator('#optykerCashProductPicker').waitFor({state:'hidden'});
   await page.locator('#optykerCashNote').fill('');
   await page.screenshot({path:OUT+'/'+size.name+'.png'});
   stage='close-and-reopen';save({});
   await page.locator('#optykerCashClose').click();
   await page.locator('#optykerCashOverlay').waitFor({state:'hidden'});
   await page.waitForTimeout(450);
   assert.equal(await page.locator('#optykerCashOverlay').isVisible(),false,'cashier reopened by an observer after closing');
   if(size.name==='desktop')await page.locator('[data-optyker-cash-managed="1"]').first().click();
   else await page.locator('[data-vision-action="cash"]').click();
   await page.locator('#optykerCashOverlay').waitFor({state:'visible'});
   await page.locator('#optykerCashNote').fill('RIAPERTURA');
   assert.equal(await page.locator('#optykerCashNote').inputValue(),'RIAPERTURA');
   await page.locator('#optykerCashNote').fill('');
   await page.locator('#optykerCashClose').click();
   await page.locator('#optykerCashOverlay').waitFor({state:'hidden'});
   if(size.name==='desktop'){
    stage='customer-cash';save({});
    await page.evaluate(c=>{
     window.OPTYKER_CLOUD.clients=[c];
     window.showModule('clients');window.clientFillForm(c);window.clientShowView('edit');
    },customer);
    await page.locator('#optykerClientCashBtn').click();
    await page.locator('#optykerCashOverlay').waitFor({state:'visible'});
    await page.waitForTimeout(750);
    assert.equal(await page.locator('#optykerCashClient').inputValue(),customer.id,'selected client was not retained');
    await page.locator('#optykerCashClose').click();
    await page.locator('#optykerCashOverlay').waitFor({state:'hidden'});
   }
   const stats=await page.evaluate(()=>window.__cashOpeningTest);
   assert.ok(stats.helpMutations<12,'receipt-help observer keeps rewriting its own HTML');
   assert.ok(!calls.some(c=>forbidden.has(c.action)),'test unexpectedly requested a fiscal/payment operation');
   assert.ok(!errors.some(x=>/RangeError|Maximum call stack|is not a function/.test(x)),'cashier raised a JavaScript failure');
   stage='passed';save({stats});
   results.push({name:size.name,opened:true,typing:true,search:true,closed:true,reopened:true,customerCash:size.name==='desktop',nativeObservers:true,helpMutations:stats.helpMutations,paymentOperations:0});
   console.log('CASH_OPENING_PASS',JSON.stringify(results[results.length-1]));
  }catch(e){save({failure:String(e)});await page.screenshot({path:OUT+'/'+size.name+'-failure.png',timeout:3000}).catch(()=>{});throw e}
  finally{await context.close();}
 }
 fs.writeFileSync(OUT+'/results.json',JSON.stringify(results,null,2));
 await browser.close();clearTimeout(watchdog);
})().catch(e=>{console.error(e);process.exit(1)});

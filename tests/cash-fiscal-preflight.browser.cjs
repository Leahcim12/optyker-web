/* Actual built UI, fictional service and mocked endpoints; never submit a payment. */
const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
const base=process.env.CLIENT_TEST_URL||'http://127.0.0.1:8766/',origin=new URL(base).origin;
const out=process.env.CLIENT_TEST_OUTPUT||'/tmp/client-search-check';fs.mkdirSync(out,{recursive:true});
const client={id:'00000000-0000-4000-8000-000000000091',name:'Cliente',surname:'Dimostrativo',reference_no:'99001C'};
const service={variant_id:'service:00000000-0000-4000-8000-000000000081',title:'Servizio dimostrativo',price:70,list_price:70,quantity:1,department:1,fiscal_vat_code:'ART10',fiscal_item_type:'services',selected:true,is_service:true};
const forbidden=new Set(['checkout','settle','mark_delivery','cancel_order_sheet','daily_closure','restore_reg','drawer','gift_receipt','issue_payment','void']);
setTimeout(()=>{console.error('Fiscal preflight regression timed out');process.exit(1)},75000).unref();
(async()=>{
 const browser=await chromium.launch({headless:true}),results=[];
 for(const mode of ['desktop','mobile','pending']){
  const context=await browser.newContext({serviceWorkers:'block',viewport:mode==='mobile'?{width:390,height:844}:{width:1440,height:1000}}),page=await context.newPage();page.setDefaultTimeout(10000);
  const calls=[],errors=[];let stored=[{...service}];page.on('pageerror',e=>errors.push(String(e).slice(0,180)));
  await context.route('**/*',async route=>{
   const r=route.request(),u=new URL(r.url());
   if(u.origin===origin&&['GET','HEAD'].includes(r.method()))return route.continue();
   if(r.method()==='POST'){
    let b={};try{b=r.postDataJSON()||{}}catch(_){}const a=b.action,p=b.payload||{};calls.push(a||u.pathname);
    assert.ok(!forbidden.has(a),'unexpected financial operation '+a);
    if(u.pathname.endsWith('/optyker-staff-auth'))return route.fulfill({json:{ok:true,username:b.username,has_email:true,needs_password:false}});
    if(a==='clients')return route.fulfill({json:{ok:true,data:[client]}});
    if(a==='quote_lines')return route.fulfill({json:{ok:true,data:{ovc_version:'20260910-ovc2',card:null,lines:(p.lines||[]).map(l=>({...stored[0],...l}))}}});
    if(a==='client_cart_get'||a==='client_cart_save'){
     if(a==='client_cart_save')stored=p.items;
     return route.fulfill({json:{ok:true,data:{client_id:client.id,items:stored,updated_at:'2026-09-19T00:00:00Z'}}});
    }
    if(a==='status')return route.fulfill({json:{ok:true,data:{opened:true,closed:false,suggested_opening_cash:0}}});
    return route.fulfill({json:{ok:true,data:[],clients:[],sheets:[],consents:[]}});
   }return route.abort();
  });
  try{
   await page.goto(base,{waitUntil:'domcontentloaded'});await page.waitForTimeout(600);
   const opts=await page.locator('#optykerLoginOperator option').evaluateAll(a=>a.map(o=>o.value).filter(Boolean));
   await page.locator('#optykerLoginOperator').selectOption(opts.find(v=>/michael/i.test(v))||opts[0]);await page.locator('#optykerAuthPassword').fill('LOCAL_FIXTURE_ONLY');await page.locator('.optykerLoginButton').click();await page.waitForFunction(()=>window.optykerAuthenticated===true);await page.waitForTimeout(700);
   if(mode==='pending')await page.evaluate(()=>sessionStorage.setItem('optykerCashPendingRequest',JSON.stringify({id:'00000000-0000-4000-8000-000000000066'})));
   await page.evaluate(c=>{window.OPTYKER_CLOUD.clients=[c];window.openOptykerCash(c.id)},client);
   await page.waitForFunction(()=>window.OPTYKER_CASH_FISCAL_PREFLIGHT_VERSION==='20260919-preflight1');
   await page.waitForFunction(()=>document.getElementById('optykerCashTotal').textContent.includes('70,00'));
   const vat=page.locator('[data-vat]').first(),checkout=page.locator('#optykerCashCheckoutBtn'),restore=page.locator('[data-cash-catalog-vat]');
   await restore.waitFor();assert.equal(await vat.inputValue(),'1','no silent tax change');assert.equal(await checkout.isDisabled(),true,'mismatch must be stopped before checkout');assert.equal(calls.filter(a=>a==='client_cart_save').length,0,'display must not change saved cart');
   await page.screenshot({path:out+'/preflight-'+mode+'.png'});
   if(mode==='pending'){
    assert.equal(await restore.isDisabled(),true);await restore.evaluate(b=>b.dispatchEvent(new MouseEvent('click',{bubbles:true})));assert.equal(await vat.inputValue(),'1');assert.ok(await page.evaluate(()=>sessionStorage.getItem('optykerCashPendingRequest')));
   }else{
    await restore.click();await page.waitForFunction(()=>!document.getElementById('optykerCashCheckoutBtn').disabled);await page.waitForTimeout(500);assert.equal(stored[0].department,3);assert.equal(Number(stored[0].price),70);assert.equal(await vat.inputValue(),'3');assert.equal(calls.filter(a=>a==='client_cart_save').length,1);assert.equal(await page.locator('.cashFiscalMismatch').count(),0);
   }
   assert.ok(!calls.some(a=>forbidden.has(a)));assert.ok(!errors.some(e=>/TypeError|RangeError|ReferenceError/.test(e)),errors.join('\n'));
   const row={mode,passed:true,noSilentVatChange:true,paymentOrPrinterCommands:0};results.push(row);console.log('FISCAL_PREFLIGHT_PASS',JSON.stringify(row));
  }catch(e){await page.screenshot({path:out+'/preflight-'+mode+'-failure.png',timeout:4000}).catch(()=>{});fs.writeFileSync(out+'/preflight-'+mode+'-failure.json',JSON.stringify({error:String(e),calls,errors}));throw e}
  finally{await context.close()}
 }
 fs.writeFileSync(out+'/preflight-results.json',JSON.stringify(results,null,2));await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});

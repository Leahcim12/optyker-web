/* Every external call is mocked. No credentials, receipts or real customer data.
   These tests validate the production UI, not a physical fiscal printer. */
const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
const base=process.env.QUOTE_TEST_URL||'http://127.0.0.1:8766/',origin=new URL(base).origin;
const out=process.env.QUOTE_TEST_OUTPUT||'/tmp/quote-check';fs.mkdirSync(out,{recursive:true});
const customer={id:'00000000-0000-4000-8000-000000000099',name:'Cliente',surname:'Dimostrativo',reference_no:'99999C'};
const item={variant_id:'client_cart:00000000-0000-4000-8000-000000000077',title:'Ordine LAC dimostrativo',variant_title:'TEST',price:2400,list_price:2400,quantity:1,selected:true,department:null,unit_price_override:null,locked_price:true,fiscal_vat_code:'',source_work_order_id:'00000000-0000-4000-8000-000000000077',source_type:'lac_busta'};
const forbidden=new Set(['checkout','settle','mark_delivery','cancel_order_sheet','daily_closure','restore_reg','drawer','gift_receipt','issue_payment','void']);
setTimeout(()=>{console.error('Quotation regression stalled');process.exit(1)},150000).unref();
(async()=>{
 const browser=await chromium.launch({headless:true}),results=[];
 for(const mode of ['missing-vat','timeout','server-error','invalid-quote','previous-payment','mobile']){
  const context=await browser.newContext({serviceWorkers:'block',viewport:mode==='mobile'?{width:390,height:844}:{width:1440,height:1000}}),page=await context.newPage();page.setDefaultTimeout(10000);
  let retryAllowed=false,quoteRequests=0;const calls=[],errors=[];
  const stored={...item,department:['missing-vat','mobile'].includes(mode)?null:1};
  page.on('pageerror',e=>errors.push(String(e).slice(0,180)));
  await context.route('**/*',async route=>{
   const r=route.request(),u=new URL(r.url());
   if(u.origin===origin&&['GET','HEAD'].includes(r.method()))return route.continue();
   if(r.method()==='POST'){
    let b={};try{b=r.postDataJSON()||{}}catch(_){}
    const a=b.action;calls.push(a||u.pathname);
    if(u.pathname.endsWith('/optyker-staff-auth'))return route.fulfill({json:{ok:true,username:b.username,has_email:true,needs_password:false}});
    if(a==='quote_lines'){
     quoteRequests++;
     assert.ok(u.pathname.endsWith('/optyker-cash-register-api-v2'),'quote must use existing authenticated v2 endpoint');
     if(mode==='timeout'&&!retryAllowed)return;
     if(mode==='server-error'&&!retryAllowed)return route.fulfill({status:400,json:{ok:false,error:'TEST: tariffa non disponibile'}});
     const lines=(b.payload.lines||[]).map(l=>({...stored,...l,is_client_cart_order:true}));
     if(mode==='invalid-quote'&&!retryAllowed&&lines.length)lines[0].variant_id='client_cart:WRONG_CUSTOMER';
     return route.fulfill({json:{ok:true,data:{ovc_version:'20260910-ovc2',card:null,lines}}});
    }
    if(a==='client_cart_get'||a==='client_cart_save')return route.fulfill({json:{ok:true,data:{client_id:customer.id,items:b.payload?.items||[stored],updated_at:'2026-09-19T00:00:00Z'}}});
    if(a==='clients')return route.fulfill({json:{ok:true,data:[customer]}});
    if(a==='status')return route.fulfill({json:{ok:true,data:{opened:true,closed:false,suggested_opening_cash:0}}});
    return route.fulfill({json:{ok:true,data:[],clients:[],sheets:[],consents:[]}});
   }return route.abort();
  });
  try{
   await page.goto(base,{waitUntil:'domcontentloaded'});await page.waitForTimeout(700);
   const opts=await page.locator('#optykerLoginOperator option').evaluateAll(a=>a.map(x=>x.value).filter(Boolean));
   await page.locator('#optykerLoginOperator').selectOption(opts.find(x=>/michael/i.test(x))||opts[0]);await page.locator('#optykerAuthPassword').fill('LOCAL_FIXTURE_ONLY');await page.locator('.optykerLoginButton').click();await page.waitForFunction(()=>window.optykerAuthenticated===true);await page.waitForTimeout(1000);
   if(mode==='previous-payment')await page.evaluate(()=>sessionStorage.setItem('optykerCashPendingRequest',JSON.stringify({id:'00000000-0000-4000-8000-000000000044'})));
   await page.evaluate(c=>{window.OPTYKER_CLOUD.clients=[c];window.openOptykerCash(c.id)},customer);
   await page.waitForFunction(()=>window.OPTYKER_CASH_QUOTE_VERSION==='20260919-quote1');
   const status=page.locator('#optykerCashOvcStatus'),checkout=page.locator('#optykerCashCheckoutBtn');
   if(['timeout','server-error','invalid-quote'].includes(mode)){
    await page.locator('#optykerCashQuoteRetry').waitFor({timeout:21000});
    assert.equal(await checkout.isDisabled(),true,'unverified prices must block payment');
    assert.match(await status.innerText(),/Tariffe non verificate/);
    assert.equal(await page.locator('#optykerCashTotal').innerText(),'Da verificare');
    retryAllowed=true;await page.locator('#optykerCashQuoteRetry').click();
   }
   await page.waitForFunction(()=>!document.getElementById('optykerCashTotal').textContent.includes('Verifica')&&!document.getElementById('optykerCashTotal').textContent.includes('verificare'));
   assert.match(await page.locator('#optykerCashTotal').innerText(),/2\.?400,00/);
   if(['missing-vat','mobile'].includes(mode)){
    assert.equal(await checkout.isDisabled(),true);assert.match(await status.innerText(),/Seleziona l’IVA/);
    const vat=page.locator('[data-vat]').first();assert.equal(await vat.isDisabled(),false,'VAT selection must remain editable');
    await vat.selectOption('1');
    await page.waitForFunction(()=>!document.getElementById('optykerCashCheckoutBtn').disabled);
   }else if(mode==='previous-payment'){
    assert.equal(await checkout.isDisabled(),true,'pending payment must still block duplicate checkout');
    assert.ok(await page.evaluate(()=>sessionStorage.getItem('optykerCashPendingRequest')),'never clear pending receipt as a pricing fix');
   }else await page.waitForFunction(()=>!document.getElementById('optykerCashCheckoutBtn').disabled);
   assert.ok(!calls.some(a=>forbidden.has(a)),'test requested payment or printer command');
   assert.ok(!errors.some(e=>/TypeError|RangeError|is not a function/.test(e)),errors.join('\n'));
   await page.screenshot({path:out+'/'+mode+'.png'});
   const result={mode,passed:true,quoteRequests,paymentOrPrinterCommands:0,errors};results.push(result);console.log('QUOTE_RECOVERY_PASS',JSON.stringify(result));
  }catch(e){await page.screenshot({path:out+'/'+mode+'-failure.png',timeout:3000}).catch(()=>{});fs.writeFileSync(out+'/'+mode+'-failure.json',JSON.stringify({error:String(e),calls,errors}));throw e;}
  finally{await context.close();}
 }
 fs.writeFileSync(out+'/results.json',JSON.stringify(results,null,2));await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});

/* Exact production UI, entirely mocked endpoints: no real credentials or payments. */
const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
const base=process.env.CLIENT_TEST_URL||'http://127.0.0.1:8766/',origin=new URL(base).origin;
const out=process.env.CLIENT_TEST_OUTPUT||'/tmp/client-search-check';fs.mkdirSync(out,{recursive:true});
const A={id:'00000000-0000-4000-8000-000000000099',name:'Anna',surname:'Dimostrativa',reference_no:'99999C',phone:'3330000099',email:'anna@example.invalid'};
const B={id:'00000000-0000-4000-8000-000000000098',name:'Elena',surname:'Rossi',reference_no:'99998C',phone:'3330000098',email:'elena@example.invalid'};
const C={id:'00000000-0000-4000-8000-000000000097',name:'Carlo',surname:'Rossi',reference_no:'99997C',phone:'3330000097',email:'carlo@example.invalid'};
function item(c){return {variant_id:'client_cart:'+c.id,title:'Ordine dimostrativo '+c.reference_no,price:c===A?100:200,list_price:c===A?100:200,quantity:1,selected:true,department:1,fiscal_vat_code:'04',locked_price:true}}
const forbidden=new Set(['checkout','settle','mark_delivery','cancel_order_sheet','daily_closure','restore_reg','drawer','gift_receipt','issue_payment','void']);
setTimeout(()=>{console.error('Customer search regression timed out');process.exit(1)},170000).unref();
(async()=>{
 const browser=await chromium.launch({headless:true}),results=[];
 for(const mode of ['desktop','cart-error','cart-timeout','lookup-timeout','pending-payment','stale-response','mobile']){
  const context=await browser.newContext({serviceWorkers:'block',viewport:mode==='mobile'?{width:390,height:844}:{width:1440,height:1000}}),page=await context.newPage();page.setDefaultTimeout(10000);
  let allowCart=!['cart-error','cart-timeout'].includes(mode),allowLookup=mode!=='lookup-timeout',oldRoute;
  const calls=[],errors=[],saves=[];page.on('pageerror',e=>errors.push(String(e).slice(0,160)));
  await context.route('**/*',async route=>{
   const r=route.request(),u=new URL(r.url());
   if(u.origin===origin&&['GET','HEAD'].includes(r.method()))return route.continue();
   if(r.method()==='POST'){
    let b={};try{b=r.postDataJSON()||{}}catch(_){}
    const a=b.action,p=b.payload||{};calls.push(a||u.pathname);
    if(u.pathname.endsWith('/optyker-staff-auth'))return route.fulfill({json:{ok:true,username:b.username,has_email:true,needs_password:false}});
    if(a==='clients'){
     if(p.search&&!allowLookup)return;
     if(mode==='stale-response'&&p.search==='Carlo'){oldRoute=route;return;}
     const q=String(p.search||'').toLowerCase();
     const rows=q?[A,B,C].filter(c=>[c.name,c.surname,c.phone,c.email,c.reference_no].some(v=>v.toLowerCase().includes(q))):[A];
     if(p.selected_id&&!rows.some(c=>c.id===p.selected_id))rows.unshift([A,B,C].find(c=>c.id===p.selected_id));
     return route.fulfill({json:{ok:true,data:rows.filter(Boolean)}});
    }
    if(a==='client_cart_get'){
     if(p.client_id===A.id&&!allowCart){if(mode==='cart-timeout')return;return route.fulfill({status:503,json:{ok:false,error:'TEST: caricamento non disponibile'}});}
     const c=[A,B,C].find(c=>c.id===p.client_id);return route.fulfill({json:{ok:true,data:{client_id:c.id,items:[item(c)],updated_at:'2026-09-19T00:00:00Z'}}});
    }
    if(a==='client_cart_save'){
     saves.push({id:p.client_id,ids:p.items.map(i=>i.variant_id)});
     return route.fulfill({json:{ok:true,data:{client_id:p.client_id,items:p.items,updated_at:'2026-09-19T00:00:00Z'}}});
    }
    if(a==='quote_lines')return route.fulfill({json:{ok:true,data:{ovc_version:'20260910-ovc2',card:null,lines:(p.lines||[]).map(l=>({...item([A,B,C].find(c=>'client_cart:'+c.id===l.variant_id)||A),...l}))}}});
    if(a==='status')return route.fulfill({json:{ok:true,data:{opened:true,closed:false,suggested_opening_cash:0}}});
    return route.fulfill({json:{ok:true,data:[],clients:[],sheets:[],consents:[]}});
   }return route.abort();
  });
  try{
   await page.goto(base,{waitUntil:'domcontentloaded'});await page.waitForTimeout(600);
   const opts=await page.locator('#optykerLoginOperator option').evaluateAll(a=>a.map(o=>o.value).filter(Boolean));
   await page.locator('#optykerLoginOperator').selectOption(opts.find(v=>/michael/i.test(v))||opts[0]);
   await page.locator('#optykerAuthPassword').fill('LOCAL_FIXTURE_ONLY');await page.locator('.optykerLoginButton').click();await page.waitForFunction(()=>window.optykerAuthenticated===true);await page.waitForTimeout(800);
   if(mode==='pending-payment')await page.evaluate(()=>sessionStorage.setItem('optykerCashPendingRequest',JSON.stringify({id:'00000000-0000-4000-8000-000000000011'})));
   await page.evaluate(c=>{window.OPTYKER_CLOUD.clients=[c];window.openOptykerCash(c.id)},A);
   await page.waitForFunction(()=>window.OPTYKER_CASH_CLIENT_SEARCH_VERSION==='20260919-clientsearch1');await page.waitForTimeout(400);
   const search=page.locator('#optykerCashClientSearch'),select=page.locator('#optykerCashClient'),result=page.locator('[data-cash-client-id="'+B.id+'"]');
   assert.equal(await search.isDisabled(),false,'read-only search was disabled by cart state');
   await search.fill('Rossi Elena');
   if(mode==='lookup-timeout'){
    await page.locator('#optykerCashClientSearchRetry').waitFor({timeout:16000});assert.match(await page.locator('#optykerCashClientSearchStatus').innerText(),/non completata/);
    allowLookup=true;await page.locator('#optykerCashClientSearchRetry').click();
   }
   await result.waitFor();assert.equal(await page.locator('[data-cash-client-id="'+C.id+'"]').count(),0,'name and surname tokens were not combined');
   assert.equal(await search.inputValue(),'Rossi Elena');assert.equal(await select.inputValue(),A.id,'typing must not select a different customer');assert.equal(saves.length,0,'typing must not save any cart');
   if(['cart-error','cart-timeout'].includes(mode)){
    assert.equal(await result.isDisabled(),true,'cart lock must still protect selection');
    await page.locator('#optykerCashClientCartRetry').waitFor({timeout:16000});
    assert.equal(await search.isDisabled(),false,'failed cart must not disable search');allowCart=true;
    await page.locator('#optykerCashClientCartRetry').click();await page.waitForFunction(id=>!document.querySelector('[data-cash-client-id="'+id+'"]').disabled,B.id);
   }
   if(mode==='pending-payment'){
    assert.equal(await result.isDisabled(),true,'pending payment must protect customer selection');
    assert.match(await page.locator('#optykerCashClientSearchStatus').innerText(),/Recupera incasso/);
    await result.evaluate(b=>b.dispatchEvent(new MouseEvent('click',{bubbles:true})));
    assert.equal(await select.inputValue(),A.id);assert.ok(await page.evaluate(()=>sessionStorage.getItem('optykerCashPendingRequest')));assert.equal(saves.length,0);
   }else{
    for(const q of ['3330000098','elena@example.invalid','99998c','Elena Rossi']){
     await search.fill(q);await page.waitForTimeout(320);await result.waitFor();assert.equal(await select.inputValue(),A.id);
    }
    if(mode==='stale-response'){
     await search.fill('Carlo');await page.waitForTimeout(350);assert.ok(oldRoute);
     await search.fill('Elena');await result.waitFor();await page.waitForTimeout(350);
     await oldRoute.fulfill({json:{ok:true,data:[C]}}).catch(()=>{});await page.waitForTimeout(100);
     assert.equal(await search.inputValue(),'Elena');assert.equal(await page.locator('[data-cash-client-id="'+C.id+'"]').count(),0);
    }
    await page.screenshot({path:out+'/'+mode+'-results.png'});
    await result.click();await page.waitForFunction(id=>document.getElementById('optykerCashClient').value===id,B.id);
    await page.waitForFunction(()=>document.getElementById('optykerCashCartItems').textContent.includes('99998C'));
    assert.ok(!(await page.locator('#optykerCashCartItems').innerText()).includes('99999C'),'cart leaked from previous customer');
    assert.ok(saves.length===1&&saves[0].id===A.id&&saves[0].ids.every(id=>id==='client_cart:'+A.id),'old cart saved under wrong customer or twice');
   }
   assert.ok(!calls.some(a=>forbidden.has(a)),'test sent a payment or printer command');assert.ok(!errors.some(e=>/TypeError|RangeError|is not a function/.test(e)),errors.join('\n'));
   results.push({mode,passed:true,search:true,selected:mode!=='pending-payment',paymentOrPrinterCommands:0});console.log('CASH_CLIENT_SEARCH_PASS',JSON.stringify(results.at(-1)));
  }catch(e){await page.screenshot({path:out+'/'+mode+'-failure.png',timeout:4000}).catch(()=>{});fs.writeFileSync(out+'/'+mode+'-failure.json',JSON.stringify({error:String(e),calls,errors,saves}));throw e;}
  finally{await context.close();}
 }
 fs.writeFileSync(out+'/results.json',JSON.stringify(results,null,2));await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});

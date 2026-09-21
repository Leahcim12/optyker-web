/* Entirely isolated fixtures: never uses real auth, sales, fiscal jobs or printers. */
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
const base=process.env.BALANCE_TEST_URL||'http://127.0.0.1:8766/',origin=new URL(base).origin,out=process.env.BALANCE_TEST_OUTPUT||'/tmp/deposit-check';fs.mkdirSync(out,{recursive:true});
const A={id:'00000000-0000-4000-8000-000000000099',name:'Cliente',surname:'Dimostrativo',reference_no:'99999C'},B={...A,id:'00000000-0000-4000-8000-000000000098',name:'Elena',surname:'Rossi'};
const I={variant_id:'client_cart:00000000-0000-4000-8000-000000000077',title:'Occhiale dimostrativo',price:450,list_price:450,quantity:1,selected:true,department:1,locked_price:true,fiscal_vat_code:'04',fiscal_item_type:'goods'};
const sid='00000000-0000-4000-8000-000000000011',pid='00000000-0000-4000-8000-000000000022';
setTimeout(()=>process.exit(1),150000).unref();
(async()=>{const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE,args:['--no-sandbox']}: {})}),results=[];
for(const mode of ['deposit','new-deposit','fully-paid','uncertain-receipt','mixed','timeout','mobile','search']){
 const context=await browser.newContext({serviceWorkers:'block',viewport:mode==='mobile'?{width:390,height:844}:{width:1440,height:1000}}),page=await context.newPage();page.setDefaultTimeout(8000);page.on('dialog',d=>d.accept());
 let paid=mode==='new-deposit'?0:mode==='fully-paid'?450:200,hasSale=mode!=='new-deposit';const calls=[],errors=[],paycalls=[];
 const cart=mode==='mixed'?[I,{...I,variant_id:'service:NEW',title:'Nuovo prodotto',price:10,list_price:10}]:[I];
 function snapshot(clientId){return {version:'20260921-balance1',client_id:clientId,groups:hasSale&&clientId===A.id?[{sale_id:sid,total_cents:45000,paid_cents:paid*100,due_cents:(450-paid)*100,payments:[{id:pid,amount_cents:paid*100,receipt_state:'prepared'}],lines:[{variant_id:I.variant_id,quantity:1,title:I.title,total_cents:45000,paid_cents:paid*100,due_cents:(450-paid)*100}]}]:[],conflicts:[],blockers:mode==='uncertain-receipt'?[{id:'job',sale_id:'uncertain-sale',state:'uncertain',amount_cents:5500}]:[]}}
 function replySale(stage){return {id:sid,client_id:A.id,total:450,paid_amount:paid,due_amount:450-paid,status:paid===450?'completed':'open_balance',payment_stage:stage,data:{lines:[I]},client_cart:{client_id:A.id,items:cart,updated_at:'stamp'},payment:{id:pid,data:{fiscal_snapshot:{}}}}}
 page.on('pageerror',e=>errors.push(String(e)));
 await context.route('**/*',async route=>{const r=route.request(),u=new URL(r.url());if(u.origin===origin&&['GET','HEAD'].includes(r.method()))return route.continue();
 if(r.method()!=='POST')return route.abort();let b={};try{b=r.postDataJSON()||{}}catch(_){}const a=b.action,p=b.payload||{};calls.push(a||u.pathname);
 if(u.pathname.endsWith('/optyker-staff-auth'))return route.fulfill({json:{ok:true,username:b.username,has_email:true,needs_password:false}});
 if(a==='snapshot'){if(mode==='timeout')return;return route.fulfill({json:{ok:true,data:snapshot(p.client_id)}})}
 if(a==='quote_lines')return route.fulfill({json:{ok:true,data:{ovc_version:'20260910-ovc2',card:null,lines:(p.lines||[]).map(l=>({...cart.find(x=>x.variant_id===l.variant_id),...l}))}}});
 if(a==='clients')return route.fulfill({json:{ok:true,data:p.search?[B]:[A,B]}});
 if(a==='client_cart_get'||a==='client_cart_save')return route.fulfill({json:{ok:true,data:{client_id:p.client_id,items:p.items||cart,updated_at:'stamp'}}});
 if(a==='checkout'||a==='settle'){paycalls.push({action:a,payload:p});hasSale=true;paid=a==='checkout'?p.deposit_amount:450;return route.fulfill({json:{ok:true,data:replySale(a==='checkout'?'deposit':'balance')}})}
 if(a==='status')return route.fulfill({json:{ok:true,data:{opened:true,closed:false,suggested_opening_cash:0}}});
 return route.fulfill({json:{ok:true,data:[],clients:[],sheets:[],consents:[]}});
 });
 try{
 await page.goto(base,{waitUntil:'domcontentloaded'});await page.waitForTimeout(400);
 let opts=await page.locator('#optykerLoginOperator option').evaluateAll(a=>a.map(x=>x.value).filter(Boolean));await page.locator('#optykerLoginOperator').selectOption(opts.find(v=>/michael/i.test(v))||opts[0]);await page.locator('#optykerAuthPassword').fill('FIXTURE_PASSWORD');await page.locator('.optykerLoginButton').click();await page.waitForFunction(()=>window.optykerAuthenticated===true);await page.waitForTimeout(500);
 await page.evaluate(c=>{window.OPTYKER_CLOUD.clients=[c];window.__receiptTest=[];window.OPTYKER_FISCAL=Object.freeze({__cloudRelay:true,checkReady:async()=>true,issuePayment:async(s,p)=>{window.__receiptTest.push({action:'issue',s,p})},openSale:async s=>{window.__receiptTest.push({action:'open',s})}});window.openOptykerCash(c.id)},A);
 const total=page.locator('#optykerCashTotal'),button=page.locator('#optykerCashCheckoutBtn');
 if(mode==='timeout'){await page.waitForFunction(()=>document.getElementById('optykerCashRecordedBalance').textContent.includes('Saldo non verificato'),{},{timeout:16000});assert.equal(await button.isDisabled(),true);assert.equal(paycalls.length,0)}
 else{
 await page.waitForFunction(()=>document.getElementById('optykerCashTotal').textContent.includes(',00')&&!document.getElementById('optykerCashTotal').textContent.includes('Verifica'));
 assert.match(await total.innerText(),new RegExp(mode==='new-deposit'?'450,00':mode==='fully-paid'?'0,00':mode==='mixed'?'260,00':'250,00'));
 if(mode==='new-deposit'){
  await page.locator('[data-stage="deposit"]').click();await page.locator('#optykerCashDeposit').fill('200');await page.locator('#optykerCashDeposit').dispatchEvent('input');await page.locator('#optykerCashDeposit').dispatchEvent('change');await button.click();
  await page.waitForFunction(()=>document.querySelector('.recordedLineBalance')?.textContent.includes('250,00'));assert.equal(paycalls.length,1);assert.equal(paycalls[0].payload.expected_total,450);assert.equal(paycalls[0].payload.deposit_amount,200);assert.match(await total.innerText(),/250,00/);
 }else if(mode==='deposit'){
  assert.equal(await page.locator('[data-price]').count(),0,'original price must not be replaced with discounted price');await button.click();await page.waitForFunction(()=>document.querySelector('.recordedLineBalance')?.textContent.includes('Saldato'));assert.equal(paycalls.length,1);assert.equal(paycalls[0].action,'settle');assert.equal(paycalls[0].payload.sale_id,sid);assert.match(await total.innerText(),/0,00/);assert.equal(await page.locator('.optykerCashCartItem').count(),1,'paid goods stay until delivery');assert.equal(await button.isDisabled(),true);
 }else if(mode==='uncertain-receipt'){
  assert.equal(await button.isDisabled(),true);await page.locator('[data-balance-receipt="uncertain-sale"]').click();assert.deepEqual(await page.evaluate(()=>window.__receiptTest),[{action:'open',s:'uncertain-sale'}]);assert.equal(paycalls.length,0);
 }else if(mode==='mixed'||mode==='fully-paid'){assert.equal(await button.isDisabled(),true);assert.equal(paycalls.length,0)}
 else if(mode==='search'){await page.locator('#optykerCashClientSearch').fill('Elena Rossi');await page.locator('[data-cash-client-id="'+B.id+'"]').waitFor();assert.equal(paycalls.length,0)}
 }
 await page.screenshot({path:out+'/'+mode+'.png'});assert.ok(!errors.some(e=>/TypeError|ReferenceError|RangeError/.test(e)),errors.join('\n'));assert.ok(!calls.some(a=>['prepare','queue_fiscal','queue_aux','void','claim'].includes(a)),'printer endpoint called');
 results.push({mode,passed:true,realPayments:0,realPrinterCommands:0});console.log('BALANCE_BROWSER_PASS',JSON.stringify(results.at(-1)));
 }catch(e){fs.writeFileSync(out+'/'+mode+'-failure.json',JSON.stringify({error:String(e),calls,errors,paycalls},null,2));await page.screenshot({path:out+'/'+mode+'-failure.png'}).catch(()=>{});throw e}finally{await context.close()}
}
fs.writeFileSync(out+'/balance-results.json',JSON.stringify(results,null,2));await browser.close();})().catch(e=>{console.error(e);process.exit(1)});

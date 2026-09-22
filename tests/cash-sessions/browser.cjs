// Native UI tests; all remote calls are mocked. No live login, money or printer commands.
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
const base='http://127.0.0.1:8766',out='/tmp/cash-sessions';fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await chromium.launch({headless:true});const results=[];
for(const scenario of ['staff-desktop','staff-mobile','admin','network-recovery']){
 const page=await browser.newPage({viewport:scenario==='staff-mobile'?{width:390,height:844}:{width:1366,height:1000}});page.setDefaultTimeout(7000);page.on('dialog',d=>d.accept());const errors=[],calls=[],writes=[],stored=new Map();let closed=true,count=1,pending=null,drop=scenario==='network-recovery';
 const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Rome'}).format(new Date());
 function metrics(){return {opened:true,closed,total_collected:120,cash_total:60,card_total:60,receipts_total:120,receipts_count:3,opening:{opening_cash:70,opening_checks:0},closure:{next_opening_cash:70,next_opening_checks:0},session:{closures_count:count,number:count+1,token:'fixture-'+count+'-'+closed,opening:{opening_cash:70,opening_checks:0},totals:{total_collected:0,cash_total:0,card_total:0},daily_totals:{total_collected:120},cash_expected:70,pending}}}
 page.on('pageerror',e=>errors.push(String(e)));
 await page.route('**/*',async route=>{const req=route.request(),u=new URL(req.url());
  if(u.origin===base&&u.pathname==='/session-fixture')return route.fulfill({contentType:'text/html',body:'<!doctype html><html><head></head><body><div id="optykerCashOverlay"><div class="optykerCashHeaderRight"></div></div><div id="optykerAdminCashPanel"><div class="optykerAdminCashTop"></div><table><tbody id="optykerAdminCashDays"></tbody></table></div><script>window.OPTYKER_CLOUD={username:"FIXTURE",password:"NOT_A_REAL_PASSWORD"};sessionStorage.setItem("optyker_billing_admin_token","FIXTURE");</script><script src="/cash-sessions.js"></script><script src="/cash-day-control.js"></script><script src="/admin-cash-today-controls.js"></script></body></html>'});
  if(u.origin===base)return route.continue();
  if(req.method()!=='POST')throw new Error('Unexpected external request '+u.host);
  const b=req.postDataJSON(),a=b.action,p=b.payload||b;calls.push(a);assert.ok(!['checkout','settle','queue_fiscal','queue_aux','daily_closure','bridge_claim'].includes(a));
  const reply=data=>route.fulfill({json:{ok:true,data}});
  if(a==='status'||a==='day'||a==='session_status')return reply(metrics());
  if(a==='session_history')return reply({history:[{kind:'close',state:'completed',sequence_no:count,at:new Date().toISOString(),operator_username:'FIXTURE',closure:{total_collected:0,next_opening_cash:70}}]});
  if(a==='session_result'){const r=stored.get(p.request_id);assert.ok(r);pending=null;return reply({...r,state:'completed'})}
  if(a==='session_close'||a==='session_open'){
   assert.ok(p.request_id);assert.ok(p.expected_token);assert.ok(!stored.has(p.request_id),'Duplicate network write');writes.push({a,p});if(a==='session_close'){assert.equal(p.cash_counted,70);assert.equal(p.safe_deposit_cash,0);closed=true;count++}else{assert.equal(p.opening_cash,70);closed=false}
   const result={state:'completed',operation_id:p.request_id,data:metrics()};stored.set(p.request_id,result);await new Promise(r=>setTimeout(r,120));if(drop){drop=false;return route.abort()}
   return reply(result);
  }
  throw new Error('Unexpected action '+a);
 });
 try{
  await page.goto(base+'/session-fixture');
  if(scenario==='admin'){
   const close=page.locator('#optykerAdminCashCloseToday');await close.waitFor();assert.equal(await close.isDisabled(),false);await close.click();await page.locator('#csCount').waitFor();assert.equal(await page.locator('#csFiscal').isChecked(),false);await page.locator('#csConfirm').click();await page.waitForFunction(()=>document.querySelector('.csMessage')?.textContent.includes('confermata'));assert.equal(writes[0].p.fiscal,false);
   await page.locator('.csExit').click();await page.locator('#optykerAdminCashOpenToday').click();await page.locator('#csOpening').waitFor();await page.locator('#csConfirm').click();await page.waitForFunction(()=>document.querySelector('.csMessage')?.textContent.includes('confermata'));
  }else{
   const close=page.locator('#optykerCashDayCloseBtn');await close.waitFor();assert.equal(await close.isDisabled(),false);assert.equal(await page.locator('#optykerCashDayOpenBtn').isDisabled(),false);await close.click();await page.locator('#csCount').waitFor();assert.equal(await page.locator('#csFiscal').count(),0);
   await page.locator('#csNotes').fill('Test chiusura ripetuta');await page.evaluate(()=>{document.getElementById('csConfirm').click();document.getElementById('csConfirm').click()});
   if(scenario==='network-recovery'){await page.locator('#csCheck').waitFor();await page.locator('#csCheck').click()}
   await page.waitForFunction(()=>document.querySelector('.csMessage')?.textContent.includes('confermata'));assert.equal(writes.length,1);
   await page.locator('.csExit').click();await close.click();await page.locator('#csCount').waitFor();await page.locator('#csConfirm').click();await page.waitForFunction(()=>document.querySelector('.csMessage')?.textContent.includes('confermata'));assert.equal(writes.length,2);assert.notEqual(writes[0].p.request_id,writes[1].p.request_id);
   await page.locator('.csExit').click();await page.locator('#optykerCashDayOpenBtn').click();await page.locator('#csOpening').waitFor();assert.equal(await page.locator('#csOpening').inputValue(),'70.00');await page.locator('#csConfirm').click();await page.waitForFunction(()=>document.querySelector('.csMessage')?.textContent.includes('confermata'));assert.equal(closed,false);
  }
  await page.screenshot({path:out+'/'+scenario+'.png'});assert.equal(errors.length,0,errors.join('\n'));results.push({scenario,passed:true,newRealPayments:0,realPrinterCommands:0});console.log('SESSION_BROWSER_PASS',scenario);
 }catch(e){await page.screenshot({path:out+'/'+scenario+'-error.png'}).catch(()=>{});fs.writeFileSync(out+'/'+scenario+'-error.json',JSON.stringify({error:String(e),calls,writes,errors},null,2));throw e}
 await page.close();
}
fs.writeFileSync(out+'/results.json',JSON.stringify(results,null,2));await browser.close();})().catch(e=>{console.error(e);process.exit(1)});

/* Full built-page diagnostic. All external calls are intercepted and mocked;
   no real authentication, client records, sales, fiscal operations or hardware. */
const {chromium}=require('playwright');
const fs=require('node:fs');
const OUT='/tmp/cash-opening';fs.mkdirSync(OUT,{recursive:true});
const watchdog=setTimeout(()=>{console.error('Cash browser watchdog expired');process.exit(1)},90000);
(async()=>{
 const browser=await chromium.launch({headless:true});
 const context=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:'block'});
 const page=await context.newPage();page.setDefaultTimeout(7000);
 const errors=[],calls=[],report={};
 page.on('pageerror',e=>{errors.push(String(e));console.log('PAGE_ERROR',String(e))});
 await context.route('**/*',async route=>{
   const req=route.request(),url=new URL(req.url());
   if(url.origin==='http://127.0.0.1:8766')return route.continue();
   if(req.method()==='POST'){
     let body={};try{body=req.postDataJSON()||{}}catch(_){}
     calls.push({endpoint:url.pathname,action:body.action||''});
     if(url.pathname.endsWith('/optyker-staff-auth'))return route.fulfill({json:{ok:true,username:body.username||'MICHAEL',has_email:true,needs_password:false}});
     return route.fulfill({json:{ok:true,data:[],clients:[],sheets:[],consents:[]}});
   }
   return route.abort();
 });
 await page.goto('http://127.0.0.1:8766/',{waitUntil:'domcontentloaded',timeout:20000});
 await page.waitForTimeout(1800);
 await page.locator('#optykerLoginOperator').selectOption('MICHAEL');
 await page.locator('#optykerAuthPassword').fill('LOCAL_FIXTURE_ONLY');
 await page.locator('.optykerLoginButton').click();
 await page.waitForTimeout(2500);
 report.before=await page.evaluate(()=>({auth:window.optykerAuthenticated,app:getComputedStyle(document.getElementById('mainApp')).display,login:getComputedStyle(document.getElementById('optykerLoginScreen')).display,openCash:typeof window.openOptykerCash,buttons:[...document.querySelectorAll('button')].filter(x=>/Cassa/i.test(x.textContent)).map(x=>({id:x.id,visible:!!x.getClientRects().length,handler:String(x.onclick),html:x.outerHTML.slice(0,900)}))}));
 console.log('BEFORE',JSON.stringify(report.before));
 await page.screenshot({path:OUT+'/before.png'});
 try{await page.locator('[data-vision-action="cash"]').first().click();report.dashboardClick=true}catch(e){report.dashboardClick=String(e)}
 await page.waitForTimeout(1500);
 report.afterDashboard=await page.evaluate(()=>{const e=document.getElementById('optykerCashOverlay');return e?{cls:e.className,style:e.style.cssText,display:getComputedStyle(e).display,rect:e.getBoundingClientRect().toJSON(),lastHtml:e.innerHTML.slice(-1000)}:null});
 console.log('AFTER_DASHBOARD',JSON.stringify(report.afterDashboard));
 await page.screenshot({path:OUT+'/after-dashboard.png'});
 if(!report.afterDashboard||report.afterDashboard.display==='none'){
  try{await page.locator('[data-optyker-cash-managed="1"]').first().click();report.topClick=true}catch(e){report.topClick=String(e)}
  await page.waitForTimeout(1500);
 }
 report.afterTop=await page.evaluate(()=>{const e=document.getElementById('optykerCashOverlay');return e?{cls:e.className,style:e.style.cssText,display:getComputedStyle(e).display}:null});
 try{await page.locator('#optykerCashNote').fill('DIAGNOSI LOCALE');report.noteTyped=true}catch(e){report.noteTyped=String(e)}
 report.errors=errors;report.calls=calls;
 fs.writeFileSync(OUT+'/report.json',JSON.stringify(report,null,2));
 console.log('CASH_DIAGNOSIS',JSON.stringify(report));
 await page.screenshot({path:OUT+'/after-top.png'});
 await browser.close();clearTimeout(watchdog);
})().catch(e=>{console.error(e);process.exit(1)});

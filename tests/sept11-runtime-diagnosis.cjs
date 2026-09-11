/* Real assembled page. All business APIs are intercepted: no real login or records. */
const {chromium}=require('playwright');const fs=require('fs');fs.mkdirSync('runtime-diagnosis',{recursive:true});
(async()=>{const browser=await chromium.launch();const reports=[];try{
 for(const [i,url] of ['https://optyker.it/','https://www.optyker.it/','https://www.optyker.it/gestionale-v3/'].entries()){
  const report={url,errors:[],console:[],assets:[],states:[],blockedApis:[]};reports.push(report);const ctx=await browser.newContext({viewport:{width:1440,height:950},serviceWorkers:'block'});const page=await ctx.newPage();page.setDefaultTimeout(5000);
  page.on('pageerror',e=>report.errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')report.console.push(m.text().slice(0,400));});page.on('response',r=>{if(['script','document','stylesheet'].includes(r.request().resourceType()))report.assets.push({url:r.url(),status:r.status()});});page.on('dialog',d=>d.dismiss());
  await ctx.route('**/*',async r=>{const u=r.request().url();if(u.includes('/rest/v1/')||u.includes('/functions/v1/')||r.request().method()!=='GET'){
   let b={};try{b=r.request().postDataJSON()||{};}catch{}report.blockedApis.push({path:new URL(u).pathname,action:b.action||b.p_action});
   let data={ok:true,data:[],rows:[],clients:[],sheets:[],orders:[],count:0,messages:[]};
   if(u.includes('optyker-staff-auth'))data={ok:true,username:'Michael',has_email:true,needs_password:false};
   if(u.includes('/rest/v1/')&&!u.includes('/rpc/'))data=[];
   return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
  }return r.continue();});
  const snapshot=async label=>{report.states.push({label,...await page.evaluate(()=>({version:window.OPTYKER_SEPT11?.version||null,url:location.href,authenticated:!!window.optykerAuthenticated,admin:!!window.OPTYKER_BILLING_ADMIN,visible:[...document.querySelectorAll('[id$=Panel]')].filter(x=>x.getClientRects().length&&getComputedStyle(x).display!=='none').map(x=>x.id),companyButton:!!document.querySelector('#whCompaniesBtn'),settingsCompanies:!!document.querySelector('#whSettingsCompanies'),customerBilling:!!document.querySelector('[data-client-billing]'),ovcButton:document.querySelector('#ovcCardTariffs')?.textContent,loginError:document.querySelector('#optykerLoginError')?.textContent||''}))});fs.writeFileSync('runtime-diagnosis/report.json',JSON.stringify(reports,null,2));};
  try{
   const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:20000});report.httpStatus=response.status();await page.waitForTimeout(1500);await snapshot('initial');
   await page.selectOption('#optykerLoginOperator','Michael');await page.waitForTimeout(400);await page.fill('#optykerAuthPassword','SYNTHETIC_PASSWORD_NOT_REAL');await page.click('.optykerLoginButton');await page.waitForTimeout(1800);await snapshot('after_mock_login');
   for(const nav of ['navWarehouse','navSettings','navClients']){if(await page.locator('#'+nav).count()){await page.click('#'+nav);await page.waitForTimeout(950);await snapshot(nav);}}
   await page.evaluate(()=>{const c={id:'11111111-1111-4111-8111-111111111111',name:'Cliente',surname:'TEST',email:'test@example.invalid'};OPTYKER_CLOUD.clients=[c];window.clientCurrentId=c.id;if(window.showModule)showModule('clients');if(window.clientLoad)clientLoad(c.id);});await page.waitForTimeout(1000);await snapshot('synthetic_client');
   await page.screenshot({path:'runtime-diagnosis/page-'+i+'.png',fullPage:false});
  }catch(e){report.failure=String(e);}finally{await ctx.close();fs.writeFileSync('runtime-diagnosis/report.json',JSON.stringify(reports,null,2));}
 }
 console.log(JSON.stringify(reports,null,2));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});

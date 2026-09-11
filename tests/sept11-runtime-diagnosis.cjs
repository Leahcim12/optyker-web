/* Real assembled page. All business APIs intercepted; no real login or records. */
const {chromium}=require('playwright');const fs=require('fs');fs.mkdirSync('runtime-diagnosis',{recursive:true});
(async()=>{const browser=await chromium.launch();const reports=[];try{
 for(const [i,url] of ['https://optyker.it/','https://www.optyker.it/gestionale-v3/'].entries()){
  const report={url,errors:[],assets:[],states:[],blockedApis:[]};reports.push(report);const ctx=await browser.newContext({viewport:{width:1440,height:950},serviceWorkers:'block'});const page=await ctx.newPage();page.setDefaultTimeout(5000);
  page.on('pageerror',e=>report.errors.push(String(e)));page.on('response',r=>{if(['script','document','stylesheet'].includes(r.request().resourceType()))report.assets.push({url:r.url(),status:r.status()});});page.on('dialog',d=>d.dismiss());
  await ctx.route('**/*',async r=>{const u=r.request().url();if(u.includes('/rest/v1/')||u.includes('/functions/v1/')||r.request().method()!=='GET'){
   let b={};try{b=r.request().postDataJSON()||{};}catch{}report.blockedApis.push({path:new URL(u).pathname,action:b.action||b.p_action});
   let data={ok:true,data:[],rows:[],clients:[],sheets:[],orders:[],count:0,messages:[]};
   if(u.includes('optyker-staff-auth'))data={ok:true,username:b.username||'Michael Mologni',has_email:true,needs_password:false};
   if(u.includes('/rest/v1/')&&!u.includes('/rpc/'))data=[];
   if(u.includes('optyker_ovc_api'))data={ok:true,data:{client_id:'11111111-1111-4111-8111-111111111111',card_number:1,active:true,revision:1}};
   return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
  }return r.continue();});
  const snapshot=async label=>{report.states.push({label,...await page.evaluate(()=>({version:window.OPTYKER_SEPT11?.version||null,url:location.href,authenticated:!!window.optykerAuthenticated,admin:!!window.OPTYKER_BILLING_ADMIN,visible:[...document.querySelectorAll('[id$=Panel]')].filter(x=>x.getClientRects().length&&getComputedStyle(x).display!=='none').map(x=>x.id),companyButton:!!document.querySelector('#whCompaniesBtn'),settingsCompanies:!!document.querySelector('#whSettingsCompanies'),customerBilling:!!document.querySelector('[data-client-billing]'),ovcButton:document.querySelector('#ovcCardTariffs')?.textContent,loginError:document.querySelector('#optykerLoginError')?.textContent||'',warranty:document.querySelector('.eyWarrantyHint')?.textContent||''}))});fs.writeFileSync('runtime-diagnosis/report.json',JSON.stringify(reports,null,2));};
  try{
   const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:20000});report.httpStatus=response.status();await page.waitForTimeout(1200);await snapshot('initial');
   const operator=await page.locator('#optykerLoginOperator option').evaluateAll(a=>a.find(x=>/michael/i.test(x.value))?.value);report.operator=operator;
   await page.selectOption('#optykerLoginOperator',operator);await page.waitForTimeout(350);await page.fill('#optykerAuthPassword','SYNTHETIC_PASSWORD_NOT_REAL');await page.click('.optykerLoginButton');await page.waitForTimeout(1700);await snapshot('after_mock_login');
   for(const nav of ['navWarehouse','navSettings','navClients']){if(await page.locator('#'+nav).count()){await page.click('#'+nav);await page.waitForTimeout(950);await snapshot(nav);}}
   await page.evaluate(()=>{const c={id:'11111111-1111-4111-8111-111111111111',name:'Cliente',surname:'TEST',email:'test@example.invalid'};OPTYKER_CLOUD.clients=[c];window.clientCurrentId=c.id;if(window.showModule)showModule('clients');if(window.clientLoad)clientLoad(c.id);});await page.waitForTimeout(1000);await snapshot('synthetic_client');
   await page.screenshot({path:'runtime-diagnosis/page-'+i+'.png',fullPage:false});
   await page.evaluate(()=>openEyewearSheet());await page.waitForTimeout(800);if(await page.locator('#eyFrameType').count())await page.selectOption('#eyFrameType','Del cliente');await page.waitForTimeout(700);await snapshot('own_frame');await page.screenshot({path:'runtime-diagnosis/warranty-'+i+'.png',fullPage:false});
  }catch(e){report.failure=String(e);try{await page.screenshot({path:'runtime-diagnosis/failure-'+i+'.png'});}catch{}}finally{await ctx.close();fs.writeFileSync('runtime-diagnosis/report.json',JSON.stringify(reports,null,2));}
 }
 console.log(JSON.stringify(reports.map(r=>({url:r.url,states:r.states,errors:r.errors,failure:r.failure})),null,2));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});

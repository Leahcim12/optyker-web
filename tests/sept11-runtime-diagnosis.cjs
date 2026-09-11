/* Complete assembled page. Every business request is mocked: no real data or writes. */
const {chromium}=require('playwright');const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');fs.mkdirSync('runtime-diagnosis',{recursive:true});
(async()=>{const browser=await chromium.launch();const reports=[],patched=process.env.OPTYKER_PATCHED_TEST==='1';try{
 for(const [i,url] of ['https://optyker.it/','https://www.optyker.it/gestionale-v3/'].entries()){
  const report={url,patched,errors:[],assets:[],states:[]};reports.push(report);const ctx=await browser.newContext({viewport:{width:1440,height:950},serviceWorkers:'block'});const page=await ctx.newPage();page.setDefaultTimeout(5000);
  page.on('pageerror',e=>report.errors.push(String(e)));page.on('response',r=>{if(['script','document','stylesheet'].includes(r.request().resourceType()))report.assets.push({url:r.url(),status:r.status()});});page.on('dialog',d=>d.dismiss());
  const client={id:'11111111-1111-4111-8111-111111111111',name:'Cliente',surname:'TEST',email:'test@example.invalid'};
  await ctx.route('**/*',async r=>{const u=new URL(r.request().url());let b={};try{b=r.request().postDataJSON()||{};}catch{}
   if(u.pathname.includes('/rest/v1/')||u.pathname.includes('/functions/v1/')||r.request().method()!=='GET'){
    let data={ok:true,data:[],rows:[],clients:[],sheets:[],orders:[],count:0,messages:[]};
    if(u.pathname.includes('optyker-staff-auth'))data={ok:true,username:b.username||'Michael Mologni',has_email:true,needs_password:false};
    if(u.pathname.includes('/rest/v1/')&&!u.pathname.includes('/rpc/'))data=[];
    if(u.pathname.includes('optyker_ovc_api'))data={ok:true,data:b.p_action==='service_list'?[{id:'44444444-4444-4444-8444-444444444444',title:'Controllo TEST',standard_price:75,card_price:40,revision:1}]:{client_id:client.id,card_number:1,active:true,revision:1}};
    if(u.pathname.includes('optyker_ovc_client_prices_api'))data={ok:true,data:[{id:'44444444-4444-4444-8444-444444444444',title:'Controllo TEST',standard_price:75,default_card_price:40,card_price:null,revision:0}]};
    if(u.pathname.includes('optyker_client_billing_api'))data={ok:true,provider:{connected:true},client:{id:client.id,name:'Cliente TEST'},data:[],drafts:[],pos_requests:[]};
    return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
   }
   if(patched&&['optyker.it','www.optyker.it'].includes(u.hostname)){
    let rel=u.pathname.replace(/^\//,'');if(!rel||rel.endsWith('/'))rel+='index.html';const file=path.resolve('_site',rel);
    if(file.startsWith(path.resolve('_site')+path.sep)&&fs.existsSync(file)&&fs.statSync(file).isFile()){const ext=path.extname(file),type={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml'}[ext]||'application/octet-stream';return r.fulfill({status:200,contentType:type,body:fs.readFileSync(file)});}
   }return r.continue();
  });
  const snapshot=async label=>{const x=await page.evaluate(()=>({version:window.OPTYKER_SEPT11?.version||null,runtime:window.OPTYKER_RUNTIME_REVISION||null,authenticated:!!window.optykerAuthenticated,visible:[...document.querySelectorAll('[id$=Panel]')].filter(x=>x.getClientRects().length&&getComputedStyle(x).display!=='none').map(x=>x.id),companyButton:!!document.querySelector('#whCompaniesBtn'),settingsCompanies:!!document.querySelector('#whSettingsCompanies'),customerBilling:!!document.querySelector('[data-client-billing]'),warranty:document.querySelector('.eyWarrantyHint')?.textContent||'',quoteColor:document.querySelector('#eyModeQuote')?getComputedStyle(document.querySelector('#eyModeQuote')).backgroundColor:null}));report.states.push({label,...x});fs.writeFileSync('runtime-diagnosis/report.json',JSON.stringify(reports,null,2));return x;};
  try{
   await page.goto(url,{waitUntil:'domcontentloaded',timeout:20000});await page.waitForTimeout(1200);await snapshot('initial');
   const operator=await page.locator('#optykerLoginOperator option').evaluateAll(a=>a.find(x=>/michael/i.test(x.value))?.value);
   await page.selectOption('#optykerLoginOperator',operator);await page.waitForTimeout(350);await page.fill('#optykerAuthPassword','SYNTHETIC_PASSWORD_NOT_REAL');await page.click('.optykerLoginButton');await page.waitForTimeout(1400);assert((await snapshot('after_mock_login')).authenticated);
   for(const [nav,root] of [['navWarehouse','warehousePanel'],['navSettings','optykerSettingsPanel'],['navClients','clientsPanel']]){await page.click('#'+nav);await page.waitForTimeout(1000);assert.deepEqual((await snapshot(nav)).visible,[root]);}
   await page.evaluate(c=>{OPTYKER_CLOUD.clients=[c];clientSelect(c.id);},client);await page.waitForTimeout(1300);assert(await page.locator('[data-client-billing]').isVisible());await snapshot('synthetic_client');await page.screenshot({path:'runtime-diagnosis/client-'+i+'.png'});
   await page.click('#ovcCardTariffs');await page.waitForSelector('.ovc11TariffRow');assert((await page.locator('dialog[open]').innerText()).includes('soltanto per questo cliente'));await page.click('dialog[open] header button');
   await page.evaluate(()=>openEyewearSheet());await page.waitForTimeout(500);await page.selectOption('#eyFrameType','Del cliente');await page.waitForTimeout(2400);const w=await snapshot('own_frame');
   if(patched||process.env.OPTYKER_EXPECT_FIXED==='1'){assert(w.warranty.includes('massimo due ricambi complessivi'));assert.equal(w.quoteColor,'rgb(180, 35, 50)');assert.equal(w.runtime,'20260911-r2');assert.deepEqual(await page.locator('#eyWarranty option').allTextContents(),['Base · inclusa']);}
   await page.screenshot({path:'runtime-diagnosis/quote-'+i+'.png'});
   await page.selectOption('#eyFrameType','Cerchiata');await page.fill('#eyFramePrice','200');await page.waitForTimeout(1400);assert((await page.locator('#eyWarranty option').allTextContents()).some(x=>x.includes('Gold')));
   report.ok=true;
  }catch(e){report.failure=String(e);try{await page.screenshot({path:'runtime-diagnosis/failure-'+i+'.png'});}catch{}}finally{await ctx.close();fs.writeFileSync('runtime-diagnosis/report.json',JSON.stringify(reports,null,2));}
 }
 console.log(JSON.stringify(reports.map(r=>({url:r.url,ok:r.ok,states:r.states,errors:r.errors,failure:r.failure})),null,2));assert(reports.every(r=>r.ok),'Full application regression test failed');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});

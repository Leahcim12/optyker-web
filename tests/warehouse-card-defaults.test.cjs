/* Full app UI regression. Intercepts every business request; no real login or writes. */
const {chromium}=require('playwright'),fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const OUT='card-defaults-check';fs.mkdirSync(OUT,{recursive:true});
(async()=>{const browser=await chromium.launch();const report={ok:false,checks:[],errors:[],business_writes_sent_to_network:0};let page;
try{
 const live=process.env.OPTYKER_LIVE==='1';const context=await browser.newContext({viewport:{width:1440,height:1100},serviceWorkers:'block'});page=await context.newPage();page.setDefaultTimeout(10000);
 const ids=['44444444-4444-4444-8444-444444444444','55555555-5555-4555-8555-555555555555'];
 const items=ids.map((id,i)=>({id,title:i?'Altro servizio TEST':'Controllo TEST',category:'services',price:i?50:75,vat_code:'22',active:true}));
 const prices=new Map(ids.map((id,i)=>[id,{card_price:i?null:40,revision:1}]));let conflict=false;const writes=[];
 page.on('pageerror',e=>report.errors.push(String(e)));page.on('dialog',d=>d.accept());
 await context.route('**/*',async route=>{const req=route.request(),url=new URL(req.url());let b={};try{b=req.postDataJSON()||{};}catch{}
  if(url.pathname.includes('/functions/v1/')||url.pathname.includes('/rest/v1/')||req.method()!=='GET'){
   let data={ok:true,data:[],rows:[],clients:[],sheets:[],orders:[],count:0,messages:[]};
   if(url.pathname.includes('optyker-staff-auth'))data={ok:true,username:b.username||'Michael Mologni',needs_password:false,has_email:true};
   else if(url.pathname.includes('optyker-inventory-api')&&b.action==='list')data={ok:true,data:{rows:b.payload.category==='services'?items:[],count:b.payload.category==='services'?2:0,page:1,limit:120}};
   else if(url.pathname.endsWith('/optyker_ovc_api')){
    if(b.p_action==='service_list')data={ok:true,data:items.filter(i=>!b.p_payload.search||i.title.includes(b.p_payload.search)).map(i=>({...i,standard_price:i.price,...prices.get(i.id)}))};
    else if(b.p_action==='service_price_set'){
     writes.push(b.p_payload);assert(!Object.hasOwn(b.p_payload,'client_id'));const prior=prices.get(b.p_payload.item_id);
     if(conflict){data={ok:false,error:'Tariffa aggiornata da un altro operatore: ricarica'};conflict=false;}
     else{assert.equal(b.p_payload.revision,prior.revision);prices.set(b.p_payload.item_id,{card_price:b.p_payload.card_price,revision:prior.revision+1});data={ok:true,data:{item_id:b.p_payload.item_id,...prices.get(b.p_payload.item_id)}};}
    }
   }else if(url.pathname.includes('optyker_ovc_client_prices_api'))throw Error('Global price editor must not call customer override API');
   else if(url.pathname.includes('/rest/v1/')&&!url.pathname.includes('/rpc/'))data=[];
   return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
  }
  if(!live&&['www.optyker.it','optyker.it'].includes(url.hostname)){
   let rel=url.pathname.replace(/^\//,'');if(!rel||rel.endsWith('/'))rel+='index.html';const file=path.resolve('_site',rel);
   if(file.startsWith(path.resolve('_site')+path.sep)&&fs.existsSync(file)&&fs.statSync(file).isFile())return route.fulfill({status:200,contentType:({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml'}[path.extname(file)]||'application/octet-stream'),body:fs.readFileSync(file)});
  }return route.continue();
 });
 await page.goto('https://www.optyker.it/',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.optykerWarehouseCardDefaults?.version==='20260911-card-defaults1');
 const operator=await page.locator('#optykerLoginOperator option').evaluateAll(a=>a.find(x=>/michael/i.test(x.value))?.value);await page.selectOption('#optykerLoginOperator',operator);await page.waitForTimeout(300);await page.fill('#optykerAuthPassword','SYNTHETIC_PASSWORD_NOT_REAL');await page.click('.optykerLoginButton');await page.waitForFunction(()=>window.optykerAuthenticated);
 await page.click('#navWarehouse');await page.waitForTimeout(700);await page.click('[data-wh-cat="services"]');await page.waitForSelector('.whOvcDefaultButton');await page.waitForTimeout(1000);
 const cell=page.locator('[data-ovc-default-id="'+ids[0]+'"]');assert((await cell.innerText()).includes('40,00'));assert((await page.locator('.whServiceTable thead').textContent()).includes('Prezzo OVC Card predefinito'));report.checks.push('Default price column and direct edit buttons are visible in real Services table');
 await page.screenshot({path:OUT+'/services-table.png'});
 await cell.locator('button').click();const dialog=page.locator('dialog.whOvcDefaultDialog[open]');const editor=dialog.locator('.whOvcDefaultEditor'),input=editor.locator('input'),save=editor.getByRole('button',{name:'Salva prezzo OVC',exact:true});
 await page.waitForFunction(()=>document.querySelector('dialog.whOvcDefaultDialog input')?.disabled===false);assert.equal(await input.inputValue(),'40,00');
 await input.fill('25,50');await save.click();await page.waitForFunction(()=>document.querySelector('dialog.whOvcDefaultDialog [role=status]')?.textContent.includes('salvato'));assert.equal(prices.get(ids[0]).card_price,25.5);assert.equal(prices.get(ids[1]).card_price,null);report.checks.push('Comma decimal saved only to selected service default with revision validation');
 await dialog.locator('header button').click();await page.locator('[data-edit="'+ids[0]+'"]').click();const form=page.locator('#whServiceModal .whOvcDefaultEditor'),finput=form.locator('input'),fsave=form.getByRole('button',{name:'Salva prezzo OVC',exact:true});
 await page.waitForFunction(()=>document.querySelector('#whServiceModal .whOvcDefaultEditor input')?.disabled===false);assert.equal(await finput.inputValue(),'25,50');assert.equal(await page.inputValue('#whsPrice'),'75');
 await page.screenshot({path:OUT+'/service-editor.png'});report.checks.push('Saved default reloads in service Mod. alongside unchanged standard price and VAT');
 await finput.fill('-1');await fsave.click();assert((await form.innerText()).includes('non negativo'));assert.equal(writes.length,1);
 await finput.fill('0');await fsave.click();await page.waitForFunction(()=>document.querySelector('#whServiceModal .whOvcDefaultEditor [role=status]')?.textContent.includes('salvato'));assert.equal(prices.get(ids[0]).card_price,0);
 await finput.fill('');await fsave.click();await page.waitForFunction(()=>document.querySelector('#whServiceModal .whOvcDefaultEditor [role=status]')?.textContent.includes('usa il prezzo standard'));assert.equal(prices.get(ids[0]).card_price,null);report.checks.push('Negative values blocked; zero and blank remain distinct and persist');
 conflict=true;await finput.fill('30');await fsave.click();await page.waitForFunction(()=>document.querySelector('#whServiceModal .whOvcDefaultEditor [role=status]')?.textContent.includes('altro operatore'));assert(await fsave.isDisabled());await form.getByRole('button',{name:'Ricarica',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#whServiceModal .whOvcDefaultEditor input')?.disabled===false);assert.equal(await finput.inputValue(),'');report.checks.push('Concurrent edit conflict blocks retry until explicit reload; no customer override changes');
 await page.click('#whsCancel');await page.click('[data-wh-cat="frames"]');await page.waitForTimeout(700);assert.equal(await page.locator('.whOvcDefaultCell').count(),0);report.checks.push('Other warehouse categories unchanged');report.ok=true;report.live=live;report.writes=writes;
}catch(e){report.error=String(e);if(page)await page.screenshot({path:OUT+'/failure.png'}).catch(()=>{});throw e;}finally{fs.writeFileSync(OUT+'/result.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});

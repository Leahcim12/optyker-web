/* Complete app regression; all customer APIs intercepted and test data synthetic. */
const {chromium}=require('playwright'),fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const OUT='sheet-actions-check';fs.mkdirSync(OUT,{recursive:true});
(async()=>{const browser=await chromium.launch();const report={ok:false,checks:[],errors:[],real_business_writes:0};let page;
try{
 const live=process.env.OPTYKER_LIVE==='1',context=await browser.newContext({viewport:{width:1440,height:1050},serviceWorkers:'block'});page=await context.newPage();page.setDefaultTimeout(10000);
 await context.addInitScript(()=>{window.print=()=>{window.__printTest=true;};});
 const cid='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222',stamp='2026-09-11T10:00:00Z';
 const qid='33333333-3333-4333-8333-333333333333',pid='44444444-4444-4444-8444-444444444444',lacId='55555555-5555-4555-8555-555555555555',orderId='66666666-6666-4666-8666-666666666666';
 const mk=(id,t,data,doc)=>({id,client_id:cid,sheet_type:t,data,document_type:doc||null,operator:'Operatore TEST',title:t,reference_code:t==='eyewear_quote'?'PR-OC-TEST':t==='lac'?'1P26':'PRESCRIZIONE TEST',created_at:stamp,updated_at:stamp});
 const rows=[mk(qid,'eyewear_quote',{mode:'quote',sheetType:'eyewear_quote',documentType:'Preventivo',frame:{type:'Del cliente',brand:'Del cliente',price:0},lens:{lens_type_od:'Monofocale',lens_type_os:'Monofocale',treatments:['Antiriflesso'],unit_price_od:100,unit_price_os:100},pricing:{total:230},notes:'<img src=x onerror=alert(1)> TEST SICUREZZA'},'Preventivo'),mk(pid,'prescription',{sheetType:'prescription',sheetLabel:'Prescrizione',elements:{example:{kind:'value',value:'TEST'}}}),mk(lacId,'lac',{sheetType:'lac',lacState:{document:'Preventivo',brand:'TEST',odProductName:'Ortok',odCost:700}},'Preventivo')];
 const clients=[{id:cid,name:'Cliente',surname:'TEST',email:'test@example.invalid'},{id:other,name:'Altro',surname:'TEST',email:'other@example.invalid'}];const writes=[];let approve=true,delay=0;
 page.on('pageerror',e=>report.errors.push(String(e)));page.on('dialog',d=>approve?d.accept():d.dismiss());
 await context.route('**/*',async route=>{const req=route.request(),url=new URL(req.url());let b={};try{b=req.postDataJSON()||{};}catch{}
  if(url.pathname.includes('/functions/v1/')||url.pathname.includes('/rest/v1/')||req.method()!=='GET'){
   let data={ok:true,data:[],rows:[],clients:[],sheets:[],orders:[],count:0,messages:[]};
   if(url.pathname.includes('optyker-staff-auth'))data={ok:true,username:b.username||'Michael Mologni',needs_password:false,has_email:true};
   else if(url.pathname.endsWith('/optyker_client_sheet_actions')){
    const p=b.p_payload,own=p.client_id===cid?rows:[];
    if(b.p_action==='list'){if(delay)await new Promise(r=>setTimeout(r,delay));data={ok:true,client_id:p.client_id,data:own};}
    else if(b.p_action==='get')data={ok:true,data:own.find(r=>r.id===p.sheet_id)};
    else if(b.p_action==='convert'){
     writes.push(b);assert.equal(p.client_id,cid);assert.equal(p.confirm,true);assert.equal(p.expected_updated_at,stamp);const s=own.find(r=>r.id===p.sheet_id);assert(s);
     if(!s.converted_order){const dest=structuredClone(s);dest.id=orderId;dest.sheet_type='eyewear_job';dest.document_type='Busta';dest.data.mode='job';dest.data.sheetType='eyewear_job';dest.data.documentType='Busta';dest.reference_code='BU-OC-TEST';dest.delete_blocked=true;dest.laboratory_order={id:'LAB-TEST',reference:dest.reference_code,status:'da_fare'};rows.push(dest);s.converted_order={order_sheet_id:orderId,work_order_id:'LAB-TEST',reference:dest.reference_code,status:'da_fare'};s.delete_blocked=true;}
     data={ok:true,data:rows.find(r=>r.id===orderId),order:{id:'LAB-TEST',status:'da_fare'},already_converted:false};
    }else if(b.p_action==='delete'){writes.push(b);assert.equal(p.client_id,cid);assert.equal(p.confirm,true);assert.equal(p.sheet_id,pid);rows.splice(rows.findIndex(r=>r.id===pid),1);data={ok:true,recoverable_copy:true};}
   }else if(url.pathname.endsWith('/optyker_api')){
    if(b.p_action==='list_sheets')data={ok:true,data:b.p_payload.client_id===cid?rows:[]};
    if(b.p_action==='list_clients')data={ok:true,data:clients};
   }else if(url.pathname.endsWith('/optyker_ovc_api'))data={ok:true,data:{client_id:cid,active:true,card_number:1,revision:1}};
   else if(url.pathname.includes('/rest/v1/')&&!url.pathname.includes('/rpc/'))data=[];
   return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
  }
  if(!live&&['www.optyker.it','optyker.it'].includes(url.hostname)){
   let rel=url.pathname.replace(/^\//,'');if(!rel||rel.endsWith('/'))rel+='index.html';const file=path.resolve('_site',rel);
   if(file.startsWith(path.resolve('_site')+path.sep)&&fs.existsSync(file)&&fs.statSync(file).isFile())return route.fulfill({status:200,contentType:({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml'}[path.extname(file)]||'application/octet-stream'),body:fs.readFileSync(file)});
  }return route.continue();
 });
 await page.goto('https://www.optyker.it/',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.OPTYKER_CLIENT_SHEETS?.version==='20260911-client-sheets1');
 const operator=await page.locator('#optykerLoginOperator option').evaluateAll(a=>a.find(x=>/michael/i.test(x.value))?.value);await page.selectOption('#optykerLoginOperator',operator);await page.waitForTimeout(300);await page.fill('#optykerAuthPassword','SYNTHETIC_PASSWORD_NOT_REAL');await page.click('.optykerLoginButton');await page.waitForFunction(()=>window.optykerAuthenticated);
 await page.click('#navClients');await page.evaluate(({clients,cid,rows})=>{OPTYKER_CLOUD.clients=clients;OPTYKER_CLOUD.sheets[cid]=rows;clientSelect(cid);}, {clients,cid,rows});await page.waitForSelector('#clientSheetActionsDock');await page.waitForTimeout(1500);
 assert(await page.locator('#clientSheetActionsDock [data-cs-launch=quotes]').isVisible());assert(await page.locator('#clientSheetActionsDock [data-cs-launch=eyewear]').isVisible());report.checks.push('Anagrafica exposes Preventivi, Occhiali and Gestisci schede buttons');
 await page.click('#clientSheetActionsDock [data-cs-launch=quotes]');await page.waitForSelector('#clientSheetDialog .csRow');assert.equal(await page.locator('#clientSheetDialog .csRow').count(),2);assert.equal(await page.locator('#clientSheetDialog .csQuote h3').first().evaluate(e=>getComputedStyle(e).color),'rgb(180, 35, 50)');report.checks.push('Quotes filtered by current customer and consistently red');
 await page.locator('[data-cs-id="'+qid+'"] [data-cs-open]').click();assert((await page.locator('#clientSheetDialog').textContent()).includes('230,00'));assert.equal(await page.locator('#clientSheetDialog .csDocument img').count(),0);report.checks.push('Saved eyewear quote opens with original details, prices and escaped user text');
 const p=page.waitForEvent('popup');await page.click('[data-cs-print]');const print=await p;await print.waitForLoadState('domcontentloaded');await print.waitForFunction(()=>document.querySelector('.head img')?.complete);
 const expected=await page.evaluate(()=>new DOMParser().parseFromString(prescriptionPrintHtml(),'text/html').querySelector('.head').innerHTML);assert.equal(await print.locator('.head').innerHTML(),expected);assert(await print.locator('.head img').evaluate(i=>i.naturalWidth>0));assert((await print.locator('h1').innerText()).includes('Preventivo'));report.checks.push('Printed quotation reuses exact prescription header and actual embedded logo');await print.close();
 approve=false;await page.click('[data-cs-convert]');assert.equal(writes.length,0);approve=true;await page.click('[data-cs-convert]');await page.waitForFunction(()=>document.querySelector('[data-cs-feedback]')?.textContent.includes('Ordine creato'));assert.equal(writes.length,1);assert.equal(rows.find(r=>r.id===qid).sheet_type,'eyewear_quote');report.checks.push('Conversion requires confirmation and displays linked new laboratory order without changing source quote');
 await page.screenshot({path:OUT+'/order-detail.png'});await page.click('[data-cs-filter=quotes]');await page.locator('[data-cs-id="'+qid+'"] [data-cs-convert]').click();await page.waitForSelector('[data-cs-lab]');assert.equal(writes.length,1);report.checks.push('Repeated Apri ordine opens same order and does not submit a second conversion');
 await page.click('[data-cs-filter=all]');const clinical=page.locator('[data-cs-id="'+pid+'"]');await clinical.locator('[data-cs-open]').click();approve=false;await page.click('[data-cs-delete]');assert.equal(writes.length,1);approve=true;await page.click('[data-cs-delete]');await page.waitForFunction(()=>document.querySelector('[data-cs-feedback]')?.textContent.includes('Scheda eliminata'));assert.equal(writes.length,2);assert.equal(await page.locator('[data-cs-id="'+pid+'"]').count(),0);assert(await page.locator('[data-cs-id="'+orderId+'"] [data-cs-delete]').isDisabled());report.checks.push('Deletion confirms before write, removes only selected sheet, protects linked orders');
 await page.screenshot({path:OUT+'/client-sheets.png'});await page.click('[data-cs-close]');await page.click('#clientPageNav [data-client-page=occhiali]');await page.waitForSelector('#clientSheetDialog .csRow');assert.equal(await page.locator('#clientSheetDialog .csRow').count(),2);report.checks.push('Existing Occhiali navigation button opens actionable saved sheets');
 delay=1200;await page.click('[data-cs-refresh]');await page.evaluate(other=>clientSelect(other),other);await page.waitForTimeout(1800);assert.equal(await page.locator('#clientSheetDialog').count(),0);report.checks.push('Late response cannot display previous customer records after switching customer');
 report.ok=true;report.live=live;
}catch(e){report.error=String(e);if(page)await page.screenshot({path:OUT+'/failure.png'}).catch(()=>{});throw e;}finally{fs.writeFileSync(OUT+'/result.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});

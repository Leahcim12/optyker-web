/* Complete app regression; all customer APIs intercepted and test data synthetic. */
const {chromium}=require('playwright'),fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const OUT='/tmp/optyker-quote-edit-check';fs.mkdirSync(OUT,{recursive:true});
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROME_EXECUTABLE_PATH||undefined});const report={ok:false,checks:[],errors:[],real_business_writes:0};let page;
try{
 const live=false,context=await browser.newContext({viewport:{width:1440,height:1050},serviceWorkers:'block'});page=await context.newPage();page.setDefaultTimeout(10000);
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
   else if(url.pathname.endsWith('/optyker-eyewear-edit-api')){
    writes.push(b);const row=rows.find(r=>r.id===b.payload.edit_sheet_id);assert(row);assert.equal(b.action,'update');assert.equal(b.payload.client_id,cid);assert.equal(b.payload.expected_updated_at,row.updated_at);
    row.data={...row.data,...b.payload};row.updated_at='2026-10-01T08:30:00Z';data={ok:true,data:row};
   }else if(url.pathname.endsWith('/optyker-quotes-api')&&b.action==='save_lac'){
    writes.push(b);const row=rows.find(r=>r.id===lacId);assert.equal(b.client_id,cid);row.data=b.quote_data;row.updated_at='2026-10-01T08:30:00Z';data={ok:true,data:row};
   }else if(url.pathname.endsWith('/optyker_client_sheet_actions')){
    const p=b.p_payload,own=p.client_id===cid?rows:[];
    if(b.p_action==='list'){if(delay)await new Promise(r=>setTimeout(r,delay));data={ok:true,client_id:p.client_id,data:own};}
    else throw Error('Unexpected sheet mutation: '+b.p_action);
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
  }return route.fulfill({status:204,body:''});
 });
 await page.goto('https://www.optyker.it/',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.OPTYKER_CLIENT_SHEETS?.version==='20261001-quote-edit');
 const operator=await page.locator('#optykerLoginOperator option').evaluateAll(a=>a.find(x=>/michael/i.test(x.value))?.value);await page.selectOption('#optykerLoginOperator',operator);await page.waitForTimeout(300);await page.fill('#optykerAuthPassword','SYNTHETIC_PASSWORD_NOT_REAL');await page.click('.optykerLoginButton');await page.waitForFunction(()=>window.optykerAuthenticated);
 await page.click('#navClients');await page.evaluate(({clients,cid,rows})=>{OPTYKER_CLOUD.clients=clients;OPTYKER_CLOUD.sheets[cid]=rows;clientSelect(cid);}, {clients,cid,rows});await page.waitForSelector('#clientSheetActionsDock',{state:'attached'});await page.waitForTimeout(1500);report.errors=[];

 // A direct open has no preceding row click; this was missing the edit action.
 await page.evaluate(qid=>OPTYKER_CLIENT_SHEETS.open('quotes',qid),qid);
 await page.waitForSelector('[data-cs-edit-existing]');
 assert.equal(await page.locator('[data-cs-edit-existing]').textContent(),'Modifica preventivo');
 await page.click('[data-cs-edit-existing]');
 await page.waitForSelector('#optykerExistingSheetEditBar');
 assert.equal(await page.locator('#clientSheetDialog').count(),0);
 assert(await page.locator('#eyewearPanel').isVisible());
 assert.equal(await page.locator('#eyNotes').inputValue(),rows[0].data.notes);
 assert(await page.locator('#eyModeQuote').isDisabled());
 assert(await page.locator('#eyModeJob').isDisabled());
 report.checks.push('Direct quote open renders edit immediately and restores the selected document');
 // Save through the real UI; the network is entirely intercepted.
 await page.evaluate(()=>{document.getElementById('eyNotes').value='Preventivo aggiornato TEST';document.getElementById('eyNotes').dispatchEvent(new Event('input',{bubbles:true}));});
 await page.locator('[data-existing-save]').click();
 await page.waitForFunction(()=>document.getElementById('optykerExistingSheetEditStatus')?.textContent==='Modifiche salvate nello stesso documento.');
 assert.equal(writes.length,1);assert.equal(writes[0].payload.edit_sheet_id,qid);assert.equal(writes[0].payload.notes,'Preventivo aggiornato TEST');assert.equal(writes[0].payload.lens.lens_type_os,'Monofocale');assert.equal(writes[0].payload.lens.unit_price_od,100);assert.equal(writes[0].payload.lens.unit_price_os,100);
 assert.equal(rows.length,3);report.checks.push('Real eyewear save updates the existing quote ID without creating a new document');
 await page.click('[data-existing-back]');
 // The legacy quote shortcut stops propagation before the old editor listener.
 await page.evaluate(qid=>{const b=document.createElement('button');b.dataset.quoteOpen=qid;b.id='testQuoteShortcut';b.textContent='Apri preventivo TEST';document.getElementById('clientsPanel').append(b);},qid);
 await page.click('#testQuoteShortcut');await page.waitForSelector('[data-cs-edit-existing]');
 await page.click('[data-cs-edit-existing]');await page.waitForSelector('#optykerExistingSheetEditBar');
 assert.equal(await page.locator('#eyNotes').inputValue(),'Preventivo aggiornato TEST');
 report.checks.push('Legacy quote shortcut opens the right edit action despite stopped click propagation');
 await page.click('[data-existing-back]');
 // LAC used to route Apri nella scheda back into the same read-only dialog.
 await page.evaluate(lacId=>OPTYKER_CLIENT_SHEETS.open('quotes',lacId),lacId);
 await page.waitForSelector('[data-cs-edit-existing]');
 assert.equal(await page.locator('[data-cs-editor]').count(),0);
 await page.click('[data-cs-edit-existing]');await page.waitForSelector('#lacPanel #optykerExistingSheetEditBar');
 assert.equal(await page.locator('#clientSheetDialog').count(),0);assert(await page.locator('#lacPanel').isVisible());
 await page.click('[data-existing-save]');
 await page.waitForFunction(()=>document.getElementById('optykerExistingSheetEditStatus')?.textContent==='Modifiche salvate nello stesso documento.');
 assert.equal(writes.length,2);assert.equal(writes[1].action,'save_lac');assert.equal(rows.length,3);
 report.checks.push('LAC quotation opens its editor and preserves the quote on save');
 await page.click('[data-existing-back]');
 // Changing the selected record cannot reuse a stale quote's edit callback.
 await page.evaluate(qid=>OPTYKER_CLIENT_SHEETS.open('quotes',qid),qid);await page.waitForSelector('[data-cs-edit-existing]');
 await page.click('[data-cs-back]');await page.locator('[data-cs-id="'+lacId+'"] [data-cs-open]').click();
 await page.click('[data-cs-edit-existing]');await page.waitForSelector('#lacPanel #optykerExistingSheetEditBar');
 assert.match(await page.locator('#optykerExistingSheetEditBar strong').textContent(),/LAC/);
 await page.click('[data-existing-back]');
 rows[0].converted_order={order_sheet_id:'synthetic-order',reference:'B-TEST'};
 await page.evaluate(qid=>OPTYKER_CLIENT_SHEETS.open('quotes',qid),qid);await page.waitForSelector('[data-cs-edit-existing]');
 assert(await page.locator('[data-cs-edit-existing]').isDisabled());
 assert.equal(writes.length,2);report.checks.push('Selected-record context and converted-quote protections remain intact');
 assert.deepEqual(report.errors,[]);report.ok=true;
}catch(e){report.error=String(e);if(page)await page.screenshot({path:OUT+'/failure.png'}).catch(()=>{});throw e;}finally{fs.writeFileSync(OUT+'/result.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});

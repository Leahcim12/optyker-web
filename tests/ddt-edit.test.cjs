/* DDT 20261126: «Modifica» per ogni documento di trasporto dell'archivio.
   Pagina sintetica costruita con gli stessi passi della build (patch_documents_nav, patch_ddt_create,
   apply_ddt_view_20261015, apply_ddt_edit_20261126) e optyker-documents-api simulata: nessun dato reale. */
const fs=require('fs'),os=require('os'),path=require('path'),assert=require('node:assert/strict');
const {execFileSync,spawnSync}=require('child_process');
const {chromium}=require('playwright');
const repo=path.resolve(__dirname,'..');
const ENTRIES=['index.html','gestionale-v2/index.html','gestionale-v3/index.html'];
const API='https://whgziwaegjzqsgcntesr.supabase.co/functions/v1/optyker-documents-api';
const BASE='<!DOCTYPE html><html lang="it"><head><meta charset="utf-8"><title>Optyker</title>'+
  '<style>body{font:13px system-ui,sans-serif;margin:0;background:#f4f7fa}#mainApp{display:grid;grid-template-columns:200px 1fr;gap:12px;padding:12px}#moduleNav{display:flex;flex-direction:column;gap:4px}</style></head>'+
  '<body><div id="mainApp"><div id="moduleNav"><button id="navLaboratory" class="moduleBtn" type="button">Laboratorio</button><button id="navClients" class="moduleBtn" type="button">Clienti</button></div>'+
  '<div id="clientsPanel" class="panel" style="display:block">Clienti</div><div id="labOrdersPanel" class="panel" style="display:none"></div></div></body></html>';

const CLIENTS=[
  {id:'c-1',name:'Mario',surname:'Rossi',vat:'',fiscal:'RSSMRA80A01H501U',street:'Via Roma',street_number:'1',postal_code:'24040',city:'Lallio',province:'BG',email:'mario@example.test',phone:'3331112222',reference_no:'C-001'},
  {id:'c-2',name:'Giulia',surname:'Verdi',vat:'',fiscal:'VRDGLI90B41A794K',street:'Via Bergamo',street_number:'7',postal_code:'24121',city:'Bergamo',province:'BG',email:'',phone:'3405556666',reference_no:'C-002'}
];
const COMPANIES=[
  {id:'co-9',name:'Laboratorio Ottico Srl',vat:'01234567890',fiscal_code:'',address:'Via Milano 5, 24121 Bergamo',active:true},
  {id:'co-7',name:'Fornitore Lenti Spa',vat:'09876543210',fiscal_code:'',address:'Via Torino 9, 20100 Milano',active:true}
];
function fixtures(){return [
  {id:'d1',document_number:'DDT-2026-000037',document_date:'2026-11-20',client_id:'c-1',company_id:null,customer_name:'Rossi Mario',customer_vat:'',customer_fiscal_code:'RSSMRA80A01H501U',
   destination:'Via Roma 1 · 24040 Lallio · BG',reason:'Reso',reason_detail:'Lenti difettose',carrier:'Mittente',packages:1,weight:null,status:'draft',notes:'Fragile',
   items:[{code:'MT-1',description:'Montatura titanio',quantity:1,unit:'pz',lot:''},{code:'LAC-30',description:'Lenti mensili',quantity:6,unit:'pz',lot:'L123'}],
   source_sale_id:null,created_by:'Michael Mologni',created_at:'2026-11-20T09:00:00Z',updated_at:'2026-11-20T09:00:00Z'},
  {id:'d2',document_number:'DDT-2026-000036',document_date:'2026-11-18',client_id:null,company_id:'co-9',customer_name:'Laboratorio Ottico Srl',customer_vat:'01234567890',customer_fiscal_code:'',
   destination:'Via Milano 5, 24121 Bergamo',reason:'Riparazione',reason_detail:'Saldatura ponte',carrier:'BRT',packages:2,weight:1.5,status:'issued',notes:'',
   items:[{code:'',description:'Occhiale cliente da riparare',quantity:1,unit:'pz',lot:''}],created_by:'Giorgia Bono',created_at:'2026-11-18T10:00:00Z',updated_at:'2026-11-19T11:00:00Z'},
  {id:'d3',document_number:'DDT-2026-000035',document_date:'2026-11-10',client_id:null,company_id:null,customer_name:'Bianchi Luca',customer_vat:'',customer_fiscal_code:'',
   destination:'Lallio',reason:'Spedizione speciale',reason_detail:'',carrier:'',packages:1,weight:null,status:'consegnato',notes:'',items:[],
   created_by:'Michael Mologni',created_at:'2026-11-10T08:00:00Z',updated_at:'2026-11-10T08:00:00Z'}
]}

function buildSite(tmp){
  const site=path.join(tmp,'_site');
  for(const d of ['gestionale-v2','gestionale-v3'])fs.mkdirSync(path.join(site,d),{recursive:true});
  fs.mkdirSync(path.join(tmp,'scripts'));
  fs.writeFileSync(path.join(site,'index.html'),BASE);
  // Same order as vercel-build.sh: Documenti and Nuovo DDT on index.html, then the desktop copies, then the later steps.
  execFileSync('python3',[path.join(repo,'scripts','patch_documents_nav.py')],{cwd:tmp});
  execFileSync('python3',[path.join(repo,'scripts','patch_ddt_create.py')],{cwd:tmp});
  for(const rel of ENTRIES.slice(1))fs.copyFileSync(path.join(site,'index.html'),path.join(site,rel));
  execFileSync('python3',[path.join(repo,'scripts','apply_ddt_view_20261015.py')],{cwd:tmp});
  fs.copyFileSync(path.join(repo,'scripts','apply_ddt_edit_20261126.py'),path.join(tmp,'scripts','apply_ddt_edit_20261126.py'));
  fs.copyFileSync(path.join(repo,'ddt-edit.js'),path.join(tmp,'ddt-edit.js'));
  return site
}

(async()=>{
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'ddt-edit-')),site=buildSite(tmp),script=path.join(tmp,'scripts','apply_ddt_edit_20261126.py');
 const count=(s,x)=>s.split(x).length-1;
 // Build step: run twice, one button hook and one deferred loader per desktop entry point.
 execFileSync('python3',[script]);execFileSync('python3',[script]);
 const html=fs.readFileSync(path.join(site,'index.html'),'utf8');
 assert.equal(count(html,'OPTYKER_DDT_EDIT_20261126'),1);
 assert.equal(count(html,'id="optykerDdtEditJs"'),1);
 assert.ok(html.indexOf('id="optykerDdtEditJs"')<html.indexOf('</head>'));
 const src=html.match(/id="optykerDdtEditJs" defer src="\/(ddt-edit\.[0-9a-f]{12}\.js)"/);
 assert.ok(src&&fs.existsSync(path.join(site,src[1])));
 for(const rel of ENTRIES.slice(1))assert.equal(fs.readFileSync(path.join(site,rel),'utf8'),html);
 // A list without «Visualizza / Stampa» stops the build instead of publishing a button bound to nothing.
 fs.writeFileSync(path.join(site,'gestionale-v3/index.html'),html.replace(/\/\* OPTYKER_DDT_EDIT_20261126 \*\/[^\n]*/,'').split("row.querySelector('[data-ddt-view]').onclick=open;").join('row.onclick=open;'));
 const bad=spawnSync('python3',[script],{encoding:'utf8'});
 assert.notEqual(bad.status,0);assert.match(bad.stderr+bad.stdout,/elenco dei documenti di trasporto cambiato in gestionale-v3/);
 fs.writeFileSync(path.join(site,'gestionale-v3/index.html'),html);

 const browser=await chromium.launch({headless:true,...(process.env.CHROME_EXECUTABLE_PATH?{executablePath:process.env.CHROME_EXECUTABLE_PATH}:{})});
 const ctx=await browser.newContext({viewport:{width:1280,height:900},locale:'it-IT',timezoneId:'Europe/Rome'});
 const page=await ctx.newPage(),errors=[],calls=[];let rows=fixtures();
 page.on('pageerror',x=>errors.push(String(x)));
 await page.addInitScript(()=>{window.OPTYKER_CLOUD={username:'Operatore Prova',password:'password-di-prova'}});
 await page.route('https://optyker.test/**',route=>{
   let rel=new URL(route.request().url()).pathname.replace(/^\//,'');if(!rel||rel.endsWith('/'))rel+='index.html';
   const file=path.join(site,rel);
   if(!file.startsWith(site+path.sep)||!fs.existsSync(file))return route.fulfill({status:404,body:''});
   return route.fulfill({status:200,contentType:file.endsWith('.js')?'text/javascript':'text/html',body:fs.readFileSync(file)});
 });
 await page.route(API,async route=>{
   const req=route.request();
   if(req.method()==='OPTIONS')return route.fulfill({status:204,headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'content-type','Access-Control-Allow-Methods':'POST,OPTIONS'}});
   const body=JSON.parse(req.postData()||'{}'),p=body.payload||{};calls.push(body);
   const ok=data=>route.fulfill({status:200,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify({ok:true,data})});
   const fail=(msg)=>route.fulfill({status:400,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify({ok:false,error:msg})});
   if(body.username!=='Operatore Prova'||body.password!=='password-di-prova')return fail('Credenziali non valide');
   if(body.action==='list_ddt')return ok(rows);
   if(body.action==='list_companies')return ok(COMPANIES);
   if(body.action==='list_clients'){const q=String(p.search||'').toLowerCase();return ok(CLIENTS.filter(c=>!q||[c.name,c.surname,c.fiscal].join(' ').toLowerCase().includes(q)))}
   if(body.action==='update_ddt'){
     const i=rows.findIndex(r=>r.id===p.id);if(i<0)return fail('DDT non trovato');
     if(!p.customer_name)return fail("Inserisci il cliente o l'intestatario del DDT.");
     if(!p.destination)return fail('Inserisci la destinazione della merce.');
     if(!Array.isArray(p.items)||!p.items.length)return fail('Inserisci almeno un articolo nel DDT.');
     rows[i]=Object.assign({},rows[i],{document_date:p.document_date,client_id:p.client_id||null,company_id:p.company_id||null,customer_name:p.customer_name,customer_vat:p.customer_vat,
       customer_fiscal_code:p.customer_fiscal_code,destination:p.destination,reason:p.reason,reason_detail:p.reason_detail,carrier:p.carrier,packages:p.packages,
       weight:p.weight===''||p.weight==null?null:Number(p.weight),status:p.status,notes:p.notes,items:p.items,updated_at:'2026-11-26T13:00:00Z'});
     return ok(rows[i])
   }
   if(body.action==='create_ddt'){const r=Object.assign({id:'d'+(rows.length+1),document_number:'DDT-2026-000038',created_by:body.username,created_at:'2026-11-26T13:00:00Z'},p);rows.unshift(r);return ok(r)}
   return fail('Azione non riconosciuta');
 });
 const lastCall=action=>calls.filter(c=>c.action===action).pop();
 const val=id=>page.inputValue('#'+id);
 try{
  await page.goto('https://optyker.test/gestionale-v2/');
  await page.waitForFunction(()=>window.OPTYKER_DDT_EDIT&&window.OPTYKER_DDT_EDIT.version==='20261126-ddt-edit1'&&typeof window.openOptykerDdt==='function');
  await page.evaluate(()=>window.openOptykerDdt());
  await page.waitForSelector('#optykerDdtPanel tbody tr [data-ddt-edit]');
  // One «Modifica» per row, next to «Visualizza / Stampa», on the same line.
  assert.equal(await page.locator('#optykerDdtPanel tbody tr').count(),3);
  assert.deepEqual(await page.$$eval('#optykerDdtPanel tbody tr',trs=>trs.map(tr=>[...tr.cells[tr.cells.length-1].querySelectorAll('button')].map(b=>b.textContent))),
    [['Visualizza / Stampa','Modifica'],['Visualizza / Stampa','Modifica'],['Visualizza / Stampa','Modifica']]);
  const v=await page.locator('#optykerDdtPanel tbody tr').nth(0).locator('[data-ddt-view]').boundingBox(),m=await page.locator('#optykerDdtPanel tbody tr').nth(0).locator('[data-ddt-edit]').boundingBox();
  assert.ok(Math.abs(v.y-m.y)<3&&m.x>v.x,'Modifica on the same line as Visualizza / Stampa');

  // 1) Client DDT: every field filled in from the document; client and number kept; items edited.
  await page.locator('#optykerDdtPanel tbody tr').nth(0).locator('[data-ddt-edit]').click();
  await page.waitForSelector('#optykerDdtEditModal.open');
  assert.equal(await page.textContent('#ddtETitle'),'Modifica DDT-2026-000037');
  assert.match(await page.textContent('#ddtESub'),/Creato da Michael Mologni il 20\/11\/2026/);
  assert.equal(await val('ddtERecipientType'),'client');
  assert.ok(await page.isVisible('#ddtEClientWrap'));assert.ok(!(await page.isVisible('#ddtECompanyWrap')));
  assert.equal(await page.textContent('#ddtEClientLinked'),'Collegato al cliente: Rossi Mario');
  assert.deepEqual([await val('ddtECustomerName'),await val('ddtEFiscal'),await val('ddtEDestination'),await val('ddtEDate'),await val('ddtENumber'),await val('ddtEReason'),
    await val('ddtEReasonDetail'),await val('ddtEStatus'),await val('ddtECarrier'),await val('ddtEPackages'),await val('ddtEWeight'),await val('ddtENotes')],
    ['Rossi Mario','RSSMRA80A01H501U','Via Roma 1 · 24040 Lallio · BG','2026-11-20','DDT-2026-000037','Reso','Lenti difettose','draft','Mittente','1','','Fragile']);
  assert.ok(await page.isDisabled('#ddtENumber'));
  const items=()=>page.$$eval('#ddtEItems .optykerDdtItem',a=>a.map(r=>['code','description','quantity','unit','lotValue'].map(k=>r.querySelector('.'+k).value)));
  assert.deepEqual(await items(),[['MT-1','Montatura titanio','1','pz',''],['LAC-30','Lenti mensili','6','pz','L123']]);
  await page.locator('#ddtEItems .optykerDdtItem').nth(1).locator('.quantity').fill('3');
  await page.click('#ddtEAddItem');
  const added=page.locator('#ddtEItems .optykerDdtItem').nth(2);
  await added.locator('.code').fill('ACC-1');await added.locator('.description').fill('Astuccio rigido');
  await page.locator('#ddtEItems .optykerDdtItem').nth(0).locator('.optykerDdtRemove').click();
  await page.selectOption('#ddtEStatus','issued');await page.fill('#ddtENotes','Fragile, consegnare a mano');await page.fill('#ddtEWeight','0.8');
  await page.click('#ddtESave');
  await page.waitForSelector('#optykerDdtEditModal.open',{state:'detached',timeout:100}).catch(()=>{});
  await page.waitForFunction(()=>!document.querySelector('#optykerDdtEditModal.open'));
  let u=lastCall('update_ddt').payload;
  assert.equal(u.id,'d1');assert.equal(u.client_id,'c-1');assert.equal(u.company_id,'');assert.equal(u.status,'issued');assert.equal(u.weight,'0.8');
  assert.equal(u.document_number,undefined,'the number is never sent');
  assert.deepEqual(u.items,[{code:'LAC-30',description:'Lenti mensili',quantity:3,unit:'pz',lot:'L123'},{code:'ACC-1',description:'Astuccio rigido',quantity:1,unit:'pz',lot:''}]);
  assert.match(await page.textContent('#optykerDdtToast'),/DDT-2026-000037 aggiornato\./);
  // The archive is reloaded and shows the saved document.
  await page.waitForFunction(()=>{const tr=document.querySelector('#optykerDdtPanel tbody tr');return !!tr&&/issued/i.test(tr.cells[5].textContent)});
  assert.equal(calls.filter(c=>c.action==='list_ddt').length>=2,true);

  // 2) Reopen: the saved values come back; change the linked client through the search.
  await page.locator('#optykerDdtPanel tbody tr').nth(0).locator('[data-ddt-edit]').click();
  await page.waitForSelector('#optykerDdtEditModal.open');
  assert.deepEqual(await items(),[['LAC-30','Lenti mensili','3','pz','L123'],['ACC-1','Astuccio rigido','1','pz','']]);
  assert.equal(await val('ddtEWeight'),'0.8');assert.equal(await val('ddtEStatus'),'issued');
  await page.fill('#ddtEClientSearch','verdi');
  await page.waitForSelector('#ddtEClientResults.open [data-ddt-eclient="c-2"]');
  assert.equal(lastCall('list_clients').payload.search,'verdi');
  await page.click('[data-ddt-eclient="c-2"]');
  assert.deepEqual([await val('ddtECustomerName'),await val('ddtEFiscal'),await val('ddtEDestination')],['Verdi Giulia','VRDGLI90B41A794K','Via Bergamo 7 · 24121 Bergamo · BG']);
  assert.equal(await page.textContent('#ddtEClientLinked'),'Collegato al cliente: Verdi Giulia');
  // Escape closes without saving.
  const before=calls.filter(c=>c.action==='update_ddt').length;
  await page.keyboard.press('Escape');
  await page.waitForFunction(()=>!document.querySelector('#optykerDdtEditModal.open'));
  assert.equal(calls.filter(c=>c.action==='update_ddt').length,before);
  // Reopen and save with the new client.
  await page.locator('#optykerDdtPanel tbody tr').nth(0).locator('[data-ddt-edit]').click();
  await page.fill('#ddtEClientSearch','verdi');await page.waitForSelector('[data-ddt-eclient="c-2"]');await page.click('[data-ddt-eclient="c-2"]');
  await page.click('#ddtESave');await page.waitForFunction(()=>!document.querySelector('#optykerDdtEditModal.open'));
  u=lastCall('update_ddt').payload;assert.equal(u.client_id,'c-2');assert.equal(u.customer_name,'Verdi Giulia');

  // 3) Company DDT: the company stays linked; switching to «Manuale» unlinks both.
  await page.locator('#optykerDdtPanel tbody tr').nth(1).locator('[data-ddt-edit]').click();
  await page.waitForSelector('#optykerDdtEditModal.open');
  assert.equal(await val('ddtERecipientType'),'company');
  await page.waitForFunction(()=>document.querySelectorAll('#ddtECompany option').length===3);
  assert.equal(await val('ddtECompany'),'co-9');assert.ok(await page.isVisible('#ddtECompanyWrap'));
  assert.equal(await val('ddtEWeight'),'1.5');assert.equal(await val('ddtEPackages'),'2');
  assert.match(await page.textContent('#ddtESub'),/Creato da Giorgia Bono il 18\/11\/2026 · ultima modifica il 19\/11\/2026/);
  await page.fill('#ddtECarrier','GLS');
  await page.click('#ddtESave');await page.waitForFunction(()=>!document.querySelector('#optykerDdtEditModal.open'));
  u=lastCall('update_ddt').payload;assert.equal(u.company_id,'co-9');assert.equal(u.client_id,'');assert.equal(u.carrier,'GLS');assert.equal(u.packages,2);
  await page.locator('#optykerDdtPanel tbody tr').nth(1).locator('[data-ddt-edit]').click();
  await page.selectOption('#ddtECompany','co-7');
  assert.deepEqual([await val('ddtECustomerName'),await val('ddtEVat'),await val('ddtEDestination')],['Fornitore Lenti Spa','09876543210','Via Torino 9, 20100 Milano']);
  await page.selectOption('#ddtERecipientType','manual');
  assert.ok(!(await page.isVisible('#ddtECompanyWrap'))&&!(await page.isVisible('#ddtEClientWrap')));
  await page.click('#ddtESave');await page.waitForFunction(()=>!document.querySelector('#optykerDdtEditModal.open'));
  u=lastCall('update_ddt').payload;assert.equal(u.company_id,'');assert.equal(u.client_id,'');assert.equal(u.customer_name,'Fornitore Lenti Spa');

  // 4) Manual DDT with a reason and a status outside the lists and no items: kept as they are; at least one item required.
  await page.locator('#optykerDdtPanel tbody tr').nth(2).locator('[data-ddt-edit]').click();
  await page.waitForSelector('#optykerDdtEditModal.open');
  assert.equal(await val('ddtERecipientType'),'manual');assert.equal(await val('ddtEReason'),'Spedizione speciale');assert.equal(await val('ddtEStatus'),'consegnato');
  assert.equal(await page.textContent('#ddtEClientLinked'),'Nessun cliente collegato: cercalo qui sopra per collegarlo.');
  assert.deepEqual(await items(),[['','','1','pz','']]);
  const n=calls.filter(c=>c.action==='update_ddt').length;
  await page.click('#ddtESave');
  assert.match(await page.textContent('#optykerDdtToast'),/Inserisci almeno un articolo\./);
  await page.fill('#ddtEDestination','');await page.locator('#ddtEItems .optykerDdtItem .description').fill('Campione lenti');
  await page.click('#ddtESave');
  assert.match(await page.textContent('#optykerDdtToast'),/Inserisci la destinazione della merce\./);
  assert.equal(calls.filter(c=>c.action==='update_ddt').length,n);assert.ok(await page.isVisible('#optykerDdtEditModal'));
  await page.fill('#ddtEDestination','Via Lallio 3, Lallio');
  await page.click('#ddtESavePrint');
  const popup=await page.waitForEvent('popup');
  await popup.waitForLoadState();
  assert.match(await popup.content(),/DDT-2026-000035[\s\S]*Via Lallio 3, Lallio[\s\S]*Campione lenti/);
  assert.ok(await popup.isVisible('.ddtPreviewToolbar'));await popup.close();
  u=lastCall('update_ddt').payload;assert.equal(u.reason,'Spedizione speciale');assert.equal(u.status,'consegnato');assert.equal(u.client_id,'');assert.equal(u.company_id,'');

  // 5) A server error keeps the window open with the message; text is never markup.
  await page.locator('#optykerDdtPanel tbody tr').nth(2).locator('[data-ddt-edit]').click();
  await page.fill('#ddtECustomerName','<img src=x onerror=window.__injected=1>');
  await page.evaluate(()=>{window.OPTYKER_CLOUD.password='sbagliata'});
  await page.click('#ddtESave');
  await page.waitForFunction(()=>/Modifica DDT non riuscita: Credenziali non valide/.test(document.getElementById('optykerDdtToast').textContent));
  assert.ok(await page.isVisible('#optykerDdtEditModal'));assert.ok(!(await page.isDisabled('#ddtESave')));
  await page.evaluate(()=>{window.OPTYKER_CLOUD.password='password-di-prova'});
  await page.click('#ddtECancel');
  assert.equal(await page.evaluate(()=>window.__injected),undefined);

  // 6) «+ Nuovo DDT» and «Visualizza / Stampa» work as before.
  await page.click('#optykerDdtNewBtn');
  await page.waitForSelector('#optykerDdtCreateModal.open');
  assert.ok(!(await page.isVisible('#optykerDdtEditModal')));
  await page.fill('#ddtCustomerName','Cliente Nuovo');await page.fill('#ddtDestination','Via Nuova 1');
  await page.locator('#ddtItems .optykerDdtItem .description').fill('Montatura');
  await page.click('#ddtSave');
  await page.waitForFunction(()=>!document.querySelector('#optykerDdtCreateModal.open'));
  assert.equal(lastCall('create_ddt').payload.customer_name,'Cliente Nuovo');
  await page.waitForFunction(()=>document.querySelectorAll('#optykerDdtPanel tbody tr').length===4);
  const [view]=await Promise.all([page.waitForEvent('popup'),page.locator('#optykerDdtPanel tbody tr').nth(0).locator('[data-ddt-view]').click()]);
  await view.waitForLoadState();assert.match(await view.content(),/DDT-2026-000038/);await view.close();
  await page.locator('#optykerDdtPanel tbody tr').nth(0).locator('[data-ddt-edit]').click();
  assert.equal(await page.textContent('#ddtETitle'),'Modifica DDT-2026-000038');
  await page.click('#ddtEClose');

  if(process.env.DDT_EDIT_SCREENSHOT){
    await page.locator('#optykerDdtPanel tbody tr').nth(1).locator('[data-ddt-edit]').click();
    await page.screenshot({path:process.env.DDT_EDIT_SCREENSHOT,fullPage:false});
    await page.click('#ddtEClose');
  }
  // Phone width: the window still fits and saves.
  await page.setViewportSize({width:390,height:844});
  await page.locator('#optykerDdtPanel tbody tr').nth(1).locator('[data-ddt-edit]').click();
  const card=await page.locator('#optykerDdtEditModal .optykerDdtCard').boundingBox();
  assert.ok(card.x>=0&&card.x+card.width<=390+1,'edit window fits a phone');
  await page.click('#ddtECancel');
  assert.deepEqual(errors,[]);
  console.log('DDT: Modifica verificata (dati del documento, articoli, cliente, ditta, manuale, errori, stampa, Nuovo DDT invariato)');
 }finally{await browser.close();fs.rmSync(tmp,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exit(1)});

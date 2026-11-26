/* Report 20261126: «Visite senza scheda» (verde fino a 7 giorni, arancione fino a 14, rosso oltre; Elimina/Ripristina).
   Pagina sintetica con il passo di build apply_report_20261014.py e le RPC optyker_report_api e
   optyker_visit_followup_api simulate: nessun dato reale letto o scritto. */
const fs=require('fs'),os=require('os'),path=require('path'),assert=require('node:assert/strict');
const {execFileSync}=require('child_process');
const {chromium}=require('playwright');
const repo=path.resolve(__dirname,'..');
const ENTRIES=['index.html','gestionale-v2/index.html','gestionale-v3/index.html'];
const RPC='https://whgziwaegjzqsgcntesr.supabase.co/rest/v1/rpc/';
const PAGE='<!DOCTYPE html><html lang="it"><head><meta charset="utf-8"><title>Optyker</title>'+
  '<style>body{font:13px system-ui,sans-serif;margin:0;background:#f4f7fa}#mainApp{display:grid;grid-template-columns:210px 1fr;gap:12px;padding:12px}#moduleNav{display:flex;flex-direction:column;gap:4px;grid-row:1/9}.moduleBtn{height:36px}@media(max-width:760px){#mainApp{grid-template-columns:1fr;padding:0}#moduleNav{grid-row:auto;flex-direction:row;overflow:auto}}</style></head>'+
  '<body><div id="mainApp"><div id="moduleNav"><button id="navDashboard" class="moduleBtn" type="button">Dashboard</button><button id="navClients" class="moduleBtn" type="button">Clienti</button><button id="navSettings" class="moduleBtn" type="button">Impostazioni</button></div>'+
  '<div id="dashboardPanel" class="panel" style="display:block">Dashboard</div><div id="clientsPanel" class="panel" style="display:none">Clienti</div></div>'+
  '<script>window.__opened=[];window.showModule=function(m){window.__opened.push("module:"+m);document.getElementById("clientsPanel").style.display="block"};window.clientSelect=function(id){window.__opened.push("client:"+id)};window.cloudFindClient=function(){return true};</script></body></html>';

const DAY=24*3600e3;
function iso(daysAgo,h){const d=new Date(Date.now()-daysAgo*DAY);d.setUTCHours(h==null?9:h,30,0,0);return d.toISOString()}
function day(daysAgo){return new Date(Date.now()-daysAgo*DAY+2*3600e3).toISOString().slice(0,10)}
function visits(){return [
  {person_key:'c:a',client_id:'a',linked:true,match:'agenda',name:'Anna',surname:'Rossi',phone:'3331112222',home_phone:'',other_phone:'',email:'anna@example.test',birth:'1990-04-02',city:'Lallio',client_ref:'C-0101',
   appointment_id:'ap1',visit_at:iso(0),visit_day:day(0),days:0,color:'green',service:'Analisi Visiva',operator:'Michael Mologni',earlier:[],quote:null,next:null,dismissed:false,dismissed_by:'',dismissed_at:null},
  {person_key:'p:331234567:bianchi:luca',client_id:null,linked:false,match:'',name:'Luca',surname:'Bianchi',phone:'331 234 5678',home_phone:'',other_phone:'',email:'',birth:'',city:'',client_ref:'',
   appointment_id:'ap2',visit_at:iso(1),visit_day:day(1),days:1,color:'green',service:'Visita specialistica per lenti a contatto',operator:'Giorgia Bono',earlier:[],quote:null,next:null,dismissed:false,dismissed_by:'',dismissed_at:null},
  {person_key:'c:b',client_id:'b',linked:true,match:'telefono',name:'Carla',surname:'Verdi',phone:'3405556666',home_phone:'035123456',other_phone:'3209998888',email:'',birth:'',city:'Bergamo',client_ref:'',
   appointment_id:'ap3',visit_at:iso(7),visit_day:day(7),days:7,color:'green',service:'Analisi Visiva',operator:'Diego Panseri',earlier:[{id:'ap0',day:day(12),service:'Visita specialistica per lenti a contatto'}],
   quote:{kind:'eyewear_quote',day:day(6)},next:{at:iso(-7,10),service:'Analisi Visiva'},dismissed:false,dismissed_by:'',dismissed_at:null},
  {person_key:'c:c',client_id:'c',linked:true,match:'agenda',name:'Dario',surname:'Neri',phone:'',home_phone:'',other_phone:'',email:'dario@example.test',birth:'',city:'',client_ref:'',
   appointment_id:'ap4',visit_at:iso(8),visit_day:day(8),days:8,color:'orange',service:'Analisi Visiva',operator:'',earlier:[],quote:{kind:'lac_quote',day:day(8)},next:null,dismissed:false,dismissed_by:'',dismissed_at:null},
  {person_key:'c:d',client_id:'d',linked:true,match:'nome',name:'Elena',surname:'Gialli',phone:'3478889999',home_phone:'',other_phone:'',email:'',birth:'',city:'',client_ref:'',
   appointment_id:'ap5',visit_at:iso(14),visit_day:day(14),days:14,color:'orange',service:'Visita specialistica per lenti a contatto',operator:'Michael Mologni',earlier:[],quote:null,next:null,dismissed:false,dismissed_by:'',dismissed_at:null},
  {person_key:'c:e',client_id:'e',linked:true,match:'agenda',name:'Franco',surname:'Blu',phone:'3381234567',home_phone:'',other_phone:'',email:'',birth:'',city:'',client_ref:'',
   appointment_id:'ap6',visit_at:iso(15),visit_day:day(15),days:15,color:'red',service:'Analisi Visiva',operator:'Michael Mologni',earlier:[],quote:null,next:null,dismissed:false,dismissed_by:'',dismissed_at:null},
  {person_key:'n:x:y',client_id:null,linked:false,match:'',name:'<img src=x onerror=window.__injected=1>',surname:'Zeta',phone:'',home_phone:'',other_phone:'',email:'',birth:'',city:'',client_ref:'',
   appointment_id:'ap7',visit_at:iso(40),visit_day:day(40),days:40,color:'red',service:'Visita specialistica per lenti a contatto',operator:'Giorgia Bono',earlier:[],quote:null,next:null,dismissed:false,dismissed_by:'',dismissed_at:null},
  {person_key:'c:f',client_id:'f',linked:true,match:'agenda',name:'Gina',surname:'Viola',phone:'3391112233',home_phone:'',other_phone:'',email:'',birth:'',city:'',client_ref:'',
   appointment_id:'ap8',visit_at:iso(20),visit_day:day(20),days:20,color:'red',service:'Analisi Visiva',operator:'Michael Mologni',earlier:[],quote:null,next:null,dismissed:true,dismissed_by:'Giorgia Bono',dismissed_at:iso(2,15)}
].sort((a,b)=>b.visit_at.localeCompare(a.visit_at))}

(async()=>{
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'report-visits-')),site=path.join(tmp,'_site');
 for(const d of ['gestionale-v2','gestionale-v3'])fs.mkdirSync(path.join(site,d),{recursive:true});
 for(const rel of ENTRIES)fs.writeFileSync(path.join(site,rel),PAGE);
 // Build step: new version in the page, the same in the three desktop entry points.
 execFileSync('python3',[path.join(repo,'scripts','apply_report_20261014.py'),site]);
 execFileSync('python3',[path.join(repo,'scripts','apply_report_20261014.py'),site]);
 const html=fs.readFileSync(path.join(site,'index.html'),'utf8');
 assert.equal(html.split('optyker-report.js?v=20261126-visits1').length-1,1);
 assert.equal(html.split('optyker-report.css?v=20261126-visits1').length-1,1);
 for(const rel of ENTRIES.slice(1))assert.equal(fs.readFileSync(path.join(site,rel),'utf8'),html);
 assert.equal(JSON.parse(fs.readFileSync(path.join(site,'report-20261014-version.json'),'utf8')).report,'20261126-visits1');

 const browser=await chromium.launch({headless:true,...(process.env.CHROME_EXECUTABLE_PATH?{executablePath:process.env.CHROME_EXECUTABLE_PATH}:{})});
 const ctx=await browser.newContext({viewport:{width:1366,height:900},locale:'it-IT',timezoneId:'Europe/Rome',acceptDownloads:true});
 const page=await ctx.newPage(),errors=[],calls=[];let rows=visits();
 page.on('pageerror',x=>errors.push(String(x)));
 await page.addInitScript(()=>{window.OPTYKER_CLOUD={username:'Operatore Prova',password:'password-di-prova'}});
 await page.route('https://optyker.test/**',route=>{
   let rel=new URL(route.request().url()).pathname.replace(/^\//,'');if(!rel||rel.endsWith('/'))rel+='index.html';
   const file=path.join(site,rel);
   if(!file.startsWith(site+path.sep)||!fs.existsSync(file))return route.fulfill({status:404,body:''});
   const type=file.endsWith('.js')?'text/javascript':(file.endsWith('.css')?'text/css':'text/html');
   return route.fulfill({status:200,contentType:type,body:fs.readFileSync(file)});
 });
 const CORS={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'POST,OPTIONS'};
 await page.route(RPC+'**',async route=>{
   const req=route.request();
   if(req.method()==='OPTIONS')return route.fulfill({status:204,headers:CORS});
   const fn=new URL(req.url()).pathname.split('/').pop(),b=JSON.parse(req.postData()||'{}'),p=b.p_payload||{};
   calls.push({fn,action:b.p_action,payload:p,apikey:req.headers()['apikey']});
   const reply=x=>route.fulfill({status:200,contentType:'application/json',headers:CORS,body:JSON.stringify(x)});
   if(b.p_username!=='Operatore Prova'||b.p_password!=='password-di-prova')return reply({ok:false,auth:false,error:'Credenziali non valide'});
   if(fn==='optyker_report_api'){
     if(b.p_action==='overview')return reply({ok:true,data:{year:p.year,month:p.month,today:{},recalls:{lac_reorder:{pending:1,called:0},vision:{pending:2,called:1},lac_control:{pending:0,called:0},hearing:{pending:0,called:0}},stock:{items:12,pieces:30}}});
     if(b.p_action==='recalls')return reply({ok:true,data:{type:p.type,year:p.year,month:p.month,rows:[],months:[]}});
     return reply({ok:false,error:'Azione non riconosciuta'});
   }
   if(fn==='optyker_visit_followup_api'){
     if(b.p_action==='summary'){const pend=rows.filter(r=>!r.dismissed);return reply({ok:true,data:{pending:pend.length,green:pend.filter(r=>r.color==='green').length,orange:pend.filter(r=>r.color==='orange').length,red:pend.filter(r=>r.color==='red').length,dismissed:rows.length-pend.length}})}
     if(b.p_action==='list')return reply({ok:true,data:{today:day(0),rows:JSON.parse(JSON.stringify(rows))}});
     const r=rows.find(x=>x.person_key===p.person_key);
     if(!r)return reply({ok:false,error:'Il cliente non è più nell\'elenco: premi Aggiorna.'});
     if(b.p_action==='dismiss'){r.dismissed=true;r.dismissed_by=b.p_username;r.dismissed_at=new Date().toISOString();return reply({ok:true,data:{person_key:r.person_key,dismissed_by:r.dismissed_by,dismissed_at:r.dismissed_at}})}
     if(b.p_action==='restore'){r.dismissed=false;r.dismissed_by='';r.dismissed_at=null;return reply({ok:true,data:{person_key:r.person_key,restored:1}})}
   }
   return reply({ok:false,error:'Azione non riconosciuta'});
 });
 const vcalls=a=>calls.filter(c=>c.fn==='optyker_visit_followup_api'&&c.action===a);
 const rowSel='#orpVBody .orpVRow';
 const listed=()=>page.$$eval(rowSel,a=>a.map(r=>({key:r.getAttribute('data-orp-vkey'),color:['green','orange','red'].find(c=>r.classList.contains(c)),days:r.querySelector('.orpVDays').textContent,
   name:r.querySelector('.orpName').textContent,linkBtn:!!r.querySelector('.orpActions [data-orp-client]'),meta:(r.querySelector('.orpMeta')||{}).textContent||'',why:r.querySelector('.orpWhy').textContent,
   contacts:r.querySelector('.orpContacts').textContent})));
 try{
  await page.goto('https://optyker.test/gestionale-v3/');
  await page.waitForFunction(()=>window.OPTYKER_REPORT&&window.OPTYKER_REPORT.version==='20261126-visits1'&&!!document.getElementById('navReport'));
  await page.click('#navReport');
  // Home: the new card under «Dopo la visita», with the pending count split by colour.
  await page.waitForSelector('#orpOpenVisits .orpCardNum');
  await page.waitForFunction(()=>document.querySelector('#orpOpenVisits .orpCardNum').textContent==='7');
  assert.equal(await page.textContent('#orpOpenVisits .orpCardTitle'),'Visite senza scheda');
  assert.equal(await page.textContent('#orpOpenVisits .orpCardFoot'),'3 verdi2 arancioni2 rossi');
  assert.deepEqual(await page.$$eval('.orpSection',a=>a.map(x=>x.textContent.replace(/ di .*/,''))),['Richiami','Dopo la visita','Magazzino']);
  assert.equal(await page.textContent('[data-orp-type="vision"] .orpCardNum'),'2');
  assert.ok(vcalls('summary').length>=1);assert.equal(calls.find(c=>c.fn==='optyker_visit_followup_api').apikey,'sb_publishable_DndhLvY32YeCmqWMNRi30g_dEDm8upv');
  if(process.env.REPORT_VISITS_SCREENSHOT)await page.screenshot({path:process.env.REPORT_VISITS_SCREENSHOT.replace(/\.png$/,'-home.png')});

  // List: one row per person, most recent visit first, colour from the days since the visit.
  await page.click('#orpOpenVisits');
  await page.waitForSelector(rowSel);
  assert.equal(await page.textContent('h1.orpTitle'),'Visite senza scheda');
  assert.deepEqual(await page.$$eval('[data-orp-vtab]',a=>a.map(b=>b.textContent)),['Da seguire 7','Eliminati 1']);
  let L=await listed();
  assert.deepEqual(L.map(r=>[r.key,r.color,r.days]),[['c:a','green','Oggi'],['p:331234567:bianchi:luca','green','Ieri'],['c:b','green','7 giorni fa'],['c:c','orange','8 giorni fa'],
    ['c:d','orange','14 giorni fa'],['c:e','red','15 giorni fa'],['n:x:y','red','40 giorni fa']]);
  assert.deepEqual(await page.$$eval('[data-orp-vcolor]',a=>a.map(b=>b.textContent.replace(/\s+/g,' ').trim())),['Tutti 7','Verde fino a 7 giorni 3','Arancione da 8 a 14 giorni 2','Rosso oltre 14 giorni 2']);
  const css=await page.$eval(rowSel+'.red',r=>getComputedStyle(r).borderLeftColor);assert.equal(css,'rgb(180, 35, 24)');
  assert.equal(await page.$eval(rowSel+'.green',r=>getComputedStyle(r).borderLeftColor),'rgb(31, 122, 63)');
  assert.equal(await page.$eval(rowSel+'.orange',r=>getComputedStyle(r).borderLeftColor),'rgb(180, 83, 9)');
  // Linked client: name opens the client; extra lines for other visits, quote and next appointment; all phones.
  const carla=L.find(r=>r.key==='c:b');
  assert.equal(carla.name,'Verdi Carla');assert.ok(carla.linkBtn);assert.match(carla.meta,/Bergamo · riconosciuto dal telefono/);
  assert.match(carla.why,/Analisi visiva del \d{2}\/\d{2}\/2026 alle \d{2}:30 · Diego Panseri/);
  assert.match(carla.why,/Anche Visita specialistica lenti a contatto del \d{2}\/\d{2}\/2026/);
  assert.match(carla.why,/Preventivo occhiali del \d{2}\/\d{2}\/2026/);
  assert.match(carla.why,/Prossimo appuntamento \d{2}\/\d{2}\/2026 alle \d{2}:30 · Analisi Visiva/);
  assert.equal(carla.contacts,'340 555 6666035123456320 999 8888');
  const dario=L.find(r=>r.key==='c:c');assert.match(dario.why,/Preventivo lenti a contatto del/);assert.match(dario.contacts,/Nessun telefono.*dario@example\.test/);
  // Not in the client archive: data from the appointment, no client button; names are text, never markup.
  const luca=L.find(r=>r.key==='p:331234567:bianchi:luca');
  assert.equal(luca.meta,'Non in anagrafica · dati dell’appuntamento');assert.ok(!luca.linkBtn);
  assert.equal(await page.$eval('[data-orp-vkey="p:331234567:bianchi:luca"] .orpName',n=>n.tagName),'SPAN');
  assert.match(luca.why,/Visita specialistica lenti a contatto del .* · Giorgia Bono/);
  assert.equal(L.find(r=>r.key==='n:x:y').name,'Zeta <img src=x onerror=window.__injected=1>');
  assert.equal(await page.$$eval(rowSel+' img',a=>a.length),0);assert.equal(await page.evaluate(()=>window.__injected),undefined);
  if(process.env.REPORT_VISITS_SCREENSHOT)await page.screenshot({path:process.env.REPORT_VISITS_SCREENSHOT,fullPage:true});

  // Colour filter and search.
  await page.click('[data-orp-vcolor="orange"]');
  assert.deepEqual((await listed()).map(r=>r.key),['c:c','c:d']);
  await page.click('[data-orp-vcolor="red"]');
  assert.deepEqual((await listed()).map(r=>r.key),['c:e','n:x:y']);
  await page.fill('#orpVSearch','zeta');assert.deepEqual((await listed()).map(r=>r.key),['n:x:y']);
  await page.fill('#orpVSearch','347');assert.equal(await page.textContent('#orpVBody'),'Nessun cliente corrisponde alla ricerca.');
  await page.click('[data-orp-vcolor=""]');assert.deepEqual((await listed()).map(r=>r.key),['c:d']);
  await page.fill('#orpVSearch','');
  assert.equal((await listed()).length,7);

  // Elimina: off the list for everyone, with Annulla; then Ripristina from «Eliminati».
  await page.click('[data-orp-vkey="c:e"] [data-orp-vdismiss]');
  await page.waitForFunction(()=>!document.querySelector('#orpVBody [data-orp-vkey="c:e"]'));
  assert.equal(vcalls('dismiss').pop().payload.person_key,'c:e');
  assert.deepEqual(await page.$$eval('[data-orp-vtab]',a=>a.map(b=>b.textContent)),['Da seguire 6','Eliminati 2']);
  assert.match(await page.textContent('#orpToast'),/Blu Franco eliminato dalla lista\.Annulla/);
  await page.click('#orpToast button');
  await page.waitForSelector('#orpVBody [data-orp-vkey="c:e"]');
  assert.equal(vcalls('restore').pop().payload.person_key,'c:e');
  await page.click('[data-orp-vkey="n:x:y"] [data-orp-vdismiss]');
  await page.waitForFunction(()=>!document.querySelector('#orpVBody [data-orp-vkey="n:x:y"]'));
  await page.click('[data-orp-vtab="dismissed"]');
  L=await listed();
  assert.deepEqual(L.map(r=>r.key),['c:f','n:x:y']);
  assert.match(L[0].why,/Eliminato dalla lista da Giorgia Bono il \d{2}\/\d{2}\/2026 alle 1[56]:30/);
  assert.match(L[1].why,/Eliminato dalla lista da Operatore Prova il/);
  assert.equal(await page.$$eval(rowSel+' [data-orp-vdismiss]',a=>a.length),0);
  await page.click('[data-orp-vkey="c:f"] [data-orp-vrestore]');
  await page.waitForFunction(()=>!document.querySelector('#orpVBody [data-orp-vkey="c:f"]'));
  assert.match(await page.textContent('#orpToast'),/Viola Gina è di nuovo nella lista\./);
  assert.deepEqual(await page.$$eval('[data-orp-vtab]',a=>a.map(b=>b.textContent)),['Da seguire 7','Eliminati 1']);
  await page.click('[data-orp-vtab="pending"]');
  assert.ok((await listed()).some(r=>r.key==='c:f'&&r.color==='red'));
  // A failed call keeps the row and says why (expired session; client no longer in the list on the server).
  await page.evaluate(()=>{window.OPTYKER_CLOUD.password='sbagliata'});
  await page.click('[data-orp-vkey="c:a"] [data-orp-vdismiss]');
  await page.waitForFunction(()=>/Non eliminato: sessione scaduta, esci e accedi di nuovo\./.test(document.getElementById('orpToast').textContent));
  assert.ok(await page.isVisible('[data-orp-vkey="c:a"]'));assert.equal(await page.textContent('[data-orp-vkey="c:a"] [data-orp-vdismiss]'),'Elimina');
  await page.evaluate(()=>{window.OPTYKER_CLOUD.password='password-di-prova'});
  const gone=rows.splice(rows.findIndex(r=>r.person_key==='c:d'),1)[0];
  await page.click('[data-orp-vkey="c:d"] [data-orp-vdismiss]');
  await page.waitForFunction(()=>/Non eliminato: Il cliente non è più nell'elenco: premi Aggiorna\./.test(document.getElementById('orpToast').textContent));
  assert.ok(await page.isVisible('[data-orp-vkey="c:d"]'));
  rows.push(gone);rows.sort((a,b)=>b.visit_at.localeCompare(a.visit_at));

  // Excel of the whole list.
  const [dl]=await Promise.all([page.waitForEvent('download'),page.click('#orpVXlsx')]);
  assert.match(dl.suggestedFilename(),/^Visite senza scheda \d{4}-\d{2}-\d{2}\.xlsx$/);
  const xlsx=path.join(tmp,'visite.xlsx');await dl.saveAs(xlsx);
  const sheet=execFileSync('python3',['-c','import zipfile,sys;print(zipfile.ZipFile(sys.argv[1]).read("xl/worksheets/sheet1.xml").decode())',xlsx]).toString();
  for(const t of ['Cliente','Giorni','Colore','Prossimo appuntamento','Bianchi Luca','Non in anagrafica','Arancione','Eliminato','Operatore Prova'].filter(t=>t!=='Non in anagrafica'))assert.ok(sheet.includes(t),'xlsx contains '+t);

  // Opening a client from the list; back to the Report home with the updated count; the recalls still open.
  await page.click('[data-orp-vkey="c:a"] .orpActions [data-orp-client]');
  await page.waitForFunction(()=>window.__opened.indexOf('client:a')>=0);
  await page.click('#navReport');
  await page.waitForFunction(()=>document.querySelector('#orpOpenVisits .orpCardNum')&&document.querySelector('#orpOpenVisits .orpCardNum').textContent==='7');
  assert.equal(await page.textContent('#orpOpenVisits .orpCardFoot'),'3 verdi2 arancioni2 rossi');
  await page.click('[data-orp-type="vision"]');
  await page.waitForFunction(()=>/Analisi visive/.test(document.querySelector('h1.orpTitle').textContent));
  assert.equal(calls.filter(c=>c.fn==='optyker_report_api'&&c.action==='recalls').pop().payload.type,'vision');
  await page.click('#orpBack');

  // Phone width: the list stays readable, one row under the other.
  await page.setViewportSize({width:390,height:844});
  await page.click('#orpOpenVisits');await page.waitForSelector(rowSel);
  const boxes=await page.$$eval(rowSel,a=>a.slice(0,2).map(r=>{const b=r.getBoundingClientRect();return [b.left,b.right,b.top]}));
  assert.ok(boxes[0][0]>=0&&boxes[0][1]<=391&&boxes[1][2]>boxes[0][2],'phone rows '+JSON.stringify(boxes));
  assert.ok(await page.$eval('#orpRoot',r=>r.scrollWidth<=r.clientWidth+1),'no horizontal overflow on phones');
  if(process.env.REPORT_VISITS_SCREENSHOT)await page.screenshot({path:process.env.REPORT_VISITS_SCREENSHOT.replace(/\.png$/,'-phone.png')});
  assert.deepEqual(errors,[]);
  console.log('Report: Visite senza scheda verificate (colori, filtri, ricerca, Elimina/Annulla/Ripristina, Excel, cliente, telefono)');
 }finally{await browser.close();fs.rmSync(tmp,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exit(1)});

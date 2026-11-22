/* Scheda LAC 20261121: «Numero d'ordine» per lente DX e SX e righe nel modulo riepilogativo.
   Synthetic page with the production markup of the LAC trace card (same anchor used by the build) and the
   same summary structure as lacOpenSummary; no real clients or sheets are read or written. */
const fs=require('fs'),os=require('os'),path=require('path'),assert=require('node:assert/strict');
const {execFileSync,spawnSync}=require('child_process');
const {chromium}=require('playwright');
const repo=path.resolve(__dirname,'..');

const field=(id,label,ph)=>'<div class="lacTraceField"><label for="'+id+'">'+label+'</label><input id="'+id+'" type="text" placeholder="'+ph+'"></div>';
const eye=(k,side,title)=>'<div class="lacTraceEye"><div class="lacTraceEyeTitle">'+title+'</div><div class="lacTraceFields">'
  +field('lac'+k+'Color','Colore lente '+side,'Es. blu, verde, trasparente...')+field('lac'+k+'Lot','Lotto lente '+side,'Numero / codice lotto')+'</div></div>';
const DATES='<div class="lacTraceDates"><div class="lacTraceField"><label for="lacReorderRecallDate">Data richiamo scheda per riordino</label><input id="lacReorderRecallDate" type="date"></div>'
  +'<!-- OPTYKER_LAC_PEROXIDE_20261108 --><div class="lacTraceField lacPeroxideField"><label for="lacPeroxide" style="display:flex;align-items:center;gap:8px;cursor:pointer"><input id="lacPeroxide" type="checkbox" style="width:auto;margin:0"> Perossido</label><small style="display:block;opacity:.7">Manutenzione con perossido: su WhatsApp il cliente riceve le istruzioni Perossido</small></div>'
  +'<div class="lacTraceField"><label for="lacControlDate">Data controllo</label><input id="lacControlDate" type="date"></div></div>';
const CSS='body{font:13px system-ui,sans-serif;margin:16px;color:#1e455f;background:#fff}label{display:block}input[type=text],input[type=date]{width:100%;box-sizing:border-box;padding:7px 9px;border:1px solid #cfdbe5;border-radius:8px;font:inherit}'
  +'.lacProductTraceCard{max-width:860px;margin-top:14px;border:1px solid #cfdce7;border-radius:12px;background:#f9fcfe;overflow:hidden}.lacProductTraceHead{padding:11px 13px;background:#eef6fb;border-bottom:1px solid #dce7ef}'
  +'.lacProductTraceTitle{font-size:12px;font-weight:900;color:#1e455f}.lacProductTraceText{font-size:9px;color:#6e8292;margin-top:3px;line-height:1.4}'
  +'.lacProductTraceGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;padding:13px}.lacTraceEye{border:1px solid #dce5ec;border-radius:9px;background:#fff;padding:10px}'
  +'.lacTraceEyeTitle{font-size:10px;font-weight:900;color:#1769aa;margin-bottom:8px}.lacTraceFields{display:grid;grid-template-columns:1fr 1fr;gap:8px}'
  +'.lacTraceDates{display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:0 13px 13px}.lacTraceDates>div{border:1px solid #dce5ec;border-radius:9px;background:#fff;padding:10px}'
  +'.lacTraceField label{font-size:9px;font-weight:850;color:#657b8c;margin-bottom:4px}@media(max-width:760px){.lacProductTraceGrid,.lacTraceDates,.lacTraceFields{grid-template-columns:1fr}}';
// Same section/row markup and trace list as buildSummary in the desktop page; a module wraps lacOpenSummary
// and reads the summary in a timer, as the Laboratorio order does with summary_html.
const APP=`function e(id){return document.getElementById(id)}
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function pv(id){var x=e(id);return x?String(x.value||'').trim():''}
function dateIt(v){if(!v)return '';var m=String(v).match(/^(\\d{4})-(\\d{2})-(\\d{2})$/);return m?m[3]+'/'+m[2]+'/'+m[1]:v}
function rowHtml(x){return '<div class="lacSummaryRow"><div class="lacSummaryRowLabel">'+esc(x.label)+'</div><div class="lacSummaryRowValue">'+esc(x.value)+'</div></div>'}
function sectionHtml(t,a){if(!a.length)return '';return '<section class="lacSummarySection"><div class="lacSummarySectionHead">'+esc(t)+'</div><div class="lacSummaryRows">'+a.map(rowHtml).join('')+'</div></section>'}
function buildSummary(){var prod='<section class="lacSummarySection"><div class="lacSummarySectionHead">Prodotto e costo</div><div class="lacSummaryRows">'+rowHtml({label:'Documento',value:'Busta'})+'</div><div class="lacSummaryProductGrid"></div></section>';
  var trace=[{label:'Colore lente DX',value:pv('lacOdColor')},{label:'Lotto lente DX',value:pv('lacOdLot')},{label:'Colore lente SX',value:pv('lacOsColor')},{label:'Lotto lente SX',value:pv('lacOsLot')},{label:'Data richiamo per riordino',value:dateIt(pv('lacReorderRecallDate'))},{label:'Data controllo',value:dateIt(pv('lacControlDate'))}].filter(function(x){return !!x.value});
  return prod+sectionHtml('Identificazione lenti e richiami',trace)+sectionHtml('Dati generali',[{label:'Nome',value:'Cliente Sintetico'}])}
window.lacOpenSummary=function(){e('lacSummaryBody').innerHTML=buildSummary();e('lacSummaryOverlay').className='lacSummaryOverlay open'};
window.lacPrintSummary=function(){var shell='<html><head><title>Riepilogo</title></head><body>';window.__printed=shell+e('lacSummaryBody').innerHTML};
window.lacResetAll=function(){var f=e('lacPanel').querySelectorAll('input,textarea,select'),i;for(i=0;i<f.length;i++){if(f[i].type==='checkbox')f[i].checked=false;else f[i].value=''}};
(function(){var old=window.lacOpenSummary;window.lacOpenSummary=function(){var r=old.apply(this,arguments);window.__labSummaryHtml=undefined;setTimeout(function(){window.__labSummaryHtml=e('lacSummaryBody').innerHTML},0);return r}})();`;
const PAGE='<!DOCTYPE html><html lang="it"><head><meta charset="utf-8"><title>Optyker</title><style>'+CSS+'</style></head><body>'
  +'<div id="lacPanel" class="panel"><div id="lacProductView"><div class="lacProductTraceCard"><div class="lacProductTraceHead"><div class="lacProductTraceTitle">Identificazione lenti e richiami</div>'
  +'<div class="lacProductTraceText">Completa colore e lotto di ciascuna lente, poi indica quando richiamare il cliente per il riordino e quando effettuare il controllo.</div></div>'
  +'<div class="lacProductTraceGrid">'+eye('Od','DX','OD · Lente destra')+eye('Os','SX','OS · Lente sinistra')+'</div>'+DATES+'</div></div></div>'
  +'<div id="lacSummaryOverlay" class="lacSummaryOverlay"><div id="lacSummaryBody" class="lacSummaryBody"></div></div>'
  +'<script>'+APP+'</script></body></html>';
const ENTRIES=['index.html','gestionale-v2/index.html','gestionale-v3/index.html'];

(async()=>{
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'lac-order-number-')),site=path.join(tmp,'_site'),script=path.join(tmp,'scripts','apply_lac_order_number_20261121.py');
 fs.mkdirSync(path.dirname(script));for(const d of ['gestionale-v2','gestionale-v3'])fs.mkdirSync(path.join(site,d),{recursive:true});
 fs.copyFileSync(path.join(repo,'scripts','apply_lac_order_number_20261121.py'),script);
 fs.copyFileSync(path.join(repo,'lac-order-number.js'),path.join(tmp,'lac-order-number.js'));
 for(const rel of ENTRIES)fs.writeFileSync(path.join(site,rel),PAGE);
 const count=(s,x)=>s.split(x).length-1;

 // Build step: one field per lens right after its lot, Perossido and dates untouched, one deferred loader in <head>.
 execFileSync('python3',[script]);execFileSync('python3',[script]);
 const html=fs.readFileSync(path.join(site,'index.html'),'utf8');
 for(const k of ['Od','Os']){
   assert.equal(count(html,'id="lac'+k+'OrderNumber"'),1);
   assert.ok(html.indexOf('id="lac'+k+'Lot"')<html.indexOf('id="lac'+k+'OrderNumber"'));
 }
 assert.ok(html.indexOf('id="lacOdOrderNumber"')<html.indexOf('id="lacOsColor"'));
 assert.ok(html.indexOf('id="lacOsOrderNumber"')<html.indexOf('class="lacTraceDates"'));
 assert.ok(html.includes(DATES));
 assert.equal(count(html,'OPTYKER_LAC_ORDER_NUMBER_20261121'),2);
 assert.equal(count(html,'id="optykerLacOrderNumberJs"'),1);
 assert.ok(html.indexOf('id="optykerLacOrderNumberJs"')<html.indexOf('</head>'));
 const src=html.match(/id="optykerLacOrderNumberJs" defer src="\/(lac-order-number\.[0-9a-f]{12}\.js)"/);
 assert.ok(src&&fs.existsSync(path.join(site,src[1])));
 for(const rel of ENTRIES.slice(1))assert.equal(fs.readFileSync(path.join(site,rel),'utf8'),html);
 // A page whose lot field changed stops the build instead of publishing a sheet without the field.
 fs.writeFileSync(path.join(site,'gestionale-v3/index.html'),PAGE.replace('id="lacOsLot"','id="lacOsBatch"'));
 const bad=spawnSync('python3',[script],{encoding:'utf8'});
 assert.notEqual(bad.status,0);assert.match(bad.stderr+bad.stdout,/casella Lotto lente SX cambiata in gestionale-v3/);
 fs.writeFileSync(path.join(site,'gestionale-v3/index.html'),html);
 // Same lot fields written with other attribute order, self-closing inputs and line breaks.
 const tmp2=fs.mkdtempSync(path.join(os.tmpdir(),'lac-order-number-variant-')),site2=path.join(tmp2,'_site'),script2=path.join(tmp2,'scripts','apply_lac_order_number_20261121.py');
 fs.mkdirSync(path.dirname(script2));for(const d of ['gestionale-v2','gestionale-v3'])fs.mkdirSync(path.join(site2,d),{recursive:true});
 fs.copyFileSync(script,script2);fs.copyFileSync(path.join(tmp,'lac-order-number.js'),path.join(tmp2,'lac-order-number.js'));
 const variant=PAGE.replace(/<input id="(lac(?:Od|Os)Lot)" type="text" placeholder="([^"]*)">/g,'\n  <input placeholder="$2" type="text" id="$1"/>\n');
 assert.notEqual(variant,PAGE);
 for(const rel of ENTRIES)fs.writeFileSync(path.join(site2,rel),variant);
 execFileSync('python3',[script2]);
 const html2=fs.readFileSync(path.join(site2,'index.html'),'utf8');
 for(const k of ['Od','Os'])assert.match(html2,new RegExp('id="lac'+k+'Lot"/>\\n</div><!-- OPTYKER_LAC_ORDER_NUMBER_20261121 --><div class="lacTraceField lacOrderNumberField"'));
 fs.rmSync(tmp2,{recursive:true,force:true});

 const browser=await chromium.launch({headless:true,...(process.env.CHROME_EXECUTABLE_PATH?{executablePath:process.env.CHROME_EXECUTABLE_PATH}:{})});
 const page=await browser.newPage({viewport:{width:900,height:700},locale:'it-IT'}),errors=[];
 page.on('pageerror',x=>errors.push(String(x)));
 await page.route('https://optyker.test/**',route=>{
   let rel=new URL(route.request().url()).pathname.replace(/^\//,'');if(!rel||rel.endsWith('/'))rel+='index.html';
   const file=path.join(site,rel);
   if(!file.startsWith(site+path.sep)||!fs.existsSync(file))return route.fulfill({status:404,body:''});
   return route.fulfill({status:200,contentType:file.endsWith('.js')?'text/javascript':'text/html',body:fs.readFileSync(file)});
 });
 try{
  await page.goto('https://optyker.test/gestionale-v3/');
  await page.waitForFunction(()=>window.__optykerLacOrderNumber==='20261121-lac-order2');
  assert.equal(await page.textContent('label[for="lacOdOrderNumber"]'),"Numero d'ordine lente DX");
  assert.equal(await page.textContent('label[for="lacOsOrderNumber"]'),"Numero d'ordine lente SX");
  // Desktop: in each lens card, a full row under Colore and Lotto; the dates grid keeps its layout.
  const box=id=>page.locator('#'+id).boundingBox();
  for(const k of ['Od','Os']){
    const color=await box('lac'+k+'Color'),lot=await box('lac'+k+'Lot'),order=await box('lac'+k+'OrderNumber');
    assert.ok(order.y>lot.y+20&&Math.abs(order.x-color.x)<2,'order number under colour and lot ('+k+')');
    assert.ok(Math.abs(order.x+order.width-(lot.x+lot.width))<2,'order number spans the lens card ('+k+')');
  }
  const reorder=await box('lacReorderRecallDate'),peroxide=await box('lacPeroxide'),control=await box('lacControlDate');
  assert.ok(Math.abs(peroxide.y-reorder.y)<40&&peroxide.x>reorder.x&&control.y>reorder.y+20&&Math.abs(control.x-reorder.x)<2);
  if(process.env.LAC_ORDER_SCREENSHOT)await page.locator('.lacProductTraceCard').screenshot({path:process.env.LAC_ORDER_SCREENSHOT});

  const open=()=>page.evaluate(()=>new Promise(r=>{lacOpenSummary();setTimeout(r,10)}));
  const summary=()=>page.$$eval('#lacSummaryBody .lacSummarySection',a=>a.map(s=>({head:s.querySelector('.lacSummarySectionHead').textContent,
    rows:[...s.querySelectorAll('.lacSummaryRow')].map(r=>r.querySelector('.lacSummaryRowLabel').textContent+'='+r.querySelector('.lacSummaryRowValue').textContent)})));
  const trace=async()=>(await summary()).find(s=>s.head==='Identificazione lenti e richiami');

  await page.fill('#lacOdLot','LOT-OD-77');await page.fill('#lacOdOrderNumber','  ORD 2026/0457 ');
  await page.fill('#lacOsColor','blu');await page.fill('#lacOsLot','LOT-OS-78');await page.fill('#lacOsOrderNumber','ORD 2026/0458');
  await page.fill('#lacReorderRecallDate','2027-05-21');await page.fill('#lacControlDate','2026-12-05');
  await open();
  assert.deepEqual((await trace()).rows,['Lotto lente DX=LOT-OD-77',"Numero d'ordine lente DX=ORD 2026/0457",'Colore lente SX=blu','Lotto lente SX=LOT-OS-78',
    "Numero d'ordine lente SX=ORD 2026/0458",'Data richiamo per riordino=21/05/2027','Data controllo=05/12/2026']);
  const lab=await page.evaluate(()=>window.__labSummaryHtml);
  assert.match(lab,/Numero d'ordine lente DX<\/div><div class="lacSummaryRowValue">ORD 2026\/0457/);
  assert.match(lab,/Numero d'ordine lente SX<\/div><div class="lacSummaryRowValue">ORD 2026\/0458/);
  await page.evaluate(()=>lacPrintSummary());
  assert.match(await page.evaluate(()=>window.__printed),/ORD 2026\/0457[\s\S]*ORD 2026\/0458/);

  // Generated again after a change: one row per lens, with the new numbers; an emptied lens disappears.
  await page.fill('#lacOdOrderNumber','ORD-9');await page.fill('#lacOsOrderNumber','');await open();await open();
  assert.deepEqual((await trace()).rows.filter(r=>r.startsWith("Numero d'ordine")),["Numero d'ordine lente DX=ORD-9"]);

  // Only one order number filled in: its own section right after Prodotto e costo; text, never markup.
  await page.evaluate(()=>lacResetAll());
  for(const k of ['Od','Os'])assert.equal(await page.inputValue('#lac'+k+'OrderNumber'),'');
  await page.fill('#lacOsOrderNumber','<img src=x onerror=window.__injected=1>');await open();
  let all=await summary();
  assert.deepEqual(all.map(s=>s.head),['Prodotto e costo','Identificazione lenti e richiami','Dati generali']);
  assert.deepEqual(all[1].rows,["Numero d'ordine lente SX=<img src=x onerror=window.__injected=1>"]);
  assert.equal(await page.$$eval('#lacSummaryBody img',a=>a.length),0);
  assert.equal(await page.evaluate(()=>window.__injected),undefined);

  // Empty: the summary is exactly the original one.
  await page.fill('#lacOsOrderNumber','');await open();
  all=await summary();
  assert.deepEqual(all.map(s=>s.head),['Prodotto e costo','Dati generali']);
  assert.equal(await page.$$eval('#lacSummaryBody [data-lac-order-number],#lacSummaryBody [data-lac-order-number-section]',a=>a.length),0);

  // Phone width: one column, each order number right under its lot.
  await page.setViewportSize({width:390,height:900});
  for(const k of ['Od','Os']){
    const lot=await box('lac'+k+'Lot'),order=await box('lac'+k+'OrderNumber');
    assert.ok(order.y>lot.y&&Math.abs(order.x-lot.x)<2&&Math.abs(order.width-lot.width)<2,'one column on phones ('+k+')');
  }
  assert.deepEqual(errors,[]);
  console.log("Scheda LAC: Numero d'ordine DX e SX verificato (scheda, riepilogo, stampa, Laboratorio, telefono)");
 }finally{await browser.close();fs.rmSync(tmp,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exit(1)});

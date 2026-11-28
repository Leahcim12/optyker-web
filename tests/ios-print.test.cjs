/* Stampa da iPad e iPhone 20261126.
   Pagina sintetica con le stesse funzioni di stampa della pagina reale (getPrintFrame, printHtmlDocument e la sua
   sostituzione OPTYKER_PRINT_WAIT_FIX_V1, printIndicationsUse, printIndicationsDocument) e documenti con gli stessi
   stili di indicazioni d'uso e prescrizione. Sui computer la stampa resta quella dell'iframe; su iPad/iPhone il
   documento si stampa dalla pagina stessa. Nessun dato reale. */
const fs=require('fs'),os=require('os'),path=require('path'),assert=require('node:assert/strict');
const {execFileSync,spawnSync}=require('child_process');
const {chromium,webkit}=require('playwright');
// IOS_PRINT_ENGINE=webkit: only the iPad and iPhone checks, in WebKit (the engine of Safari on iOS).
const WEBKIT=process.env.IOS_PRINT_ENGINE==='webkit';
const repo=path.resolve(__dirname,'..');
const ENTRIES=['index.html','gestionale-v2/index.html','gestionale-v3/index.html'];
const LOGO='data:image/svg+xml;base64,'+Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="150" height="150"><rect width="150" height="150" fill="#1769aa"/></svg>').toString('base64');

// Same code as the production page (base functions and the inline print-wait override).
const BASE_PRINT=String.raw`
function g(id){return document.getElementById(id)}
function escapeHtml(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
var OPTYKER_PRINT_LOGO_DATA='${LOGO}';
function getPrintFrame(){
  var frame = g('printFrame');
  if(!frame){
    frame = document.createElement('iframe');
    frame.id = 'printFrame';
    frame.style.position = 'absolute';
    frame.style.left = '-10000px';
    frame.style.top = '0';
    frame.style.width = '1px';
    frame.style.height = '1px';
    document.body.appendChild(frame);
  }
  return frame;
}
function getIePageSetupState(){
  var state = {shell:null, header:null, footer:null, ok:false};
  try{ var shell = new ActiveXObject('WScript.Shell'); state.shell = shell; state.ok = true; }catch(e){ state.ok = false; }
  return state;
}
function restoreIePageSetupState(state){ if(!state || !state.ok || !state.shell) return; }
function printHtmlDocument(html,delayMs){
  try{
    var frame = getPrintFrame();
    var doc = frame.contentWindow.document;
    var delay=parseInt(delayMs,10);
    if(isNaN(delay) || delay<100) delay=350;
    doc.open();
    doc.write(html);
    doc.close();
    frame.contentWindow.focus();
    setTimeout(function(){
      var pageSetup = getIePageSetupState();
      try{
        frame.contentWindow.print();
      }catch(err){
        alert('Errore di stampa: ' + err.message);
      }finally{
        restoreIePageSetupState(pageSetup);
      }
    }, delay);
  }catch(e){
    alert('Errore di stampa: ' + e.message);
  }
}
function indicationsUsePrintHtml(){
  var rows=document.querySelectorAll('#indicationsRows .iuRow'),h='',n=0;
  for(var i=0;i<rows.length;i++){var p=rows[i].querySelector('.p').value,d=rows[i].querySelector('.d').value;if(!p&&!d)continue;n++;
    h+='<tr><td class="num">'+n+'</td><td class="prod">'+escapeHtml(p)+'</td><td class="directions">'+escapeHtml(d)+'</td></tr>'}
  if(!n) return '';
  return '<!doctype html><html><head><meta charset="utf-8"><title>Indicazioni d\'uso</title><style>'+
  '@page{size:A4 portrait;margin:.01mm}*{box-sizing:border-box}html,body{width:100%;min-height:100%;margin:0!important;padding:0!important;background:#fff}body{font-family:"Segoe UI",Arial,sans-serif;color:#172033;font-size:13px;line-height:1.25;-webkit-print-color-adjust:exact}.sheet{width:100%;min-height:297mm;margin:0!important;padding:3mm 5mm 3mm;display:-ms-flexbox;display:flex;-ms-flex-direction:column;flex-direction:column}.head{display:flex;align-items:center;margin:0 0 7px;padding:0 0 7px;border-bottom:1.5px solid #7b8794;width:100%}.head img{width:150px;height:150px;object-fit:contain;flex:0 0 150px;margin-right:18px}.title{font-size:23px;margin:5px 0 9px;font-weight:800;color:#152b47;text-align:center;width:100%}table{width:100%;border-collapse:collapse;table-layout:fixed}th,td{border:.01mm solid #475569;padding:8px 7px;vertical-align:top;font-size:12.8px}th{background:#eef2f6;color:#20364f;font-weight:900;text-align:center}td.num{width:9mm;text-align:center;font-weight:900}td.prod{width:34%;font-weight:900;color:#172b4d}.foot{display:flex;margin-top:12px;padding-top:7px;border-top:1px solid #9aa6b2;font-size:13.2px}.foot .specialist{font-weight:900;margin-left:5px}'+
  '</style></head><body><div class="sheet"><div class="head"><img src="'+OPTYKER_PRINT_LOGO_DATA+'"><div class="clinic"><b>Ottica Visual Care</b><br>Via primo maggio 4<br>24040 Lallio (BG)</div></div><div class="title">INDICAZIONI D\'USO</div>'+
  '<table><thead><tr><th style="width:9mm">N.</th><th style="width:34%">Prodotto</th><th>Indicazioni d\'uso</th></tr></thead><tbody>'+h+'</tbody></table><div class="foot"><span>OTTICO OPTOMETRISTA CONTATTOLOGO SPECIALISTA —</span><span class="specialist">Michael Mologni</span></div></div></body></html>';
}
function printIndicationsUse(){
  var html=indicationsUsePrintHtml();
  if(!html){ alert('Inserisci almeno un prodotto o una indicazione d\'uso.'); return; }
  printHtmlDocument(html);
}
function indicationsDocumentFolder(){
  var path='';
  try{
    path=window.location.pathname||'';
    path=decodeURIComponent(path);
    path=path.replace(/\//g,'\\');
    if(path.length>2 && path.charAt(0)==='\\' && path.charAt(2)===':') path=path.substring(1);
    var pos=path.lastIndexOf('\\');
    if(pos>0) return path.substring(0,pos);
  }catch(e){}
  try{
    var sh=new ActiveXObject('WScript.Shell');
    return sh.CurrentDirectory||'';
  }catch(e2){}
  return '';
}
function indicationsDocumentImageName(fileName){
  if(fileName==='Pulizia Ortok.pdf') return 'Documento Pulizia Ortok.png';
  if(fileName==='Pulizia RGP.pdf') return 'Documento Pulizia RGP.png';
  if(fileName==='Pulizia Sclerali.pdf') return 'Documento Pulizia Sclerali.png';
  if(fileName==='Pulizia Morbide.pdf') return 'Documento Pulizia Morbide.png';
  return '';
}
function localImageFileUrl(path){
  path=String(path||'').replace(/\\/g,'/');
  path=path.replace(/%/g,'%25').replace(/#/g,'%23').replace(/\?/g,'%3F').replace(/ /g,'%20');
  if(path.charAt(0)==='/') return 'file://'+path;
  return 'file:///'+path;
}
function indicationsDocumentPrintHtml(fileName){
  var folder=indicationsDocumentFolder();
  var imgName=indicationsDocumentImageName(fileName);
  if(!folder || !imgName) return '';
  var fullPath=folder+'\\'+imgName;
  try{
    var fso=new ActiveXObject('Scripting.FileSystemObject');
    if(!fso.FileExists(fullPath)) return '';
  }catch(e){}
  var src=localImageFileUrl(fullPath);
  return '<!doctype html><html><head><meta charset="utf-8"><title>Documento</title><style>@page{size:A4 portrait;margin:.01mm}html,body{width:100%;height:100%;margin:0!important;padding:0!important;background:#fff;overflow:hidden}.page img{display:block;width:100%}</style></head><body><div class="page"><img src="'+src+'"></div></body></html>';
}
function printIndicationsDocument(){
  var sel=g('iuDocumentSelect');
  var fileName=sel ? sel.value : '';
  if(!fileName){
    alert('Seleziona il documento da stampare.');
    return;
  }
  var html=indicationsDocumentPrintHtml(fileName);
  if(!html){
    alert('Documento non disponibile. Reinstalla il programma con il pacchetto aggiornato.');
    return;
  }
  printHtmlDocument(html,900);
}
function prescriptionPrintHtml(){
  return '<!doctype html><html><head><meta charset="utf-8"><title>Prescrizione optometrica</title><style>'+
  '@page{size:A4 portrait;margin:.01mm}*{box-sizing:border-box}html,body{width:100%;height:100%;margin:0!important;padding:0!important;background:#fff}body{font-family:"Segoe UI",Arial,sans-serif;color:#172033;font-size:13px;overflow:hidden}.sheet{position:absolute;left:0;top:0;right:0;bottom:0;width:100%;height:100%;margin:0!important;padding:2.8mm 4.5mm 2.5mm;overflow:hidden;display:flex;flex-direction:column;transform:none!important;zoom:1!important}.head img{width:150px;height:150px}.rx{margin-top:20px;font-size:20px;font-weight:800}'+
  '</style></head><body><div class="sheet"><div class="head"><img id="rxLogo" src="/logo-lento.svg"></div><div class="rx">OD +1,25 · OS +1,50</div></div></body></html>';
}
function printPrescription(){
  var frame = getPrintFrame();
  frame.style.width = '794px';
  frame.style.height = '1123px';
  printHtmlDocument(prescriptionPrintHtml());
}`;
const WAIT_FIX=String.raw`<script id="OPTYKER_PRINT_WAIT_FIX_V1">
(function(){
  window.printHtmlDocument=function(html,delayMs){
    try{
      var frame=getPrintFrame();
      var doc=frame.contentWindow.document;
      var delay=parseInt(delayMs,10);
      if(isNaN(delay)||delay<100)delay=350;
      doc.open();doc.write(html);doc.close();
      var printed=false;
      function doPrint(){
        if(printed)return;printed=true;
        frame.contentWindow.focus();
        setTimeout(function(){
          var pageSetup=getIePageSetupState();
          try{frame.contentWindow.print();}
          catch(err){alert('Errore di stampa: '+err.message);}
          finally{restoreIePageSetupState(pageSetup);}
        },delay);
      }
      var imgs=doc.images?Array.prototype.slice.call(doc.images):[];
      if(!imgs.length){doPrint();return;}
      var pending=imgs.length;
      function done(){pending--;if(pending<=0)doPrint();}
      for(var i=0;i<imgs.length;i++){
        var im=imgs[i];
        if(im.complete&&im.naturalWidth>0)done();
        else{im.addEventListener('load',done,{once:true});im.addEventListener('error',done,{once:true});}
      }
      setTimeout(doPrint,2500);
    }catch(e){alert('Errore di stampa: '+e.message);}
  };
})();
</script>`;
const PAGE='<!DOCTYPE html><html lang="it"><head><meta charset="utf-8"><title>Optyker</title><style>body{font:13px system-ui,sans-serif;margin:0;background:#eef2f6;height:100vh;overflow:hidden}#mainApp{padding:16px}.iuRow{display:flex;gap:8px;margin:6px 0}@page{size:A4 landscape;margin:20mm}@media print{#mainApp{color:#000}body > :not(#lacSummaryOverlay){display:none!important}}</style></head><body>'+
  '<div id="mainApp"><div id="indicationsPanel" class="panel"><h2 class="iuTitle">INDICAZIONI D\'USO</h2><div id="indicationsRows">'+
  '<div class="iuRow"><input class="p" value="Lenti mensili Air Optix"><input class="d" value="Sostituire ogni 30 giorni; non dormire con le lenti."></div>'+
  '<div class="iuRow"><input class="p" value="Soluzione unica"><input class="d" value="Massaggiare e risciacquare a ogni rimozione."></div></div>'+
  '<button id="btnIU" class="primary" type="button" onclick="printIndicationsUse()">Stampa indicazioni d\'uso</button>'+
  '<select id="iuDocumentSelect"><option value="">— Seleziona documento —</option><option value="Pulizia Ortok.pdf">Pulizia OrtoK</option><option value="Pulizia RGP.pdf">Pulizia RGP</option><option value="Pulizia Sclerali.pdf">Pulizia lenti sclerali</option><option value="Pulizia Morbide.pdf">Pulizia lenti morbide</option></select>'+
  '<button id="btnDoc" class="primary" type="button" onclick="printIndicationsDocument()">Stampa documento</button>'+
  '<button id="btnRx" class="primary" type="button" onclick="printPrescription()">Stampa prescrizione</button></div></div>'+
  '<script>'+BASE_PRINT+'</script>'+WAIT_FIX+'</body></html>';

const IPAD_UA='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15';
const IPHONE_UA='Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1';

(async()=>{
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'ios-print-')),site=path.join(tmp,'_site'),script=path.join(tmp,'scripts','apply_ios_print_20261126.py');
 fs.mkdirSync(path.dirname(script));for(const d of ['gestionale-v2','gestionale-v3','istruzioni-lac'])fs.mkdirSync(path.join(site,d),{recursive:true});
 fs.copyFileSync(path.join(repo,'scripts','apply_ios_print_20261126.py'),script);
 fs.copyFileSync(path.join(repo,'ios-print.js'),path.join(tmp,'ios-print.js'));
 for(const f of fs.readdirSync(path.join(repo,'istruzioni-lac')))fs.copyFileSync(path.join(repo,'istruzioni-lac',f),path.join(site,'istruzioni-lac',f));
 fs.writeFileSync(path.join(site,'logo-lento.svg'),'<svg xmlns="http://www.w3.org/2000/svg" width="150" height="150"><circle cx="75" cy="75" r="70" fill="#c2364f"/></svg>');
 for(const rel of ENTRIES)fs.writeFileSync(path.join(site,rel),PAGE);
 const count=(s,x)=>s.split(x).length-1;
 execFileSync('python3',[script]);execFileSync('python3',[script]);
 const html=fs.readFileSync(path.join(site,'index.html'),'utf8');
 assert.equal(count(html,'id="optykerIosPrintJs"'),1);
 assert.ok(html.indexOf('id="optykerIosPrintJs"')<html.indexOf('</head>'));
 const src=html.match(/id="optykerIosPrintJs" defer src="\/(ios-print\.[0-9a-f]{12}\.js)"/);
 assert.ok(src&&fs.existsSync(path.join(site,src[1])));
 for(const rel of ENTRIES.slice(1))assert.equal(fs.readFileSync(path.join(site,rel),'utf8'),html);
 // A page whose print functions changed stops the build.
 fs.writeFileSync(path.join(site,'gestionale-v3/index.html'),html.replace('function printIndicationsUse(','function stampaIndicazioni('));
 const bad=spawnSync('python3',[script],{encoding:'utf8'});
 assert.notEqual(bad.status,0);assert.match(bad.stderr+bad.stdout,/function printIndicationsUse\( » non trovato in gestionale-v3|printIndicationsUse/);
 fs.writeFileSync(path.join(site,'gestionale-v3/index.html'),html);

 const browser=WEBKIT?await webkit.launch({headless:true}):await chromium.launch({headless:true,...(process.env.CHROME_EXECUTABLE_PATH?{executablePath:process.env.CHROME_EXECUTABLE_PATH}:{})});
 async function open(opts,ipad){
   const ctx=await browser.newContext(Object.assign({viewport:{width:1024,height:768},locale:'it-IT'},opts||{}));
   const page=await ctx.newPage(),errors=[],dialogs=[];
   page.on('pageerror',x=>errors.push(String(x)));page.on('dialog',d=>{dialogs.push(d.message());d.dismiss()});
   await page.addInitScript(isIpad=>{
     if(isIpad){Object.defineProperty(Navigator.prototype,'maxTouchPoints',{get:()=>5});Object.defineProperty(Navigator.prototype,'platform',{get:()=>'MacIntel'})}
     window.__mainPrints=[];
     window.print=function(){var h=document.getElementById('optykerIosPrintHost');window.__mainPrints.push({host:!!h,text:h&&h.shadowRoot?h.shadowRoot.textContent:''})};
   },!!ipad);
   await ctx.route('https://optyker.test/**',async route=>{
     let rel=new URL(route.request().url()).pathname.replace(/^\//,'');if(!rel||rel.endsWith('/'))rel+='index.html';
     const file=path.join(site,rel);
     if(!file.startsWith(site+path.sep)||!fs.existsSync(file))return route.fulfill({status:404,body:''});
     if(rel==='logo-lento.svg')await new Promise(r=>setTimeout(r,700));
     const type=file.endsWith('.js')?'text/javascript':file.endsWith('.svg')?'image/svg+xml':file.endsWith('.pdf')?'application/pdf':'text/html';
     return route.fulfill({status:200,contentType:type,body:fs.readFileSync(file)});
   });
   await page.goto('https://optyker.test/gestionale-v3/');
   await page.waitForFunction(()=>window.OPTYKER_IOS_PRINT&&window.printHtmlDocument.__optykerIosPrint&&window.printIndicationsDocument.__optykerIosPrint);
   // Record what the hidden frame would print (desktop path).
   await page.evaluate(()=>{window.__framePrints=[];var orig=window.getPrintFrame;window.getPrintFrame=function(){var f=orig();if(!f.__rec){f.__rec=1;var w=f.contentWindow;w.print=function(){window.__framePrints.push(w.document.body?w.document.body.innerText:'')}}return f}});
   return {ctx,page,errors,dialogs};
 }
 try{
  let ctx,page,errors,dialogs;
  if(!WEBKIT){
  // ---------- Computer: same iframe printing as before, nothing added to the page ----------
  ({ctx,page,errors,dialogs}=await open({userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36'},false));
  assert.equal(await page.evaluate(()=>window.OPTYKER_IOS_PRINT.isIOS()),false);
  await page.click('#btnIU');
  await page.waitForFunction(()=>window.__framePrints.length===1);
  assert.match(await page.evaluate(()=>window.__framePrints[0]),/INDICAZIONI D'USO[\s\S]*Lenti mensili Air Optix/);
  assert.equal(await page.evaluate(()=>window.__mainPrints.length),0);
  assert.equal(await page.$('#optykerIosPrintHost'),null);
  // Cleaning documents: the published PDF opens (the old Windows program used local images); Perossido added.
  assert.deepEqual(await page.$$eval('#iuDocumentSelect option',a=>a.map(o=>o.value)).then(v=>v.slice(-1)),['Pulizia Perossido.pdf']);
  // window.open is recorded (a PDF tab downloads instead of rendering in headless browsers); the files exist.
  await page.evaluate(()=>{window.__opens=[];window.open=function(u){window.__opens.push(String(u));return {focus:function(){}}}});
  await page.selectOption('#iuDocumentSelect','Pulizia RGP.pdf');await page.click('#btnDoc');
  await page.selectOption('#iuDocumentSelect','Pulizia Perossido.pdf');await page.click('#btnDoc');
  assert.deepEqual(await page.evaluate(()=>window.__opens),['https://optyker.test/istruzioni-lac/pulizia-rgp.pdf','https://optyker.test/istruzioni-lac/pulizia-perossido.pdf']);
  assert.deepEqual(await page.evaluate(()=>Promise.all(window.__opens.map(u=>fetch(u).then(r=>r.status+' '+r.headers.get('content-type'))))),['200 application/pdf','200 application/pdf']);
  // Popup blocked: the user is told how to allow it.
  await page.evaluate(()=>{window.open=function(){return null}});
  await page.click('#btnDoc');
  await page.selectOption('#iuDocumentSelect','');await page.click('#btnDoc');
  assert.deepEqual(dialogs,['Il browser ha bloccato l’apertura del PDF. Consenti i popup per Optyker e riprova.','Seleziona il documento da stampare.']);
  // Old Windows program (ActiveX): its own path is kept.
  await page.evaluate(()=>{window.ActiveXObject=function(){throw new Error('no')}});
  await page.selectOption('#iuDocumentSelect','Pulizia Morbide.pdf');await page.click('#btnDoc');
  await page.waitForFunction(()=>window.__framePrints.length===2,null,{timeout:6000});
  assert.equal(await page.evaluate(()=>document.getElementById('printFrame').contentWindow.document.querySelector('img').getAttribute('src')),'file:///gestionale-v3/Documento%20Pulizia%20Morbide.png');
  assert.deepEqual(errors,[]);await ctx.close();
  }

  // ---------- iPad (iPadOS: Mac user agent with touch) ----------
  ({ctx,page,errors,dialogs}=await open({userAgent:IPAD_UA,hasTouch:true},true));
  assert.equal(await page.evaluate(()=>window.OPTYKER_IOS_PRINT.isIOS()),true);
  await page.click('#btnIU');
  await page.waitForFunction(()=>window.__mainPrints.length===1);
  let printed=await page.evaluate(()=>window.__mainPrints[0]);
  assert.ok(printed.host);assert.match(printed.text,/INDICAZIONI D'USO[\s\S]*Lenti mensili Air Optix[\s\S]*Massaggiare e risciacquare/);
  assert.equal(await page.evaluate(()=>window.__framePrints.length),0,'the hidden frame is not used on iPad');
  // Document styles kept but limited to the document; @page moved to the page; nothing changes on screen.
  const shadowCss=await page.$eval('#optykerIosPrintHost',h=>Array.from(h.shadowRoot.querySelectorAll('style')).map(s=>s.textContent).join('\n'));
  assert.match(shadowCss,/\.optykerPrintHtml,\.optykerPrintBody\{width:100%;min-height:100%;margin:0!important/);
  assert.match(shadowCss,/\.optykerPrintBody\{font-family:"Segoe UI"/);
  assert.ok(!/(^|[}\s,])(html|body)[{,\s]/.test(shadowCss.replace(/\.optykerPrint(Html|Body)/g,'')),'no html/body selector left');
  assert.match(await page.$eval('#optykerIosPrintCss',s=>s.textContent),/@page\{size:A4 portrait;margin:.01mm\}$/);
  assert.equal(await page.$eval('#optykerIosPrintHost',h=>getComputedStyle(h).display),'none');
  assert.ok(await page.isVisible('#mainApp'));
  await page.emulateMedia({media:'print'});
  assert.equal(await page.$eval('#mainApp',e=>getComputedStyle(e).display),'none');
  assert.equal(await page.$eval('#optykerIosPrintHost',h=>getComputedStyle(h).display),'block');
  const layout=await page.$eval('#optykerIosPrintHost',h=>{const r=h.shadowRoot,td=r.querySelector('td.prod'),img=r.querySelector('.head img'),sheet=r.querySelector('.sheet');
    return {font:getComputedStyle(td).fontSize,weight:getComputedStyle(td).fontWeight,img:img.getBoundingClientRect().width,sheet:sheet.getBoundingClientRect().width,body:getComputedStyle(document.body).overflow,text:sheet.innerText}});
  assert.equal(layout.font,'12.8px');assert.equal(layout.weight,'900');assert.equal(layout.img,150);assert.ok(layout.sheet>=1000,'sheet uses the page width: '+layout.sheet);
  assert.equal(layout.body,'visible');assert.match(layout.text,/Sostituire ogni 30 giorni; non dormire con le lenti\./);
  if(process.env.IOS_PRINT_SCREENSHOT)await page.screenshot({path:process.env.IOS_PRINT_SCREENSHOT});
  await page.emulateMedia({media:'screen'});
  // After printing the document is removed.
  await page.evaluate(()=>window.dispatchEvent(new Event('afterprint')));
  await page.waitForFunction(()=>!document.getElementById('optykerIosPrintHost')&&!document.getElementById('optykerIosPrintCss'));
  // Prescription: waits for its image; the sheet fills the first page; removed at the next tap if Safari gives no afterprint.
  const t0=Date.now();await page.click('#btnRx');
  await page.waitForFunction(()=>window.__mainPrints.length===2);
  assert.ok(Date.now()-t0>=700,'printed after the image loaded');
  assert.match((await page.evaluate(()=>window.__mainPrints[1])).text,/OD \+1,25 · OS \+1,50/);
  await page.emulateMedia({media:'print'});
  const rx=await page.$eval('#optykerIosPrintHost',h=>{const s=h.shadowRoot.querySelector('.sheet').getBoundingClientRect(),i=h.shadowRoot.getElementById('rxLogo');return {top:s.top,h:s.height,w:s.width,img:i.complete&&i.naturalWidth}});
  assert.equal(rx.top,0);assert.ok(rx.h>=760&&rx.w>=1000,'prescription sheet fills the page '+JSON.stringify(rx));assert.equal(rx.img,150);
  await page.emulateMedia({media:'screen'});
  await page.waitForTimeout(900);
  await page.mouse.click(600,600);
  await page.waitForFunction(()=>!document.getElementById('optykerIosPrintHost'));
  // A new print replaces the previous document; the cleaning PDFs open as on the computer.
  await page.click('#btnIU');await page.click('#btnIU');
  await page.waitForFunction(()=>window.__mainPrints.length===4);
  assert.equal(await page.$$eval('#optykerIosPrintHost',a=>a.length),1);
  await page.evaluate(()=>{window.__opens=[];window.open=function(u){window.__opens.push(String(u));return {focus:function(){}}}});
  await page.selectOption('#iuDocumentSelect','Pulizia Sclerali.pdf');await page.click('#btnDoc');
  assert.deepEqual(await page.evaluate(()=>window.__opens),['https://optyker.test/istruzioni-lac/pulizia-sclerali.pdf']);
  assert.deepEqual(errors,[]);assert.deepEqual(dialogs,[]);await ctx.close();

  // ---------- iPhone ----------
  ({ctx,page,errors}=await open(Object.assign({userAgent:IPHONE_UA,viewport:{width:390,height:844},hasTouch:true},WEBKIT?{}:{isMobile:true}),false));
  assert.equal(await page.evaluate(()=>window.OPTYKER_IOS_PRINT.isIOS()),true);
  await page.click('#btnIU');
  await page.waitForFunction(()=>window.__mainPrints.length===1);
  assert.match((await page.evaluate(()=>window.__mainPrints[0])).text,/Soluzione unica/);
  assert.deepEqual(errors,[]);await ctx.close();
  console.log('Stampa iPad/iPhone verificata in '+(WEBKIT?'WebKit':'Chromium')+(WEBKIT?' (documento nella pagina, stili, @page, immagini, pulizia)':' (computer invariato, documento nella pagina, stili, @page, immagini, pulizia, PDF LAC)'));
 }finally{await browser.close();fs.rmSync(tmp,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exit(1)});

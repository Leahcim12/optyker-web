/* Pagina reale della build (_site): Report con «Visite senza scheda», DDT «Modifica» e stampa iPad caricati nei tre
   accessi desktop, nell'ordine giusto rispetto agli script della pagina. Rete esterna bloccata: nessun dato reale. */
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const site=path.resolve(process.env.SITE_DIR||path.join(__dirname,'..','_site'));

(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.CHROME_EXECUTABLE_PATH?{executablePath:process.env.CHROME_EXECUTABLE_PATH}:{})});
 try{
  for(const entry of ['','gestionale-v2/','gestionale-v3/']){
   for(const ipad of [false,true]){
    const ctx=await browser.newContext({viewport:{width:1366,height:900},locale:'it-IT',...(ipad?{userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15',hasTouch:true}:{})});
    const page=await ctx.newPage(),mine=[];
    page.on('pageerror',e=>{const s=String(e&&e.stack||e);if(/ddt-edit|ios-print|optyker-report/.test(s))mine.push(s)});
    page.on('dialog',d=>d.dismiss());
    if(ipad)await page.addInitScript(()=>{Object.defineProperty(Navigator.prototype,'maxTouchPoints',{get:()=>5});Object.defineProperty(Navigator.prototype,'platform',{get:()=>'MacIntel'})});
    await ctx.route('**/*',route=>{
      const u=new URL(route.request().url());
      if(u.hostname!=='optyker.test')return route.abort();
      let rel=decodeURIComponent(u.pathname).replace(/^\//,'');if(!rel||rel.endsWith('/'))rel+='index.html';
      const file=path.join(site,rel);
      if(!file.startsWith(site+path.sep)||!fs.existsSync(file)||fs.statSync(file).isDirectory())return route.fulfill({status:404,body:''});
      const ext=path.extname(file),type={'.js':'text/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml','.json':'application/json','.webp':'image/webp','.png':'image/png','.pdf':'application/pdf'}[ext]||'application/octet-stream';
      return route.fulfill({status:200,contentType:type,body:fs.readFileSync(file)});
    });
    await page.goto('https://optyker.test/'+entry,{waitUntil:'load'});
    await page.waitForFunction(()=>window.OPTYKER_DDT_EDIT&&window.OPTYKER_IOS_PRINT&&window.OPTYKER_REPORT,null,{timeout:20000});
    await page.waitForFunction(()=>window.printHtmlDocument&&window.printHtmlDocument.__optykerIosPrint&&window.printIndicationsDocument&&window.printIndicationsDocument.__optykerIosPrint,null,{timeout:10000});
    const info=await page.evaluate(()=>({
      ddt:window.OPTYKER_DDT_EDIT.version,ios:window.OPTYKER_IOS_PRINT.version,isIOS:window.OPTYKER_IOS_PRINT.isIOS(),report:window.OPTYKER_REPORT.version,
      // The wrapped print is the page's last one: the inline print-wait fix (waits for images), not the first definition.
      base:String(window.printHtmlDocument.__optykerBase).indexOf('doc.images')>=0,
      editFn:typeof window.optykerEditDdt,viewFn:typeof window.optykerViewDdt,openDdt:typeof window.openOptykerDdt,
      perox:!!Array.prototype.some.call((document.getElementById('iuDocumentSelect')||{options:[]}).options,o=>o.value==='Pulizia Perossido.pdf')
    }));
    assert.deepEqual(info,{ddt:'20261126-ddt-edit1',ios:'20261126-ios-print1',isIOS:ipad,report:'20261126-visits1',base:true,editFn:'function',viewFn:'function',openDdt:'function',perox:true},entry+(ipad?' iPad':''));
    // The DDT list row binding carries the Modifica button (inline script of the real page).
    assert.equal(await page.evaluate(()=>Array.from(document.scripts).filter(s=>s.textContent.indexOf('OPTYKER_DDT_EDIT_20261126')>=0).length),1);
    assert.deepEqual(mine,[],'no errors from the new modules');
    await ctx.close();
   }
  }
  console.log('Pagina reale: Report 20261126-visits1, DDT Modifica e stampa iPad caricati nei tre accessi desktop (computer e iPad)');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});

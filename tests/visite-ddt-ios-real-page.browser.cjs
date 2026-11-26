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
    await page.waitForFunction(()=>window.OPTYKER_DDT_EDIT&&window.OPTYKER_IOS_PRINT&&window.OPTYKER_REPORT&&window.OPTYKER_CASH_IPAD_EDIT,null,{timeout:20000});
    assert.equal(await page.evaluate(()=>window.OPTYKER_CASH_IPAD_EDIT),'20261126-ipadedit1');
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
    if(ipad){
      // With the real page's own styles: in print only the document is visible, on screen nothing changes.
      await page.evaluate(()=>{window.__prints=0;window.print=function(){window.__prints++};
        window.printHtmlDocument('<!doctype html><html><head><style>@page{size:A4 portrait;margin:.01mm}html,body{margin:0!important;padding:0!important}body{font-size:20px;color:#172033}.sheet{padding:5mm}</style></head><body><div class="sheet"><div id="probe">INDICAZIONI D\'USO · PROVA</div></div></body></html>')});
      await page.waitForFunction(()=>window.__prints===1,null,{timeout:5000});
      const screen=await page.evaluate(()=>getComputedStyle(document.getElementById('optykerIosPrintHost')).display);
      await page.emulateMedia({media:'print'});
      const print=await page.evaluate(()=>{
        const host=document.getElementById('optykerIosPrintHost'),probe=host.shadowRoot.getElementById('probe'),r=probe.getBoundingClientRect(),cs=getComputedStyle(probe);
        const others=Array.from(document.body.children).filter(e=>e!==host&&e.tagName!=='SCRIPT'&&e.tagName!=='STYLE'&&e.tagName!=='TEMPLATE').filter(e=>{const s=getComputedStyle(e);return s.display!=='none'&&s.visibility!=='hidden'&&e.getBoundingClientRect().height>0}).map(e=>e.id||e.className||e.tagName);
        return {w:r.width,h:r.height,vis:cs.visibility,op:cs.opacity,font:cs.fontSize,others}
      });
      if(!(print.w>900&&print.h>10))console.log('DIAGNOSI stampa iPad', JSON.stringify(await page.evaluate(()=>{
        const host=document.getElementById('optykerIosPrintHost'),out={};
        const cs=e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect();return {display:s.display,visibility:s.visibility,position:s.position,overflow:s.overflow,height:s.height,width:s.width,zoom:s.zoom,transform:s.transform,contentVisibility:s.contentVisibility,box:[r.left,r.top,r.width,r.height]}};
        out.html=cs(document.documentElement);out.body=cs(document.body);out.host=cs(host);
        out.inner=['.optykerPrintHtml','.optykerPrintBody','.sheet'].map(s=>{const e=host.shadowRoot.querySelector(s);return e?[s,cs(e)]:[s,null]});
        out.rules=[];
        const walk=(rules,media)=>{for(const r of rules){try{
          if(r.cssRules&&r.media){walk(r.cssRules,(media?media+' ':'')+r.media.mediaText);continue}
          if(r.cssRules&&!r.selectorText){walk(r.cssRules,media);continue}
          if(!r.selectorText)continue;
          const hits=[host,document.body,document.documentElement].filter(e=>{try{return e.matches(r.selectorText)}catch(x){return false}}).map(e=>e===host?'host':e.tagName);
          if(hits.length&&/display|visibility|height|width|position|overflow|content|zoom|transform|opacity/.test(r.style.cssText))out.rules.push([media||'all',hits.join('+'),r.selectorText.slice(0,160),r.style.cssText.slice(0,220)]);
        }catch(x){}}};
        for(const sh of document.styleSheets){try{walk(sh.cssRules,'')}catch(x){out.rules.push(['inaccessibile',String(sh.href)])}}
        out.rules=out.rules.filter(r=>/print|all/.test(r[0]));
        return out
      })).slice(0,12000));
      await page.emulateMedia({media:'screen'});
      assert.equal(screen,'none');
      assert.ok(print.w>900&&print.h>10&&print.vis==='visible'&&print.op==='1'&&print.font==='20px','document visible in print '+JSON.stringify(print));
      assert.deepEqual(print.others,[],'only the document is printed');
      await page.evaluate(()=>window.dispatchEvent(new Event('afterprint')));
      await page.waitForFunction(()=>!document.getElementById('optykerIosPrintHost'));
    }
    assert.deepEqual(mine,[],'no errors from the new modules');
    await ctx.close();
   }
  }
  console.log('Pagina reale: Report 20261126-visits1, DDT Modifica e stampa iPad caricati nei tre accessi desktop (computer e iPad)');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});

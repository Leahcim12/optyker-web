// Read-only synthetic customer documents: no production account, save or signature mutation.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const {chromium} = require('playwright');
(async () => {
 const browser = await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
 const page = await browser.newPage();
 await page.route('https://consent.test/',r=>r.fulfill({body:'<html><head></head><body></body></html>',contentType:'text/html'}));
 await page.goto('https://consent.test/');
 await page.addScriptTag({path:'vendor/pdf-lib-1.17.1.min.js'});
 await page.addScriptTag({path:'_site/consent-documents.js'});
 await page.addScriptTag({path:'consent-document-loader.js'});
 await page.evaluate(()=>{
  window.ESC=window.signedQ=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  window.SD={};window.state={tab:'signed'};window.render=()=>{};
  window.KIND=window.SIGNED_KIND={lac:'Lenti a contatto',ortho:'Ortocheratologia'};
  window.token='SYNTHETIC';window.signedUrl='';window.shown=null;
  window.viewer=window.signedViewer=(title,inner,actions)=>{window.shown={title,inner,actions}};
  const c=document.createElement('canvas');c.width=300;c.height=100;const x=c.getContext('2d');x.font='30px serif';x.fillText('FIRMA DEMO',10,50);
  window.fixture={signature_data_url:c.toDataURL(),file_name:'Documento prova',data:{form:{patient:'Cliente Prova',date:'10/10/2026',orthoPrice:'700',lacPrice:'850'},html:'OLD BLANK DOCUMENT'}};
  window.rpc=window.signedRpc=async(name,args)=>({...fixture,kind:args.p_kind});
 });
 const app=fs.readFileSync('iphone-app-v13/index.html','utf8');
 const site=fs.readFileSync('shopify-warranty/signed-docs.js','utf8');
 await page.addScriptTag({content:app.slice(app.indexOf('window.openSignedDocument=async'),app.indexOf('  const basePage=page;',app.indexOf('window.openSignedDocument=async')))});
 await page.addScriptTag({content:site.slice(site.indexOf('function signedOpen('),site.indexOf('function renderSigned('))});
 for(const channel of ['app','site'])for(const kind of ['lac','ortho']){
  await page.evaluate(async({channel,kind})=>{
   window.shown=null;
   if(channel==='app')await openSignedDocument(kind,'SYNTHETIC');else signedOpen(kind,'SYNTHETIC',null);
  },{channel,kind});
  await page.waitForFunction(()=>!!window.shown);
  const result=await page.evaluate(async()=>{
   const m=shown.actions.match(/href="([^"]+)"/);const bytes=await (await fetch(m[1])).arrayBuffer();const pdf=await PDFLib.PDFDocument.load(bytes);
   return {pages:pdf.getPageCount(),actions:shown.actions,inner:shown.inner};
  });
  assert.equal(result.pages,kind==='lac'?5:8);
  assert(result.actions.includes(kind+'-firmato.pdf'));
  assert(result.actions.includes('Scarica PDF'));
  assert(result.inner.includes('data:image/png;base64,'));
  assert(result.inner.includes('Cliente Prova'));
  assert(result.inner.includes(kind==='lac'?'850 euro':'700 euro'));
  assert(!result.inner.includes('OLD BLANK DOCUMENT'));
  console.log(channel,kind,'complete signed preview and downloadable PDF verified');
 }
 await browser.close();
})();

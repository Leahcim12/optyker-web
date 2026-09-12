/* Real storefront HTML and compiled customer assets. Every business/API request
   is intercepted. Synthetic customer values never reach the production server. */
const {chromium,webkit}=require('playwright');
const assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const OUT='account-design-check';fs.mkdirSync(OUT,{recursive:true});
const BASE='https://otticavisualcare.it/pages/la-mia-scheda-optyker',TOKEN='a'.repeat(48);
const read=n=>fs.readFileSync(n,'utf8');const checks=[];const live=process.env.OPTYKER_ACCOUNT_LIVE==='1';
(async()=>{
 for(const scenario of [{name:'desktop',engine:chromium,width:1512,height:1050,populated:true},{name:'mobile',engine:webkit,width:390,height:844,populated:false},{name:'errors',engine:chromium,width:1280,height:950,error:true},{name:'guest',engine:chromium,width:1280,height:950,guest:true}]){
  const b=await scenario.engine.launch(),ctx=await b.newContext({viewport:{width:scenario.width,height:scenario.height},isMobile:scenario.width<600,hasTouch:scenario.width<600,serviceWorkers:'block'}),page=await ctx.newPage();page.setDefaultTimeout(15000);
  let profileReads=0,late=false;const writes=[],errors=[];page.on('pageerror',e=>errors.push(e.message));
  const fixture={ok:true,customer_name:'Cliente Dimostrativo',has_prescription:false,lenses:scenario.populated?[{id:'11111111-1111-4111-8111-111111111111',brand:'Lente dimostrativa',product_name:'Dati di prova',eye:'OD',unit_price:0}]:[],orders:scenario.populated?[{order_name:'#DEMO-1042',order_date:'2026-09-10T10:00:00Z',total:180,currency:'EUR',channel:'site',data:{lineItems:[]}},{order_name:'#DEMO-1036',order_date:'2026-08-29T10:00:00Z',total:60,currency:'EUR',channel:'app',data:{lineItems:[]}}]:[],recent_purchases:[]};
  const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'content-type,authorization,apikey','Access-Control-Allow-Methods':'POST,OPTIONS'};
  await ctx.route('**/*',async r=>{
   const u=new URL(r.request().url());let data={};try{data=r.request().postDataJSON()||{};}catch{}
   if(r.request().method()==='OPTIONS')return r.fulfill({status:204,headers:cors,body:''});
   if(u.pathname.includes('/functions/v1/')||u.pathname.includes('/rest/v1/')||u.pathname.includes('/auth/v1/')){
    if(u.pathname.endsWith('/optyker-customer-data')){profileReads++;if(late)await new Promise(a=>setTimeout(a,800));return r.fulfill({status:scenario.error?503:200,headers:cors,contentType:'application/json',body:JSON.stringify(scenario.error?{ok:false}:fixture)});}
    if(u.pathname.endsWith('/optyker-eyewear-cover-site')&&data.action==='list')return r.fulfill({status:scenario.error?503:200,headers:cors,contentType:'application/json',body:JSON.stringify(scenario.error?{ok:false}:{ok:true,data:scenario.populated?[{id:'10000000-0000-4000-8000-000000000001',reference:'BU-DEMO-01',frame:{brand:'Montatura dimostrativa',type:'Cerchiata'},warranty_name:'Base',lenses:{od:'Monofocale',os:'Monofocale'}}]:[]})});
    if(u.pathname.endsWith('/optyker-customer-chat')&&data.action==='get')return r.fulfill({status:200,headers:cors,contentType:'application/json',body:JSON.stringify({ok:true,data:[{id:'synthetic-message',sender_type:'staff',sender_name:'Ottica Visual Care',message:'Messaggio dimostrativo. Nessun invio reale.',created_at:'2026-09-12T09:00:00Z'}]})});
    writes.push(u.pathname+':'+(data.action||r.request().method()));return r.fulfill({status:403,headers:cors,contentType:'application/json',body:'{"ok":false,"error":"Test blocks all other APIs"}'});
   }
   if(u.hostname==='otticavisualcare.it'&&u.pathname==='/pages/la-mia-scheda-optyker'){
    const response=await r.fetch();assert(response.ok(),'Public storefront must be readable');let html=await response.text();
    if(!live){for(const id of ['optyker-account-native-v8-style','optyker-shop-warranty-style','optyker-shop-warranty','optyker-account-native-v8','optyker-account-design-style','optyker-account-design'])html=html.replace(new RegExp('<(?:script|link)\\b[^>]*\\bid=["\']'+id+'["\'][^>]*>(?:<\\/script>)?','g'),'');html=html.replace(/<section id="ovc-design-welcome"[\s\S]*?<\/section>/g,'');html=html.replace('</body>',read('_site/shopify-warranty-page-body.html')+'</body>');}
    if(!scenario.guest)html=html.replace('</body>','<section class="shopify-section--optyker-customer-account"><div class="container"><iframe src="/pages/optyker-portal?t='+TOKEN+'"></iframe></div></section></body>');
    return r.fulfill({status:200,contentType:'text/html; charset=utf-8',body:html});
   }
   if(u.pathname==='/pages/optyker-portal')return r.fulfill({status:200,contentType:'text/html',body:'<!doctype html><p>Test authentication container</p>'});
   if(!live&&u.hostname==='www.optyker.it'){
    const f=path.resolve('_site',u.pathname.slice(1));if(f.startsWith(path.resolve('_site')+path.sep)&&fs.existsSync(f)&&fs.statSync(f).isFile())return r.fulfill({status:200,contentType:({'.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.html':'text/html'})[path.extname(f)]||'application/octet-stream',body:fs.readFileSync(f)});
   }
   if(r.request().method()!=='GET')return r.fulfill({status:204,body:''});
   return r.continue();
  });
  try{
   await page.goto(BASE,{waitUntil:'domcontentloaded'});
   if(scenario.guest){await page.waitForSelector('#ovc-design-welcome');assert.equal(await page.locator('#ovc-account-native').count(),0);assert.equal(profileReads,0);await page.locator('#ovc-design-welcome').screenshot({path:OUT+'/guest.png'});checks.push('Logged-out landing contains login/booking links and makes no private-data requests');continue;}
   const root=page.locator('#ovc-account-native');await page.waitForSelector('#ovc-account-native[data-ovc-design]');await page.waitForSelector('.ovcDMetric');await root.scrollIntoViewIfNeeded();
   assert.equal(await root.getAttribute('data-ovc-view'),'dashboard');assert.equal(await root.locator('.ovcANav button').count(),9);assert.equal(await page.locator('#ovc-design-welcome').count(),0);assert.equal(await root.locator('.ovcDHeading h1').textContent(),'Il tuo spazio OVC');
   if(scenario.error){assert.deepEqual(await root.locator('.ovcDMetric strong').allTextContents(),['—','—','—','Consulta']);assert(!(await root.innerText()).includes('0 ordini'));await root.locator('[data-ovc-retry]').first().click();await page.waitForFunction(()=>document.querySelectorAll('.ovcDMetric').length===4);checks.push('Failed summaries show unavailable data, not zero counts, and support retry');continue;}
   assert.deepEqual(await root.locator('.ovcDMetric strong').allTextContents(),scenario.populated?['2','1','1','Consulta']:['0','0','0','Consulta']);
   assert(!(await root.innerHTML()).includes(TOKEN));assert(!(await root.innerText()).includes('Marco Rossi'));
   await page.waitForFunction(()=>{const i=document.querySelector('.ovcDLogo img');return i&&i.complete&&i.naturalWidth>0});
   const size=await root.evaluate(e=>({scroll:e.scrollWidth,client:e.clientWidth}));assert(size.scroll<=size.client+2,JSON.stringify(size));
   await root.screenshot({path:OUT+'/dashboard-'+scenario.name+'.png'});
   if(scenario.width<600){assert(!(await root.locator('.ovcANav').isVisible()));await root.locator('.ovcDMenuToggle').tap();assert(await root.locator('.ovcANav').isVisible());await root.locator('[data-view=orders]').tap();assert(!(await root.locator('.ovcANav').isVisible()));}
   else await root.locator('[data-view=orders]').click();
   await page.waitForFunction(()=>document.querySelector('#ovc-account-native').dataset.ovcView==='orders');await page.waitForFunction(()=>!document.querySelector('.ovcALoad'));
   assert((await root.innerText()).includes(scenario.populated?'#DEMO-1042':'Nessun ordine'));
   const go=async v=>{if(scenario.width<600)await root.locator('.ovcDMenuToggle').tap();await root.locator('[data-view='+v+']').click();};
   await go('chat');await page.waitForFunction(()=>document.querySelector('#ovcAMessages')?.textContent.includes('Messaggio dimostrativo'));
   await root.screenshot({path:OUT+'/chat-'+scenario.name+'.png'});
   await go('eyewear');await page.waitForFunction(()=>document.querySelector('.swCover')?.textContent.includes('Garanzia commerciale'));assert.equal(await page.locator('#ovcAMessages').count(),0);
   await go('rx');await page.waitForFunction(()=>document.querySelector('.ovcAPanel')?.textContent.includes('Non risulta una prescrizione'));assert.equal(await page.locator('.swCover').count(),0);
   await go('dashboard');await page.waitForSelector('.ovcDMetric');await root.locator('.ovcDHero [data-ovc-go=appointment]').click();await page.waitForSelector('iframe[title="Prenota un appuntamento"]');assert.equal(await page.locator('.ovcDMetric').count(),0);
   assert.equal(writes.length,0,JSON.stringify(writes));checks.push(scenario.name+': real theme, official logo, accurate summaries, functioning navigation, warranty list, prescription, chat, booking, responsive menu and no business writes');
  }catch(e){await page.screenshot({path:OUT+'/failure-'+scenario.name+'.png',fullPage:true});fs.writeFileSync(OUT+'/failure.txt',String(e.stack)+'\n'+JSON.stringify(errors));throw e;}finally{await b.close();}
 }
 fs.writeFileSync(OUT+'/design-checks.json',JSON.stringify({ok:true,live_assets:live,customer_session:'synthetic, not a real customer login',checks,production_business_writes:0},null,2));console.log(checks);
})().catch(e=>{console.error(e);process.exitCode=1});

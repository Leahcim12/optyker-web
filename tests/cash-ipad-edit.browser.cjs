/* Cassa 20261126: il prezzo scritto nel carrello non torna più quello di prima su iPad.
   Usa il cash-register.js vero della build (CASH_JS, di default _site/cash-register.js) su una pagina minima, con
   API della cassa simulate (nessun dato reale). Su iPad il tocco sul campo ridà il focus alla finestra (WebKit bug
   254882): qui lo si simula con l'evento «focus» della finestra mentre si scrive.
   CASH_EXPECT_BUG=1: verifica invece che il file senza correzione perda il prezzo (per provare il test).
   CASH_ENGINE=webkit: stesso controllo con il motore di Safari. */
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const {chromium,webkit}=require('playwright');
const WEBKIT=process.env.CASH_ENGINE==='webkit';
const root=path.resolve(__dirname,'..');
const CASH_JS=path.resolve(process.env.CASH_JS||path.join(root,'_site','cash-register.js'));
const CASH_CSS=path.resolve(process.env.CASH_CSS||path.join(path.dirname(CASH_JS),'cash-register.css'));
const EXPECT_BUG=process.env.CASH_EXPECT_BUG==='1';
const PRODUCTS=[
  {variant_id:'v1',product_id:'p1',title:'Lenti mensili Air Optix',variant_title:'Default Title',sku:'AO-6',price:45.9,list_price:45.9,inventory_quantity:10,product_type:'Lenti a contatto',fiscal_vat_code:'04',vat_code:'04',fiscal_item_type:'BENE'},
  {variant_id:'v2',product_id:'p2',title:'Soluzione unica 360 ml',variant_title:'Default Title',sku:'SOL-360',price:12.5,list_price:12.5,inventory_quantity:20,product_type:'Soluzioni',fiscal_vat_code:'22',vat_code:'22',fiscal_item_type:'BENE'}
];
const PAGE='<!DOCTYPE html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Optyker</title><link rel="stylesheet" href="/cash-register.css"></head>'+
  '<body><div id="mainApp"><button id="optykerTopNewClientBtn" type="button">Cassa</button></div>'+
  '<script>window.OPTYKER_CLOUD={username:"Operatore Prova",password:"password-di-prova",clients:[]};window.OPTYKER_ACTIVE_USER="Operatore Prova";</script>'+
  '<script src="/cash-register.js"></script></body></html>';

(async()=>{
 const browser=WEBKIT?await webkit.launch({headless:true}):await chromium.launch({headless:true,...(process.env.CHROME_EXECUTABLE_PATH?{executablePath:process.env.CHROME_EXECUTABLE_PATH}:{})});
 const ctx=await browser.newContext({viewport:{width:1180,height:820},locale:'it-IT',hasTouch:true,serviceWorkers:'block',
   userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15'});
 const page=await ctx.newPage(),errors=[],calls=[];
 page.on('pageerror',e=>errors.push(String(e)));page.on('dialog',d=>d.dismiss());
 await ctx.route('**/*',async route=>{
   const req=route.request(),u=new URL(req.url());
   if(u.hostname==='optyker.test'){
     const files={'/':PAGE,'/index.html':PAGE};
     if(files[u.pathname])return route.fulfill({status:200,contentType:'text/html',body:files[u.pathname]});
     if(u.pathname==='/cash-register.js')return route.fulfill({status:200,contentType:'text/javascript',body:fs.readFileSync(CASH_JS)});
     if(u.pathname==='/cash-register.css')return route.fulfill({status:200,contentType:'text/css',body:fs.existsSync(CASH_CSS)?fs.readFileSync(CASH_CSS):''});
     return route.fulfill({status:404,body:''});
   }
   if(u.hostname.endsWith('supabase.co')){
     const H={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'GET,POST,OPTIONS'};
     if(req.method()==='OPTIONS')return route.fulfill({status:204,headers:H});
     let b={};try{b=JSON.parse(req.postData()||'{}')}catch(e){}
     const fn=u.pathname.split('/').pop();calls.push(fn+':'+(b.action||''));
     if(fn==='optyker-cash-register-api'&&b.action==='products')return route.fulfill({status:200,headers:H,contentType:'application/json',body:JSON.stringify({ok:true,data:PRODUCTS})});
     if(fn==='optyker-cash-register-api')return route.fulfill({status:200,headers:H,contentType:'application/json',body:JSON.stringify({ok:true,data:[]})});
     return route.abort();
   }
   return route.abort();
 });
 try{
  await page.goto('https://optyker.test/');
  await page.waitForFunction(()=>window.__optykerCashLoaded===true);
  await page.click('#optykerTopNewClientBtn');
  await page.waitForSelector('#optykerCashOverlay.open');
  await page.click('#optykerCashFindProducts');
  await page.waitForSelector('#optykerCashProducts [data-variant="v1"]');
  await page.click('#optykerCashProducts [data-variant="v1"]');
  await page.click('#optykerCashProducts [data-variant="v2"]');
  await page.evaluate(()=>{const d=document.getElementById('optykerCashProductPicker');if(d&&d.open)d.close()});
  await page.waitForSelector('#optykerCashCartItems [data-price="v1"]');
  await page.waitForTimeout(400);
  const price=()=>page.inputValue('#optykerCashCartItems [data-price="v1"]');
  assert.match(await price(),/^45[.,]90$/);

  // iPad: tap on «Prezzo unitario», the window gets focus back, the operator types the new price.
  await page.evaluate(()=>{window.__field=document.querySelector('#optykerCashCartItems [data-price="v1"]')});
  await page.tap('#optykerCashCartItems [data-price="v1"]');
  await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
  await page.fill('#optykerCashCartItems [data-price="v1"]','');
  await page.keyboard.type('39,9');
  await page.waitForTimeout(900); // focus refreshes (OVC tariffs, balances) and their async renders
  const still=await page.evaluate(()=>{const f=document.querySelector('#optykerCashCartItems [data-price="v1"]');return {same:f===window.__field,focused:document.activeElement===window.__field,value:window.__field.value,type:window.__field.type}});
  if(EXPECT_BUG){
    assert.ok(!still.same||!still.focused||still.value!=='39,9','without the fix the cart is redrawn while typing');
    console.log('Cassa iPad: senza correzione il campo viene ridisegnato mentre si scrive ('+JSON.stringify(still)+')');
    return;
  }
  // Text field with decimal keypad: the comma is accepted whatever the iPad language.
  assert.deepEqual(still,{same:true,focused:true,value:'39,9',type:'text'},'the field being edited is kept');
  assert.equal(await page.getAttribute('#optykerCashCartItems [data-price="v1"]','inputmode'),'decimal');
  // Leaving the field (iPad «Fine» / tap elsewhere): the price is applied, then the postponed refreshes run.
  const before=calls.length;
  await page.click('.optykerCashTotalRow');
  await page.waitForFunction(()=>document.querySelector('#optykerCashCartItems [data-price="v1"]').value==='39,90');
  const lineTotal=v=>page.$eval('#optykerCashCartItems [data-price="'+v+'"]',i=>i.closest('.optykerCashCartItem').querySelector('.optykerCashLineTotal').textContent);
  assert.match(await lineTotal('v1'),/39,90/);
  await page.waitForTimeout(600);
  assert.ok(calls.length>before,'the refresh postponed during typing runs after the field is left: '+calls.slice(before).join(','));
  assert.match(await page.textContent('#optykerCashCartItems'),/Prezzo precedente\s*45,90/);
  // A window focus while not typing redraws as before (shortly after).
  await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
  await page.waitForTimeout(600);
  assert.equal(await price(),'39,90');
  // Desktop flow unchanged: Enter confirms right away while the cursor is still in the field.
  await page.click('#optykerCashCartItems [data-price="v2"]');
  await page.fill('#optykerCashCartItems [data-price="v2"]','10');
  await page.keyboard.press('Enter');
  await page.waitForFunction(()=>document.querySelector('#optykerCashCartItems [data-price="v2"]').value==='10,00');
  assert.match(await lineTotal('v2'),/10,00/);
  // «Da pagare ora» (checkbox in the row) still redraws the cart at once.
  const payLine=v=>page.$eval('#optykerCashCartItems [data-pay-line="'+v+'"]',i=>i.checked);
  await page.click('#optykerCashCartItems [data-pay-line="v2"]');
  await page.waitForFunction(()=>/Da pagare in seguito/.test(document.getElementById('optykerCashCartItems').textContent));
  assert.equal(await payLine('v2'),false);
  await page.click('#optykerCashCartItems [data-pay-line="v2"]');
  await page.waitForFunction(()=>!/Da pagare in seguito/.test(document.getElementById('optykerCashCartItems').textContent));
  assert.equal(await payLine('v2'),true);
  // Invalid value: message and previous price, as before.
  await page.click('#optykerCashCartItems [data-price="v2"]');
  await page.fill('#optykerCashCartItems [data-price="v2"]','');
  await page.click('.optykerCashTotalRow');
  await page.waitForFunction(()=>/prezzo valido/.test((document.getElementById('optykerCashToast')||{}).textContent||''));
  assert.equal(await page.inputValue('#optykerCashCartItems [data-price="v2"]'),'10,00');
  assert.equal(await page.evaluate(()=>window.OPTYKER_CASH_IPAD_EDIT),'20261126-ipadedit1');
  // WebKit reports the requests this test blocks (local print bridge, other APIs) as page errors: not app errors.
  assert.deepEqual(errors.filter(e=>!/Fetch API cannot load .* due to access control checks/.test(e)),[]);
  console.log('Cassa iPad ('+(WEBKIT?'WebKit':'Chromium')+'): il prezzo scritto resta mentre si scrive, si applica uscendo dal campo; ricalcoli dopo; PC invariato');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});

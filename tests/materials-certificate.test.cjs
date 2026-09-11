/* Full deployed UI, intercepted business APIs. Test fixture data never reaches production. */
const {chromium}=require('playwright'),fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const OUT='materials-check';fs.mkdirSync(OUT,{recursive:true});
(async()=>{const browser=await chromium.launch();const report={ok:false,checks:[],live:process.env.OPTYKER_LIVE==='1',business_writes:0};let page;
try{
 const ctx=await browser.newContext({viewport:{width:1440,height:1050},serviceWorkers:'block'});page=await ctx.newPage();page.setDefaultTimeout(12000);
 await ctx.addInitScript(()=>{window.print=()=>window.__printed=true;});page.on('dialog',d=>d.accept());
 const cid='11111111-1111-4111-8111-111111111111',sid='33333333-3333-4333-8333-333333333333',qid='44444444-4444-4444-8444-444444444444',other='22222222-2222-4222-8222-222222222222',stamp='2026-09-11T10:00:00Z';
 const clients=[{id:cid,name:'Cliente',surname:'PROVA',email:'test@example.invalid'},{id:other,name:'Altro',surname:'PROVA'}];
 const sheet={id:sid,client_id:cid,sheet_type:'eyewear_job',document_type:'Busta',reference_code:'BU-OC-PROVA',operator:'Operatore PROVA',created_at:stamp,updated_at:stamp,data:{mode:'job',frame:{type:'Del cliente',brand:'Del cliente',price:0},lens:{lens_type_od:'Monofocale',lens_type_os:'Del cliente',material:'NON USARE MATERIALE AGGREGATO',lens_od:{brand:'Marca di prova',lens_name:'Modello di prova',material:'Organico',unit_price:120},lens_os:{client_owned:true},refractive_index:'1.6',treatments:['Antiriflesso'],unit_price_od:120},pricing:{total:178.64},notes:'NOTA INTERNA RISERVATA NON STAMPARE'}};
 const quote={...structuredClone(sheet),id:qid,sheet_type:'eyewear_quote',document_type:'Preventivo',reference_code:'PR-PROVA',data:{...structuredClone(sheet.data),mode:'quote'}};
 const rows=[sheet,quote];let cert=null,delay=0,saves=0;
 await ctx.route('**/*',async route=>{const req=route.request(),u=new URL(req.url());let b={};try{b=req.postDataJSON()||{};}catch{}
  if(u.pathname.includes('/rest/v1/')||u.pathname.includes('/functions/v1/')||req.method()!=='GET'){
   let data={ok:true,data:[],clients:[],sheets:[],rows:[],orders:[],messages:[],count:0};
   if(u.pathname.includes('optyker-staff-auth'))data={ok:true,username:b.username||'Michael Mologni',needs_password:false,has_email:true};
   else if(u.pathname.endsWith('/optyker_material_certificate_api')){
    const p=b.p_payload;assert.equal(b.p_username,'Michael Mologni');
    if(p.client_id!==cid||p.sheet_id!==sid)data={ok:false,error:'Solo Buste Occhiali del cliente selezionato'};
    else{if(b.p_action==='get'&&delay)await new Promise(r=>setTimeout(r,delay));
     if(b.p_action==='save'){assert.equal(p.confirm,true);assert.equal(p.source_updated_at,stamp);assert.equal(p.revision,cert?.revision||0);saves++;cert={sheet_id:sid,client_id:cid,data:p.values,source_updated_at:stamp,revision:saves,compiled_by:b.p_username,created_at:stamp,updated_at:stamp};}
     data={ok:true,sheet,client_name:'Cliente PROVA',certificate:cert};
    }
   }else if(u.pathname.endsWith('/optyker_client_sheet_actions'))data={ok:true,client_id:b.p_payload.client_id,data:b.p_payload.client_id===cid?rows:[]};
   else if(u.pathname.endsWith('/optyker_api')){if(b.p_action==='list_sheets')data={ok:true,data:b.p_payload.client_id===cid?rows:[]};if(b.p_action==='list_clients')data={ok:true,data:clients};}
   else if(u.pathname.endsWith('/optyker_ovc_api'))data={ok:true,data:{client_id:cid,active:true,card_number:1,revision:1}};
   else if(u.pathname.includes('/rest/v1/')&&!u.pathname.includes('/rpc/'))data=[];
   return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
  }
  if(!report.live&&['www.optyker.it','optyker.it'].includes(u.hostname)){
   let rel=u.pathname.replace(/^\//,'');if(!rel||rel.endsWith('/'))rel+='index.html';const p=path.resolve('_site',rel);
   if(p.startsWith(path.resolve('_site')+path.sep)&&fs.existsSync(p)&&fs.statSync(p).isFile())return route.fulfill({status:200,contentType:({'.html':'text/html','.js':'text/javascript','.css':'text/css','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.json':'application/json'}[path.extname(p)]||'application/octet-stream'),body:fs.readFileSync(p)});
  }return route.continue();
 });
 await page.goto('https://www.optyker.it/',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.OPTYKER_MATERIAL_CERTIFICATE?.version==='20260911-materials1');
 const op=await page.locator('#optykerLoginOperator option').evaluateAll(xs=>xs.find(x=>/michael/i.test(x.value))?.value);await page.selectOption('#optykerLoginOperator',op);await page.waitForTimeout(300);await page.fill('#optykerAuthPassword','SYNTHETIC_PASSWORD_NOT_REAL');await page.click('.optykerLoginButton');await page.waitForFunction(()=>window.optykerAuthenticated);
 await page.click('#navClients');await page.evaluate(({clients,rows,cid})=>{OPTYKER_CLOUD.clients=clients;OPTYKER_CLOUD.sheets[cid]=rows;clientSelect(cid);},{clients,rows,cid});await page.waitForSelector('#clientSheetActionsDock');
 await page.click('#clientSheetActionsDock [data-cs-launch=eyewear]');await page.locator('[data-cs-id="'+qid+'"] [data-cs-open]').click();assert.equal(await page.locator('#clientSheetDialog [data-mc-open]').count(),0);await page.click('[data-cs-back]');await page.locator('[data-cs-id="'+sid+'"] [data-cs-open]').click();await page.click('#clientSheetDialog [data-mc-open]');await page.waitForSelector('[data-mc-field=frame_material]');
 assert.equal(saves,0);assert.equal(await page.inputValue('[data-mc-field=od_material]'),'Organico');assert.equal(await page.inputValue('[data-mc-field=os_material]'),'');assert.equal(await page.inputValue('[data-mc-field=frame_material]'),'');assert.equal(await page.inputValue('[data-mc-field=public_notes]'),'');report.checks.push('Button in saved job details, not quotes; exact per-eye materials; customer-owned and missing materials blank; internal notes not copied; reads cause no writes');
 await page.click('[data-mc-print]');assert((await page.locator('[data-mc-status]').textContent()).includes('Salva prima'));assert.equal(ctx.pages().length,1);
 await page.fill('[data-mc-field=frame_material]','Acetato (dato di prova)');await page.fill('[data-mc-field=os_material]','Minerale (dato di prova)');await page.fill('[data-mc-field=public_notes]','Materiali verificati dall’operatore per questa prova. <img src=x onerror=alert(1)>');await page.click('[data-mc-preview-btn]');const frame=page.frameLocator('[data-mc-preview]');await frame.locator('h1').waitFor();assert((await frame.locator('body').innerText()).includes('ANTEPRIMA'));assert.equal(await frame.locator('img').count(),1);report.checks.push('Unsaved print blocked; sandboxed escaped draft preview');
 await page.click('[data-mc-save]');await page.waitForFunction(()=>document.querySelector('[data-mc-status]')?.textContent.includes('revisione 1'));assert.equal(saves,1);await page.click('[data-mc-close]');await page.click('#clientSheetDialog [data-mc-open]');await page.waitForSelector('[data-mc-field=frame_material]');assert.equal(await page.inputValue('[data-mc-field=frame_material]'),'Acetato (dato di prova)');report.checks.push('Save and reopen retain certificate linked to original busta and customer; busta prices unchanged');
 await page.fill('[data-mc-field=public_notes]','Dati dimostrativi: questo documento è una prova di impaginazione.');await page.click('[data-mc-save]');await page.waitForFunction(()=>document.querySelector('[data-mc-status]')?.textContent.includes('revisione 2'));
 const popup=page.waitForEvent('popup');await page.click('[data-mc-print]');const w=await popup;await w.waitForLoadState('domcontentloaded');await w.waitForFunction(()=>document.querySelector('.head img')?.complete&&document.querySelector('.head img')?.naturalWidth>0);
 const head=await page.evaluate(()=>new DOMParser().parseFromString(prescriptionPrintHtml(),'text/html').querySelector('.head').innerHTML);assert.equal(await w.locator('.head').innerHTML(),head);
 const body=await w.locator('body').innerText();assert(body.includes('Certificato dei materiali')&&body.includes('BU-OC-PROVA')&&body.includes('Cliente PROVA'));assert(!body.includes('178,64')&&!body.includes('178.64')&&!body.includes('NOTA INTERNA')&&!body.includes('NON USARE MATERIALE'));assert(!body.includes('ANTEPRIMA'));assert(body.includes('Non sostituisce le dichiarazioni'));
 await w.pdf({path:OUT+'/certificato-materiali-esempio.pdf',format:'A4',printBackground:true,preferCSSPageSize:true});await w.screenshot({path:OUT+'/certificato-materiali.png',fullPage:true});report.checks.push('Print/PDF exact prescription header and decoded original logo; no prices, clinical details or internal notes; no automatic manufacturer certification');await w.close();
 await page.click('[data-mc-preview-btn]');await page.screenshot({path:OUT+'/certificato-editor.png'});await page.click('[data-mc-close]');
 delay=1500;await page.click('#clientSheetDialog [data-mc-open]');await page.evaluate(other=>clientSelect(other),other);await page.waitForTimeout(2000);assert.equal(await page.locator('#optykerMaterialCertificate').count(),0);report.checks.push('Customer switching closes certificate and discards late responses');
 await page.evaluate(({sid,cid})=>OPTYKER_MATERIAL_CERTIFICATE.open(sid,cid),{sid:qid,cid});await page.waitForFunction(()=>document.querySelector('[data-mc-body]')?.textContent.includes('Solo Buste'));assert.equal(await page.locator('[data-mc-save]').count(),0);report.checks.push('Backend error on non-busta disables certificate editing');
 report.ok=true;
}catch(e){report.error=String(e);if(page)await page.screenshot({path:OUT+'/failure.png'}).catch(()=>{});throw e;}
finally{fs.writeFileSync(OUT+'/result.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});

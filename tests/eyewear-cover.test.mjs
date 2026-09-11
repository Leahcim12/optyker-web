// Actual production SQL and edge handler with disposable PostgreSQL, plus the complete built app.
import {createRequire} from 'node:module';import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
import {createHandler,validateReport} from '../supabase/functions/optyker-eyewear-cover/handler.mjs';
const require=createRequire(import.meta.url),{Pool}=require('pg'),{chromium,webkit}=require('playwright');
const pg=new Pool({host:'localhost',user:'postgres',password:'synthetic_ci_only',database:'warranty_test'});
const OUT='warranty-check';fs.mkdirSync(OUT,{recursive:true});const checks=[];
const UID='11111111-1111-4111-8111-111111111111',OTHER='22222222-2222-4222-8222-222222222222';
const sid=n=>'10000000-0000-4000-8000-'+String(n).padStart(12,'0');
const query=(sql,p=[])=>pg.query(sql,p);
const cust=async(a,p,u=UID)=>(await query('select public.optyker_eyewear_cover_customer($1,$2,$3) x',[u,a,p])).rows[0].x;
const staff=async(a,p)=>(await query('select public.optyker_eyewear_cover_staff($1,$2,$3,$4) x',['Test operator','synthetic_password_only',a,{...p,client_id:UID}])).rows[0].x;
const request=(n,reason,eye='',extra={})=>cust('request',{sheet_id:sid(n),request_id:crypto.randomUUID(),reason,eye,confirm:true,...extra});
const reportData='data:application/pdf;base64,'+Buffer.from('%PDF-1.4\nSynthetic police-report attachment for test only\n%%EOF').toString('base64');
const report=async(n=4)=>{const p={sheet_id:sid(n),request_id:crypto.randomUUID(),confirm:true,attachment_data:reportData,attachment_name:'denuncia-esempio.pdf',attachment_type:'application/pdf'};validateReport(p);return {p,x:await cust('report',p)};};
const good=x=>assert.equal(x.ok,true,JSON.stringify(x));const bad=x=>assert.equal(x.ok,false,JSON.stringify(x));
try{
 for(const tier of ['Base','Silver','Gold']){
  const d={warranty:tier,frame:{type:'Cerchiata'}};const val=async(date)=>(await query('select public.optyker_eyewear_cover_rules($1,$2,$3) x',[d,'2025-01-15',date])).rows[0].x;
  const a=await val('2025-01-15'),b=await val('2026-01-15'),end=await val('2027-01-15');assert.equal(end.state,'expired');assert(end.benefits.every(x=>!x.eligible));
  assert.equal(a.benefits.find(x=>x.reason==='broken_frame').discount_percent,tier==='Base'?50:100);assert.equal(b.benefits.find(x=>x.reason==='broken_frame').discount_percent,tier==='Base'?null:50);
  for(const r of ['right_temple','left_temple'])assert.equal(b.benefits.find(x=>x.reason===r).discount_percent,100);
  if(tier==='Base'){assert.equal(a.benefits[0].discount_percent,50);assert.equal(b.benefits[0].discount_percent,25);assert.equal(a.benefits[0].max_total,2);assert(!a.benefits.some(x=>x.reason==='loss'));}
  else {assert.equal(b.benefits.find(x=>x.reason==='loss').discount_percent,50);assert(!b.benefits.some(x=>x.reason==='scratched_lens'));}
 }
 const own=await cust('get',{sheet_id:sid(1)});good(own);assert.equal(own.coverage.name,'Base solo lenti');assert.equal(own.coverage.benefits.length,1);bad(await request(1,'broken_frame'));bad(await request(1,'loss'));
 checks.push('All requested plans and year boundaries: Base lens-only, Base, Silver and Gold; no unstated scratched-lens benefit added to Silver/Gold');
 const missing=await cust('get',{sheet_id:sid(5)});assert.equal(missing.coverage.state,'pending_activation');bad(await request(5,'scratched_lens','OD'));bad(await cust('activate',{sheet_id:sid(5),confirm:true}));
 good(await cust('get',{sheet_id:sid(9)}));assert.equal((await cust('get',{sheet_id:sid(9)})).coverage.state,'active');
 bad(await cust('get',{sheet_id:sid(6)}));bad(await cust('get',{sheet_id:sid(1)},OTHER));assert(!JSON.stringify(own).includes('PRIVATE NOTE'));assert(!JSON.stringify(own).includes('confidential_cost'));
 const forbidden=await pg.connect();try{await forbidden.query('set role anon');await assert.rejects(()=>forbidden.query('select public.optyker_eyewear_cover_customer($1,$2,$3)',[UID,'get',{sheet_id:sid(1)}]));await assert.rejects(()=>forbidden.query('select * from public.optyker_eyewear_claims'));}finally{await forbidden.query('reset role');forbidden.release();}
 checks.push('Customer cannot activate/change date or access another customer; service-only RPC, RLS and no confidential fields');
 const p={sheet_id:sid(2),request_id:crypto.randomUUID(),reason:'scratched_lens',eye:'OD',confirm:true};good(await cust('request',p));assert((await cust('request',p)).already_requested);assert((await request(2,'scratched_lens','OD')).already_requested);
 const second=await request(2,'scratched_lens','OS');good(second);bad(await request(2,'scratched_lens','entrambi'));
 good(await staff('resolve',{sheet_id:sid(2),request_id:p.request_id,status:'fulfilled',confirm:true}));bad(await request(2,'scratched_lens','OD'));
 good(await staff('resolve',{sheet_id:sid(2),request_id:second.data.id,status:'rejected',confirm:true}));good(await request(2,'scratched_lens','OD'));
 await assert.rejects(()=>query("insert into optyker_eyewear_warranty_replacements(warranty_id,replaced_on,lens_list_price,discount_percent,created_by) select id,current_date,100,50,'Test' from optyker_eyewear_warranty_instances where source_sheet_id=$1",[sid(2)]));
 const parallel=await Promise.all(['OD','OS','entrambi'].map(eye=>request(8,'scratched_lens',eye)));assert.equal(parallel.filter(x=>x.ok).length,2);
 checks.push('Two shared replacements enforced under concurrent requests; repeat taps idempotent; rejected request releases quota; legacy manual flow cannot bypass');
 bad(await request(4,'loss'));const rep=await report();good(rep.x);assert((await cust('report',rep.p)).already_sent);bad(await cust('report',{...rep.p,attachment_data:reportData+'AAAA'}));bad(await request(3,'loss','',{evidence_message_id:rep.x.evidence_message_id}));
 const loss=await request(4,'loss','',{evidence_message_id:rep.x.evidence_message_id});good(loss);assert.equal(loss.data.discount_percent,50);bad(await staff('resolve',{sheet_id:sid(4),request_id:loss.data.id,status:'fulfilled',confirm:true}));good(await staff('resolve',{sheet_id:sid(4),request_id:loss.data.id,status:'fulfilled',confirm:true,report_verified:true}));
 assert.throws(()=>validateReport({attachment_data:'data:application/pdf;base64,'+Buffer.from('a'.repeat(80)).toString('base64')}));assert.throws(()=>validateReport({attachment_data:'data:image/svg+xml;base64,PHN2Zz4='}));
 checks.push('Loss requires report in same customer/busta chat; PDF/photo validation; explicit staff evidence review required');
 const cert=await cust('certificate',{sheet_id:sid(9)});good(cert);assert(cert.data.pdf_sha256);bad(await cust('certificate',{sheet_id:sid(9)},OTHER));assert.equal((await cust('certificate',{sheet_id:sid(1)})).data,null);
 const handler=createHandler({url:'https://test.invalid',anonKey:'public_test_key',serviceKey:'secret_test_key',fetcher:async(url,o)=>{
  if(url.endsWith('/auth/v1/user'))return new Response(JSON.stringify(o.headers.Authorization==='Bearer synthetic_customer_jwt'?{id:UID,email_confirmed_at:'2026-01-01'}:{}),{status:o.headers.Authorization==='Bearer synthetic_customer_jwt'?200:401});
  const p=JSON.parse(o.body);return new Response(JSON.stringify(await cust(p.p_action,p.p_payload,p.p_user_id)),{status:200});
 }});
 const endpoint=(auth,action,payload)=>handler(new Request('https://test.invalid/functions/v1/optyker-eyewear-cover',{method:'POST',headers:{'Content-Type':'application/json',...(auth?{Authorization:auth}:{})},body:JSON.stringify({action,payload})}));
 assert.equal((await endpoint('','get',{sheet_id:sid(1)})).status,401);assert.equal((await endpoint('Bearer bad','get',{sheet_id:sid(1)})).status,401);assert.equal((await endpoint('Bearer synthetic_customer_jwt','activate',{sheet_id:sid(1)})).status,400);
 bad(await (await endpoint('Bearer synthetic_customer_jwt','get',{sheet_id:sid(6),client_id:OTHER,user_id:OTHER})).json());
 checks.push('Actual edge handler validates Auth response, ignores supplied identity and rejects unauthorized/unsupported actions');
 for(const [engine,engineName] of [[chromium,'chromium'],[webkit,'webkit']]){
  const browser=await engine.launch({headless:true});const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block'});const page=await context.newPage();page.setDefaultTimeout(10000);const errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('dialog',d=>d.accept());
  const activeSheet=engineName==='chromium'?7:1;
  await context.route('**/*',async route=>{
   const req=route.request(),url=new URL(req.url());let b={};try{b=req.postDataJSON()||{};}catch{}
   const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,content-type','Access-Control-Allow-Methods':'POST,OPTIONS'};
   if(url.pathname.endsWith('/optyker-eyewear-cover')){if(req.method()==='OPTIONS')return route.fulfill({status:204,headers:cors,body:''});const response=await endpoint(req.headers()['authorization'],b.action,b.payload);return route.fulfill({status:response.status,headers:cors,contentType:'application/json',body:await response.text()});}
   if(url.pathname.includes('/rest/v1/')||url.pathname.includes('/functions/v1/')||url.pathname.includes('/auth/v1/')){
    let data={ok:true,data:[]};if(b.action==='chat_get')data.data=(await query('select * from optyker_chat_messages where client_id=$1 order by created_at',[UID])).rows;
    if(b.action==='me')data={ok:true,data:{role:'customer',customer:{id:UID,name:'Cliente',surname:'Dimostrativo'}}};
    return route.fulfill({status:200,headers:cors,contentType:'application/json',body:JSON.stringify(data)});
   }
   if(!process.env.OPTYKER_LIVE&&url.hostname==='www.optyker.it'){
    let rel=url.pathname.replace(/^\//,'');if(rel.endsWith('/'))rel+='index.html';const f=path.resolve('_site',rel);
    if(f.startsWith(path.resolve('_site')+path.sep)&&fs.existsSync(f)&&fs.statSync(f).isFile())return route.fulfill({status:200,contentType:({'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.png':'image/png','.json':'application/json','.webmanifest':'application/manifest+json'})[path.extname(f)]||'application/octet-stream',body:fs.readFileSync(f)});
   }
   if(!process.env.OPTYKER_LIVE)return route.fulfill({status:404,body:''});return route.continue();
  });
  try{
   await page.goto('https://www.optyker.it/iphone-app-v13/?check=eyewear-cover1',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>!!window.OPTYKER_APP_COVER);
   await page.evaluate(({uid,sheet})=>{sb.auth.getSession=async()=>({data:{session:{access_token:'synthetic_customer_jwt'}}});state.me={role:'customer',customer:{id:uid,name:'Cliente',surname:'Dimostrativo'}};state.home={customer:state.me.customer,orders:[]};state.session={access_token:'synthetic_customer_jwt'};state.eyewear=[{id:sheet,reference:'BU-TEST',registered_at:'2026-09-11',frame:{type:'Del cliente',brand:'Del cliente'},lenses:{od:{name:'Lente esempio'},os:{name:'Lente esempio'},treatments:['UV']},warranty:{name:'Base'}}];shell();goTab('eyewear');},{uid:UID,sheet:sid(activeSheet)});
   await page.waitForSelector('[data-cover-open]');assert.equal(await page.locator('.refSpec:not(.coverOpen) .refSpecArrow').count(),0);assert.equal(await page.locator('.coverOpen').getAttribute('type'),'button');assert((await page.locator('.refWarrantyGold').innerText()).includes('Base solo lenti'));
   await page.locator('[data-cover-open]').first().tap();await page.waitForSelector('[data-cover-reason]');assert.equal(await page.locator('[data-cover-reason]').count(),1);assert((await page.locator('#ovcAppCover').innerText()).includes('Massimo 2 ricambi'));await page.screenshot({path:OUT+'/garanzia-'+engineName+'.png'});
   await page.locator('[data-cover-reason]').tap();await page.selectOption('[data-cover-eye]','OD');await page.locator('[data-cover-send]').tap();await page.waitForFunction(()=>document.querySelector('[data-cover-status]')?.textContent.includes('Richiesta ricevuta'));assert((await page.locator('#ovcAppCover').innerText()).includes('In attesa dell’ottica'));
   await page.locator('[data-cover-chat]').tap();await page.waitForSelector('#chatInput');assert((await page.locator('#chatMessages').innerText()).includes('Richiesta garanzia Base solo lenti'));
   await page.evaluate(()=>goTab('eyewear'));await page.locator('[data-cover-cert]').tap();await page.waitForFunction(()=>document.querySelector('#ovcAppCover main')?.textContent.includes('non è ancora disponibile'));await page.locator('[data-cover-close]').tap();
   // Real Silver loss form uploads into the chat using the same endpoint/SQL, then sends the claim.
   if(engineName==='webkit'){
    await page.evaluate(id=>{state.eyewear=[{id,reference:'BU-SILVER-TEST',frame:{type:'Cerchiata',model:'Occhiale demo'},lenses:{},warranty:{name:'Silver'}}];render();},sid(3));await page.locator('[data-cover-open]').tap();await page.waitForSelector('[data-cover-reason]');await page.locator('[data-cover-reason="3"]').tap();
    await page.locator('[data-cover-file]').setInputFiles({name:'denuncia-esempio.pdf',mimeType:'application/pdf',buffer:Buffer.from(reportData.split(',')[1],'base64')});await page.locator('[data-cover-upload]').tap();await page.waitForFunction(()=>document.querySelector('[data-cover-report]')?.value);await page.locator('[data-cover-send]').tap();await page.waitForFunction(()=>document.querySelector('[data-cover-status]')?.textContent.includes('Richiesta ricevuta'));await page.screenshot({path:OUT+'/silver-richiesta.png'});
   }
   checks.push(engineName+': full assembled mobile app with touch. Garanzia opens, informational arrows removed, request saved via real SQL/handler, chat and certificate button work');
  }catch(e){await page.screenshot({path:OUT+'/failure-'+engineName+'.png'});throw e;}finally{await browser.close();}
 }
 fs.writeFileSync(OUT+'/checks.json',JSON.stringify({ok:true,checks,production_business_writes:0},null,2));console.log(JSON.stringify(checks,null,2));
}catch(e){fs.writeFileSync(OUT+'/failure.txt',String(e.stack));throw e;}finally{await pg.end();}

// Runs actual shared SQL and both request handlers, with synthetic data only.
import {createRequire} from 'node:module';import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
import {createSiteHandler} from '../supabase/functions/optyker-eyewear-cover-site/handler.mjs';
const require=createRequire(import.meta.url),{Pool}=require('pg'),{chromium,webkit}=require('playwright');
const pg=new Pool({host:'localhost',user:'postgres',password:'synthetic_ci_only',database:'warranty_test'}),OUT='channels-check';fs.mkdirSync(OUT,{recursive:true});const checks=[];
const UID='11111111-1111-4111-8111-111111111111',OTHER='22222222-2222-4222-8222-222222222222',TOKEN='a'.repeat(48);
const sid=n=>'10000000-0000-4000-8000-'+String(n).padStart(12,'0');
const sql=(q,p=[])=>pg.query(q,p),site=async(a,p={},t=TOKEN)=>(await sql('select public.optyker_eyewear_cover_site($1,$2,$3) x',[t,a,p])).rows[0].x;
const staff=async(a,p)=>(await sql('select public.optyker_eyewear_cover_staff($1,$2,$3,$4) x',['Test operator','synthetic_password_only',a,{...p,client_id:UID}])).rows[0].x;
const app=async(a,p)=>(await sql('select public.optyker_eyewear_cover_customer($1,$2,$3) x',[UID,a,p])).rows[0].x;
const good=x=>assert.equal(x.ok,true,JSON.stringify(x)),bad=x=>assert.equal(x.ok,false,JSON.stringify(x));
const rep=Buffer.from('%PDF-1.4\nSynthetic police report used only for the test.\n%%EOF'),reportData='data:application/pdf;base64,'+rep.toString('base64');
const handler=createSiteHandler({url:'https://test.invalid',serviceKey:'TEST_ONLY_KEY',fetcher:async(u,o)=>{assert(u.endsWith('/rpc/optyker_eyewear_cover_site'));const p=JSON.parse(o.body);return new Response(JSON.stringify(await site(p.p_action,p.p_payload,p.p_token)));}});
const endpoint=(a,p={},t=TOKEN)=>handler(new Request('https://test.invalid/cover',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:t,action:a,payload:p})}));
try{
 const list=await site('list');good(list);assert.equal(list.data.length,19);assert(!JSON.stringify(list).includes('PRIVATE NOTE'));assert(!JSON.stringify(list).includes('confidential_cost'));assert(!JSON.stringify(list).includes(TOKEN));assert.equal(list.data.find(x=>x.id===sid(10)).warranty_name,'Base solo lenti');
 bad(await site('get',{sheet_id:sid(6),client_id:OTHER}));bad(await site('list',{},'c'.repeat(48)));bad(await site('activate',{sheet_id:sid(5),confirm:true,starts_on:'2026-01-01'}));
 assert.equal((await endpoint('list',{},'bad')).status,401);assert.equal((await endpoint('resolve',{})).status,400);bad(await (await endpoint('get',{sheet_id:sid(6),client_id:OTHER,user_id:OTHER})).json());
 const conn=await pg.connect();try{await conn.query('set role anon');await assert.rejects(()=>conn.query('select public.optyker_eyewear_cover_site($1,$2,$3)',[TOKEN,'list',{}]));}finally{await conn.query('reset role');conn.release();}
 checks.push('Shopify portal uses existing secret credential, derives client on server, forbids activation/cross-client/anonymous direct RPC and excludes notes/costs');
 const req=(n,eye)=>({sheet_id:sid(n),request_id:crypto.randomUUID(),reason:'scratched_lens',eye,confirm:true});
 const one=await site('request',req(10,'OD'));good(one);assert.equal(one.data.origin_channel,'shopify');const two=await app('request',req(10,'OS'));good(two);assert.equal(two.data.origin_channel,'app');bad(await staff('request',req(10,'entrambi')));
 good(await staff('resolve',{sheet_id:sid(10),request_id:one.data.id,status:'rejected',confirm:true}));const three=await staff('request',req(10,'OD'));good(three);assert.equal(three.data.origin_channel,'optyker');
 const messages=(await sql('select sender_type,sender_name from optyker_chat_messages where id=$1',[three.data.message_id])).rows;assert.equal(messages[0].sender_type,'staff');assert.equal(messages[0].sender_name,'Test operator');
 const simultaneous=await Promise.all([site('request',req(11,'OD')),app('request',req(11,'OS')),staff('request',req(11,'entrambi'))]);assert.equal(simultaneous.filter(x=>x.ok).length,2);
 checks.push('App, Shopify and in-store requests share atomic two-replacement quota, preserve channel and actor, and rejection releases a reservation');
 bad(await site('request',{sheet_id:sid(13),request_id:crypto.randomUUID(),reason:'loss',confirm:true}));
 const rp={sheet_id:sid(13),request_id:crypto.randomUUID(),confirm:true,attachment_data:reportData,attachment_type:'application/pdf',attachment_name:'denuncia-dimostrativa.pdf'};const uploaded=await (await endpoint('report',rp)).json();good(uploaded);
 const loss=await site('request',{sheet_id:sid(13),request_id:crypto.randomUUID(),reason:'loss',confirm:true,evidence_message_id:uploaded.evidence_message_id});good(loss);bad(await staff('resolve',{sheet_id:sid(13),request_id:loss.data.id,status:'fulfilled',confirm:true}));
 good(await staff('resolve',{sheet_id:sid(13),request_id:loss.data.id,status:'fulfilled',confirm:true,report_verified:true}));assert.equal((await site('get',{sheet_id:sid(13)})).claims[0].status,'fulfilled');
 checks.push('Website report is stored in the same private chat; same-busta evidence and staff verification required to close loss replacement');
 for(const [engine,name] of [[chromium,'chromium'],[webkit,'webkit']]){
  const browser=await engine.launch();const context=await browser.newContext({viewport:{width:420,height:900},isMobile:true,hasTouch:true,serviceWorkers:'block'});const page=await context.newPage();page.setDefaultTimeout(15000);page.on('dialog',d=>d.accept());
  const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'content-type,authorization,apikey','Access-Control-Allow-Methods':'POST,OPTIONS'};
  const fake='<div class="shopify-section--optyker-customer-account"><div><iframe src="https://otticavisualcare.it/pages/optyker-portal?t='+TOKEN+'"></iframe></div></div>';
  await context.route('**/*',async r=>{const u=new URL(r.request().url());let b={};try{b=r.request().postDataJSON()||{};}catch{}
   if(u.pathname.endsWith('/optyker-eyewear-cover-site')){if(r.request().method()==='OPTIONS')return r.fulfill({status:204,headers:cors,body:''});const x=await endpoint(b.action,b.payload,b.token);return r.fulfill({status:x.status,headers:cors,contentType:'application/json',body:await x.text()});}
   if(u.hostname==='otticavisualcare.it'&&u.pathname==='/pages/la-mia-scheda-optyker'){
    const html=process.env.OPTYKER_LIVE?await (await r.fetch()).text():'<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head><body>'+fs.readFileSync('_site/shopify-warranty-page-body.html','utf8')+'</body></html>';
    return r.fulfill({status:200,contentType:'text/html; charset=utf-8',body:html.replace('</body>',fake+'</body>')});
   }
   if(u.pathname==='/pages/optyker-portal')return r.fulfill({status:200,contentType:'text/html',body:'<!doctype html><p>Synthetic portal container</p>'});
   if(u.pathname.includes('/functions/v1/')||u.pathname.includes('/rest/v1/')){const data=u.pathname.endsWith('/optyker-customer-chat')?{ok:true,data:(await sql('select * from optyker_chat_messages where client_id=$1',[UID])).rows}:{ok:true,customer_name:'Cliente Dimostrativo',has_prescription:false,lenses:[],orders:[]};return r.fulfill({status:200,headers:cors,contentType:'application/json',body:JSON.stringify(data)});}
   if(!process.env.OPTYKER_LIVE&&u.hostname==='www.optyker.it'){const f=path.resolve('_site',u.pathname.replace(/^\//,''));if(f.startsWith(path.resolve('_site')+path.sep)&&fs.existsSync(f))return r.fulfill({status:200,contentType:path.extname(f)==='.css'?'text/css':'text/javascript',body:fs.readFileSync(f)});}
   if(process.env.OPTYKER_LIVE)return r.continue();return r.fulfill({status:404,body:''});
  });
  try{
   await page.goto('https://otticavisualcare.it/pages/la-mia-scheda-optyker',{waitUntil:'domcontentloaded'});await page.waitForSelector('#ovc-account-native [data-view=eyewear]');assert.equal(await page.locator('#ovc-account-native .ovcANav button').count(),8);
   await page.locator('[data-view=eyewear]').tap();await page.waitForSelector('[data-sw-open]');await page.locator('[data-sw-open="'+sid(name==='webkit'?15:14)+'"]').tap();await page.waitForSelector('[data-sw-reason]');assert.equal(await page.locator('[data-sw-reason]').count(),4);await page.screenshot({path:OUT+'/shopify-'+name+'.png'});
   await page.locator('[data-sw-reason="0"]').tap();await page.selectOption('[data-sw-eye]','OD');await page.locator('[data-sw-send]').tap();await page.waitForFunction(()=>document.querySelector('[data-sw-note]')?.textContent.includes('Richiesta ricevuta'));await page.locator('[data-sw-chat]').tap();await page.waitForSelector('#ovcAMessages');await page.waitForFunction(()=>document.querySelector('#ovcAMessages')?.textContent.includes('Richiesta garanzia Base'));
   // Existing nav still works and must not be overwritten by a pending warranty read.
   await page.locator('[data-view=orders]').tap();await page.waitForFunction(()=>document.querySelector('.ovcAPanel')?.textContent.includes('Nessun ordine'));await page.locator('[data-view=eyewear]').tap();await page.waitForSelector('[data-sw-open]');await page.locator('[data-sw-cert="'+sid(9)+'"]').tap();await page.waitForSelector('.swCover a[href^="blob:"]');
   if(name==='webkit'){await page.locator('[data-sw-list]').tap();await page.locator('[data-sw-open="'+sid(16)+'"]').tap();await page.locator('[data-sw-reason="3"]').tap();await page.locator('[data-sw-file]').setInputFiles({name:'denuncia-demo.pdf',mimeType:'application/pdf',buffer:rep});await page.locator('[data-sw-upload]').tap();await page.waitForFunction(()=>document.querySelector('[data-sw-report]')?.value);await page.locator('[data-sw-send]').tap();await page.waitForFunction(()=>document.querySelector('[data-sw-note]')?.textContent.includes('Richiesta ricevuta'));}
   checks.push(name+': actual Shopify native page scripts, eight navigation buttons, warranty/claim/chat/PDF work with real disposable SQL; existing orders view preserved');
  }catch(e){await page.screenshot({path:OUT+'/failure-shopify-'+name+'.png'});throw e;}finally{await browser.close();}
 }
 // Actual assembled Optyker staff UI, including the client-sheet attachment point.
 const browser=await chromium.launch();const context=await browser.newContext({viewport:{width:1440,height:950},serviceWorkers:'block'});const page=await context.newPage();page.setDefaultTimeout(15000);page.on('dialog',d=>d.accept());
 await context.route('**/*',async r=>{const u=new URL(r.request().url());let b={};try{b=r.request().postDataJSON()||{};}catch{}
  const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,content-type','Access-Control-Allow-Methods':'POST,OPTIONS'};
  if(u.pathname.includes('/rest/v1/')||u.pathname.includes('/functions/v1/')){
   if(r.request().method()==='OPTIONS')return r.fulfill({status:204,headers,body:''});let data={ok:true,data:[],clients:[],sheets:[],rows:[],count:0};
   if(u.pathname.endsWith('/optyker-staff-auth'))data={ok:true,username:b.username,has_email:true,needs_password:false};
   if(u.pathname.endsWith('/optyker_eyewear_cover_staff'))data=await staff(b.p_action,b.p_payload);
   if(u.pathname.endsWith('/optyker_client_sheet_actions'))data={ok:true,client_id:UID,data:(await sql('select * from optyker_sheets where client_id=$1',[UID])).rows};
   return r.fulfill({status:200,headers,contentType:'application/json',body:JSON.stringify(data)});
  }
  if(!process.env.OPTYKER_LIVE&&u.hostname==='www.optyker.it'){let rel=u.pathname.replace(/^\//,'');if(!rel||rel.endsWith('/'))rel+='index.html';const f=path.resolve('_site',rel);if(f.startsWith(path.resolve('_site')+path.sep)&&fs.existsSync(f))return r.fulfill({status:200,contentType:({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json'})[path.extname(f)]||'application/octet-stream',body:fs.readFileSync(f)});}
  if(process.env.OPTYKER_LIVE)return r.continue();return r.fulfill({status:404,body:''});
 });
 try{
  await page.goto('https://www.optyker.it/',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>!!window.OPTYKER_COVER_STAFF);const op=await page.locator('#optykerLoginOperator option').evaluateAll(xs=>xs.find(x=>/Michael/i.test(x.value))?.value);await page.selectOption('#optykerLoginOperator',op);await page.waitForTimeout(400);await page.fill('#optykerAuthPassword','synthetic_password_only');await page.click('.optykerLoginButton');await page.waitForFunction(()=>!!window.optykerAuthenticated);
  await page.evaluate(({uid,sid})=>{OPTYKER_CLOUD.clients=[{id:uid,name:'Cliente',surname:'Dimostrativo'}];clientSelect(uid);window.OPTYKER_CLIENT_SHEETS.open('eyewear',sid);},{uid:UID,sid:sid(20)});await page.waitForSelector('[data-ws-open]');await page.click('[data-ws-open]');await page.waitForSelector('[data-ws-request]');await page.screenshot({path:OUT+'/optyker-garanzia.png'});await page.click('[data-ws-request="0"]');await page.selectOption('[data-ws-eye]','OD');await page.click('[data-ws-send]');await page.waitForSelector('[data-ws-complete]');await page.click('[data-ws-complete]');await page.waitForFunction(()=>document.querySelector('#ovcStaffCover main')?.textContent.includes('1 consegnati'));
  checks.push('Complete Optyker customer sheet has Garanzia occhiale button; in-store request and delivery update the same quota as Shopify/app');
 }catch(e){await page.screenshot({path:OUT+'/failure-optyker.png'});throw e;}finally{await browser.close();}
 fs.writeFileSync(OUT+'/checks.json',JSON.stringify({ok:true,checks,production_customer_writes:0},null,2));console.log(JSON.stringify(checks,null,2));
}catch(e){fs.writeFileSync(OUT+'/failure.txt',String(e.stack));throw e;}finally{await pg.end();}

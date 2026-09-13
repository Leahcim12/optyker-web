// Exercise the production-assembled POS, preserving its pricing/catalog patches.
import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';import {resolve} from 'node:path';import {createRequire} from 'node:module';import {webcrypto} from 'node:crypto';
const require=createRequire(process.env.OPTYKER_TEST_PACKAGE||import.meta.url),{JSDOM}=require('jsdom');
const root=resolve(process.env.OPTYKER_TEST_SITE||'_site');
const sid='33333333-3333-4333-8333-333333333333',pid='11111111-1111-4111-8111-111111111111',jid='22222222-2222-4222-8222-222222222222';
async function until(check){for(let i=0;i<70;i++){if(check())return;await new Promise(r=>setTimeout(r,20))}assert.fail('UI did not reach expected state')}
async function setup({printerOffline=false,lostPrint=false}={}){
 const dom=new JSDOM('<html><head></head><body></body></html>',{url:'https://www.optyker.it',runScripts:'outside-only'}),w=dom.window,calls=[],errors=[];let state='';
 const el=s=>w.document.querySelector(s);
 const product={variant_id:'TEST_VARIANT',title:'Articolo prova',price:70,quantity:1,product_type:'Montature',inventory_quantity:1,fiscal_vat_code:'04',fiscal_item_type:'goods'};
 const sale={id:sid,status:'completed',total:70,paid_amount:70,due_amount:0,shopify_order_name:'#TEST',payment_stage:'balance',payment_method:'card',created_at:'2026-09-12T10:00:00Z'};
 const job=()=>({id:jid,payment_id:pid,state,total:70,talking_receipt:true,ts_requested:true,...(state==='completed'?{document_number:'1162-0017',document_date:'2026-09-13'}:{})});
 w.Response=Response;w.AbortSignal=AbortSignal;Object.defineProperty(w,'crypto',{value:webcrypto});
 w.OPTYKER_CLOUD={username:'TEST OPERATOR',password:'TEST PASSWORD',clients:[]};w.confirm=()=>{throw Error('Checkout must not ask another confirmation')};
 w.addEventListener('error',e=>errors.push(e.message));
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false};
 w.fetch=async(url,opts={})=>{
  const b=opts.body?JSON.parse(opts.body):{},a=b.action;calls.push({url,action:a,payload:b.payload});let data;
  if(url.endsWith('/health')){if(printerOffline)throw Error('Connettore non raggiungibile');return Response.json({ok:true,version:'1.8-auto-receipt',capabilities:{receipt:true,automaticReference:true}})}
  if(url.endsWith('/status'))return Response.json({ok:true,mode:'REG',idleState:0,busy:0,errorCode:0,printerError:0,paperEnd:0,coverOpen:0});
  if(url.endsWith('/receipt')){state=lostPrint?'uncertain':'completed';if(lostPrint)throw Error('timeout');return Response.json({ok:true,state:'closing_acknowledged'})}
  if(url.endsWith('/receipt/status'))return Response.json({ok:true,state});
  if(a==='products')data=[product];else if(a==='clients')data=[];
  else if(a==='quote_lines')data={ovc_version:'20260910-ovc2',lines:b.payload.lines.map(l=>({...product,quantity:l.quantity})),card:null};
  else if(a==='checkout')data={...sale,payment:{id:pid,amount:70}};
  else if(a==='recent_sales')data=[sale];
  else if(a==='sale')data={sale_id:sid,total:70,status:'completed',has_fiscal_code:true,lines:[product],payments:[{id:pid,amount:70,payment_stage:'balance',payment_method:'card',automatic_receipt:true,created_at:sale.created_at}],jobs:state?[job()]:[]};
  else if(a==='prepare'){state='prepared';assert.equal(b.payload.automatic,true);assert.equal(b.payload.payment_id,pid);data={job:job(),claim_token:'a'.repeat(64)}}
  else if(a==='job')data={job:job()};else throw Error('Unexpected request '+a);
  return Response.json({ok:true,data});
 };
 const html=readFileSync(resolve(root,'index.html'),'utf8');
 for(const tag of html.match(/<link\b[^>]*rel="stylesheet"[^>]*>/g)||[]){const path=tag.match(/href="(\/[^"?]+)(?:[^"]*)"/);if(path){const style=w.document.createElement('style');style.textContent=readFileSync(resolve(root,'.'+path[1]),'utf8');w.document.head.appendChild(style)}}
 for(const name of ['rch-preflight.js','fiscal-receipts.js','cash-register.js'])w.eval(readFileSync(resolve(root,name),'utf8'));
 w.openOptykerCash();el('#optykerCashFindProducts').click();await until(()=>el('[data-variant="TEST_VARIANT"]'));
 el('[data-variant="TEST_VARIANT"]').click();el('#optykerCashPickerDone').click();await until(()=>!el('#optykerCashCheckoutBtn').disabled);
 return {dom,w,el,calls,errors};
}
test('occasional customer: CF in cart, one click prints and automatically records actual receipt; history cannot duplicate it',async()=>{
 const {dom,w,el,calls,errors}=await setup();try{
  assert.equal(el('#optykerCashClient').value,'');assert.equal(el('#optykerCashTs').disabled,false);
  el('#optykerCashTs').click();assert.equal(el('#optykerCashTsOptions').style.display,'grid');
  el('#optykerCashCheckoutBtn').click();await new Promise(r=>setTimeout(r,40));assert.equal(calls.filter(c=>c.action==='checkout').length,0);
  el('#optykerCashFiscalCode').value='RSSMRA80A01H501U';el('#optykerCashCheckoutBtn').click();el('#optykerCashCheckoutBtn').click();
  await until(()=>el('.ofBody')?.textContent.includes('1162-0017'));
  assert.equal(calls.filter(c=>c.action==='checkout').length,1);assert.equal(calls.filter(c=>c.url.endsWith('/receipt')).length,1);
  const sent=calls.find(c=>c.action==='checkout').payload;assert.equal(sent.client_id,'');assert.equal(sent.fiscal_code,'RSSMRA80A01H501U');assert.equal(sent.auto_receipt,true);assert.equal(sent.lines[0].department,1);
  assert.equal(el('.ofIssue'),null);assert.equal(el('.ofReference'),null);assert.equal(el('#optykerCashFiscalCode').value,'');
  assert.ok(Number(w.getComputedStyle(el('#optykerFiscalModal')).zIndex)>Number(w.getComputedStyle(el('#optykerCashOverlay')).zIndex));
  el('#optykerFiscalModal .ofClose').click();el('#optykerCashRecentBtn').click();await until(()=>el('[data-fiscal-sale]'));el('[data-fiscal-sale]').click();await until(()=>el('.ofBody')?.textContent.includes('1162-0017'));
  assert.equal(el('.ofAutoIssue'),null);assert.equal(calls.filter(c=>c.url.endsWith('/receipt')).length,1);assert.deepEqual(errors,[]);
 }finally{dom.window.close()}
});
test('unreachable printer stops before recording a sale',async()=>{
 const {dom,el,calls}=await setup({printerOffline:true});try{
  el('#optykerCashCheckoutBtn').click();await new Promise(r=>setTimeout(r,100));
  assert.equal(calls.filter(c=>c.action==='checkout').length,0);assert.equal(calls.filter(c=>c.url.endsWith('/receipt')).length,0);
 }finally{dom.window.close()}
});
test('lost print response retains one registered sale and exposes recovery without another print button',async()=>{
 const {dom,el,calls}=await setup({lostPrint:true});try{
  el('#optykerCashCheckoutBtn').click();await until(()=>el('.ofBody')?.textContent.includes('Esito da verificare'));
  assert.equal(calls.filter(c=>c.action==='checkout').length,1);assert.equal(calls.filter(c=>c.url.endsWith('/receipt')).length,1);
  assert.equal(el('.ofAutoIssue'),null);assert.equal(el('.ofEmit'),null);assert.ok(el('.ofBody').textContent.includes('Non registrare nuovamente'));
 }finally{dom.window.close()}
});

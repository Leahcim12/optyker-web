// Real assembled checkout and styles, with all business and printer requests mocked.
// Run after the production build: node --test tests/fiscal-cash-flow.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(process.env.OPTYKER_TEST_PACKAGE||import.meta.url);
const {JSDOM}=require('jsdom');
const root=resolve('_site');
const mock=`
window.__calls=[];window.__consoleErrors=[];window.addEventListener('error',e=>__consoleErrors.push(e.message));
window.OPTYKER_CLOUD={username:'TEST OPERATOR',password:'TEST PASSWORD',clients:[]};
window.confirm=()=>true;
const sid='33333333-3333-4333-8333-333333333333',pid='11111111-1111-4111-8111-111111111111',jid='22222222-2222-4222-8222-222222222222';
const product={variant_id:'TEST_VARIANT',title:'Articolo prova',price:70,quantity:1,product_type:'Montature',inventory_quantity:1};
const sale={id:sid,status:'completed',total:70,due_amount:0,shopify_order_name:'#TEST',payment_stage:'balance',payment_method:'card',created_at:'2026-09-12T10:00:00Z'};
let state='';const job=()=>({id:jid,payment_id:pid,state,total:70,talking_receipt:false,ts_requested:false});
window.fetch=async (url,opts={})=>{
 const b=opts.body?JSON.parse(opts.body):{},a=b.action;__calls.push({url,action:a,payload:b.payload});let data;
 if(url.endsWith('/health'))return Response.json({ok:true,version:'1.6-fiscal-journal',capabilities:{receipt:true}});
 if(url.endsWith('/status'))return Response.json({ok:true,requestAccepted:true,ackComplete:true,mode:'REG',idleState:0});
 if(url.endsWith('/receipt')){state='awaiting_reference';return Response.json({ok:true,state:'closing_acknowledged'})}
 if(url.endsWith('/receipt/status'))return Response.json({ok:true,state});
 if(a==='products')data=[product];
 else if(a==='clients')data=[];
 else if(a==='quote_lines')data={ovc_version:'20260910-ovc2',lines:b.payload.lines.map(l=>({...product,quantity:l.quantity})),card:null};
 else if(a==='checkout')data={...sale,payment:{id:pid,amount:70}};
 else if(a==='recent_sales')data=[sale];
 else if(a==='sale')data={sale_id:sid,total:70,status:'completed',has_fiscal_code:false,lines:[product],payments:[{id:pid,amount:70,payment_stage:'balance',payment_method:'card',created_at:sale.created_at}],jobs:state?[job()]:[]};
 else if(a==='prepare'){state='prepared';data={job:job(),claim_token:'a'.repeat(64)}}
 else if(a==='job')data={job:job()};
 else throw new Error('Unexpected mock request '+a);
 return Response.json({ok:true,data});
};`;
async function until(check){for(let n=0;n<60;n++){if(check())return;await new Promise(r=>setTimeout(r,20))}assert.fail('UI did not reach the expected state')}
test('assembled checkout opens RCH above cash; history reopens the same payment without duplicate sale or print',async()=>{
 const dom=new JSDOM('<html><head></head><body></body></html>',{url:'https://www.optyker.it',runScripts:'outside-only'}),w=dom.window;
 try{
  w.Response=Response;w.AbortSignal=AbortSignal;
  w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false};
  const html=readFileSync(resolve(root,'index.html'),'utf8');
  for(const tag of html.match(/<link\b[^>]*rel="stylesheet"[^>]*>/g)||[]){const path=tag.match(/href="(\/[^"?]+)(?:[^"]*)"/);if(path){const style=w.document.createElement('style');style.textContent=readFileSync(resolve(root,'.'+path[1]),'utf8');w.document.head.appendChild(style)}}
  w.eval(mock);
  for(const name of ['rch-preflight.js','fiscal-receipts.js','cash-register.js'])w.eval(readFileSync(resolve(root,name),'utf8'));
  w.openOptykerCash();
  const el=s=>w.document.querySelector(s);
  el('#optykerCashFindProducts').click();await until(()=>el('[data-variant="TEST_VARIANT"]'));
  el('[data-variant="TEST_VARIANT"]').click();el('#optykerCashPickerDone').click();
  await until(()=>!el('#optykerCashCheckoutBtn').disabled);el('#optykerCashCheckoutBtn').click();await until(()=>el('.ofIssue'));
  const above=selector=>{assert.equal(w.getComputedStyle(el('#optykerFiscalModal')).display,'flex');assert.ok(Number(w.getComputedStyle(el('#optykerFiscalModal')).zIndex)>Number(w.getComputedStyle(el(selector)).zIndex),'RCH review must cover '+selector)};
  above('#optykerCashOverlay');
  assert.equal(w.__calls.filter(c=>c.action==='checkout').length,1);assert.equal(w.__calls.filter(c=>c.url.endsWith('/receipt')).length,0);
  el('#optykerFiscalModal .ofClose').click();el('#optykerCashRecentBtn').click();await until(()=>el('[data-fiscal-sale]'));
  el('[data-fiscal-sale]').click();await until(()=>el('.ofIssue'));above('#optykerCashRecentModal');
  el('[data-field="department"]').value='2';el('[name="notIssued"]').checked=true;
  await el('.ofIssue').onsubmit({preventDefault(){}});assert.ok(el('.ofReference'));
  el('#optykerFiscalModal .ofClose').click();el('[data-fiscal-sale]').click();await until(()=>el('.ofReference'));
  assert.equal(w.__calls.filter(c=>c.action==='checkout').length,1);assert.equal(w.__calls.filter(c=>c.url.endsWith('/receipt')).length,1);
  assert.equal(el('.ofEmit'),null);assert.deepEqual(Array.from(w.__consoleErrors),[]);
 }finally{dom.window.close()}
});

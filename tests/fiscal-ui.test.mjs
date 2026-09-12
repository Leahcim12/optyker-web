import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(process.env.OPTYKER_TEST_PACKAGE||import.meta.url);
const {JSDOM}=require('jsdom');
const source=readFileSync(new URL('../fiscal-receipts.js',import.meta.url),'utf8');
const cashCss=readFileSync(new URL('../cash-register.css',import.meta.url),'utf8');
const pid='11111111-1111-4111-8111-111111111111',jid='22222222-2222-4222-8222-222222222222';
async function setup({timeout=false,initialState=null}={}){
 const dom=new JSDOM('<body></body>',{url:'https://www.optyker.it',runScripts:'outside-only'}),w=dom.window,calls=[];
 let state=initialState;
 const job=()=>({id:jid,payment_id:pid,state:state||'prepared',total:12.5,talking_receipt:false,ts_requested:false});
 w.OPTYKER_CLOUD={username:'TEST OPERATOR',password:'TEST PASSWORD'};w.AbortSignal=AbortSignal;
 w.fetch=async function(url,opts={}){
  const body=opts.body?JSON.parse(opts.body):null;calls.push({url,body});let x;
  if(url.endsWith('/health'))x={ok:true,version:'1.7-fiscal-void',capabilities:{receipt:true}};
  else if(url.endsWith('/receipt')){state=timeout?'uncertain':'awaiting_reference';if(timeout)throw new Error('timeout');x={ok:true,state:'closing_acknowledged'}}
  else if(url.endsWith('/receipt/status'))x={ok:true,state};
  else if(body.action==='sale')x={ok:true,data:{total:12.5,status:'completed',has_fiscal_code:true,lines:[{title:'Occhiale',price:12.5,quantity:1}],payments:[{id:pid,amount:12.5,payment_stage:'balance',payment_method:'cash',created_at:'2026-09-12'}],jobs:initialState?[job()]:[]}};
  else if(body.action==='prepare')x={ok:true,data:{job:job(),claim_token:'a'.repeat(64)}};
  else if(body.action==='job')x={ok:true,data:{job:job()}};
  else if(body.action==='reference'){state='completed';x={ok:true,data:{job:{...job(),document_number:body.payload.document_number,document_date:body.payload.document_date}}}}
  else throw new Error('Unexpected '+JSON.stringify(body));
  return {ok:true,json:async()=>x};
 };
 w.eval(source);await w.OPTYKER_FISCAL.openSale('33333333-3333-4333-8333-333333333333');return {w,dom,calls};
}
test('review emits one capability-bound receipt then records the actual paper reference',async()=>{
 const {w,dom,calls}=await setup();try{
  const form=w.document.querySelector('.ofIssue');assert.equal(form.querySelector('[data-field=department]').value,'');
  form.querySelector('[data-field=department]').value='1';form.elements.notIssued.checked=true;
  await form.onsubmit({preventDefault(){}});
  const bridge=calls.filter(x=>x.url.endsWith('/receipt'));assert.equal(bridge.length,1);assert.deepEqual(Object.keys(bridge[0].body).sort(),['jobId','token']);
  assert.ok(!JSON.stringify(bridge).includes('TEST PASSWORD'));
  const ref=w.document.querySelector('.ofReference');assert.ok(ref);ref.elements.number.value='1160-0001';ref.elements.date.value='2026-09-12';ref.elements.amount.value='12.50';ref.elements.verified.checked=true;
  await ref.onsubmit({preventDefault(){}});assert.match(w.document.body.textContent,/Documento registrato/);assert.match(w.document.body.textContent,/1160-0001/);
  assert.equal(calls.filter(x=>x.url.endsWith('/receipt')).length,1);
 }finally{dom.window.close()}
});
test('receipt review stays above the open cash register, history and RCH settings',async()=>{
 const {w,dom}=await setup();try{
  const style=w.document.createElement('style');style.textContent=cashCss;w.document.head.appendChild(style);
  const review=w.document.getElementById('optykerFiscalModal');
  assert.equal(review.getAttribute('role'),'dialog');assert.equal(review.getAttribute('aria-modal'),'true');
  assert.equal(w.getComputedStyle(review).display,'flex');
  for(const [id,classes] of [['optykerCashOverlay','optykerCashOverlay open'],['optykerCashRecentModal','optykerCashModal open'],['optykerCashRchModal','optykerCashModal open']]){
   const layer=w.document.createElement('div');layer.id=id;layer.className=classes;w.document.body.appendChild(layer);
   assert.ok(Number(w.getComputedStyle(review).zIndex)>Number(w.getComputedStyle(layer).zIndex),'Receipt review must cover '+id);
  }
 }finally{dom.window.close()}
});
test('lost receipt response exposes uncertain result and no retry button',async()=>{
 const {w,dom,calls}=await setup({timeout:true});try{
  const form=w.document.querySelector('.ofIssue');form.querySelector('[data-field=department]').value='1';form.elements.notIssued.checked=true;
  await form.onsubmit({preventDefault(){}});
  assert.match(w.document.body.textContent,/Esito da verificare/);assert.equal(w.document.querySelector('.ofEmit'),null);
  assert.equal(calls.filter(x=>x.url.endsWith('/receipt')).length,1);
  const refresh=[...w.document.querySelectorAll('button')].find(b=>b.textContent==='Aggiorna esito');await refresh.onclick();
  assert.equal(calls.filter(x=>x.url.endsWith('/receipt')).length,1);
 }finally{dom.window.close()}
});
test('reopening a completed payment cannot issue a second receipt',async()=>{
 const {w,dom,calls}=await setup({initialState:'completed'});try{assert.equal(w.document.querySelector('.ofEmit'),null);assert.equal(calls.length,1)}finally{dom.window.close()}
});

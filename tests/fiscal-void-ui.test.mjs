import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(process.env.OPTYKER_TEST_PACKAGE||import.meta.url),{JSDOM}=require('jsdom');
const source=readFileSync(new URL('../fiscal-receipts.js',import.meta.url),'utf8');
const originalId='11111111-1111-4111-8111-111111111111',voidId='22222222-2222-4222-8222-222222222222',pid='33333333-3333-4333-8333-333333333333';
async function setup({lost=false,old=false,done=false}={}){
 const dom=new JSDOM('<body></body>',{url:'https://www.optyker.it',runScripts:'outside-only'}),w=dom.window,calls=[];
 let state=done?'completed':'';
 const cancelled=()=>({id:voidId,payment_id:pid,operation:'void',original_job_id:originalId,original_document:{number:'1161-0009',date:'2026-09-12'},void_reason:'Errore di emissione',total:70,state});
 const original=()=>({id:originalId,payment_id:pid,operation:'sale',state:'completed',document_number:'1161-0009',document_date:'2026-09-12',total:70,void_job:state?cancelled():null});
 w.OPTYKER_CLOUD={username:'TEST',password:'TEST PASSWORD'};w.AbortSignal=AbortSignal;
 w.fetch=async(url,opts={})=>{
  const b=opts.body?JSON.parse(opts.body):{};calls.push({url,b});let data;
  if(url.endsWith('/health'))return {ok:true,json:async()=>({ok:true,version:old?'1.6-fiscal-journal':'1.7-fiscal-void',capabilities:{voidReceipt:!old}})};
  if(url.endsWith('/receipt/void')){state=lost?'uncertain':'awaiting_reference';if(lost)throw Error('Lost response');data={};}
  else if(url.endsWith('/receipt/status'))data={};
  else if(b.action==='sale')data={payments:[{id:pid,amount:70}],jobs:[original()]};
  else if(b.action==='job')data={job:b.payload.job_id===originalId?original():cancelled()};
  else if(b.action==='prepare_void'){state='prepared';data={job:cancelled(),claim_token:'a'.repeat(64)}}
  else if(b.action==='reference'){assert.equal(b.payload.void_verified,true);state='completed';data={job:{...cancelled(),document_number:'1161-0010',document_date:'2026-09-12'}}}
  else throw Error('Unexpected request '+b.action);
  return {ok:true,json:async()=>({ok:true,data})};
 };
 w.eval(source);await w.OPTYKER_FISCAL.openSale('sale');
 return {dom,w,calls};
}
async function confirm(w){await w.document.querySelector('.ofVoid').onclick();const f=w.document.querySelector('.ofVoidForm');f.elements.reason.value='Errore di emissione';f.elements.confirmed.checked=true;await f.onsubmit({preventDefault(){}})}
test('void requires deliberate confirmation and updates only the receipt flow',async()=>{
 const {dom,w,calls}=await setup();try{
  await confirm(w);assert.equal(calls.filter(c=>c.url.endsWith('/receipt/void')).length,1);
  const prepare=calls.find(c=>c.b.action==='prepare_void').b.payload;assert.equal(prepare.original_job_id,originalId);assert.equal(prepare.expected_number,'1161-0009');assert.equal(prepare.expected_total,70);
  const f=w.document.querySelector('.ofReference');assert.match(f.textContent,/nuovo documento di annullo/);
  f.elements.number.value='1161-0010';f.elements.date.value='2026-09-12';f.elements.amount.value='70';f.elements.verified.checked=true;await f.onsubmit({preventDefault(){}});
  assert.match(w.document.body.textContent,/Scontrino annullato/);assert.equal(w.document.querySelector('.ofVoid'),null);
  await w.OPTYKER_FISCAL.openSale('sale');assert.equal(w.document.querySelector('.ofVoidEmit'),null);
  assert.equal(calls.filter(c=>c.url.endsWith('/receipt/void')).length,1);
  assert.ok(calls.every(c=>!c.url.includes('cash-register-api')&&!c.url.includes('shopify')));
 }finally{dom.window.close()}
});
test('old connector stops before authorizing a void; uncertain result cannot be retried',async()=>{
 for(const options of [{old:true},{lost:true}]){const {dom,w,calls}=await setup(options);try{
  await confirm(w);
  if(options.old){assert.match(w.document.body.textContent,/Aggiorna il connettore/);assert.ok(!calls.some(c=>c.b.action==='prepare_void'))}
  else{assert.match(w.document.body.textContent,/Esito annullo da verificare/);assert.equal(w.document.querySelector('.ofVoidEmit'),null);assert.equal(w.document.querySelector('.ofVoid'),null)}
 }finally{dom.window.close()}}
});

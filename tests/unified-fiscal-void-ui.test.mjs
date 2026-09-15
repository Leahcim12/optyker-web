import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
const source=readFileSync(new URL('../unified-fiscal-void.js',import.meta.url),'utf8');
function fixture(capability=true){
 const d=new JSDOM('',{runScripts:'outside-only'}),w=d.window,calls=[];
 w.AbortSignal=AbortSignal;w.OPTYKER_CLOUD={username:'test',password:'test-only'};
 let confirmed=false;const state=()=>({intent:confirmed?{}:null,original:{id:'original',document_number:'1164-0005',document_date:'2026-09-15',total:580},phase:confirmed?'ts_working':'rch_ready',message:'Test'});
 w.fetch=async(url,options)=>{const p=options.body?JSON.parse(options.body):{};calls.push({url,...p});let data;
  if(url.endsWith('/health'))data={ok:true,capabilities:{automaticVoidReference:capability}};
  else if(url.endsWith('/status'))data={ok:true,mode:'REG',idleState:'0',busy:0,errorCode:0,printerError:0,paperEnd:0,coverOpen:0};
  else if(p.action==='unified_void_pending')data={ok:true,data:[]};
  else {if(p.action==='unified_void_start')confirmed=true;data={ok:true,data:state()}};
  return {ok:true,json:async()=>data};
 };w.eval(source);return {d,w,calls};
}
test('one confirmation recovers references and starts only after compatible RCH preflight',async()=>{
 const f=fixture();await f.w.OPTYKER_UNIFIED_VOID.open('original');assert.equal(f.w.document.querySelectorAll('input').length,0);
 const b=f.w.document.querySelector('.ofVoidEmit');await b.onclick();const start=f.calls.filter(x=>x.action==='unified_void_start');
 assert.equal(start.length,1);assert.equal(start[0].payload.confirmed,true);assert.equal(start[0].payload.original_job_id,'original');
 assert.equal(start[0].payload.expected_number,undefined);assert.equal(f.calls.some(x=>x.action==='unified_void_prepare'),false);f.d.window.close();
});
test('an old connector cannot start a TS cancellation from the unified button',async()=>{
 const f=fixture(false);await f.w.OPTYKER_UNIFIED_VOID.open('original');await f.w.document.querySelector('.ofVoidEmit').onclick();
 assert.equal(f.calls.some(x=>x.action==='unified_void_start'),false);assert.match(f.w.document.querySelector('[data-uv-message]').textContent,/Aggiornamento/);f.d.window.close();
});

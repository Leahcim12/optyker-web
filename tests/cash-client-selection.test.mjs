import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const {JSDOM}=createRequire(process.env.OPTYKER_TEST_PACKAGE||import.meta.url)('jsdom');
const source=readFileSync(process.env.CASH_TEST_SOURCE||new URL('../cash-register.js',import.meta.url),'utf8');
function setup(){
 const dom=new JSDOM('<select id="optykerCashClient"></select><input id="optykerCashFiscalCode"><input type="checkbox" id="optykerCashTs"><div id="optykerCashTsBox"></div>',{runScripts:'outside-only'}),w=dom.window;
 w.S={clientId:'a',clients:[],busy:false};w.OPTYKER_CLOUD={clients:[]};w.E=id=>w.document.getElementById(id);w.esc=x=>String(x);w.updateInvoiceAvailability=()=>{};w.api=()=>Promise.resolve({data:[]});
 for(const name of ['clientsLocal','clientLabel','fillClients','searchCashClients','currentCashClient','cleanFiscal','updateTsAvailability']){
  const start=source.indexOf('function '+name+'('),end=source.indexOf('\nfunction ',start+1);
  w.eval(source.slice(start,end));
 }
 return {w,close:()=>dom.window.close()};
}
test('late client details fill fiscal code, preserve manual edits, clear on switching client',()=>{
 const {w,close}=setup();try{
  const f=w.E('optykerCashFiscalCode');w.updateTsAvailability();assert.equal(f.value,'');
  w.S.clients=[{id:'a',fiscal:' rssmra80a01h501u '}];w.updateTsAvailability();assert.equal(f.value,'RSSMRA80A01H501U');
  f.value='VRDLGI80A01H501K';f.oninput();w.updateTsAvailability();assert.equal(f.value,'VRDLGI80A01H501K');
  w.S.clientId='b';w.updateTsAvailability();assert.equal(f.value,'');
  w.S.clientId='';w.updateTsAvailability();assert.equal(f.value,'');
 }finally{close()}
});
test('selected client outside search page survives; stale search cannot replace newer results or selection',async()=>{
 const {w,close}=setup();try{
  w.fillClients('a',[]);assert.equal(w.E('optykerCashClient').value,'a');
  const pending=[];w.api=(action,payload)=>new Promise(resolve=>pending.push({resolve,payload}));
  const old=w.searchCashClients('old','a');const recent=w.searchCashClients('new');
  assert.equal(pending[1].payload.selected_id,'a');
  pending[1].resolve({data:[{id:'a',fiscal:'RSSMRA80A01H501U'},{id:'b',fiscal:'VRDLGI80A01H501K'}]});await recent;
  w.S.clientId='b';w.updateTsAvailability();
  pending[0].resolve({data:[{id:'a',fiscal:'OLD'}]});await old;
  assert.equal(w.S.clientId,'b');assert.equal(w.E('optykerCashFiscalCode').value,'VRDLGI80A01H501K');
  const next=w.searchCashClients('other');pending[2].resolve({data:[]});await next;
  assert.equal(w.E('optykerCashClient').value,'b');assert.equal(w.E('optykerCashFiscalCode').value,'VRDLGI80A01H501K');
 }finally{close()}
});
test('summary client record retains local fiscal details',()=>{
 const {w,close}=setup();try{w.OPTYKER_CLOUD.clients=[{id:'a',fiscal:'RSSMRA80A01H501U'}];w.S.clients=[{id:'a',name:'Test'}];w.updateTsAvailability();assert.equal(w.E('optykerCashFiscalCode').value,'RSSMRA80A01H501U')}finally{close()}
});

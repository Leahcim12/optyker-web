// UI-handler integration with a minimal DOM double (not a visual browser test).
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const preflight=require('../rch-preflight.js');
function fixture(modulePresent=true){
  const ids=new Map(),requests=[];
  function element(){
    let html='';const classes=new Set();
    return {textContent:'',className:'',disabled:false,style:{},onclick:null,
      classList:{add:c=>classes.add(c),remove:c=>classes.delete(c),toggle:(c,v)=>v?classes.add(c):classes.delete(c),contains:c=>classes.has(c)},
      get innerHTML(){return html},set innerHTML(value){html=value;for(const m of value.matchAll(/id="([^"]+)"/g))ids.set(m[1],element())},
      querySelector(){return element()},appendChild(child){if(child.id)ids.set(child.id,child)},remove(){}
    };
  }
  const document={getElementById:id=>ids.get(id),createElement:element,body:element(),readyState:'loading',addEventListener(){}};
  const window={OPTYKER_RCH_PREFLIGHT:modulePresent?preflight:undefined};
  const context=vm.createContext({window,document,AbortController,URL,Blob,setTimeout:()=>1,clearTimeout(){},setInterval(){},console,
    fetch:async(url,opts)=>{requests.push({url,opts});return {ok:true,json:async()=>url.endsWith('/health')?{ok:true,version:'1.7-fiscal-void'}:{ok:true,mode:'Z'}}}});
  let source=readFileSync(new URL('../cash-register.js',import.meta.url),'utf8');
  source=source.replace('window.openOptykerCash=function','window.testHooks={openRch:openRch,state:S,testRch:testRch};window.openOptykerCash=function');
  vm.runInContext(source,context);
  return {ids,requests,hooks:window.testHooks};
}
test('RCH modal renders the confirmed configuration and preflight never calls a service',()=>{
  const f=fixture();
  f.hooks.state.stage='balance';
  f.hooks.state.cart={one:{qty:2,item:{title:'Product',price:'12.34',fiscal_vat_code:'04',fiscal_item_type:'goods'}}};
  f.hooks.openRch();
  assert.match(f.ids.get('optykerCashRchProfile').innerHTML,/<td>04<\/td><td>Carte elettroniche/);
  assert.match(f.ids.get('optykerCashRchProfile').innerHTML,/<td>1<\/td><td>Beni<\/td><td>4%/);
  assert.match(f.ids.get('optykerCashRchProfile').innerHTML,/<td>3<\/td><td>Servizi<\/td><td>Esente N4/);
  assert.match(f.ids.get('optykerCashRchProfile').innerHTML,/lettura del 12\/09\/2026/);
  assert.doesNotMatch(f.ids.get('optykerCashRchModal').innerHTML,/Reparti recuperati da Blu Data/);
  f.ids.get('optykerCashRchPreflight').onclick();
  assert.match(f.ids.get('optykerCashRchPreflightResult').innerHTML,/Dati del carrello compatibili/);
  assert.match(f.ids.get('optykerCashRchPreflightResult').innerHTML,/Emissione ancora bloccata/);
  assert.equal(f.requests.length,0);
});
test('cash preflight passes only explicit fiscal type; a service cannot use a goods department',()=>{
  const f=fixture();f.hooks.state.stage='balance';
  f.hooks.state.cart={one:{qty:1,item:{title:'Servizio',price:'10.00',fiscal_vat_code:'04',fiscal_item_type:'services'}}};
  f.hooks.openRch();f.ids.get('optykerCashRchPreflight').onclick();
  assert.match(f.ids.get('optykerCashRchPreflightResult').innerHTML,/combinazione di IVA e bene\/servizio/);
  delete f.hooks.state.cart.one.item.fiscal_item_type;
  f.hooks.state.cart.one.item.product_type='Servizi';
  f.ids.get('optykerCashRchPreflight').onclick();
  assert.match(f.ids.get('optykerCashRchPreflightResult').innerHTML,/Tipologia fiscale bene\/servizio da assegnare/);
  assert.equal(f.requests.length,0);
});
test('missing VAT and bank transfer are flagged without inference or cart mutation',()=>{
  const f=fixture();f.hooks.state.stage='balance';f.hooks.state.payment='bank';
  f.hooks.state.cart={one:{qty:1,item:{title:'Lens',price:'1.01'}}};
  const before=JSON.stringify(f.hooks.state.cart);
  f.hooks.openRch();f.ids.get('optykerCashRchPreflight').onclick();
  const html=f.ids.get('optykerCashRchPreflightResult').innerHTML;
  assert.match(html,/codice mancante/);assert.match(html,/Metodo di pagamento senza codice RCH verificato/);
  assert.equal(JSON.stringify(f.hooks.state.cart),before);assert.equal(f.requests.length,0);
});
test('missing preflight script leaves existing RCH diagnostics available',()=>{
  const f=fixture(false);f.hooks.openRch();
  assert.equal(f.ids.get('optykerCashRchPreflight').disabled,true);
  assert.match(f.ids.get('optykerCashRchProfile').textContent,/non caricato/);
  assert.equal(typeof f.ids.get('optykerCashRchTest').onclick,'function');
});
test('real diagnostic mode Z is reachable but does not produce a green ready badge',async()=>{
  const f=fixture();await f.hooks.testRch(true);
  assert.equal(f.hooks.state.rchOk,false);
  assert.equal(f.requests.length,2);
  assert.ok(f.requests.every(r=>r.url.endsWith('/health')||r.url.endsWith('/status')));
});

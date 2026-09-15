import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';

const bundle=readFileSync(new URL('../_site/cash-register.js',import.meta.url),'utf8');
const persistence=readFileSync(new URL('../cash-client-cart.js',import.meta.url),'utf8');
const selection=readFileSync(new URL('../cash-cart-selection.js',import.meta.url),'utf8');
const checkoutSource=bundle.slice(bundle.indexOf('async function recoverCashCheckout(){'),bundle.indexOf('function openDeposits(){'));
function fixture(){
  const fields={},requests=[],messages=[],storage=new Map(),events=[];
  const E=id=>id==='optykerCashCartItems'?null:(fields[id]??={value:'',checked:false,style:{},focus(){}});
  const noop=()=>{};
  const c=vm.createContext({console,Promise,crypto:webcrypto,setTimeout,clearTimeout,
    document:{querySelector:()=>null},window:{addEventListener:noop,OPTYKER_FISCAL:{checkReady:async()=>events.push('ready'),issuePayment:async()=>events.push('print'),openSale:async()=>events.push('open')}},
    S:{cart:{},clientId:'',stage:'balance',payment:'card',busy:false},E,
    renderCart:noop,add:noop,qty:noop,removeLine:noop,ensureUI:noop,openCash:noop,closeCash:noop,updateTsAvailability:noop,
    sessionStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},
    toast:(m)=>messages.push(m),euro:n=>String(n),depositAmount:()=>Number(E('optykerCashDeposit').value),cashFiscalCode:()=>'',
    api:async(action,payload)=>{requests.push({action,payload});return await c.respond(action,payload)},
    respond:async(action,p)=>({data:action==='client_cart_save'?{client_id:p.client_id,items:p.items,updated_at:'v2'}:{id:'sale',client_id:p.client_id||'',payment:{id:'payment'},total:p.expected_total}}),
  });
  vm.runInContext('function cartRows(){return Object.values(S.cart).filter(x=>x.qty>0)}\n'+checkoutSource+'\n'+persistence+'\n'+selection,c);
  function row(id,price,selected=true){c.S.cart[id]={item:{variant_id:id,title:id,price},qty:1,department:1,selected};return c.S.cart[id]}
  return {c,row,fields,E,requests,messages,events,storage};
}
test('only checked lines enter total, checkout and fiscal emission; deferred line remains',async()=>{
  const f=fixture();f.row('one',12);f.row('client_cart:deferred',100,false).department=null;
  assert.equal(f.c.cartTotal(),12);await f.c.checkout();
  const req=f.requests.find(x=>x.action==='checkout');assert.equal(req.payload.lines.length,1);assert.equal(req.payload.lines[0].variant_id,'one');assert.equal(req.payload.expected_total,12);
  assert.deepEqual(Object.keys(f.c.S.cart),['client_cart:deferred']);assert.deepEqual(f.events,['ready','print']);
});
test('nothing selected cannot start a zero-price stock movement',async()=>{
  const f=fixture();f.row('one',12,false);await f.c.checkout();assert.equal(f.requests.length,0);assert.equal(f.events.length,0);assert.equal(f.c.cartTotal(),0);
});
test('manual unit prices and deposits are calculated on selected lines',async()=>{
  const f=fixture();f.row('one',100).unitPrice=80;f.row('later',500,false);f.c.S.stage='deposit';f.E('optykerCashDeposit').value='90';await f.c.checkout();assert.equal(f.requests.length,0);
  f.E('optykerCashDeposit').value='20';await f.c.checkout();const p=f.requests.find(r=>r.action==='checkout').payload;
  assert.equal(p.expected_total,80);assert.equal(p.deposit_amount,20);assert.equal(p.lines[0].unit_price_override,80);
});
test('zero-price selected line still supports existing stock-only flow',async()=>{
  const f=fixture();f.row('free',0);f.row('later',100,false);await f.c.checkout();const p=f.requests.find(r=>r.action==='checkout').payload;
  assert.equal(p.expected_total,0);assert.equal(p.auto_receipt,false);assert.deepEqual(f.events,[]);assert.deepEqual(Object.keys(f.c.S.cart),['later']);
});
test('client save completes before checkout; server remaining cart and selections are restored',async()=>{
  const f=fixture();f.c.S.clientId='clientA';f.row('pay',10);f.row('later',20,false).unitPrice=18;
  f.c.respond=async(a,p)=>{if(a==='client_cart_save'){await new Promise(r=>setTimeout(r,8));return {data:{client_id:p.client_id,items:p.items,updated_at:'saved'}}}return {data:{id:'sale',client_id:'clientA',payment:{id:'p'},client_cart:{client_id:'clientA',updated_at:'paid',items:[{variant_id:'later',price:20,quantity:1,selected:false,unit_price_override:18}]}}}};
  await f.c.checkout();assert.deepEqual(f.requests.map(x=>x.action),['client_cart_save','checkout']);
  assert.equal(f.requests[0].payload.items.length,2);assert.equal(f.requests[0].payload.items[1].selected,false);assert.equal(f.c.S.cart.later.selected,false);assert.equal(f.c.S.cart.later.unitPrice,18);assert.equal(f.c.clientCartVersions.clientA,'paid');
});
test('failed save prevents the payment; checkout timeout keeps rows and recovery id',async()=>{
  const f=fixture();f.c.S.clientId='clientA';f.row('pay',10);f.row('later',20,false);f.c.respond=async()=>{throw new Error('Save conflict')};
  await f.c.checkout();assert.deepEqual(f.requests.map(x=>x.action),['client_cart_save']);assert.equal(f.events.length,0);assert.equal(Object.keys(f.c.S.cart).length,2);
  const g=fixture();g.row('pay',10);g.row('later',20,false);g.c.respond=async()=>{throw new Error('Timeout')};await g.c.checkout();assert.equal(Object.keys(g.c.S.cart).length,2);assert.ok(g.storage.get('optykerCashPendingRequest'));
  await g.c.checkout();assert.equal(g.requests.length,1);
});
test('recovery applies remaining cart without clearing another selected customer',async()=>{
  const f=fixture();f.c.S.clientId='clientA';f.row('later',20,false);f.storage.set('optykerCashPendingRequest',JSON.stringify({id:webcrypto.randomUUID()}));
  f.c.respond=async()=>({data:{sale:{id:'s',client_id:'clientA',status:'completed',paid_amount:10},payment:{id:'p',automatic_receipt:true},client_cart:{client_id:'clientA',items:[{variant_id:'later',quantity:1,price:20,selected:false}],updated_at:'after'}}});
  await f.c.recoverCashCheckout();assert.equal(f.c.S.cart.later.selected,false);assert.equal(f.storage.size,0);assert.deepEqual(f.events,['ready','print']);
  f.c.applyCheckoutCart({client_id:'clientB',client_cart:{client_id:'clientB',items:[]}},[]);assert.ok(f.c.S.cart.later);
});
test('a stale save cannot replace the cart while checkout is in progress',async()=>{
  const f=fixture();f.c.S.clientId='clientA';f.row('later',20,false);let release;f.c.respond=async()=>{await new Promise(r=>release=r);return {data:{items:[],updated_at:'old'}}};
  const pending=f.c.clientCartSaveNow('clientA');await Promise.resolve();f.c.S.busy=true;release();await pending;assert.ok(f.c.S.cart.later);
});

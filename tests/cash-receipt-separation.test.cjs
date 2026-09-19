const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const source=fs.readFileSync(require('node:path').join(__dirname,'../cash-receipt-separation.js'),'utf8');
const shop='https://whgziwaegjzqsgcntesr.supabase.co/functions/v1/optyker-cash-register-api';
const local='https://whgziwaegjzqsgcntesr.supabase.co/functions/v1/optyker-cash-local-api';
function fixture(inCheckout=true){
 let label='Incassa',help='Vecchio testo',labelWrites=0,helpWrites=0,callback;
 const calls=[];
 const button={disabled:true,onclick:()=>42,get textContent(){return label},set textContent(v){label=v;labelWrites++}};
 const node={closest:()=>inCheckout?{}:null,get innerHTML(){return help},set innerHTML(v){help=v;helpWrites++}};
 const document={readyState:'complete',documentElement:{},getElementById:()=>button,querySelector:()=>node};
 const window={fetch:(...args)=>{calls.push(args);return Promise.resolve({ok:true})}};
 const context={window,document,MutationObserver:class{constructor(fn){callback=fn}observe(){}}};
 vm.runInNewContext(source,context);
 return {window,calls,button,node,context,refresh:()=>callback([]),counts:()=>({labelWrites,helpWrites})};
}
test('identical help and button labels settle after one mutation',()=>{
 const f=fixture();const handler=f.button.onclick;
 for(let i=0;i<200;i++)f.refresh();
 assert.deepEqual(f.counts(),{labelWrites:1,helpWrites:1});
 assert.equal(f.button.disabled,true);assert.equal(f.button.onclick,handler);
 f.node.innerHTML='Testo sostituito';f.refresh();
 assert.equal(f.counts().helpWrites,3);
 f.refresh();assert.equal(f.counts().helpWrites,3);
});
test('does not rewrite help outside the native checkout section',()=>{
 const f=fixture(false);for(let i=0;i<20;i++)f.refresh();
 assert.equal(f.counts().helpWrites,0);
});
test('physical receipt still routes to local API with unchanged request object',async()=>{
 const f=fixture();
 const init={method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'checkout',payload:{auto_receipt:true,invoice_requested:false,lines:[]}})};
 await f.window.fetch(shop,init);
 assert.equal(f.calls[0][0],local);assert.equal(f.calls[0][1],init);
});
test('invoice, non-receipt, read-only and malformed requests retain their route',async()=>{
 const f=fixture();
 for(const body of [{action:'checkout',payload:{auto_receipt:true,invoice_requested:true}},{action:'checkout',payload:{auto_receipt:false}},{action:'clients',payload:{}},{action:'quote_lines',payload:{}}]){
  const init={method:'POST',body:JSON.stringify(body)};await f.window.fetch(shop,init);
  assert.equal(f.calls.at(-1)[0],shop);assert.equal(f.calls.at(-1)[1],init);
 }
 const bad={method:'POST',body:'not json'};await f.window.fetch(shop,bad);
 assert.equal(f.calls.at(-1)[0],shop);assert.equal(f.calls.at(-1)[1],bad);
 await f.window.fetch('/local-asset.js');assert.equal(f.calls.at(-1)[0],'/local-asset.js');
});
test('loading the adapter twice preserves one request wrapper',()=>{
 const f=fixture(),fetch=f.window.fetch;vm.runInNewContext(source,f.context);
 assert.equal(f.window.fetch,fetch);assert.equal(f.window.OPTYKER_CASH_RECEIPT_SEPARATION_V1,'20260919-cash-open1');
});

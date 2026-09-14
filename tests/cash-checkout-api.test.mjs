import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';
import {readFileSync} from 'node:fs';import {stripTypeScriptTypes} from 'node:module';import {webcrypto} from 'node:crypto';
import * as fiscal from '../supabase/functions/optyker-cash-register-api/fiscal.mjs';import {fiscalCode} from '../supabase/functions/optyker-fiscal-api/domain.mjs';
import * as pricing from '../supabase/functions/optyker-cash-register-api/lens-pricing.mjs';
const src=stripTypeScriptTypes(readFileSync(new URL('../supabase/functions/optyker-cash-register-api/index.ts',import.meta.url),'utf8').replace(/^import .*;\s*$/gm,''),{mode:'transform'});
const vid='gid://shopify/ProductVariant/1',requestId='12345678-1234-4234-8234-123456789abc';
function setup({availableForSale=true,status="ACTIVE"}={}){
 const tables={optyker_inventory_items:[{shopify_variant_id:vid,vat_code:'04',category:'frames',active:true}]},mutations=[];let handler;
 class Query{
  constructor(table){this.table=table;this.filters=[];this.action='read';this.one=false;}
  select(){return this}order(){return this}limit(){return this}maybeSingle(){this.one=true;return this}single(){this.one=true;return this}
  eq(k,v){this.filters.push(row=>k.includes('->>')?row[k.split('->>')[0]]?.[k.split('->>')[1]]===v:row[k]===v);return this}
  in(k,vs){this.filters.push(row=>vs.includes(row[k]));return this}
  insert(p){this.action='insert';this.payload=p;return this}update(p){this.action='update';this.payload=p;return this}upsert(p){return this.insert(p)}
  then(resolve,reject){try{
   const table=tables[this.table]??=([]);let rows=table.filter(row=>this.filters.every(f=>f(row)));
   if(this.action==='insert'){
    const input=Array.isArray(this.payload)?this.payload:[this.payload];
    if(this.table==='optyker_pos_sales'&&input.some(v=>v.data?.checkout_request_id&&table.some(row=>row.data?.checkout_request_id===v.data.checkout_request_id)))return Promise.resolve({data:null,error:{code:'23505',message:'duplicate'}}).then(resolve,reject);
    rows=input.map(v=>({...structuredClone(v),id:webcrypto.randomUUID(),created_at:'2026-09-13T12:00:00Z'}));table.push(...rows);
   }else if(this.action==='update')rows.forEach(r=>Object.assign(r,structuredClone(this.payload)));
   return Promise.resolve({data:structuredClone(this.one?(rows[0]||null):rows),error:null}).then(resolve,reject);
  }catch(e){return Promise.reject(e).then(resolve,reject)}}
 }
 const db={rpc:async()=>({data:{ok:true,username:'TEST'},error:null}),from:t=>new Query(t)};
 const fakeFetch=async(url,options)=>{
  if(url.endsWith('/oauth/access_token'))return Response.json({access_token:'TEST',expires_in:3600});
  const body=JSON.parse(options.body),q=body.query;let data;
  if(q.includes('CashVariants'))data={nodes:[{id:vid,title:'Default Title',price:'14.50',availableForSale,product:{status,id:'gid://shopify/Product/1',title:'Articolo'}}]};
  else if(q.includes('CashDraftCreate')){mutations.push(body);data={draftOrderCreate:{draftOrder:{id:'gid://shopify/DraftOrder/1',name:'#D1',totalPriceSet:{shopMoney:{amount:'29.00',currencyCode:'EUR'}}},userErrors:[]}}}
  else if(q.includes('CashDraftComplete')){mutations.push(body);data={draftOrderComplete:{draftOrder:{id:'gid://shopify/DraftOrder/1',order:{id:'gid://shopify/Order/1',name:'#1',totalPriceSet:{shopMoney:{amount:'29.00',currencyCode:'EUR'}}}},userErrors:[]}}}
  else throw Error('Unexpected external request');
  return Response.json({data});
 };
 vm.runInNewContext(src,{...pricing,...fiscal,fiscalCode,createClient:()=>db,Deno:{env:{get:()=> 'TEST'},serve:f=>handler=f},fetch:fakeFetch,Response,Request,URLSearchParams,crypto:webcrypto,TextEncoder,console,
  ovcContext:async()=>({card:null,services:[]}),serviceForId:()=>null,isServiceId:()=>false,serviceDraftLine:()=>null,assertOvcTotal:()=>{},OVC_VERSION:'20260910-ovc2'});
 const call=async(payload,action="checkout")=>{const r=await handler(new Request('https://example.test',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,username:'TEST',password:'TEST PASSWORD',payload})}));return r.json()};
 return {tables,mutations,call};
}
const payload={request_id:requestId,client_id:'',lines:[{variant_id:vid,quantity:2,department:1}],payment_method:'card',payment_stage:'balance',expected_total:29,auto_receipt:true,ts_requested:true,ts_expense_code:'AD',fiscal_code:'RSSMRA80A01H501U'};
test('real checkout handler accepts occasional CF, snapshots the receipt, and keeps CF out of Shopify',async()=>{
 const {call,tables,mutations}=setup(),r=await call(payload);assert.equal(r.ok,true,r.error);
 assert.equal(r.data.client_id,null);assert.equal(r.data.payment.data.fiscal_snapshot.fiscal,payload.fiscal_code);
 assert.equal(r.data.ts_document.client_id,null);assert.equal(r.data.ts_document.fiscal_code,payload.fiscal_code);
 assert.equal(tables.optyker_clients,undefined);assert.equal(mutations.length,2);assert.ok(!JSON.stringify(mutations).includes(payload.fiscal_code));
 assert.equal(r.data.payment.data.fiscal_snapshot.totalCents,2900);
 const again=await call(payload);assert.equal(again.ok,true,again.error);assert.equal(again.data.id,r.data.id);assert.equal(mutations.length,2);assert.equal(tables.optyker_pos_payments.length,1);
 const changed=await call({...payload,fiscal_code:'VRDLGI80A01H501K'});assert.equal(changed.ok,false);assert.equal(mutations.length,2);
});
test('invalid CF, missing fiscal mapping and unsupported payment fail before sale or Shopify mutations',async()=>{
 for(const patch of [{fiscal_code:'RSSMRA80A01H501X'},{fiscal_code:''},{payment_method:'bank'},{lines:[{variant_id:vid,quantity:2,department:9}]}]){
  const {call,tables,mutations}=setup(),r=await call({...payload,...patch});assert.equal(r.ok,false);assert.equal(mutations.length,0);assert.equal(tables.optyker_pos_sales.length,0);
 }
});
test('concurrent retries of the same checkout create only one order and one payment',async()=>{
 const {call,tables,mutations}=setup();await Promise.all([call(payload),call(payload)]);assert.equal(mutations.length,2);assert.equal(tables.optyker_pos_sales.length,1);assert.equal(tables.optyker_pos_payments.length,1);
});

test('POS quotes an out-of-stock variant but still rejects archived products',async()=>{
 const live=setup({availableForSale:false});
 const quoted=await live.call({lines:payload.lines},'quote_lines');assert.equal(quoted.ok,true,quoted.error);assert.equal(live.mutations.length,0);
 const archived=setup({availableForSale:false,status:'ARCHIVED'});
 const refused=await archived.call({lines:payload.lines},'quote_lines');assert.equal(refused.ok,false);assert.equal(archived.mutations.length,0);
});

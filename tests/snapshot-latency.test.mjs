import test from 'node:test';import assert from 'node:assert/strict';
import {readRecordedBalancesFrom} from '../supabase/functions/optyker-cash-balance-api/snapshot-reader.mjs';
const id='00000000-0000-4000-8000-000000000099';
const item={variant_id:'order:TEST',quantity:1,price:450};
const sale={id:'sale',client_id:id,total:450,paid_amount:200,due_amount:250,status:'open_balance',data:{client_cart_selection:true,lines:[item]}};
const rows={cart:{client_id:id,items:[item],updated_at:'stamp'},sales:[sale],payments:[{id:'pay',sale_id:'sale',client_id:id,amount:200}],jobs:[],active:[]};
const delay=ms=>new Promise(r=>setTimeout(r,ms));
function fixture({bad='',empty=false}={}){const events=[];const db={from(table){const filters=[],query={table,fields:'',select(s){query.fields=s;return query},eq(k,v){filters.push([k,v]);return query},in(k,v){filters.push([k,v]);return query},is(k,v){filters.push([k,v]);return query},order(){return query},limit(){return query},maybeSingle(){return query},then(resolve,reject){
 const key=table==='optyker_client_carts'?'cart':table==='optyker_pos_sales'?'sales':table==='optyker_pos_payments'?'payments':filters.some(x=>x[0]==='serial')?'active':'jobs';
 events.push([key,'start',filters]);return delay(20).then(()=>{events.push([key,'end']);return {data:empty&&key==='sales'?[]:rows[key],error:bad===key?{message:'FAIL'}:null}}).then(resolve,reject);
 }};return query;}};return {db,events};}
test('same deposit result with three independent reads followed by two independent reads',async()=>{
 const e=fixture(),r=await readRecordedBalancesFrom(e.db,id);assert.equal(r.groups[0].due_cents,25000);assert.equal(r.groups[0].paid_cents,20000);assert.equal(r.cart_version,'stamp');
 assert.deepEqual(e.events.slice(0,3).map(x=>x.slice(0,2)),[['active','start'],['cart','start'],['sales','start']]);
 for(const name of ['payments','jobs'])assert.ok(e.events.findIndex(x=>x[0]===name&&x[1]==='start')<e.events.findIndex(x=>x[0]==='payments'&&x[1]==='end'));
 assert.equal(e.events.filter(x=>x[1]==='start').length,5);
});
test('each failed read blocks the snapshot rather than converting unknown payments to zero',async()=>{
 for(const bad of ['active','cart','sales','payments','jobs'])await assert.rejects(readRecordedBalancesFrom(fixture({bad}).db,id),/Verifica acconti non disponibile/);
});
test('walk-in needs only the blocking-job read and invalid IDs trigger no read',async()=>{
 const e=fixture(),r=await readRecordedBalancesFrom(e.db,'');assert.equal(r.client_id,'');assert.deepEqual(e.events.map(x=>x.slice(0,2)),[['active','start'],['active','end']]);
 const bad=fixture();await assert.rejects(readRecordedBalancesFrom(bad.db,'not-a-client'),/Cliente non valido/);assert.equal(bad.events.length,0);
});
test('empty sales do not query other clients payments or jobs',async()=>{
 const e=fixture({empty:true}),r=await readRecordedBalancesFrom(e.db,id);assert.equal(r.groups.length,0);assert.equal(e.events.filter(x=>x[1]==='start').length,3);
 const scoped=e.events.filter(x=>['cart','sales'].includes(x[0])&&x[1]==='start');for(const x of scoped)assert.ok(x[2].some(f=>f[0]==='client_id'&&f[1]===id));
});

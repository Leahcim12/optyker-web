import test from 'node:test';
import assert from 'node:assert/strict';
import {listHistory,receiptDetail,setHistoryVisibility} from '../supabase/functions/optyker-cash-register-api/history.ts';

const saleId='11111111-1111-4111-8111-111111111111';
const clientId='22222222-2222-4222-8222-222222222222';
const otherId='33333333-3333-4333-8333-333333333333';
function database(){
  const tables={
    optyker_pos_sales:[{id:saleId,client_id:clientId,total:100,paid_amount:40,due_amount:60,status:'open_balance',data:{client_snapshot:{surname:'Rossi',name:'Mario',fiscal:'PRIVATE'},lines:[{title:'Lenti',price:50,quantity:2,total:100}],shopify:{private:'never return'}}}],
    optyker_pos_payments:[{sale_id:saleId,amount:40,payment_stage:'deposit'}],
    optyker_pos_sale_items:[],optyker_pos_history_visibility:[],optyker_pos_history:[]
  };
  const writes=[];
  return {tables,writes,from(table){
    const filters=[];let payload=null,start=0,end=Infinity;
    const q={select(){return q},eq(k,v){filters.push(r=>r[k]===v);return q},is(k,v){filters.push(r=>r[k]===v);return q},order(){return q},range(a,b){start=a;end=b;return q},upsert(v){payload=v;return q},maybeSingle(){return Promise.resolve(run(true))},then(a,b){return Promise.resolve(run(false)).then(a,b)}};
    function run(single){
      if(payload){writes.push({table,payload});let old=tables[table].find(r=>r.sale_id===payload.sale_id);if(old)Object.assign(old,payload);else tables[table].push({...payload})}
      const rows=tables[table].filter(r=>filters.every(f=>f(r))).slice(start,end+1);
      return {data:single?(rows[0]||null):rows,error:null};
    }
    return q;
  }};
}
test('receipt belongs to the selected customer, uses stored values, and never writes',async()=>{
  const db=database();
  await assert.rejects(receiptDetail(db,{sale_id:saleId,client_id:otherId}),/non trovata/);
  const receipt=await receiptDetail(db,{sale_id:saleId,client_id:clientId});
  assert.equal(receipt.client_name,'Rossi Mario');assert.equal(receipt.items[0].total,100);
  assert.equal(receipt.payments[0].amount,40);assert.equal(receipt.due_amount,60);
  assert.ok(!JSON.stringify(receipt).includes('PRIVATE'));assert.ok(!JSON.stringify(receipt).includes('never return'));
  assert.equal(db.writes.length,0);
});
test('delete and restore change visibility only, retaining sale and payment records',async()=>{
  const db=database(),original=JSON.stringify(db.tables.optyker_pos_sales),payments=JSON.stringify(db.tables.optyker_pos_payments);
  const payload={sale_id:saleId,client_id:clientId,hidden:true,confirm:true};
  await setHistoryVisibility(db,payload,'Michael Mologni');
  assert.ok(db.tables.optyker_pos_history_visibility[0].hidden_at);
  await setHistoryVisibility(db,payload,'Michael Mologni');
  assert.equal(db.tables.optyker_pos_history_visibility.length,1);
  await setHistoryVisibility(db,{...payload,hidden:false},'Michael Mologni');
  assert.equal(db.tables.optyker_pos_history_visibility[0].hidden_at,null);
  assert.equal(db.tables.optyker_pos_history_visibility[0].changed_by,'Michael Mologni');
  assert.equal(JSON.stringify(db.tables.optyker_pos_sales),original);assert.equal(JSON.stringify(db.tables.optyker_pos_payments),payments);
  assert.ok(db.writes.every(w=>w.table==='optyker_pos_history_visibility'));
});
test('mutation requires confirmation and correct customer; invalid IDs fail closed',async()=>{
  const db=database();
  for(const p of [{sale_id:saleId,hidden:true},{sale_id:saleId,hidden:'true',confirm:true},{sale_id:saleId,client_id:otherId,hidden:true,confirm:true},{sale_id:'invalid',hidden:true,confirm:true}])await assert.rejects(setHistoryVisibility(db,p,'Operator'));
  assert.equal(db.writes.length,0);
});
test('history filters customers and deleted entries and paginates older receipts',async()=>{
  const db=database();db.tables.optyker_pos_history=Array.from({length:35},(_,i)=>({id:i,client_id:clientId,hidden_at:i===0?'2026-09-09':null}));
  db.tables.optyker_pos_history.push({id:40,client_id:otherId,hidden_at:null});
  const first=await listHistory(db,{client_id:clientId});assert.equal(first.data.length,30);assert.equal(first.has_more,true);assert.equal(first.data[0].id,1);
  const next=await listHistory(db,{client_id:clientId,offset:30});assert.equal(next.data.length,4);assert.equal(next.has_more,false);
  const deleted=await listHistory(db,{client_id:clientId,include_deleted:true});assert.equal(deleted.data[0].id,0);
});

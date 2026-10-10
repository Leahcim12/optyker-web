const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {stripTypeScriptTypes}=require('node:module');
function setup(){
 const data={frame:{type:'Cerchiata',brand:'TEST',price:100},lens:{lens_type_od:'Monofocale',lens_type_os:'Monofocale',unit_price:100},warranty:'Base',notes:'Keep me',pricing:{total:300}};
 const row={id:'sheet',client_id:'client',sheet_type:'eyewear_job',document_type:'Busta',reference_code:'TEST-B',updated_at:'2026-10-10T09:00:00.000Z',data};
 const work={id:'work',status:'da_fare',payload:{existing:'kept'}};const writes=[];let handler;
 const db={rpc:async()=>({data:{ok:true,username:'synthetic-staff'}}),from(table){
  let values,filters={};const q={select(){return q},eq(k,v){filters[k]=v;return q},order(){return q},limit(){return q},update(v){values=v;return q},single(){return run()},maybeSingle(){return run()},then(resolve,reject){return run().then(resolve,reject)}};
  async function run(){
   if(table==='optyker_sheets'){
    if(filters.id!==row.id||filters.client_id!==row.client_id)return {data:null};
    if(values){if(filters.updated_at!==row.updated_at)return {data:null};writes.push({table,filters:{...filters},values:structuredClone(values)});Object.assign(row,structuredClone(values));}
    return {data:structuredClone(row)};
   }
   if(table==='optyker_work_orders'){if(values){writes.push({table,values:structuredClone(values)});Object.assign(work,structuredClone(values));}return {data:structuredClone(work)}}
   if(table==='optyker_clients')return {data:{id:'client',name:'TEST'}};
   if(table==='optyker_quote_order_links')return {data:[]};
   throw Error('Unexpected table '+table);
  }
  return q;
 }};
 const parameters=fs.readFileSync('eyewear-order-parameters.mjs','utf8').replaceAll('export ','');
 const code=stripTypeScriptTypes(fs.readFileSync('supabase/functions/optyker-eyewear-edit-api/index.ts','utf8').replace(/^import .*;\n/gm,''));
 const ctx=vm.createContext({createClient:()=>db,Deno:{env:{get:()=>''},serve:fn=>handler=fn},structuredClone,Response,Request});
 vm.runInContext(parameters+'\n'+code,ctx);
 const request=async payload=>handler(new Request('https://synthetic.invalid',{method:'POST',body:JSON.stringify({action:'update',username:'synthetic-staff',password:'synthetic-password',payload})}));
 const payload=()=>({...structuredClone(data),edit_sheet_id:row.id,client_id:row.client_id,expected_updated_at:row.updated_at});
 return {ctx,row,work,writes,request,payload};
}
test('two existing-sheet saves persist final price and matching laboratory snapshot with one sheet write each',async()=>{
 const h=setup();
 for(const amount of [285.5,280]){
  const before=h.row.updated_at;const r=await h.request({...h.payload(),manual_final_price:amount});const x=await r.json();
  assert.equal(r.status,200);assert.equal(x.manual_final_price_saved,true);
  assert.equal(x.data.id,'sheet');assert.equal(x.data.reference_code,'TEST-B');
  assert.equal(x.data.data.pricing.total,amount);assert.equal(x.data.data.pricing.manual_final_price,amount);
  assert.equal(x.data.data.pricing.calculated_total,300);assert.equal(x.data.data.notes,'Keep me');
  assert.equal(h.work.payload.snapshot.pricing.total,amount);assert.equal(h.work.payload.source_updated_at,x.data.updated_at);
  assert.equal(h.work.payload.existing,'kept');assert.equal(h.writes.at(-2).filters.updated_at,before);
 }
 assert.equal(h.writes.length,4);
});
test('existing override is kept on other edits; explicit reset clears it; zero is a valid price',async()=>{
 const h=setup();h.row.data.pricing.manual_final_price=250;h.row.data.manual_final_price=250;
 let x=await (await h.request(h.payload())).json();assert.equal(x.data.data.pricing.total,250);
 x=await (await h.request({...h.payload(),clear_manual_final_price:true})).json();
 assert.equal(x.data.data.pricing.total,300);assert.equal(x.data.data.manual_final_price,undefined);assert.equal(x.data.data.pricing.manual_final_price,undefined);
 x=await (await h.request({...h.payload(),manual_final_price:0})).json();assert.equal(x.data.data.pricing.total,0);
});
test('invalid price, stale session, wrong client and closed order reject without writes',async()=>{
 for(const change of [{manual_final_price:-1},{manual_final_price:'abc'},{manual_final_price:''},{manual_final_price:1000001},{expected_updated_at:'2026-10-09'},{client_id:'other'}]){
  const h=setup();const response=await h.request({...h.payload(),...change});assert.equal(response.status,400);assert.equal(h.writes.length,0);
 }
 const h=setup();h.work.status='completato';assert.equal((await h.request(h.payload())).status,400);assert.equal(h.writes.length,0);
});

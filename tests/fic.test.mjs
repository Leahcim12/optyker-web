import test from 'node:test';
import assert from 'node:assert/strict';
import {startConnection,finishConnection,syncFic} from '../supabase/functions/optyker-billing-admin/fic.ts';
const env={FIC_CLIENT_ID:'test-client',FIC_CLIENT_SECRET:'test-secret',SUPABASE_SERVICE_ROLE_KEY:'test-encryption-key',SUPABASE_URL:'https://example.supabase.co'};
globalThis.Deno={env:{get:k=>env[k]}};
function database(){
 const tables={optyker_fic_states:[],optyker_fic_connection:[],optyker_billing_invoices:[],optyker_billing_provider_config:[]};
 return {tables,from(table){
  let op='select',value,filters=[];
  const q={select(){return q},eq(k,v){filters.push(r=>r[k]===v);return q},lt(k,v){filters.push(r=>r[k]<v);return q},gt(k,v){filters.push(r=>r[k]>v);return q},delete(){op='delete';return q},insert(v){op='insert';value=v;return q},upsert(v){op='upsert';value=v;return q},update(v){op='update';value=v;return q},maybeSingle(){return Promise.resolve(run(true))},then(a,b){return Promise.resolve(run(false)).then(a,b)}};
  function run(single){let rows=tables[table].filter(r=>filters.every(f=>f(r)));
   if(op==='delete')tables[table]=tables[table].filter(r=>!rows.includes(r));
   if(op==='insert'||op==='upsert'){
    let row=op==='upsert'?tables[table].find(r=>r.id===value.id):null;
    if(row)Object.assign(row,value);else{row={id:crypto.randomUUID(),lease_until:'1970-01-01T00:00:00Z',...value};tables[table].push(row)} rows=[row];
   }
   if(op==='update')rows.forEach(r=>Object.assign(r,value));
   return {data:single?(rows[0]?{...rows[0]}:null):rows.map(r=>({...r})),error:null};
  }return q;
 }};
}
function apiMock({vat='04679780165',fail=false,expired=false}={}){
 const calls=[];
 globalThis.fetch=async (url,opts={})=>{
  const u=new URL(url);calls.push({url:u,opts});
  if(u.pathname==='/oauth/token')return Response.json({access_token:'private-access',refresh_token:'private-refresh',expires_in:expired?1:3600});
  if(u.pathname==='/user/companies')return Response.json({data:{companies:[{id:123,vat_number:vat}]}});
  if(fail)return new Response('',{status:429});
  const type=u.searchParams.get('type'),page=Number(u.searchParams.get('page'));
  const data=type==='invoice'?[{id:page,number:page,date:'2026-09-01',amount_gross:122,entity:{name:'Test'}}]:type==='expense'?[{id:3,invoice_number:'SUP-3',date:'2026-09-01',amount_gross:45}]:[];
  return Response.json({data,last_page:type==='invoice'?2:1});
 };return calls;
}
async function connect(db){const url=new URL(await startConnection(db));await finishConnection(db,new Request('https://example.supabase.co/callback?code=fake&state='+url.searchParams.get('state')));return url;}
test('rejects missing, expired and reused OAuth state before requesting tokens',async()=>{
 const db=database(),calls=apiMock();
 await assert.rejects(finishConnection(db,new Request('https://example.com/?code=fake')));
 const expired=new URL(await startConnection(db));db.tables.optyker_fic_states[0].expires_at='2000-01-01T00:00:00Z';
 await assert.rejects(finishConnection(db,new Request('https://example.com/?code=fake&state='+expired.searchParams.get('state'))));assert.equal(calls.length,0);
 const url=await connect(db),before=calls.length;
 await assert.rejects(finishConnection(db,new Request('https://example.com/?code=fake&state='+url.searchParams.get('state'))));assert.equal(calls.length,before);
 assert.ok(!db.tables.optyker_fic_connection[0].tokens.includes('private-access'));
 assert.ok(!db.tables.optyker_fic_connection[0].tokens.includes('private-refresh'));
 assert.ok(url.searchParams.get('scope').split(' ').every(s=>s.endsWith(':r')));
});
test('rejects a different company without saving tokens',async()=>{
 const db=database();apiMock({vat:'00000000000'});await assert.rejects(connect(db),/MOLOGNI/);assert.equal(db.tables.optyker_fic_connection.length,0);
});
test('imports all pages and repeated sync updates without duplicates',async()=>{
 const db=database();const calls=apiMock({expired:true});await connect(db);assert.deepEqual(await syncFic(db),{count:3});await syncFic(db);
 assert.equal(db.tables.optyker_billing_invoices.length,3);
 assert.equal(db.tables.optyker_billing_invoices.find(r=>r.direction==='incoming').invoice_number,'SUP-3');
 assert.equal(db.tables.optyker_billing_provider_config[0].enabled,true);
 assert.equal(db.tables.optyker_fic_connection[0].lease,null);
 assert.ok(calls.some(c=>c.opts.body && JSON.parse(c.opts.body).grant_type==='refresh_token'));
 assert.ok(calls.filter(c=>c.url.pathname!='/oauth/token').every(c=>!c.opts.method||c.opts.method==='GET'));
});
test('API failure preserves invoices and releases the sync lease',async()=>{
 const db=database();apiMock();await connect(db);apiMock({fail:true});await assert.rejects(syncFic(db),/429/);assert.equal(db.tables.optyker_billing_invoices.length,0);assert.equal(db.tables.optyker_fic_connection[0].lease,null);
});
test('parallel sync and reconnect cannot replace active tokens',async()=>{
 const db=database();apiMock();await connect(db);const c=db.tables.optyker_fic_connection[0],tokens=c.tokens;c.lease_until=new Date(Date.now()+180000).toISOString();
 await assert.rejects(syncFic(db),/già in corso/);await assert.rejects(connect(db),/Aggiornamento in corso/);assert.equal(c.tokens,tokens);
});

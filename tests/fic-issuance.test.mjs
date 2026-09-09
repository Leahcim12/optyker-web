import test from 'node:test';
import assert from 'node:assert/strict';
import {makeDocument,reviewHash,remoteSequence,assertXml,issuance} from '../supabase/functions/optyker-billing-admin/issuance.ts';
import {startConnection,finishConnection} from '../supabase/functions/optyker-billing-admin/fic.ts';
const env={FIC_CLIENT_ID:'test-client',FIC_CLIENT_SECRET:'test-secret',SUPABASE_SERVICE_ROLE_KEY:'test-encryption-key',SUPABASE_URL:'https://example.supabase.co'};
globalThis.Deno={env:{get:k=>env[k]}};
const info={countries_list:['Italia','Germania'],vat_types_list:[{id:1,value:22,e_invoice:true},{id:2,value:0,e_invoice:false}]};
const base={series:'retail',date:'2026-09-01',channel:'sdi',entity:{name:'Test Cliente',type:'company',vat_number:'12345678901',address_street:'Via Test 1',address_postal_code:'24100',address_city:'Bergamo',address_province:'BG',country:'Italia',ei_code:'0000000'},items:[{name:'Articolo di prova',qty:1,net_price:100,vat_id:1}],payment_method:'MP05',due_date:'2026-09-30'};
function clone(v){return structuredClone(v)}
function database(){
 const tables={optyker_fic_states:[],optyker_fic_connection:[],optyker_billing_invoices:[],optyker_billing_provider_config:[],optyker_fic_drafts:[],optyker_fic_series:[{code:'retail',year:2026,suffix:'/26',last_number:38,last_date:null},{code:'wholesale',year:2026,suffix:'/26/W',last_number:8,last_date:null},{code:'foreign',year:2026,suffix:'/26/A/ES',last_number:55,last_date:null}]};
 return {tables,async rpc(name,args){assert.equal(name,'optyker_fic_reserve');const d=tables.optyker_fic_drafts.find(x=>x.id===args.p_id),s=tables.optyker_fic_series.find(x=>x.code===d.series);if(!['preview','create_rejected'].includes(d.state))return {error:{message:'Already reserved'}};if(!d.number){d.number=Math.max(s.last_number,args.p_remote_number)+1;s.last_number=d.number}d.payload.number=d.number;d.state='creating';return {data:[clone(d)],error:null}},from(table){
  let op='select',value,filters=[];
  const q={select(){return q},order(){return q},limit(){return q},eq(k,v){filters.push(r=>r[k]===v);return q},lt(k,v){filters.push(r=>r[k]<v);return q},gt(k,v){filters.push(r=>r[k]>v);return q},delete(){op='delete';return q},insert(v){op='insert';value=v;return q},upsert(v){op='upsert';value=v;return q},update(v){op='update';value=v;return q},single(){return Promise.resolve(run(true))},maybeSingle(){return Promise.resolve(run(true))},then(a,b){return Promise.resolve(run(false)).then(a,b)}};
  function run(single){let rows=tables[table].filter(r=>filters.every(f=>f(r)));
   if(op==='delete')tables[table]=tables[table].filter(r=>!rows.includes(r));
   if(op==='insert'||op==='upsert'){let row=op==='upsert'?tables[table].find(r=>r.id===value.id):null;if(row)Object.assign(row,clone(value));else{row={id:crypto.randomUUID(),lease_until:'1970-01-01T00:00:00Z',...clone(value)};tables[table].push(row)}rows=[row]}
   if(op==='update')rows.forEach(r=>Object.assign(r,clone(value)));return {data:single?(rows[0]?clone(rows[0]):null):clone(rows),error:null};
  }return q;
 }};
}
async function setup(write=true){
 const db=database(),remote=[],calls=[],fault={create:false,xml:false};
 globalThis.fetch=async(url,opt={})=>{
  const u=new URL(url),body=opt.body?JSON.parse(opt.body):null;calls.push({path:u.pathname,body,method:opt.method||'GET'});
  if(u.pathname==='/oauth/token')return Response.json({access_token:'access',refresh_token:'refresh',expires_in:3600});
  if(u.pathname==='/user/companies')return Response.json({data:{companies:[{id:123,vat_number:'04679780165'}]}});
  if(u.pathname.endsWith('/info'))return Response.json({data:info});
  if(u.pathname.endsWith('/totals'))return Response.json({data:{amount_gross:122,amount_due:124,amount_net:100,amount_vat:22}});
  if(u.pathname.endsWith('/xml'))return new Response('<FatturaElettronica><TipoDocumento>'+(fault.xml?'TD01':'TD01')+'</TipoDocumento></FatturaElettronica>');
  if(u.pathname.endsWith('/send'))return Response.json({data:{name:'OK'}});
  if(/\/issued_documents\/\d+$/.test(u.pathname))return Response.json({data:remote.find(d=>d.id===Number(u.pathname.split('/').at(-1)))});
  if(opt.method==='POST'){if(fault.create)throw new Error('network timeout');const d={...clone(body.data),id:100+remote.length,amount_gross:122,amount_net:100,amount_vat:22,ei_status:'not_sent'};remote.push(d);return Response.json({data:d})}
  return Response.json({data:remote,last_page:1});
 };
 const url=new URL(await startConnection(db,write));await finishConnection(db,new Request('https://example.com/callback?code=test&state='+url.searchParams.get('state')));
 return {db,remote,calls,fault};
}
test('three numbering series remain independent',()=>{assert.deepEqual(remoteSequence([{number:39,numeration:'/26',date:'2026-09-01'},{number:900,numeration:'/26/W',date:'2026-09-02'}],{numeration:'/26',year:2026}),{number:39,date:'2026-09-01'})});
test('document validation covers dates, fiscal fields and foreign references',()=>{
 const s={code:'retail',year:2026,suffix:'/26'};assert.throws(()=>makeDocument({...base,date:'2026-02-30'},s,info),/Data/);assert.throws(()=>makeDocument({...base,channel:''},s,info),/tipo/);assert.throws(()=>makeDocument({...base,items:[{...base.items[0],vat_id:999}]},s,info),/IVA/);
 const foreign={...base,series:'foreign',td:'TD17',entity:{...base.entity,country:'Germania'},original_number:'DE123',original_date:'2026-08-30'};
 const doc=makeDocument(foreign,{code:'foreign',year:2026,suffix:'/26/A/ES'},info);assert.equal(doc.type,'self_supplier_invoice');assert.equal(doc.ei_raw.FatturaElettronicaBody.DatiGenerali.DatiGeneraliDocumento.TipoDocumento,'TD17');assert.throws(()=>makeDocument({...foreign,td:'TD01'},{code:'foreign',year:2026,suffix:'/26/A/ES'},info),/TD17/);
 const health=makeDocument({...base,channel:'health',entity:{...base.entity,type:'person',tax_code:'RSSMRA80A01H501U'}},s,info);assert.equal(health.e_invoice,false);assert.equal(health.extra_data.ts_communication,false);
});
test('XML type mismatch and missing foreign references block transmission',()=>{const doc=makeDocument({...base,series:'foreign',td:'TD18',entity:{...base.entity,country:'Germania'},original_number:'DE1',original_date:'2026-08-01'},{code:'foreign',year:2026,suffix:'/26/A/ES'},info);assert.throws(()=>assertXml('<TipoDocumento>TD01</TipoDocumento>',doc),/diverso/);assert.throws(()=>assertXml('<TipoDocumento>TD18</TipoDocumento>',doc),/Riferimento/)});
test('review hash detects a recipient change even at the same total',async()=>{const a={amount_gross:122,entity:{name:'A'}},b={amount_gross:122,entity:{name:'B'}};assert.notEqual(await reviewHash(a),await reviewHash(b));assert.equal(await reviewHash({...a,url:'volatile'}),await reviewHash(a))});
test('read-only authorization cannot create invoices',async()=>{const {db,calls}=await setup(false);await assert.rejects(issuance(db,'fic_create',{id:crypto.randomUUID(),confirm_create:true,confirm_date:true}),/Abilita/);assert.equal(calls.filter(c=>c.method==='POST'&&c.path.endsWith('/issued_documents')).length,0)});
test('preview consumes no number; confirmed create is idempotent',async()=>{const {db,calls}=await setup();const d=await issuance(db,'fic_preview',base);assert.equal(d.document.number,39);assert.equal(db.tables.optyker_fic_series[0].last_number,38);assert.equal(d.document.payments_list[0].amount,124);await assert.rejects(issuance(db,'fic_create',{id:d.id}),/Conferma/);const c=await issuance(db,'fic_create',{id:d.id,confirm_create:true,confirm_date:true});assert.equal(c.number,39);await issuance(db,'fic_create',{id:d.id,confirm_create:true,confirm_date:true});assert.equal(calls.filter(c=>c.method==='POST'&&c.path.endsWith('/issued_documents')).length,1);assert.equal(db.tables.optyker_fic_series[1].last_number,8)});
test('timeout prevents automatic duplicate creation',async()=>{const {db,fault,calls}=await setup();const d=await issuance(db,'fic_preview',base);fault.create=true;await assert.rejects(issuance(db,'fic_create',{id:d.id,confirm_create:true,confirm_date:true}),/timeout/);await assert.rejects(issuance(db,'fic_create',{id:d.id,confirm_create:true,confirm_date:true}),/verificare/);assert.equal(calls.filter(c=>c.method==='POST'&&c.path.endsWith('/issued_documents')).length,1)});
test('send requires fresh reviewed content and makes one confirmed transmission',async()=>{const {db,remote,calls}=await setup();const p=await issuance(db,'fic_preview',base);await issuance(db,'fic_create',{id:p.id,confirm_create:true,confirm_date:true});let d=await issuance(db,'fic_document',{id:p.id});remote[0].entity.name='Changed';await assert.rejects(issuance(db,'fic_send',{id:p.id,confirm_send:true,review_hash:d.review_hash}),/anteprima/);d=await issuance(db,'fic_document',{id:p.id});await assert.rejects(issuance(db,'fic_send',{id:p.id,review_hash:d.review_hash}),/Conferma/);await issuance(db,'fic_send',{id:p.id,confirm_send:true,review_hash:d.review_hash});await assert.rejects(issuance(db,'fic_send',{id:p.id,confirm_send:true,review_hash:d.review_hash}),/già richiesto/);assert.equal(calls.filter(c=>c.path.endsWith('/send')&&c.body.options.dry_run===false).length,1);assert.equal(calls.filter(c=>c.path.endsWith('/send')&&c.body.options.dry_run===true).length,1)});

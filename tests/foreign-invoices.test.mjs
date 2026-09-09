import test from 'node:test';
import assert from 'node:assert/strict';
import {decodeUpload,digest,normalizeExtraction,extractDocument,validateSourceContext,validateImportedSource,foreignAction} from '../supabase/functions/optyker-billing-admin/foreign.ts';
const sourceId='11111111-1111-4111-8111-111111111111';
const sample={series:'foreign',source_id:sourceId,source_confirm:true,td:'TD17',date:'2026-09-09',original_number:'INV-1',original_date:'2026-09-01',entity:{country:'Germania',vat_number:'DE123'},items:[{qty:2,net_price:50}],source_context:{document_kind:'invoice',multiple_documents:false,buyer_vat:'IT04679780165',country_code:'DE',supplier_country_name:'Germania',operation:'services',received_date:'2026-09-09',operation_date:'2026-09-01',currency:'EUR',net_total:100,tax_amount:0,gross_total:100,exchange_rate:1}};
const clone=x=>structuredClone(x);
test('file validation checks real signatures, MIME and size',()=>{
 const pdf={filename:'invoice.pdf',mime:'application/pdf',base64:btoa('%PDF-1.4\nSynthetic test')};
 assert.equal(decodeUpload(pdf).extension,'pdf');
 assert.throws(()=>decodeUpload({...pdf,mime:'image/png'}),/valido/);
 assert.throws(()=>decodeUpload({...pdf,base64:btoa('<script>alert(1)</script>')}),/valido/);
 assert.throws(()=>decodeUpload({...pdf,base64:'A'.repeat(12*1024*1024)}),/8 MB/);
});
test('source context guards company, classification, dates, tax, currency and totals',()=>{
 assert.equal(validateSourceContext(sample).net_total,100);
 for(const change of [{buyer_vat:'12345678901'},{document_kind:'credit_note'},{multiple_documents:true},{operation:'import_customs'},{tax_amount:10,gross_total:110},{net_total:101,gross_total:101},{currency:'EUR',exchange_rate:2},{received_date:''},{supplier_country_name:'Italia'}]){
  const b=clone(sample);Object.assign(b.source_context,change);assert.throws(()=>validateSourceContext(b));
 }
 assert.throws(()=>validateSourceContext({...sample,source_confirm:false}),/conferma/);
 assert.throws(()=>validateSourceContext({...sample,td:'TD18'}),/tipo documento/);
});
test('non-EU goods cannot be treated as intra-EU goods; extra-EU operation date is used',()=>{
 const b=clone(sample);Object.assign(b.source_context,{country_code:'US',supplier_country_name:"Stati Uniti d'America",operation:'goods_eu_to_it'});b.entity.country=b.source_context.supplier_country_name;b.td='TD18';
 assert.throws(()=>validateSourceContext(b),/intracomunitario/);
 b.source_context.operation='services';b.td='TD17';assert.throws(()=>validateSourceContext(b),/data dell/);
 b.date='2026-09-01';assert.equal(validateSourceContext(b).country_code,'US');
});
test('foreign currency requires explicit exchange evidence and reconciled EUR rows',()=>{
 const b=clone(sample);Object.assign(b.source_context,{currency:'USD',exchange_rate:.9});b.items=[{qty:2,net_price:45}];
 assert.throws(()=>validateSourceContext(b),/fonte/);
 Object.assign(b.source_context,{confirm_exchange:true,exchange_reference:'ECB 2026-09-01'});assert.equal(validateSourceContext(b).exchange_rate,.9);
 b.items[0].net_price=45.1;assert.throws(()=>validateSourceContext(b),/imponibile/);
});
test('unknown extracted data stays unknown, including quantity and tax',()=>{
 const x=normalizeExtraction({document_kind:'invoice',supplier:{name:'<script>evil</script>'},items:[{description:'Abbonamento',quantity:null,unit_net:100}],tax_amount:null,operation:'invented',warnings:[]});
 assert.equal(x.items[0].quantity,null);assert.equal(x.tax_amount,null);assert.equal(x.operation,'unknown');
 assert.equal(x.supplier.name,'<script>evil</script>'); // UI must escape text; extraction never executes document content.
 assert.throws(()=>normalizeExtraction({document_kind:'invoice',items:new Array(41).fill({})}),/Documento/);
});
test('missing API key blocks extraction before any network request',async()=>{
 globalThis.Deno={env:{get:()=>undefined}};let calls=0;globalThis.fetch=async()=>{calls++;throw Error('unexpected')};
 await assert.rejects(extractDocument(new Uint8Array([1]),'application/pdf','test.pdf'),/da attivare/);assert.equal(calls,0);
});
test('AI extraction uses only the uploaded file, no storage or tools, and handles incomplete output',async()=>{
 globalThis.Deno={env:{get:k=>k==='OPENAI_API_KEY'?'test-key':undefined}};let sent;
 globalThis.fetch=async(url,options)=>{assert.equal(url,'https://api.openai.com/v1/responses');sent=JSON.parse(options.body);return Response.json({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify({document_kind:'invoice',supplier:{name:'Test Supplier'},items:[{description:'Test',quantity:1,unit_net:100}],warnings:[]})}]}]})};
 const result=await extractDocument(new TextEncoder().encode('%PDF-synthetic'),'application/pdf','test.pdf');
 assert.equal(result.supplier.name,'Test Supplier');assert.equal(sent.store,false);assert.equal(sent.tools,undefined);assert.equal(sent.text.format.strict,true);assert.ok(sent.input[0].content[0].file_data.startsWith('data:application/pdf;base64,'));
 globalThis.fetch=async()=>Response.json({status:'incomplete',output:[]});await assert.rejects(extractDocument(new Uint8Array([1]),'image/png','test.png'),/incompleta/);
 globalThis.fetch=async()=>Response.json({error:{code:'insufficient_quota'}},{status:429});await assert.rejects(extractDocument(new Uint8Array([1]),'image/png','test.png'),/Credito API/);
});
function dbMock(){
 const tables={optyker_foreign_sources:[],optyker_fic_drafts:[]},writes=[],storageWrites=[];
 return {tables,writes,storageWrites,storage:{from(){return {async upload(path,bytes,opts){storageWrites.push({path,bytes,opts});return {data:{path}}}}}},from(table){
  let operation='select',payload,filters=[];
  const q={select(){return q},eq(k,v){filters.push(r=>r[k]===v);return q},insert(v){operation='insert';payload=v;return q},single(){return Promise.resolve(go(true))},maybeSingle(){return Promise.resolve(go(true))},then(a,b){return Promise.resolve(go(false)).then(a,b)}};
  function go(single){if(operation==='insert'){writes.push(table);tables[table].push({id:sourceId,...payload})}const rows=tables[table].filter(r=>filters.every(f=>f(r)));return {data:single?rows[0]||null:rows,error:null}}return q;
 }};
}
test('reuploading identical bytes reopens source without duplicating or replacing original',async()=>{
 const db=dbMock(),b={filename:'one.pdf',mime:'application/pdf',base64:btoa('%PDF-1.4\nSynthetic')};
 const one=await foreignAction(db,'foreign_upload',b),two=await foreignAction(db,'foreign_upload',{...b,filename:'renamed.pdf'});
 assert.equal(one.source.id,two.source.id);assert.equal(two.duplicate,true);assert.equal(db.storageWrites.length,1);assert.equal(db.storageWrites[0].opts.upsert,false);assert.equal(db.tables.optyker_foreign_sources.length,1);
});
test('source validation reads only; linked source cannot create another preview',async()=>{
 const db=dbMock();db.tables.optyker_foreign_sources.push({id:sourceId});
 const result=await validateImportedSource(db,sample);assert.equal(result.invoiceKey,await digest('DE|DE123|INV-1|2026-09-01'));assert.equal(db.writes.length,0);
 db.tables.optyker_fic_drafts.push({id:'old-draft',source_id:sourceId});await assert.rejects(validateImportedSource(db,sample),/Esiste già/);
 assert.ok(await validateImportedSource(db,{...sample,draft_id:'old-draft'}));assert.equal(db.writes.length,0);
});

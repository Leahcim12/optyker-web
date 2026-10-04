const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {stripTypeScriptTypes}=require('node:module');
const {webcrypto,createHmac}=require('node:crypto');
const path=require('node:path');
const sourcePath=process.env.INVOICE_API_SOURCE || path.join(__dirname,'..','supabase','functions','optyker-invoice-edit-20260928','index.ts');
const code=stripTypeScriptTypes(fs.readFileSync(sourcePath,'utf8').replace(/^import .*;\n/gm,''));
const invoiceId='12345678-1234-4234-8234-123456789012',paymentId='22345678-1234-4234-8234-123456789012';
function fixture(extra={}) {return {id:invoiceId,direction:'outgoing',supplier_type:'cliente',sdi_status:'not_applicable',provider_invoice_id:null,sdi_protocol:null,updated_at:'2026-09-28T14:00:00.000Z',invoice_number:'1/2026',header:'Occhiali',total:100,currency:'EUR',provider_payload:{source:'optyker_pos_local',electronic_invoice:false,lines:[{title:'Lente',quantity:1,price:100,total:100,sku:'SKU1',fiscal_vat_code:'04',source_sheet_id:'sheet-a'}]},...extra};}
function harness(row=fixture(),options={}) {
 const store={row:structuredClone(row),writes:0};let serve;
 const db={rpc:async()=>({data:{ok:!options.badPassword,username:'Michael'}}),from(table){
  let update=null,filters=[];const q={select(){return q},eq(k,v){filters.push([k,v]);return q},is(k,v){filters.push([k,v]);return q},update(v){update=v;return q},async maybeSingle(){
   if(table==='optyker_pos_payments')return {data:options.missingPayment?null:{id:paymentId,amount:options.paymentAmount??100}};
   if(table!=='optyker_billing_invoices')throw Error('Unexpected write/table');
   if(update){if(options.conflict)return {data:null};if(options.dbError)return {error:{message:'Simulated'}};if(!filters.every(([k,v])=>store.row[k]===v))return {data:null};store.writes++;store.row={...store.row,...update};}
   return {data:structuredClone(store.row)};
  }};return q;
 }};
 const ctx=vm.createContext({Deno:{env:{get:k=>k==='SUPABASE_SERVICE_ROLE_KEY'?'test-secret':'https://test.invalid'},serve:fn=>serve=fn},createClient:()=>db,crypto:webcrypto,TextEncoder,TextDecoder,atob,btoa,Response,Request,console,Date});
 vm.runInContext(code+'\nglobalThis.subject={normalizeLines,safeLines,editable,invoiceUpdate,adminAuth,auth,invoicePrint};',ctx);
 return {api:ctx.subject,store,handler:()=>serve};
}
const line=(v={})=>({source_index:0,description:'Lente corretta',quantity:1,unit_price:100,vat_code:'04',...v});
const save=(v={})=>({id:invoiceId,expected_updated_at:'2026-09-28T14:00:00.000Z',header:'Nuovo oggetto',notes:'Nota',lines:[line()],...v});
function token(payload,secret='test-secret'){const body=Buffer.from(JSON.stringify(payload)).toString('base64url');return body+'.'+createHmac('sha256',secret).update(body).digest('base64url');}
const req=t=>new Request('https://test.invalid',{headers:t?{Authorization:'Bearer '+t}:{}});
test('add, remove and edit lines without losing source metadata',()=>{
 const {api}=harness();const p=fixture().provider_payload;
 const rows=api.normalizeLines([line(),line({source_index:null,description:'Servizio',quantity:2,unit_price:12.50})],p);
 assert.equal(rows.length,2);assert.equal(rows[0].sku,'SKU1');assert.equal(rows[0].source_sheet_id,'sheet-a');assert.equal(rows[0].title,'Lente corretta');assert.equal(rows[1].total,25);
 assert.equal(api.normalizeLines([line({source_index:null,description:'Sostituzione',unit_price:100})],p).length,1);
});
test('notes and description edits preserve discounted totals',()=>{const {api}=harness();const p={lines:[{title:'Sconto',quantity:2,price:100,total:170,discount_percent:15,sku:'D'}]};assert.equal(api.normalizeLines([line({quantity:2})],p)[0].total,170);const changed=api.normalizeLines([line({quantity:3})],p)[0];assert.equal(changed.total,300);assert.equal(changed.discount_percent,0)});
test('validation blocks empty, negative, blank, invalid and duplicated rows',()=>{const {api}=harness();for(const rows of [[],Array(41).fill(line()),[line({description:''})],[line({quantity:0})],[line({quantity:0.00001})],[line({unit_price:-1})],[line({unit_price:''})],[line({vat_code:'INVALID'})],[line(),line()]])assert.throws(()=>api.normalizeLines(rows,fixture().provider_payload));});
test('line rounding is consistent and zero-price descriptions allowed',()=>{const {api}=harness();const rows=api.normalizeLines([line({source_index:null,unit_price:0}),line({source_index:null,quantity:3,unit_price:0.105})]);assert.equal(rows[0].total,0);assert.equal(rows[1].total,0.33)});
test('only internal non-transmitted invoices can be edited',()=>{const {api}=harness();assert.equal(api.editable(fixture()),true);for(const extra of [{provider_invoice_id:'fic:123:5'},{sdi_protocol:'123'},{sdi_status:'delivered'},{sdi_status:'sent'},{provider_payload:{source:'external'}},{provider_payload:{source:'optyker_pos_local',electronic_invoice:true}},{provider_payload:{source:'optyker_pos_local',ts_protocol:'123'}},{provider_payload:{source:'optyker_pos_local',finalized_at:'2026-09-28'}}])assert.equal(api.editable(fixture(extra)),false)});
test('administrator session is accepted without operator password',async()=>{const {api}=harness();const t=token({sub:'Ottica Visual Care',scope:'billing_admin',exp:Math.floor(Date.now()/1000)+3600});assert.equal(await api.auth({},req(t)),'Ottica Visual Care')});
test('forged, expired and wrong-scope administrator tokens fail closed',async()=>{const {api}=harness();for(const t of ['invalid',token({sub:'Ottica Visual Care',scope:'billing_admin',exp:1}),token({sub:'Ottica Visual Care',scope:'customer',exp:Date.now()/1000+3600}),token({sub:'Other',scope:'billing_admin',exp:Date.now()/1000+3600}),token({sub:'Ottica Visual Care',scope:'billing_admin',exp:Date.now()/1000+3600},'forged')])await assert.rejects(api.auth({username:'Michael',password:'password'},req(t)),/AUTH_REQUIRED/)});
test('operator password authentication retained',async()=>{assert.equal(await harness().api.auth({username:'Michael',password:'password'},req()),'Michael');await assert.rejects(harness().api.auth({},req()),/AUTH_REQUIRED/);await assert.rejects(harness(fixture(),{badPassword:true}).api.auth({username:'Michael',password:'password'},req()),/Credenziali/)});
test('successful save returns authoritative rows, history and same invoice number',async()=>{const {api,store}=harness();const r=await api.invoiceUpdate(save(), 'Michael');assert.equal(store.writes,1);assert.equal(r.header,'Nuovo oggetto');assert.equal(r.lines[0].description,'Lente corretta');assert.equal(r.total,100);assert.equal(r.number,'1/2026');assert.equal(store.row.provider_payload.invoice_edit_history[0].lines[0].title,'Lente');assert.equal(store.row.sdi_status,'not_applicable')});
test('stale editor and concurrent changes cannot overwrite another operator',async()=>{for(const options of [{},{conflict:true}]){const {api,store}=harness(fixture(),options);await assert.rejects(api.invoiceUpdate(save(options.conflict?{}:{expected_updated_at:'old'}),'Michael'),/cambiata|altro operatore/);assert.equal(store.writes,0)}});
test('payment-locked total mismatch never writes; same total accepts new rows',async()=>{const row=fixture();row.provider_payload.pos_payment_id=paymentId;const {api,store}=harness(row);await assert.rejects(api.invoiceUpdate(save({lines:[line({unit_price:100.01})]}),'Michael'),/pagamento/);assert.equal(store.writes,0);await api.invoiceUpdate(save({lines:[line({unit_price:80}),line({source_index:null,description:'Seconda riga',unit_price:20})]}),'Michael');assert.equal(store.writes,1);assert.equal(store.row.total,100)});
test('missing referenced payment prevents modification',async()=>{const row=fixture();row.provider_payload.pos_payment_id=paymentId;const {api,store}=harness(row,{missingPayment:true});await assert.rejects(api.invoiceUpdate(save(),'Michael'),/Pagamento/);assert.equal(store.writes,0)});
test('unauthorized API calls return 401 and expose no invoice data',async()=>{const h=harness();const r=await h.handler()(new Request('https://test.invalid',{method:'POST',body:JSON.stringify({action:'invoice_print',payload:{id:invoiceId}})}));assert.equal(r.status,401);assert.equal((await r.json()).ok,false);assert.equal(h.store.writes,0)});
test('till invoices marked as internal customer documents are editable',()=>{const {api}=harness();for(const p of [{source:'optyker_pos_v2',document_scope:'customer_no_sdi'},{source:'optyker_pos'}])assert.equal(api.editable(fixture({provider_status:p.document_scope?'':'customer_invoice_internal',provider_payload:{...p,lines:[]}})),true);assert.equal(api.editable(fixture({provider_payload:{source:'optyker_pos_v2'}})),false)});
test('payment-linked total can change only with explicit confirmation, recorded in history',async()=>{const row=fixture();row.provider_payload.pos_payment_id=paymentId;const {api,store}=harness(row);await assert.rejects(api.invoiceUpdate(save({lines:[line({unit_price:120})]}),'Michael'));assert.equal(store.writes,0);const r=await api.invoiceUpdate(save({lines:[line({unit_price:120})],confirm_total_change:true}),'Michael');assert.equal(store.writes,1);assert.equal(r.total,120);const p=store.row.provider_payload;assert.equal(p.invoice_total_differs_from_payment.payment_total,100);assert.equal(p.invoice_edit_history.at(-1).total_change_confirmed,true)});
test('administration reports require the administrator session, not an operator password',async()=>{const h=harness();for(const body of [{action:'report_day',payload:{day:'2026-10-03'}},{action:'report_month',username:'Michael',password:'password',payload:{year:2026,month:10}}]){const r=await h.handler()(new Request('https://test.invalid',{method:'POST',body:JSON.stringify(body)}));assert.equal(r.status,401);assert.equal((await r.json()).ok,false)}});

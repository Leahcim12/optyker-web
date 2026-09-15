import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {buildRequest,parseResponse,SERVICES} from '../supabase/functions/optyker-ts-api/transport.mjs';
import {createCancellationRunner,validateCancellationScope} from '../supabase/functions/optyker-ts-cancel/worker.mjs';
const c={username:'FIXTURE',password:'fixture-password',pin:'1234567890',owner_code:'604-030-419926',owner_fiscal_code:'RSSMRA80A01H501U',business_vat:'04679780165'};
const document={serial:'72IV6003831',number:'1164-0005',date:'2026-09-15',paymentDate:'2026-09-15',paymentMethod:'card',opposition:false,fiscalCode:'RSSMRA80A01H501U',referenceSource:'rch_ej',lines:[{expenseCode:'AD',vatCode:'04',totalCents:58000}]};
const original='99260915000000001',cancel='99260915000000002',hash='a'.repeat(64);
const query={esito:'0',document:{vat:c.business_vat,date:document.date,device:'1',number:document.number,paymentDate:document.paymentDate,protocol:original,totals:[{code:'AD',amount:'580.00'}],errors:0}};
const outcome={esito:'0',codes:[],outcomes:[{protocol:cancel,state:'2',sent:'1',accepted:'1',errors:'0',warnings:'0'}]};
function fixture() {
 const q={id:'outbox',state:'accepted',protocol:original,document:structuredClone(document)};
 const k={id:'cancel',outbox_id:q.id,original_protocol:original,expected_number:document.number,expected_date:document.date,expected_total_cents:58000,state:'prepared',protocol:null};
 let used=false;const finishes=[];
 const db={
  async rpc(name,p){
   if(name==='optyker_ts_claim_cancellation'){if(used||k.state!=='prepared')return {error:{message:'TS_UNAUTHORIZED'}};used=true;k.state='checking';return {data:{cancellation:structuredClone(k),outbox:structuredClone(q),issuer:{...c}}};}
   if(name==='optyker_ts_server_credentials')return {data:c};
   if(name==='optyker_ts_connection_status')return {data:{credentials_verified:true}};
   if(name==='optyker_ts_finish_cancellation'){finishes.push(p);k.state=p.p_state;k.protocol=p.p_protocol;return {data:true};}
   throw new Error(name);
  },
  from(table){
   assert.equal(table,'optyker_ts_cancellations');
   let patch={},filters=[];
   const result=()=>{const match=filters.every(([key,value])=>k[key]===value);if(match)Object.assign(k,patch);return {data:match?{id:k.id}:null};};
   const builder={update(p){patch=p;return this;},eq(key,v){filters.push([key,v]);return this;},select(){return this;},async maybeSingle(){return result();},then(resolve,reject){return Promise.resolve(result()).then(resolve,reject);}};
   return builder;
  }
 };
 return {db,k,q,finishes};
}
test('cancellation request conforms to official XSD and discloses no patient CF or expense lines',()=>{
 const wire=buildRequest('cancel',c,{document},v=>Buffer.from(v).toString('base64'));
 assert.match(wire,/<t:idCancellazioneDocumentoFiscale>/);assert.ok(!wire.includes('cfCittadino'));assert.ok(!wire.includes('voceSpesa'));
 assert.equal(SERVICES.cancel.action,'cancellazione.documentospesap730.sanita.finanze.it');
 const dir=mkdtempSync(join(tmpdir(),'ts-cancel-'));
 try{
  const file=join(dir,'request.xml');writeFileSync(file,wire);
  execFileSync('python3',['-c','from lxml import etree;import sys;r=etree.parse(sys.argv[1]);s=etree.XMLSchema(etree.parse(sys.argv[2]));s.assertValid(r.getroot().find("{http://schemas.xmlsoap.org/soap/envelope/}Body")[0])',file,new URL('../supabase/functions/optyker-ts-api/protocol/DocumentoSpesa730pSchema.xsd',import.meta.url).pathname]);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('cancellation parser requires the cancellation response, not an insertion success',()=>{
 const ns=SERVICES.cancel.ns;
 const xml='<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body><cancellazioneDocumentoSpesaResponse xmlns="'+ns+'"><esitoChiamata>0</esitoChiamata><protocollo>'+cancel+'</protocollo></cancellazioneDocumentoSpesaResponse></s:Body></s:Envelope>';
 assert.equal(parseResponse('cancel',xml).protocol,cancel);
 assert.throws(()=>parseResponse('cancel',xml.replaceAll('cancellazioneDocumentoSpesaResponse','inserimentoDocumentoSpesaResponse')));
});
test('only a matching original identity, protocol, issuer and amount can be cancelled',()=>{
 const {q,k}=fixture(),scope={outbox:q,cancellation:k,issuer:c};validateCancellationScope(scope,c,query);
 for(const response of [{...query,document:{...query.document,protocol:cancel}},{...query,document:{...query.document,number:'1164-0006'}},{...query,document:{...query.document,totals:[{code:'AD',amount:'58.00'}]}}])assert.throws(()=>validateCancellationScope(scope,c,response));
 assert.throws(()=>validateCancellationScope({...scope,issuer:{...c,business_vat:'00000000000'}},c,query));
});
test('successful cancellation is confirmed by its own final protocol and stores its receipt',async()=>{
 const {db,k,q,finishes}=fixture(),calls=[];
 const run=createCancellationRunner(db,async kind=>{calls.push(kind);return kind==='query'?query:kind==='cancel'?{esito:'0',protocol:cancel,codes:[]}:kind==='outcome'?outcome:{esito:'0',pdf:Buffer.from('%PDF-1.4 fixture').toString('base64')};},async()=>{});
 const r=await run(hash,'cancel');
 assert.equal(r.state,'accepted');assert.equal(r.protocol,cancel);assert.equal(k.receipt_kind,'pdf');assert.equal(q.protocol,original);
 assert.deepEqual(calls,['query','cancel','outcome','receipt']);assert.deepEqual(finishes.map(p=>p.p_state),['submitted','accepted']);
});
test('mismatch before transmission records not_sent and never issues the cancellation',async()=>{
 const {db,k}=fixture(),calls=[];
 const run=createCancellationRunner(db,async kind=>{calls.push(kind);return {...query,document:{...query.document,protocol:cancel}};},async()=>{});
 assert.equal((await run(hash,'cancel')).state,'not_sent');assert.equal(k.request_sha256,undefined);assert.deepEqual(calls,['query']);
});
test('a lost cancellation response is uncertain and cannot be sent again with the same capability',async()=>{
 const {db,k}=fixture(),calls=[];
 const run=createCancellationRunner(db,async kind=>{calls.push(kind);if(kind==='query')return query;throw new Error('TS_CONNECTION_FAILED');},async()=>{});
 assert.equal((await run(hash,'cancel')).state,'uncertain');
 await assert.rejects(()=>run(hash,'cancel'),/TS_UNAUTHORIZED/);
 assert.deepEqual(calls,['query','cancel']);assert.equal(k.state,'uncertain');
});
test('a protocol without a matching final outcome does not confirm deletion',async()=>{
 const {db,k}=fixture();
 const run=createCancellationRunner(db,async kind=>kind==='query'?query:kind==='cancel'?{esito:'0',protocol:cancel,codes:[]}:{...outcome,outcomes:[{...outcome.outcomes[0],protocol:original}]},async()=>{});
 assert.equal((await run(hash,'cancel')).state,'uncertain');assert.equal(k.receipt_data,undefined);
});


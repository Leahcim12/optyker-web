import test from 'node:test';
import assert from 'node:assert/strict';
import {writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {X509Certificate,createPublicKey} from 'node:crypto';
import {CERTIFICATE_PEM,PUBLIC_KEY_PEM} from '../supabase/functions/optyker-ts-api/certificate.mjs';
import {buildRequest,parseResponse,validateDocument,certificateStatus,encryptField,SERVICES,callTS,classifyInsert,classifyOutcome,queryMatches} from '../supabase/functions/optyker-ts-api/transport.mjs';
import {createActions} from '../supabase/functions/optyker-ts-api/actions.mjs';
const config={username:'FIXTURE',password:'fixture-password',pin:'1234567890',owner_code:'604-030-419926',owner_fiscal_code:'RSSMRA80A01H501U',business_vat:'04679780165',revision:7};
const doc={serial:'72IV6003831',number:'1161-0009',date:'2026-09-12',paymentDate:'2026-09-11',paymentMethod:'card',opposition:false,fiscalCode:'RSSMRA80A01H501U',referenceSource:'paper_confirmed',lines:[{expenseCode:'AD',vatCode:'04',totalCents:7000},{expenseCode:'AA',vatCode:'ART10',totalCents:1250}]};
const protocol='99260913000000001';
const enc=v=>Buffer.from(v).toString('base64');
const envelope=(kind,body)=>'<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body><r:'+SERVICES[kind].response+' xmlns:r="'+SERVICES[kind].ns+'"'+(['insert','query','verify'].includes(kind)?' xmlns="'+SERVICES[kind].ns+'"':'')+'>'+body+'</r:'+SERVICES[kind].response+'></s:Body></s:Envelope>';
test('reviewed encryption certificate and randomized RSA ciphertext',()=>{
  assert.equal(new X509Certificate(CERTIFICATE_PEM).publicKey.export({format:'pem',type:'spki'}),createPublicKey(PUBLIC_KEY_PEM).export({format:'pem',type:'spki'}));
  assert.equal(certificateStatus(new Date('2026-09-13')).valid,true);assert.equal(certificateStatus(new Date('2027-01-24')).valid,false);
  const a=encryptField(config.pin),b=encryptField(config.pin);assert.notEqual(a,b);assert.equal(Buffer.from(a,'base64').length,128);assert.ok(!a.includes(config.pin));
});
test('requests conform to the official kit XSDs, including opposition and VAT',()=>{
  const dir=mkdtempSync(join(tmpdir(),'optyker-ts-xsd-'));
  try{
    const schemaDir=new URL('../supabase/functions/optyker-ts-api/protocol/',import.meta.url).pathname;
    const cases=[['insert',{document:doc},'DocumentoSpesa730pSchema.xsd'],['insert',{document:{...doc,referenceSource:'rch_ej'}},'DocumentoSpesa730pSchema.xsd'],['insert',{document:{...doc,opposition:true,fiscalCode:''}},'DocumentoSpesa730pSchema.xsd'],['query',{document:doc},'InterrogazionePuntuale730Service_schema.xsd'],['verify',{month:'202609'},'ReportMensile730Service_schema.xsd'],['outcome',{protocol},'EsitoInvioDatiSpesa730Service_schema.xsd'],['receipt',{protocol},'RicevutaPdf730Service_schema.xsd']];
    for(const [i,[kind,args,schema]] of cases.entries()){
      const body=buildRequest(kind,config,args,enc),file=join(dir,i+'.xml');writeFileSync(file,body);
      execFileSync('python3',['-c','from lxml import etree;import sys;r=etree.parse(sys.argv[1]);s=etree.XMLSchema(etree.parse(sys.argv[2]));s.assertValid(r.getroot().find("{http://schemas.xmlsoap.org/soap/envelope/}Body")[0])',file,join(schemaDir,schema)]);
      if(kind==='insert'){assert.match(body,/<t:flagPagamentoAnticipato>1/);assert.match(body,/<t:aliquotaIVA>4.00/);assert.match(body,/<t:naturaIVA>N4/);assert.match(body,/<t:tipoDocumento>D/);assert.match(body,/<t:dispositivo>1/);assert.ok(!body.includes(config.pin));if(args.document.opposition)assert.ok(!body.includes('cfCittadino'));}
    }
  }finally{rmSync(dir,{recursive:true,force:true});}
});
test('unconfirmed, non-health, invalid or personally identified opposed documents cannot be transmitted',()=>{
  for(const bad of [{...doc,referenceSource:'guessed'},{...doc,opposition:true},{...doc,paymentMethod:'unmapped'},{...doc,date:'2026-02-31'},{...doc,fiscalCode:'RSSMRA80A01H501X'},{...doc,lines:[{expenseCode:'none',vatCode:'04',totalCents:1}]},{...doc,lines:[{expenseCode:'AD',vatCode:'04',totalCents:1.5}]}])assert.throws(()=>validateDocument(bad));
});
test('SOAP success is submitted until a matching definitive receipt accepts one document',()=>{
  const r=parseResponse('insert',envelope('insert','<esitoChiamata>0</esitoChiamata><protocollo>'+protocol+'</protocollo><listaMessaggi/>'));
  assert.equal(classifyInsert(r),'submitted');assert.equal(classifyInsert({...r,protocol:''}),'uncertain');
  const final={esito:'0',outcomes:[{protocol,state:'2',sent:'1',accepted:'1',errors:'0'}]};
  assert.equal(classifyOutcome(final,protocol),'accepted');assert.equal(classifyOutcome(final,'99260913000000002'),'uncertain');
  assert.equal(classifyOutcome({...final,outcomes:[{...final.outcomes[0],state:'1'}]},protocol),'submitted');
  assert.equal(classifyOutcome({...final,outcomes:[{...final.outcomes[0],accepted:'2'}]},protocol),'uncertain');
});
test('XML parser refuses entities, wrong namespaces, duplicate outcomes and malformed SOAP',()=>{
  const valid=envelope('insert','<esitoChiamata>0</esitoChiamata><protocollo>'+protocol+'</protocollo>');
  for(const bad of ['<!DOCTYPE x [<!ENTITY y SYSTEM "file:///etc/passwd">]>'+valid,valid.replace('<esitoChiamata>0</esitoChiamata>','<esitoChiamata>0</esitoChiamata><esitoChiamata>1</esitoChiamata>'),valid.replace('xmlns="'+SERVICES.insert.ns+'"','xmlns="urn:wrong"'),valid.slice(0,-10),'<html>Proxy failure</html>'])assert.throws(()=>parseResponse('insert',bad));
});
test('HTTP credentials go only to fixed HTTPS hosts; redirects and response size are constrained',async()=>{
  let seen;
  const r=await callTS('insert',config,{document:doc},{fetcher:async(url,o)=>{seen={url,o};return new Response(envelope('insert','<esitoChiamata>0</esitoChiamata><protocollo>'+protocol+'</protocollo>'));}});
  assert.equal(r.protocol,protocol);assert.equal(seen.url,'https://invioss730p.sanita.finanze.it/DocumentoSpesa730pWeb/DocumentoSpesa730pPort');assert.equal(seen.o.redirect,'error');assert.match(seen.o.headers.Authorization,/^Basic /);assert.equal(seen.o.headers.SOAPAction,'"inserimento.documentospesap730.sanita.finanze.it"');
  await assert.rejects(()=>callTS('verify',config,{month:'202609'},{fetcher:async()=>new Response('Secret echoed by server',{status:401})}),/^Error: TS_AUTH_FAILED$/);
  await assert.rejects(()=>callTS('verify',config,{month:'202609'},{fetcher:async()=>new Response('x'.repeat(1500001))}),/^Error: TS_INVALID_RESPONSE$/);
});
test('readback must match issuer, device, document, payment date and all amounts',()=>{
  const r={esito:'0',document:{errors:0,vat:config.business_vat,date:doc.date,device:'001',number:doc.number,paymentDate:doc.paymentDate,protocol,totals:[{code:'AD',amount:'70.00'},{code:'AA',amount:'12.50'}]}};
  assert.equal(queryMatches(r,doc,config),true);
  for(const patch of [{vat:'00000000000'},{paymentDate:'2026-09-10'},{device:'2'},{totals:[{code:'AD',amount:'70.01'}]}])assert.equal(queryMatches({...r,document:{...r.document,...patch}},doc,config),false);
});
function mockDB({claimError=false}={}){
  const row={id:'11111111-1111-4111-8111-111111111111',state:'awaiting_configuration',document:doc,attempt_id:null,protocol:null},events=[];
  const db={from(){return {select(){return this;},eq(){return this;},single:async()=>({data:structuredClone(row)})};},rpc:async(name,args)=>{
    events.push(name);
    if(name==='optyker_ts_server_credentials')return {data:config};
    if(name==='optyker_ts_claim_send'){if(claimError||row.attempt_id)return {error:{message:'TS_ALREADY_ATTEMPTED'}};row.state='sending';row.attempt_id='22222222-2222-4222-8222-222222222222';return {data:structuredClone(row)};}
    if(name==='optyker_ts_finish_send'){row.state=args.p_state;row.protocol=args.p_protocol;row.outcome=args.p_outcome;return {data:true};}
  }};
  return {db,row,events};
}
test('lost response records uncertainty and a second click cannot repeat the POST',async()=>{
  const {db,row,events}=mockDB();let sends=0;
  const a=createActions(db,async()=>{assert.ok(events.includes('optyker_ts_claim_send'));sends++;throw new Error('network failed with secret fixture-password');});
  await a.send(row.id);assert.equal(row.state,'uncertain');assert.equal(row.outcome.code,'TS_OPERATION_FAILED');
  await assert.rejects(()=>a.send(row.id),/TS_ALREADY_ATTEMPTED/);assert.equal(sends,1);
});
test('a rejected atomic claim prevents all upstream calls',async()=>{
  const {db,row}=mockDB({claimError:true});let calls=0;
  await assert.rejects(()=>createActions(db,async()=>{calls++;}).send(row.id),/TS_ALREADY_ATTEMPTED/);assert.equal(calls,0);
});
test('a changed issuer cannot inspect or attach an outcome from another account',async()=>{
  const {db,row}=mockDB();row.state='submitted';row.attempt_id='22222222-2222-4222-8222-222222222222';row.protocol=protocol;
  const original=db.from;db.from=(table)=>table==='optyker_ts_attempts'?{select(){return this;},eq(){return this;},single:async()=>({data:{issuer:{...config,business_vat:'00000000000'}}})}:original();
  let calls=0;const a=createActions(db,async()=>{calls++;});
  await assert.rejects(()=>a.reconcile(row.id),/TS_ISSUER_CHANGED/);
  await assert.rejects(()=>a.receipt(row.id),/TS_ISSUER_CHANGED/);assert.equal(calls,0);
});
test('verification uses a read-only report and enables only an explicit positive result',async()=>{
  let saved,seen;
  const db={rpc:async(name,args)=>name==='optyker_ts_server_credentials'?{data:config}:(saved=args,{data:true})};
  const a=createActions(db,async(kind,c,args)=>{seen={kind,args};return {esito:'0',codes:[{code:'0',type:''}]};});
  assert.equal((await a.verify()).verified,true);assert.equal(seen.kind,'verify');assert.match(seen.args.month,/^20\d{4}$/);assert.equal(saved.p_ok,true);
  const bad=createActions(db,async()=>({esito:'1',codes:[]}));assert.equal((await bad.verify()).verified,false);assert.equal(saved.p_ok,false);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
const require=createRequire(import.meta.url);
const {getProfile,validate,registrationMode,toCents}=require('../rch-preflight.js');
const valid=()=>({paymentMethod:'card',stage:'balance',lines:[{description:'Prodotto',quantity:2,unitPriceCents:1234,vatCode:'04'}]});

test('configuration preserves printed payments and distinguishes VAT slots from departments',()=>{
  const p=getProfile();
  assert.deepEqual(p.payments.map(x=>x.code),[1,2,3,4,5,6,7,8,9,10,11]);
  assert.equal(p.payments.find(x=>x.key==='card').code,4);
  assert.equal(p.payments.find(x=>x.key==='cheque').code,3);
  assert.equal(p.departments.find(x=>x.department===3).nature,'N4');
  assert.equal(p.vatSlots.find(x=>x.slot===3).rate,10);
  assert.equal(p.identityVerifiedLive,false);
  assert.equal(p.transport.legacyTcpPort,23);
  p.departments[0].department=99;
  assert.equal(getProfile().departments[0].department,1);
});
test('successful preliminary checks never enable emission or TS',()=>{
  for(const [method,code] of [['cash',1],['card',4],['cheque',3]]){
    const input=valid();input.paymentMethod=method;
    const out=validate(input);
    assert.equal(out.dataValid,true);assert.equal(out.payment.code,code);
    assert.equal(out.totalCents,2468);assert.equal(out.lines[0].department,1);
    assert.equal(out.canEmit,false);assert.equal(out.canSubmitTs,false);
    assert.equal(out.emittedFiscalDocument,false);assert.equal(out.tsSubmitted,false);
    assert.equal(out.readOnly,true);assert.equal(out.blockers.length,3);
  }
});
test('VAT codes map to documented departments, never product categories or slot indexes',()=>{
  for(const [vat,dep] of [['04',1],['22',2],['ART10',3]]){
    const input=valid();input.lines[0].vatCode=vat;
    assert.equal(validate(input).lines[0].department,dep);
  }
  for(const vat of ['',null,'10','05','ART15','NV','N4','4','__proto__',4]){
    const input=valid();input.lines[0].vatCode=vat;
    const out=validate(input);assert.equal(out.dataValid,false);
    assert.equal(out.lines[0].department,null);
    assert.ok(out.issues.some(x=>x.code==='vat_unmapped'));
  }
});
test('unverified payments and ambiguous non-riscosso remain unassigned',()=>{
  for(const method of ['pending','bank','transfer','unpaid_goods',4,null,'']){
    const input=valid();input.paymentMethod=method;
    const out=validate(input);assert.equal(out.dataValid,false);assert.equal(out.payment,null);
    assert.ok(out.issues.some(x=>x.code==='payment_unmapped'));
  }
});
test('amounts, quantities, empty or excessive cart are bounded',()=>{
  for(const value of [NaN,Infinity,-1,0,1.5,'100',null,100000001]){
    const input=valid();input.lines[0].unitPriceCents=value;
    assert.ok(validate(input).issues.some(x=>x.code==='invalid_amount'));
  }
  for(const value of [NaN,Infinity,-1,0,1.5,'2',null,10001]){
    const input=valid();input.lines[0].quantity=value;
    assert.ok(validate(input).issues.some(x=>x.code==='invalid_quantity'));
  }
  const input=valid();input.lines[0].unitPriceCents=100000000;
  assert.ok(validate(input).issues.some(x=>x.code==='total_limit'));
  for(const lines of [undefined,null,[],{},Array(201).fill({})])assert.equal(validate({...valid(),lines}).dataValid,false);
});
test('deposits, invoices and TS require dedicated flows; no customer data retained',()=>{
  const out=validate({...valid(),stage:'deposit',invoice:true,talkingReceipt:true,tsRequested:true,fiscalCode:'do not retain'});
  assert.ok(out.issues.some(x=>x.code==='stage_unverified'));
  assert.ok(out.issues.some(x=>x.code==='invoice_flow'));
  assert.ok(out.blockers.some(x=>x.code==='talking_receipt'));
  assert.ok(out.blockers.some(x=>x.code==='ts_not_configured'));
  assert.equal(JSON.stringify(out).includes('do not retain'),false);
});
test('Z, PRG, unknown or rejected status cannot indicate REG',()=>{
  assert.equal(registrationMode({ok:true,mode:'REG'}),true);
  assert.equal(registrationMode({ok:true,mode:'REG (OP 1)'}),true);
  for(const mode of ['Z','X','PRG','R','',null])assert.equal(registrationMode({ok:true,mode}),false);
  assert.equal(registrationMode({ok:false,mode:'REG'}),false);
  assert.equal(registrationMode({ok:'true',mode:'REG'}),false);
  assert.equal(registrationMode(null),false);
  for(const key of ['busy','printerError','errorCode','paperEnd','coverOpen'])assert.equal(registrationMode({ok:true,mode:'REG',[key]:1}),false);
});
test('currency parsing is decimal-exact and does not round missing or invalid prices',()=>{
  for(const [input,cents] of [['12.34',1234],['0.29',29],['1',100],['1.2',120],[12.34,1234]])assert.equal(toCents(input),cents);
  for(const input of [null,undefined,NaN,Infinity,{},'',true,'1.005','1,50','1e8',-1,'9007199254740991'])assert.equal(toCents(input),null);
});
test('preflight module has no IO, printer commands or mutation of input',()=>{
  const source=readFileSync(new URL('../rch-preflight.js',import.meta.url),'utf8');
  assert.doesNotMatch(source,/\b(?:fetch|XMLHttpRequest|localStorage|sessionStorage|Send-RchCommand)\b/);
  assert.doesNotMatch(source,/=R\d|=T\d/);
  const original=JSON.stringify(valid());const input=JSON.parse(original);validate(input);
  assert.equal(JSON.stringify(input),original);
});

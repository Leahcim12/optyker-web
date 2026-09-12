import test from 'node:test';
import assert from 'node:assert/strict';
import {makeDocument,cents,fiscalCode,resultState,reference} from '../supabase/functions/optyker-fiscal-api/domain.mjs';
const payment={amount:12.50,payment_method:'cash',invoice_requested:false};
const input={not_already_issued:true,lines:[{description:'Occhiali',quantity:1,unit_price:'12.50',department:1,expense_code:'none'}]};
test('canonical cents, departments and payment commands; no names used for VAT',()=>{
 const x=makeDocument(payment,input);assert.equal(x.totalCents,1250);assert.deepEqual(x.commands,['=R1/$1250/*1/(OCCHIALI)','=T1']);
 assert.throws(()=>makeDocument(payment,{...input,lines:[{...input.lines[0],department:''}]}),/Seleziona IVA/);
 assert.throws(()=>makeDocument(payment,{...input,lines:[{...input.lines[0],unit_price:10}]}),/esattamente/);
 assert.throws(()=>cents('1.001'));assert.throws(()=>cents('1e3'));assert.throws(()=>cents(-1));
});
test('protect invoice, duplicate-issued and unsupported payment boundaries',()=>{
 assert.throws(()=>makeDocument({...payment,invoice_requested:true},input),/fattura/);
 assert.throws(()=>makeDocument({...payment,billing_invoice_id:'id'},input),/fattura/);
 assert.throws(()=>makeDocument({...payment,payment_method:'bank'},input),/non mappato/);
 assert.throws(()=>makeDocument(payment,{...input,not_already_issued:false}),/già/);
});
test('CF checksum and command injection are checked independently of TS',()=>{
 const cf=fiscalCode('RSSMRA85T10A562S');
 const x=makeDocument(payment,{...input,talking_receipt:true},cf);
 assert.equal(x.tsRequested,false);assert.equal(x.commands[1],'="/?C/('+cf+')');
 assert.throws(()=>fiscalCode('RSSMRA85T10A562A'));
 const evil=makeDocument(payment,{...input,lines:[{...input.lines[0],description:'abc)\n=C10/(TOTALE'}]});
 assert.match(evil.commands[0],/^=R1\/\$1250\/\*1\/\([A-Z0-9 ]+\)$/);
});
test('health classification is explicit and independent of tax mapping',()=>{
 assert.throws(()=>makeDocument(payment,{...input,ts_requested:true}),/almeno/);
 const p={...input,ts_requested:true,opposition:true,lines:[{...input.lines[0],expense_code:'AD'}]};
 const x=makeDocument(payment,p);assert.equal(x.fiscalCode,'');assert.equal(x.opposition,true);
 assert.throws(()=>makeDocument(payment,{...p,opposition:false}),/codice fiscale/);
 assert.throws(()=>makeDocument(payment,{...p,ts_requested:false}),/rimuovi/);
});
test('receipt outcomes fail uncertain; ack is not a fiscal number or a TS acceptance',()=>{
 assert.equal(resultState({state:'closing_acknowledged',writeStarted:true,commandsAcknowledged:2,idleAfter:true},2),'awaiting_reference');
 for(const r of [{state:'ok'},{state:'closing_acknowledged',commandsAcknowledged:1,idleAfter:true},{state:'not_started',writeStarted:true,commandsAcknowledged:0}])assert.equal(resultState(r,2),'uncertain');
 assert.equal(resultState({state:'not_started',commandsAcknowledged:0,writeStarted:false},2),'not_started');
 assert.deepEqual(reference({document_number:'1160-0001',document_date:'2026-09-12',amount:'12.50',paper_verified:true},1250),{number:'1160-0001',date:'2026-09-12',amount:12.5});
 for(const p of [{document_number:'1160'},{document_date:'2026-02-31'},{amount:'12.49'},{paper_verified:false}])assert.throws(()=>reference({document_number:'1160-0001',document_date:'2026-09-12',amount:'12.50',paper_verified:true,...p},1250));
});

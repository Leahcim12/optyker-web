import test from 'node:test';
import assert from 'node:assert/strict';
import {purchaseIdentity,fiscalLines,paymentDocument} from '../supabase/functions/optyker-cash-register-api/fiscal.mjs';
import {markAutomaticDocument,automaticReference,makeDocument} from '../supabase/functions/optyker-fiscal-api/domain.mjs';
const cf='RSSMRA80A01H501U';
const lines=[{variant_id:'a',title:'Articolo A',quantity:3,price:10.01,fiscal_vat_code:'04'},
 {variant_id:'b',title:'Articolo B',quantity:1,price:23.33,fiscal_vat_code:'22'}];
test('occasional CF is validated independently of customer record; unchecked deduction stores no CF',()=>{
 assert.deepEqual(purchaseIdentity(null,cf.toLowerCase(),true),{fiscal:cf});
 assert.equal(purchaseIdentity(null,cf,false),null);
 assert.throws(()=>purchaseIdentity(null,'RSSMRA80A01H501X',true),/controllo/);
 assert.throws(()=>purchaseIdentity(null,'',true),/fiscale/);
 const client={id:'a',fiscal:cf};assert.deepEqual(purchaseIdentity(client,'',true),{fiscal:cf});
 assert.equal(client.fiscal,cf);
});
test('fiscal mapping is explicit and unknown VAT or unsupported payments stop before checkout',()=>{
 assert.deepEqual(fiscalLines(lines).map(l=>l.fiscal_department),[1,2]);
 assert.equal(fiscalLines(lines,[{variant_id:'a',department:2}])[0].fiscal_department,2);
 assert.throws(()=>fiscalLines([{...lines[0],fiscal_vat_code:''}]),/IVA/);
 assert.throws(()=>paymentDocument(fiscalLines(lines),'bank',53.36,0,null),/pagamento/);
});
test('deposit plus balance preserve total and each tax amount exactly, including rounding',()=>{
 const ls=fiscalLines(lines);
 for(const deposit of [0.01,1.01,15.73,53.35]){
  const a=paymentDocument(ls,'card',deposit,0,{fiscal:cf},{ts:true});
  const b=paymentDocument(ls,'cash',Math.round((53.36-deposit)*100)/100,deposit,{fiscal:cf},{ts:true});
  assert.equal(a.totalCents+b.totalCents,5336);
  for(const d of [1,2]){
   const sum=[...a.input.lines,...b.input.lines].filter(l=>l.department===d).reduce((s,l)=>s+Math.round(l.unit_price*100)*l.quantity,0);
   assert.equal(sum,d===1?3003:2333);
  }
 }
});
test('automatic receipts retain items and fiscal code, then close with the selected payment without a QR interruption',()=>{
 for(const method of ['cash','card']){
  const snapshot=paymentDocument(fiscalLines(lines),method,53.36,0,{fiscal:cf},{ts:true});
  const base=makeDocument({amount:53.36,payment_method:method},snapshot.input,snapshot.fiscal);
  const doc=markAutomaticDocument(base,'12345678-1234-4234-8234-123456789abc');
  assert.deepEqual(doc.commands,base.commands);
  assert.equal(doc.commands.at(-1),method==='cash'?'=T1':'=T4');
  assert.ok(doc.commands.some(c=>c==='="/?C/('+cf+')'));
  assert.ok(!doc.commands.some(c=>c.includes('/$11/')||c.includes('OPTYKER')));
  assert.equal(doc.reviewQr,undefined);assert.equal(doc.automaticReference,false);
  const result={state:'closing_acknowledged',writeStarted:true,idleAfter:true,commandsAcknowledged:doc.commands.length,
   reference:{source:'rch_ej',marker:doc.receiptMarker,serial:doc.serial,fiscalCodeMatched:true,totalCents:5336,number:'1161-0010',date:'2026-09-12'}};
  assert.equal(automaticReference(result,doc),null);
 }
});

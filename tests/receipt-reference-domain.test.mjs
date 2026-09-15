import test from 'node:test';
import assert from 'node:assert/strict';
import {markAutomaticDocument,automaticReference} from '../supabase/functions/optyker-fiscal-api/domain.mjs';
const jobId='12345678-1234-4234-8234-123456789abc';
const doc=markAutomaticDocument({operation:'sale',serial:'72IV6003831',totalCents:1250,commands:['=R1/$1250/*1/(ARTICOLO)','=T4']},jobId);
const proof={source:'rch_ej',strategy:'ej-successor-v1',jobId,serial:doc.serial,number:'1164-0005',date:doc.referenceReadback.date,totalCents:1250,fiscalCodeMatched:true,previous:{number:'1164-0004',date:doc.referenceReadback.date}};
const outcome=reference=>({state:'closing_acknowledged',writeStarted:true,commandsAcknowledged:2,idleAfter:true,reference});
test('accepts actual consecutive EJ observations without any extra fiscal command',()=>{
 assert.equal(doc.automaticReference,false);assert.equal(doc.commands.length,2);
 assert.deepEqual(automaticReference(outcome(proof),doc),{number:proof.number,date:proof.date,amount:12.5});
 assert.equal(automaticReference(outcome({...proof,number:'1165-0001'}),doc).number,'1165-0001');
});
test('rejects stale, skipped, mismatched and unconfirmed printer evidence',()=>{
 for(const change of [{number:'1164-0004'},{number:'1164-0006'},{number:'1166-0001'},{totalCents:1300},{jobId:'different'},{serial:'different'},{fiscalCodeMatched:false},{previous:null},{strategy:'other'},{date:'2020-01-01'}])assert.equal(automaticReference(outcome({...proof,...change}),doc),null,JSON.stringify(change));
 for(const change of [{state:'uncertain'},{idleAfter:false},{commandsAcknowledged:1},{writeStarted:false}])assert.equal(automaticReference({...outcome(proof),...change},doc),null);
 assert.equal(automaticReference(outcome(proof),{...doc,operation:'void'}),null);
 assert.equal(automaticReference(outcome(proof),{...doc,referenceReadback:undefined}),null);
});
test('zero receipt keeps its discount and payment sequence and accepts only a zero printed total',()=>{
 const base={...doc,totalCents:0,zeroReceipt:true,commands:['=R1/$1250/*1/(ARTICOLO)','=S','=%/*100','=T4']};
 const zero=markAutomaticDocument(base,jobId),r={...outcome({...proof,totalCents:0}),commandsAcknowledged:4};
 assert.deepEqual(zero.commands,base.commands);
 assert.equal(automaticReference(r,zero).amount,0);
 assert.equal(automaticReference({...r,reference:proof},zero),null);
});

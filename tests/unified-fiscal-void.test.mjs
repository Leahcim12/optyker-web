import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {unifiedPhase} from '../supabase/functions/optyker-fiscal-api/unified-phase.mjs';
import {automaticReference,makeVoid,SERIAL} from '../supabase/functions/optyker-fiscal-api/domain.mjs';
test('TS states never shortcut an uncertain submission or cancellation',()=>{
 assert.equal(unifiedPhase(null,null,null).phase,'rch_ready');
 assert.equal(unifiedPhase({state:'awaiting_configuration'},null,null).phase,'rch_ready');
 assert.equal(unifiedPhase({state:'ts_cancelled'},null,null).phase,'rch_ready');
 for(const state of ['submitted','sending','uncertain'])assert.equal(unifiedPhase({state},null,null).phase,'ts_working');
 for(const state of ['rejected','checking','sending','uncertain'])assert.equal(unifiedPhase({state:'accepted'},{state},null).phase,'attention');
 assert.equal(unifiedPhase({state:'accepted'},{state:'submitted',protocol:'p'},null).phase,'ts_working');
});
test('RCH uncertain or awaiting-reference jobs are never prepared again',()=>{
 for(const state of ['uncertain','awaiting_reference'])assert.equal(unifiedPhase(null,null,{state}).phase,'attention');
 assert.equal(unifiedPhase(null,null,{state:'sending'}).phase,'rch_working');
 assert.equal(unifiedPhase(null,null,{state:'completed'}).phase,'completed');
});
function evidence(){
 const doc=makeVoid({id:'12345678-1234-1234-1234-123456789012',operation:'sale',state:'completed',serial:SERIAL,document:{totalCents:58000},document_number:'1164-0005',document_date:'2026-09-15'},
 {confirmed:true,expected_number:'1164-0005',expected_date:'2026-09-15',expected_total:580,reason:'Test annullo'});
 doc.referenceReadback={strategy:'ej-void-successor-v1',jobId:'job',date:'2026-09-15'};
 const r={state:'closing_acknowledged',writeStarted:true,commandsAcknowledged:1,idleAfter:true,reference:{source:'rch_ej',serial:SERIAL,strategy:'ej-void-successor-v1',jobId:'job',number:'1164-0011',date:'2026-09-15',previous:{number:'1164-0010',date:'2026-09-15'},totalCents:58000,fiscalCodeMatched:true,documentKind:'void',originalNumber:'1164-0005',originalDate:'2026-09-15'}};
 return {doc,r};
}
test('void automatic reference needs matching original, kind, total, serial and successor',()=>{
 const {doc,r}=evidence();assert.deepEqual(doc.commands,['=k/&150926/[1164/]5']);assert.equal(automaticReference(r,doc).number,'1164-0011');
 for(const [k,v] of Object.entries({serial:'wrong',documentKind:'sale',originalNumber:'1164-0006',originalDate:'2026-09-14',totalCents:5800,number:'1164-0012',jobId:'other',strategy:'ej-successor-v1'}))assert.equal(automaticReference({...r,reference:{...r.reference,[k]:v}},doc),null,k);
 assert.equal(automaticReference({...r,state:'uncertain'},doc),null);
});
test('frontend has one confirmation and obtains original references from the server',()=>{
 const s=readFileSync(new URL('../unified-fiscal-void.js',import.meta.url),'utf8');assert.doesNotThrow(()=>new vm.Script(s));
 assert.match(s,/unified_void_start/);assert.match(s,/unified_void_pending/);assert.match(s,/automaticVoidReference/);
 assert.doesNotMatch(s,/name=["'](?:date|number|amount)/);
 const api=readFileSync(new URL('../supabase/functions/optyker-fiscal-api/index.ts',import.meta.url),'utf8');
 assert.ok(api.indexOf("const operator=await login(body)")<api.indexOf("if(a==='unified_void_start')"));
});

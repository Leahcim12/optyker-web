import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
const require = createRequire(import.meta.url);
const {scopedRows,dateValue,summarize} = require('../client-workspace-original.js');

test('unknown cache is not represented as an empty patient dossier', () => {
  assert.equal(scopedRows({},'A'),null);
  assert.deepEqual(scopedRows({A:[]},'A'),[]);
  assert.equal(summarize({},'A',{}).sheets,null);
  assert.equal(summarize({sheets:{A:[]}},'A',{}).sheets,0);
});
test('customer scope and duplicate row IDs are respected', () => {
  assert.deepEqual(scopedRows({A:[{id:'1',client_id:'A'},{id:'1',client_id:'A'},{id:'2',client_id:'B'},null]},'A'),[{id:'1',client_id:'A'}]);
  assert.equal(scopedRows({A:[]},''),null);
});
test('only valid explicit dates accepted, no rollover or guessed dates', () => {
  for (const v of ['31/02/2026','2026-02-30','2026-02-30T12:00:00Z','yesterday','2026','',null,'2026-13-01']) assert.equal(dateValue(v),null,String(v));
  for (const v of ['19/09/2026','19.09.2026','2026-09-19','2026-09-19T12:00:00Z']) assert.ok(dateValue(v),String(v));
});
test('latest dated sheet and consent count use only current customer', () => {
  const cloud={sheets:{A:[{id:'old',data:{examDate:'01/01/2026'}},{id:'new',sheet_type:'lac',data:{examDate:'18/09/2026'}},{id:'other',client_id:'B',created_at:'2026-09-19'}]},consents:{A:[{id:'signed'}]}};
  const s=summarize(cloud,'A',{A:2,B:7});
  assert.equal(s.sheets,2); assert.equal(s.latest.row.id,'new');assert.equal(s.consents,1);assert.equal(s.orders,2);
  assert.equal(summarize(cloud,'B',{}).latest,null);
});
test('missing and invalid order counts never become zero', () => {
  for(const count of [undefined,null,'',false,true,-1,1.5,'many']) assert.equal(summarize({},'A',{A:count}).orders,null,String(count));
  assert.equal(summarize({},'A',{A:0}).orders,0);assert.equal(summarize({},'A',{A:'2'}).orders,2);
});
test('presentation source does not perform writes or replace native form values', () => {
  const src=readFileSync(new URL('../client-workspace-original.js',import.meta.url),'utf8');
  assert.doesNotMatch(src,/\b(fetch|XMLHttpRequest|localStorage|sessionStorage)\s*[.(]/);
  assert.doesNotMatch(src,/\.innerHTML\s*=|\.value\s*=|cloudApi\s*\(/);
  assert.match(src,/optykerClientOpenPage\(page\)/);
});

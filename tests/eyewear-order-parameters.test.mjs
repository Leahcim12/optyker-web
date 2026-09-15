import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {normalizeOrderParameters as normalize,orderParameterRows as rows} from '../eyewear-order-parameters.mjs';

test('empty measurements stay null; explicit zero is retained',()=>{
  const p=normalize({height_od_mm:0,pd_od_mm:'  '});
  assert.equal(p.height_od_mm,0);assert.equal(p.height_os_mm,null);assert.equal(p.pd_od_mm,null);
  assert.equal(p.custom_wrap,false);assert.deepEqual(rows({}),[]);
});
test('six order measurements round-trip with decimal commas and correct units',()=>{
  const p=normalize({height_od_mm:'23,5',height_os_mm:24,pd_od_mm:31,pd_os_mm:32,
    custom_pantoscopic:true,pantoscopic_angle_deg:-8,custom_wrap:true,wrap_angle_deg:12.555});
  assert.equal(p.height_od_mm,23.5);assert.equal(p.wrap_angle_deg,12.56);
  assert.deepEqual(normalize(JSON.parse(JSON.stringify(p))),p);
  assert.equal(rows(p).length,6);assert.equal(rows(p)[0][1],'23,5 mm');assert.equal(rows(p)[5][1],'12,56 °');
});
test('custom angles require a value and are omitted when customization is disabled',()=>{
  assert.throws(()=>normalize({custom_wrap:true}),/avvolgimento/);
  assert.throws(()=>normalize({custom_pantoscopic:true}),/pantoscopico/);
  assert.equal(normalize({wrap_angle_deg:15}).wrap_angle_deg,null);
  assert.equal(normalize({custom_wrap:true,wrap_angle_deg:0}).wrap_angle_deg,0);
});
test('invalid values rejected; measurement normalization does not accept price changes',()=>{
  for(const v of [NaN,Infinity,-1,101,{},true,'wrong'])assert.throws(()=>normalize({pd_od_mm:v}));
  assert.throws(()=>normalize({custom_wrap:true,wrap_angle_deg:91}));
  assert.equal(normalize({pricing:{total:0}}).pricing,undefined);
});
test('production assembly contains parameters, print support and cancellation hooks',()=>{
  const h=readFileSync(new URL('../_site/index.html',import.meta.url),'utf8');
  assert.match(h,/OPTYKER_EYEWEAR_ORDER_PARAMETERS_20260915/);
  assert.match(h,/orderParametersHtml\(d.order_parameters\)/);
  assert.match(h,/order-sheet-actions.js\?v=20260915-order-params1/);
  const block=h.match(/<script id="optykerEyewearFlowV9Inline">([\s\S]*?)<\/script>/)[1];
  assert.doesNotThrow(()=>new vm.Script(block));
  const edit=readFileSync(new URL('../client-sheet-edit.js',import.meta.url),'utf8');
  assert.match(edit,/OPTYKER_EYEWEAR_ORDER_PARAMETERS.load\(d.order_parameters\)/);
});

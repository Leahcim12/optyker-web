// Local DOM integration checks; jsdom is a test-only dependency, not shipped.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('parameters UI: flags, payload, print, reload, reset and client isolation',()=>{
  const d=new JSDOM('<input id="eyClient" value="A"><input id="eyReference"><button id="eyReset">Reset</button><div id="eySummary"></div>',{runScripts:'outside-only'}),w=d.window;
  w.eval("var S={},E=id=>document.getElementById(id),esc=s=>String(s),payload=()=>({pricing:{total:80}}),validate=()=>true,ensure=()=>{},toast=()=>{};\n"+read('eyewear-order-parameters.mjs').replaceAll('export ','')+'\n'+read('eyewear-order-parameters-ui.js'));
  const api=w.OPTYKER_EYEWEAR_ORDER_PARAMETERS,el=id=>w.document.getElementById(id);
  assert.equal(w.document.querySelectorAll('[data-order-param]').length,6);
  el('eyParam_height_od_mm').value='23.5';el('eyParam_pd_od_mm').value='31';el('eyParam_pd_os_mm').value='32';
  el('eyParam_pd_os_mm').dispatchEvent(new w.Event('input',{bubbles:true}));assert.match(el('eyOrderPdTotal').textContent,/63 mm/);
  const flag=w.document.querySelector('[data-order-flag="custom_wrap"]');flag.checked=true;flag.dispatchEvent(new w.Event('change',{bubbles:true}));
  assert.equal(el('eyParam_wrap_angle_deg').disabled,false);assert.equal(w.validate(),false);el('eyParam_wrap_angle_deg').value='10';
  const saved=w.payload();assert.equal(saved.pricing.total,80);assert.equal(saved.order_parameters.wrap_angle_deg,10);assert.equal(w.validate(),true);
  assert.match(w.orderParametersHtml(saved.order_parameters),/23,5 mm/);
  api.load({});assert.equal(el('eyParam_height_od_mm').value,'');api.load(saved.order_parameters);assert.equal(el('eyParam_wrap_angle_deg').value,'10');
  el('eyClient').value='B';w.ensure();assert.equal(el('eyParam_height_od_mm').value,'');assert.equal(flag.checked,false);
  api.load(saved.order_parameters);el('eyReset').click();assert.equal(el('eyParam_pd_od_mm').value,'');
  api.load(saved.order_parameters);w.S.ovcSaved={row:{id:'linked-busta'}};
  w.dispatchEvent(new w.CustomEvent('optyker:sheet-removed',{detail:{sheet_id:'quote',archived_sheet_ids:['quote','linked-busta']}}));
  assert.equal(w.S.ovcSaved,null);assert.equal(el('eyParam_wrap_angle_deg').value,'');d.window.close();
});
test('Occhiali deletion refuses wrong client and cancellation, then emits linked archive IDs',async()=>{
  const d=new JSDOM('<input id="eyClient" value="A">',{runScripts:'outside-only'}),w=d.window,calls=[],events=[];
  w.OPTYKER_CLOUD={username:'test',password:'test-only',sheets:{A:[{id:'q'},{id:'b'},{id:'keep'}]}};
  w.alert=()=>{};w.confirm=()=>false;w.fetch=async(url,options)=>{calls.push(JSON.parse(options.body));return {ok:true,json:async()=>({ok:true,data:{archived_sheet_ids:['q','b'],cancelled_orders:1}})}};
  w.addEventListener('optyker:sheet-removed',e=>events.push(e.detail));w.eval(read('order-sheet-actions.js'));
  const row={id:'q',client_id:'A',updated_at:'stamp'};
  assert.equal(await w.optykerCancelOrderSheet(row),false);assert.equal(calls.length,0);
  w.confirm=()=>true;assert.equal(await w.optykerCancelOrderSheet({...row,client_id:'B'}),false);assert.equal(calls.length,0);
  assert.equal(await w.optykerCancelOrderSheet(row),true);assert.equal(calls[0].payload.expected_updated_at,'stamp');
  assert.deepEqual(w.OPTYKER_CLOUD.sheets.A.map(x=>x.id),['keep']);assert.equal(events[0].archived_sheet_ids.length,2);d.window.close();
});

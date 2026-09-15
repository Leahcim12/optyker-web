/* Injected into the final Occhiali controller. */
function ensureOrderParameters(){
  if(E('eyOrderParameters')){
    var existing=E('eyOrderParameters'),client=E('eyClient')?E('eyClient').value:'';
    if(existing.dataset.client!==client){existing.dataset.client=client;loadOrderParameters({})}
    return existing;
  }
  var summary=E('eySummary');if(!summary)return null;
  var box=document.createElement('section');box.id='eyOrderParameters';box.className='eyOrderParameters';
  box.innerHTML='<h3>Parametri d’ordine</h3><p>Misure in millimetri · angoli in gradi. I campi non compilati restano vuoti.</p><div class="eyOrderParameterGrid">'+orderParameterFields.map(function(f,i){
    var flag=i===4?'custom_pantoscopic':i===5?'custom_wrap':'';
    return '<div class="eyField">'+(flag?'<label class="eyOrderCustom"><input type="checkbox" data-order-flag="'+flag+'"> Personalizza '+(i===4?'angolo pantoscopico':'angolo di avvolgimento')+'</label>':'')+'<label for="eyParam_'+f[0]+'">'+f[1]+' ('+f[2]+')</label><input id="eyParam_'+f[0]+'" data-order-param="'+f[0]+'" type="number" step="0.1" inputmode="decimal" min="'+f[3]+'" max="'+f[4]+'"'+(flag?' disabled':'')+'></div>';
  }).join('')+'</div><p id="eyOrderPdTotal"></p>';
  box.dataset.client=E('eyClient')?E('eyClient').value:'';
  summary.before(box);box.addEventListener('input',updateOrderParameterControls);box.addEventListener('change',updateOrderParameterControls);return box;
}
function updateOrderParameterControls(){
  var box=E('eyOrderParameters');if(!box)return;
  [['custom_pantoscopic','pantoscopic_angle_deg'],['custom_wrap','wrap_angle_deg']].forEach(function(pair){E('eyParam_'+pair[1]).disabled=!box.querySelector('[data-order-flag="'+pair[0]+'"]').checked});
  var od=E('eyParam_pd_od_mm').value,os=E('eyParam_pd_os_mm').value;
  E('eyOrderPdTotal').textContent=od!==''&&os!==''?'Distanza interpupillare totale: '+String(Math.round((Number(od)+Number(os))*100)/100).replace('.',',')+' mm':'';
}
function readOrderParameters(){
  var box=ensureOrderParameters(),p={};if(!box)return normalizeOrderParameters({});
  box.querySelectorAll('[data-order-param]').forEach(function(x){p[x.dataset.orderParam]=x.value});
  box.querySelectorAll('[data-order-flag]').forEach(function(x){p[x.dataset.orderFlag]=x.checked});return normalizeOrderParameters(p);
}
function orderParametersHtml(value){var rows=orderParameterRows(value);return rows.length?'<h2>Parametri d’ordine</h2><table>'+rows.map(function(r){return '<tr><td>'+esc(r[0])+'</td><td>'+esc(r[1])+'</td></tr>'}).join('')+'</table>':''}
function loadOrderParameters(value){
  var box=ensureOrderParameters();if(!box)return;var p=normalizeOrderParameters(value||{});
  box.querySelectorAll('[data-order-param]').forEach(function(x){x.value=p[x.dataset.orderParam]==null?'':p[x.dataset.orderParam]});
  box.querySelectorAll('[data-order-flag]').forEach(function(x){x.checked=p[x.dataset.orderFlag]===true});updateOrderParameterControls();
}
var orderParameterPayload=payload;
payload=function(){var p=orderParameterPayload.apply(this,arguments);p.order_parameters=readOrderParameters();return p};
var orderParameterValidate=validate;
validate=function(){if(!orderParameterValidate.apply(this,arguments))return false;try{readOrderParameters();return true}catch(e){toast(e.message,'error');return false}};
var orderParameterEnsure=ensure;
ensure=function(){var r=orderParameterEnsure.apply(this,arguments);ensureOrderParameters();return r};
window.OPTYKER_EYEWEAR_ORDER_PARAMETERS={load:loadOrderParameters,read:readOrderParameters,rows:orderParameterRows};
document.addEventListener('click',function(e){if(e.target.closest&&e.target.closest('#eyReset'))loadOrderParameters({})},true);
document.addEventListener('change',function(e){if(e.target.id==='eyClient')loadOrderParameters({})},true);
window.addEventListener('optyker:sheet-removed',function(e){
  var d=e.detail||{},ids=d.archived_sheet_ids||[d.sheet_id];if(S.ovcSaved&&ids.map(String).includes(String(S.ovcSaved.row.id))){S.ovcSaved=null;if(E('eyReference'))E('eyReference').value='';loadOrderParameters({})}
});
ensureOrderParameters();

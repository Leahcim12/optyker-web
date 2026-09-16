/* OPTYKER_EYEWEAR_MANUAL_FINAL_PRICE_V14 */
window.OPTYKER_EYEWEAR_MANUAL_FINAL_PRICE_V14='20260916-finalprice2';
var EYE_FINAL_API='https://whgziwaegjzqsgcntesr.supabase.co/functions/v1/optyker-eyewear-final-price';

function manualFinalInput(){return E('eyManualFinalPrice')}
function manualFinalNumber(v){var s=String(v==null?'':v).trim().replace(',','.');if(!s)return null;var n=Number(s);return isFinite(n)&&n>=0&&n<=1000000?Math.round(n*100)/100:null}
function manualFinalKey(){var cid=String((E('eyClient')&&E('eyClient').value)||window.clientCurrentId||'').trim(),ref=String((E('eyReference')&&E('eyReference').value)||'').trim();return cid+'|'+ref}
function manualFinalSavedRow(){
  var cid=String((E('eyClient')&&E('eyClient').value)||window.clientCurrentId||'').trim(),ref=String((E('eyReference')&&E('eyReference').value)||'').trim();
  if(!cid||!ref)return null;
  var cloud=window.OPTYKER_CLOUD||{},map=cloud.sheets||{},rows=Array.isArray(map[cid])?map[cid]:[];
  for(var i=0;i<rows.length;i++){var r=rows[i]||{},rr=String(r.reference_code||r.reference_no||r.data&&r.data.referenceCode||r.data&&r.data.documentReference||'').trim();if(rr===ref&&/^eyewear_/i.test(String(r.sheet_type||r.data&&r.data.sheetType||'')))return r}
  return null
}
function restoreManualFinalCurrent(){
  var input=manualFinalInput();if(!input)return;
  var key=manualFinalKey();
  if(input.dataset.currentKey!==key){
    if(input.dataset.userDirty!=='1'){input.dataset.manual='0';input.dataset.persisted='0';input.dataset.clear='0';input.dataset.restoredValue=''}
    input.dataset.currentKey=key;input.dataset.userDirty='0'
  }
  if(input.dataset.userDirty==='1')return;
  var row=manualFinalSavedRow(),d=row&&row.data||{},p=d.pricing||{},raw=p.manual_final_price!=null?p.manual_final_price:d.manual_final_price;
  if(raw==null||raw==='')return;
  var n=manualFinalNumber(raw);if(n==null)return;
  var stamp=key+'|'+n.toFixed(2);if(input.dataset.restoredValue===stamp)return;
  input.dataset.restoredValue=stamp;input.dataset.manual='1';input.dataset.persisted='1';input.dataset.clear='0';input.value=n.toFixed(2);renderSummary()
}
function ensureManualFinalUi(){
  var summary=E('eySummary');if(!summary)return null;
  var box=E('eyManualFinalPriceBox');
  if(!box){
    box=document.createElement('div');box.id='eyManualFinalPriceBox';box.className='eyManualFinalPriceBox';
    box.innerHTML='<div><label for="eyManualFinalPrice">Prezzo finale</label><small id="eyManualFinalCalculated"></small></div><div class="eyManualFinalControls"><span>€</span><input id="eyManualFinalPrice" type="text" inputmode="decimal" autocomplete="off" aria-label="Prezzo finale Occhiali"><button id="eyManualFinalReset" type="button">Ripristina calcolato</button></div>';
    summary.insertAdjacentElement('afterend',box);
    var input=E('eyManualFinalPrice'),reset=E('eyManualFinalReset');
    input.addEventListener('input',function(ev){if(ev&&ev.isTrusted)this.dataset.userDirty='1';var n=manualFinalNumber(this.value);this.dataset.manual=n==null?'0':'1';this.dataset.clear='0';if(n!=null)renderSummary()});
    input.addEventListener('change',function(ev){if(ev&&ev.isTrusted)this.dataset.userDirty='1';var n=manualFinalNumber(this.value);if(n==null){this.dataset.manual='0';this.dataset.clear=this.dataset.persisted==='1'?'1':'0'}else{this.value=n.toFixed(2);this.dataset.manual='1';this.dataset.clear='0'}renderSummary()});
    reset.onclick=function(){var i=manualFinalInput();if(!i)return;i.dataset.userDirty='1';i.dataset.manual='0';i.dataset.clear=i.dataset.persisted==='1'?'1':'0';i.value='';renderSummary()};
    if(!E('eyManualFinalPriceCss')){var st=document.createElement('style');st.id='eyManualFinalPriceCss';st.textContent='.eyManualFinalPriceBox{margin:12px 0 16px;padding:13px 14px;border:1px solid #9fc6df;border-radius:12px;background:#f3f9fd;display:flex;align-items:center;justify-content:space-between;gap:14px}.eyManualFinalPriceBox label{display:block;font-size:12px;font-weight:900;color:#174f78}.eyManualFinalPriceBox small{display:block;margin-top:3px;font-size:8px;color:#6b8192}.eyManualFinalControls{display:flex;align-items:center;gap:7px}.eyManualFinalControls>span{font-size:16px;font-weight:900;color:#174f78}.eyManualFinalControls input{width:128px;height:38px;box-sizing:border-box;border:1px solid #8fb7d2;border-radius:8px;background:#fff;padding:0 10px;font:900 16px/1 Segoe UI,Arial,sans-serif;text-align:right;color:#17334b}.eyManualFinalControls input:focus{outline:3px solid rgba(23,105,170,.13);border-color:#1769aa}.eyManualFinalControls button{height:38px;border:1px solid #b7cad8;border-radius:8px;background:#fff;color:#31566f;padding:0 10px;font:800 9px/1 Segoe UI,Arial,sans-serif;cursor:pointer}@media(max-width:700px){.eyManualFinalPriceBox{align-items:stretch;flex-direction:column}.eyManualFinalControls{width:100%}.eyManualFinalControls input{flex:1;min-width:0}}';document.head.appendChild(st)}
  }
  return box;
}

var _eyPricingManualBase=pricing;
pricing=function(){
  var p=_eyPricingManualBase.apply(this,arguments),input=manualFinalInput();
  p.calculated_total=num(p.total);
  if(input&&input.dataset.manual==='1'){
    var n=manualFinalNumber(input.value);if(n!=null){p.manual_final_price=n;p.total=n}
  }
  return p
};

var _eyRenderManualBase=renderSummary;
renderSummary=function(){
  var r=_eyRenderManualBase.apply(this,arguments);ensureManualFinalUi();
  var input=manualFinalInput(),hint=E('eyManualFinalCalculated');if(!input)return r;
  var p=pricing(),calc=num(p.calculated_total);
  if(input.dataset.manual!=='1'){input.value=calc.toFixed(2)}
  if(hint)hint.textContent='Calcolato da listino: '+euro(calc)+(input.dataset.manual==='1'?' · verrà usato il prezzo inserito manualmente':'');
  var row=E('eySummary')&&E('eySummary').querySelector('.eySummaryRow.total');if(row&&input.dataset.manual==='1'){var b=row.querySelector('b');if(b)b.textContent=euro(p.total);var s=row.querySelector('span');if(s)s.textContent='Totale finale manuale'}
  return r
};

var _eyPayloadManualBase=payload;
payload=function(){
  var d=_eyPayloadManualBase.apply(this,arguments),input=manualFinalInput(),p=d.pricing_client||pricing();
  if(input&&input.dataset.manual==='1'){
    var n=manualFinalNumber(input.value);if(n!=null){d.manual_final_price=n;p.manual_final_price=n;p.calculated_total=num(p.calculated_total);p.total=n}
  }else if(input&&input.dataset.clear==='1')d.clear_manual_final_price=true;
  d.pricing_client=p;return d
};

function saveManualFinalPrice(sheetId,p){
  var input=manualFinalInput();if(!input||!sheetId)return Promise.resolve(null);
  var hasManual=input.dataset.manual==='1',clear=input.dataset.clear==='1';if(!hasManual&&!clear)return Promise.resolve(null);
  var c=creds();if(!c.username||!c.password)return Promise.reject(new Error('Sessione operatore non disponibile.'));
  var body={username:c.username,password:c.password,payload:{sheet_id:sheetId}};
  if(hasManual){var n=manualFinalNumber(input.value);if(n==null)return Promise.reject(new Error('Prezzo finale non valido.'));body.payload.amount=n}else body.payload.clear=true;
  return fetch(EYE_FINAL_API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}).then(function(r){return r.json().catch(function(){return {}}).then(function(x){if(!r.ok||!x||x.ok===false)throw new Error(x&&x.error||('HTTP '+r.status));input.dataset.persisted=hasManual?'1':'0';input.dataset.clear='0';input.dataset.userDirty='0';input.dataset.restoredValue=hasManual?(manualFinalKey()+'|'+Number(body.payload.amount).toFixed(2)):'';return x})})
}

var _eyApiManualBase=api;
api=function(action,payloadArg){
  return _eyApiManualBase.apply(this,arguments).then(function(x){
    if(action!=='save'||!x||!x.data||!x.data.id)return x;
    return saveManualFinalPrice(x.data.id,payloadArg).then(function(saved){if(saved&&saved.data)x.data=saved.data;return x})
  })
};

setTimeout(function(){ensureManualFinalUi();renderSummary();restoreManualFinalCurrent()},120);
setInterval(restoreManualFinalCurrent,220);

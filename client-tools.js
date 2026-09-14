(function(){
  if(window.__optykerClientToolsPatch)return;window.__optykerClientToolsPatch=true;
  var API='https://whgziwaegjzqsgcntesr.supabase.co/functions/v1/optyker-client-tools-api';
  var state={clientId:'',data:null,loading:false,last:0};
  var defs={
    usage:{title:"Indicazioni d’uso",fields:['examDate','instructions','products','maintenance','notes']},
    protocol_ovc:{title:'Protocollo VC',fields:['examDate','reason','anamnesis','visualAcuity','refraction','binocularVision','accommodation','motility','outcome','notes']},
    protocol_ovc_bambini:{title:'Protocollo VC Bambini',fields:['examDate','reason','parentNotes','visualAcuity','coverTest','motility','accommodation','stereopsis','colorVision','outcome','notes']},
    analisi_visiva_integrata:{title:'Analisi Visiva Integrata',fields:['examDate','reason','anamnesis','visualAcuity','refraction','binocularVision','accommodation','motility','outcome','recommendations','notes']},
    fondo_oculare:{title:'Fondo Oculare',fields:['examDate','odFindings','osFindings','outcome','recommendations','notes']},
    visual_anomalies:{title:'Anomalie visive',fields:['examDate','anomaly','tests','findings','outcome','recommendations','notes']}
  };
  var labels={examDate:'Data esame',reason:'Motivo',anamnesis:'Anamnesi',visualAcuity:'Acuità visiva',refraction:'Refrazione',binocularVision:'Visione binoculare',accommodation:'Accomodazione',motility:'Motilità',outcome:'Esito',recommendations:'Indicazioni / raccomandazioni',notes:'Note',parentNotes:'Note genitore',coverTest:'Cover test',stereopsis:'Stereopsi',colorVision:'Visione dei colori',anomaly:'Anomalia visiva',tests:'Test eseguiti',findings:'Risultati',odFindings:'Fondo OD',osFindings:'Fondo OS',instructions:"Indicazioni d’uso",products:'Prodotti',maintenance:'Manutenzione'};
  function E(id){return document.getElementById(id)}
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(ch){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]})}
  function op(){return String(window.OPTYKER_ACTIVE_USER||(window.OPTYKER_CLOUD&&OPTYKER_CLOUD.username)||'').trim()}
  function call(action,payload){var b=payload||{};b.action=action;b.operator=op();return fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)}).then(function(r){return r.json().catch(function(){return {}}).then(function(x){if(!r.ok||x&&x.ok===false)throw new Error((x&&x.error)||('HTTP '+r.status));return x})})}
  function money(v,c){var n=Number(v);if(!isFinite(n))return '—';try{return new Intl.NumberFormat('it-IT',{style:'currency',currency:c||'EUR'}).format(n)}catch(z){return n.toFixed(2)+' €'}}
  function dt(v){if(!v)return '—';try{return new Date(v).toLocaleString('it-IT',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'})}catch(z){return String(v)}}
  function getVal(s,k){var d=s&&s.data||{},e=d.elements&&d.elements[k];if(e&&typeof e==='object'&&Object.prototype.hasOwnProperty.call(e,'value'))return String(e.value==null?'':e.value);if(typeof e==='string'||typeof e==='number')return String(e);if(Object.prototype.hasOwnProperty.call(d,k)&&['string','number','boolean'].indexOf(typeof d[k])>=0)return String(d[k]);return ''}
  function fieldsFor(s){var d=defs[s.kind]||{fields:[]},keys=d.fields.slice(),els=s&&s.data&&s.data.elements||{};Object.keys(els).forEach(function(k){if(['clientName','clientSurname','specialistName'].indexOf(k)<0&&keys.indexOf(k)<0)keys.push(k)});return keys}
  function wide(k,v){return ['notes','outcome','recommendations','findings','anamnesis','instructions','tests','parentNotes','odFindings','osFindings'].indexOf(k)>=0||String(v||'').length>55}
  function fieldHtml(s,k){var v=getVal(s,k),w=wide(k,v),lab=labels[k]||String(k).replace(/_/g,' ').replace(/([a-z])([A-Z])/g,'$1 $2');return '<div class="optykerClinicalField '+(w?'wide':'')+'"><label>'+esc(lab)+'</label>'+(w?'<textarea data-tools-key="'+esc(k)+'">'+esc(v)+'</textarea>':'<input data-tools-key="'+esc(k)+'" value="'+esc(v)+'">')+'</div>'}
  function cloudReplace(row){var cid=String(row&&row.client_id||state.clientId||'');if(!cid||!window.OPTYKER_CLOUD||!OPTYKER_CLOUD.sheets)return;var a=Array.isArray(OPTYKER_CLOUD.sheets[cid])?OPTYKER_CLOUD.sheets[cid]:[],i=a.findIndex(function(x){return String(x&&x.id||'')===String(row&&row.id||'')});if(i>=0)a[i]=row;else a.unshift(row);OPTYKER_CLOUD.sheets[cid]=a}
  function ensureBlock(id,after){var b=E(id);if(b)return b;b=document.createElement('section');b.id=id;b.className='optykerClientToolsBlock';if(after&&after.parentNode)after.parentNode.insertBefore(b,after.nextSibling);else{var n=E('clientWorkspaceName');if(n&&n.parentNode&&n.parentNode.parentNode)n.parentNode.parentNode.appendChild(b)}return b}
  function rootAnchor(){return E('optykerClientQuotesSection')||E('optykerClientReferenceBadge')||E('clientWorkspaceName')?.parentNode||E('clientWorkspaceName')}
  function sheetDisplay(s){var ref=String(s&&((s.reference_code||s.reference_no)||s.data&&s.data.documentReference)||'').trim();return ref||('Scheda n. '+String(s&&s.display_no||'—'))}
  function renderReferences(){
    var a=rootAnchor(),b=ensureBlock('optykerClientReferenceTools',a);if(!b)return;
    var c=state.data&&state.data.client||{},l=Array.isArray(state.data&&state.data.lenses)?state.data.lenses:[];
    var h='<div class="optykerClientToolsHead"><div><h3>Numeri e riferimenti</h3><div class="optykerClientToolsSub">Riferimenti reali del cliente, delle schede e delle forniture.</div></div>'+(c.reference_no?'<span class="optykerRefBadge">CLIENTE '+esc(c.reference_no)+'</span>':'')+'</div>';
    if(l.length){h+='<div class="optykerRefList">'+l.map(function(x,i){var r=String(x.in_store_order_ref||'').trim()||('Fornitura '+(i+1));return '<div class="optykerRefLine"><b>'+esc([x.brand,x.product_name,x.eye].filter(Boolean).join(' · ')||'Fornitura LAC')+'</b><span>'+esc(r)+'</span></div>'}).join('')+'</div>'}
    else h+='<div class="optykerEmptySmall">Nessuna fornitura LAC collegata.</div>';
    b.innerHTML=h;
  }
  function clinicalGroups(){var rows=state.data&&state.data.clinical_sheets||[],kinds=['usage','protocol_ovc','protocol_ovc_bambini','analisi_visiva_integrata','fondo_oculare'];return kinds.map(function(k){var a=rows.filter(function(x){return x.kind===k}),d=defs[k];return '<div class="optykerClinicalGroup"><div class="optykerClinicalGroupHead"><div class="optykerClinicalGroupTitle">'+esc(d.title)+'</div><button class="optykerClientToolsBtn" data-tools-new="'+k+'" type="button">+ Crea scheda</button></div>'+(a.length?a.map(cardHtml).join(''):'<div class="optykerEmptySmall">Nessuna scheda.</div>')+'</div>'}).join('')}
  function cardHtml(s){var out=getVal(s,'outcome');return '<div class="optykerClinicalCard" data-tools-card="'+esc(s.id)+'"><div class="optykerClinicalSummary"><strong>'+esc((defs[s.kind]&&defs[s.kind].title)||s.title||'Scheda')+' <em>'+esc(sheetDisplay(s))+'</em></strong><span>'+esc(dt(s.updated_at||s.created_at))+' · MODIFICA ▾</span></div>'+(s.kind==='visual_anomalies'&&out?'<div class="optykerAnomalyOutcome"><b>Esito:</b> '+esc(out)+'</div>':'')+'<div class="optykerClinicalEditor"><div class="optykerClinicalFields">'+fieldsFor(s).map(function(k){return fieldHtml(s,k)}).join('')+'</div><div class="optykerClinicalSaveRow"><button class="optykerClientToolsBtn primary" data-tools-save="'+esc(s.id)+'" type="button">SALVA SCHEDA</button></div></div></div>'}
  function renderClinical(){
    var a=rootAnchor(),b=ensureBlock('optykerClientClinicalTools',a);if(!b)return;
    b.innerHTML='<div class="optykerClientToolsHead"><div><h3>Schede cliniche</h3><div class="optykerClientToolsSub">Crea e modifica le schede direttamente dall’anagrafica cliente.</div></div></div><div class="optykerClientToolsGrid">'+clinicalGroups()+'</div>';
    bind(b);
  }
  function renderAnomalies(){
    var rows=(state.data&&state.data.clinical_sheets||[]).filter(function(x){return x.kind==='visual_anomalies'}),after=E('optykerClientClinicalTools')||rootAnchor(),b=ensureBlock('optykerClientAnomalyTools',after);if(!b)return;
    b.innerHTML='<div class="optykerClientToolsHead"><div><h3>Anomalie visive · esiti</h3><div class="optykerClientToolsSub">Storico degli esiti e nuove valutazioni per il cliente.</div></div><button class="optykerClientToolsBtn" data-tools-new="visual_anomalies" type="button">+ Crea anomalia visiva</button></div>'+(rows.length?rows.map(cardHtml).join(''):'<div class="optykerEmptySmall">Nessuna anomalia visiva registrata.</div>');
    bind(b);
  }
  function renderPayments(){
    var p=state.data&&state.data.payment_cart||{},pos=Array.isArray(p.pos_open)?p.pos_open:[],online=Array.isArray(p.online_unpaid)?p.online_unpaid:[],after=E('optykerClientAnomalyTools')||E('optykerClientClinicalTools')||rootAnchor(),b=ensureBlock('optykerClientPaymentTools',after);if(!b)return;
    var h='<div class="optykerClientToolsHead"><div><h3>Carrello / da pagare</h3><div class="optykerClientToolsSub">Controlla subito se il cliente ha ancora un saldo aperto.</div></div></div>';
    if(!pos.length&&!online.length)h+='<div class="optykerPaidOk">Nessun importo residuo: il cliente non risulta avere pagamenti aperti.</div>';
    else{h+='<div class="optykerDueTop"><b>TOTALE ANCORA DA PAGARE</b><strong>'+esc(money(p.total_due,p.currency||'EUR'))+'</strong></div>';h+=pos.map(function(x){return '<div class="optykerDueRow"><div><div class="optykerDueRowTitle">'+esc(x.shopify_order_name||x.note||'Vendita Optyker')+'</div><div class="optykerDueRowMeta">'+esc(dt(x.created_at))+' · '+esc(x.payment_stage||x.payment_status||x.status||'Pagamento aperto')+'</div></div><div class="optykerDueRowAmount">'+esc(money(x.due_amount,x.currency||'EUR'))+'</div></div>'}).join('');h+=online.map(function(o){return '<div class="optykerDueRow"><div><div class="optykerDueRowTitle">'+esc(o.order_name||'Ordine online')+'</div><div class="optykerDueRowMeta">Ordine online · '+esc(o.financial_status||'Da pagare')+'</div></div><div class="optykerDueRowAmount">'+esc(money(o.total,o.currency||'EUR'))+'</div></div>'}).join('')}
    b.innerHTML=h;
  }
  function renderAll(){if(String(window.clientCurrentId||'')!==state.clientId)return;renderReferences();renderClinical();renderAnomalies();renderPayments()}
  function bind(root){
    Array.prototype.forEach.call(root.querySelectorAll('.optykerClinicalSummary'),function(x){x.onclick=function(){this.closest('.optykerClinicalCard').classList.toggle('open')}});
    Array.prototype.forEach.call(root.querySelectorAll('[data-tools-new]'),function(x){x.onclick=function(){createSheet(this.getAttribute('data-tools-new'))}});
    Array.prototype.forEach.call(root.querySelectorAll('[data-tools-save]'),function(x){x.onclick=function(){saveSheet(this.getAttribute('data-tools-save'),this.closest('.optykerClinicalCard'))}});
  }
  function load(force){
    var cid=String(window.clientCurrentId||'');if(!cid){state.clientId='';state.data=null;['optykerClientReferenceTools','optykerClientClinicalTools','optykerClientAnomalyTools','optykerClientPaymentTools'].forEach(function(id){var x=E(id);if(x)x.remove()});return Promise.resolve()}
    if(state.loading)return Promise.resolve();if(!force&&cid===state.clientId&&Date.now()-state.last<10000){renderAll();return Promise.resolve()}
    state.clientId=cid;state.loading=true;
    return call('list',{client_id:cid}).then(function(x){if(cid===String(window.clientCurrentId||'')){state.data=x.data||{};state.last=Date.now();renderAll()}}).catch(function(e){console.warn('Optyker client tools:',e)}).finally(function(){state.loading=false})
  }
  function createSheet(k){var cid=String(window.clientCurrentId||'');if(!cid)return;call('create',{client_id:cid,kind:k}).then(function(x){if(x.data)cloudReplace(x.data);return load(true)}).then(function(){setTimeout(function(){var cards=document.querySelectorAll('.optykerClinicalCard');if(cards.length){cards[0].classList.add('open');cards[0].scrollIntoView({behavior:'smooth',block:'center'})}},60)}).catch(function(e){alert('Impossibile creare la scheda: '+e.message)})}
  function saveSheet(id,card){var cid=String(window.clientCurrentId||'');if(!cid||!id||!card)return;var values={};Array.prototype.forEach.call(card.querySelectorAll('[data-tools-key]'),function(x){values[x.getAttribute('data-tools-key')]=x.value});var b=card.querySelector('[data-tools-save]');if(b){b.disabled=true;b.textContent='Salvataggio…'}call('update',{client_id:cid,id:id,values:values}).then(function(x){if(x.data)cloudReplace(x.data);return load(true)}).then(function(){alert('Scheda aggiornata')}).catch(function(e){alert('Impossibile salvare: '+e.message)}).finally(function(){if(b){b.disabled=false;b.textContent='SALVA SCHEDA'}})}
  function hook(){
    if(typeof window.clientSelect==='function'&&!window.clientSelect.__clientToolsHook){var old=window.clientSelect,w=function(){var r=old.apply(this,arguments);setTimeout(function(){load(true)},120);return r};w.__clientToolsHook=true;window.clientSelect=w}
  }
  function install(){hook();var cid=String(window.clientCurrentId||'');if(cid&&cid!==state.clientId)load(true);else if(cid&&state.data)renderAll()}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
  setInterval(install,800);
})();

(function(){
  if(window.__optykerCashDayControlLoader)return;window.__optykerCashDayControlLoader=true;
  var s=document.createElement('script');s.src='https://raw.githubusercontent.com/Leahcim12/optyker-web/main/cash-day-control.js?v=20260915-2';s.async=true;(document.head||document.documentElement).appendChild(s);
})();

/* OPTYKER_CASH_DAY_CONTROL_INLINE_V1 */
(function(){
'use strict';
if(window.__optykerCashDayControlV1)return;
window.__optykerCashDayControlV1='20260915-inline1';

var API_DAY='https://whgziwaegjzqsgcntesr.supabase.co/functions/v1/optyker-cash-day-api';
var cashDayState={metrics:null,loading:false,last:0};

function cashDayE(id){return document.getElementById(id)}
function cashDayMoney(v){var n=Number(v||0);if(!isFinite(n))n=0;try{return new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR'}).format(n)}catch(e){return n.toFixed(2)+' €'}}
function cashDayNum(v){var n=Number(String(v==null?'':v).replace(',','.'));return isFinite(n)?Math.round(n*100)/100:NaN}
function cashDayEsc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function cashDayCreds(){var c=window.OPTYKER_CLOUD||{};return {username:String(c.username||window.OPTYKER_ACTIVE_USER||'').trim(),password:String(c.password||'')}}
function cashDayTodayRome(){
  var p=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()),o={};
  p.forEach(function(x){if(x.type!=='literal')o[x.type]=x.value});
  return o.year+'-'+o.month+'-'+o.day;
}
function cashDayCall(action,payload){
  var c=cashDayCreds();
  if(!c.username||!c.password)return Promise.reject(new Error('Sessione operatore non disponibile. Esci e accedi nuovamente.'));
  return fetch(API_DAY,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:action,username:c.username,password:c.password,payload:payload||{}})})
    .then(function(r){return r.json().catch(function(){return {}}).then(function(x){if(!r.ok||!x||x.ok===false)throw new Error(x&&x.error||('HTTP '+r.status));return x})});
}
function cashDayToast(msg,type){
  var t=cashDayE('optykerCashDayToast');
  if(!t){t=document.createElement('div');t.id='optykerCashDayToast';document.body.appendChild(t)}
  t.className=type||'';t.textContent=msg;t.style.display='block';clearTimeout(t.__timer);t.__timer=setTimeout(function(){t.style.display='none'},4200);
}
function cashDayInjectStyle(){
  if(cashDayE('optykerCashDayStyle'))return;
  var s=document.createElement('style');s.id='optykerCashDayStyle';s.textContent='\
#optykerCashDayActions{display:flex;align-items:center;gap:7px;margin-right:2px}.optykerCashDayBtn{height:36px;border:1px solid #c9d8e5;border-radius:9px;background:#fff;color:#173b5e;padding:0 11px;font:800 11px/1 "Segoe UI",Arial,sans-serif;cursor:pointer;white-space:nowrap;box-shadow:0 1px 3px rgba(20,48,72,.06)}.optykerCashDayBtn:hover:not(:disabled){border-color:#1769aa;background:#f3f9fd}.optykerCashDayBtn.open{background:#eaf7ef;border-color:#b8dfc5;color:#176b39}.optykerCashDayBtn.close{background:#fff1f0;border-color:#efc8c4;color:#a2352d}.optykerCashDayBtn:disabled{opacity:.45;cursor:not-allowed}.optykerCashDayState{height:28px;display:inline-flex;align-items:center;border-radius:999px;padding:0 9px;background:#eef4f8;color:#526a7d;font:800 9px/1 "Segoe UI",Arial,sans-serif;white-space:nowrap}.optykerCashDayState.open{background:#e8f6ed;color:#176b39}.optykerCashDayState.closed{background:#eef1f4;color:#4b5c6b}.optykerCashDayState.pending{background:#fff7df;color:#87640e}\
#optykerCashDayModal{position:fixed;inset:0;z-index:2147483644;background:rgba(10,28,45,.52);display:none;align-items:center;justify-content:center;padding:18px;box-sizing:border-box;backdrop-filter:blur(2px)}#optykerCashDayModal.open{display:flex}.optykerCashDayCard{width:min(560px,100%);max-height:92vh;overflow:auto;background:#fff;border:1px solid #dbe5ed;border-radius:18px;box-shadow:0 24px 70px rgba(11,35,58,.28);padding:22px;box-sizing:border-box}.optykerCashDayHead{display:flex;justify-content:space-between;gap:16px;align-items:flex-start}.optykerCashDayEyebrow{font-size:9px;font-weight:900;letter-spacing:.11em;color:#1769aa;text-transform:uppercase}.optykerCashDayTitle{font-size:23px;font-weight:950;color:#173b5e;margin-top:3px}.optykerCashDaySub{font-size:11px;line-height:1.45;color:#6c7f8f;margin-top:6px}.optykerCashDayX{width:34px;height:34px;border:0;border-radius:9px;background:#eef3f7;color:#486176;font-size:21px;cursor:pointer}.optykerCashDaySummary{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;margin:17px 0}.optykerCashDayMetric{border:1px solid #e0e8ef;border-radius:11px;background:#f8fbfd;padding:11px}.optykerCashDayMetric span{display:block;font-size:9px;font-weight:850;color:#748696;text-transform:uppercase;letter-spacing:.05em}.optykerCashDayMetric b{display:block;font-size:17px;color:#1d3d58;margin-top:4px}.optykerCashDayField{margin-top:13px}.optykerCashDayField label{display:block;font-size:11px;font-weight:850;color:#3f566a;margin-bottom:6px}.optykerCashDayField input,.optykerCashDayField textarea{width:100%;box-sizing:border-box;border:1px solid #cbd8e3;border-radius:10px;background:#fff;color:#173b5e;font:700 14px/1.2 "Segoe UI",Arial,sans-serif;padding:11px;outline:none}.optykerCashDayField input:focus,.optykerCashDayField textarea:focus{border-color:#1769aa;box-shadow:0 0 0 3px rgba(23,105,170,.11)}.optykerCashDayField textarea{min-height:72px;resize:vertical;font-size:12px;font-weight:600}.optykerCashDayHint{font-size:10px;color:#7b8c99;margin-top:5px;line-height:1.4}.optykerCashDayCalc{margin-top:13px;border-radius:10px;background:#eef7fd;border:1px solid #d1e6f5;padding:11px;display:flex;justify-content:space-between;gap:12px;align-items:center;font-size:11px;color:#4e6678}.optykerCashDayCalc strong{font-size:16px;color:#1769aa}.optykerCashDayNotice{margin-top:14px;border:1px solid #dde7ee;border-radius:10px;background:#f8fbfd;padding:10px;font-size:10px;line-height:1.45;color:#657989}.optykerCashDayActionsRow{display:flex;justify-content:flex-end;gap:9px;margin-top:18px}.optykerCashDayActionsRow button{height:40px;border:0;border-radius:10px;padding:0 15px;font:850 11px/1 "Segoe UI",Arial,sans-serif;cursor:pointer}.optykerCashDayCancel{background:#edf2f6;color:#425a70}.optykerCashDayConfirm{background:#1769aa;color:#fff;box-shadow:0 5px 14px rgba(23,105,170,.22)}.optykerCashDayConfirm.danger{background:#a84035}.optykerCashDayActionsRow button:disabled{opacity:.55;cursor:wait}#optykerCashDayToast{position:fixed;z-index:2147483647;right:20px;bottom:20px;max-width:min(440px,calc(100vw - 40px));display:none;background:#173b5e;color:#fff;border-radius:11px;padding:12px 15px;font:750 11px/1.4 "Segoe UI",Arial,sans-serif;box-shadow:0 14px 36px rgba(12,35,55,.25)}#optykerCashDayToast.ok{background:#176b39}#optykerCashDayToast.error{background:#a2352d}\
@media(max-width:1050px){#optykerCashDayActions{gap:4px}.optykerCashDayState{display:none}.optykerCashDayBtn{padding:0 8px;font-size:10px}}@media(max-width:760px){#optykerCashDayActions{order:5;width:100%;justify-content:flex-end;margin-top:6px}.optykerCashDaySummary{grid-template-columns:1fr}}';
  document.head.appendChild(s);
}
function cashDayEnsureModal(){
  var m=cashDayE('optykerCashDayModal');if(m)return m;
  m=document.createElement('div');m.id='optykerCashDayModal';m.innerHTML='<div class="optykerCashDayCard" role="dialog" aria-modal="true"><div id="optykerCashDayModalBody"></div></div>';
  m.addEventListener('click',function(ev){if(ev.target===m)cashDayCloseModal()});document.body.appendChild(m);return m;
}
function cashDayCloseModal(){var m=cashDayE('optykerCashDayModal');if(m)m.classList.remove('open')}
function cashDayOpenModal(html){var m=cashDayEnsureModal(),b=cashDayE('optykerCashDayModalBody');b.innerHTML=html;m.classList.add('open');var x=b.querySelector('[data-day-x]');if(x)x.onclick=cashDayCloseModal;var c=b.querySelector('[data-day-cancel]');if(c)c.onclick=cashDayCloseModal}
function cashDayMetricVal(m,k){var n=Number(m&&m[k]||0);return isFinite(n)?n:0}
function cashDayOpeningCash(m){return cashDayMetricVal(m&&m.opening,'opening_cash')}
function cashDayExpectedCash(m){return Math.round((cashDayOpeningCash(m)+cashDayMetricVal(m,'cash_total'))*100)/100}
function cashDaySetButtons(m){
  var ob=cashDayE('optykerCashDayOpenBtn'),cb=cashDayE('optykerCashDayCloseBtn'),st=cashDayE('optykerCashDayState');if(!ob||!cb||!st)return;
  var opened=!!(m&&m.opened),closed=!!(m&&m.closed),suggest=cashDayMetricVal(m,'suggested_opening_cash');
  ob.disabled=opened||closed||cashDayState.loading;cb.disabled=!opened||closed||cashDayState.loading;
  st.className='optykerCashDayState '+(closed?'closed':opened?'open':'pending');
  if(closed)st.textContent='Cassa chiusa';
  else if(opened)st.textContent='Aperta · fondo '+cashDayMoney(cashDayOpeningCash(m));
  else st.textContent='Da aprire · fondo '+cashDayMoney(suggest);
}
function cashDayRefresh(force){
  if(cashDayState.loading)return Promise.resolve(cashDayState.metrics);
  if(!force&&cashDayState.metrics&&Date.now()-cashDayState.last<12000){cashDaySetButtons(cashDayState.metrics);return Promise.resolve(cashDayState.metrics)}
  cashDayState.loading=true;cashDaySetButtons(cashDayState.metrics);
  return cashDayCall('status',{date:cashDayTodayRome()}).then(function(x){cashDayState.metrics=x.data||{};cashDayState.last=Date.now();cashDaySetButtons(cashDayState.metrics);return cashDayState.metrics})
    .catch(function(e){var st=cashDayE('optykerCashDayState');if(st){st.className='optykerCashDayState';st.textContent='Stato non disponibile'};throw e})
    .finally(function(){cashDayState.loading=false;cashDaySetButtons(cashDayState.metrics)});
}
function cashDayHead(title,sub){return '<div class="optykerCashDayHead"><div><div class="optykerCashDayEyebrow">Gestione giornata</div><div class="optykerCashDayTitle">'+cashDayEsc(title)+'</div><div class="optykerCashDaySub">'+cashDayEsc(sub)+'</div></div><button class="optykerCashDayX" data-day-x type="button" aria-label="Chiudi">×</button></div>'}
function cashDayNotesField(){return '<div class="optykerCashDayField"><label>Note (facoltative)</label><textarea id="optykerCashDayNotes" maxlength="500" placeholder="Eventuali annotazioni sulla giornata…"></textarea></div>'}
function cashDayOpenOpening(){
  cashDayRefresh(true).then(function(m){
    if(m.closed)return cashDayToast('La cassa di oggi risulta già chiusa.','error');
    if(m.opened)return cashDayToast('La cassa di oggi è già aperta.','error');
    var suggested=cashDayMetricVal(m,'suggested_opening_cash');
    cashDayOpenModal(cashDayHead('Apertura cassa','Inserisci il fondo presente nel cassetto. Il valore è già proposto dalla chiusura precedente.')+
      '<div class="optykerCashDaySummary"><div class="optykerCashDayMetric"><span>Fondo dalla chiusura precedente</span><b>'+cashDayMoney(suggested)+'</b></div><div class="optykerCashDayMetric"><span>Data</span><b>'+cashDayTodayRome().split('-').reverse().join('/')+'</b></div></div>'+
      '<div class="optykerCashDayField"><label>Fondo cassa iniziale</label><input id="optykerCashDayOpening" type="number" min="0" step="0.01" inputmode="decimal" value="'+suggested.toFixed(2)+'"><div class="optykerCashDayHint">Puoi modificarlo se il contante realmente presente è diverso.</div></div>'+cashDayNotesField()+
      '<div class="optykerCashDayNotice"><b>Nessun comando fiscale:</b> l’apertura registra solo il fondo in Optyker e non apre il cassetto RCH.</div>'+
      '<div class="optykerCashDayActionsRow"><button class="optykerCashDayCancel" data-day-cancel type="button">Annulla</button><button class="optykerCashDayConfirm" id="optykerCashDayOpenConfirm" type="button">Conferma apertura</button></div>');
    var input=cashDayE('optykerCashDayOpening');if(input){input.focus();input.select()}
    cashDayE('optykerCashDayOpenConfirm').onclick=function(){
      var amount=cashDayNum(cashDayE('optykerCashDayOpening').value),notes=String(cashDayE('optykerCashDayNotes').value||'').trim();
      if(!isFinite(amount)||amount<0)return cashDayToast('Inserisci un fondo cassa valido.','error');
      var b=this;b.disabled=true;b.textContent='Apertura…';
      cashDayCall('open',{date:cashDayTodayRome(),opening_cash:amount,notes:notes}).then(function(x){cashDayState.metrics=x.data||{};cashDayState.last=Date.now();cashDaySetButtons(cashDayState.metrics);cashDayCloseModal();cashDayToast('Cassa aperta · fondo '+cashDayMoney(amount),'ok')})
        .catch(function(e){cashDayToast('Apertura non registrata: '+e.message,'error')}).finally(function(){b.disabled=false;b.textContent='Conferma apertura'});
    };
  }).catch(function(e){cashDayToast('Impossibile leggere la cassa: '+e.message,'error')});
}
function cashDayOpenClosure(){
  cashDayRefresh(true).then(function(m){
    if(m.closed)return cashDayToast('La cassa di oggi risulta già chiusa.','error');
    if(!m.opened)return cashDayToast('Prima devi registrare l’apertura cassa.','error');
    var expected=cashDayExpectedCash(m),currentFund=cashDayOpeningCash(m),cashSales=cashDayMetricVal(m,'cash_total');
    cashDayOpenModal(cashDayHead('Chiusura cassa','Conta il contante e scegli quanto lasciare come fondo per la prossima apertura.')+
      '<div class="optykerCashDaySummary"><div class="optykerCashDayMetric"><span>Fondo iniziale</span><b>'+cashDayMoney(currentFund)+'</b></div><div class="optykerCashDayMetric"><span>Incassi contanti Optyker</span><b>'+cashDayMoney(cashSales)+'</b></div><div class="optykerCashDayMetric"><span>Contante previsto</span><b>'+cashDayMoney(expected)+'</b></div><div class="optykerCashDayMetric"><span>Pagamenti carta</span><b>'+cashDayMoney(cashDayMetricVal(m,'card_total'))+'</b></div></div>'+
      '<div class="optykerCashDayField"><label>Contante realmente contato</label><input id="optykerCashDayCounted" type="number" min="0" step="0.01" inputmode="decimal" value="'+expected.toFixed(2)+'"></div>'+
      '<div class="optykerCashDayField"><label>Fondo da lasciare per la prossima apertura</label><input id="optykerCashDayNextFund" type="number" min="0" step="0.01" inputmode="decimal" value="'+currentFund.toFixed(2)+'"><div class="optykerCashDayHint">Questo importo comparirà automaticamente nel pulsante Apertura cassa della giornata successiva.</div></div>'+
      '<div class="optykerCashDayCalc"><span>Contante da prelevare dal cassetto</span><strong id="optykerCashDayTake">'+cashDayMoney(Math.max(0,expected-currentFund))+'</strong></div>'+cashDayNotesField()+
      '<div class="optykerCashDayNotice"><b>Chiusura gestionale Optyker:</b> non esegue la chiusura fiscale Z e non invia comandi alla RCH.</div>'+
      '<div class="optykerCashDayActionsRow"><button class="optykerCashDayCancel" data-day-cancel type="button">Annulla</button><button class="optykerCashDayConfirm danger" id="optykerCashDayCloseConfirm" type="button">Conferma chiusura</button></div>');
    function calc(){var counted=cashDayNum(cashDayE('optykerCashDayCounted').value),fund=cashDayNum(cashDayE('optykerCashDayNextFund').value),take=(isFinite(counted)&&isFinite(fund))?counted-fund:NaN;cashDayE('optykerCashDayTake').textContent=isFinite(take)?cashDayMoney(Math.max(0,take)):'—'}
    cashDayE('optykerCashDayCounted').oninput=calc;cashDayE('optykerCashDayNextFund').oninput=calc;cashDayE('optykerCashDayCounted').focus();cashDayE('optykerCashDayCounted').select();
    cashDayE('optykerCashDayCloseConfirm').onclick=function(){
      var counted=cashDayNum(cashDayE('optykerCashDayCounted').value),fund=cashDayNum(cashDayE('optykerCashDayNextFund').value),notes=String(cashDayE('optykerCashDayNotes').value||'').trim();
      if(!isFinite(counted)||counted<0)return cashDayToast('Inserisci il contante contato.','error');
      if(!isFinite(fund)||fund<0)return cashDayToast('Inserisci un fondo valido per la prossima apertura.','error');
      if(fund>counted+0.005)return cashDayToast('Il fondo non può superare il contante contato.','error');
      var diff=Math.round((counted-expected)*100)/100;
      var confirmText='Chiudere la cassa con '+cashDayMoney(counted)+' contati e lasciare '+cashDayMoney(fund)+' come fondo per la prossima apertura?'+(Math.abs(diff)>=0.01?'\n\nDifferenza rispetto al previsto: '+cashDayMoney(diff):'');
      if(!window.confirm(confirmText))return;
      var b=this;b.disabled=true;b.textContent='Chiusura…';
      cashDayCall('close',{date:cashDayTodayRome(),cash_counted:counted,next_opening_cash:fund,notes:notes}).then(function(x){cashDayState.metrics=x.data||{};cashDayState.last=Date.now();cashDaySetButtons(cashDayState.metrics);cashDayCloseModal();cashDayToast('Cassa chiusa · fondo prossimo giorno '+cashDayMoney(fund),'ok')})
        .catch(function(e){cashDayToast('Chiusura non registrata: '+e.message,'error')}).finally(function(){b.disabled=false;b.textContent='Conferma chiusura'});
    };
  }).catch(function(e){cashDayToast('Impossibile leggere la cassa: '+e.message,'error')});
}
function cashDayInstall(){
  cashDayInjectStyle();
  var overlay=cashDayE('optykerCashOverlay'),right=overlay&&overlay.querySelector('.optykerCashHeaderRight');if(!overlay||!right)return;
  if(!cashDayE('optykerCashDayActions')){
    var box=document.createElement('div');box.id='optykerCashDayActions';
    box.innerHTML='<span id="optykerCashDayState" class="optykerCashDayState">Verifica cassa…</span><button id="optykerCashDayOpenBtn" class="optykerCashDayBtn open" type="button">Apertura cassa</button><button id="optykerCashDayCloseBtn" class="optykerCashDayBtn close" type="button">Chiusura cassa</button>';
    right.insertBefore(box,right.firstChild);
    cashDayE('optykerCashDayOpenBtn').onclick=cashDayOpenOpening;cashDayE('optykerCashDayCloseBtn').onclick=cashDayOpenClosure;
    cashDayRefresh(true).catch(function(){});
  }else if(Date.now()-cashDayState.last>30000){cashDayRefresh(false).catch(function(){})}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',cashDayInstall);else cashDayInstall();
new MutationObserver(function(){cashDayInstall()}).observe(document.documentElement,{childList:true,subtree:true});
setInterval(function(){if(cashDayE('optykerCashOverlay'))cashDayInstall()},5000);
})();

/* OPTYKER_CASH_DAY_CONTROL_V1 */
(function(){
'use strict';
if(window.__optykerCashDayControlV1)return;
window.__optykerCashDayControlV1='20260915-1';

var API='https://whgziwaegjzqsgcntesr.supabase.co/functions/v1/optyker-cash-day-api';
var state={metrics:null,loading:false,last:0};

function E(id){return document.getElementById(id)}
function money(v){var n=Number(v||0);if(!isFinite(n))n=0;try{return new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR'}).format(n)}catch(e){return n.toFixed(2)+' €'}}
function num(v){var n=Number(String(v==null?'':v).replace(',','.'));return isFinite(n)?Math.round(n*100)/100:NaN}
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function creds(){var c=window.OPTYKER_CLOUD||{};return {username:String(c.username||window.OPTYKER_ACTIVE_USER||'').trim(),password:String(c.password||'')}}
function todayRome(){
  var p=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()),o={};
  p.forEach(function(x){if(x.type!=='literal')o[x.type]=x.value});
  return o.year+'-'+o.month+'-'+o.day;
}
function call(action,payload){
  var c=creds();
  if(!c.username||!c.password)return Promise.reject(new Error('Sessione operatore non disponibile. Esci e accedi nuovamente.'));
  return fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:action,username:c.username,password:c.password,payload:payload||{}})})
    .then(function(r){return r.json().catch(function(){return {}}).then(function(x){if(!r.ok||!x||x.ok===false)throw new Error(x&&x.error||('HTTP '+r.status));return x})});
}
function toast(msg,type){
  var t=E('optykerCashDayToast');
  if(!t){t=document.createElement('div');t.id='optykerCashDayToast';document.body.appendChild(t)}
  t.className=type||'';t.textContent=msg;t.style.display='block';clearTimeout(t.__timer);t.__timer=setTimeout(function(){t.style.display='none'},4200);
}
function injectStyle(){
  if(E('optykerCashDayStyle'))return;
  var s=document.createElement('style');s.id='optykerCashDayStyle';s.textContent='\
#optykerCashDayActions{display:flex;align-items:center;gap:7px;margin-right:2px}.optykerCashDayBtn{height:36px;border:1px solid #c9d8e5;border-radius:9px;background:#fff;color:#173b5e;padding:0 11px;font:800 11px/1 "Segoe UI",Arial,sans-serif;cursor:pointer;white-space:nowrap;box-shadow:0 1px 3px rgba(20,48,72,.06)}.optykerCashDayBtn:hover:not(:disabled){border-color:#1769aa;background:#f3f9fd}.optykerCashDayBtn.open{background:#eaf7ef;border-color:#b8dfc5;color:#176b39}.optykerCashDayBtn.close{background:#fff1f0;border-color:#efc8c4;color:#a2352d}.optykerCashDayBtn:disabled{opacity:.45;cursor:not-allowed}.optykerCashDayState{height:28px;display:inline-flex;align-items:center;border-radius:999px;padding:0 9px;background:#eef4f8;color:#526a7d;font:800 9px/1 "Segoe UI",Arial,sans-serif;white-space:nowrap}.optykerCashDayState.open{background:#e8f6ed;color:#176b39}.optykerCashDayState.closed{background:#eef1f4;color:#4b5c6b}.optykerCashDayState.pending{background:#fff7df;color:#87640e}\
#optykerCashDayModal{position:fixed;inset:0;z-index:2147483644;background:rgba(10,28,45,.52);display:none;align-items:center;justify-content:center;padding:18px;box-sizing:border-box;backdrop-filter:blur(2px)}#optykerCashDayModal.open{display:flex}.optykerCashDayCard{width:min(560px,100%);max-height:92vh;overflow:auto;background:#fff;border:1px solid #dbe5ed;border-radius:18px;box-shadow:0 24px 70px rgba(11,35,58,.28);padding:22px;box-sizing:border-box}.optykerCashDayHead{display:flex;justify-content:space-between;gap:16px;align-items:flex-start}.optykerCashDayEyebrow{font-size:9px;font-weight:900;letter-spacing:.11em;color:#1769aa;text-transform:uppercase}.optykerCashDayTitle{font-size:23px;font-weight:950;color:#173b5e;margin-top:3px}.optykerCashDaySub{font-size:11px;line-height:1.45;color:#6c7f8f;margin-top:6px}.optykerCashDayX{width:34px;height:34px;border:0;border-radius:9px;background:#eef3f7;color:#486176;font-size:21px;cursor:pointer}.optykerCashDaySummary{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;margin:17px 0}.optykerCashDayMetric{border:1px solid #e0e8ef;border-radius:11px;background:#f8fbfd;padding:11px}.optykerCashDayMetric span{display:block;font-size:9px;font-weight:850;color:#748696;text-transform:uppercase;letter-spacing:.05em}.optykerCashDayMetric b{display:block;font-size:17px;color:#1d3d58;margin-top:4px}.optykerCashDayField{margin-top:13px}.optykerCashDayField label{display:block;font-size:11px;font-weight:850;color:#3f566a;margin-bottom:6px}.optykerCashDayField input,.optykerCashDayField textarea{width:100%;box-sizing:border-box;border:1px solid #cbd8e3;border-radius:10px;background:#fff;color:#173b5e;font:700 14px/1.2 "Segoe UI",Arial,sans-serif;padding:11px;outline:none}.optykerCashDayField input:focus,.optykerCashDayField textarea:focus{border-color:#1769aa;box-shadow:0 0 0 3px rgba(23,105,170,.11)}.optykerCashDayField textarea{min-height:72px;resize:vertical;font-size:12px;font-weight:600}.optykerCashDayHint{font-size:10px;color:#7b8c99;margin-top:5px;line-height:1.4}.optykerCashDayCalc{margin-top:13px;border-radius:10px;background:#eef7fd;border:1px solid #d1e6f5;padding:11px;display:flex;justify-content:space-between;gap:12px;align-items:center;font-size:11px;color:#4e6678}.optykerCashDayCalc strong{font-size:16px;color:#1769aa}.optykerCashDayNotice{margin-top:14px;border:1px solid #dde7ee;border-radius:10px;background:#f8fbfd;padding:10px;font-size:10px;line-height:1.45;color:#657989}.optykerCashDayActionsRow{display:flex;justify-content:flex-end;gap:9px;margin-top:18px}.optykerCashDayActionsRow button{height:40px;border:0;border-radius:10px;padding:0 15px;font:850 11px/1 "Segoe UI",Arial,sans-serif;cursor:pointer}.optykerCashDayCancel{background:#edf2f6;color:#425a70}.optykerCashDayConfirm{background:#1769aa;color:#fff;box-shadow:0 5px 14px rgba(23,105,170,.22)}.optykerCashDayConfirm.danger{background:#a84035}.optykerCashDayActionsRow button:disabled{opacity:.55;cursor:wait}#optykerCashDayToast{position:fixed;z-index:2147483647;right:20px;bottom:20px;max-width:min(440px,calc(100vw - 40px));display:none;background:#173b5e;color:#fff;border-radius:11px;padding:12px 15px;font:750 11px/1.4 "Segoe UI",Arial,sans-serif;box-shadow:0 14px 36px rgba(12,35,55,.25)}#optykerCashDayToast.ok{background:#176b39}#optykerCashDayToast.error{background:#a2352d}\
@media(max-width:1050px){#optykerCashDayActions{gap:4px}.optykerCashDayState{display:none}.optykerCashDayBtn{padding:0 8px;font-size:10px}}@media(max-width:760px){#optykerCashDayActions{order:5;width:100%;justify-content:flex-end;margin-top:6px}.optykerCashDaySummary{grid-template-columns:1fr}}';
  document.head.appendChild(s);
}
function ensureModal(){
  var m=E('optykerCashDayModal');if(m)return m;
  m=document.createElement('div');m.id='optykerCashDayModal';m.innerHTML='<div class="optykerCashDayCard" role="dialog" aria-modal="true"><div id="optykerCashDayModalBody"></div></div>';
  m.addEventListener('click',function(ev){if(ev.target===m)closeModal()});document.body.appendChild(m);return m;
}
function closeModal(){var m=E('optykerCashDayModal');if(m)m.classList.remove('open')}
function openModal(html){var m=ensureModal(),b=E('optykerCashDayModalBody');b.innerHTML=html;m.classList.add('open');var x=b.querySelector('[data-day-x]');if(x)x.onclick=closeModal;var c=b.querySelector('[data-day-cancel]');if(c)c.onclick=closeModal}
function metricVal(m,k){var n=Number(m&&m[k]||0);return isFinite(n)?n:0}
function openingCash(m){return metricVal(m&&m.opening,'opening_cash')}
function expectedCash(m){return Math.round((openingCash(m)+metricVal(m,'cash_total'))*100)/100}
function setButtons(m){
  var ob=E('optykerCashDayOpenBtn'),cb=E('optykerCashDayCloseBtn'),st=E('optykerCashDayState');if(!ob||!cb||!st)return;
  var opened=!!(m&&m.opened),closed=!!(m&&m.closed),suggest=metricVal(m,'suggested_opening_cash');
  ob.disabled=opened||closed||state.loading;cb.disabled=!opened||closed||state.loading;
  st.className='optykerCashDayState '+(closed?'closed':opened?'open':'pending');
  if(closed)st.textContent='Cassa chiusa';
  else if(opened)st.textContent='Aperta · fondo '+money(openingCash(m));
  else st.textContent='Da aprire · fondo '+money(suggest);
}
function refresh(force){
  if(state.loading)return Promise.resolve(state.metrics);
  if(!force&&state.metrics&&Date.now()-state.last<12000){setButtons(state.metrics);return Promise.resolve(state.metrics)}
  state.loading=true;setButtons(state.metrics);
  return call('status',{date:todayRome()}).then(function(x){state.metrics=x.data||{};state.last=Date.now();setButtons(state.metrics);return state.metrics})
    .catch(function(e){var st=E('optykerCashDayState');if(st){st.className='optykerCashDayState';st.textContent='Stato non disponibile'};throw e})
    .finally(function(){state.loading=false;setButtons(state.metrics)});
}
function head(title,sub){return '<div class="optykerCashDayHead"><div><div class="optykerCashDayEyebrow">Gestione giornata</div><div class="optykerCashDayTitle">'+esc(title)+'</div><div class="optykerCashDaySub">'+esc(sub)+'</div></div><button class="optykerCashDayX" data-day-x type="button" aria-label="Chiudi">×</button></div>'}
function notesField(){return '<div class="optykerCashDayField"><label>Note (facoltative)</label><textarea id="optykerCashDayNotes" maxlength="500" placeholder="Eventuali annotazioni sulla giornata…"></textarea></div>'}
function openOpening(){
  refresh(true).then(function(m){
    if(m.closed)return toast('La cassa di oggi risulta già chiusa.','error');
    if(m.opened)return toast('La cassa di oggi è già aperta.','error');
    var suggested=metricVal(m,'suggested_opening_cash');
    openModal(head('Apertura cassa','Inserisci il fondo presente nel cassetto. Il valore è già proposto dalla chiusura precedente.')+
      '<div class="optykerCashDaySummary"><div class="optykerCashDayMetric"><span>Fondo dalla chiusura precedente</span><b>'+money(suggested)+'</b></div><div class="optykerCashDayMetric"><span>Data</span><b>'+todayRome().split('-').reverse().join('/')+'</b></div></div>'+
      '<div class="optykerCashDayField"><label>Fondo cassa iniziale</label><input id="optykerCashDayOpening" type="number" min="0" step="0.01" inputmode="decimal" value="'+suggested.toFixed(2)+'"><div class="optykerCashDayHint">Puoi modificarlo se il contante realmente presente è diverso.</div></div>'+notesField()+
      '<div class="optykerCashDayNotice"><b>Nessun comando fiscale:</b> l’apertura registra solo il fondo in Optyker e non apre il cassetto RCH.</div>'+
      '<div class="optykerCashDayActionsRow"><button class="optykerCashDayCancel" data-day-cancel type="button">Annulla</button><button class="optykerCashDayConfirm" id="optykerCashDayOpenConfirm" type="button">Conferma apertura</button></div>');
    var input=E('optykerCashDayOpening');if(input){input.focus();input.select()}
    E('optykerCashDayOpenConfirm').onclick=function(){
      var amount=num(E('optykerCashDayOpening').value),notes=String(E('optykerCashDayNotes').value||'').trim();
      if(!isFinite(amount)||amount<0)return toast('Inserisci un fondo cassa valido.','error');
      var b=this;b.disabled=true;b.textContent='Apertura…';
      call('open',{date:todayRome(),opening_cash:amount,notes:notes}).then(function(x){state.metrics=x.data||{};state.last=Date.now();setButtons(state.metrics);closeModal();toast('Cassa aperta · fondo '+money(amount),'ok')})
        .catch(function(e){toast('Apertura non registrata: '+e.message,'error')}).finally(function(){b.disabled=false;b.textContent='Conferma apertura'});
    };
  }).catch(function(e){toast('Impossibile leggere la cassa: '+e.message,'error')});
}
function openClosure(){
  refresh(true).then(function(m){
    if(m.closed)return toast('La cassa di oggi risulta già chiusa.','error');
    if(!m.opened)return toast('Prima devi registrare l’apertura cassa.','error');
    var expected=expectedCash(m),currentFund=openingCash(m),cashSales=metricVal(m,'cash_total');
    openModal(head('Chiusura cassa','Conta il contante e scegli quanto lasciare come fondo per la prossima apertura.')+
      '<div class="optykerCashDaySummary"><div class="optykerCashDayMetric"><span>Fondo iniziale</span><b>'+money(currentFund)+'</b></div><div class="optykerCashDayMetric"><span>Incassi contanti Optyker</span><b>'+money(cashSales)+'</b></div><div class="optykerCashDayMetric"><span>Contante previsto</span><b>'+money(expected)+'</b></div><div class="optykerCashDayMetric"><span>Pagamenti carta</span><b>'+money(metricVal(m,'card_total'))+'</b></div></div>'+
      '<div class="optykerCashDayField"><label>Contante realmente contato</label><input id="optykerCashDayCounted" type="number" min="0" step="0.01" inputmode="decimal" value="'+expected.toFixed(2)+'"></div>'+
      '<div class="optykerCashDayField"><label>Fondo da lasciare per la prossima apertura</label><input id="optykerCashDayNextFund" type="number" min="0" step="0.01" inputmode="decimal" value="'+currentFund.toFixed(2)+'"><div class="optykerCashDayHint">Questo importo comparirà automaticamente nel pulsante Apertura cassa della giornata successiva.</div></div>'+
      '<div class="optykerCashDayCalc"><span>Contante da prelevare dal cassetto</span><strong id="optykerCashDayTake">'+money(Math.max(0,expected-currentFund))+'</strong></div>'+notesField()+
      '<div class="optykerCashDayNotice"><b>Chiusura gestionale Optyker:</b> non esegue la chiusura fiscale Z e non invia comandi alla RCH.</div>'+
      '<div class="optykerCashDayActionsRow"><button class="optykerCashDayCancel" data-day-cancel type="button">Annulla</button><button class="optykerCashDayConfirm danger" id="optykerCashDayCloseConfirm" type="button">Conferma chiusura</button></div>');
    function calc(){var counted=num(E('optykerCashDayCounted').value),fund=num(E('optykerCashDayNextFund').value),take=(isFinite(counted)&&isFinite(fund))?counted-fund:NaN;E('optykerCashDayTake').textContent=isFinite(take)?money(Math.max(0,take)):'—'}
    E('optykerCashDayCounted').oninput=calc;E('optykerCashDayNextFund').oninput=calc;E('optykerCashDayCounted').focus();E('optykerCashDayCounted').select();
    E('optykerCashDayCloseConfirm').onclick=function(){
      var counted=num(E('optykerCashDayCounted').value),fund=num(E('optykerCashDayNextFund').value),notes=String(E('optykerCashDayNotes').value||'').trim();
      if(!isFinite(counted)||counted<0)return toast('Inserisci il contante contato.','error');
      if(!isFinite(fund)||fund<0)return toast('Inserisci un fondo valido per la prossima apertura.','error');
      if(fund>counted+0.005)return toast('Il fondo non può superare il contante contato.','error');
      var diff=Math.round((counted-expected)*100)/100;
      var confirmText='Chiudere la cassa con '+money(counted)+' contati e lasciare '+money(fund)+' come fondo per la prossima apertura?'+(Math.abs(diff)>=0.01?'\n\nDifferenza rispetto al previsto: '+money(diff):'');
      if(!window.confirm(confirmText))return;
      var b=this;b.disabled=true;b.textContent='Chiusura…';
      call('close',{date:todayRome(),cash_counted:counted,next_opening_cash:fund,notes:notes}).then(function(x){state.metrics=x.data||{};state.last=Date.now();setButtons(state.metrics);closeModal();toast('Cassa chiusa · fondo prossimo giorno '+money(fund),'ok')})
        .catch(function(e){toast('Chiusura non registrata: '+e.message,'error')}).finally(function(){b.disabled=false;b.textContent='Conferma chiusura'});
    };
  }).catch(function(e){toast('Impossibile leggere la cassa: '+e.message,'error')});
}
function install(){
  injectStyle();
  var overlay=E('optykerCashOverlay'),right=overlay&&overlay.querySelector('.optykerCashHeaderRight');if(!overlay||!right)return;
  if(!E('optykerCashDayActions')){
    var box=document.createElement('div');box.id='optykerCashDayActions';
    box.innerHTML='<span id="optykerCashDayState" class="optykerCashDayState">Verifica cassa…</span><button id="optykerCashDayOpenBtn" class="optykerCashDayBtn open" type="button">Apertura cassa</button><button id="optykerCashDayCloseBtn" class="optykerCashDayBtn close" type="button">Chiusura cassa</button>';
    right.insertBefore(box,right.firstChild);
    E('optykerCashDayOpenBtn').onclick=openOpening;E('optykerCashDayCloseBtn').onclick=openClosure;
    refresh(true).catch(function(){});
  }else if(Date.now()-state.last>30000){refresh(false).catch(function(){})}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
new MutationObserver(function(){install()}).observe(document.documentElement,{childList:true,subtree:true});
setInterval(function(){if(E('optykerCashOverlay'))install()},5000);
})();

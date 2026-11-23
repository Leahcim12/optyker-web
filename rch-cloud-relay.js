/* OPTYKER_RCH_REG_UI_20260919 */
window.OPTYKER_RCH_REG_UI_VERSION="20260919-regui1";
(function(){
'use strict';
if(window.__OPTYKER_RCH_CLOUD_RELAY__)return;window.__OPTYKER_RCH_CLOUD_RELAY__=true;
var LOCAL='http://127.0.0.1:8765',RELAY='https://whgziwaegjzqsgcntesr.supabase.co/functions/v1/optyker-rch-relay-api',FISCAL='https://whgziwaegjzqsgcntesr.supabase.co/functions/v1/optyker-fiscal-api',VERSION='1.8-auto-receipt',MANUAL_REG_WORKER='2.1-manual-reg';
function creds(){var c=window.OPTYKER_CLOUD||{};return {username:String(c.username||window.OPTYKER_ACTIVE_USER||'').trim(),password:String(c.password||'')}}
function post(url,body,timeout){var ctl=new AbortController(),t=setTimeout(function(){ctl.abort()},timeout||10000);return fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),cache:'no-store',signal:ctl.signal}).then(function(r){return r.json().catch(function(){return {}}).then(function(x){if(!r.ok||x.ok!==true)throw new Error(x.error||('HTTP '+r.status));return x})}).finally(function(){clearTimeout(t)})}
function relay(action,payload){var c=creds();if(!c.username||!c.password)return Promise.reject(new Error('Sessione Optyker non disponibile.'));return post(RELAY,{action:action,username:c.username,password:c.password,payload:payload||{}},12000)}
function fiscal(action,payload){var c=creds();if(!c.username||!c.password)return Promise.reject(new Error('Sessione Optyker non disponibile.'));return post(FISCAL,{action:action,username:c.username,password:c.password,payload:payload||{}},15000)}
function local(path,payload,timeout){var ctl=new AbortController(),t=setTimeout(function(){ctl.abort()},timeout||1400);return fetch(LOCAL+path,{method:payload?'POST':'GET',headers:payload?{'Content-Type':'application/json'}:{},body:payload?JSON.stringify(payload):undefined,cache:'no-store',signal:ctl.signal}).then(function(r){return r.json().then(function(x){if(!r.ok||x.ok!==true)throw new Error(x.error||'Connettore locale non disponibile');return x})}).finally(function(){clearTimeout(t)})}
function delay(ms){return new Promise(function(r){setTimeout(r,ms)})}
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function euro(v){try{return new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR'}).format(Number(v||0))}catch(e){return Number(v||0).toFixed(2)+' €'}}
function modal(title){
 var old=document.getElementById('optykerRchCloudModal');if(old)old.remove();
 var m=document.createElement('div');m.id='optykerRchCloudModal';m.className='optykerCashModal open';
 m.setAttribute('role','dialog');m.setAttribute('aria-modal','true');m.setAttribute('aria-hidden','false');
 m.style.setProperty('z-index','2147483600','important');m.style.setProperty('pointer-events','auto','important');
 m.innerHTML='<div class="optykerCashModalCard" style="max-width:720px;pointer-events:auto"><div class="optykerCashModalTitle">'+esc(title)+'</div><div class="orcBody">Caricamento…</div><p class="orcMsg" role="status" aria-live="polite"></p><button class="optykerCashModalClose" type="button">Chiudi</button></div>';
 document.body.appendChild(m);m.querySelector('.optykerCashModalClose').onclick=function(){m.remove()};return m;
}
function msg(m,s){var x=m&&m.querySelector('.orcMsg');if(x)x.textContent=s||''}
function regMode(s){return /^REG(?:\s*\(OP\s*\d+\))?$/.test(String(s&&s.mode||''))}
function zeroFlag(v){return v===0||v==='0'}
function readyFlags(s){return !!(s&&s.ok===true&&zeroFlag(s.idleState)&&['busy','errorCode','printerError','paperEnd','coverOpen'].every(function(k){return zeroFlag(s[k])}))}
function safeZIdle(s){return readyFlags(s)&&String(s.mode||'')==='Z'}
function safeRegIdle(s){return readyFlags(s)&&regMode(s)}
function regBlockReason(d){
 var s=d&&d.status||{};
 if(!d||!d.online)return 'PC cassa non collegato: nessun comando inviato.';
 if(s.busy===1||s.busy==='1')return 'La RCH risponde occupata (busy 1). La modalità non è verificabile finché il registratore non torna disponibile. Nessun cambio di modalità viene forzato.';
 if(!zeroFlag(s.paperEnd))return 'Stato carta non regolare o non disponibile: controlla la RCH.';
 if(!zeroFlag(s.coverOpen))return 'Coperchio aperto o stato non disponibile: controlla la RCH.';
 if(!zeroFlag(s.errorCode)||!zeroFlag(s.printerError))return s.error||'La RCH segnala un errore o una risposta incompleta.';
 if(!zeroFlag(s.idleState))return 'La RCH non conferma lo stato inattivo. Verifica il display e gli eventuali documenti aperti senza ripetere il pagamento.';
 if(!s.mode||s.ok!==true)return s.error||'Modalità RCH non confermata: aggiorna lo stato.';
 if(!manualRegWorkerReady(d))return 'Il collegamento del PC non supporta il ritorno manuale in REG: aggiorna il connettore sul PC cassa.';
 return 'Il ritorno manuale è consentito solo da Z, a registratore inattivo e senza errori.';
}
var manualRegPending=null;
function manualRegWorkerReady(d){return /^(?:2\.1-manual-reg|2\.2-daily-closure)$/.test(String(d&&d.connector_version||''))}
/* OPTYKER_RCH_LATENCY_20260922: cache capability discovery only, never printer readiness. */
var localDiscovery={until:0,value:false,inflight:null};
function localAvailable(){
 if(localDiscovery.inflight)return localDiscovery.inflight;
 if(Date.now()<localDiscovery.until)return Promise.resolve(localDiscovery.value);
 var p=local('/health',null,900).then(function(h){return !!(h&&h.ok===true&&h.version===VERSION)},function(){return false}).then(function(available){
  localDiscovery.value=available;localDiscovery.until=Date.now()+10000;return available;
 }).finally(function(){if(localDiscovery.inflight===p)localDiscovery.inflight=null});
 localDiscovery.inflight=p;return p;
}
async function cloudConnection(){var x=await relay('status',{}),d=x.data||{};if(!d.online)throw new Error('PC cassa non collegato al Cloud Relay. Sul PC Windows apri Cassa → RCH → Installa / aggiorna connettore.');return d}
async function cloudReady(){var d=await cloudConnection(),s=d.status||{};if(s.ok!==true||!regMode(s)||String(s.idleState)!=='0'||['busy','errorCode','printerError','paperEnd','coverOpen'].some(function(k){return Number(s[k])!==0}))throw new Error('La RCH collegata al PC cassa non risulta pronta in REG. Controlla carta, coperchio e modalità REG.');return true}
async function commandWait(id,maxMs){var end=Date.now()+(maxMs||30000),last;while(Date.now()<end){var x=await relay('command_status',{command_id:id});last=x.data;if(last.state==='completed')return last;if(last.state==='failed'||last.state==='expired')throw new Error(last.error||'Comando RCH non eseguito');await delay(900)}throw new Error('Il PC cassa non ha completato il comando. Verifica che Windows e il Cloud Relay siano attivi.')}
async function queueFiscal(jobId,token,operation,maxMs){
 var q=await relay('queue_fiscal',{job_id:jobId,token:token,operation:operation||'sale'}),command=q.data,end=Date.now()+(maxMs||155000);
 while(Date.now()<end){
  // Read both states in one round; only the fiscal job can confirm the receipt.
  var jobRead=fiscal('job',{job_id:jobId});
  var commandRead=relay('command_status',{command_id:command.id}).then(function(x){return {value:x}},function(e){return {error:e}});
  var jr=await jobRead,lastJob=jr.data&&jr.data.job;
  if(lastJob&&['not_started','uncertain','awaiting_reference','completed'].indexOf(lastJob.state)>=0)return lastJob;
  var cr=await commandRead,cs=cr.value&&cr.value.data;
  if(cs&&['failed','expired'].indexOf(cs.state)>=0)throw new Error(cs.error||'Il PC cassa non ha eseguito lo scontrino.');
  if(cr.error)throw cr.error;
  await delay(1000);
 }
 throw new Error('Emissione ancora in corso. Non ripetere la vendita: verifica lo scontrino e usa Aggiorna esito.');
}
async function queueAux(kind){await cloudReady();var q=await relay('queue_aux',{kind:kind});return commandWait(q.data.id,20000)}
async function restoreRegManual(){
 var d=await cloudConnection(),s=d.status||{};updateBadge(d);
 if(safeRegIdle(s)){manualRegPending=null;return {alreadyReg:true,status:s}}
 if(manualRegPending&&!manualRegPending.id){
   if(Date.now()-manualRegPending.at<125000)throw new Error('Invio precedente con esito non confermato. Attendi e aggiorna lo stato; il comando non viene duplicato.');
   manualRegPending=null;
 }
 if(!manualRegPending){
   if(!manualRegWorkerReady(d)||!safeZIdle(s))throw new Error(regBlockReason(d));
   manualRegPending={id:null,at:Date.now()};
   var q=await relay('queue_aux',{kind:'restore_reg'});
   if(!q.data||!q.data.id)throw new Error('Ricezione del comando non confermata. Aggiorna lo stato prima di riprovare.');
   manualRegPending.id=q.data.id;
 }
 var end=Date.now()+35000,done=null;
 while(Date.now()<end){
   var x=await relay('command_status',{command_id:manualRegPending.id}),c=x.data||{};
   if(c.state==='failed'||c.state==='expired'){manualRegPending=null;throw new Error(c.error||'Il PC non ha confermato il ritorno in REG.')}
   if(c.state==='completed'){done=c;break}
   await delay(900);
 }
 if(!done)throw new Error('Comando inviato al PC, esito ancora non confermato. Aggiorna lo stato: non viene inviato un secondo comando.');
 if(!done.result||done.result.ok!==true||!regMode(done.result))throw new Error('Il PC non ha restituito una conferma REG valida. Nessun esito viene simulato.');
 for(var i=0;i<8;i++){
   var after=await cloudConnection();updateBadge(after);
   if(safeRegIdle(after.status)){manualRegPending=null;return {alreadyReg:false,status:after.status}}
   await delay(1200);
 }
 throw new Error('Il comando è terminato ma manca uno stato REG pronto aggiornato. Usa Aggiorna stato, senza ripetere il pagamento.');
}
/* OPTYKER_RCH_REG_CLICK_FIX_V1 */
var manualRegBusy=false;
async function runManualRegClick(ev,b){
 if(ev){ev.preventDefault();ev.stopPropagation();if(ev.stopImmediatePropagation)ev.stopImmediatePropagation()}
 if(manualRegBusy)return false;manualRegBusy=true;
 var oldText=b&&b.textContent;if(b){b.disabled=true;b.textContent='Verifica RCH…'}
 var m=modal('RCH · ritorno in REG');m.querySelector('.orcBody').textContent='Verifica dello stato reale e del collegamento al PC cassa…';
 try{
   var r=await restoreRegManual();
   m.querySelector('.orcBody').innerHTML='<p><b>'+(r.alreadyReg?'La RCH è già pronta in REG.':'La RCH ha confermato il ritorno in REG.')+'</b></p><p>Nessuno scontrino o chiusura giornaliera è stato eseguito da questo comando.</p>';
   msg(m,'Modalità rilevata: '+String(r.status.mode));
 }catch(e){
   m.querySelector('.orcBody').innerHTML='<p><b>Ritorno in REG non confermato.</b></p>';
   msg(m,(e&&e.message)||String(e));
 }finally{
   manualRegBusy=false;if(b&&b.isConnected){b.disabled=false;b.textContent=oldText||'Porta RCH in REG'}
   var refresh=document.createElement('button');refresh.type='button';refresh.id='orcRefreshStatus';refresh.textContent='Aggiorna stato';refresh.onclick=showCloudStatus;
   m.querySelector('.orcBody').appendChild(refresh);
   cloudConnection().then(updateBadge).catch(function(){updateBadge(null)});
 }
 return false;
}
function ensureRegButton(){
  var badge=document.getElementById('optykerCashRch');if(!badge)return null;
  var b=document.getElementById('optykerRchRegBtn');
  if(!b){
    b=document.createElement('button');b.id='optykerRchRegBtn';b.type='button';b.className='secondary';b.textContent='Porta RCH in REG';b.style.marginLeft='8px';
    if(badge.parentNode)badge.parentNode.insertBefore(b,badge.nextSibling)
  }
  b.disabled=manualRegBusy;
  b.style.setProperty('pointer-events','auto','important');
  b.style.setProperty('cursor','pointer','important');
  b.title='Clicca per verificare e, solo se sicuro, riportare la RCH in REG';
  b.onclick=function(ev){return runManualRegClick(ev,b)};
  return b;
}
function updateBadge(d){
 var b=document.getElementById('optykerCashRch'),r=ensureRegButton();if(!b)return;
 var st=d&&d.status||{},ready=!!(d&&d.online&&safeRegIdle(st)),label;
 if(d&&d.online)label=ready?'● RCH · REG':(st.busy===1||st.busy==='1')?'○ RCH · occupata':('○ RCH · '+(st.mode||'stato non confermato'));
 else label='○ RCH · PC non collegato';
 if(b.textContent!==label)b.textContent=label;
 if(b.classList.contains('ok')!==ready)b.classList.toggle('ok',ready);
 if(b.classList.contains('error')===ready)b.classList.toggle('error',!ready);
 b.title=ready?'RCH pronta in REG · clicca per i dettagli':regBlockReason(d);
 if(r){r.disabled=manualRegBusy;r.dataset.rchAllowed=d&&d.online&&safeZIdle(st)?'1':'0';r.title='Verifica lo stato e richiedi il ritorno in REG, senza stampa o chiusura';}
}
if(!window.__OPTYKER_RCH_REG_CLICK_CAPTURE__){
  window.__OPTYKER_RCH_REG_CLICK_CAPTURE__=true;
  document.addEventListener('click',function(ev){
    var t=ev.target,b=t&&t.closest?t.closest('#optykerRchRegBtn'):null;if(!b)return;
    ev.preventDefault();ev.stopPropagation();if(ev.stopImmediatePropagation)ev.stopImmediatePropagation();
    runManualRegClick(null,b);
  },true)
}
async function showCloudStatus(){
 var m=modal('RCH · stato reale del registratore'),body=m.querySelector('.orcBody');
 try{
   var x=await relay('status',{}),d=x.data||{},s=d.status||{};
   var ready=!!(d.online&&safeRegIdle(s)),can=!!(d.online&&safeZIdle(s)&&manualRegWorkerReady(d));
   var mode=s.mode||'Non verificabile',detail=ready?'La RCH è pronta per la registrazione.':can?'La RCH è in Z. Premi Porta RCH in REG per richiedere il cambio reale di modalità.':regBlockReason(d);
   body.innerHTML='<div class="optykerCashRchInfo"><div><span>PC cassa</span><b>'+ (d.online?'Collegato':'Non collegato')+'</b></div><div><span>Modalità RCH</span><b>'+esc(mode)+'</b></div><div><span>Stato occupata</span><b>'+esc(s.busy===undefined?'Non disponibile':String(s.busy))+'</b></div><div><span>Connettore</span><b>'+esc(d.connector_version||'Non disponibile')+'</b></div></div><p>'+esc(detail)+'</p><p><button type="button" class="primary" id="orcRestoreReg">Porta RCH in REG</button> <button type="button" id="orcRefreshStatus">Aggiorna stato</button></p><p>Questo comando non esegue la chiusura Z, non stampa scontrini e non ripete vendite.</p>';
   var rb=m.querySelector('#orcRestoreReg');rb.disabled=manualRegBusy||(!can&&!ready&&!manualRegPending);rb.onclick=function(ev){runManualRegClick(ev,rb)};
   m.querySelector('#orcRefreshStatus').onclick=showCloudStatus;
   msg(m,d.last_seen_at?'Ultimo contatto PC: '+new Date(d.last_seen_at).toLocaleString('it-IT'):'Nessun contatto PC disponibile');
   updateBadge(d);
 }catch(e){
   body.innerHTML='<p><b>Non è stato possibile verificare lo stato RCH.</b></p><button type="button" id="orcRefreshStatus">Riprova verifica</button>';
   m.querySelector('#orcRefreshStatus').onclick=showCloudStatus;msg(m,e.message||String(e));updateBadge(null);
 }
}
/* Capture before inherited onclick handlers: status must also open on Windows. */
if(!window.__OPTYKER_RCH_STATUS_CAPTURE_20260919__){
 window.__OPTYKER_RCH_STATUS_CAPTURE_20260919__=true;
 window.addEventListener('click',function(ev){
   var t=ev.target,b=t&&t.closest?t.closest('#optykerCashRch,#optykerRchRegBtn,#orcRestoreReg'):null;
   if(!b||b.disabled)return;
   ev.preventDefault();ev.stopPropagation();ev.stopImmediatePropagation();
   if(b.id==='optykerCashRch')showCloudStatus();else runManualRegClick(null,b);
 },true);
}
function installCashButtons(){var badge=document.getElementById('optykerCashRch'),drawer=document.getElementById('optykerCashDrawer'),gift=document.getElementById('optykerCashGiftBtn');ensureRegButton();if(badge&&!badge.dataset.cloudRelay){var old=badge.onclick;badge.dataset.cloudRelay='1';badge.onclick=async function(ev){if(ev){ev.preventDefault();ev.stopPropagation()}if(await localAvailable()){if(old)return old.call(this,ev)}return showCloudStatus()}}
 if(drawer&&!drawer.dataset.cloudRelay){var oldDrawer=drawer.onclick;drawer.dataset.cloudRelay='1';drawer.onclick=async function(ev){if(await localAvailable()){if(oldDrawer)return oldDrawer.call(this,ev)}this.disabled=true;try{await queueAux('drawer');alert('Cassetto contanti aperto dalla RCH tramite il PC cassa.')}catch(e){alert(e.message)}finally{this.disabled=false}}}
 if(gift&&!gift.dataset.cloudRelay){var oldGift=gift.onclick;gift.dataset.cloudRelay='1';gift.onclick=async function(ev){if(await localAvailable()){if(oldGift)return oldGift.call(this,ev)}if(!confirm("Stampare lo scontrino di cortesia dell'ultimo documento dalla RCH del negozio?"))return;this.disabled=true;try{await queueAux('gift_receipt');alert('Scontrino di cortesia inviato alla RCH tramite PC cassa.')}catch(e){alert(e.message)}finally{this.disabled=false}}}
 if(badge&&!badge.dataset.cloudProbe){badge.dataset.cloudProbe='1';localAvailable();cloudConnection().then(updateBadge).catch(function(){updateBadge(null)})}}
function wrapFiscal(){var old=window.OPTYKER_FISCAL;if(!old||old.__cloudRelay)return;async function checkReady(){if(await localAvailable())return old.checkReady();return cloudReady()}
 var activeReceiptPayments=new Map();
 function issuePayment(saleId,paymentId){
  var paymentKey=String(paymentId||'');
  if(activeReceiptPayments.has(paymentKey))return activeReceiptPayments.get(paymentKey);
  var p=issuePaymentOnce(saleId,paymentId).finally(function(){if(activeReceiptPayments.get(paymentKey)===p)activeReceiptPayments.delete(paymentKey)});
  activeReceiptPayments.set(paymentKey,p);return p;
 }
 async function issuePaymentOnce(saleId,paymentId){
  if(await localAvailable())return old.issuePayment(saleId,paymentId);
  var m=modal('Stampa scontrino RCH · PC cassa'),close=m.querySelector('.optykerCashModalClose');
  close.disabled=true;
  m.querySelector('.orcBody').innerHTML='<p>Preparazione dello scontrino e verifica del PC cassa…</p><p>Il pagamento è già registrato: non ripetere l’incasso.</p>';
  try{
   // Prepare only an immutable, already-recorded payment; this is not printing.
   // Both a fresh readiness check and prepare must succeed before the ONE enqueue.
   var values=await Promise.all([cloudReady(),fiscal('prepare',{payment_id:paymentId,automatic:true})]);
   var p=values[1],job=p.data.job;
   if(p.data.claim_token){
    msg(m,'Documento inviato al PC cassa. Attendo la conferma RCH…');
    job=await queueFiscal(job.id,p.data.claim_token,'sale',155000);
   }
   var labels={completed:'Scontrino stampato e registrato.',awaiting_reference:'Scontrino emesso: riferimento da verificare.',not_started:'Nessun comando fiscale inviato.',cancelled:'Tentativo archiviato: nessuna nuova stampa.',uncertain:'Esito da verificare sulla RCH.',sending:'Emissione in corso: usa Aggiorna esito senza ripetere la vendita.',prepared:'Documento preparato: stampa non confermata.'};
   m.querySelector('.orcBody').innerHTML='<p><b>'+esc(labels[job.state]||'Esito da verificare sulla RCH.')+'</b></p><p>Stato: '+esc(job.state)+'</p>';
   msg(m,'');return job;
  }catch(e){msg(m,e.message);throw e}finally{close.disabled=false}
 }
 async function openSale(saleId){if(await localAvailable())return old.openSale(saleId);var m=modal('Emissione RCH · iPad');try{var r=await fiscal('sale',{sale_id:saleId}),d=r.data,pays=(d.payments||[]).filter(function(p){return !p.invoice_requested&&!p.billing_invoice_id&&Number(p.amount)>0}),auto=pays.filter(function(p){return p.automatic_receipt});if(!auto.length&&!(d.jobs||[]).some(function(j){return j.state==='completed'})){m.querySelector('.orcBody').innerHTML='<p>Questa vendita richiede la revisione manuale delle righe fiscali. Per sicurezza, eseguila dal PC della cassa.</p>';return}m.querySelector('.orcBody').innerHTML='<p>Pagamenti pronti per emissione automatica tramite PC cassa:</p>'+auto.map(function(p){return '<button type="button" data-pay="'+esc(p.id)+'">Emetti '+esc(euro(p.amount))+' · '+esc(p.payment_stage)+'</button>'}).join(' ')+(d.jobs||[]).filter(function(j){return j.state==='completed'}).map(function(j){return '<button type="button" data-void="'+esc(j.id)+'">Annulla '+esc(j.document_number)+' — TS + RCH</button>'}).join(' ');m.querySelectorAll('[data-void]').forEach(function(b){b.onclick=function(){if(window.OPTYKER_UNIFIED_VOID)window.OPTYKER_UNIFIED_VOID.open(b.dataset.void)}});m.querySelectorAll('[data-pay]').forEach(function(b){b.onclick=async function(){this.disabled=true;try{await issuePayment(saleId,this.dataset.pay);m.remove()}catch(e){msg(m,e.message);this.disabled=false}}})}catch(e){msg(m,e.message)}}
 window.OPTYKER_FISCAL=Object.freeze({openSale:openSale,openTs:old.openTs,checkReady:checkReady,issuePayment:issuePayment,__cloudRelay:true})}
var observer=new MutationObserver(function(){installCashButtons();wrapFiscal()});observer.observe(document.documentElement,{childList:true,subtree:true});
function boot(){wrapFiscal();installCashButtons();setTimeout(function(){wrapFiscal();installCashButtons()},700)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();

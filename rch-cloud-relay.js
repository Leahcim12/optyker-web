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
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]})}
function euro(v){try{return new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR'}).format(Number(v||0))}catch(e){return Number(v||0).toFixed(2)+' €'}}
function modal(title){var old=document.getElementById('optykerRchCloudModal');if(old)old.remove();var m=document.createElement('div');m.id='optykerRchCloudModal';m.className='optykerCashModal open';m.setAttribute('role','dialog');m.setAttribute('aria-modal','true');m.innerHTML='<div class="optykerCashModalCard" style="max-width:720px"><div class="optykerCashModalTitle">'+esc(title)+'</div><div class="orcBody">Caricamento…</div><p class="orcMsg" role="status" aria-live="polite"></p><button class="optykerCashModalClose" type="button">Chiudi</button></div>';document.body.appendChild(m);m.querySelector('.optykerCashModalClose').onclick=function(){m.remove()};return m}
function msg(m,s){var x=m&&m.querySelector('.orcMsg');if(x)x.textContent=s||''}
function regMode(s){return /^REG(?:\s*\(OP\s*\d+\))?$/.test(String(s&&s.mode||''))}
function safeZIdle(s){return !!(s&&s.ok===true&&String(s.mode||'')==='Z'&&String(s.idleState)==='0'&&['busy','errorCode','printerError','paperEnd','coverOpen'].every(function(k){return Number(s[k])===0}))}
function manualRegWorkerReady(d){return String(d&&d.connector_version||'')===MANUAL_REG_WORKER}
async function localAvailable(){try{var h=await local('/health',null,900);return h&&h.ok===true&&h.version===VERSION}catch(e){return false}}
async function cloudConnection(){var x=await relay('status',{}),d=x.data||{};if(!d.online)throw new Error('PC cassa non collegato al Cloud Relay. Sul PC Windows apri Cassa → RCH → Installa / aggiorna connettore.');return d}
async function cloudReady(){var d=await cloudConnection(),s=d.status||{};if(s.ok!==true||!regMode(s)||String(s.idleState)!=='0'||['busy','errorCode','printerError','paperEnd','coverOpen'].some(function(k){return Number(s[k])!==0}))throw new Error('La RCH collegata al PC cassa non risulta pronta in REG. Controlla carta, coperchio e modalità REG.');return true}
async function commandWait(id,maxMs){var end=Date.now()+(maxMs||30000),last;while(Date.now()<end){var x=await relay('command_status',{command_id:id});last=x.data;if(last.state==='completed')return last;if(last.state==='failed'||last.state==='expired')throw new Error(last.error||'Comando RCH non eseguito');await delay(900)}throw new Error('Il PC cassa non ha completato il comando. Verifica che Windows e il Cloud Relay siano attivi.')}
async function queueFiscal(jobId,token,operation,maxMs){var q=await relay('queue_fiscal',{job_id:jobId,token:token,operation:operation||'sale'}),command=q.data,end=Date.now()+(maxMs||155000),lastJob=null;while(Date.now()<end){var j=await fiscal('job',{job_id:jobId});lastJob=j.data&&j.data.job;if(lastJob&&['not_started','uncertain','awaiting_reference','completed'].indexOf(lastJob.state)>=0)return lastJob;var cs=await relay('command_status',{command_id:command.id});if(cs.data&&['failed','expired'].indexOf(cs.data.state)>=0)throw new Error(cs.data.error||'Il PC cassa non ha eseguito lo scontrino.');await delay(1000)}throw new Error('Emissione ancora in corso. Non ripetere la vendita: verifica lo scontrino e usa Aggiorna esito.')}
async function queueAux(kind){await cloudReady();var q=await relay('queue_aux',{kind:kind});return commandWait(q.data.id,20000)}
async function restoreRegManual(){var d=await cloudConnection(),s=d.status||{};if(regMode(s)&&String(s.idleState)==='0')return {alreadyReg:true,status:s};if(!manualRegWorkerReady(d))throw new Error('Prima aggiorna una sola volta il collegamento RCH sul PC cassa. Poi questo pulsante funzionerà direttamente da Optyker.');if(!safeZIdle(s))throw new Error('Il comando manuale è consentito solo quando la RCH è in Z, inattiva e senza errori.');var q=await relay('queue_aux',{kind:'restore_reg'}),done=await commandWait(q.data.id,20000),result=done&&done.result||{};if(result.ok===false)throw new Error(result.error||'Ritorno in REG non confermato.');await delay(1800);var after=await cloudConnection();updateBadge(after);if(!regMode(after.status||{}))throw new Error('Il PC ha eseguito il comando ma lo stato REG non è ancora confermato.');return {alreadyReg:false,status:after.status||{}}}
/* OPTYKER_RCH_REG_CLICK_FIX_V1 */
var manualRegBusy=false;
async function runManualRegClick(ev,b){
  if(ev){ev.preventDefault();ev.stopPropagation();if(ev.stopImmediatePropagation)ev.stopImmediatePropagation()}
  if(manualRegBusy)return false;
  manualRegBusy=true;
  var oldText=(b&&b.textContent)||'Porta RCH in REG';
  if(b){b.disabled=true;b.textContent='Verifica RCH…'}
  var m=modal('RCH · ritorno manuale in REG');
  m.querySelector('.orcBody').innerHTML='<p>Verifica collegamento e stato della RCH…</p>';
  msg(m,'');
  try{
    var d=await cloudConnection(),st=d.status||{};
    if(regMode(st)&&String(st.idleState)==='0'){
      m.querySelector('.orcBody').innerHTML='<p><b>La RCH è già in REG.</b></p>';
      msg(m,'Nessun comando necessario.');
      return false;
    }
    if(!manualRegWorkerReady(d))throw new Error('Il collegamento RCH del PC cassa non è aggiornato alla modalità manuale REG.');
    if(!safeZIdle(st))throw new Error('Comando bloccato: la RCH deve essere in Z, inattiva e senza errori.');
    m.querySelector('.orcBody').innerHTML='<p><b>RCH in Z, inattiva e senza errori.</b></p><p>Invio del comando manuale di ritorno in REG…</p>';
    msg(m,'Invio comando al PC cassa…');
    if(b)b.textContent='Passaggio a REG…';
    var r=await restoreRegManual();
    m.querySelector('.orcBody').innerHTML='<p><b>'+(r.alreadyReg?'La RCH era già in REG.':'RCH riportata in REG.')+'</b></p><p>Nessuna chiusura Z è stata eseguita.</p>';
    msg(m,'Operazione completata.');
  }catch(e){
    m.querySelector('.orcBody').innerHTML='<p><b>Il comando non è stato eseguito.</b></p>';
    msg(m,(e&&e.message)||String(e));
  }finally{
    manualRegBusy=false;
    if(b){b.disabled=false;b.textContent=oldText||'Porta RCH in REG'}
    cloudConnection().then(updateBadge).catch(function(){var rb=ensureRegButton();if(rb){rb.disabled=false;rb.title='Clicca per verificare lo stato RCH'}})
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
  if(d&&d.online){
    var st=d.status||{},ok=st.ok===true&&regMode(st),can=safeZIdle(st);
    b.classList.toggle('ok',ok);b.classList.toggle('error',!ok);b.textContent=(ok?'● ':'○ ')+'RCH via PC'+(st.mode?' · '+st.mode:'');
    if(r){r.disabled=manualRegBusy;r.dataset.rchAllowed=can?'1':'0';r.title=can?'Porta manualmente la RCH da Z a REG':regMode(st)?'La RCH è già in REG':'Clicca per verificare lo stato RCH'}
  }else{
    b.classList.remove('ok');b.classList.add('error');b.textContent='○ RCH · verifica collegamento';
    if(r){r.disabled=manualRegBusy;r.dataset.rchAllowed='0';r.title='Clicca per verificare il collegamento RCH'}
  }
}
if(!window.__OPTYKER_RCH_REG_CLICK_CAPTURE__){
  window.__OPTYKER_RCH_REG_CLICK_CAPTURE__=true;
  document.addEventListener('click',function(ev){
    var t=ev.target,b=t&&t.closest?t.closest('#optykerRchRegBtn'):null;if(!b)return;
    ev.preventDefault();ev.stopPropagation();if(ev.stopImmediatePropagation)ev.stopImmediatePropagation();
    runManualRegClick(null,b);
  },true)
}
async function showCloudStatus(){var m=modal('RCH · collegamento tramite PC cassa');try{var d=await cloudConnection(),s=d.status||{},can=safeZIdle(s),worker=manualRegWorkerReady(d);m.querySelector('.orcBody').innerHTML='<p><b>Cloud Relay attivo.</b> Questo dispositivo non deve avere il connettore RCH installato.</p><div class="optykerCashRchInfo"><div><span>PC cassa</span><b>Online</b></div><div><span>RCH</span><b>'+esc(s.mode||'stato non disponibile')+'</b></div><div><span>Connettore</span><b>'+esc(d.connector_version||'Cloud Relay')+'</b></div><div><span>Ultimo contatto</span><b>'+esc(d.last_seen_at?new Date(d.last_seen_at).toLocaleTimeString('it-IT'):'—')+'</b></div></div><p><b>Porta RCH in REG è un comando manuale.</b> Optyker non cambia modalità automaticamente.</p>'+(can?'<p><button class="primary" id="orcRestoreReg" type="button">Porta RCH in REG</button></p>':regMode(s)?'<p>La RCH è già in REG.</p>':'<p>Il pulsante viene abilitato solo con RCH in Z, inattiva e senza errori.</p>')+(!worker?'<p><b>Serve un solo aggiornamento sul PC cassa</b> per attivare il nuovo pulsante.</p>':'')+'<p><a href="/rch-connector/Installa-RCH-Optyker.bat?v=20260916-manualreg1" download>Aggiorna collegamento RCH sul PC Windows</a></p>';var rb=m.querySelector('#orcRestoreReg');if(rb)rb.onclick=async function(){if(!confirm('Portare manualmente la RCH in REG? Nessuna chiusura Z verrà eseguita.'))return;rb.disabled=true;rb.textContent='Passaggio a REG…';try{var r=await restoreRegManual();msg(m,r.alreadyReg?'La RCH era già in REG.':'RCH riportata in REG.');setTimeout(function(){showCloudStatus()},700)}catch(e){msg(m,e.message);rb.disabled=false;rb.textContent='Porta RCH in REG'}};updateBadge(d)}catch(e){m.querySelector('.orcBody').innerHTML='<p>Cloud Relay non ancora disponibile.</p><p>Sul <b>PC Windows della cassa</b> esegui una sola volta <b>Installa / aggiorna connettore</b>.</p><p><a href="/rch-connector/Installa-RCH-Optyker.bat?v=20260916-manualreg1" download>Aggiorna collegamento RCH sul PC Windows</a></p>';msg(m,e.message);updateBadge(null)}}
function installCashButtons(){var badge=document.getElementById('optykerCashRch'),drawer=document.getElementById('optykerCashDrawer'),gift=document.getElementById('optykerCashGiftBtn');ensureRegButton();if(badge&&!badge.dataset.cloudRelay){var old=badge.onclick;badge.dataset.cloudRelay='1';badge.onclick=async function(ev){if(ev){ev.preventDefault();ev.stopPropagation()}if(await localAvailable()){if(old)return old.call(this,ev)}return showCloudStatus()}}
 if(drawer&&!drawer.dataset.cloudRelay){var oldDrawer=drawer.onclick;drawer.dataset.cloudRelay='1';drawer.onclick=async function(ev){if(await localAvailable()){if(oldDrawer)return oldDrawer.call(this,ev)}this.disabled=true;try{await queueAux('drawer');alert('Cassetto contanti aperto dalla RCH tramite il PC cassa.')}catch(e){alert(e.message)}finally{this.disabled=false}}}
 if(gift&&!gift.dataset.cloudRelay){var oldGift=gift.onclick;gift.dataset.cloudRelay='1';gift.onclick=async function(ev){if(await localAvailable()){if(oldGift)return oldGift.call(this,ev)}if(!confirm("Stampare lo scontrino di cortesia dell'ultimo documento dalla RCH del negozio?"))return;this.disabled=true;try{await queueAux('gift_receipt');alert('Scontrino di cortesia inviato alla RCH tramite PC cassa.')}catch(e){alert(e.message)}finally{this.disabled=false}}}
 if(badge&&!badge.dataset.cloudProbe){badge.dataset.cloudProbe='1';cloudConnection().then(updateBadge).catch(function(){updateBadge(null)})}}
function wrapFiscal(){var old=window.OPTYKER_FISCAL;if(!old||old.__cloudRelay)return;async function checkReady(){if(await localAvailable())return old.checkReady();return cloudReady()}
 async function issuePayment(saleId,paymentId){if(await localAvailable())return old.issuePayment(saleId,paymentId);var m=modal('Stampa scontrino RCH · iPad');m.querySelector('.orcBody').innerHTML='<p>Invio sicuro al PC cassa…</p><p>Non ripetere la vendita mentre Optyker attende la RCH.</p>';try{await cloudReady();var p=await fiscal('prepare',{payment_id:paymentId,automatic:true}),job=p.data.job;if(p.data.claim_token){msg(m,'PC cassa ricevuto. Emissione RCH in corso…');job=await queueFiscal(job.id,p.data.claim_token,'sale',155000)}m.querySelector('.orcBody').innerHTML='<p><b>'+esc(job.state==='completed'?'Scontrino stampato e registrato.':job.state==='awaiting_reference'?'Scontrino emesso: riferimento da verificare.':job.state==='not_started'?'Nessun comando fiscale inviato.':'Esito da verificare sulla RCH.')+'</b></p><p>Stato: '+esc(job.state)+'</p>';return job}catch(e){msg(m,e.message);throw e}}
 async function openSale(saleId){if(await localAvailable())return old.openSale(saleId);var m=modal('Emissione RCH · iPad');try{var r=await fiscal('sale',{sale_id:saleId}),d=r.data,pays=(d.payments||[]).filter(function(p){return !p.invoice_requested&&!p.billing_invoice_id&&Number(p.amount)>0}),auto=pays.filter(function(p){return p.automatic_receipt});if(!auto.length&&!(d.jobs||[]).some(function(j){return j.state==='completed'})){m.querySelector('.orcBody').innerHTML='<p>Questa vendita richiede la revisione manuale delle righe fiscali. Per sicurezza, eseguila dal PC della cassa.</p>';return}m.querySelector('.orcBody').innerHTML='<p>Pagamenti pronti per emissione automatica tramite PC cassa:</p>'+auto.map(function(p){return '<button type="button" data-pay="'+esc(p.id)+'">Emetti '+esc(euro(p.amount))+' · '+esc(p.payment_stage)+'</button>'}).join(' ')+(d.jobs||[]).filter(function(j){return j.state==='completed'}).map(function(j){return '<button type="button" data-void="'+esc(j.id)+'">Annulla '+esc(j.document_number)+' — TS + RCH</button>'}).join(' ');m.querySelectorAll('[data-void]').forEach(function(b){b.onclick=function(){if(window.OPTYKER_UNIFIED_VOID)window.OPTYKER_UNIFIED_VOID.open(b.dataset.void)}});m.querySelectorAll('[data-pay]').forEach(function(b){b.onclick=async function(){this.disabled=true;try{await issuePayment(saleId,this.dataset.pay);m.remove()}catch(e){msg(m,e.message);this.disabled=false}}})}catch(e){msg(m,e.message)}}
 window.OPTYKER_FISCAL=Object.freeze({openSale:openSale,openTs:old.openTs,checkReady:checkReady,issuePayment:issuePayment,__cloudRelay:true})}
var observer=new MutationObserver(function(){installCashButtons();wrapFiscal()});observer.observe(document.documentElement,{childList:true,subtree:true});
function boot(){wrapFiscal();installCashButtons();setTimeout(function(){wrapFiscal();installCashButtons()},700)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();

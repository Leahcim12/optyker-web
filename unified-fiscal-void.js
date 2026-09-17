(function(){
'use strict';
if(window.OPTYKER_UNIFIED_VOID)return;
var ROOT='https://whgziwaegjzqsgcntesr.supabase.co/functions/v1/',LOCAL='http://127.0.0.1:8765',running=new Set(),panel=null,activeId='',lastAttempt={};
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function money(n){return new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR'}).format(n)}
async function post(url,body,timeout){var r=await fetch(url,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined,cache:'no-store',signal:AbortSignal.timeout(timeout||20000)}),x=await r.json();if(!r.ok||x.ok!==true)throw new Error(x.error||'Collegamento non disponibile');return x}
function api(a,p,relay){var c=window.OPTYKER_CLOUD||{};return post(ROOT+(relay?'optyker-rch-relay-api':'optyker-fiscal-api'),{action:a,payload:p||{},username:c.username||window.OPTYKER_ACTIVE_USER,password:c.password})}
async function ready(){
 var h=null;try{h=await post(LOCAL+'/health',null,1200)}catch{}
 if(h){if(h.capabilities?.automaticVoidReference!==true)throw new Error('Aggiornamento annulli richiesto sul PC cassa. Usa Aggiorna funzione annullo RCH qui sotto; il solo Cloud Relay non basta.');var s=await post(LOCAL+'/status',null,5000);checkStatus(s);return 'local'}
 var d=(await api('status',{},true)).data;
 if(!d.online)throw new Error('PC cassa offline. La pratica resta salvata.');
 if(d.status?.automaticVoidReference!==true)throw new Error('Aggiornamento annulli richiesto sul PC cassa. Usa Aggiorna funzione annullo RCH qui sotto; il solo Cloud Relay non basta.');
 checkStatus(d.status);return 'cloud';
}
function checkStatus(s){if(s?.ok!==true||!/^REG(?:\s*\(OP\s*\d+\))?$/.test(s.mode||'')||String(s.idleState)!=='0'||['busy','errorCode','printerError','paperEnd','coverOpen'].some(function(k){return Number(s[k])!==0}))throw new Error('RCH non pronta: controlla carta, coperchio e modalità REG. La pratica resta salvata.')}
function message(id,text){if(panel?.isConnected&&activeId===id)panel.querySelector('[data-uv-message]').textContent=text}
function tsStatusText(q){
 if(!q)return 'Non richiesto';
 if(q.state==='accepted')return 'Invio originale accettato (non e la conferma di cancellazione)';
 if(q.state==='ts_cancelled')return 'Cancellazione confermata';
 if(q.state==='voided')return 'Invio annullato';
 return q.state||'Esito non disponibile';
}
function draw(id,s){
 if(!panel?.isConnected||activeId!==id)return;
 var j=s.original,v=j.void_job,q=s.ts;
 panel.querySelector('[data-uv-body]').innerHTML='<p>Scontrino <b>'+esc(j.document_number)+'</b> del '+esc(j.document_date)+' · <b>'+esc(money(j.total))+'</b></p><p><b>'+esc(s.message)+'</b></p><p>TS: '+esc(tsStatusText(q))+'</p><p>RCH: '+esc(v?.state==='completed'?'Annullo '+v.document_number+' del '+v.document_date:v?.state||(s.intent?'Annullo in attesa':'Annullo non avviato'))+'</p><p>Pagamenti, rimborsi e ordini restano separati. Originale e ricevute vengono conservati.</p>';
 if(!s.intent&&s.phase!=='completed'){
  var warning=document.createElement('p');warning.textContent='Confermando dichiari che lo scontrino non è già stato annullato sulla RCH o da altri programmi. L’operazione non rimborsa il pagamento.';panel.querySelector('[data-uv-body]').appendChild(warning);
  var b=document.createElement('button');b.type='button';b.className='ofVoidEmit';b.textContent='Confermo annullo completo di '+money(j.total)+' — TS + RCH';
  b.onclick=async function(){b.disabled=true;try{await ready();var x=await api('unified_void_start',{original_job_id:id,confirmed:true});draw(id,x.data);await progress(id)}catch(e){message(id,e.message);b.disabled=false}};
  panel.querySelector('[data-uv-body]').appendChild(b);
 }
}
async function progress(id){
 if(running.has(id))return;running.add(id);
 try{
  var s=(await api('unified_void_step',{original_job_id:id})).data;draw(id,s);
  if(s.phase==='rch_ready'&&Date.now()-(lastAttempt[id]||0)>30000){
   var route=await ready();lastAttempt[id]=Date.now();
   var p=(await api('unified_void_prepare',{original_job_id:id})).data;
   if(p.claim_token){
    message(id,'Invio dell’annullo alla RCH. Non ripetere l’operazione.');
    if(route==='local')await post(LOCAL+'/receipt/void',{jobId:p.job.id,token:p.claim_token},155000);
    else await api('queue_fiscal',{job_id:p.job.id,token:p.claim_token,operation:'void'},true);
   }
   draw(id,(await api('unified_void_step',{original_job_id:id})).data);
  }
 }catch(e){message(id,e.message)}finally{running.delete(id)}
}
async function open(id){
 if(panel)panel.remove();activeId=id;panel=document.createElement('div');panel.className='optykerCashModal open';panel.id='optykerUnifiedVoid';panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-label','Annulla scontrino TS e RCH');
 panel.innerHTML='<div class="optykerCashModalCard" style="max-width:720px"><div class="optykerCashModalTitle">Annulla scontrino — TS + RCH</div><div data-uv-body>Recupero automatico dei dati…</div><p data-uv-message role="status" aria-live="polite"></p><p><a href="/rch-connector/Aggiorna-Annulli-RCH.bat?v=20260917-voidcap1" download>Aggiorna funzione annullo RCH sul PC cassa</a></p><button type="button" data-uv-close>Chiudi</button></div>';
 document.body.appendChild(panel);panel.querySelector('[data-uv-close]').onclick=function(){panel.remove()};
 try{var s=(await api('unified_void_view',{original_job_id:id})).data;draw(id,s);if(s.intent)progress(id)}catch(e){message(id,e.message)}
}
var polling=false;
async function resume(){
 var c=window.OPTYKER_CLOUD||{};if(polling||!c.password||!(c.username||window.OPTYKER_ACTIVE_USER))return;polling=true;
 try{var x=await api('unified_void_pending');for(var r of x.data||[])await progress(r.original_job_id)}catch{}finally{polling=false}
}
window.OPTYKER_UNIFIED_VOID={open:open,resume:resume};
setInterval(resume,15000);setTimeout(resume,2500);
})();

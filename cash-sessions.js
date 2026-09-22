/* OPTYKER_CASH_SESSIONS_20260922: one cashier confirmation includes the RCH closure. */
(function(){
'use strict';if(window.OPTYKER_CASH_SESSIONS)return;
var ROOT='https://whgziwaegjzqsgcntesr.supabase.co/functions/v1/',active=null;
var money=function(v){return new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR'}).format(Number(v||0))};
var esc=function(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})};
function E(id){return document.getElementById(id)}
function today(){return new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())}
function api(ctx,action,p){
 var c=window.OPTYKER_CLOUD||{},headers={'Content-Type':'application/json'},data;
 if(ctx.admin){headers.Authorization='Bearer '+sessionStorage.getItem('optyker_billing_admin_token');data=Object.assign({},p,{action:action})}
 else data={action:action,username:c.username||window.OPTYKER_ACTIVE_USER,password:c.password,payload:p};
 return fetch(ROOT+(ctx.admin?'optyker-admin-cash-api':'optyker-cash-day-api'),{method:'POST',headers:headers,body:JSON.stringify(data),cache:'no-store',signal:AbortSignal.timeout(25000)}).then(function(r){return r.json().then(function(x){if(!r.ok||x.ok!==true)throw new Error(x.error||'Collegamento cassa non disponibile');return x.data})});
}
function notify(){window.dispatchEvent(new Event('optyker:cash-session-changed'))}
function display(ctx,html){if(active!==ctx)return;ctx.body.innerHTML=html}
function status(ctx,text){if(active!==ctx)return;ctx.message.textContent=text}
function field(id,label,v){return '<label>'+esc(label)+'<input id="'+id+'" type="number" min="0" step="0.01" inputmode="decimal" required value="'+Number(v||0).toFixed(2)+'"></label>'}
function row(k,v){return '<p><span>'+esc(k)+'</span><strong>'+esc(money(v))+'</strong></p>'}
function pending(ctx,id){ctx.pending=id;ctx.busy=false;display(ctx,'<p>Chiusura richiesta: attendo la conferma della RCH prima di completare il riepilogo. Non viene inviato un secondo comando.</p><button type="button" id="csResume">Verifica esito</button>');E('csResume').onclick=function(){resume(ctx,id)}}
function completed(ctx,result){
 if(result.fiscal_requested===true&&result.fiscal_confirmed!==true){pending(ctx,result.operation_id||ctx.request);status(ctx,'La chiusura RCH non è ancora confermata.');return}
 ctx.pending=null;ctx.busy=false;ctx.request=null;clearTimeout(ctx.timer);
 var fiscal=result.fiscal_confirmed===true;
 status(ctx,'Operazione confermata. Nessun nuovo incasso registrato.');
 display(ctx,'<p><b>'+(ctx.kind==='open'?'Cassa riaperta/aperta.':fiscal?'Chiusura RCH confermata e riepilogo salvato.':'Riepilogo gestionale salvato. Nessuna chiusura RCH richiesta.')+'</b></p><p>Puoi riaprire la cassa o registrare una nuova chiusura dallo stesso pulsante.</p>');notify();
}
async function resume(ctx,id){
 if(ctx.busy||active!==ctx)return;clearTimeout(ctx.timer);ctx.busy=true;status(ctx,'Verifica dell’operazione già richiesta…');
 try{
  var r=await api(ctx,'session_result',{request_id:id});if(active!==ctx)return;
  if(r.state==='completed')return completed(ctx,r);
  if(r.state==='failed'||r.state==='attention'){
   ctx.busy=false;status(ctx,r.error||'Esito da verificare');
   if(r.state==='failed'){ctx.pending=null;display(ctx,'<p>Chiusura non completata. Nessuna chiusura gestionale registrata.</p><button id="csReload" type="button">Ricarica riepilogo</button>');E('csReload').onclick=function(){load(ctx)}}
   else {pending(ctx,id);status(ctx,r.error||'Esito RCH non confermato: nessun nuovo comando.')}
   return;
  }
  ctx.busy=false;pending(ctx,id);status(ctx,'La RCH non ha ancora concluso. Il comando non viene ripetuto.');
  if(active===ctx&&!ctx.paused)ctx.timer=setTimeout(function(){resume(ctx,id)},1800);
 }catch(e){ctx.busy=false;if(active!==ctx)return;pending(ctx,id);status(ctx,e.message+' · Usa Verifica esito: non viene creato un altro comando.')}
}
function amount(id){var el=E(id);if(!el||el.value.trim()==='')throw new Error('Completa gli importi');var n=Number(el.value);if(!Number.isFinite(n)||n<0)throw new Error('Importo non valido');return Math.round(n*100)/100}
function confirmButton(ctx,fn){E('csConfirm').onclick=async function(){
 if(ctx.busy)return;
 try{
  var data=fn();var warning=ctx.kind==='open'?'Confermare l’apertura con il fondo indicato?':data.fiscal?'Confermare la chiusura completa? Verrà eseguita una NUOVA chiusura fiscale Z sulla RCH; il riepilogo sarà salvato dopo la conferma del registratore.':'Salvare soltanto il riepilogo gestionale? La RCH NON verrà chiusa.';
  if(!confirm(warning))return;
  ctx.request=ctx.request||crypto.randomUUID();ctx.fiscalRequested=data.fiscal===true;
  var p=Object.assign({},data,{date:ctx.date,request_id:ctx.request,expected_token:ctx.metrics.session.token,notes:E('csNotes').value});ctx.busy=true;this.disabled=true;
  status(ctx,ctx.fiscalRequested?'Invio chiusura alla RCH…':'Registrazione riepilogo…');
  var result=await api(ctx,'session_'+ctx.kind,p);
  if(result.state==='completed')return completed(ctx,result);
  if(result.state==='pending'){ctx.busy=false;pending(ctx,result.operation_id);return resume(ctx,result.operation_id)}
  if(result.state==='attention'){ctx.busy=false;pending(ctx,result.operation_id||ctx.request);status(ctx,result.error||'Esito RCH da verificare: nessun nuovo invio.');return}
  ctx.busy=false;status(ctx,result.error||'Operazione non completata');this.disabled=false;
 }catch(e){
  ctx.busy=false;status(ctx,e.message);if(E('csConfirm'))E('csConfirm').disabled=false;
  if(ctx.request){
   display(ctx,'<p>La risposta non è arrivata o l’operazione è stata rifiutata. Verifica prima l’ultimo tentativo: nessuna ripetizione automatica.</p><button id="csCheck" type="button">Verifica ultimo tentativo</button><button id="csReload" type="button">Aggiorna riepilogo</button>');
   E('csCheck').onclick=function(){resume(ctx,ctx.request)};
   E('csReload').onclick=async function(){
    try{var r=await api(ctx,'session_result',{request_id:ctx.request});if(r.state==='pending'||r.state==='attention')return pending(ctx,ctx.request);if(r.state==='completed')return completed(ctx,r)}
    catch(err){if(!/Operazione non trovata/.test(err.message)){status(ctx,err.message);return}}
    ctx.request=null;load(ctx);
   };
  }
 }
};}
async function load(ctx){
 if(active!==ctx||ctx.busy)return;ctx.request=null;status(ctx,'');display(ctx,'<p>Caricamento stato aggiornato…</p>');
 try{
  var m=await api(ctx,'session_status',{date:ctx.date});if(active!==ctx)return;ctx.metrics=m;var s=m.session;
  if(!s)throw new Error('Aggiornamento cassa non disponibile: ricarica la pagina');if(s.pending)return pending(ctx,s.pending.id);
  var base=s.opening||{},delta=s.totals||{},daily=s.daily_totals||{};
  if(ctx.kind==='history'){
   var h=await api(ctx,'session_history',{date:ctx.date});
   display(ctx,'<h3>Storico del '+esc(ctx.date.split('-').reverse().join('/'))+'</h3>'+(h.history||[]).map(function(x){var c=x.closure||{};return '<section class="csHistory"><b>'+(x.kind==='open'?'Apertura':'Chiusura n. '+(x.sequence_no||''))+'</b> · '+esc(new Date(x.at).toLocaleString('it-IT'))+' · '+esc(x.state)+'<p>'+esc(x.operator_username||'')+'</p>'+(x.closure?row('Incassi del periodo',c.total_collected)+row('Fondo successivo',c.next_opening_cash)+(c.fiscal_closure===true?'<p>Chiusura RCH confermata</p>':'<p>Riepilogo gestionale</p>'):'')+'</section>'}).join(''));return;
  }
  var html='<p><b>'+esc(ctx.date.split('-').reverse().join('/'))+'</b> · '+s.closures_count+' chiusure già registrate.</p>';
  if(ctx.kind==='open'){
   if(m.opened&&!m.closed){display(ctx,html+'<p>La cassa è già aperta. Puoi registrare una nuova chiusura.</p>');return}
   html+='<p>Il fondo proposto è quello lasciato nell’ultima chiusura. Puoi modificarlo prima della conferma.</p><div class="csFields">'+field('csOpening','Fondo contanti',base.opening_cash)+field('csOpeningChecks','Fondo assegni',base.opening_checks)+'</div>';
  }else{
   if(!m.opened){display(ctx,html+'<p>Registra prima il fondo di apertura.</p>');return}
   html+='<p><b>Nuova chiusura n. '+s.number+'</b>. La precedente resta nello storico; puoi confermare anche senza nuovi movimenti.</p><div class="csAmounts">'+row('Incassi dall’ultima chiusura',delta.total_collected)+row('Di cui contanti',delta.cash_total)+row('Di cui carta',delta.card_total)+row('Contante atteso nel cassetto',s.cash_expected)+row('Incassi complessivi del giorno',daily.total_collected)+'</div><div class="csFields">'+field('csCount','Contanti contati',Math.max(0,s.cash_expected))+field('csChecks','Assegni contati',base.opening_checks)+field('csFund','Fondo contanti da lasciare',Math.max(0,Math.min(base.opening_cash,s.cash_expected)))+field('csFundChecks','Fondo assegni da lasciare',base.opening_checks)+'</div><p>La differenza fra denaro contato e fondo lasciato viene registrata come trasferimento in cassaforte, non come nuovo incasso.</p>';
   if(ctx.date===today()){
    if(m.cash_session_capabilities?.fiscal_closure!==true)throw new Error('Chiusura completa non ancora disponibile: aggiorna Optyker e riprova. Nessun comando inviato.');
    html+='<label class="csOption"><input id="csFiscal" type="checkbox" checked> Chiudi anche la RCH e stampa la chiusura fiscale Z</label><p id="csFiscalHelp">È già selezionato: basta confermare qui. Non serve andare in Amministrazione. Il riepilogo viene completato dopo la conferma della RCH. Togli la spunta soltanto per salvare un riepilogo senza chiudere il registratore.</p>';
   }else html+='<p><b>Data precedente: solo riepilogo gestionale.</b> Non viene eseguita una chiusura fiscale retrodatata.</p>';
  }
  html+='<label>Note<textarea id="csNotes" maxlength="2000"></textarea></label><button id="csConfirm" type="button">'+(ctx.kind==='open'?'Conferma apertura':ctx.date===today()?'Conferma chiusura completa':'Salva riepilogo gestionale')+'</button>';display(ctx,html);
  if(E('csFiscal'))E('csFiscal').onchange=function(){E('csConfirm').textContent=this.checked?'Conferma chiusura completa':'Salva solo riepilogo gestionale'};
  confirmButton(ctx,function(){
   if(ctx.kind==='open')return {opening_cash:amount('csOpening'),opening_checks:amount('csOpeningChecks')};
   var c=amount('csCount'),q=amount('csChecks'),f=amount('csFund'),fq=amount('csFundChecks');if(f>c||fq>q)throw new Error('Il fondo non può superare il denaro contato');
   return {cash_counted:c,checks_counted:q,bank_deposit_cash:0,bank_deposit_checks:0,safe_deposit_cash:Math.round((c-f)*100)/100,safe_deposit_checks:Math.round((q-fq)*100)/100,fiscal:!!(E('csFiscal')&&E('csFiscal').checked)};
  });
 }catch(e){status(ctx,e.message);display(ctx,'<button id="csReload" type="button">Riprova caricamento</button>');E('csReload').onclick=function(){load(ctx)}}
}
function open(kind,date,admin){
 if(active&&active.busy)return;var prior=E('optykerCashSessionsModal');if(prior)prior.remove();if(active)clearTimeout(active.timer);
 var modal=document.createElement('div');modal.id='optykerCashSessionsModal';modal.innerHTML='<div class="csCard" role="dialog" aria-modal="true" aria-label="Apertura e chiusure cassa"><button class="csExit" type="button" aria-label="Chiudi finestra">×</button><h2>'+(kind==='open'?'Apertura / riapertura cassa':kind==='history'?'Storico chiusure':'Chiusura cassa e RCH')+'</h2><div class="csBody"></div><p class="csMessage" role="status" aria-live="polite"></p></div>';document.body.appendChild(modal);
 var ctx={kind:kind,date:date,admin:!!admin,body:modal.querySelector('.csBody'),message:modal.querySelector('.csMessage'),busy:false,request:null};active=ctx;
 modal.querySelector('.csExit').onclick=function(){if(ctx.busy)return;ctx.paused=true;clearTimeout(ctx.timer);modal.remove();active=null};load(ctx);
}
window.OPTYKER_CASH_SESSIONS={version:'20260922-unified-rch1',open:open};
var style=document.createElement('style');style.textContent='#optykerCashSessionsModal{position:fixed;inset:0;z-index:2147483646;background:#132b4499;display:flex;align-items:center;justify-content:center;padding:18px}.csCard{position:relative;background:white;color:#18354a;border-radius:16px;padding:24px;width:640px;max-width:100%;max-height:92vh;overflow:auto;box-sizing:border-box;font:14px/1.5 system-ui}.csExit{position:absolute;right:14px;top:10px}.csCard button{padding:10px 16px;border:1px solid #c7d3dd;background:#eff4f7;border-radius:8px;cursor:pointer}.csCard #csConfirm{margin-top:16px;background:#8f2939;color:white}.csFields{display:grid;grid-template-columns:1fr 1fr;gap:14px}.csFields label,.csCard label{display:block}.csFields input,.csCard textarea{width:100%;padding:9px;box-sizing:border-box;border:1px solid #b9c7cf;border-radius:6px;font:inherit}.csCard textarea{min-height:60px}.csAmounts p{display:flex;justify-content:space-between;gap:15px;margin:5px 0}.csOption{padding:12px;background:#fff2dc;margin:15px 0}.csMessage{font-weight:600;overflow-wrap:anywhere}.csHistory{padding:12px;border-bottom:1px solid #ddd}@media(max-width:500px){.csFields{grid-template-columns:1fr}.csCard{padding:18px}.csAmounts p{flex-wrap:wrap}}';document.head.appendChild(style);
})();

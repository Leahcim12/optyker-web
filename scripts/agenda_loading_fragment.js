// REQUEST
function agendaSession(){var c=window.OPTYKER_CLOUD||{};return [c.username||'',c.password||''].join('\n')}
function agendaError(e){return /Abort|Timeout/i.test(e&&e.name||'')?'Il server non ha risposto. Premi Riprova.':e&&e.message||'Agenda non disponibile. Premi Riprova.'}
async function api(a,p){
  var c=window.OPTYKER_CLOUD||{},session=agendaSession();
  if(!c.username||!c.password)throw Error('Sessione scaduta: accedi di nuovo con la password.');
  var read=a==='bootstrap'||a==='list',attempt=0;
  while(true){
    var controller=new AbortController(),timer=setTimeout(function(){controller.abort()},12000);
    try{
      var r=await fetch(c.root+'/rest/v1/rpc/optyker_appointments_api',{method:'POST',cache:'no-store',signal:controller.signal,headers:{'Content-Type':'application/json',apikey:c.key,Authorization:'Bearer '+c.key},body:JSON.stringify({p_username:c.username,p_password:c.password,p_action:a,p_payload:p||{}})});
      if(read&&[502,503,504].indexOf(r.status)>=0&&attempt++===0)continue;
      var x=await r.json();
      if(!r.ok||!x||x.ok===false)throw Error(x&&x.error||x&&x.message||'Agenda non disponibile (server '+r.status+'). Premi Riprova.');
      if(session!==agendaSession())throw Error('Sessione cambiata: riapri Agenda.');
      return x;
    }finally{clearTimeout(timer)}
  }
}
// BOOT
var agendaBootPending=null,agendaBootSession='',agendaListSeq=0;
function boot(force){
  var session=agendaSession();
  if(agendaBootSession!==session){S.boot=null;S.items=[];agendaBootPending=null;agendaBootSession=session;agendaListSeq++;}
  if(agendaBootPending)return agendaBootPending;
  if(S.boot&&!force)return Promise.resolve(S.boot);
  var pending=api('bootstrap',{}).then(function(x){
    ['operators','studios','services'].forEach(function(k){if(!Array.isArray(x[k]))throw Error('Configurazione agenda incompleta. Premi Riprova.')});
    x.rules=Array.isArray(x.rules)?x.rules:[];S.boot=x;fill();
    if(E('oaServices')&&E('oaStudios')&&E('oaRules'))renderSettings();
    shortcut();return x;
  }).catch(function(e){if(agendaBootSession===session)S.boot=null;throw e}).finally(function(){if(agendaBootPending===pending)agendaBootPending=null});
  agendaBootPending=pending;return pending;
}
// LOAD
function agendaFailure(e){status('oaStatus',agendaError(e),true);var b=E('oaReload');if(b){b.disabled=false;b.textContent='Riprova'}var p=E('optykerAppointmentsPanel');if(p)p.setAttribute('aria-busy','false')}
function load(){
  var a=rangeStart(),n=rangeDays(),seq=++agendaListSeq;
  status('oaStatus','Caricamento appuntamenti…');E('optykerAppointmentsPanel').setAttribute('aria-busy','true');
  // Never leave appointments from another date range on screen after an error.
  E('oaCalendar').textContent='';
  return api('list',{from:a.toISOString(),to:plus(a,n).toISOString()}).then(function(x){
    if(seq!==agendaListSeq)return;
    if(!Array.isArray(x.data))throw Error('Risposta agenda incompleta. Premi Riprova.');
    S.items=x.data;render();status('oaStatus',x.data.length?'':'Nessun appuntamento in questo periodo.');
    E('oaReload').textContent='Aggiorna';
  }).catch(function(e){if(seq===agendaListSeq)agendaFailure(e)}).finally(function(){if(seq===agendaListSeq)E('optykerAppointmentsPanel').setAttribute('aria-busy','false')});
}
function agendaRefresh(force){
  status('oaStatus','Caricamento agenda…');E('optykerAppointmentsPanel').setAttribute('aria-busy','true');
  return boot(force).then(load).catch(agendaFailure);
}

from pathlib import Path

p=Path('_site/index.html')
s=p.read_text(encoding='utf-8')
MARK='OPTYKER_APPOINTMENTS_UI_V12_SETTINGS_SAVE'
if MARK in s:
    raise SystemExit(0)
if 'OPTYKER_APPOINTMENTS_UI_V11_SECURE' not in s or 'id="optykerSettingsAgendaPane"' not in s or 'id="oaSettingsModal"' not in s:
    raise SystemExit('Agenda / impostazioni non disponibili')

style=r'''<style id="optykerAppointmentsV12SettingsCss">/* OPTYKER_APPOINTMENTS_UI_V12_SETTINGS_SAVE */
#oaSettings{display:inline-flex!important}
#optykerSettingsAgendaPane.open{display:block!important}
.oaSettingsSaveBarV12{position:sticky;bottom:0;z-index:40;display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:16px;padding:13px 14px;border:1px solid #cfe0eb;border-radius:12px;background:rgba(255,255,255,.97);box-shadow:0 -5px 22px rgba(23,50,74,.08);backdrop-filter:blur(8px)}
.oaSettingsSaveNoteV12{font-size:10px;color:#687d8e;line-height:1.4}.oaSettingsSaveNoteV12 b{display:block;font-size:12px;color:#17324a;margin-bottom:2px}
#oaSettingsSaveAllV12{min-width:180px;height:42px;border:0;border-radius:9px;background:#1769aa;color:#fff;font-size:11px;font-weight:900;cursor:pointer;padding:0 18px}
#oaSettingsSaveAllV12.dirty{box-shadow:0 0 0 3px rgba(23,105,170,.14)}
#oaSettingsSaveAllV12:disabled{opacity:.55;cursor:wait}
#oaRules .avSave,#oaRules .saveR{display:none!important}
@media(max-width:650px){.oaSettingsSaveBarV12{position:static;flex-direction:column;align-items:stretch}.oaSettingsSaveBarV12 button{width:100%}}
</style>'''

script=r'''<script id="optykerAppointmentsV12SettingsJs">(function(){/* OPTYKER_APPOINTMENTS_UI_V12_SETTINGS_SAVE */
var dirty=false,saving=false;
function E(i){return document.getElementById(i)}
function txt(v){return String(v==null?'':v).trim()}
function setStatus(t,bad){var e=E('oaSettingsStatus');if(e){e.textContent=t||'';e.className='oaStatus'+(bad?' bad':'')}}
function auth(){
  if(!window.OPTYKER_CLOUD||!OPTYKER_CLOUD.username||!OPTYKER_CLOUD.password)throw Error('Sessione non autenticata: accedi di nuovo con la password.');
  return OPTYKER_CLOUD
}
function rpc(name,payload){var c=auth();return fetch(c.root+'/rest/v1/rpc/'+name,{method:'POST',headers:{'Content-Type':'application/json','apikey':c.key,'Authorization':'Bearer '+c.key},body:JSON.stringify(payload||{})}).then(function(r){if(!r.ok)throw Error('Server '+r.status);return r.json()}).then(function(x){if(!x||x.ok===false)throw Error(x&&x.error||'Operazione non riuscita');return x})}
function appt(action,payload){var c=auth();return rpc('optyker_appointments_api',{p_username:c.username,p_password:c.password,p_action:action,p_payload:payload||{}})}
function avail(action,payload){var c=auth();return rpc('optyker_availability_admin',{p_username:c.username,p_password:c.password,p_action:action,p_payload:payload||{}})}
function agenda(action,payload){var c=auth();return rpc('optyker_agenda_v6_api',{p_username:c.username,p_password:c.password,p_action:action,p_payload:payload||{}})}
function markDirty(){
  dirty=true;
  var b=E('oaSettingsSaveAllV12');if(b){b.classList.add('dirty');b.textContent='SALVA MODIFICHE'}
  var n=E('oaSettingsSaveTextV12');if(n)n.textContent='Hai modifiche da salvare.'
}
function clearDirty(){
  dirty=false;
  var b=E('oaSettingsSaveAllV12');if(b)b.classList.remove('dirty');
  var n=E('oaSettingsSaveTextV12');if(n)n.textContent='Le modifiche vengono applicate solo quando premi Salva modifiche.'
}
function ensureSaveBar(){
  var pane=E('optykerSettingsAgendaPane'),box=pane&&pane.querySelector('.oaSettingsEmbedded');if(!box)return;
  if(E('oaSettingsSaveBarV12'))return;
  var bar=document.createElement('div');bar.id='oaSettingsSaveBarV12';bar.className='oaSettingsSaveBarV12';
  bar.innerHTML='<div class="oaSettingsSaveNoteV12"><b>Salvataggio impostazioni</b><span id="oaSettingsSaveTextV12">Le modifiche vengono applicate solo quando premi Salva modifiche.</span></div><button id="oaSettingsSaveAllV12" type="button">SALVA MODIFICHE</button>';
  box.appendChild(bar);
  E('oaSettingsSaveAllV12').onclick=saveAll
}
function showAgendaPane(){
  var pane=E('optykerSettingsAgendaPane');if(!pane)return false;
  var wa=E('optykerSettingsWhatsAppPane'),ba=E('optykerSettingsAgenda'),bw=E('optykerSettingsWhatsApp');
  if(wa)wa.classList.remove('open');pane.classList.add('open');
  if(ba)ba.classList.add('active');if(bw)bw.classList.remove('active');
  ensureSaveBar();
  var sub=document.querySelector('#optykerSettingsPanel .optykerSettingsSub');if(sub)sub.textContent='Agenda e prenotazioni · modifica i campi e premi Salva modifiche.';
  if(window.optykerAgendaBoot)window.optykerAgendaBoot(true).then(function(){setTimeout(ensureSaveBar,30)}).catch(function(e){setStatus(e.message||'Impossibile caricare le impostazioni.',true)});
  return true
}
function openAgendaSettings(){
  try{if(window.optykerOpenSettings)window.optykerOpenSettings()}catch(e){}
  var tries=0;(function ready(){tries++;if(showAgendaPane())return;if(tries<25)setTimeout(ready,60);else setStatus('Impostazioni agenda non disponibili.',true)})()
}
window.optykerOpenAgendaSettings=openAgendaSettings;

function servicePayload(row){
  var requires=row.querySelector('.oaRequiresStudio');
  var p={id:row.dataset.s||'',name:txt((row.querySelector('.sn')||{}).value),duration_minutes:+((row.querySelector('.sd')||{}).value||30),color:(row.querySelector('.sc')||{}).value||'#1769aa',active:((row.querySelector('.sa')||{}).value||'true')==='true'};
  if(requires)p.requires_studio=requires.value==='true';
  return p
}
function studioPayload(row){return {id:row.dataset.st||'',name:txt((row.querySelector('.stn')||{}).value),active:((row.querySelector('.sta')||{}).value||'true')==='true'}}
function operatorPayload(row){var box=row.querySelector('.oaSvcOperators');if(!box)return null;return {id:row.dataset.s||'',operators:Array.from(box.querySelectorAll('input[type=checkbox]:checked')).map(function(x){return x.value})}}
function availabilityPayload(row){
  var days=Array.from(row.querySelectorAll('.oaAvailDay input:checked')).map(function(x){return +x.value});
  if(!days.length)throw Error('Seleziona almeno un giorno in ogni disponibilità.');
  var service=row.querySelector('.avService'),studio=row.querySelector('.avStudio'),a=row.querySelector('.avStart'),z=row.querySelector('.avEnd'),iv=row.querySelector('.avInterval');
  if(!service||!a||!z||!a.value||!z.value)throw Error('Completa servizio e orari delle disponibilità.');
  return {rule_ids:row._ids||[],service_id:service.value,studio_id:studio?studio.value:'',weekdays:days,start_time:a.value,end_time:z.value,slot_interval_minutes:+((iv||{}).value||15)}
}
function storePayload(row){return {weekday:+row.dataset.day,active:row.querySelector('.v7active').value==='true',start_time:row.querySelector('.v7h1s').value,end_time:row.querySelector('.v7h1e').value,start_time_2:row.querySelector('.v7h2s').value,end_time_2:row.querySelector('.v7h2e').value}}

async function saveAll(){
  if(saving)return;
  var b=E('oaSettingsSaveAllV12');saving=true;if(b){b.disabled=true;b.textContent='SALVATAGGIO…'}setStatus('Salvataggio impostazioni…');
  try{
    auth();
    var serviceRows=Array.from(document.querySelectorAll('#oaServices .oaService[data-s]'));
    for(var i=0;i<serviceRows.length;i++){
      var sp=servicePayload(serviceRows[i]);if(!sp.name)throw Error('Il nome del servizio è obbligatorio.');
      await appt('service_save',sp);
      var op=operatorPayload(serviceRows[i]);if(op)await appt('service_operators_save',op)
    }
    var studioRows=Array.from(document.querySelectorAll('#oaStudios .oaStudio[data-st]'));
    for(var j=0;j<studioRows.length;j++){
      var st=studioPayload(studioRows[j]);if(!st.name)throw Error('Il nome dello studio è obbligatorio.');
      await appt('studio_save',st)
    }
    var hourRows=Array.from(document.querySelectorAll('#oaStoreHoursV7 .oaStoreHourV7'));
    for(var h=0;h<hourRows.length;h++)await agenda('store_hours_save',storePayload(hourRows[h]));
    var avRows=Array.from(document.querySelectorAll('#oaRules .oaAvailRow'));
    for(var k=0;k<avRows.length;k++)await avail('save',availabilityPayload(avRows[k]));
    setStatus('Impostazioni agenda salvate correttamente.');
    clearDirty();
    if(window.optykerAgendaBoot)await window.optykerAgendaBoot(true);
    setTimeout(function(){showAgendaPane();ensureSaveBar()},40)
  }catch(e){
    setStatus(e.message||'Errore durante il salvataggio.',true);
    if(/non autenticata|non autorizzato/i.test(String(e.message||e))){try{if(window.optykerShowLogin)window.optykerShowLogin()}catch(z){}}
  }finally{
    saving=false;if(b){b.disabled=false;b.textContent='SALVA MODIFICHE'}
  }
}

/* Blocca i vecchi autosalvataggi: i campi diventano "bozza" fino al pulsante unico. */
document.addEventListener('change',function(ev){
  var pane=E('optykerSettingsAgendaPane'),t=ev.target;if(!pane||!t||!pane.contains(t))return;
  if(t.matches('#oaServices input,#oaServices select,#oaStudios input,#oaStudios select,#oaStoreHoursV7 input,#oaStoreHoursV7 select,#oaRules input,#oaRules select')){
    ev.stopImmediatePropagation();
    if(t.matches('.oaSvcOperator input[type=checkbox]')){var lo=t.closest('.oaSvcOperator');if(lo)lo.classList.toggle('on',t.checked)}
    if(t.matches('.oaAvailDay input[type=checkbox]')){var ld=t.closest('.oaAvailDay');if(ld)ld.classList.toggle('on',t.checked)}
    markDirty()
  }
},true);
document.addEventListener('input',function(ev){var pane=E('optykerSettingsAgendaPane'),t=ev.target;if(pane&&t&&pane.contains(t)&&t.matches('input,select,textarea'))markDirty()},true);

/* V13 gestisce direttamente l'apertura delle impostazioni Agenda. */

function boot(){
  ensureSaveBar();
  var b=E('oaSettings');if(b)b.style.setProperty('display','inline-flex','important');
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
window.addEventListener('pageshow',boot);
new MutationObserver(function(){setTimeout(function(){ensureSaveBar();var b=E('oaSettings');if(b)b.style.setProperty('display','inline-flex','important')},20)}).observe(document.documentElement,{subtree:true,childList:true});
})();</script>'''

h=s.find('</head>')
if h<0: raise SystemExit('head non trovato')
s=s[:h]+style+s[h:]
b=s.rfind('</body>')
if b<0: raise SystemExit('body non trovato')
s=s[:b]+script+s[b:]
p.write_text(s,encoding='utf-8')
for req in [MARK,'oaSettingsSaveAllV12','SALVA MODIFICHE','window.optykerOpenAgendaSettings','submit']:
    if req not in s: raise SystemExit('Patch V12 incompleta: '+req)
print('Appointments V12 settings open + save all OK')

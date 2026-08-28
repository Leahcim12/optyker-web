from pathlib import Path

p=Path('_site/index.html')
s=p.read_text(encoding='utf-8')
MARK='OPTYKER_APPOINTMENTS_UI_V3'
if MARK in s:
    raise SystemExit(0)
if 'OPTYKER_APPOINTMENTS_UI_V2' not in s or 'id="oaServices"' not in s or 'id="oaStudios"' not in s:
    raise SystemExit('Agenda V2 non disponibile')

style=r'''<style id="optykerAppointmentsV3Css">/* OPTYKER_APPOINTMENTS_UI_V3 */
.oaService{grid-template-columns:minmax(0,1fr) 78px 52px 72px auto!important}
.oaStudio{grid-template-columns:minmax(0,1fr) 72px auto!important}
.oaEntityDelete{height:35px!important;padding:0 9px!important;border:1px solid #efc9c4!important;background:#fff7f6!important;color:#a52a1d!important;border-radius:7px!important;font-size:10px!important;font-weight:900!important;cursor:pointer!important;white-space:nowrap}
.oaEntityDelete:hover{background:#ffebe8!important}.oaEntityDelete:disabled{opacity:.55;cursor:wait!important}
@media(max-width:650px){.oaService{grid-template-columns:1fr 70px 48px 65px auto!important}.oaStudio{grid-template-columns:1fr 65px auto!important}.oaEntityDelete{padding:0 7px!important}}
</style>'''

script=r'''<script id="optykerAppointmentsV3Js">(function(){/* OPTYKER_APPOINTMENTS_UI_V3 */
function E(i){return document.getElementById(i)}
function call(action,payload){
  if(!window.OPTYKER_CLOUD||!OPTYKER_CLOUD.username)return Promise.reject(Error('Sessione non autenticata'));
  return fetch(OPTYKER_CLOUD.root+'/rest/v1/rpc/optyker_appointments_api',{method:'POST',headers:{'Content-Type':'application/json','apikey':OPTYKER_CLOUD.key,'Authorization':'Bearer '+OPTYKER_CLOUD.key},body:JSON.stringify({p_username:OPTYKER_CLOUD.username,p_password:OPTYKER_CLOUD.password||'',p_action:action,p_payload:payload||{}})}).then(function(r){if(!r.ok)throw Error('Server '+r.status);return r.json()}).then(function(x){if(!x||x.ok===false)throw Error(x&&x.error||'Errore agenda');return x})
}
function status(t,b){var e=E('oaSettingsStatus');if(e){e.textContent=t||'';e.className='oaStatus'+(b?' bad':'')}}
function refresh(message){var p=window.optykerAgendaBoot?window.optykerAgendaBoot(true):Promise.resolve();return Promise.resolve(p).then(function(){status(message||'Aggiornato.')})}
function addDeleteButtons(){
  var services=E('oaServices');
  if(services)services.querySelectorAll('.oaService[data-s]').forEach(function(row){
    if(row.querySelector('.oaEntityDelete'))return;
    var b=document.createElement('button');b.type='button';b.className='oaEntityDelete';b.textContent='Elimina';
    b.onclick=function(ev){ev.preventDefault();ev.stopPropagation();var id=row.dataset.s;if(!id||!confirm('Eliminare questo servizio? Non sarà più prenotabile.'))return;b.disabled=true;call('service_delete',{id:id}).then(function(x){return refresh(x.mode==='archived'?'Servizio rimosso. Gli appuntamenti già registrati restano nello storico.':'Servizio eliminato.')}).catch(function(e){status(e.message,true);b.disabled=false})};
    row.appendChild(b)
  });
  var studios=E('oaStudios');
  if(studios)studios.querySelectorAll('.oaStudio[data-st]').forEach(function(row){
    if(row.querySelector('.oaEntityDelete'))return;
    var b=document.createElement('button');b.type='button';b.className='oaEntityDelete';b.textContent='Elimina';
    b.onclick=function(ev){ev.preventDefault();ev.stopPropagation();var id=row.dataset.st;if(!id||!confirm('Eliminare questo studio? Non sarà più disponibile per nuovi appuntamenti.'))return;b.disabled=true;call('studio_delete',{id:id}).then(function(x){return refresh(x.mode==='archived'?'Studio rimosso. Gli appuntamenti già registrati restano nello storico.':'Studio eliminato.')}).catch(function(e){status(e.message,true);b.disabled=false})};
    row.appendChild(b)
  })
}
function ensureDiego(){
  ['oaOpFilter','oaOperator'].forEach(function(id){var s=E(id);if(!s)return;var found=Array.from(s.options||[]).some(function(o){return String(o.value||o.text).trim().toUpperCase()==='DIEGO PANSERI'});if(!found){var o=document.createElement('option');o.value='Diego Panseri';o.text='Diego Panseri';s.appendChild(o)}});
  document.querySelectorAll('.ro').forEach(function(s){var found=Array.from(s.options||[]).some(function(o){return String(o.value||o.text).trim().toUpperCase()==='DIEGO PANSERI'});if(!found){var o=document.createElement('option');o.value='Diego Panseri';o.text='Diego Panseri';s.appendChild(o)}})
}
function sync(){addDeleteButtons();ensureDiego()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',sync);else sync();
new MutationObserver(sync).observe(document.documentElement,{subtree:true,childList:true});
setInterval(sync,1600)
})();</script>'''

h=s.find('</head>')
if h<0: raise SystemExit('head non trovato')
s=s[:h]+style+s[h:]
b=s.rfind('</body>')
if b<0: raise SystemExit('body non trovato')
s=s[:b]+script+s[b:]
p.write_text(s,encoding='utf-8')
if MARK not in s: raise SystemExit('Agenda V3 non inserita')
print('Appointments V3 delete controls OK')

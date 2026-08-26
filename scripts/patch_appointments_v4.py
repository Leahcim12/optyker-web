from pathlib import Path

p=Path('_site/index.html')
s=p.read_text(encoding='utf-8')
MARK='OPTYKER_APPOINTMENTS_UI_V4'
if MARK in s:
    raise SystemExit(0)
if 'OPTYKER_APPOINTMENTS_UI_V3' not in s or 'id="oaServices"' not in s or 'id="oaRules"' not in s:
    raise SystemExit('Agenda V3 non disponibile')

style=r'''<style id="optykerAppointmentsV4Css">/* OPTYKER_APPOINTMENTS_UI_V4 */
.oaService{grid-template-columns:minmax(0,1fr) 78px 52px 105px 72px auto!important}
.oaRequiresStudio{min-width:0;height:35px;border:1px solid #cbd8e2;border-radius:7px;padding:4px 6px;background:#fff;color:#17324a;font-size:10px;font-weight:800}
.oaRule .rst option[value=""]{font-weight:900}
.oaStudioOptionalHint{font-size:9px;color:#6d8191;margin:4px 0 8px}
#oaStudioFieldV4.hidden{display:none!important}
@media(max-width:760px){.oaService{grid-template-columns:minmax(0,1fr) 70px 48px 96px 65px auto!important}}
@media(max-width:580px){.oaService{grid-template-columns:1fr 72px 50px 1fr!important}.oaService .sa{grid-column:1/2}.oaService .oaEntityDelete{grid-column:4/5}}
</style>'''

script=r'''<script id="optykerAppointmentsV4Js">(function(){/* OPTYKER_APPOINTMENTS_UI_V4 */
var CFG=null,loading=false;
function E(i){return document.getElementById(i)}
function api(action,payload){
  if(!window.OPTYKER_CLOUD||!OPTYKER_CLOUD.username)return Promise.reject(Error('Sessione non autenticata'));
  return fetch(OPTYKER_CLOUD.root+'/rest/v1/rpc/optyker_appointments_api',{method:'POST',headers:{'Content-Type':'application/json','apikey':OPTYKER_CLOUD.key,'Authorization':'Bearer '+OPTYKER_CLOUD.key},body:JSON.stringify({p_username:OPTYKER_CLOUD.username,p_password:OPTYKER_CLOUD.password||'',p_action:action,p_payload:payload||{}})}).then(function(r){if(!r.ok)throw Error('Server '+r.status);return r.json()}).then(function(x){if(!x||x.ok===false)throw Error(x&&x.error||'Errore agenda');return x})
}
function svc(id){return CFG&&((CFG.settings_services||CFG.services||[]).find(function(x){return String(x.id)===String(id)}))}
function ruleCfg(id){return CFG&&((CFG.rules||[]).find(function(x){return String(x.id)===String(id)}))}
function setMsg(t,b){var e=E('oaSettingsStatus');if(e){e.textContent=t||'';e.className='oaStatus'+(b?' bad':'')}}
function updateRuleStudio(row,fromDb){
  var ss=row.querySelector('.rs'),st=row.querySelector('.rst');if(!ss||!st)return;
  var service=svc(ss.value),needs=!service||service.requires_studio!==false;
  var blank=st.querySelector('option[value=""]');
  if(!blank){blank=document.createElement('option');blank.value='';st.insertBefore(blank,st.firstChild)}
  blank.textContent=needs?'Entrambi gli studi':'Nessuno studio';
  Array.from(st.options).forEach(function(o){if(o.value)o.disabled=!needs});
  if(fromDb){var r=ruleCfg(row.dataset.r);if(r&&r.studio_id==null)st.value=''}
  if(!needs)st.value='';
}
function enhanceRules(){
  var root=E('oaRules');if(!root)return;
  root.querySelectorAll('.oaRule').forEach(function(row){
    if(row.dataset.v4ready==='1')return;
    row.dataset.v4ready='1';
    var ss=row.querySelector('.rs');if(ss)ss.addEventListener('change',function(){updateRuleStudio(row,false)});
    updateRuleStudio(row,true)
  })
}
function saveRequires(row,sel){
  sel.disabled=true;
  var p={id:row.dataset.s,name:(row.querySelector('.sn')||{}).value||'',duration_minutes:+((row.querySelector('.sd')||{}).value||30),color:(row.querySelector('.sc')||{}).value||'#1769aa',active:((row.querySelector('.sa')||{}).value||'true')==='true',requires_studio:sel.value==='true'};
  api('service_save',p).then(function(){setMsg('Impostazione studio salvata.');return reload()}).catch(function(e){setMsg(e.message,true);sel.disabled=false})
}
function enhanceServices(){
  var root=E('oaServices');if(!root)return;
  root.querySelectorAll('.oaService[data-s]').forEach(function(row){
    if(row.querySelector('.oaRequiresStudio'))return;
    var service=svc(row.dataset.s),sel=document.createElement('select');sel.className='oaRequiresStudio';
    sel.innerHTML='<option value="true">Studio: sì</option><option value="false">Studio: no</option>';
    sel.value=service&&service.requires_studio===false?'false':'true';
    var active=row.querySelector('.sa');row.insertBefore(sel,active||row.lastElementChild);
    sel.addEventListener('change',function(){saveRequires(row,sel)})
  })
}
function updateNewStudio(){
  var serviceSelect=E('oaService'),studio=E('oaStudio');if(!serviceSelect||!studio)return;
  var service=svc(serviceSelect.value),needs=!service||service.requires_studio!==false;
  var wrap=studio.closest('.oaF');if(wrap){wrap.id='oaStudioFieldV4';wrap.classList.toggle('hidden',!needs)}
  if(!needs)studio.value=''
}
function bindNew(){var s=E('oaService');if(s&&!s.dataset.v4bound){s.dataset.v4bound='1';s.addEventListener('change',function(){updateNewStudio()})}updateNewStudio()}
function enhance(){enhanceServices();enhanceRules();bindNew()}
function reload(){if(loading)return Promise.resolve();loading=true;return api('bootstrap',{}).then(function(x){CFG=x;enhance()}).finally(function(){loading=false})}
function boot(){reload().catch(function(e){console.error(e)});setTimeout(enhance,150)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
new MutationObserver(function(){setTimeout(enhance,20)}).observe(document.documentElement,{subtree:true,childList:true});
setInterval(function(){if(!CFG)reload().catch(function(){});else enhance()},1800)
})();</script>'''

h=s.find('</head>')
if h<0: raise SystemExit('head non trovato')
s=s[:h]+style+s[h:]
b=s.rfind('</body>')
if b<0: raise SystemExit('body non trovato')
s=s[:b]+script+s[b:]
p.write_text(s,encoding='utf-8')
if MARK not in s: raise SystemExit('Agenda V4 non inserita')
print('Appointments V4 optional/all studios OK')

from pathlib import Path

p=Path('_site/index.html')
s=p.read_text(encoding='utf-8')
MARK='OPTYKER_APPOINTMENTS_UI_V5'
if MARK in s:
    raise SystemExit(0)
if 'OPTYKER_APPOINTMENTS_UI_V4' not in s or 'id="oaServices"' not in s:
    raise SystemExit('Agenda V4 non disponibile')

style=r'''<style id="optykerAppointmentsV5Css">/* OPTYKER_APPOINTMENTS_UI_V5 */
#oaServices .oaService{display:grid!important;grid-template-columns:minmax(240px,2fr) 95px 66px 116px 82px auto!important;gap:8px!important;padding:12px!important;margin-bottom:10px!important;border:1px solid #d8e3ea!important;border-radius:11px!important;background:#fff!important;align-items:end!important}
.oaSvcField{display:flex!important;flex-direction:column!important;gap:4px!important;min-width:0!important}.oaSvcField>span{font-size:9px!important;font-weight:900!important;color:#5d7385!important;text-transform:uppercase!important;letter-spacing:.02em!important}.oaSvcField input,.oaSvcField select{width:100%!important;min-width:0!important;height:38px!important}.oaSvcNameField .sn{font-size:13px!important;font-weight:900!important;color:#17324a!important;background:#fff!important;opacity:1!important}.oaSvcOperators{grid-column:1/-1!important;border-top:1px solid #e5ebef!important;padding-top:9px!important;margin-top:2px!important}.oaSvcOperatorsTitle{font-size:10px!important;font-weight:900!important;color:#17324a!important;margin-bottom:6px!important}.oaSvcOperatorList{display:flex!important;gap:7px!important;flex-wrap:wrap!important}.oaSvcOperator{display:inline-flex!important;align-items:center!important;gap:5px!important;padding:7px 9px!important;border:1px solid #cbd9e2!important;border-radius:8px!important;background:#f9fbfc!important;font-size:10px!important;font-weight:800!important;color:#294b63!important;cursor:pointer!important}.oaSvcOperator input{width:15px!important;height:15px!important;min-height:0!important;margin:0!important}.oaSvcOperator.on{border-color:#1769aa!important;background:#edf7fd!important;color:#155d91!important}.oaSvcOperatorSaving{opacity:.55!important;pointer-events:none!important}.oaService .oaEntityDelete{align-self:end!important;height:38px!important}.oaServiceOperatorsHint{font-size:9px!important;color:#708494!important;margin-top:5px!important}
@media(max-width:900px){#oaServices .oaService{grid-template-columns:minmax(220px,2fr) 90px 60px 105px!important}.oaSvcActiveField,.oaService .oaEntityDelete{grid-column:auto!important}}
@media(max-width:650px){#oaServices .oaService{grid-template-columns:1fr 1fr!important}.oaSvcNameField{grid-column:1/-1!important}.oaSvcOperators{grid-column:1/-1!important}.oaService .oaEntityDelete{grid-column:2!important}.oaSvcField input,.oaSvcField select{height:40px!important}}
</style>'''

script=r'''<script id="optykerAppointmentsV5Js">(function(){/* OPTYKER_APPOINTMENTS_UI_V5 */
var CFG=null,busy=false;
function E(i){return document.getElementById(i)}
function api(action,payload){
  if(!window.OPTYKER_CLOUD||!OPTYKER_CLOUD.username)return Promise.reject(Error('Sessione non autenticata'));
  return fetch(OPTYKER_CLOUD.root+'/rest/v1/rpc/optyker_appointments_api',{method:'POST',headers:{'Content-Type':'application/json','apikey':OPTYKER_CLOUD.key,'Authorization':'Bearer '+OPTYKER_CLOUD.key},body:JSON.stringify({p_username:OPTYKER_CLOUD.username,p_password:OPTYKER_CLOUD.password||'',p_action:action,p_payload:payload||{}})}).then(function(r){if(!r.ok)throw Error('Server '+r.status);return r.json()}).then(function(x){if(!x||x.ok===false)throw Error(x&&x.error||'Errore agenda');return x})
}
function setMsg(t,b){var e=E('oaSettingsStatus');if(e){e.textContent=t||'';e.className='oaStatus'+(b?' bad':'')}}
function services(){return CFG&&(CFG.settings_services||CFG.services)||[]}
function service(id){return services().find(function(x){return String(x.id)===String(id)})||null}
function operators(){return CFG&&CFG.operators||[]}
function assigned(svc){var a=svc&&Array.isArray(svc.operator_usernames)?svc.operator_usernames:[];return a.map(function(x){return String(x).toUpperCase()})}
function allowed(serviceId){var svc=service(serviceId),a=assigned(svc);return a.length?operators().filter(function(o){return a.indexOf(String(o.username).toUpperCase())>=0}):operators()}
function wrap(el,label,cls){if(!el||el.parentElement&&el.parentElement.classList.contains('oaSvcField'))return;var w=document.createElement('label');w.className='oaSvcField '+(cls||'');var sp=document.createElement('span');sp.textContent=label;el.parentNode.insertBefore(w,el);w.appendChild(sp);w.appendChild(el)}
function renderOperatorChecks(row){
  if(!CFG||!row||row.querySelector('.oaSvcOperators'))return;
  var svc=service(row.dataset.s);if(!svc)return;
  var box=document.createElement('div');box.className='oaSvcOperators';var chosen=assigned(svc);
  box.innerHTML='<div class="oaSvcOperatorsTitle">Operatori abilitati al servizio — puoi selezionarne più di uno</div><div class="oaSvcOperatorList"></div><div class="oaServiceOperatorsHint">Se non selezioni nessuno, il servizio resta disponibile a tutti gli operatori.</div>';
  var list=box.querySelector('.oaSvcOperatorList');
  operators().forEach(function(op){var u=String(op.username||''),lab=document.createElement('label');lab.className='oaSvcOperator'+(chosen.indexOf(u.toUpperCase())>=0?' on':'');lab.innerHTML='<input type="checkbox" value="'+u.replace(/"/g,'&quot;')+'" '+(chosen.indexOf(u.toUpperCase())>=0?'checked':'')+'><span></span>';lab.querySelector('span').textContent=u;list.appendChild(lab);var cb=lab.querySelector('input');cb.addEventListener('change',function(ev){ev.stopPropagation();lab.classList.toggle('on',cb.checked);saveOperators(row,box)})});
  row.appendChild(box)
}
var timers={};
function saveOperators(row,box){var id=row.dataset.s;clearTimeout(timers[id]);timers[id]=setTimeout(function(){var vals=Array.from(box.querySelectorAll('input[type=checkbox]:checked')).map(function(x){return x.value});box.classList.add('oaSvcOperatorSaving');api('service_operators_save',{id:id,operators:vals}).then(function(){setMsg('Operatori del servizio salvati.');return load(true)}).catch(function(e){setMsg(e.message,true)}).finally(function(){box.classList.remove('oaSvcOperatorSaving')})},180)}
function enhanceServices(){var root=E('oaServices');if(!root||!CFG)return;root.querySelectorAll('.oaService[data-s]').forEach(function(row){var sn=row.querySelector('.sn'),sd=row.querySelector('.sd'),sc=row.querySelector('.sc'),sr=row.querySelector('.oaRequiresStudio'),sa=row.querySelector('.sa');if(sn){sn.placeholder='Nome del servizio';sn.style.display='block';sn.removeAttribute('hidden')}wrap(sn,'Nome servizio','oaSvcNameField');wrap(sd,'Durata','oaSvcDurationField');wrap(sc,'Colore','oaSvcColorField');wrap(sr,'Studio','oaSvcStudioField');wrap(sa,'Stato','oaSvcActiveField');renderOperatorChecks(row)})}
function fillOperatorSelect(sel,serviceId,keep){if(!sel||!CFG)return;var a=allowed(serviceId),old=keep==null?sel.value:keep,blank=sel.id==='oaOperator';sel.innerHTML=(blank?'<option value="">Qualsiasi operatore</option>':'')+a.map(function(o){var u=String(o.username||'');return'<option value="'+u.replace(/"/g,'&quot;')+'">'+u+'</option>'}).join('');if(Array.from(sel.options).some(function(o){return o.value===old}))sel.value=old;else if(blank)sel.value='';else if(sel.options.length)sel.selectedIndex=0}
function syncNewOperator(){var ss=E('oaService'),op=E('oaOperator');if(ss&&op)fillOperatorSelect(op,ss.value,op.value)}
function enhanceRules(){if(!CFG)return;document.querySelectorAll('#oaRules .oaRule').forEach(function(row){var ss=row.querySelector('.rs'),ro=row.querySelector('.ro');if(!ss||!ro)return;fillOperatorSelect(ro,ss.value,ro.value);if(!ss.dataset.v5op){ss.dataset.v5op='1';ss.addEventListener('change',function(){fillOperatorSelect(ro,ss.value,ro.value)},true)}})}
function enhance(){enhanceServices();enhanceRules();syncNewOperator();var ss=E('oaService');if(ss&&!ss.dataset.v5bound){ss.dataset.v5bound='1';ss.addEventListener('change',function(){syncNewOperator()},true)}}
function load(force){if(busy&&!force)return Promise.resolve();busy=true;return api('bootstrap',{}).then(function(x){CFG=x;enhance();return x}).finally(function(){busy=false})}
function boot(){load(true).catch(function(e){console.error(e)});setTimeout(enhance,150)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
window.addEventListener('pageshow',function(){setTimeout(enhance,100)})
})();</script>'''

h=s.find('</head>')
if h<0: raise SystemExit('head non trovato')
s=s[:h]+style+s[h:]
b=s.rfind('</body>')
if b<0: raise SystemExit('body non trovato')
s=s[:b]+script+s[b:]
p.write_text(s,encoding='utf-8')
if MARK not in s or 'Operatori abilitati al servizio' not in s: raise SystemExit('Agenda V5 non inserita')
print('Appointments V5 multi-operator services OK')

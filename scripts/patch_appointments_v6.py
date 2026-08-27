from pathlib import Path

p=Path('_site/index.html')
s=p.read_text(encoding='utf-8')
MARK='OPTYKER_APPOINTMENTS_UI_V6'
if MARK in s:
    raise SystemExit(0)
if 'OPTYKER_APPOINTMENTS_UI_V5' not in s or 'id="oaRules"' not in s:
    raise SystemExit('Agenda V5 non disponibile')

style=r'''<style id="optykerAppointmentsV6Css">/* OPTYKER_APPOINTMENTS_UI_V6 */
#oaRules .oaRule .ro{display:none!important}
#oaRules{display:flex!important;flex-direction:column!important;gap:10px!important}
.oaAvailRow{display:grid!important;grid-template-columns:minmax(190px,1.4fr) minmax(150px,1fr) minmax(360px,2.2fr) 105px 105px 86px auto!important;gap:8px!important;align-items:end!important;padding:12px!important;border:1px solid #d8e3ea!important;border-radius:11px!important;background:#fff!important}
.oaAvailField{display:flex!important;flex-direction:column!important;gap:4px!important;min-width:0!important}.oaAvailField>span,.oaAvailDays>span{font-size:9px!important;font-weight:900!important;color:#5d7385!important;text-transform:uppercase!important;letter-spacing:.02em!important}.oaAvailField input,.oaAvailField select{width:100%!important;min-width:0!important;height:38px!important;border:1px solid #cbd8e2!important;border-radius:7px!important;padding:5px 7px!important;background:#fff!important;box-sizing:border-box!important}
.oaAvailDays{display:flex!important;flex-direction:column!important;gap:5px!important}.oaAvailDaysList{display:flex!important;gap:5px!important;flex-wrap:wrap!important;min-height:38px!important;align-items:center!important}.oaAvailDay{display:inline-flex!important;align-items:center!important;gap:4px!important;padding:7px 8px!important;border:1px solid #cbd8e2!important;border-radius:8px!important;background:#f9fbfc!important;font-size:9px!important;font-weight:900!important;color:#35566d!important;cursor:pointer!important;user-select:none!important}.oaAvailDay input{width:14px!important;height:14px!important;min-height:0!important;margin:0!important}.oaAvailDay.on{background:#edf7fd!important;border-color:#1769aa!important;color:#155d91!important}.oaAvailActions{display:flex!important;gap:5px!important;align-items:center!important}.oaAvailActions button{height:38px!important;white-space:nowrap!important}.oaAvailOperatorsHint{grid-column:1/-1!important;font-size:9px!important;color:#6d8191!important;margin-top:-2px!important}.oaAvailRow.saving{opacity:.6!important;pointer-events:none!important}
@media(max-width:1180px){.oaAvailRow{grid-template-columns:1.2fr 1fr 2fr 95px 95px 80px!important}.oaAvailActions{grid-column:1/-1!important;justify-content:flex-end!important}}
@media(max-width:820px){.oaAvailRow{grid-template-columns:1fr 1fr!important}.oaAvailDays{grid-column:1/-1!important}.oaAvailActions{grid-column:1/-1!important}.oaAvailOperatorsHint{grid-column:1/-1!important}}
@media(max-width:540px){.oaAvailRow{grid-template-columns:1fr!important}.oaAvailDays,.oaAvailActions,.oaAvailOperatorsHint{grid-column:1!important}.oaAvailActions{justify-content:stretch!important}.oaAvailActions button{flex:1!important}}
</style>'''

script=r'''<script id="optykerAppointmentsV6Js">(function(){/* OPTYKER_APPOINTMENTS_UI_V6 */
var CFG=null,busy=false,rendering=false;
var DAYN=['','Lunedì','Martedì','Mercoledì','Giovedì','Venerdì','Sabato','Domenica'];
function E(i){return document.getElementById(i)}
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function auth(){return window.OPTYKER_CLOUD&&OPTYKER_CLOUD.username}
function bootstrap(){
  if(!auth())return Promise.reject(Error('Sessione non autenticata'));
  return fetch(OPTYKER_CLOUD.root+'/rest/v1/rpc/optyker_appointments_api',{method:'POST',headers:{'Content-Type':'application/json','apikey':OPTYKER_CLOUD.key,'Authorization':'Bearer '+OPTYKER_CLOUD.key},body:JSON.stringify({p_username:OPTYKER_CLOUD.username,p_password:OPTYKER_CLOUD.password||'',p_action:'bootstrap',p_payload:{}})}).then(function(r){if(!r.ok)throw Error('Server '+r.status);return r.json()}).then(function(x){if(!x||x.ok===false)throw Error(x&&x.error||'Errore agenda');return x})
}
function availApi(action,payload){
  if(!auth())return Promise.reject(Error('Sessione non autenticata'));
  if(!OPTYKER_CLOUD.username||!OPTYKER_CLOUD.password){try{if(window.optykerShowLogin)window.optykerShowLogin()}catch(z){}return Promise.reject(Error('Sessione scaduta: accedi di nuovo con la password'))}return fetch(OPTYKER_CLOUD.root+'/rest/v1/rpc/optyker_availability_admin',{method:'POST',headers:{'Content-Type':'application/json','apikey':OPTYKER_CLOUD.key,'Authorization':'Bearer '+OPTYKER_CLOUD.key},body:JSON.stringify({p_username:OPTYKER_CLOUD.username,p_password:OPTYKER_CLOUD.password,p_action:action,p_payload:payload||{}})}).then(function(r){if(!r.ok)throw Error('Server '+r.status);return r.json()}).then(function(x){if(!x||x.ok===false){if(/non autorizzato/i.test(String(x&&x.error||''))){try{if(window.optykerShowLogin)window.optykerShowLogin()}catch(z){}}throw Error(x&&x.error||'Errore disponibilità')}return x})
}
function msg(t,b){var e=E('oaSettingsStatus');if(e){e.textContent=t||'';e.className='oaStatus'+(b?' bad':'')}}
function services(){return CFG&&(CFG.settings_services||CFG.services)||[]}
function service(id){return services().find(function(x){return String(x.id)===String(id)})||null}
function studios(){return (CFG&&(CFG.settings_studios||CFG.studios)||[]).filter(function(x){return x.active!==false})}
function groups(){
  var m=new Map();
  (CFG&&CFG.rules||[]).filter(function(r){return r.active!==false}).forEach(function(r){
    var k=[r.service_id,r.studio_id||'',String(r.start_time||'').slice(0,5),String(r.end_time||'').slice(0,5),r.slot_interval_minutes||15].join('|');
    var g=m.get(k);if(!g){g={service_id:r.service_id,studio_id:r.studio_id||'',start_time:String(r.start_time||'09:00').slice(0,5),end_time:String(r.end_time||'13:00').slice(0,5),slot_interval_minutes:r.slot_interval_minutes||15,weekdays:[],rule_ids:[]};m.set(k,g)}
    if(g.weekdays.indexOf(+r.weekday)<0)g.weekdays.push(+r.weekday);if(r.id)g.rule_ids.push(r.id)
  });
  return Array.from(m.values()).map(function(g){g.weekdays.sort(function(a,b){return a-b});return g}).sort(function(a,b){var sa=service(a.service_id),sb=service(b.service_id),na=sa&&sa.name||'',nb=sb&&sb.name||'';return na.localeCompare(nb,'it')||a.start_time.localeCompare(b.start_time)})
}
function field(label,el,cls){var w=document.createElement('label');w.className='oaAvailField '+(cls||'');var sp=document.createElement('span');sp.textContent=label;w.appendChild(sp);w.appendChild(el);return w}
function serviceSelect(value){var s=document.createElement('select');s.className='avService';s.innerHTML=services().map(function(x){return'<option value="'+esc(x.id)+'" '+(String(x.id)===String(value)?'selected':'')+'>'+esc(x.name)+(x.active===false?' (Off)':'')+'</option>'}).join('');return s}
function studioSelect(value){var s=document.createElement('select');s.className='avStudio';s.innerHTML='<option value="">Entrambi gli studi</option>'+studios().map(function(x){return'<option value="'+esc(x.id)+'" '+(String(x.id)===String(value)?'selected':'')+'>'+esc(x.name)+'</option>'}).join('');return s}
function timeInput(cls,value){var i=document.createElement('input');i.type='time';i.className=cls;i.value=value;return i}
function intervalInput(value){var i=document.createElement('input');i.type='number';i.min='5';i.max='240';i.step='5';i.className='avInterval';i.value=String(value||15);return i}
function dayBox(days){var w=document.createElement('div');w.className='oaAvailDays';var title=document.createElement('span');title.textContent='Giorni della settimana';w.appendChild(title);var list=document.createElement('div');list.className='oaAvailDaysList';for(var d=1;d<=7;d++){var lab=document.createElement('label');lab.className='oaAvailDay'+(days.indexOf(d)>=0?' on':'');var cb=document.createElement('input');cb.type='checkbox';cb.value=String(d);cb.checked=days.indexOf(d)>=0;var tx=document.createElement('span');tx.textContent=DAYN[d];cb.addEventListener('change',function(){this.parentElement.classList.toggle('on',this.checked)});lab.appendChild(cb);lab.appendChild(tx);list.appendChild(lab)}w.appendChild(list);return w}
function syncStudio(row){var ss=row.querySelector('.avService'),st=row.querySelector('.avStudio');if(!ss||!st)return;var sv=service(ss.value),needs=!sv||sv.requires_studio!==false;st.disabled=!needs;if(!needs){st.value='';st.title='Questo servizio non necessita di uno studio'}else st.title='Lascia Entrambi gli studi per rendere disponibile la fascia in entrambi'}
function makeRow(g,isNew){
  var row=document.createElement('div');row.className='oaAvailRow';row._ids=(g.rule_ids||[]).slice();row.dataset.new=isNew?'1':'0';
  var ss=serviceSelect(g.service_id);var st=studioSelect(g.studio_id||'');var ds=dayBox(g.weekdays||[]);var a=timeInput('avStart',g.start_time||'09:00'),z=timeInput('avEnd',g.end_time||'13:00'),iv=intervalInput(g.slot_interval_minutes||15);
  row.appendChild(field('Servizio',ss));row.appendChild(field('Studio',st));row.appendChild(ds);row.appendChild(field('Dalle',a));row.appendChild(field('Alle',z));row.appendChild(field('Intervallo min',iv));
  var ac=document.createElement('div');ac.className='oaAvailActions';var save=document.createElement('button');save.className='secondary avSave';save.type='button';save.textContent='Salva';var del=document.createElement('button');del.className='secondary avDelete';del.type='button';del.textContent=isNew?'Annulla':'Elimina';ac.appendChild(save);ac.appendChild(del);row.appendChild(ac);
  var hint=document.createElement('div');hint.className='oaAvailOperatorsHint';hint.textContent='Gli operatori vengono presi automaticamente da quelli abilitati nel servizio: qui non devi selezionare nessun nome utente.';row.appendChild(hint);
  ss.addEventListener('change',function(){syncStudio(row)});save.addEventListener('click',function(){saveRow(row)});del.addEventListener('click',function(){if(row.dataset.new==='1'){row.remove();return}deleteRow(row)});syncStudio(row);return row
}
function saveRow(row){
  var days=Array.from(row.querySelectorAll('.oaAvailDay input:checked')).map(function(x){return +x.value});if(!days.length){msg('Seleziona almeno un giorno della settimana.',true);return}
  var p={rule_ids:row._ids||[],service_id:row.querySelector('.avService').value,studio_id:row.querySelector('.avStudio').value,weekdays:days,start_time:row.querySelector('.avStart').value,end_time:row.querySelector('.avEnd').value,slot_interval_minutes:+row.querySelector('.avInterval').value||15};
  row.classList.add('saving');availApi('save',p).then(function(){msg('Disponibilità salvata.');return load(true)}).catch(function(e){msg(e.message,true)}).finally(function(){row.classList.remove('saving')})
}
function deleteRow(row){if(!confirm('Eliminare questa disponibilità?'))return;row.classList.add('saving');availApi('delete',{rule_ids:row._ids||[]}).then(function(){msg('Disponibilità eliminata.');return load(true)}).catch(function(e){msg(e.message,true)}).finally(function(){row.classList.remove('saving')})}
function updateHelp(){var root=E('oaRules');if(!root)return;var h=root.previousElementSibling;if(h&&h.classList.contains('oaHelp'))h.textContent='Scegli servizio, studio, uno o più giorni della settimana, orario e intervallo. Gli operatori vengono applicati automaticamente in base a quelli abilitati per il servizio.'}
function render(){if(rendering||!CFG)return;var root=E('oaRules');if(!root)return;rendering=true;try{updateHelp();root.innerHTML='';var gs=groups();if(!gs.length){var e=document.createElement('div');e.className='oaEmpty';e.textContent='Nessuna disponibilità';root.appendChild(e)}else gs.forEach(function(g){root.appendChild(makeRow(g,false))});var add=E('oaAddRule');if(add&&!add.dataset.v6){add.dataset.v6='1';add.onclick=function(ev){if(ev){ev.preventDefault();ev.stopPropagation()}addNew()}}}finally{rendering=false}}
function addNew(){if(!CFG||!services().filter(function(x){return x.active!==false}).length){msg('Crea prima un servizio.',true);return}var root=E('oaRules');if(root.querySelector('.oaEmpty'))root.innerHTML='';var first=services().find(function(x){return x.active!==false})||services()[0];var row=makeRow({service_id:first.id,studio_id:'',weekdays:[1],start_time:'09:00',end_time:'13:00',slot_interval_minutes:15,rule_ids:[]},true);root.insertBefore(row,root.firstChild);row.scrollIntoView({block:'nearest',behavior:'smooth'})}
function load(force){if(busy&&!force)return Promise.resolve();busy=true;return bootstrap().then(function(x){CFG=x;render();return x}).finally(function(){busy=false})}
function watch(){var root=E('oaRules');if(root&&root.querySelector('.oaRule')&&!rendering)load(true).catch(function(){});var m=E('oaSettingsModal');if(m&&m.classList.contains('open')&&!CFG)load(false).catch(function(){})}
function boot(){load(true).catch(function(e){console.error(e)});setTimeout(watch,200)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
document.addEventListener('click',function(ev){var b=ev.target&&ev.target.closest?ev.target.closest('#oaSettings'):null;if(b)setTimeout(function(){load(true).catch(function(){})},40)},true);
new MutationObserver(function(){setTimeout(watch,20)}).observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});
setInterval(watch,1800)
})();</script>'''

h=s.find('</head>')
if h<0: raise SystemExit('head non trovato')
s=s[:h]+style+s[h:]
b=s.rfind('</body>')
if b<0: raise SystemExit('body non trovato')
s=s[:b]+script+s[b:]
p.write_text(s,encoding='utf-8')
if MARK not in s or 'Giorni della settimana' not in s or 'nessun nome utente' not in s:
    raise SystemExit('Agenda V6 non inserita')
print('Appointments V6 multi-day availability without operator field OK')

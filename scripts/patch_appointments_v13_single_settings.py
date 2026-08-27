from pathlib import Path

p=Path('_site/index.html')
s=p.read_text(encoding='utf-8')
MARK='OPTYKER_APPOINTMENTS_UI_V13_SINGLE_SETTINGS'
if MARK in s:
    raise SystemExit(0)
if 'OPTYKER_APPOINTMENTS_UI_V12_SETTINGS_SAVE' not in s or 'id="optykerSettingsAgendaPane"' not in s:
    raise SystemExit('Agenda V12 non disponibile')

style=r'''<style id="optykerAppointmentsV13Css">/* OPTYKER_APPOINTMENTS_UI_V13_SINGLE_SETTINGS */
#oaSettings{display:inline-flex!important}
#optykerSettingsAgendaPane .oaSets,#optykerSettingsAgendaPane #oaSettingsStatus,#oaSettingsSaveBarV12{display:none!important}
#oaSettingsV13{display:block;width:100%;box-sizing:border-box}
.oa13Head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;padding-bottom:14px;border-bottom:1px solid #e3eaf0;margin-bottom:14px}
.oa13Title{font-size:18px;font-weight:900;color:#17324a}.oa13Sub{font-size:10px;color:#708494;margin-top:3px}
.oa13Reload{height:38px;border:1px solid #cbd8e2;border-radius:8px;background:#fff;color:#37546b;font-weight:800;padding:0 12px;cursor:pointer}
.oa13Section{border:1px solid #dbe5ec;border-radius:12px;background:#fff;padding:14px;margin:12px 0}.oa13SectionHead{display:flex;justify-content:space-between;gap:10px;align-items:center;margin-bottom:8px}.oa13SectionHead b{font-size:14px;color:#17324a}.oa13Help{font-size:9px;color:#738696;line-height:1.45;margin-bottom:10px}
.oa13Add{height:36px;border:1px solid #cbd8e2;border-radius:8px;background:#f9fbfd;color:#294b63;font-size:10px;font-weight:900;padding:0 11px;cursor:pointer}
.oa13Services,.oa13Studios,.oa13Rules,.oa13Hours{display:grid;gap:9px}
.oa13Service{display:grid;grid-template-columns:minmax(220px,2fr) 92px 70px 115px 82px auto;gap:8px;align-items:end;padding:11px;border:1px solid #e0e8ee;border-radius:10px;background:#fbfdfe}
.oa13Operators{grid-column:1/-1;border-top:1px solid #e5ebef;padding-top:8px}.oa13OperatorsTitle{font-size:9px;font-weight:900;color:#5f7587;margin-bottom:6px}.oa13OperatorList{display:flex;flex-wrap:wrap;gap:6px}.oa13Operator{display:inline-flex;align-items:center;gap:5px;border:1px solid #cbd8e2;border-radius:8px;background:#fff;padding:6px 8px;font-size:9px;font-weight:800;color:#35566d}.oa13Operator input{width:14px;height:14px;margin:0}
.oa13Field{display:flex;flex-direction:column;gap:4px;min-width:0}.oa13Field>span{font-size:8px;font-weight:900;text-transform:uppercase;color:#667d8f}.oa13Field input,.oa13Field select{height:37px;border:1px solid #cbd8e2;border-radius:7px;background:#fff;padding:5px 7px;min-width:0;width:100%;box-sizing:border-box}.oa13Field input[type=color]{padding:3px}
.oa13Delete{height:37px;border:1px solid #efc9c4;border-radius:7px;background:#fff7f6;color:#a52a1d;font-size:9px;font-weight:900;padding:0 9px;cursor:pointer}
.oa13Studios{grid-template-columns:repeat(2,minmax(240px,1fr))}.oa13Studio{display:grid;grid-template-columns:minmax(0,1fr) 92px auto;gap:8px;align-items:end;padding:10px;border:1px solid #e0e8ee;border-radius:10px;background:#fbfdfe}
.oa13Hour{display:grid;grid-template-columns:105px 90px repeat(4,minmax(95px,1fr));gap:8px;align-items:center;padding:8px;border:1px solid #e0e8ee;border-radius:9px;background:#fff}.oa13Hour b{font-size:10px;color:#17324a}.oa13Hour input,.oa13Hour select{height:35px;border:1px solid #cbd8e2;border-radius:7px;padding:4px 6px;min-width:0;width:100%;box-sizing:border-box}
.oa13Rule{display:grid;grid-template-columns:minmax(180px,1.2fr) minmax(330px,2fr) 100px 100px 90px auto;gap:8px;align-items:end;padding:11px;border:1px solid #e0e8ee;border-radius:10px;background:#fbfdfe}.oa13Days{display:flex;flex-direction:column;gap:4px}.oa13Days>span{font-size:8px;font-weight:900;text-transform:uppercase;color:#667d8f}.oa13DayList{display:flex;gap:5px;flex-wrap:wrap}.oa13Day{display:inline-flex;align-items:center;gap:4px;border:1px solid #cbd8e2;border-radius:7px;background:#fff;padding:6px 7px;font-size:8px;font-weight:800;color:#35566d}.oa13Day input{width:13px;height:13px;margin:0}
.oa13Empty{padding:18px;text-align:center;color:#8393a0;font-size:10px;border:1px dashed #d3dee6;border-radius:9px}
.oa13SaveBar{position:sticky;bottom:0;z-index:60;display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:15px;padding:13px 14px;border:1px solid #c9dce9;border-radius:12px;background:rgba(255,255,255,.98);box-shadow:0 -5px 20px rgba(23,50,74,.09)}.oa13Status{font-size:10px;color:#647b8d;min-height:16px}.oa13Status.bad{color:#b42323}.oa13Save{min-width:190px;height:42px;border:0;border-radius:9px;background:#1769aa;color:#fff;font-size:11px;font-weight:900;cursor:pointer;padding:0 18px}.oa13Save:disabled{opacity:.55;cursor:wait}
.oa13Loading{padding:30px;text-align:center;color:#728697;font-size:11px}
@media(max-width:1000px){.oa13Service{grid-template-columns:1fr 1fr 1fr}.oa13Operators{grid-column:1/-1}.oa13Rule{grid-template-columns:1fr 1fr 1fr}.oa13Days{grid-column:1/-1}.oa13Hour{grid-template-columns:95px 80px 1fr 1fr}.oa13Studios{grid-template-columns:1fr}}
@media(max-width:620px){.oa13Service,.oa13Rule,.oa13Studio,.oa13Hour{grid-template-columns:1fr 1fr}.oa13Service .oa13Name,.oa13Operators,.oa13Rule .oa13ServiceField,.oa13Days{grid-column:1/-1}.oa13SaveBar{position:static;flex-direction:column;align-items:stretch}.oa13Save{width:100%}}
</style>'''

script=r'''<script id="optykerAppointmentsV13Js">(function(){/* OPTYKER_APPOINTMENTS_UI_V13_SINGLE_SETTINGS */
var D={loaded:false,operators:[],services:[],studios:[],hours:[],rules:[],deletedServices:[],deletedStudios:[],seq:0,busy:false};
var DAYS=['','Lunedì','Martedì','Mercoledì','Giovedì','Venerdì','Sabato','Domenica'],SHORT=['','Lun','Mar','Mer','Gio','Ven','Sab','Dom'];
function E(i){return document.getElementById(i)}
function X(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function key(){D.seq++;return 'new-'+Date.now()+'-'+D.seq}
function cloud(){if(!window.OPTYKER_CLOUD||!OPTYKER_CLOUD.username||!OPTYKER_CLOUD.password)throw Error('Sessione non autenticata: accedi di nuovo con la password.');return OPTYKER_CLOUD}
function rpc(action,payload){var c=cloud();return fetch(c.root+'/rest/v1/rpc/optyker_agenda_settings_v13',{method:'POST',headers:{'Content-Type':'application/json','apikey':c.key,'Authorization':'Bearer '+c.key},body:JSON.stringify({p_username:c.username,p_password:c.password,p_action:action,p_payload:payload||{}})}).then(function(r){if(!r.ok)throw Error('Server '+r.status);return r.json()}).then(function(x){if(!x||x.ok===false)throw Error(x&&x.error||'Errore impostazioni Agenda');return x})}
function status(t,bad){var e=E('oa13Status');if(e){e.textContent=t||'';e.className='oa13Status'+(bad?' bad':'')}}
function groupRules(a){var m={};(a||[]).forEach(function(r){var k=[r.service_id,String(r.start_time||'').slice(0,5),String(r.end_time||'').slice(0,5),r.slot_interval_minutes||15].join('|');if(!m[k])m[k]={service_id:String(r.service_id||''),service_key:String(r.service_id||''),weekdays:[],start_time:String(r.start_time||'09:00').slice(0,5),end_time:String(r.end_time||'13:00').slice(0,5),slot_interval_minutes:+r.slot_interval_minutes||15};if(m[k].weekdays.indexOf(+r.weekday)<0)m[k].weekdays.push(+r.weekday)});return Object.keys(m).map(function(k){m[k].weekdays.sort(function(a,b){return a-b});return m[k]})}
function mount(){
  var pane=E('optykerSettingsAgendaPane');if(!pane)return false;var box=pane.querySelector('.oaSettingsEmbedded');if(!box)return false;
  if(E('oaSettingsV13'))return true;
  box.insertAdjacentHTML('afterbegin','<div id="oaSettingsV13"><div class="oa13Head"><div><div class="oa13Title">Impostazioni agenda</div><div class="oa13Sub">Servizi, studi, orari e disponibilità. Un solo caricamento e un solo salvataggio.</div></div><button id="oa13Reload" class="oa13Reload" type="button">Ricarica</button></div><div id="oa13Body"><div class="oa13Loading">Apri Agenda e prenotazioni per caricare le impostazioni.</div></div><div class="oa13SaveBar"><div id="oa13Status" class="oa13Status"></div><button id="oa13Save" class="oa13Save" type="button" disabled>SALVA MODIFICHE</button></div></div>');
  E('oa13Reload').onclick=load;E('oa13Save').onclick=save;
  return true
}
function field(label,html,cls){return '<label class="oa13Field '+(cls||'')+'"><span>'+X(label)+'</span>'+html+'</label>'}
function serviceOptions(val){return D.services.map(function(s){return '<option value="'+X(s.key)+'" '+(String(s.key)===String(val)?'selected':'')+'>'+X(s.name||'Nuovo servizio')+'</option>'}).join('')}
function renderServices(){var root=E('oa13Services');if(!root)return;if(!D.services.length){root.innerHTML='<div class="oa13Empty">Nessun servizio</div>';return}root.innerHTML=D.services.map(function(s){var ops=D.operators.map(function(o){var on=(s.operators||[]).map(function(x){return String(x).toUpperCase()}).indexOf(String(o).toUpperCase())>=0;return '<label class="oa13Operator"><input type="checkbox" value="'+X(o)+'" '+(on?'checked':'')+'><span>'+X(o)+'</span></label>'}).join('');return '<div class="oa13Service" data-key="'+X(s.key)+'" data-id="'+X(s.id||'')+'">'+field('Nome','<input class="oa13Sn" value="'+X(s.name||'')+'">','oa13Name')+field('Durata min','<input class="oa13Sd" type="number" min="5" step="5" value="'+X(s.duration_minutes||30)+'">')+field('Colore','<input class="oa13Sc" type="color" value="'+X(s.color||'#1769aa')+'">')+field('Studio','<select class="oa13Sr"><option value="true" '+(s.requires_studio!==false?'selected':'')+'>Richiesto</option><option value="false" '+(s.requires_studio===false?'selected':'')+'>Non richiesto</option></select>')+field('Stato','<select class="oa13Sa"><option value="true" '+(s.active!==false?'selected':'')+'>On</option><option value="false" '+(s.active===false?'selected':'')+'>Off</option></select>')+'<button class="oa13Delete oa13DelService" type="button">Elimina</button><div class="oa13Operators"><div class="oa13OperatorsTitle">Operatori abilitati al servizio</div><div class="oa13OperatorList">'+ops+'</div></div></div>'}).join('');root.querySelectorAll('.oa13DelService').forEach(function(b){b.onclick=function(){delService(b.closest('.oa13Service').dataset.key)}})}
function renderStudios(){var root=E('oa13Studios');if(!root)return;if(!D.studios.length){root.innerHTML='<div class="oa13Empty">Nessuno studio</div>';return}root.innerHTML=D.studios.map(function(s){return '<div class="oa13Studio" data-key="'+X(s.key)+'" data-id="'+X(s.id||'')+'">'+field('Nome studio','<input class="oa13Stn" value="'+X(s.name||'')+'">')+field('Stato','<select class="oa13Sta"><option value="true" '+(s.active!==false?'selected':'')+'>On</option><option value="false" '+(s.active===false?'selected':'')+'>Off</option></select>')+'<button class="oa13Delete oa13DelStudio" type="button">Elimina</button></div>'}).join('');root.querySelectorAll('.oa13DelStudio').forEach(function(b){b.onclick=function(){delStudio(b.closest('.oa13Studio').dataset.key)}})}
function renderHours(){var root=E('oa13Hours');if(!root)return;var map={};(D.hours||[]).forEach(function(h){map[+h.weekday]=h});var a=[];for(var d=1;d<=7;d++){var h=map[d]||{weekday:d,active:d!==7,start_time:d===7?'00:00':'09:00',end_time:d===7?'23:59':'13:00',start_time_2:d===7?'':'15:00',end_time_2:d===7?'':'19:00'};a.push(h)}D.hours=a;root.innerHTML=a.map(function(h){return '<div class="oa13Hour" data-day="'+h.weekday+'"><b>'+DAYS[h.weekday]+'</b><select class="oa13Ha"><option value="true" '+(h.active?'selected':'')+'>Aperto</option><option value="false" '+(!h.active?'selected':'')+'>Chiuso</option></select><input class="oa13H1s" type="time" value="'+X(h.start_time||'')+'"><input class="oa13H1e" type="time" value="'+X(h.end_time||'')+'"><input class="oa13H2s" type="time" value="'+X(h.start_time_2||'')+'"><input class="oa13H2e" type="time" value="'+X(h.end_time_2||'')+'"></div>'}).join('')}
function renderRules(){var root=E('oa13Rules');if(!root)return;if(!D.rules.length){root.innerHTML='<div class="oa13Empty">Nessuna disponibilità</div>';return}root.innerHTML=D.rules.map(function(r,i){var days='';for(var d=1;d<=7;d++){days+='<label class="oa13Day"><input type="checkbox" value="'+d+'" '+((r.weekdays||[]).indexOf(d)>=0?'checked':'')+'><span>'+SHORT[d]+'</span></label>'}return '<div class="oa13Rule" data-i="'+i+'">'+field('Servizio','<select class="oa13Rs">'+serviceOptions(r.service_key||r.service_id)+'</select>','oa13ServiceField')+'<div class="oa13Days"><span>Giorni</span><div class="oa13DayList">'+days+'</div></div>'+field('Dalle','<input class="oa13Ra" type="time" value="'+X(r.start_time||'09:00')+'">')+field('Alle','<input class="oa13Rz" type="time" value="'+X(r.end_time||'13:00')+'">')+field('Intervallo','<input class="oa13Ri" type="number" min="5" step="5" value="'+X(r.slot_interval_minutes||15)+'">')+'<button class="oa13Delete oa13DelRule" type="button">Elimina</button></div>'}).join('');root.querySelectorAll('.oa13DelRule').forEach(function(b){b.onclick=function(){snapshot();D.rules.splice(+b.closest('.oa13Rule').dataset.i,1);render()}})}
function render(){
  var body=E('oa13Body');if(!body)return;
  body.innerHTML='<div class="oa13Section"><div class="oa13SectionHead"><b>Servizi</b><button id="oa13AddService" class="oa13Add" type="button">+ Servizio</button></div><div class="oa13Help">Nome, durata, colore, necessità dello studio e operatori abilitati.</div><div id="oa13Services" class="oa13Services"></div></div><div class="oa13Section"><div class="oa13SectionHead"><b>Studi</b><button id="oa13AddStudio" class="oa13Add" type="button">+ Studio</button></div><div id="oa13Studios" class="oa13Studios"></div></div><div class="oa13Section"><div class="oa13SectionHead"><b>Negozio</b></div><div class="oa13Help">Giorni e fasce orarie in cui il negozio accetta appuntamenti.</div><div id="oa13Hours" class="oa13Hours"></div></div><div class="oa13Section"><div class="oa13SectionHead"><b>Disponibilità</b><button id="oa13AddRule" class="oa13Add" type="button">+ Disponibilità</button></div><div class="oa13Help">Agenda unica: scegli servizio, giorni, fascia oraria e intervallo. Optyker assegna automaticamente lo studio libero.</div><div id="oa13Rules" class="oa13Rules"></div></div>';
  renderServices();renderStudios();renderHours();renderRules();
  E('oa13AddService').onclick=function(){snapshot();D.services.push({id:null,key:key(),name:'Nuovo servizio',duration_minutes:30,color:'#1769aa',requires_studio:true,active:true,operators:[]});render()};
  E('oa13AddStudio').onclick=function(){snapshot();D.studios.push({id:null,key:key(),name:'Nuovo studio',active:true});render()};
  E('oa13AddRule').onclick=function(){snapshot();if(!D.services.length){status('Crea prima un servizio.',true);return}D.rules.push({service_id:'',service_key:D.services[0].key,weekdays:[1],start_time:'09:00',end_time:'13:00',slot_interval_minutes:15});render()};
}
function snapshot(){
  if(!D.loaded)return;
  var sr=E('oa13Services');if(sr)D.services=Array.from(sr.querySelectorAll('.oa13Service')).map(function(r){return{id:r.dataset.id||null,key:r.dataset.key,name:(r.querySelector('.oa13Sn').value||'').trim(),duration_minutes:+r.querySelector('.oa13Sd').value||30,color:r.querySelector('.oa13Sc').value||'#1769aa',requires_studio:r.querySelector('.oa13Sr').value==='true',active:r.querySelector('.oa13Sa').value==='true',operators:Array.from(r.querySelectorAll('.oa13Operator input:checked')).map(function(x){return x.value})}});
  var st=E('oa13Studios');if(st)D.studios=Array.from(st.querySelectorAll('.oa13Studio')).map(function(r){return{id:r.dataset.id||null,key:r.dataset.key,name:(r.querySelector('.oa13Stn').value||'').trim(),active:r.querySelector('.oa13Sta').value==='true'}});
  var hr=E('oa13Hours');if(hr)D.hours=Array.from(hr.querySelectorAll('.oa13Hour')).map(function(r){return{weekday:+r.dataset.day,active:r.querySelector('.oa13Ha').value==='true',start_time:r.querySelector('.oa13H1s').value,end_time:r.querySelector('.oa13H1e').value,start_time_2:r.querySelector('.oa13H2s').value,end_time_2:r.querySelector('.oa13H2e').value}});
  var rr=E('oa13Rules');if(rr)D.rules=Array.from(rr.querySelectorAll('.oa13Rule')).map(function(r){var sk=r.querySelector('.oa13Rs').value,sv=D.services.find(function(s){return s.key===sk});return{service_id:sv&&sv.id?sv.id:'',service_key:sk,weekdays:Array.from(r.querySelectorAll('.oa13Day input:checked')).map(function(x){return+x.value}),start_time:r.querySelector('.oa13Ra').value,end_time:r.querySelector('.oa13Rz').value,slot_interval_minutes:+r.querySelector('.oa13Ri').value||15}});
}
function delService(k){snapshot();var s=D.services.find(function(x){return x.key===k});if(!s)return;if(!confirm('Eliminare questo servizio?'))return;if(s.id)D.deletedServices.push(s.id);D.services=D.services.filter(function(x){return x.key!==k});D.rules=D.rules.filter(function(r){return r.service_key!==k&&String(r.service_id)!==String(s.id||'')});render()}
function delStudio(k){snapshot();var s=D.studios.find(function(x){return x.key===k});if(!s)return;if(!confirm('Eliminare questo studio?'))return;if(s.id)D.deletedStudios.push(s.id);D.studios=D.studios.filter(function(x){return x.key!==k});render()}
function load(){
  if(D.busy)return;D.busy=true;var b=E('oa13Save');if(b)b.disabled=true;status('Caricamento impostazioni…');
  rpc('load',{}).then(function(x){D.loaded=true;D.operators=x.operators||[];D.services=(x.services||[]).map(function(s){s.key=s.key||String(s.id);return s});D.studios=(x.studios||[]).map(function(s){s.key=s.key||String(s.id);return s});D.hours=x.hours||[];D.rules=groupRules(x.rules||[]);D.deletedServices=[];D.deletedStudios=[];render();status('Impostazioni caricate. Modifica i campi e premi Salva modifiche.');if(b)b.disabled=false}).catch(function(e){D.loaded=false;status(e.message||'Impossibile caricare le impostazioni.',true);var body=E('oa13Body');if(body)body.innerHTML='<div class="oa13Loading">Impossibile caricare le impostazioni. Premi Ricarica.</div>'}).finally(function(){D.busy=false})
}
function save(){
  if(D.busy||!D.loaded)return;snapshot();
  if(!D.services.length){status('Deve esistere almeno un servizio.',true);return}
  for(var i=0;i<D.services.length;i++){if(!D.services[i].name){status('Il nome del servizio è obbligatorio.',true);return}}
  for(var j=0;j<D.studios.length;j++){if(!D.studios[j].name){status('Il nome dello studio è obbligatorio.',true);return}}
  for(var k=0;k<D.rules.length;k++){if(!D.rules[k].weekdays.length||!D.rules[k].start_time||!D.rules[k].end_time){status('Completa giorni e orari di ogni disponibilità.',true);return}}
  D.busy=true;var b=E('oa13Save');b.disabled=true;b.textContent='SALVATAGGIO…';status('Salvataggio impostazioni…');
  rpc('save_all',{loaded:true,services:D.services,studios:D.studios,hours:D.hours,rules:D.rules,deleted_service_ids:D.deletedServices,deleted_studio_ids:D.deletedStudios}).then(function(){status('Impostazioni agenda salvate correttamente.');return rpc('load',{})}).then(function(x){D.loaded=true;D.operators=x.operators||[];D.services=(x.services||[]).map(function(s){s.key=s.key||String(s.id);return s});D.studios=(x.studios||[]).map(function(s){s.key=s.key||String(s.id);return s});D.hours=x.hours||[];D.rules=groupRules(x.rules||[]);D.deletedServices=[];D.deletedStudios=[];render();status('Impostazioni agenda salvate correttamente.')}).catch(function(e){status(e.message||'Errore durante il salvataggio.',true);if(/non autorizzato|non autenticata/i.test(String(e.message||e))){try{if(window.optykerShowLogin)window.optykerShowLogin()}catch(z){}}}).finally(function(){D.busy=false;b.disabled=!D.loaded;b.textContent='SALVA MODIFICHE'})
}
function show(){
  if(!mount())return false;var pane=E('optykerSettingsAgendaPane'),wa=E('optykerSettingsWhatsAppPane'),a=E('optykerSettingsAgenda'),w=E('optykerSettingsWhatsApp');
  if(wa)wa.classList.remove('open');if(pane)pane.classList.add('open');if(a)a.classList.add('active');if(w)w.classList.remove('active');
  if(!D.loaded&&!D.busy)load();return true
}
function open(){
  try{if(window.optykerOpenSettings)window.optykerOpenSettings()}catch(e){}
  var n=0;(function wait(){n++;if(show())return;if(n<25)setTimeout(wait,50)})()
}
window.optykerOpenAgendaSettingsV13=open;
function bind(){
  if(!mount())return;
  var b=E('oaSettings');if(b){b.style.setProperty('display','inline-flex','important');b.onclick=function(ev){if(ev){ev.preventDefault();ev.stopPropagation()}open();return false}}
  var a=E('optykerSettingsAgenda');if(a)a.onclick=function(ev){if(ev){ev.preventDefault();ev.stopPropagation()}show();return false}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){bind();setTimeout(bind,250)});else{bind();setTimeout(bind,250)}
window.addEventListener('pageshow',bind);setTimeout(bind,900);
})();</script>'''

h=s.find('</head>')
if h<0: raise SystemExit('head non trovato')
s=s[:h]+style+s[h:]
b=s.rfind('</body>')
if b<0: raise SystemExit('body non trovato')
s=s[:b]+script+s[b:]
p.write_text(s,encoding='utf-8')
for req in [MARK,'optyker_agenda_settings_v13','SALVA MODIFICHE','oaSettingsV13','window.optykerOpenAgendaSettingsV13']:
    if req not in s: raise SystemExit('V13 incompleta: '+req)
print('Appointments V13 single settings UI OK')

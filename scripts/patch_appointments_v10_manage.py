from pathlib import Path

p=Path('_site/index.html')
s=p.read_text(encoding='utf-8')
MARK='OPTYKER_APPOINTMENTS_UI_V10_MANAGE'
if MARK in s:
    raise SystemExit(0)
if 'OPTYKER_APPOINTMENTS_UI_V9_GRAPHICS' not in s or 'id="oaCalendar"' not in s:
    raise SystemExit('Agenda V9 non disponibile')

css=r'''<style id="optykerAppointmentsV10ManageCss">/* OPTYKER_APPOINTMENTS_UI_V10_MANAGE */
#oaManageModal{z-index:126500}.oaV10Card{width:min(980px,100%)}.oaV10DetailGrid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:14px}.oaV10Detail{border:1px solid #dde7ee;border-radius:9px;background:#f8fbfd;padding:9px}.oaV10Detail b{display:block;font-size:9px;text-transform:uppercase;color:#718494;margin-bottom:3px}.oaV10Detail span{font-size:11px;font-weight:800;color:#17324a;word-break:break-word}.oaV10EditGrid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.oaV10F.wide{grid-column:1/-1}.oaV10F label{display:block;font-size:10px;font-weight:900;color:#526b7f;margin-bottom:4px}.oaV10F input,.oaV10F select,.oaV10F textarea{width:100%;min-height:41px;border:1px solid #cbd8e2;border-radius:8px;padding:8px;box-sizing:border-box;background:#fff;color:#17324a}.oaV10F textarea{min-height:72px}.oaV10Availability{grid-column:1/-1;border-top:1px solid #e0e8ee;margin-top:4px;padding-top:11px}.oaV10Label{font-size:11px;font-weight:900;color:#17324a;margin-bottom:6px}.oaV10Help{font-size:9px;color:#718494;margin-bottom:7px}.oaV10Times,.oaV10Studios{display:flex;gap:6px;flex-wrap:wrap;min-height:42px}.oaV10Time,.oaV10Studio{border:1px solid #bcd0de;border-radius:8px;background:#f5faff;color:#173e69;padding:8px 10px;font-size:10px;font-weight:900;cursor:pointer}.oaV10Time.on,.oaV10Studio.on{background:#1769aa;color:#fff;border-color:#1769aa}.oaV10Status{font-size:10px;min-height:18px;margin-top:8px;color:#5f7587}.oaV10Status.bad{color:#b42323}.oaV10Bottom{display:flex;gap:8px;justify-content:flex-end;margin-top:14px}.oaV10Cancel{background:#b42323!important;color:#fff!important;border-color:#b42323!important}.oaV10ReadOnly{opacity:.68}.oaEvent{cursor:pointer!important}.oaEvent:after{content:'Apri';float:right;font-size:8px;color:#1769aa;font-weight:900;margin-top:4px}
@media(max-width:760px){.oaV10DetailGrid{grid-template-columns:1fr 1fr}.oaV10EditGrid{grid-template-columns:1fr}.oaV10F.wide,.oaV10Availability{grid-column:auto}.oaV10Bottom{flex-direction:column}.oaV10Bottom button{width:100%}}
</style>'''

i=s.find('</head>')
if i<0: raise SystemExit('head non trovato')
s=s[:i]+css+s[i:]

html=r'''<div id="oaManageModal" class="oaModal"><div class="oaCard oaV10Card"><div class="oaMh"><div><div class="oaMt">Dettaglio appuntamento</div><div id="oaV10Subtitle" class="oaSub"></div></div><button id="oaV10Close" class="oaClose" type="button">×</button></div>
<div id="oaV10Details" class="oaV10DetailGrid"></div>
<div class="oaV10EditGrid">
<div class="oaV10F"><label>Servizio</label><select id="oaV10Service"></select></div>
<div class="oaV10F"><label>Data</label><input id="oaV10Date" type="date"></div>
<div class="oaV10F"><label>Stato</label><select id="oaV10State"><option value="confirmed">Confermato</option><option value="pending">In attesa</option><option value="completed">Completato</option><option value="no_show">Assente</option><option value="cancelled">Annullato</option></select></div>
<div class="oaV10F"><label>Nome</label><input id="oaV10First"></div>
<div class="oaV10F"><label>Cognome</label><input id="oaV10Last"></div>
<div class="oaV10F"><label>Email</label><input id="oaV10Email" type="email"></div>
<div class="oaV10F"><label>Telefono</label><input id="oaV10Phone" type="tel"></div>
<div class="oaV10F wide"><label>Note</label><textarea id="oaV10Notes"></textarea></div>
<div class="oaV10Availability"><div class="oaV10Label">Fascia oraria disponibile</div><div class="oaV10Help">Gli orari sono ogni 15 minuti. Scegli l’orario e, per le visite che lo richiedono, lo studio libero.</div><div id="oaV10Times" class="oaV10Times"></div><div id="oaV10StudioWrap" style="display:none;margin-top:10px"><div class="oaV10Label">Studio disponibile</div><div id="oaV10Studios" class="oaV10Studios"></div></div></div>
</div>
<div id="oaV10Status" class="oaV10Status"></div>
<div class="oaV10Bottom"><button id="oaV10Cancel" class="secondary oaV10Cancel" type="button">Annulla appuntamento</button><button id="oaV10Save" class="primary" type="button">Salva modifiche</button></div>
</div></div>'''

i=s.rfind('</body>')
if i<0: raise SystemExit('body non trovato')
s=s[:i]+html+s[i:]

js=r'''<script id="optykerAppointmentsV10ManageJs">(function(){/* OPTYKER_APPOINTMENTS_UI_V10_MANAGE */
function E(i){return document.getElementById(i)}
function X(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function z(n){return String(n).padStart(2,'0')}
function localYmd(v){var d=new Date(v),p=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d),o={};p.forEach(function(x){o[x.type]=x.value});return o.year+'-'+o.month+'-'+o.day}
function dt(v){return new Intl.DateTimeFormat('it-IT',{timeZone:'Europe/Rome',weekday:'short',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(v))}
function tm(v){return new Intl.DateTimeFormat('it-IT',{timeZone:'Europe/Rome',hour:'2-digit',minute:'2-digit'}).format(new Date(v))}
function st(v){return v==='cancelled'?'Annullato':v==='completed'?'Completato':v==='no_show'?'Assente':'Confermato'}
var M={item:null,boot:null,raw:[],selected:null};
function hdr(){if(!window.OPTYKER_CLOUD||!OPTYKER_CLOUD.root||!OPTYKER_CLOUD.key)throw Error('Sessione Optyker non disponibile');return {'Content-Type':'application/json','apikey':OPTYKER_CLOUD.key,'Authorization':'Bearer '+OPTYKER_CLOUD.key}}
function rpc(name,body){return fetch(OPTYKER_CLOUD.root+'/rest/v1/rpc/'+name,{method:'POST',headers:hdr(),body:JSON.stringify(body||{})}).then(function(r){return r.json().then(function(x){if(!r.ok||!x||x.ok===false)throw Error(x&&x.error||x&&x.message||('Server '+r.status));return x})})}
function staffApi(action,payload){return rpc('optyker_appointments_api',{p_username:OPTYKER_CLOUD.username,p_password:OPTYKER_CLOUD.password||'',p_action:action,p_payload:payload||{}})}
function msg(t,b){var e=E('oaV10Status');if(e){e.textContent=t||'';e.className='oaV10Status'+(b?' bad':'')}}
function option(arr,val,key,label){return (arr||[]).map(function(x){var v=x[key],l=x[label];return'<option value="'+X(v)+'" '+(String(v)===String(val)?'selected':'')+'>'+X(l)+'</option>'}).join('')}
function details(a){var x=[['ID appuntamento',a.id],['Stato',st(a.status)],['Servizio',a.service_name],['Inizio',dt(a.starts_at)],['Fine',dt(a.ends_at)],['Studio',a.studio_name],['Operatore',a.operator_username],['Cliente',((a.first_name||'')+' '+(a.last_name||'')).trim()],['Email',a.email],['Telefono',a.phone],['Origine',a.source],['Creato da',a.created_by||'—'],['Creato il',dt(a.created_at)],['Ultima modifica',dt(a.updated_at)],['Note',a.notes||'—']];E('oaV10Details').innerHTML=x.map(function(r){return'<div class="oaV10Detail"><b>'+X(r[0])+'</b><span>'+X(r[1]||'—')+'</span></div>'}).join('')}
function fill(a){M.item=a;M.selected={starts_at:a.starts_at,ends_at:a.ends_at,studio_id:a.studio_id,studio_name:a.studio_name,operator_username:a.operator_username,rule_id:null};details(a);E('oaV10Subtitle').textContent=(a.service_name||'Appuntamento')+' · '+dt(a.starts_at);E('oaV10Service').innerHTML=option(M.boot.services,a.service_id,'id','name');E('oaV10State').value=a.status||'confirmed';E('oaV10Date').value=localYmd(a.starts_at);E('oaV10Date').min=localYmd(new Date());E('oaV10First').value=a.first_name||'';E('oaV10Last').value=a.last_name||'';E('oaV10Email').value=a.email||'';E('oaV10Phone').value=a.phone||'';E('oaV10Notes').value=a.notes||'';E('oaV10Cancel').style.display=a.status==='cancelled'?'none':'';loadSlots(true)}
function openItem(a){if(!a)return;msg('Caricamento…');Promise.resolve(M.boot||staffApi('bootstrap',{})).then(function(b){M.boot=b;fill(a);E('oaManageModal').classList.add('open');msg('')}).catch(function(e){alert(e.message)})}
function openById(id){if(!id)return;msg('Caricamento appuntamento…');staffManage('get',{id:id}).then(function(x){openItem(x.data||x)}).catch(function(e){msg('');alert(e.message)})}
function group(raw){var m=new Map();(raw||[]).forEach(function(x){var k=String(x.starts_at||'');if(k){if(!m.has(k))m.set(k,[]);m.get(k).push(x)}});return Array.from(m.entries()).sort(function(a,b){return new Date(a[0])-new Date(b[0])})}
function loadSlots(keepCurrent){if(!M.item||!E('oaV10Service').value||!E('oaV10Date').value)return;msg('Verifico le disponibilità…');staffManage('slots',{service_id:E('oaV10Service').value,date:E('oaV10Date').value,operator_username:null,studio_id:null,ignore_appointment_id:M.item.id}).then(function(x){M.raw=x.data||[];var g=group(M.raw);E('oaV10Times').innerHTML=g.length?g.map(function(r){var same=keepCurrent&&String(r[0])===String(M.item.starts_at);return'<button type="button" class="oaV10Time '+(same?'on':'')+'" data-t="'+X(r[0])+'">'+X(tm(r[0]))+'</button>'}).join(''):'<span class="oaEmpty">Nessuna fascia disponibile.</span>';E('oaV10StudioWrap').style.display='none';E('oaV10Times').querySelectorAll('.oaV10Time').forEach(function(b){b.onclick=function(){chooseTime(b.dataset.t,b)}});if(keepCurrent){var btn=[].slice.call(E('oaV10Times').querySelectorAll('.oaV10Time')).find(function(b){return String(b.dataset.t)===String(M.item.starts_at)});if(btn)chooseTime(btn.dataset.t,btn,true)}msg('')}).catch(function(e){E('oaV10Times').innerHTML='';msg(e.message,true)})}
function chooseTime(t,b,keep){E('oaV10Times').querySelectorAll('.oaV10Time').forEach(function(x){x.classList.toggle('on',x===b)});var rows=M.raw.filter(function(x){return String(x.starts_at)===String(t)}),map=new Map();rows.forEach(function(x){var k=String(x.studio_id||'nessuno');if(!map.has(k))map.set(k,x)});var opts=Array.from(map.values());if(!opts.length){M.selected=null;E('oaV10StudioWrap').style.display='none';return}var svc=(M.boot.services||[]).find(function(x){return String(x.id)===String(E('oaV10Service').value)});if(svc&&svc.requires_studio===false){M.selected=opts[0];E('oaV10StudioWrap').style.display='none';return}E('oaV10StudioWrap').style.display='block';E('oaV10Studios').innerHTML=opts.map(function(x,i){var name=x.studio_name||(M.boot.studios||[]).find(function(s){return String(s.id)===String(x.studio_id)})?.name||'Studio';var on=keep&&String(x.studio_id)===String(M.item.studio_id);return'<button type="button" class="oaV10Studio '+(on?'on':'')+'" data-i="'+i+'">'+X(name)+'</button>'}).join('');E('oaV10Studios').querySelectorAll('.oaV10Studio').forEach(function(sb){sb.onclick=function(){E('oaV10Studios').querySelectorAll('.oaV10Studio').forEach(function(x){x.classList.toggle('on',x===sb)});M.selected=opts[+sb.dataset.i]}});var current=opts.find(function(x){return keep&&String(x.studio_id)===String(M.item.studio_id)});M.selected=current||null}
function save(){if(!M.item)return;var p={service_id:E('oaV10Service').value,status:E('oaV10State').value,first_name:E('oaV10First').value.trim(),last_name:E('oaV10Last').value.trim(),email:E('oaV10Email').value.trim(),phone:E('oaV10Phone').value.trim(),notes:E('oaV10Notes').value};if(!p.first_name||!p.last_name||!p.email||!p.phone){msg('Nome, cognome, email e telefono sono obbligatori.',true);return}if(!M.selected){msg('Seleziona una fascia oraria e, se richiesto, lo studio.',true);return}p.starts_at=M.selected.starts_at;p.studio_id=M.selected.studio_id||null;msg('Salvataggio…');rpc('optyker_appointment_staff_reschedule',{p_username:OPTYKER_CLOUD.username,p_appointment_id:M.item.id,p_payload:p}).then(function(){msg('Modifiche salvate.');setTimeout(function(){E('oaManageModal').classList.remove('open');if(window.optykerOpenAppointments)window.optykerOpenAppointments()},250)}).catch(function(e){msg(e.message,true)})}
function cancel(){if(!M.item||!confirm('Annullare questo appuntamento? Rimarrà nello storico del cliente.'))return;msg('Annullamento…');staffApi('appointment_status',{id:M.item.id,status:'cancelled'}).then(function(){msg('Appuntamento annullato.');setTimeout(function(){E('oaManageModal').classList.remove('open');if(window.optykerOpenAppointments)window.optykerOpenAppointments()},250)}).catch(function(e){msg(e.message,true)})}
E('oaV10Close').onclick=function(){E('oaManageModal').classList.remove('open')};E('oaV10Save').onclick=save;E('oaV10Cancel').onclick=cancel;['oaV10Service','oaV10Date'].forEach(function(i){E(i).onchange=function(){M.selected=null;loadSlots(false)}});E('oaManageModal').addEventListener('click',function(ev){if(ev.target===E('oaManageModal'))E('oaManageModal').classList.remove('open')});
var cal=E('oaCalendar');if(cal){cal.addEventListener('click',function(ev){var b=ev.target.closest&&ev.target.closest('.oaEvent[data-id]');if(!b||!cal.contains(b))return;ev.preventDefault();ev.stopPropagation();openById(b.dataset.id)},true)}
})();</script>'''

i=s.rfind('</body>')
s=s[:i]+js+s[i:]
p.write_text(s,encoding='utf-8')
print('Appointments V10 full detail / edit / cancel OK')

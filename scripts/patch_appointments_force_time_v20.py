from pathlib import Path
import re

p=Path('_site/index.html')
s=p.read_text(encoding='utf-8')
MARK='OPTYKER_APPOINTMENTS_FORCE_TIME_V20'
if MARK in s:
    raise SystemExit(0)

if 'id="oaNewModal"' not in s or 'function create(){' not in s:
    raise SystemExit('Agenda Optyker non trovata')

# Ordine: servizio/data -> orario -> eventuale forzatura -> studio disponibile.
anchor='<div class="oaF"><label>Studio</label><select id="oaStudio"></select></div><div class="oaF wide"><label>Disponibilità</label>'
if anchor not in s:
    raise SystemExit('Campo Studio agenda non trovato')
block='''<div class="oaF"><label>Orario</label><input id="oaManualTime" type="time" step="900"></div>
<div id="oaForceBox" class="oaF wide oaForceBox" style="display:none"><label class="oaForceLabel"><input id="oaForceClosed" type="checkbox"> Forza appuntamento anche fuori dagli orari di apertura</label><div class="oaForceHelp">Disponibile solo per gli account Optyker con email associata. Le sovrapposizioni nello stesso studio restano bloccate.</div></div>
<div class="oaF wide"><label>Orari disponibili</label>'''
s=s.replace(anchor,block,1)

slots_anchor='<div id="oaSlots" class="oaSlots"><span class="oaEmpty">Seleziona servizio e data.</span></div>'
if slots_anchor not in s:
    raise SystemExit('Contenitore orari non trovato')
s=s.replace(slots_anchor,slots_anchor+'''<div class="oaF wide oaStudioPick"><label>Studio disponibile</label><select id="oaStudio" disabled><option value="">Seleziona prima un orario</option></select></div>''',1)

# CSS.
head='''<style id="optykerAppointmentsForceCss">/* OPTYKER_APPOINTMENTS_FORCE_TIME_V20 */
.oaForceBox{padding:10px 12px;border:1px solid #e2ce8b;border-radius:10px;background:#fff8dd}.oaForceLabel{display:flex!important;align-items:center;gap:8px;font-size:11px!important;color:#664d00!important}.oaForceLabel input{width:18px!important;height:18px!important;min-height:18px!important;margin:0}.oaForceHelp{font-size:9px;color:#766321;margin-top:5px;line-height:1.35}.oaStudioPick{margin-top:9px}.oaStudioPick select:disabled{background:#f3f6f8;color:#8293a0}
</style>'''
i=s.find('</head>')
if i<0: raise SystemExit('head non trovato')
s=s[:i]+head+s[i:]

# Gli slot devono essere richiesti senza filtrare prima per studio.
old_slots="body:JSON.stringify({p_service_id:E('oaService').value,p_date:E('oaDate').value,p_operator:null,p_studio_id:E('oaStudio').value||null})"
new_slots="body:JSON.stringify({p_service_id:E('oaService').value,p_date:E('oaDate').value,p_operator:null,p_studio_id:null})"
if old_slots not in s:
    raise SystemExit('slotsApi non trovato')
s=s.replace(old_slots,new_slots,1)

# Al bootstrap lo studio non deve essere preselezionabile.
old_fill='''E('oaStudio').innerHTML='<option value="">Qualsiasi studio</option>'+S.boot.studios.map(function(x){return'<option value="'+X(x.id)+'">'+X(x.name)+'</option>'}).join('');'''
new_fill='''E('oaStudio').innerHTML='<option value="">Seleziona prima un orario</option>';E('oaStudio').disabled=true;'''
if old_fill not in s:
    raise SystemExit('fill studio non trovato')
s=s.replace(old_fill,new_fill,1)

# Nuovo appuntamento: orario vuoto e forzatura mostrata solo agli user con email.
old_open='''E('oaDate').value=ds(d);['oaFirst','oaLast','oaEmail','oaPhone','oaNotes'].forEach(function(i){E(i).value=''});E('oaClient').value=E('oaService').value=E('oaOperator').value=E('oaStudio').value='';E('oaSlots').innerHTML='<span class="oaEmpty">Seleziona servizio e data.</span>';E('oaCreate').disabled=true;'''
new_open='''E('oaDate').value=ds(d);E('oaManualTime').value='';E('oaForceClosed').checked=false;E('oaForceBox').style.display=S.boot&&S.boot.can_force_appointment?'block':'none';['oaFirst','oaLast','oaEmail','oaPhone','oaNotes'].forEach(function(i){E(i).value=''});E('oaClient').value=E('oaService').value=E('oaOperator').value='';E('oaStudio').innerHTML='<option value="">Seleziona prima un orario</option>';E('oaStudio').disabled=true;E('oaSlots').innerHTML='<span class="oaEmpty">Seleziona servizio e data.</span>';E('oaCreate').disabled=true;'''
if old_open not in s:
    raise SystemExit('openNew non trovato')
s=s.replace(old_open,new_open,1)

# Sostituisce caricamento orari + creazione. L'orario scritto a mano diventa attivo automaticamente.
pattern=r"function loadSlots\(\)\{[\s\S]*?\}function create\(\)\{[\s\S]*?\}\nfunction days\(v\)"
m=re.search(pattern,s)
if not m:
    raise SystemExit('Blocco loadSlots/create non trovato')
replacement=r'''function oaRomeIso(date,time){var dm=String(date||'').match(/^(\d{4})-(\d{2})-(\d{2})$/),tmx=String(time||'').match(/^(\d{2}):(\d{2})$/);if(!dm||!tmx)throw Error('Data o orario non validi.');var target=Date.UTC(+dm[1],+dm[2]-1,+dm[3],+tmx[1],+tmx[2],0),guess=target,fmt=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});for(var j=0;j<3;j++){var parts={};fmt.formatToParts(new Date(guess)).forEach(function(x){if(x.type!=='literal')parts[x.type]=x.value});var shown=Date.UTC(+parts.year,+parts.month-1,+parts.day,+parts.hour,+parts.minute,+parts.second);guess+=target-shown}return new Date(guess).toISOString()}
function oaService(){return(S.boot&&S.boot.services||[]).find(function(x){return String(x.id)===String(E('oaService').value)})||null}
function oaResetStudio(msg){S.slot=null;S.studioRows=[];E('oaStudio').disabled=true;E('oaStudio').innerHTML='<option value="">'+X(msg||'Seleziona prima un orario')+'</option>';E('oaCreate').disabled=true}
function oaSetStudios(rows,starts,forced){var svc=oaService();rows=Array.isArray(rows)?rows:[];S.studioRows=rows;S.slot=null;if(!svc){oaResetStudio('Seleziona prima il servizio');return}if(svc.requires_studio===false){var r=rows[0]||{studio_id:null,operator_username:null,starts_at:starts};S.slot={studio_id:null,operator_username:r.operator_username||null,rule_id:r.rule_id||null,starts_at:starts||r.starts_at,force_time:!!forced};E('oaStudio').disabled=true;E('oaStudio').innerHTML='<option value="">Nessuno studio necessario</option>';E('oaCreate').disabled=false;return}var clean=[],seen={};rows.forEach(function(r){var k=String(r.studio_id||'');if(k&&!seen[k]){seen[k]=1;clean.push(r)}});S.studioRows=clean;if(!clean.length){oaResetStudio(forced?'Nessuno studio libero in questo orario':'Nessuno studio disponibile in questo orario');return}E('oaStudio').disabled=false;E('oaStudio').innerHTML='<option value="">Scegli lo studio</option>'+clean.map(function(r,i){return'<option value="'+i+'">'+X(r.studio_name||(S.boot.studios.find(function(st){return st.id===r.studio_id})||{}).name||'Studio')+'</option>'}).join('');E('oaStudio').onchange=function(){var r=clean[+this.value];if(!r){S.slot=null;E('oaCreate').disabled=true;return}S.slot={studio_id:r.studio_id||null,operator_username:r.operator_username||null,rule_id:r.rule_id||null,starts_at:starts||r.starts_at,force_time:!!forced};E('oaCreate').disabled=false}}
function oaGroupTimes(a){var m={};(a||[]).forEach(function(r){var k=String(r.starts_at||'');if(k&&!m[k])m[k]=[];if(k)m[k].push(r)});return Object.keys(m).sort(function(a,b){return new Date(a)-new Date(b)}).map(function(k){return[k,m[k]]})}
function loadSlots(){S.slot=null;S.studioRows=[];E('oaCreate').disabled=true;oaResetStudio('Seleziona prima un orario');if(!E('oaService').value||!E('oaDate').value)return;E('oaSlots').innerHTML='<span class="oaEmpty">Caricamento…</span>';slotsApi().then(function(x){var a=x.data||[],groups=oaGroupTimes(a);E('oaSlots').innerHTML=groups.length?groups.map(function(g,i){return'<button class="oaSlot" data-i="'+i+'">'+X(tm(g[0]))+'</button>'}).join(''):'<span class="oaEmpty">Nessuna fascia ordinaria disponibile.</span>';E('oaSlots').querySelectorAll('[data-i]').forEach(function(b){b.onclick=function(){E('oaSlots').querySelectorAll('.oaSlot').forEach(function(x){x.classList.remove('on')});b.classList.add('on');var g=groups[+b.dataset.i];E('oaManualTime').value=tm(g[0]);E('oaForceClosed').checked=false;oaSetStudios(g[1],g[0],false)}})}).catch(function(e){E('oaSlots').innerHTML='<span class="oaStatus bad">'+X(e.message)+'</span>'})}
function oaManualChanged(){status('oaNewStatus','');S.slot=null;E('oaCreate').disabled=true;if(!E('oaService').value||!E('oaDate').value||!E('oaManualTime').value){oaResetStudio('Seleziona prima un orario');return}var starts;try{starts=oaRomeIso(E('oaDate').value,E('oaManualTime').value)}catch(e){status('oaNewStatus',e.message,true);return}if(new Date(starts).getTime()<=Date.now()){status('oaNewStatus','Seleziona un orario futuro.',true);oaResetStudio('Orario non valido');return}var force=!!E('oaForceClosed').checked;if(force){api('force_studios',{service_id:E('oaService').value,starts_at:starts}).then(function(x){oaSetStudios(x.data||[],starts,true);if(!(x.data||[]).length)status('oaNewStatus','Nessuno studio libero in questo orario.',true)}).catch(function(e){status('oaNewStatus',e.message,true);oaResetStudio('Forzatura non disponibile')});return}slotsApi().then(function(x){var rows=(x.data||[]).filter(function(r){return String(r.starts_at)===String(starts)});oaSetStudios(rows,starts,false);if(!rows.length)status('oaNewStatus',(S.boot&&S.boot.can_force_appointment)?'Orario fuori disponibilità. Puoi attivare la forzatura.':'Questo orario non è disponibile.',true)}).catch(function(e){status('oaNewStatus',e.message,true)})}
function create(){if(!S.slot){status('oaNewStatus','Scegli prima l’orario e poi lo studio disponibile.',true);return}var p={service_id:E('oaService').value,studio_id:S.slot.studio_id,operator_username:S.slot.operator_username,rule_id:S.slot.rule_id,starts_at:S.slot.starts_at,force_time:!!S.slot.force_time,client_id:E('oaClient').value||null,first_name:E('oaFirst').value.trim(),last_name:E('oaLast').value.trim(),email:E('oaEmail').value.trim(),phone:E('oaPhone').value.trim(),notes:E('oaNotes').value.trim()};if(!p.first_name||!p.last_name||!p.email||!p.phone){status('oaNewStatus','Nome, cognome, email e telefono sono obbligatori.',true);return}E('oaCreate').disabled=true;api('appointment_create',p).then(function(){modal('oaNewModal',false);load()}).catch(function(e){status('oaNewStatus',e.message,true);E('oaCreate').disabled=false})}
function days(v)'''
s=s[:m.start()]+replacement+s[m.end():]

# Binding: orario scritto a mano = selezionato automaticamente; studio solo dopo orario.
old_wire="['oaService','oaDate','oaStudio'].forEach(function(i){E(i).onchange=loadSlots});"
new_wire="['oaService','oaDate'].forEach(function(i){E(i).onchange=function(){loadSlots();if(E('oaManualTime').value)oaManualChanged()}});E('oaManualTime').onchange=oaManualChanged;E('oaForceClosed').onchange=oaManualChanged;"
if old_wire not in s:
    raise SystemExit('Binding agenda non trovato')
s=s.replace(old_wire,new_wire,1)

body=s.rfind('</body>')
if body<0: raise SystemExit('body non trovato')
s=s[:body]+"<!-- "+MARK+" -->"+s[body:]

p.write_text(s,encoding='utf-8')
print('Agenda Optyker aggiornata: orario -> studio, forzatura autorizzata')

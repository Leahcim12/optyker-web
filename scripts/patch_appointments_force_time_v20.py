from pathlib import Path

p=Path('_site/index.html')
s=p.read_text(encoding='utf-8')
MARK='OPTYKER_APPOINTMENTS_FORCE_TIME_V20'
if MARK in s:
    raise SystemExit(0)

if 'id="oaNewModal"' not in s or 'function create(){' not in s:
    raise SystemExit('Agenda Optyker non trovata')

# UI: orario manuale + forzatura.
anchor='<div class="oaF"><label>Studio</label><select id="oaStudio"></select></div><div class="oaF wide"><label>Disponibilità</label>'
if anchor not in s:
    raise SystemExit('Campo Studio agenda non trovato')
block='''<div class="oaF"><label>Studio</label><select id="oaStudio"></select></div>
<div class="oaF"><label>Orario manuale</label><input id="oaManualTime" type="time" step="900" value="09:00"></div>
<div class="oaF"><label>&nbsp;</label><button id="oaUseManual" class="secondary" type="button">Usa orario manuale</button></div>
<div class="oaF wide oaForceBox"><label class="oaForceLabel"><input id="oaForceClosed" type="checkbox"> Forza appuntamento anche fuori dagli orari di apertura</label><div class="oaForceHelp">L'orario viene accettato anche a negozio chiuso. Optyker continua a impedire sovrapposizioni nello stesso studio.</div></div>
<div class="oaF wide"><label>Disponibilità</label>'''
s=s.replace(anchor,block,1)

# CSS.
head='''<style id="optykerAppointmentsForceCss">/* OPTYKER_APPOINTMENTS_FORCE_TIME_V20 */
.oaForceBox{padding:10px 12px;border:1px solid #e2ce8b;border-radius:10px;background:#fff8dd}.oaForceLabel{display:flex!important;align-items:center;gap:8px;font-size:11px!important;color:#664d00!important}.oaForceLabel input{width:18px!important;height:18px!important;min-height:18px!important;margin:0}.oaForceHelp{font-size:9px;color:#766321;margin-top:5px;line-height:1.35}
</style>'''
i=s.find('</head>')
if i<0: raise SystemExit('head non trovato')
s=s[:i]+head+s[i:]

# Nuovo appuntamento: default manuale.
old="E('oaDate').value=ds(d);['oaFirst','oaLast','oaEmail','oaPhone','oaNotes'].forEach(function(i){E(i).value=''});"
new="E('oaDate').value=ds(d);E('oaManualTime').value='09:00';E('oaForceClosed').checked=false;['oaFirst','oaLast','oaEmail','oaPhone','oaNotes'].forEach(function(i){E(i).value=''});"
if old not in s:
    raise SystemExit('openNew non trovato')
s=s.replace(old,new,1)

# Inserisce conversione Europe/Rome e selezione orario manuale.
create_anchor="function create(){if(!S.slot)return;var p={service_id:E('oaService').value,studio_id:S.slot.studio_id,operator_username:S.slot.operator_username,rule_id:S.slot.rule_id,starts_at:S.slot.starts_at,client_id:E('oaClient').value||null,first_name:E('oaFirst').value.trim(),last_name:E('oaLast').value.trim(),email:E('oaEmail').value.trim(),phone:E('oaPhone').value.trim(),notes:E('oaNotes').value.trim()};"
if create_anchor not in s:
    raise SystemExit('create agenda non trovato')
replacement="""function oaRomeIso(date,time){var dm=String(date||'').match(/^(\\d{4})-(\\d{2})-(\\d{2})$/),tmx=String(time||'').match(/^(\\d{2}):(\\d{2})$/);if(!dm||!tmx)throw Error('Data o orario non validi.');var target=Date.UTC(+dm[1],+dm[2]-1,+dm[3],+tmx[1],+tmx[2],0),guess=target,fmt=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});for(var j=0;j<3;j++){var parts={};fmt.formatToParts(new Date(guess)).forEach(function(x){if(x.type!=='literal')parts[x.type]=x.value});var shown=Date.UTC(+parts.year,+parts.month-1,+parts.day,+parts.hour,+parts.minute,+parts.second);guess+=target-shown}return new Date(guess).toISOString()}
function useManual(){status('oaNewStatus','');if(!E('oaService').value||!E('oaDate').value||!E('oaManualTime').value){status('oaNewStatus','Seleziona servizio, data e orario manuale.',true);return}try{var starts=oaRomeIso(E('oaDate').value,E('oaManualTime').value);if(new Date(starts).getTime()<=Date.now()){status('oaNewStatus','Seleziona un orario futuro.',true);return}S.slot={studio_id:E('oaStudio').value||null,operator_username:null,rule_id:null,starts_at:starts,force_time:!!E('oaForceClosed').checked};E('oaSlots').querySelectorAll('.oaSlot').forEach(function(x){x.classList.remove('on')});E('oaCreate').disabled=false;status('oaNewStatus',S.slot.force_time?'Orario manuale forzato selezionato.':'Orario manuale selezionato.')}catch(e){status('oaNewStatus',e.message,true)}}
function create(){var forceNow=!!E('oaForceClosed').checked;if(forceNow&&E('oaService').value&&E('oaDate').value&&E('oaManualTime').value){try{S.slot={studio_id:E('oaStudio').value||null,operator_username:null,rule_id:null,starts_at:oaRomeIso(E('oaDate').value,E('oaManualTime').value),force_time:true}}catch(e){status('oaNewStatus',e.message,true);return}}if(!S.slot){status('oaNewStatus','Seleziona una fascia oppure inserisci un orario manuale.',true);return}var p={service_id:E('oaService').value,studio_id:S.slot.studio_id,operator_username:S.slot.operator_username,rule_id:S.slot.rule_id,starts_at:S.slot.starts_at,force_time:forceNow||!!S.slot.force_time,client_id:E('oaClient').value||null,first_name:E('oaFirst').value.trim(),last_name:E('oaLast').value.trim(),email:E('oaEmail').value.trim(),phone:E('oaPhone').value.trim(),notes:E('oaNotes').value.trim()};"""
s=s.replace(create_anchor,replacement,1)

# Gli slot normali non sono forzati.
old_slot="S.slot=a[+b.dataset.i];E('oaCreate').disabled=false"
new_slot="S.slot=a[+b.dataset.i];S.slot.force_time=false;E('oaCreate').disabled=false"
if old_slot not in s:
    raise SystemExit('selezione slot non trovata')
s=s.replace(old_slot,new_slot,1)

# Collega pulsante manuale.
wire="['oaService','oaDate','oaStudio'].forEach(function(i){E(i).onchange=loadSlots});"
if wire not in s:
    raise SystemExit('binding campi agenda non trovato')
s=s.replace(wire,wire+"E('oaUseManual').onclick=useManual;E('oaForceClosed').onchange=function(){if(this.checked&&E('oaService').value&&E('oaDate').value&&E('oaManualTime').value)useManual()};E('oaManualTime').onchange=function(){if(E('oaForceClosed').checked)useManual()};",1)

# Marker.
body=s.rfind('</body>')
if body<0: raise SystemExit('body non trovato')
s=s[:body]+"<!-- "+MARK+" -->"+s[body:]

p.write_text(s,encoding='utf-8')
print('Agenda Optyker: orario manuale e forzatura attivati')

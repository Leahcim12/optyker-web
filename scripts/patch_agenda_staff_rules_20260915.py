from pathlib import Path
import re

ROOT=Path('_site')
FILES=[ROOT/'index.html',ROOT/'gestionale-v2/index.html',ROOT/'gestionale-v3/index.html']
MARK='OPTYKER_AGENDA_STAFF_RULES_20260915'

css='''<style id="optykerAgendaStaffRulesCss">\n.oaContactHint{font-size:10px;color:#60778a;margin-top:-4px}\n.oaV10ForceOverlap{grid-column:1/-1;border:1px solid #e3b45b;background:#fff9ed;border-radius:12px;padding:12px;display:grid;gap:10px}\n.oaV10ForceOverlap label.oaV10ForceCheck{display:flex;align-items:center;gap:8px;font-weight:900;color:#75510c}\n.oaV10ForceOverlap input[type=checkbox]{width:18px;height:18px}\n.oaV10ForceFields{display:none;grid-template-columns:180px minmax(260px,1fr);gap:10px;align-items:end}\n.oaV10ForceFields.on{display:grid}\n.oaV10ForceFields label{display:grid;gap:5px;font-size:9px;font-weight:900;color:#6a7f90;text-transform:uppercase;letter-spacing:.04em}\n.oaV10ForceFields input,.oaV10ForceFields select{height:38px;border:1px solid #d7c38e;border-radius:9px;background:#fff;padding:0 9px;color:#29465e;font-weight:750}\n.oaV10ForceHelp{font-size:9px;color:#7a6740;line-height:1.45}\n@media(max-width:700px){.oaV10ForceFields{grid-template-columns:1fr}}\n</style>'''

for path in FILES:
    text=path.read_text(encoding='utf-8')
    if MARK in text:
        continue

    # Initial creation: contact is email OR phone; private notes are available immediately.
    old='<div class="oaF"><label>Email</label><input id="oaEmail" type="email"></div><div class="oaF"><label>Telefono</label><input id="oaPhone" type="tel"></div><div class="oaF wide"><label>Note</label><textarea id="oaNotes"></textarea></div></div>'
    new='<div class="oaF"><label>Email</label><input id="oaEmail" type="email"></div><div class="oaF"><label>Telefono</label><input id="oaPhone" type="tel"></div><div class="oaF wide oaContactHint">È sufficiente inserire almeno uno tra email e telefono.</div><div class="oaF wide"><label>Note</label><textarea id="oaNotes"></textarea></div><div class="oaF wide"><label>Note private · solo Optyker</label><textarea id="oaPrivateNotes" placeholder="Visibili solo agli operatori Optyker, mai al cliente"></textarea></div></div>'
    if old not in text: raise SystemExit(f'New appointment contact anchor missing in {path}')
    text=text.replace(old,new,1)
    text=text.replace("['oaFirst','oaLast','oaEmail','oaPhone','oaNotes'].forEach", "['oaFirst','oaLast','oaEmail','oaPhone','oaNotes','oaPrivateNotes'].forEach",1)
    text=text.replace("phone:E('oaPhone').value.trim(),notes:E('oaNotes').value.trim()}", "phone:E('oaPhone').value.trim(),notes:E('oaNotes').value.trim(),private_notes:E('oaPrivateNotes').value.trim()}",1)
    text=text.replace("if(!p.first_name||!p.last_name||!p.email||!p.phone){status('oaNewStatus','Nome, cognome, email e telefono sono obbligatori.',true);return}", "if(!p.first_name||!p.last_name||(!p.email&&!p.phone)){status('oaNewStatus','Nome e cognome sono obbligatori. Inserisci almeno email oppure telefono.',true);return}",1)

    # Edit modal: Optyker-only explicit overlap override.
    old_force='<div class="oaV10F wide oaV10Private"><label>Note private · solo utenti Optyker con login</label><textarea id="oaV10PrivateNotes" placeholder="Queste note non vengono mostrate al cliente"></textarea></div>\n<div class="oaV10Availability">'
    new_force='''<div class="oaV10F wide oaV10Private"><label>Note private · solo utenti Optyker con login</label><textarea id="oaV10PrivateNotes" placeholder="Queste note non vengono mostrate al cliente"></textarea></div>\n<div class="oaV10ForceOverlap"><label class="oaV10ForceCheck"><input id="oaV10ForceOccupied" type="checkbox"> Forza orario occupato · solo da Optyker</label><div id="oaV10ForceFields" class="oaV10ForceFields"><label>Orario da forzare<input id="oaV10ForceTime" type="time" step="900"></label><label>Operatore / studio<select id="oaV10ForceChoice"><option value="">Seleziona prima l’orario</option></select></label></div><div class="oaV10ForceHelp">Usa questa opzione solo se vuoi sovrapporre volutamente un appuntamento. Gli operatori segnati assenti (malattia, ferie, fiera, permesso, riposo) non vengono comunque proposti.</div></div>\n<div class="oaV10Availability">'''
    if old_force not in text: raise SystemExit(f'Manage private note anchor missing in {path}')
    text=text.replace(old_force,new_force,1)

    text=text.replace("var M={item:null,boot:null,raw:[],selected:null};", "var M={item:null,boot:null,raw:[],selected:null,forceRows:[]};",1)
    text=text.replace("function tm(v){return new Intl.DateTimeFormat('it-IT',{timeZone:'Europe/Rome',hour:'2-digit',minute:'2-digit'}).format(new Date(v))}", "function tm(v){return new Intl.DateTimeFormat('it-IT',{timeZone:'Europe/Rome',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(v))}function romeIso(date,time){var dm=String(date||'').match(/^(\\d{4})-(\\d{2})-(\\d{2})$/),tmx=String(time||'').match(/^(\\d{2}):(\\d{2})$/);if(!dm||!tmx)throw Error('Data o orario non validi.');var target=Date.UTC(+dm[1],+dm[2]-1,+dm[3],+tmx[1],+tmx[2],0),guess=target,fmt=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});for(var j=0;j<3;j++){var parts={};fmt.formatToParts(new Date(guess)).forEach(function(x){if(x.type!=='literal')parts[x.type]=x.value});var shown=Date.UTC(+parts.year,+parts.month-1,+parts.day,+parts.hour,+parts.minute,+parts.second);guess+=target-shown}return new Date(guess).toISOString()}",1)

    old_details="['Note',a.notes||'—']];E('oaV10Details')"
    new_details="['Note',a.notes||'—'],['Forzatura sovrapposizione',a.staff_forced_overlap?'Sì · solo Optyker':'No']];E('oaV10Details')"
    if old_details not in text: raise SystemExit(f'Details anchor missing in {path}')
    text=text.replace(old_details,new_details,1)

    old_fill="E('oaV10PrivateNotes').value=a.private_notes||'';E('oaV10Cancel').style.display=a.status==='cancelled'?'none':'';loadSlots(true)"
    new_fill="E('oaV10PrivateNotes').value=a.private_notes||'';E('oaV10ForceOccupied').checked=!!a.staff_forced_overlap;E('oaV10ForceTime').value=tm(a.starts_at);E('oaV10Cancel').style.display=a.status==='cancelled'?'none':'';toggleForce(true)"
    if old_fill not in text: raise SystemExit(f'Fill anchor missing in {path}')
    text=text.replace(old_fill,new_fill,1)

    # Insert overlap helpers before save().
    save_anchor="function save(){if(!M.item)return;"
    if save_anchor not in text: raise SystemExit(f'Save anchor missing in {path}')
    helpers=r'''function forceChoiceLabel(r){return (r.operator_username||'Operatore')+' · '+(r.studio_name||'Nessuno studio')}
function loadForceOverlap(){
  if(!M.item||!E('oaV10ForceOccupied').checked)return;
  var t=E('oaV10ForceTime').value,date=E('oaV10Date').value,service=E('oaV10Service').value,starts='';
  M.forceRows=[];E('oaV10ForceChoice').innerHTML='<option value="">Verifica disponibilità operatore…</option>';
  if(!date||!service||!t){msg('Inserisci data e orario da forzare.',true);return}
  try{starts=romeIso(date,t)}catch(e){msg(e.message,true);return}
  if(new Date(starts).getTime()<=Date.now()){msg('Seleziona un orario futuro.',true);return}
  msg('Verifico gli operatori in turno…');
  staffManage('force_overlap_slots',{service_id:service,starts_at:starts,ignore_appointment_id:M.item.id}).then(function(x){
    M.forceRows=Array.isArray(x.data)?x.data:[];
    E('oaV10ForceChoice').innerHTML=M.forceRows.length?'<option value="">Scegli operatore / studio</option>'+M.forceRows.map(function(r,i){return'<option value="'+i+'">'+X(forceChoiceLabel(r))+'</option>'}).join(''):'<option value="">Nessun operatore in turno</option>';
    var same=M.forceRows.findIndex(function(r){return String(r.operator_username||'').toUpperCase()===String(M.item.operator_username||'').toUpperCase()&&String(r.studio_id||'')===String(M.item.studio_id||'')});
    if(same>=0)E('oaV10ForceChoice').value=String(same);
    msg(M.forceRows.length?'Forzatura pronta. Scegli la combinazione desiderata.':'Nessun operatore disponibile: controlla Turni e orari.',!M.forceRows.length)
  }).catch(function(e){M.forceRows=[];E('oaV10ForceChoice').innerHTML='<option value="">Forzatura non disponibile</option>';msg(e.message,true)})
}
function toggleForce(loadNow){
  var on=!!E('oaV10ForceOccupied').checked,fields=E('oaV10ForceFields'),normal=document.querySelector('#oaManageModal .oaV10Availability');
  if(fields)fields.classList.toggle('on',on);if(normal)normal.style.display=on?'none':'';
  if(on){M.selected=null;if(loadNow!==false)loadForceOverlap()}else{M.forceRows=[];if(loadNow!==false)loadSlots(true)}
}
'''
    text=text.replace(save_anchor,helpers+save_anchor,1)

    # Replace whole save function in compact generated script.
    pat=r"function save\(\)\{if\(!M\.item\)return;var p=\{id:M\.item\.id,service_id:E\('oaV10Service'\)\.value,status:E\('oaV10State'\)\.value,first_name:E\('oaV10First'\)\.value\.trim\(\),last_name:E\('oaV10Last'\)\.value\.trim\(\),email:E\('oaV10Email'\)\.value\.trim\(\),phone:E\('oaV10Phone'\)\.value\.trim\(\),notes:E\('oaV10Notes'\)\.value,private_notes:E\('oaV10PrivateNotes'\)\.value\};.*?staffManage\('reschedule',p\)\.then\(function\(\)\{msg\('Modifiche salvate\.'\);setTimeout\(function\(\)\{E\('oaManageModal'\)\.classList\.remove\('open'\);if\(window\.optykerOpenAppointments\)window\.optykerOpenAppointments\(\)\},250\)\}\)\.catch\(function\(e\)\{msg\(e\.message,true\)\}\)\}"
    repl="""function save(){if(!M.item)return;var p={id:M.item.id,service_id:E('oaV10Service').value,status:E('oaV10State').value,first_name:E('oaV10First').value.trim(),last_name:E('oaV10Last').value.trim(),email:E('oaV10Email').value.trim(),phone:E('oaV10Phone').value.trim(),notes:E('oaV10Notes').value,private_notes:E('oaV10PrivateNotes').value};if(!p.first_name||!p.last_name||(!p.email&&!p.phone)){msg('Nome e cognome sono obbligatori. Inserisci almeno email oppure telefono.',true);return}if(E('oaV10ForceOccupied').checked){var i=parseInt(E('oaV10ForceChoice').value,10),r=M.forceRows[i];if(!r){msg('Scegli operatore e studio per la forzatura.',true);return}p.force_overlap=true;p.starts_at=r.starts_at;p.operator_username=r.operator_username;p.studio_id=r.studio_id||null}else{if(!M.selected){msg('Seleziona una fascia oraria e, se richiesto, lo studio.',true);return}p.force_overlap=false;p.starts_at=M.selected.starts_at;p.operator_username=M.selected.operator_username||M.item.operator_username;p.studio_id=M.selected.studio_id||null}msg('Salvataggio…');staffManage('reschedule',p).then(function(){msg(p.force_overlap?'Modifiche salvate con sovrapposizione forzata.':'Modifiche salvate.');setTimeout(function(){E('oaManageModal').classList.remove('open');if(window.optykerOpenAppointments)window.optykerOpenAppointments()},250)}).catch(function(e){msg(e.message,true)})}"""
    text,n=re.subn(pat,repl,text,count=1,flags=re.S)
    if n!=1: raise SystemExit(f'Save function replacement failed in {path}')

    old_bind="E('oaV10Close').onclick=function(){E('oaManageModal').classList.remove('open')};E('oaV10Save').onclick=save;E('oaV10Cancel').onclick=cancel;['oaV10Service','oaV10Date'].forEach(function(i){E(i).onchange=function(){M.selected=null;loadSlots(false)}});"
    new_bind="E('oaV10Close').onclick=function(){E('oaManageModal').classList.remove('open')};E('oaV10Save').onclick=save;E('oaV10Cancel').onclick=cancel;E('oaV10ForceOccupied').onchange=function(){toggleForce(true)};E('oaV10ForceTime').onchange=loadForceOverlap;['oaV10Service','oaV10Date'].forEach(function(i){E(i).onchange=function(){M.selected=null;if(E('oaV10ForceOccupied').checked)loadForceOverlap();else loadSlots(false)}});"
    if old_bind not in text: raise SystemExit(f'Bind anchor missing in {path}')
    text=text.replace(old_bind,new_bind,1)

    # Turni: explicit fair/transfer absence status. It behaves like every other non-work absence.
    text=text.replace('<option value="other">Altro</option></select>', '<option value="fair">Fiera / trasferta</option><option value="other">Altro</option></select>',1)
    text=text.replace("function statusName(s){return s==='vacation'?'Ferie':s==='permission'?'Permesso':s==='sick'?'Malattia':s==='rest'?'Riposo':s==='other'?'Altro':'Turno'}", "function statusName(s){return s==='vacation'?'Ferie':s==='permission'?'Permesso':s==='sick'?'Malattia':s==='rest'?'Riposo':s==='fair'?'Fiera / trasferta':s==='other'?'Altro':'Turno'}",1)
    text=text.replace("if(sc.status==='work')return 'extra';return sc.status||'other'", "if(sc.status==='work')return 'extra';return sc.status==='fair'?'other':sc.status||'other'",1)
    text=text.replace('<span><i class="oa16Sw other"></i>Altro</span>', '<span><i class="oa16Sw other"></i>Fiera / trasferta</span><span><i class="oa16Sw other"></i>Altro</span>',1)
    text=text.replace('<option value="rest" \' +(st===\'rest\'?\'selected\':\'\')+\'>Giorno di riposo</option></select>', '<option value="rest" \' +(st===\'rest\'?\'selected\':\'\')+\'>Giorno di riposo</option><option value="fair" \' +(st===\'fair\'?\'selected\':\'\')+\'>Fiera / trasferta</option></select>',1)

    # CSS and marker.
    head=text.lower().find('</head>')
    if head<0: raise SystemExit(f'Closing head missing in {path}')
    text=text[:head]+css+'\n'+text[head:]
    body=text.lower().rfind('</body>')
    if body<0: raise SystemExit(f'Closing body missing in {path}')
    text=text[:body]+'<!-- '+MARK+' -->\n'+text[body:]
    path.write_text(text,encoding='utf-8')

main=FILES[0].read_text(encoding='utf-8')
required=[MARK,'oaPrivateNotes','oaV10ForceOccupied','force_overlap_slots','Fiera / trasferta','almeno email oppure telefono','private_notes:E(\'oaPrivateNotes\')']
for needle in required:
    if needle not in main: raise SystemExit('Missing agenda staff rule patch: '+needle)
if FILES[1].read_bytes()!=FILES[0].read_bytes() or FILES[2].read_bytes()!=FILES[0].read_bytes():
    raise SystemExit('Desktop aliases differ after agenda staff rules patch')
print('Agenda staff rules installed: absences, private notes, forced overlap, optional contact')

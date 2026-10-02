from pathlib import Path
import hashlib,json
from apply_client_search_agenda import once

ROOT=Path(__file__).resolve().parents[1]
SITE=Path('_site')
VERSION='20261002-force-duration1'
MARK='OPTYKER_AGENDA_FORCE_DURATION_20261002'
shared=(ROOT/'appointment-duration.js').read_text()

def embed(text,extra=''):
    before,close,after=text.rpartition('</body>')
    if not close:raise ValueError('Missing closing body')
    return before+'<script id="optykerAppointmentDuration">/* '+MARK+' */\n'+shared+'\n'+extra+'</script>\n'+close+after

def desktop(text):
    if MARK in text:return text
    start=text.index('function forceChoiceLabel(r)')
    end=text.index('function toggleForce(loadNow)',start)
    text=text[:start]+(ROOT/'scripts/agenda_force_choice.js').read_text()+'\n'+text[end:]
    text=once(text,'function toggleForce(loadNow){','function toggleForce(loadNow){++oaForceChoiceRequest;')
    text=once(text,'Scegli operatore e studio per la forzatura.','Scegli uno studio per la forzatura. L’operatore è facoltativo.')
    text=once(text,' Forza orario occupato · solo da Optyker',' Forza orario · fuori turno o occupato')
    text=once(text,'Usa questa opzione solo se vuoi sovrapporre volutamente un appuntamento. Gli operatori segnati assenti (malattia, ferie, fiera, permesso, riposo) non vengono comunque proposti.',
      'Puoi confermare fuori turno lasciando l’operatore non assegnato. Questa forzatura consente anche di sovrapporre appuntamenti. Gli operatori assenti non vengono proposti.')
    text=once(text,"Nessun operatore o studio disponibile in questo orario.","Nessuno studio libero per questo servizio in questo orario.")
    text=once(text,'<div id="oaV10Details" class="oaV10DetailGrid"></div>',
      '<div id="oaV10Details" class="oaV10DetailGrid"></div><button id="oaV10Duration" type="button" class="secondary" style="margin:12px 0">Modifica durata</button>')
    text=once(text,"function fill(a){M.item=a;", "function fill(a){M.item=a;E('oaV10Duration').disabled=!['pending','confirmed'].includes(a.status)||new Date(a.starts_at)<=new Date();")
    text=once(text,"['Fine',dt(a.ends_at)]", "['Fine',dt(a.ends_at)],['Durata',Math.round((new Date(a.ends_at)-new Date(a.starts_at))/60000)+' minuti']")
    bind="""E('oaV10Duration').onclick=function(){if(!M.item)return;var id=M.item.id;
      optykerEditAppointmentDuration(M.item,function(p){return staffManage('duration',p)},function(a){
        if(M.item?.id===id){Object.assign(M.item,a);if(M.selected)M.selected.ends_at=a.ends_at;details(M.item)}
        msg('Durata salvata.');if(window.optykerOpenAppointments)window.optykerOpenAppointments();
      })};"""
    text=once(text,"E('oaV10Save').onclick=save;", "E('oaV10Save').onclick=save;"+bind)
    return embed(text)

main=desktop((SITE/'index.html').read_text())
assert desktop(main)==main
for needle in ['if(!window.optykerClientMatches(m,term))','if(!names.length&&!forced)',
               'id="oaClientSearch"','id="oaV10Duration"','Non assegnato · operatore facoltativo']:
    if needle not in main:raise ValueError('Agenda regression: '+needle)
for rel in ('index.html','gestionale-v2/index.html','gestionale-v3/index.html'):(SITE/rel).write_text(main)

app=SITE/'iphone-app-v13/index.html'
text=app.read_text()
if MARK not in text:app.write_text(embed(text,(ROOT/'iphone-app-v13/appointment-duration.js').read_text()))

staff=SITE/'staff-embed/index.html'
text=staff.read_text()
if MARK not in text:
    hook="""var durationRenderAgenda=renderAgenda;
renderAgenda=function(){durationRenderAgenda();SA_E('saCalendar').querySelectorAll('[data-a]').forEach(function(button){
  var a=saRows.find(function(a){return a.id===button.dataset.a});
  if(!a||!['pending','confirmed'].includes(a.status)||new Date(a.starts_at)<=new Date())return;
  var edit=document.createElement('button');edit.type='button';edit.className='secondary';edit.textContent='Modifica durata';
  edit.style.marginBottom='8px';edit.dataset.appointmentDuration=a.id;
  edit.onclick=function(){optykerEditAppointmentDuration(a,function(p){return apptApi('duration',p)},function(){return loadAgenda()})};
  button.insertAdjacentElement('afterend',edit)
})};
"""
    text=once(text,'window.showTab=function(t){',hook+'window.showTab=function(t){')
    staff.write_text(embed(text))

sources=['scripts/apply_agenda_force_duration.py','scripts/agenda_force_choice.js','appointment-duration.js','iphone-app-v13/appointment-duration.js']
digest=hashlib.sha256(''.join((ROOT/f).read_text() for f in sources).encode()).hexdigest()
(SITE/'agenda-force-duration-version.json').write_text(json.dumps({'version':VERSION,'sha256':digest})+'\n')
print('Agenda force and duration:',VERSION)

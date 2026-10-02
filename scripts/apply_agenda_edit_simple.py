from pathlib import Path
import json,hashlib
from apply_client_search_agenda import once

site=Path('_site');mark='OPTYKER_AGENDA_EDIT_SIMPLE_20261002'
text=(site/'index.html').read_text()
if mark not in text:
    text=once(text,'<div class="oaMt">Dettaglio appuntamento</div>','<div class="oaMt">Modifica appuntamento</div>')
    text=once(text,'<div id="oaV10Details" class="oaV10DetailGrid"></div>', '<div id="oaV10Details" class="oaV10DetailGrid" hidden style="display:none"></div><div id="oaV10CurrentSchedule" class="oaSub" style="margin:12px 0;white-space:pre-line"></div><button id="oaV10ChangeSchedule" type="button" class="secondary">Cambia orario, operatore o studio</button>')
    text=once(text,'<div class="oaV10ForceOverlap">','<div id="oaV10ScheduleOptions" hidden style="grid-column:1/-1"><div class="oaV10ForceOverlap">')
    text=once(text,'</div>\n<div id="oaV10Status"','</div></div>\n<div id="oaV10Status"')
    text=once(text,"function details(a){", "function details(a){E('oaV10CurrentSchedule').textContent=tm(a.starts_at)+' – '+tm(a.ends_at)+' · '+Math.round((new Date(a.ends_at)-new Date(a.starts_at))/60000)+' minuti\\n'+(a.operator_username||'Operatore non assegnato')+' · '+(a.studio_name||'Nessuno studio');")
    text=once(text,"E('oaV10Cancel').style.display=a.status==='cancelled'?'none':'';toggleForce(true)", "E('oaV10Cancel').style.display=a.status==='cancelled'?'none':'';oaSimpleReset(a)")
    helpers="""/* OPTYKER_AGENDA_EDIT_SIMPLE_20261002 */
function oaSimpleReset(a){++oaForceChoiceRequest;E('oaV10ScheduleOptions').hidden=true;E('oaV10ChangeSchedule').hidden=false;M.forceRows=[Object.assign({},a)];E('oaV10ForceChoice').innerHTML='<option value="0">'+X(forceChoiceLabel(a))+'</option>';E('oaV10ForceChoice').value='0'}
function oaSimpleExpand(){E('oaV10ScheduleOptions').hidden=false;E('oaV10ChangeSchedule').hidden=true}
E('oaV10ChangeSchedule').onclick=function(){oaSimpleExpand();toggleForce(true)};
"""
    text=once(text,'function toggleForce(loadNow){',helpers+'function toggleForce(loadNow){')
    text=once(text,"M.selected=null;if(E('oaV10ForceOccupied').checked)loadForceOverlap();else loadSlots(false)","M.selected=null;oaSimpleExpand();if(E('oaV10ForceOccupied').checked)loadForceOverlap();else loadSlots(false)")
    # Keep the operator already selected when opening ordinary availability.
    text=once(text,"if(btn)chooseTime(btn.dataset.t,btn,true)","if(btn){var existing=M.selected;chooseTime(btn.dataset.t,btn,true);if(existing)M.selected=existing}")
    text=once(text,'p.operator_username=M.selected.operator_username||M.item.operator_username;', 'p.operator_username=M.selected.operator_username==null?null:M.selected.operator_username;')
for rel in ('index.html','gestionale-v2/index.html','gestionale-v3/index.html'):(site/rel).write_text(text)
(site/'agenda-edit-simple-version.json').write_text(json.dumps({'version':mark,'sha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest()})+'\n')
print('Agenda edit: prefilled form, schedule options only on request')

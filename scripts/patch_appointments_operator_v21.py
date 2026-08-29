from pathlib import Path
import re

p=Path('_site/index.html')
s=p.read_text(encoding='utf-8')
MARK='OPTYKER_APPOINTMENT_OPERATOR_AVAILABILITY_V21'
if MARK in s:
    raise SystemExit(0)
if 'OPTYKER_APPOINTMENTS_FORCE_TIME_V20' not in s or 'id="oaOperator"' not in s:
    raise SystemExit('Agenda V20 o campo operatore non trovato')

# Mostra il campo operatore.
head='''<style id="optykerAppointmentOperatorV21Css">/* OPTYKER_APPOINTMENT_OPERATOR_AVAILABILITY_V21 */
.oaOperatorField{display:block!important}.oaOperatorField select:disabled{background:#f3f6f8;color:#8293a0}.oaOperatorHint{font-size:9px;color:#6f8190;margin-top:4px}
</style>'''
i=s.find('</head>')
if i<0: raise SystemExit('head non trovato')
s=s[:i]+head+s[i:]

# Etichetta più chiara.
s=s.replace('<div class="oaF oaOperatorField"><label>Operatore</label><select id="oaOperator"></select></div>',
            '<div class="oaF oaOperatorField"><label>Operatore disponibile</label><select id="oaOperator" disabled><option value="">Seleziona prima un orario</option></select><div class="oaOperatorHint">Sono mostrati solo gli operatori in turno, non assenti e liberi in quell’orario.</div></div>',1)

# Non precompilare tutti gli operatori nel fill iniziale.
old="E('oaOperator').innerHTML='<option value=\"\">Qualsiasi operatore</option>'+S.boot.operators.map(function(x){return'<option>'+X(x.username)+'</option>'}).join('');"
if old in s:
    s=s.replace(old,"E('oaOperator').innerHTML='<option value=\"\">Seleziona prima un orario</option>';E('oaOperator').disabled=true;",1)

# Reset all'apertura del nuovo appuntamento.
old_open="E('oaClient').value=E('oaService').value=E('oaOperator').value='';E('oaStudio').innerHTML='<option value=\"\">Seleziona prima un orario</option>';E('oaStudio').disabled=true;"
new_open="E('oaClient').value=E('oaService').value='';E('oaOperator').innerHTML='<option value=\"\">Seleziona prima un orario</option>';E('oaOperator').disabled=true;E('oaStudio').innerHTML='<option value=\"\">Seleziona prima un operatore</option>';E('oaStudio').disabled=true;"
if old_open not in s:
    raise SystemExit('Reset nuovo appuntamento non trovato')
s=s.replace(old_open,new_open,1)

# Inserisce la selezione operatore tra orario e studio.
anchor="function oaGroupTimes(a){var m={};"
if anchor not in s:
    raise SystemExit('oaGroupTimes non trovato')
helper=r'''function oaSetOperators(rows,starts,forced){rows=Array.isArray(rows)?rows:[];S.slot=null;S.operatorRows=rows;E('oaCreate').disabled=true;var names=[],seen={};rows.forEach(function(r){var n=String(r.operator_username||'').trim();var k=n.toUpperCase();if(n&&!seen[k]){seen[k]=1;names.push(n)}});names.sort(function(a,b){return a.localeCompare(b,'it')});if(!names.length){E('oaOperator').disabled=true;E('oaOperator').innerHTML='<option value="">Nessun operatore disponibile</option>';oaResetStudio('Nessun operatore disponibile');return}E('oaOperator').disabled=false;E('oaOperator').innerHTML='<option value="">Scegli l’operatore</option>'+names.map(function(n){return'<option value="'+X(n)+'">'+X(n)+'</option>'}).join('');oaResetStudio('Seleziona prima un operatore');E('oaOperator').onchange=function(){var op=this.value;if(!op){oaResetStudio('Seleziona prima un operatore');return}var selected=rows.filter(function(r){return String(r.operator_username||'').toUpperCase()===String(op).toUpperCase()});oaSetStudios(selected,starts,forced)}}
'''
s=s.replace(anchor,helper+anchor,1)

# La scelta della fascia deve popolare prima gli operatori.
s=s.replace("oaSetStudios(g[1],g[0],false)","oaSetOperators(g[1],g[0],false)",1)
s=s.replace("oaSetStudios(x.data||[],starts,true);if(!(x.data||[]).length)status('oaNewStatus','Nessuno studio libero in questo orario.',true)",
            "oaSetOperators(x.data||[],starts,true);if(!(x.data||[]).length)status('oaNewStatus','Nessun operatore o studio disponibile in questo orario.',true)",1)
s=s.replace("oaSetStudios(rows,starts,false);if(!rows.length)status('oaNewStatus'",
            "oaSetOperators(rows,starts,false);if(!rows.length)status('oaNewStatus'",1)

# Quando si cambia servizio/data, azzera anche l'operatore.
old_wire="['oaService','oaDate'].forEach(function(i){E(i).onchange=function(){loadSlots();if(E('oaManualTime').value)oaManualChanged()}});"
new_wire="['oaService','oaDate'].forEach(function(i){E(i).onchange=function(){E('oaOperator').innerHTML='<option value=\"\">Seleziona prima un orario</option>';E('oaOperator').disabled=true;loadSlots();if(E('oaManualTime').value)oaManualChanged()}});"
if old_wire not in s:
    raise SystemExit('Binding servizio/data non trovato')
s=s.replace(old_wire,new_wire,1)

# Testo di errore creazione.
s=s.replace("Scegli prima l’orario e poi lo studio disponibile.","Scegli prima l’orario, poi l’operatore e infine lo studio disponibile.",1)

b=s.rfind('</body>')
if b<0: raise SystemExit('body non trovato')
s=s[:b]+'<!-- '+MARK+' -->'+s[b:]

for req in [MARK,'Operatore disponibile','oaSetOperators','Nessun operatore disponibile','in turno, non assenti']:
    if req not in s: raise SystemExit('Patch operatore incompleta: '+req)

p.write_text(s,encoding='utf-8')
print('Agenda V21: selezione operatore con disponibilità turni/assenze')

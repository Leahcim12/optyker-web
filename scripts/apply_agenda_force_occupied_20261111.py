"""Agenda 20261111: «Forza appuntamento» anche con studio o operatore già occupato.

Dal 2026-11-11 il database (migrazione 20261111133649_agenda_force_occupied) propone con la forzatura
tutti gli studi abilitati per il servizio, prima quelli liberi, e salva l'appuntamento anche se lo studio
o l'operatore sono già occupati (sovrapposizione forzata). Gli operatori segnati assenti restano esclusi.

Questo passo aggiorna i testi della finestra «Nuovo appuntamento» e, prima della conferma, avvisa quando
l'appuntamento forzato verrà sovrapposto a un altro. Nessuna modifica a dati o API.
"""
from pathlib import Path
import hashlib
import json

ROOT = Path(__file__).resolve().parent.parent
SITE = ROOT / '_site'
MARK = 'OPTYKER_AGENDA_FORCE_OCCUPIED_20261111'
VERSION = '20261111-force-occupied1'

# Runs inside the native agenda closure (E and the force rows of the selected slot).
NOTICE = (
    "/* " + MARK + " */\n"
    "function oaForceOverlapNotice(r){var e=E('oaNewStatus');if(!e)return;r=r||{};"
    "var who=String(r.operator_username||'').trim(),busy=[];"
    "if(r.studio_busy)busy.push((r.studio_name||'Lo studio')+' è già occupato');"
    "if(r.operator_busy&&who)busy.push(who+' ha già un appuntamento');"
    "e.textContent=busy.length?busy.join(' e ')+' in questo orario: con la forzatura l’appuntamento viene inserito comunque, sovrapposto.':'';"
    "e.className='oaStatus'+(busy.length?' warn':'')}\n"
)

REPLACEMENTS = [
    # Force box: the option now covers busy studios too.
    ('<input id="oaForceClosed" type="checkbox"> Forza appuntamento anche fuori dagli orari di apertura</label>',
     '<input id="oaForceClosed" type="checkbox"> Forza appuntamento anche fuori orario o con studio occupato</label>'),
    ('Puoi lasciare l’operatore non assegnato. Le sovrapposizioni nello stesso studio restano bloccate.',
     'Puoi lasciare l’operatore non assegnato. L’appuntamento viene inserito anche se lo studio o l’operatore sono già occupati.'),
    ('<div class="oaOperatorHint">Sono mostrati solo gli operatori in turno, non assenti e liberi in quell’orario.</div>',
     '<div class="oaOperatorHint">Sono mostrati solo gli operatori in turno, non assenti e liberi in quell’orario. '
     'Con la forzatura anche quelli già impegnati o fuori turno, mai quelli assenti.</div>'),
    # Warning before confirming a forced overlap (studio and services without studio).
    ('function oaSetStudios(rows,starts,forced){',
     NOTICE + 'function oaSetStudios(rows,starts,forced){'),
    ("force_time:!!forced};E('oaCreate').disabled=false}}",
     "force_time:!!forced};E('oaCreate').disabled=false;if(forced)oaForceOverlapNotice(r)}}"),
    ("E('oaStudio').innerHTML='<option value=\"\">Nessuno studio necessario</option>';E('oaCreate').disabled=false;return}",
     "E('oaStudio').innerHTML='<option value=\"\">Nessuno studio necessario</option>';E('oaCreate').disabled=false;"
     "if(forced)oaForceOverlapNotice(r);return}"),
    # With forcing, no options only means that no active studio is enabled for the service.
    ("status('oaNewStatus','Nessuno studio libero per questo servizio in questo orario.',true)",
     "status('oaNewStatus','Nessuno studio attivo è abilitato per questo servizio.',true)"),
]

CSS = ('<style id="optykerAgendaForceOccupiedCss">/* ' + MARK + ' */\n'
       '#oaNewModal #oaNewStatus.oaStatus.warn{color:#7a4b00!important;background:#fff4d6;border:1px solid #e9c46a;'
       'border-radius:8px;margin:8px 13px 0;padding:8px 11px!important;font-size:11px!important;font-weight:800;line-height:1.4}\n'
       '</style>\n')


def patch(html, rel):
    if MARK in html:
        return html
    for old, new in REPLACEMENTS:
        if html.count(old) != 1:
            raise SystemExit('Agenda forzatura: punto di modifica cambiato in ' + rel + ': ' + old[:90])
        html = html.replace(old, new, 1)
    if '</head>' not in html:
        raise SystemExit('Agenda forzatura: </head> mancante in ' + rel)
    return html.replace('</head>', CSS + '</head>', 1)


for rel in ('index.html', 'gestionale-v2/index.html', 'gestionale-v3/index.html'):
    path = SITE / rel
    html = path.read_text(encoding='utf-8')
    updated = patch(html, rel)
    if patch(updated, rel) != updated:
        raise SystemExit('Agenda forzatura: passo non idempotente in ' + rel)
    path.write_text(updated, encoding='utf-8')

main = (SITE / 'index.html').read_text(encoding='utf-8')
for needle in [MARK, 'function oaForceOverlapNotice(r)', 'if(forced)oaForceOverlapNotice(r)}}',
               'con studio occupato', 'optykerAgendaForceOccupiedCss']:
    if needle not in main:
        raise SystemExit('Agenda forzatura incompleta: ' + needle)
if 'Le sovrapposizioni nello stesso studio restano bloccate.' in main:
    raise SystemExit('Agenda forzatura: testo precedente ancora presente')

digest = hashlib.sha256(Path(__file__).read_bytes()).hexdigest()
(SITE / 'agenda-force-occupied-version.json').write_text(json.dumps({'version': VERSION, 'sha256': digest}) + '\n')
print('Agenda: Forza appuntamento anche con studio o operatore occupato,', VERSION)

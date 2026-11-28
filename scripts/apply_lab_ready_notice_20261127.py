"""Laboratorio 20261127: conferma prima dell'avviso WhatsApp «busta pronta».

Carica lab-ready-notice.js (nome con hash del contenuto) nei tre accessi desktop. Il modulo:
- avvolge labUpdateStatus del Laboratorio (script optykerLaboratoryScript): passando una busta a «Pronto per la
  consegna» chiede se avvisare il cliente su WhatsApp («Sì, invia il messaggio» / «No» / «Annulla»);
- sotto le buste già pronte mostra lo stato dell'avviso e il pulsante «Avvisa il cliente su WhatsApp».
Il modulo legge l'id della busta dal menu Stato ordine (onchange="labUpdateStatus('<id>',this.value)") e ricarica la
lista con il pulsante Aggiorna (id labRefresh): se il Laboratorio cambia, la build si ferma invece di pubblicare
una conferma che non compare.
"""
from pathlib import Path
import hashlib
import json
import re

ROOT = Path(__file__).resolve().parent.parent
SITE = ROOT / '_site'
MARK = 'OPTYKER_LAB_READY_NOTICE_20261127'
SCRIPT_ID = 'optykerLabReadyNoticeJs'
ENTRIES = ('index.html', 'gestionale-v2/index.html', 'gestionale-v3/index.html')
LAB_SCRIPT = re.compile(r'<script\b[^>]*\bid="optykerLaboratoryScript"[^>]*>(.*?)</script>', re.S)
LAB_NEEDS = (
    ('window.labUpdateStatus=function(id,status)', 'funzione labUpdateStatus'),
    ("onchange=\"labUpdateStatus(\\''+h(o.id)+'\\',this.value)\"", 'menu Stato ordine'),
    ('<option value="pronto_consegna"', 'stato Pronto per la consegna'),
    ('id="labRefresh"', 'pulsante Aggiorna'),
    ('id="labOrdersList"', 'lista delle buste'),
    ('labStatusBox', 'riquadro Stato ordine'),
)

raw = (ROOT / 'lab-ready-notice.js').read_bytes()
if MARK.encode() not in raw:
    raise SystemExit('Laboratorio avviso pronto: marcatore mancante in lab-ready-notice.js')
name = 'lab-ready-notice.' + hashlib.sha256(raw).hexdigest()[:12] + '.js'
(SITE / name).write_bytes(raw)
tag = '<script id="' + SCRIPT_ID + '" defer src="/' + name + '"></script>'
previous = re.compile(r'<script[^>]*id="' + SCRIPT_ID + r'"[^>]*></script>\n?')

for rel in ENTRIES:
    path = SITE / rel
    html = path.read_text(encoding='utf-8')
    found = LAB_SCRIPT.findall(html)
    if len(found) != 1:
        raise SystemExit('Laboratorio avviso pronto: script del Laboratorio assente o duplicato in ' + rel)
    for needle, what in LAB_NEEDS:
        if needle not in found[0]:
            raise SystemExit('Laboratorio avviso pronto: ' + what + ' cambiato nel Laboratorio di ' + rel)
    html = previous.sub('', html)
    if html.count('</head>') < 1:
        raise SystemExit('Laboratorio avviso pronto: intestazione della pagina cambiata in ' + rel)
    html = html.replace('</head>', tag + '\n</head>', 1)
    if html.count('id="' + SCRIPT_ID + '"') != 1:
        raise SystemExit('Laboratorio avviso pronto: modulo duplicato in ' + rel)
    path.write_text(html, encoding='utf-8')

(SITE / 'lab-ready-notice-version.json').write_text(json.dumps({
    'release': '20261127-confirm1',
    'file': name,
    'sha256': hashlib.sha256(raw).hexdigest(),
    'api': 'optyker_lab_ready_notice_api',
}, indent=2) + '\n', encoding='utf-8')
print('Laboratorio: conferma prima dell\'avviso WhatsApp «busta pronta» nei tre accessi desktop (' + name + ')')

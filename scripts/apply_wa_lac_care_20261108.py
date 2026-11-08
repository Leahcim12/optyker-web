"""WhatsApp 20261108: istruzioni di pulizia delle lenti a contatto.

1. Pubblica i PDF di istruzioni-lac/ su /istruzioni-lac/ (li invia l'assistente WhatsApp in base alla scheda LAC).
2. Aggiunge nella scheda LAC la casella "Perossido" (id lacPeroxide), accanto alla data di richiamo per riordino.
   La scheda salva e ricarica da sola ogni campo con un id dentro #lacPanel, quindi la casella non ha codice suo.
"""
from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parent.parent
SITE = ROOT / '_site'
MARK = 'OPTYKER_LAC_PEROXIDE_20261108'

out = SITE / 'istruzioni-lac'
out.mkdir(exist_ok=True)
pdfs = sorted((ROOT / 'istruzioni-lac').glob('*.pdf'))
if len(pdfs) != 5:
    raise SystemExit('Istruzioni LAC: attesi 5 PDF in istruzioni-lac/, trovati ' + str(len(pdfs)))
for pdf in pdfs:
    shutil.copyfile(pdf, out / pdf.name)

OLD = ('<div class="lacTraceField"><label for="lacReorderRecallDate">Data richiamo scheda per riordino</label>'
       '<input id="lacReorderRecallDate" type="date"></div>')
NEW = OLD + ('<!-- ' + MARK + ' --><div class="lacTraceField lacPeroxideField">'
             '<label for="lacPeroxide" style="display:flex;align-items:center;gap:8px;cursor:pointer">'
             '<input id="lacPeroxide" type="checkbox" style="width:auto;margin:0"> Perossido</label>'
             '<small style="display:block;opacity:.7">Manutenzione con perossido: su WhatsApp il cliente riceve le istruzioni Perossido</small></div>')
for rel in ('index.html', 'gestionale-v2/index.html', 'gestionale-v3/index.html'):
    path = SITE / rel
    html = path.read_text(encoding='utf-8')
    if MARK in html:
        continue
    if html.count(OLD) != 1:
        raise SystemExit('Scheda LAC: campo richiamo riordino cambiato in ' + rel)
    path.write_text(html.replace(OLD, NEW, 1), encoding='utf-8')
print('Scheda LAC: casella Perossido e istruzioni di pulizia pubblicate')

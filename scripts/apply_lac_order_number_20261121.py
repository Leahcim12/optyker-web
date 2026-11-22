"""Scheda LAC 20261121: «Numero d'ordine» per lente DX e SX, accanto a colore e lotto.

1. In Prodotto -> «Identificazione lenti e richiami» aggiunge, sotto Colore e Lotto di ciascuna lente, la casella
   «Numero d'ordine lente DX» (id lacOdOrderNumber) e «Numero d'ordine lente SX» (id lacOsOrderNumber).
   La scheda salva, ricarica e azzera da sola ogni campo con un id dentro #lacPanel, quindi le caselle
   non hanno codice loro per i dati.
2. Carica lac-order-number.js, che riporta i numeri d'ordine nel modulo riepilogativo (sezione
   «Identificazione lenti e richiami», dopo il lotto della stessa lente); stampa e invio al Laboratorio
   usano quel riepilogo.
"""
from pathlib import Path
import hashlib
import re

ROOT = Path(__file__).resolve().parent.parent
SITE = ROOT / '_site'
MARK = 'OPTYKER_LAC_ORDER_NUMBER_20261121'
EYES = (('Od', 'DX'), ('Os', 'SX'))


def lot_field(eye):
    """Casella «Lotto lente DX/SX» della pagina, con gli attributi dell'input in qualsiasi ordine."""
    return re.compile(r'<div class="lacTraceField">\s*<label for="lac' + eye + r'Lot">[^<]*</label>\s*'
                      r'<input\b[^>]*\bid="lac' + eye + r'Lot"[^>]*>\s*</div>')


def order_field(eye, side):
    # Riga intera sotto Colore e Lotto della stessa lente.
    return ('<!-- ' + MARK + ' --><div class="lacTraceField lacOrderNumberField" style="grid-column:1/-1">'
            '<label for="lac' + eye + 'OrderNumber">Numero d\'ordine lente ' + side + '</label>'
            '<input id="lac' + eye + 'OrderNumber" type="text" placeholder="Numero / codice ordine" autocomplete="off"></div>')


raw = (ROOT / 'lac-order-number.js').read_bytes()
name = 'lac-order-number.' + hashlib.sha256(raw).hexdigest()[:12] + '.js'
(SITE / name).write_bytes(raw)
tag = '<script id="optykerLacOrderNumberJs" defer src="/' + name + '"></script>'

for rel in ('index.html', 'gestionale-v2/index.html', 'gestionale-v3/index.html'):
    path = SITE / rel
    html = path.read_text(encoding='utf-8')
    if MARK not in html:
        for eye, side in EYES:
            found = list(lot_field(eye).finditer(html))
            if len(found) != 1:
                raise SystemExit('Scheda LAC: casella Lotto lente ' + side + ' cambiata in ' + rel)
            end = found[0].end()
            html = html[:end] + order_field(eye, side) + html[end:]
    for eye, side in EYES:
        if html.count('id="lac' + eye + 'OrderNumber"') != 1:
            raise SystemExit('Scheda LAC: Numero d\'ordine lente ' + side + ' assente o duplicato in ' + rel)
    html = re.sub(r'<script[^>]*id="optykerLacOrderNumberJs"[^>]*></script>\n?', '', html)
    if '</head>' not in html:
        raise SystemExit('Scheda LAC: intestazione della pagina cambiata in ' + rel)
    html = html.replace('</head>', tag + '\n</head>', 1)
    path.write_text(html, encoding='utf-8')
print('Scheda LAC: Numero d\'ordine per lente DX e SX e riepilogo aggiornati nei tre accessi desktop')

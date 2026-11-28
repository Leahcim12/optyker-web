"""Stampa da iPad e iPhone 20261126: le stampe di Optyker non escono più bianche su iOS.

Pubblica ios-print.js (nome con l'impronta del contenuto) e lo carica nei tre accessi desktop, dopo la pagina
(defer): solo su iPad/iPhone printHtmlDocument stampa il documento nella pagina stessa invece che dall'iframe
nascosto (che Safari su iOS stampa bianco); sui computer la stampa non cambia. «Stampa documento» delle
indicazioni d'uso apre il PDF di /istruzioni-lac/ quando il vecchio programma Windows non c'è.
Si ferma se la pagina non ha più le funzioni di stampa che il modulo avvolge.
"""
from pathlib import Path
import hashlib
import re

ROOT = Path(__file__).resolve().parent.parent
SITE = ROOT / '_site'
ENTRIES = ('index.html', 'gestionale-v2/index.html', 'gestionale-v3/index.html')
NEEDED = ('function printHtmlDocument(', 'function printIndicationsUse(', 'function printIndicationsDocument(',
          'id="iuDocumentSelect"', 'function getPrintFrame(')

raw = (ROOT / 'ios-print.js').read_bytes()
name = 'ios-print.' + hashlib.sha256(raw).hexdigest()[:12] + '.js'
(SITE / name).write_bytes(raw)
tag = '<script id="optykerIosPrintJs" defer src="/' + name + '"></script>'

for rel in ENTRIES:
    path = SITE / rel
    html = path.read_text(encoding='utf-8')
    for needle in NEEDED:
        if needle not in html:
            raise SystemExit('Stampa iPad: «' + needle + '» non trovato in ' + rel)
    html = re.sub(r'<script[^>]*id="optykerIosPrintJs"[^>]*></script>\n?', '', html)
    if '</head>' not in html:
        raise SystemExit('Stampa iPad: intestazione della pagina cambiata in ' + rel)
    html = html.replace('</head>', tag + '\n</head>', 1)
    path.write_text(html, encoding='utf-8')
print('Stampa iPad: ' + name + ' caricato nei tre accessi desktop')

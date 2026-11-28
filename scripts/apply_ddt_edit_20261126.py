"""DDT 20261126: «Modifica» per ogni documento di trasporto in Documenti › Documento di trasporto.

1. Nell'elenco dei DDT aggiunge, accanto a «Visualizza / Stampa» (OPTYKER_DDT_VIEW_20261015), il pulsante
   «Modifica» legato allo stesso documento della riga.
2. Pubblica ddt-edit.js (nome con l'impronta del contenuto) e lo carica nei tre accessi desktop: apre il DDT con
   tutti i campi e lo salva con optyker-documents-api (azione update_ddt). Numero e autore non cambiano.
Si ferma se l'elenco dei DDT è cambiato: meglio una build ferma che un pulsante legato al documento sbagliato.
"""
from pathlib import Path
import hashlib
import re

ROOT = Path(__file__).resolve().parent.parent
SITE = ROOT / '_site'
MARK = 'OPTYKER_DDT_EDIT_20261126'
ENTRIES = ('index.html', 'gestionale-v2/index.html', 'gestionale-v3/index.html')
# Riga dell'elenco legata al suo documento da apply_ddt_view_20261015.py: documents[index] è il DDT della riga.
ANCHOR = "row.querySelector('[data-ddt-view]').onclick=open;"
BUTTON = (ANCHOR + "\n        /* " + MARK + " */(function(view,doc){var b=document.createElement('button');"
          "b.type='button';b.className='optykerDocsRefresh';b.setAttribute('data-ddt-edit','');b.textContent='Modifica';"
          "b.style.marginLeft='6px';b.setAttribute('aria-label','Modifica DDT '+String(doc&&doc.document_number||''));"
          "b.onclick=function(){if(typeof window.optykerEditDdt==='function')window.optykerEditDdt(doc)};"
          "view.parentNode.appendChild(b)})(row.querySelector('[data-ddt-view]'),documents[index]);")

raw = (ROOT / 'ddt-edit.js').read_bytes()
name = 'ddt-edit.' + hashlib.sha256(raw).hexdigest()[:12] + '.js'
(SITE / name).write_bytes(raw)
tag = '<script id="optykerDdtEditJs" defer src="/' + name + '"></script>'

for rel in ENTRIES:
    path = SITE / rel
    html = path.read_text(encoding='utf-8')
    if MARK not in html:
        if html.count(ANCHOR) != 1:
            raise SystemExit('DDT: elenco dei documenti di trasporto cambiato in ' + rel + ' (Visualizza / Stampa non trovato una sola volta)')
        if 'var documents=S.rows.slice();' not in html:
            raise SystemExit('DDT: righe dell\'elenco non più legate ai documenti in ' + rel)
        html = html.replace(ANCHOR, BUTTON, 1)
    if html.count(MARK) != 1:
        raise SystemExit('DDT: pulsante Modifica assente o duplicato in ' + rel)
    html = re.sub(r'<script[^>]*id="optykerDdtEditJs"[^>]*></script>\n?', '', html)
    if '</head>' not in html:
        raise SystemExit('DDT: intestazione della pagina cambiata in ' + rel)
    html = html.replace('</head>', tag + '\n</head>', 1)
    path.write_text(html, encoding='utf-8')
print('DDT: pulsante Modifica e finestra di modifica nei tre accessi desktop')

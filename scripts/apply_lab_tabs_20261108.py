"""Laboratorio 20261108: buste separate per stato (Inserite, In preparazione, In lavorazione, In spedizione, Pronte, Consegnate, Annullate).

Copies lab-status-tabs.js with a content hash and loads it in the three desktop entry points.
"""
from pathlib import Path
import hashlib
import re

ROOT = Path(__file__).resolve().parent.parent
SITE = ROOT / '_site'
raw = (ROOT / 'lab-status-tabs.js').read_bytes()
name = 'lab-status-tabs.' + hashlib.sha256(raw).hexdigest()[:12] + '.js'
(SITE / name).write_bytes(raw)
tag = '<script id="optykerLabTabsJs" defer src="/' + name + '"></script>'
for rel in ('index.html', 'gestionale-v2/index.html', 'gestionale-v3/index.html'):
    path = SITE / rel
    html = path.read_text(encoding='utf-8')
    html = re.sub(r'<script[^>]*id="optykerLabTabsJs"[^>]*></script>\n?', '', html)
    if '</head>' not in html:
        raise SystemExit('Laboratorio: desktop entry point changed in ' + rel)
    html = html.replace('</head>', tag + '\n</head>', 1)
    path.write_text(html, encoding='utf-8')
print('Laboratorio: schede per stato incluse nei tre accessi desktop')

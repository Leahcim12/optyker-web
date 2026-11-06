"""WhatsApp 20261107: "Controllo 6 mesi" button in the optometric prescription panel.

Copies wa-recall-control.js with a content hash and loads it in the three desktop entry points.
"""
from pathlib import Path
import hashlib
import re

ROOT = Path(__file__).resolve().parent.parent
SITE = ROOT / '_site'
raw = (ROOT / 'wa-recall-control.js').read_bytes()
name = 'wa-recall-control.' + hashlib.sha256(raw).hexdigest()[:12] + '.js'
(SITE / name).write_bytes(raw)
tag = '<script id="optykerWaRecallJs" defer src="/' + name + '"></script>'
for rel in ('index.html', 'gestionale-v2/index.html', 'gestionale-v3/index.html'):
    path = SITE / rel
    html = path.read_text(encoding='utf-8')
    html = re.sub(r'<script[^>]*id="optykerWaRecallJs"[^>]*></script>\n?', '', html)
    if 'id="optykerOphthalmicJs"' not in html or '</head>' not in html:
        raise SystemExit('WhatsApp recall: desktop entry point changed in ' + rel)
    html = html.replace('</head>', tag + '\n</head>', 1)
    path.write_text(html, encoding='utf-8')
print('WhatsApp: pulsante Controllo 6 mesi incluso nei tre accessi desktop')

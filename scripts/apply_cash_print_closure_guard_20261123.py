"""Cassa 20261123: niente stampa RCH finché manca la chiusura del giorno precedente.

Inserisce cash-print-closure-guard.js come PRIMO script della pagina, nei tre accessi desktop.
Deve girare prima degli altri moduli: alcuni salvano window.fetch al caricamento e la cassa
sostituisce window.OPTYKER_FISCAL; il blocco deve vedere ogni richiesta di stampa.
Il codice è inline per non aggiungere un file da scaricare prima della pagina.
"""
from pathlib import Path
import hashlib
import json
import re

ROOT = Path(__file__).resolve().parent.parent
SITE = ROOT / '_site'
SCRIPT_ID = 'optykerCashPrintGuardJs'
MARK = 'OPTYKER_CASH_PRINT_CLOSURE_GUARD_20261123'

code = (ROOT / 'cash-print-closure-guard.js').read_text(encoding='utf-8').strip()
if MARK not in code:
    raise SystemExit('Blocco stampa: marcatore mancante nel file del modulo')
if re.search(r'</script', code, re.I) or '<!--' in code:
    raise SystemExit('Blocco stampa: il modulo non può essere inserito inline')
tag = '<script id="' + SCRIPT_ID + '">' + code + '</script>'
previous = re.compile(r'<script id="' + SCRIPT_ID + r'">.*?</script>\n?', re.S)
head_open = re.compile(r'<head(?:\s[^>]*)?>', re.I)

for rel in ('index.html', 'gestionale-v2/index.html', 'gestionale-v3/index.html'):
    path = SITE / rel
    html = previous.sub('', path.read_text(encoding='utf-8'))
    # Il primo <head> della pagina; gli altri sono dentro stringhe JavaScript per le stampe.
    found = head_open.search(html)
    first_script = html.find('<script')
    if not found or found.start() > 2000 or (first_script >= 0 and found.start() > first_script):
        raise SystemExit('Blocco stampa: <head> della pagina non trovato in ' + rel)
    end = found.end()
    html = html[:end] + '\n' + tag + html[end:]
    first = re.search(r'<script\b[^>]*>', html)
    if not first or ('id="' + SCRIPT_ID + '"') not in first.group(0):
        raise SystemExit('Blocco stampa: non è il primo script in ' + rel)
    if html.count('id="' + SCRIPT_ID + '"') != 1:
        raise SystemExit('Blocco stampa: modulo duplicato in ' + rel)
    path.write_text(html, encoding='utf-8')

(SITE / 'cash-print-guard-version.json').write_text(json.dumps({
    'release': '20261123-guard1',
    'script_id': SCRIPT_ID,
    'sha256': hashlib.sha256(code.encode('utf-8')).hexdigest(),
    'gate_api': 'optyker-cash-print-gate',
}, indent=2) + '\n', encoding='utf-8')
print('Cassa: blocco stampa senza chiusura RCH inserito come primo script nei tre accessi desktop')

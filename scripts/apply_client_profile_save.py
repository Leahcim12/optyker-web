"""Append the anagrafica save controls after the existing cloud adapter."""
from pathlib import Path
from shutil import copyfile
import re
from apply_ts_connection import DocumentClosings

VERSION = '20260913-profile1'
root = Path('_site')
page = root / 'index.html'
text = page.read_text()
for marker in ('id="clientAnagraficaSection"', 'clientSaveMetadata=function()', 'function cloudClientPayload('):
    if marker not in text:
        raise SystemExit('Anagrafica save: existing cloud form missing: ' + marker)
text = re.sub(r'<script[^>]*id="optykerClientProfileSaveJs"[^>]*></script>\s*', '', text)
text = re.sub(r'<link[^>]*id="optykerClientProfileSaveCss"[^>]*>\s*', '', text)
closings = DocumentClosings(text).closings
if set(closings) != {'head', 'body'}:
    raise SystemExit('Anagrafica save: document boundaries missing')
for tag in sorted(closings, key=closings.get, reverse=True):
    asset = (f'<link rel="stylesheet" href="/client-profile-save.css?v={VERSION}" id="optykerClientProfileSaveCss">\n' if tag == 'head' else
             f'<script src="/client-profile-save.js?v={VERSION}" id="optykerClientProfileSaveJs"></script>\n')
    pos = closings[tag]
    text = text[:pos] + asset + text[pos:]
for name in ('client-profile-save.js', 'client-profile-save.css'):
    copyfile(name, root / name)
page.write_text(text)
for alias in ('gestionale-v2', 'gestionale-v3'):
    (root / alias / 'index.html').write_text(text)
print('Anagrafica: explicit save controls installed', VERSION)

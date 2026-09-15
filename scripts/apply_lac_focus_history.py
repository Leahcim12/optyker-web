"""Install the staff LAC history viewer in all desktop entry points."""
from pathlib import Path
from shutil import copyfile
from apply_ts_connection import DocumentClosings

root=Path('_site')
page=root/'index.html'
text=page.read_text()
marker='OPTYKER_LAC_FOCUS_HISTORY_LOADER'
if marker not in text:
    closings=DocumentClosings(text).closings
    assets={'head':'<link rel="stylesheet" href="/lac-focus-history.css?v=20260915-lac-history1">\n',
            'body':'<script src="/lac-focus-history.js?v=20260915-lac-history1"></script>\n<!-- '+marker+' -->\n'}
    for tag in sorted(closings,key=closings.get,reverse=True):
        pos=closings[tag]
        text=text[:pos]+assets[tag]+text[pos:]
for name in ('lac-focus-history.js','lac-focus-history.css'):
    copyfile(name,root/name)
page.write_text(text)
for alias in ('gestionale-v2','gestionale-v3'):
    (root/alias/'index.html').write_text(text)
print('LAC history viewer installed in all desktop entry points')

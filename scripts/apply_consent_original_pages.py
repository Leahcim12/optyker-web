"""Restore original consent pages; keep recorded forms/signatures untouched."""
import base64
import hashlib
import json
from pathlib import Path
import re
import shutil
import sys

root = Path(__file__).resolve().parents[1]
site = Path(sys.argv[1]) if len(sys.argv) > 1 else root / '_site'
assets = root / 'INFORMATIVE'
pages = {}
for kind, count in [('ortho', 8), ('lac', 5)]:
    for number in range(1, count + 1):
        name = f'{kind}-{number}.png'
        raw = (assets / name).read_bytes()
        if not raw.startswith(b'\x89PNG\r\n\x1a\n') or len(raw) < 10000:
            raise SystemExit('Missing/blank original consent page: ' + name)
        pages[name] = 'data:image/png;base64,' + base64.b64encode(raw).decode()

source = (site / 'index.html').read_text()
source, count = re.subn(r'var OPTYKER_CONSENT_PAGE_DATA=\{[^\n]*?\};',
                      'var OPTYKER_CONSENT_PAGE_DATA=' + json.dumps(pages) + ';', source)
if count != 1:
    raise SystemExit('Consent page map contract changed')
# Keep the signature above its line, clear of the minor/guardian statement.
source = source.replace('top:47.5%;width:34%;height:7%', 'top:47.0%;width:34%;height:3.2%')
source = source.replace('top:57.0%;width:34%;height:7%', 'top:56.7%;width:34%;height:3.2%')
source = source.replace("d.lacYears,'left:35%;top:21.4%;width:8%", "d.lacYears,'left:30%;top:21.4%;width:4.2%")
source = source.replace('left:10%;top:62.5%;width:77%', 'left:10%;top:64.0%;width:77%')
source = source.replace('left:31%;top:60.1%;width:37%', 'left:25%;top:60.1%;width:40%')
source = source.replace('left:31%;top:69.1%;width:37%', 'left:25%;top:69.1%;width:40%')
source = source.replace("d.lacVisitYears,'left:35%;top:33.8%;width:8%", "d.lacVisitYears,'left:34.2%;top:33.8%;width:3.2%")
source = source.replace("d.lacChangeYears,'left:35%;top:36.9%;width:8%", "d.lacChangeYears,'left:36.8%;top:36.9%;width:3.2%")
source = source.replace('left:64%;top:27.4%;width:17%', 'left:64%;top:28.0%;width:17%')
# Never send an incomplete image document to the printer after the old timeout.
old = "if(ready||attempts>80){clearInterval(timer);w.focus();setTimeout(function(){try{w.print();}catch(e){}},120);}"
new = "if(ready){clearInterval(timer);w.focus();setTimeout(function(){try{w.print();}catch(e){}},120);}else if(attempts>80){clearInterval(timer);alert('Documento non completamente caricato. Chiudi la finestra e riprova la stampa.');}"
if old not in source and new not in source:
    raise SystemExit('Consent print readiness contract changed')
source = source.replace(old, new)
marker = '<!-- OPTYKER_CONSENT_ORIGINAL_PAGES_20261010 -->'
if marker not in source:
    source = source.replace('</head>', marker + '\n</head>', 1)
for alias in ['', 'gestionale-v2', 'gestionale-v3']:
    folder = site / alias
    folder.mkdir(parents=True, exist_ok=True)
    (folder / 'index.html').write_text(source)
    shutil.copytree(assets, folder / 'INFORMATIVE', dirs_exist_ok=True)
(site / 'consent-original-pages-version.json').write_text(json.dumps({
    'version': '20261010-original-pages1', 'pages': {'ortho': 8, 'lac': 5},
    'originals': {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in assets.glob('*.pdf')}
}))
print('Original consent pages restored: 8 ortho + 5 LAC; original PDFs preserved.')

# One shared renderer for the customer app and website, using the same overlays as the desktop.
templates = re.search(r'var CONSENT_TEMPLATES=\{[\s\S]*?\n\};', source)
start = source.index('function cloudConsentEscape')
end = source.index('function cloudConsentRecord(id)', start)
if not templates:
    raise SystemExit('Consent template contract changed')
pdfs = {kind: base64.b64encode((assets / name).read_bytes()).decode() for kind, name in [
    ('ortho', 'Consenso Ortocheratologia.pdf'), ('lac', 'Consenso lac.pdf')]}
escape = "function escapeHtml(v){return String(v==null?'':v).replace(/[&<>\"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',\"'\":'&#39;'}[c]});}\n"
bundle = '(function(){\n'+escape+templates[0]+'\n'+source[start:end]+'\nvar OPTYKER_CONSENT_PDF_DATA='+json.dumps(pdfs)+';\n'+(root/'consent-document-api.js').read_text()+'\n})();\n'
(site/'consent-documents.js').write_text(bundle)
shutil.copytree(root/'vendor', site/'vendor', dirs_exist_ok=True)
print('Shared signed consent renderer prepared for website and app.')

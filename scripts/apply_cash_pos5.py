"""Install POS5 add-on after the existing cash/fiscal bundles without rewriting their business logic."""
from pathlib import Path
import re, shutil, sys

ROOT=Path(__file__).resolve().parent.parent
SITE=Path(sys.argv[1]) if len(sys.argv)>1 else Path('_site')
VERSION='20260914-pos5'
source=ROOT/'cash-pos5.js'
if not source.is_file():
    raise SystemExit('cash-pos5.js missing')

def patch(page: Path):
    text=page.read_text(encoding='utf-8')
    text=re.sub(r'<script\b[^>]*id=["\']optykerCashPos5Js["\'][^>]*>\s*</script>\s*','',text,flags=re.I)
    tag=f'<script id="optykerCashPos5Js" defer src="/cash-pos5.js?v={VERSION}"></script>'
    i=text.lower().find('</head>')
    if i<0:
        raise SystemExit('Real closing head not found in '+str(page))
    text=text[:i]+tag+'\n'+text[i:]
    page.write_text(text,encoding='utf-8')
    return text

main=SITE/'index.html'
html=patch(main)
for alias in ('gestionale-v2','gestionale-v3'):
    p=SITE/alias/'index.html'
    p.write_text(html,encoding='utf-8')
shutil.copyfile(source,SITE/'cash-pos5.js')
for alias in ('gestionale-v2','gestionale-v3'):
    shutil.copyfile(source,SITE/alias/'cash-pos5.js')
print('Cassa POS5 installed:',VERSION)

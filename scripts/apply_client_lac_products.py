"""Install the client LAC product workspace only after the core desktop build is stable."""
from pathlib import Path
from shutil import copyfile
import json, os

ROOT=Path(__file__).resolve().parent.parent
SITE=ROOT/'_site'
VERSION='20260924-lac-products4'
CSS='<link id="optykerClientLacProductsCss" rel="stylesheet" href="/client-lac-products.css?v='+VERSION+'">'
JS='<script id="optykerClientLacProductsJs" defer src="/client-lac-products.js?v='+VERSION+'"></script>'

for name in ('client-lac-products.js','client-lac-products.css'):
    copyfile(ROOT/name,SITE/name)
    for alias in ('gestionale-v2','gestionale-v3'):
        copyfile(ROOT/name,SITE/alias/name)

for rel in ('index.html','gestionale-v2/index.html','gestionale-v3/index.html'):
    p=SITE/rel
    text=p.read_text(encoding='utf-8')

    # The downloaded production base can already contain the old inline
    # OPTYKER_CLIENT_EYEWEAR_NAV_V1. Patch the assembled artifact itself:
    # LAC is a permanent customer tab and must never depend on sheet count.
    old_css='#clientPageNav [data-client-page="lac"].clientPageHidden,\n#clientPageNav [data-client-page="occhiali"].clientPageHidden{display:none!important}'
    new_css='#clientPageNav [data-client-page="occhiali"].clientPageHidden{display:none!important}\n#clientPageNav [data-client-page="lac"]{display:block!important;visibility:visible!important;opacity:1!important}'
    text=text.replace(old_css,new_css)

    old_lac_visibility="if(lac){lac.classList.toggle('clientPageHidden',lc===0);var a=E('clientPageCountLac');if(a){a.textContent=lc||'';a.style.display=lc?'inline-flex':'none'}}"
    new_lac_visibility="if(lac){lac.classList.remove('clientPageHidden');lac.hidden=false;lac.style.removeProperty('display');var a=E('clientPageCountLac');if(a){a.textContent=lc||'';a.style.display=lc?'inline-flex':'none'}}"
    text=text.replace(old_lac_visibility,new_lac_visibility)

    old_lac_redirect="if(currentPage==='lac'&&lc===0&&window.optykerClientOpenPage){currentPage='anagrafica';window.optykerClientOpenPage('anagrafica')}"
    text=text.replace(old_lac_redirect,'')

    # Fail closed if the obsolete behavior is still present.
    if "lac.classList.toggle('clientPageHidden',lc===0)" in text or old_lac_redirect in text:
        raise SystemExit('Legacy LAC tab auto-hide still present in '+rel)
    if 'data-client-page="lac"' in text and '#clientPageNav [data-client-page="lac"]{display:block!important' not in text:
        raise SystemExit('Permanent LAC tab CSS missing in '+rel)
    # Replace older versions instead of adding duplicate loaders.
    import re
    text=re.sub(r'<link\b(?=[^>]*\bid=["\']optykerClientLacProductsCss["\'])[^>]*>',CSS,text,flags=re.I)
    text=re.sub(r'<script\b(?=[^>]*\bid=["\']optykerClientLacProductsJs["\'])[^>]*>\s*</script>',JS,text,flags=re.I)
    if 'id="optykerClientLacProductsCss"' not in text:
        i=text.lower().find('</head>')
        if i<0: raise SystemExit('Closing head missing: '+rel)
        text=text[:i]+CSS+'\n'+text[i:]
    if 'id="optykerClientLacProductsJs"' not in text:
        i=text.lower().rfind('</body>')
        if i<0: raise SystemExit('Closing body missing: '+rel)
        text=text[:i]+JS+'\n'+text[i:]
    p.write_text(text,encoding='utf-8')

main=(SITE/'index.html').read_bytes()
for alias in ('gestionale-v2','gestionale-v3'):
    if (SITE/alias/'index.html').read_bytes()!=main:
        raise SystemExit('Desktop aliases differ after LAC product workspace')

(SITE/'client-lac-products-version.json').write_text(json.dumps({
    'version':VERSION,
    'commit':os.environ.get('GITHUB_SHA') or os.environ.get('VERCEL_GIT_COMMIT_SHA','')
})+'\n',encoding='utf-8')
print('Client LAC product workspace installed:',VERSION)

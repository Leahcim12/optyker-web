"""Apply final assembled-page patches; source changes are prepared on the release branch."""
from pathlib import Path
import hashlib,json,os,re,shutil
ROOT=Path(__file__).resolve().parent.parent
SITE=ROOT/'_site';VERSION='20260911-workflow1'
p=SITE/'index.html';s=p.read_text()
if 'id="optykerSept11Js"' not in s:
    s,n=re.subn(r'<script\b[^>]*id="optykerSingleRootViewJs"[^>]*>.*?</script>','',s,flags=re.S)
    if n!=1:raise SystemExit('Expected exactly one old root observer')
    # All quote print entry points share the prescription header at runtime.
    old=next(line for line in s.splitlines() if 'window.lacPrintSummary=function()' in line)
    new=old.replace('w.document.write(','w.document.write(window.optykerQuotePrint.decorate(',1)
    new,n=re.subn(r'<script>window\.onload=function\(\)\{setTimeout\(function\(\)\{window\.print\(\)\},250\)\}<\\/script>','',new)
    if n!=1:raise SystemExit('Expected LAC print onload')
    ending="</body></html>');w.document.close();};"
    if new.count(ending)!=1:raise SystemExit('Expected LAC print ending')
    new=new.replace(ending,"</body></html>',((e('lacSelectedDocType')&&e('lacSelectedDocType').textContent||'').trim()==='Preventivo'?'Preventivo LAC':'Busta LAC'),[e('lacReference')&&e('lacReference').value,e('clientWorkspaceName')&&e('clientWorkspaceName').textContent].filter(Boolean).join(' · ')));w.document.close();window.optykerQuotePrint.finish(w);};")
    s=s.replace(old,new,1)
    s=s.replace('</head>','<link id="optykerSept11Css" rel="stylesheet" href="/optyker-sept11.css?v='+VERSION+'"><script id="optykerSept11Js" defer src="/optyker-sept11.js?v='+VERSION+'"></script></head>',1)
    s=s.replace('optyker-operations.js?v=20260910-ovc2','optyker-operations.js?v='+VERSION)
    s=s.replace('cash-register.js?v=20260910-ovc2','cash-register.js?v='+VERSION)
    p.write_text(s)
for alias in ('gestionale-v2','gestionale-v3'):
    f=SITE/alias/'index.html'
    if f.exists():f.write_text(s)
for name in ('optyker-sept11.js','optyker-sept11.css','billing-compose.js'):
    shutil.copyfile(ROOT/name,SITE/name)
for f in SITE.glob('*.js'):
    t=f.read_text();t=re.sub(r'(billing-compose\.js\?v=)[^\s\'"<>]+',r'\g<1>'+VERSION,t);f.write_text(t)
for name in ('operations-version.json','cart-privacy-version.json'):
    f=SITE/name
    if f.exists():
        x=json.loads(f.read_text())
        for asset in x.get('assets',{}):
            if (SITE/asset).exists():x['assets'][asset]=hashlib.sha256((SITE/asset).read_bytes()).hexdigest()
        f.write_text(json.dumps(x,indent=2)+'\n')
(SITE/'sept11-version.json').write_text(json.dumps({'version':VERSION,'commit':os.environ.get('GITHUB_SHA',os.environ.get('VERCEL_GIT_COMMIT_SHA','')),'assets':{n:hashlib.sha256((SITE/n).read_bytes()).hexdigest() for n in ('optyker-sept11.js','optyker-sept11.css','billing-compose.js')}},indent=2)+'\n')
assert 'OPTYKER_SINGLE_ROOT_VIEW_V1' not in s
assert 'optykerQuotePrint.decorate' in s
print('September 11 workflow, print and navigation release installed')

# Tested against the complete assembled app: legacy writers and theme precedence.
import runpy
runpy.run_path(str(ROOT/'scripts/apply_runtime_fix_20260911.py'))

"""Install administrator-only daily opening/closure accounting UI."""
from pathlib import Path
import hashlib,json,re,shutil,sys,os

ROOT=Path(__file__).resolve().parent.parent
SITE=Path(sys.argv[1]) if len(sys.argv)>1 else Path('_site')
VERSION='20260914-admin-cash2'
page=SITE/'index.html'
h=page.read_text(encoding='utf-8')
if 'billing-admin.js' not in h:
    raise SystemExit('Admin cash closure: billing administration loader missing')
for marker in ('optykerAdminCashClosureCss','optykerAdminCashClosureJs'):
    h=re.sub(r'<link\b[^>]*id=["\']'+marker+r'["\'][^>]*>\s*','',h,flags=re.I)
    h=re.sub(r'<script\b[^>]*id=["\']'+marker+r'["\'][^>]*>\s*</script>\s*','',h,flags=re.I)
css='<link id="optykerAdminCashClosureCss" rel="stylesheet" media="screen" href="/admin-cash-closure.css?v='+VERSION+'">'
js='<script id="optykerAdminCashClosureJs" defer src="/admin-cash-closure.js?v='+VERSION+'"></script>'
i=h.lower().rfind('</head>')
if i<0: raise SystemExit('Admin cash closure: closing head missing')
h=h[:i]+css+'\n'+js+'\n'+h[i:]
page.write_text(h,encoding='utf-8')
for alias in ('gestionale-v2','gestionale-v3'):
    p=SITE/alias/'index.html'
    if p.exists(): p.write_text(h,encoding='utf-8')
for name in ('admin-cash-closure.js','admin-cash-closure.css'):
    shutil.copyfile(ROOT/name,SITE/name)
release={
    'version':VERSION,
    'commit':os.environ.get('VERCEL_GIT_COMMIT_SHA') or os.environ.get('GITHUB_SHA',''),
    'features':['admin_opening','daily_closure','turnover_vs_paid','automatic_receipt_count','monthly_paid_total'],
    'assets':{n:hashlib.sha256((SITE/n).read_bytes()).hexdigest() for n in ('admin-cash-closure.js','admin-cash-closure.css')}
}
(SITE/'admin-cash-version.json').write_text(json.dumps(release,indent=2)+'\n',encoding='utf-8')
print('Administrator daily opening/closure installed: '+VERSION)

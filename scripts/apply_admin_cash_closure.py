"""Install administrator-only daily opening/closure accounting UI."""
from pathlib import Path
import hashlib,json,re,shutil,sys,os

ROOT=Path(__file__).resolve().parent.parent
SITE=Path(sys.argv[1]) if len(sys.argv)>1 else Path('_site')
VERSION='20260915-admin-cash4'
page=SITE/'index.html'
h=page.read_text(encoding='utf-8')
if 'billing-admin.js' not in h:
    raise SystemExit('Admin cash closure: billing administration loader missing')
for marker in ('optykerAdminCashClosureCss','optykerAdminCashTodayCss','optykerAdminCashClosureJs','optykerAdminCashTodayJs'):
    h=re.sub(r'<link\b[^>]*id=["\']'+marker+r'["\'][^>]*>\s*','',h,flags=re.I)
    h=re.sub(r'<script\b[^>]*id=["\']'+marker+r'["\'][^>]*>\s*</script>\s*','',h,flags=re.I)
assets_html=[
    '<link id="optykerAdminCashClosureCss" rel="stylesheet" media="screen" href="/admin-cash-closure.css?v='+VERSION+'">',
    '<link id="optykerAdminCashTodayCss" rel="stylesheet" media="screen" href="/admin-cash-today-controls.css?v='+VERSION+'">',
    '<script id="optykerAdminCashClosureJs" defer src="/admin-cash-closure.js?v='+VERSION+'"></script>',
    '<script id="optykerAdminCashTodayJs" defer src="/admin-cash-today-controls.js?v='+VERSION+'"></script>'
]
# Use the real document head. The assembled page contains HTML-like strings inside
# later JavaScript; rfind('</head>') can therefore inject markup into an inline script.
i=h.lower().find('</head>')
if i<0: raise SystemExit('Admin cash closure: closing head missing')
h=h[:i]+'\n'.join(assets_html)+'\n'+h[i:]
page.write_text(h,encoding='utf-8')
for alias in ('gestionale-v2','gestionale-v3'):
    p=SITE/alias/'index.html'
    if p.exists(): p.write_text(h,encoding='utf-8')
asset_names=('admin-cash-closure.js','admin-cash-closure.css','admin-cash-today-controls.js','admin-cash-today-controls.css')
for name in asset_names:
    shutil.copyfile(ROOT/name,SITE/name)
release={
    'version':VERSION,
    'commit':os.environ.get('VERCEL_GIT_COMMIT_SHA') or os.environ.get('GITHUB_SHA',''),
    'features':['admin_opening','daily_closure','turnover_vs_paid','automatic_receipt_count','monthly_paid_total','today_open_button','today_close_button','carry_forward_cash_fund'],
    'assets':{n:hashlib.sha256((SITE/n).read_bytes()).hexdigest() for n in asset_names}
}
(SITE/'admin-cash-version.json').write_text(json.dumps(release,indent=2)+'\n',encoding='utf-8')
print('Administrator daily opening/closure installed: '+VERSION)

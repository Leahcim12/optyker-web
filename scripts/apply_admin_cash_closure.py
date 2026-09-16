"""Install administrator-only daily opening/closure accounting UI."""
from pathlib import Path
import hashlib,json,re,shutil,sys,os

ROOT=Path(__file__).resolve().parent.parent
SITE=Path(sys.argv[1]) if len(sys.argv)>1 else Path('_site')
VERSION='20260916-admin-cash6'
page=SITE/'index.html'
h=page.read_text(encoding='utf-8')
if 'billing-admin.js' not in h:
    raise SystemExit('Admin cash closure: billing administration loader missing')

# Remove previous admin cash/admin entry tags so this patch is idempotent.
for marker in (
    'optykerAdminCashClosureCss','optykerAdminCashTodayCss','optykerAdminCashClosureJs',
    'optykerAdminCashTodayJs','optykerAdminCashRchRecoveryJs','optykerAdminEntryCss','optykerAdminEntryJs'
):
    h=re.sub(r'<link\b[^>]*id=["\']'+marker+r'["\'][^>]*>\s*','',h,flags=re.I)
    h=re.sub(r'<script\b[^>]*id=["\']'+marker+r'["\'][^>]*>[\s\S]*?</script>\s*','',h,flags=re.I)

# Repair stale repository-subpath references when the app is served on the custom domain.
h=re.sub(r'(["\'])/optyker-web/billing-admin\.js(?:\?[^"\']*)?\1',r'"/billing-admin.js?v=20260916-adminentry2"',h,flags=re.I)
h=re.sub(r'(["\'])/optyker-web/billing-admin\.css(?:\?[^"\']*)?\1',r'"/billing-admin.css?v=20260916-adminentry2"',h,flags=re.I)

admin_entry_css='''<style id="optykerAdminEntryCss">
#optykerAdminEntryBox{display:block;margin:14px auto 0;max-width:430px;text-align:center}
#optykerAdminEntryButton{width:100%;min-height:46px;border:1px solid #1769aa;border-radius:11px;background:#eef7fd;color:#1769aa;padding:0 14px;font:900 12px/1.2 "Segoe UI",Arial,sans-serif;letter-spacing:.04em;cursor:pointer;box-shadow:0 5px 16px rgba(23,105,170,.10)}
#optykerAdminEntryButton:hover{background:#e2f1fb}
#optykerAdminEntryButton:disabled{opacity:.6;cursor:wait}
#optykerAdminEntryHint{margin-top:6px;font:700 9px/1.35 "Segoe UI",Arial,sans-serif;color:#718493}
#optykerAdminEntryError{display:none;margin-top:7px;font:800 10px/1.35 "Segoe UI",Arial,sans-serif;color:#a93636}
</style>'''

# This loader deliberately builds /billing-admin.js dynamically, so later path-rewrite
# patches cannot turn it back into the old /optyker-web/ path on the custom domain.
admin_entry_js='''<script id="optykerAdminEntryJs">(function(){
  if(window.__OPTYKER_ADMIN_ENTRY_V1__)return;window.__OPTYKER_ADMIN_ENTRY_V1__=true;
  function E(id){return document.getElementById(id)}
  function rootAsset(name){return location.origin+'/'+name}
  function ensureOption(){
    ['optykerLoginOperator','optykerUserSelect'].forEach(function(id){
      var s=E(id);if(!s)return;
      for(var i=s.options.length-1;i>=0;i--){
        if(String(s.options[i].value||'').trim().toLowerCase()==='ottica visual care')s.remove(i)
      }
      var o=s.querySelector('option[value="__optyker_admin__"]');
      if(!o){o=document.createElement('option');o.value='__optyker_admin__';s.appendChild(o)}
      o.textContent='Amministratore · Ottica Visual Care';
    })
  }
  function ensureButton(){
    var screen=E('optykerLoginScreen');if(!screen)return;
    var shell=screen.querySelector('.optykerLoginShell')||screen;if(!shell)return;
    var box=E('optykerAdminEntryBox');
    if(!box){
      box=document.createElement('div');box.id='optykerAdminEntryBox';
      box.innerHTML='<button id="optykerAdminEntryButton" type="button">AMMINISTRAZIONE · OTTICA VISUAL CARE</button><div id="optykerAdminEntryHint">Accesso separato per fatture, chiusure cassa, Sistema TS e impostazioni</div><div id="optykerAdminEntryError"></div>';
      shell.appendChild(box);
      E('optykerAdminEntryButton').onclick=openAdmin;
    }
    box.style.display=E('optykerAdminLoginCard')?'none':'block';
    ensureOption();
  }
  function setErr(msg){var e=E('optykerAdminEntryError');if(!e)return;e.textContent=msg||'';e.style.display=msg?'block':'none'}
  function loadAdmin(cb){
    var css=E('optykerBillingAdminRootCss');
    if(!css){css=document.createElement('link');css.id='optykerBillingAdminRootCss';css.rel='stylesheet';css.href=rootAsset(['billing','admin.css'].join('-'))+'?v=20260916-adminentry2';document.head.appendChild(css)}
    if(window.__optykerBillingAdminLoaded){cb();return}
    var old=E('optykerBillingAdminRootLoader');
    if(old){var n=0,t=setInterval(function(){if(window.__optykerBillingAdminLoaded||n++>40){clearInterval(t);cb()}},100);return}
    var s=document.createElement('script');s.id='optykerBillingAdminRootLoader';s.src=rootAsset(['billing','admin.js'].join('-'))+'?v=20260916-adminentry2';
    s.onload=function(){cb()};s.onerror=function(){setErr('Modulo Amministrazione non caricato. Ricarica la pagina.');var b=E('optykerAdminEntryButton');if(b){b.disabled=false;b.textContent='AMMINISTRAZIONE · OTTICA VISUAL CARE'}};
    document.head.appendChild(s)
  }
  function triggerAdmin(){
    ensureOption();
    var s=E('optykerLoginOperator')||E('optykerUserSelect');
    if(!s){setErr('Selettore utenti non disponibile.');return false}
    s.value='__optyker_admin__';
    try{s.dispatchEvent(new Event('change',{bubbles:true}))}catch(e){var ev=document.createEvent('Event');ev.initEvent('change',true,true);s.dispatchEvent(ev)}
    return true
  }
  function openAdmin(){
    var b=E('optykerAdminEntryButton');if(b){b.disabled=true;b.textContent='APERTURA AMMINISTRAZIONE…'}setErr('');
    loadAdmin(function(){
      var tries=0,t=setInterval(function(){
        tries++;triggerAdmin();
        if(E('optykerAdminLoginCard')||tries>=8){clearInterval(t);if(b){b.disabled=false;b.textContent='AMMINISTRAZIONE · OTTICA VISUAL CARE'}if(!E('optykerAdminLoginCard'))setErr('Accesso amministrativo non aperto. Ricarica la pagina e riprova.');ensureButton()}
      },180)
    })
  }
  window.optykerOpenAdministration=openAdmin;
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ensureButton);else ensureButton();
  setInterval(ensureButton,1200)
})();</script>'''

assets_html=[
    '<link id="optykerAdminCashClosureCss" rel="stylesheet" media="screen" href="/admin-cash-closure.css?v='+VERSION+'">',
    '<link id="optykerAdminCashTodayCss" rel="stylesheet" media="screen" href="/admin-cash-today-controls.css?v='+VERSION+'">',
    '<script id="optykerAdminCashClosureJs" defer src="/admin-cash-closure.js?v='+VERSION+'"></script>',
    '<script id="optykerAdminCashTodayJs" defer src="/admin-cash-today-controls.js?v='+VERSION+'"></script>',
    '<script id="optykerAdminCashRchRecoveryJs" defer src="/admin-cash-rch-recovery.js?v=20260916-rchrecovery1"></script>',
    admin_entry_css,
    admin_entry_js
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
asset_names=('admin-cash-closure.js','admin-cash-closure.css','admin-cash-today-controls.js','admin-cash-today-controls.css','admin-cash-rch-recovery.js')
for name in asset_names:
    shutil.copyfile(ROOT/name,SITE/name)
release={
    'version':VERSION,
    'commit':os.environ.get('VERCEL_GIT_COMMIT_SHA') or os.environ.get('GITHUB_SHA',''),
    'features':['admin_login_entry','admin_opening','daily_closure','turnover_vs_paid','automatic_receipt_count','monthly_paid_total','today_open_button','today_close_button','carry_forward_cash_fund','rch_daily_closure','rch_closure_recovery'],
    'assets':{n:hashlib.sha256((SITE/n).read_bytes()).hexdigest() for n in asset_names}
}
(SITE/'admin-cash-version.json').write_text(json.dumps(release,indent=2)+'\n',encoding='utf-8')
print('Administrator daily opening/closure installed: '+VERSION)

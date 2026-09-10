"""Cart-first POS and annual privacy entry. Patch only known frontend contracts."""
from pathlib import Path
import re, shutil, json, os, hashlib
ROOT=Path(__file__).resolve().parent.parent
SITE=Path(__import__('sys').argv[1]) if len(__import__('sys').argv)>1 else Path('_site')
VERSION='20260910-cart-privacy1'

def replace_once(text,old,new):
    if text.count(old)!=1: raise SystemExit('Cart/privacy patch contract not unique: '+old[:90])
    return text.replace(old,new,1)

p=SITE/'cash-register.js'; s=p.read_text()
if 'function openProductPicker(' not in s:
    # Retain original IDs, product API, quantities, checkout and fiscal controls.
    search='<div class="optykerCashSearchWrap"><input id="optykerCashSearch" type="search" autocomplete="off" placeholder="Cerca prodotto, marca, SKU o codice…"></div>'
    catalog='<section class="optykerCashCatalog"><div class="optykerCashCatalogTop"><div id="optykerCashTypes"></div><button id="optykerCashRefresh" type="button">Aggiorna catalogo</button></div><div id="optykerCashProducts" class="optykerCashProducts"></div></section>'
    s=replace_once(s,search,'<div class="optykerCashFocusedHint">Vendita in corso · carrello</div>')
    s=replace_once(s,catalog,'')
    s=replace_once(s,'<div id="optykerCashCartItems" class="optykerCashCartItems"></div>', '<div id="optykerCashCartItems" class="optykerCashCartItems"></div><div class="optykerCashAddRow"><button id="optykerCashFindProducts" type="button" aria-haspopup="dialog" aria-controls="optykerCashProductPicker"><span aria-hidden="true">＋</span> Cerca e aggiungi prodotti</button><small>Ricerca per nome, marca, SKU o codice a barre</small></div>')
    modal='<dialog id="optykerCashProductPicker" aria-labelledby="optykerCashProductPickerTitle"><div class="optykerCashPickerLayout"><header class="optykerCashPickerHead"><div><h2 id="optykerCashProductPickerTitle">Cerca prodotti</h2><p>Aggiungi gli articoli, poi torna al carrello.</p></div><button id="optykerCashPickerClose" type="button" aria-label="Chiudi ricerca prodotti">×</button></header>'+search+catalog+'<footer class="optykerCashPickerFoot"><div id="optykerCashPickerStatus" role="status" aria-live="polite"></div><button id="optykerCashPickerDone" type="button">Torna al carrello</button></footer></div></dialog>'
    s=replace_once(s,"'</div></aside></div>';", "'</div></aside></div>'+\n    "+json.dumps(modal,ensure_ascii=False)+";")
    s=replace_once(s,"  document.body.appendChild(d);", "  document.body.appendChild(d);\n  E('optykerCashFindProducts').onclick=openProductPicker;\n  E('optykerCashPickerClose').onclick=closeProductPicker;\n  E('optykerCashPickerDone').onclick=closeProductPicker;\n  E('optykerCashProductPicker').addEventListener('close',function(){clearTimeout(S.searchTimer);S.productRequest=(S.productRequest||0)+1;E('optykerCashFindProducts').focus()});")
    functions="""
function openProductPicker(){
  var d=E('optykerCashProductPicker');if(!d||!S.cashOpen)return;
  if(!d.open)d.showModal();
  E('optykerCashPickerStatus').textContent=E('optykerCashCartCount').textContent+' nel carrello';
  loadProducts(false);E('optykerCashSearch').focus();
}
function closeProductPicker(){var d=E('optykerCashProductPicker');if(d&&d.open)d.close()}
"""
    s=replace_once(s,'function fillClients(id,rows){',functions+'\nfunction fillClients(id,rows){')
    s=replace_once(s,"renderCart();loadProducts(false);setTimeout(function(){try{E('optykerCashSearch').focus()}catch(e){}},60)","renderCart();setTimeout(function(){try{E('optykerCashFindProducts').focus()}catch(e){}},60)")
    s=replace_once(s,'  S.cashOpen=false;','  closeProductPicker();clearTimeout(S.searchTimer);S.productRequest=(S.productRequest||0)+1;\n  S.cashOpen=false;')
    s=replace_once(s,"  box.innerHTML='<div class=\"optykerCashLoading\">Caricamento catalogo…</div>';","  var request=S.productRequest=(S.productRequest||0)+1;\n  box.innerHTML='<div class=\"optykerCashLoading\">Caricamento catalogo…</div>';")
    s=replace_once(s,".then(function(x){S.products=Array.isArray(x.data)?x.data:[];S.type='';renderTypes();renderProducts()}).catch(function(e){box.innerHTML=", ".then(function(x){if(request!==S.productRequest)return;S.products=Array.isArray(x.data)?x.data:[];S.type='';renderTypes();renderProducts()}).catch(function(e){if(request!==S.productRequest)return;box.innerHTML=")
    s=replace_once(s,"if(S.products[i].variant_id===id)","if(String(S.products[i].variant_id)===String(id))")
    s=replace_once(s,"renderCart();toast(p.title+' aggiunto','ok')","renderCart();var status=E('optykerCashPickerStatus');if(status)status.textContent=p.title+' aggiunto · '+E('optykerCashCartCount').textContent;toast(p.title+' aggiunto','ok')")
    s=replace_once(s,'Seleziona un prodotto per iniziare.','Premi «Cerca e aggiungi prodotti» qui sotto per iniziare.')
    s=s.replace("window.OPTYKER_CASH_BUILD='20260909-rch-status2'", "window.OPTYKER_CASH_BUILD='"+VERSION+"'")
    p.write_text(s)

# Replace the calendar-like cash SVG, not the calendar icon used by appointments.
p=SITE/'optyker-vision.js';s=p.read_text()
old='cash:\'<rect x="4" y="5" width="16" height="17" rx="3"/><path d="M8 2v6m8-6v6M8 13h8m-8 4h5"/>\','
new='cash:\'<rect x="2" y="15" width="20" height="7" rx="2"/><path d="M4 15V8h13l3 7M7 8V2h9v6M7 5h6M6 11h1m3 0h1m3 0h1M10 18h4"/>\','
if old in s:s=replace_once(s,old,new)
elif new not in s:raise SystemExit('Cash icon source contract missing')
p.write_text(s)

p=SITE/'index.html';h=p.read_text()
h=h.replace('>INFORMATIVA PRIVACY</button>','>Informativa</button>')
h=h.replace('Informative privacy / consensi firmati','Informative e documenti firmati')
for marker in ('optykerCartPrivacyCss','optykerPrivacyJs'):
    h=re.sub(r'<(?:link|script)\b[^>]*id="'+marker+r'"[^>]*>(?:</script>)?\s*','',h)
if 'id="optykerPrivacyJs"' not in h:
    if 'data-optyker-cart=' not in h:h=h.replace('<html ', '<html data-optyker-cart="focused" ',1)
    h=h.replace('</head>', '<link id="optykerCartPrivacyCss" media="screen" rel="stylesheet" href="/optyker-cart-privacy.css?v='+VERSION+'">\n<script id="optykerPrivacyJs" defer src="/optyker-privacy.js?v='+VERSION+'"></script>\n</head>',1)
# Cache-bust both runtime-loaded POS and the dashboard script, for both hosting bases.
h=re.sub(r'(cash-register\.js|optyker-vision\.js)\?[^\"\'< >\s]+',lambda m:m[1]+'?v='+VERSION,h)
p.write_text(h)
for alias in ('gestionale-v2','gestionale-v3'):
    target=SITE/alias/'index.html'
    if target.exists():target.write_text(h)
for name in ('optyker-cart-privacy.css','optyker-privacy.js'):shutil.copyfile(ROOT/name,SITE/name)
release={'version':VERSION,'commit':os.environ.get('VERCEL_GIT_COMMIT_SHA') or os.environ.get('GITHUB_SHA',''),'sections':['cassa','dashboard','informativa'],'assets':{n:hashlib.sha256((SITE/n).read_bytes()).hexdigest() for n in ('cash-register.js','optyker-vision.js','optyker-cart-privacy.css','optyker-privacy.js')}}
(SITE/'cart-privacy-version.json').write_text(json.dumps(release,indent=2)+'\n')
print('Cart-first POS and privacy entry installed: '+VERSION)

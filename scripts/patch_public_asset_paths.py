"""Resolve final public asset paths and enforce Optyker physical-POS rules."""
import hashlib, json, os, re, sys
from pathlib import Path

site = Path(sys.argv[1]) if len(sys.argv) > 1 else Path('_site')
base = '/'
if os.environ.get('GITHUB_PAGES', '').lower() == 'true':
    repo = os.environ.get('GITHUB_REPOSITORY', 'Leahcim12/optyker-web').split('/')[-1]
    if not re.fullmatch(r'[A-Za-z0-9_.-]+', repo):
        raise SystemExit('Invalid GitHub Pages repository path')
    base = '/' + repo + '/'

assets = sorted(p.name for p in site.iterdir() if p.is_file() and p.suffix in {'.js','.css','.svg','.webp','.png','.jpg','.ico'})
if not assets:
    raise SystemExit('Public paths: no assembled assets found')
pattern = re.compile(r'(?P<quote>[\"\'])/(?P<asset>' + '|'.join(re.escape(a) for a in assets) + r')(?=[?\"\'])')
entry_points = [site/'index.html'] + [site/a/'index.html' for a in ('gestionale-v2','gestionale-v3')]
changed = 0
for path in entry_points + [site/a for a in assets if a.endswith(('.js','.css'))]:
    if not path.is_file():
        continue
    source = path.read_text(encoding='utf-8')
    if base != '/':
        source, count = pattern.subn(lambda m: m['quote'] + base + m['asset'], source)
        changed += count
    path.write_text(source, encoding='utf-8')

def one(text, old, new, label):
    n = text.count(old)
    if n != 1:
        raise SystemExit(f'{label}: contract inatteso ({n})')
    return text.replace(old, new, 1)

cash = site/'cash-register.js'
if cash.is_file():
    source = cash.read_text(encoding='utf-8')
    legacy = "var API='https://whgziwaegjzqsgcntesr.supabase.co/functions/v1/optyker-cash-register-api';"
    local_decl = "var LOCAL_API='https://whgziwaegjzqsgcntesr.supabase.co/functions/v1/optyker-cash-local-api';"
    if local_decl not in source:
        source = one(source, legacy, legacy+'\n'+local_decl, 'Cash local API')
    direct = "  return fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:action,username:c.username,password:c.password,payload:payload||{}})})"
    old_route = "  var endpoint=(action==='checkout'&&payload&&payload.auto_receipt===true)?LOCAL_API:API;\n  return fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:action,username:c.username,password:c.password,payload:payload||{}})})"
    route = "  var endpoint=action==='checkout'?LOCAL_API:API;\n  return fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:action,username:c.username,password:c.password,payload:payload||{}})})"
    if route not in source:
        if old_route in source: source = source.replace(old_route, route, 1)
        elif direct in source: source = source.replace(direct, route, 1)
        else: raise SystemExit('Cash channel split: fetch contract missing')

    marker = 'OPTYKER_MANUAL_POS_PRICE_20260914'
    if marker not in source:
        source, n = re.subn(r"if\(!S\.cart\[id\]\)S\.cart\[id\]=\{item:p,qty:0\};",
            "if(!S.cart[id])S.cart[id]={item:p,qty:0,unitPrice:Number(p.price||0)};", source, count=1)
        if n != 1: raise SystemExit('Manual POS price: cart init missing')

        source, n = re.subn(
            r"function removeLine\(id\)\{(?:if\(S\.busy\)return;)?delete S\.cart\[id\];renderCart\(\)\}\nfunction cartRows\(\)",
            "function removeLine(id){if(S.busy)return;delete S.cart[id];renderCart()}\nfunction setManualPrice(id,value){var row=S.cart[id];if(!row)return;var s=String(value==null?'':value).replace(',','.').trim(),n=Number(s);if(s===''||!isFinite(n)||n<0||n>1000000){toast('Inserisci un prezzo valido da 0,00 € in su.','error');renderCart();return}row.unitPrice=Math.round(n*100)/100;renderCart()}\nfunction cartRows()",
            source, count=1)
        if n != 1: raise SystemExit('Manual POS price: remove/cartRows contract missing')

        pairs = [
          ("var total=0;cartRows().forEach(function(x){total+=Number(x.item.price||0)*x.qty});return Math.round(total*100)/100",
           "var total=0;cartRows().forEach(function(x){var u=x.unitPrice==null?Number(x.item.price||0):Number(x.unitPrice||0);total+=u*x.qty});return Math.round(total*100)/100", 'cart total'),
          ("var dep=depositAmount(),validDep=S.stage!=='deposit'||(dep>0&&dep<total);",
           "var dep=depositAmount(),validDep=total===0||S.stage!=='deposit'||(dep>0&&dep<total);", 'deposit validation'),
          ("var payNow=S.payment==='pending'?0:(S.stage==='deposit'?dep:total);\n  cb.textContent=S.busy?'Operazione in corso…':rows.length?((S.invoice?'Prepara fattura':S.payment==='pending'?'Registra da pagare':'Incassa e stampa')+' · '+euro(payNow)):'Incassa e stampa';",
           "var payNow=total===0?0:(S.payment==='pending'?0:(S.stage==='deposit'?dep:total));\n  var actionLabel=total===0?'Scarica magazzino':(S.invoice?'Prepara fattura':S.payment==='pending'?'Registra da pagare':'Incassa e stampa');\n  cb.textContent=S.busy?'Operazione in corso…':rows.length?(actionLabel+' · '+euro(payNow)):'Incassa e stampa';", 'checkout label'),
          ("h+='<div class=\"optykerCashCartItem\"><div><div class=\"optykerCashCartItemTitle\">'+esc(p.title)+'</div><div class=\"optykerCashCartItemMeta\">'+esc([v,p.sku,discountLabel(p,x.qty)].filter(Boolean).join(' · '))+'</div><label class=\"optykerCashVat\">IVA <select aria-label=\"IVA articolo\" data-vat=\"'+esc(p.variant_id)+'\">'+cashVatOptions(x.department||({'04':1,'22':2,'ART10':3}[p.fiscal_vat_code||p.vat_code]))+'</select></label><div class=\"optykerCashQty\"><button type=\"button\" data-minus=\"'+esc(p.variant_id)+'\">−</button><span>'+x.qty+'</span><button type=\"button\" data-plus=\"'+esc(p.variant_id)+'\">+</button></div><button type=\"button\" class=\"optykerCashRemove\" data-remove=\"'+esc(p.variant_id)+'\">Rimuovi</button></div><div class=\"optykerCashCartItemPrice\">'+esc(euro(Number(p.price||0)*x.qty))+'</div></div>'",
           "var unit=x.unitPrice==null?Number(p.price||0):Number(x.unitPrice||0),list=Number(p.price||0),changed=Math.abs(unit-list)>0.001;h+='<div class=\"optykerCashCartItem\"><div><div class=\"optykerCashCartItemTitle\">'+esc(p.title)+'</div><div class=\"optykerCashCartItemMeta\">'+esc([v,p.sku,discountLabel(p,x.qty)].filter(Boolean).join(' · '))+'</div><label class=\"optykerCashVat\">IVA <select aria-label=\"IVA articolo\" data-vat=\"'+esc(p.variant_id)+'\">'+cashVatOptions(x.department||({'04':1,'22':2,'ART10':3}[p.fiscal_vat_code||p.vat_code]))+'</select></label><div class=\"optykerCashQty\"><button type=\"button\" data-minus=\"'+esc(p.variant_id)+'\">−</button><span>'+x.qty+'</span><button type=\"button\" data-plus=\"'+esc(p.variant_id)+'\">+</button></div><button type=\"button\" class=\"optykerCashRemove\" data-remove=\"'+esc(p.variant_id)+'\">Rimuovi</button></div><div class=\"optykerCashCartItemPrice\"><label class=\"optykerCashManualPriceLabel\">Prezzo unitario<input class=\"optykerCashManualPrice\" type=\"number\" inputmode=\"decimal\" min=\"0\" max=\"1000000\" step=\"0.01\" data-price=\"'+esc(p.variant_id)+'\" value=\"'+esc(unit.toFixed(2))+'\"></label><span class=\"optykerCashLineTotal\">Totale riga <b>'+esc(euro(unit*x.qty))+'</b></span>'+(changed?'<small class=\"optykerCashOriginalPrice\">Prezzo precedente '+esc(euro(list))+'</small>':'')+'</div></div>'", 'cart price UI'),
          ("box.querySelectorAll('[data-vat]').forEach(function(v){v.disabled=S.busy;v.onchange=function(){if(S.busy)return;S.cart[this.dataset.vat].department=Number(this.value);renderCart()}});",
           "box.querySelectorAll('[data-vat]').forEach(function(v){v.disabled=S.busy;v.onchange=function(){if(S.busy)return;S.cart[this.dataset.vat].department=Number(this.value);renderCart()}});\n  box.querySelectorAll('[data-price]').forEach(function(v){v.disabled=S.busy;v.onchange=function(){if(S.busy)return;setManualPrice(this.dataset.price,this.value)}});", 'price handler'),
          ("var rows=cartRows();if(!rows.length||S.busy)return;var total=cartTotal(),dep=depositAmount();\n  if(S.stage==='deposit'&&!(dep>0&&dep<total))",
           "var rows=cartRows();if(!rows.length||S.busy)return;var total=cartTotal(),dep=depositAmount();\n  if(total===0){S.stage='balance';dep=0;if(E('optykerCashInvoice'))E('optykerCashInvoice').checked=false;if(E('optykerCashTs'))E('optykerCashTs').checked=false;S.invoice=false;S.tsRequested=false}\n  if(S.stage==='deposit'&&!(dep>0&&dep<total))", 'zero checkout'),
          ("var autoReceipt=!inv&&S.payment!=='pending';", "var autoReceipt=!inv&&S.payment!=='pending'&&total>0;", 'RCH zero guard'),
          ("var lines=rows.map(function(x){return {variant_id:x.item.variant_id,quantity:x.qty,department:Number(x.department||({'04':1,'22':2,'ART10':3}[x.item.fiscal_vat_code||x.item.vat_code])||0)}});",
           "var lines=rows.map(function(x){return {variant_id:x.item.variant_id,quantity:x.qty,unit_price_override:Number(x.unitPrice==null?x.item.price:x.unitPrice),department:Number(x.department||({'04':1,'22':2,'ART10':3}[x.item.fiscal_vat_code||x.item.vat_code])||0)}});", 'checkout line price'),
          ("var text='Vendita registrata'+(sale.shopify_order_name?' · '+sale.shopify_order_name:'');",
           "var text=sale.stock_only?'Scarico magazzino registrato':('Vendita registrata'+(sale.shopify_order_name?' · '+sale.shopify_order_name:''));if(Number(sale.inventory_adjusted||0)>0)text+=' · magazzino aggiornato';if(sale.inventory_warning)text+=' · '+sale.inventory_warning;if(sale.invoice_warning)text+=' · '+sale.invoice_warning;", 'success message'),
          ("unitPriceCents:preflight.toCents(x.item.price)", "unitPriceCents:preflight.toCents(x.unitPrice==null?x.item.price:x.unitPrice)", 'RCH preflight price'),
        ]
        for old,new,label in pairs:
            source = one(source, old, new, 'Manual POS '+label)
        source, n = re.subn(r"window\.OPTYKER_CASH_BUILD='[^']+';", "window.OPTYKER_CASH_BUILD='20260914-stock-cf1';\n/* "+marker+" */", source, count=1)
        if n != 1: raise SystemExit('Manual POS build marker missing')
    cash.write_text(source, encoding='utf-8')
    for check in ("action==='checkout'?LOCAL_API:API", marker, 'optykerCashManualPrice', 'unit_price_override', "total===0?'Scarica magazzino'", "autoReceipt=!inv&&S.payment!=='pending'&&total>0"):
        if check not in source: raise SystemExit('Manual POS price verification failed: '+check)

cash_css = site/'cash-register.css'
if cash_css.is_file():
    css = cash_css.read_text(encoding='utf-8')
    if 'OPTYKER_MANUAL_POS_PRICE_CSS_20260914' not in css:
        css += """
/* OPTYKER_MANUAL_POS_PRICE_CSS_20260914 */
.optykerCashManualPriceLabel{display:grid;gap:5px;font-size:11px;font-weight:800;color:#647484;text-align:left;min-width:132px}
.optykerCashManualPrice{width:132px;box-sizing:border-box;border:1px solid #c9d5df;border-radius:9px;background:#fff;color:#122b3d;font:800 15px/1.1 Segoe UI,Arial,sans-serif;padding:9px 10px;text-align:right}
.optykerCashManualPrice:focus{outline:2px solid rgba(23,105,170,.18);border-color:#1769aa}
.optykerCashLineTotal{display:block;margin-top:7px;font-size:12px;color:#526778;white-space:nowrap}
.optykerCashOriginalPrice{display:block;margin-top:4px;font-size:10px;color:#8b98a3;white-space:nowrap}
@media(max-width:760px){.optykerCashManualPriceLabel,.optykerCashManualPrice{width:118px;min-width:118px}.optykerCashCartItemPrice{min-width:122px}}
"""
        cash_css.write_text(css, encoding='utf-8')

for path in entry_points:
    if not path.is_file(): continue
    html = path.read_text(encoding='utf-8')
    html = re.sub(r'(cash-register\.js\?v=)[^\"\']+', r'\g<1>20260914-stock-cf1', html)
    html = re.sub(r'(cash-register\.css\?v=)[^\"\']+', r'\g<1>20260914-stock-cf1', html)
    path.write_text(html, encoding='utf-8')

for path in entry_points:
    if not path.is_file(): continue
    html = path.read_text(encoding='utf-8')
    for name in ('optyker-aurora.css','optyker-vision.css','optyker-vision.js'):
        if '"'+base+name+'?' not in html:
            raise SystemExit('Public paths: missing correct asset URL in '+str(path)+': '+name)

release = {'design':'20260910-vision1','asset_paths':'20260910-paths2','commit':os.environ.get('VERCEL_GIT_COMMIT_SHA') or os.environ.get('GITHUB_SHA',''),'base_path':base,
           'assets':{name:hashlib.sha256((site/name).read_bytes()).hexdigest() for name in ('optyker-aurora.css','optyker-vision.css','optyker-vision.js','optyker-vision-eye.webp')}}
(site/'design-version.json').write_text(json.dumps(release,indent=2)+'\n',encoding='utf-8')
print('Public asset paths verified: '+base+'; literal asset references updated: '+str(changed))

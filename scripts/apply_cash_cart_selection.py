"""Apply after every legacy cash patch; keep checkout, totals and persistence aligned."""
from pathlib import Path
import hashlib, json, os, re, sys

ROOT=Path(__file__).resolve().parent.parent
VERSION='20260916-selection3-quote1'
MARK='OPTYKER_CART_SELECTION_20260916'

def once(s,old,new):
    if s.count(old)!=1: raise ValueError('Cart selection anchor must be unique: '+old[:100])
    return s.replace(old,new,1)

def patch(s):
    if MARK in s: return s
    s=once(s,'var rows=cartRows();if(!rows.length||S.busy)return;', 'var rows=payableCartRows();if(!rows.length||S.busy)return;')
    s=once(s,'lines:cartRows().map(function(x){return {description:', 'lines:payableCartRows().map(function(x){return {description:')
    # A deferred/unavailable item must not block quoting the selected purchase.
    s=once(s,"S.ovcPriceEpoch,cartRows().map", "S.ovcPriceEpoch,payableCartRows().map")
    s=once(s,"var lines=cartRows().map(function(x){return {variant_id:", "var lines=payableCartRows().map(function(x){return {variant_id:")
    s=once(s,'var payload={client_id:S.clientId,payment_method:S.payment,payment_stage:S.stage,', 'var payload={client_cart_selection:true,client_id:S.clientId,payment_method:S.payment,payment_stage:S.stage,')
    s=once(s,'S.busy=true;renderCart();var saleSent=false;\n  Promise.resolve().then(function(){', 'S.busy=true;renderCart();var saleSent=false;\n  return Promise.resolve().then(clientCartBeforeCheckout).then(function(){')
    s=once(s,"var sale=x.data||{};S.checkoutRequestId='';", "var sale=x.data||{};applyCheckoutCart(sale,rows);S.checkoutRequestId='';")
    s=once(s,";S.cart={};E('optykerCashNote').value='';", ";E('optykerCashNote').value='';")
    s=once(s,"S.cart={};if(E('optykerCashFiscalCode'))", "applyCheckoutCart(Object.assign({},sale,{client_cart:r.data.client_cart}),null);if(E('optykerCashFiscalCode'))")
    # Keep the visible cart synchronized when an existing deposit is settled.
    s=once(s,".then(function(x){var sale=x.data||{};var t='Saldo registrato'", ".then(function(x){var sale=x.data||{};applyCheckoutCart(sale,null);var t='Saldo registrato'")
    # Do not lose recovery if synchronization fails after the payment succeeds.
    clear="S.checkoutRequestId='';sessionStorage.removeItem('optykerCashPendingRequest');"
    s=once(s,clear,"if(!sale){"+clear+"}")
    s=once(s,'applyCheckoutCart(Object.assign({},sale,{client_cart:r.data.client_cart}),null);', 'applyCheckoutCart(Object.assign({},sale,{client_cart:r.data.client_cart}),null);'+clear)
    s=once(s,"var r=await api('checkout_status'", "clearTimeout(clientCartSaveTimer);await clientCartQueue.catch(function(){});var r=await api('checkout_status'")
    old=(ROOT/'scripts/patch_order_cart_lab_20260915.py').read_text().split("    addon=r'''",1)[1].split("'''",1)[0]
    s=once(s,old,'\n'+(ROOT/'cash-client-cart.js').read_text())
    pos=s.rfind('})();')
    if pos<0: raise ValueError('Cash closure missing')
    s=s[:pos]+'\n'+(ROOT/'cash-cart-selection.js').read_text()+'\n'+s[pos:]
    return s

def main():
    site=Path(sys.argv[1]) if len(sys.argv)>1 else ROOT/'_site'
    cash=site/'cash-register.js';cash.write_text(patch(cash.read_text()))
    css=site/'cash-register.css';text=css.read_text()
    if MARK not in text:css.write_text(text+'\n'+(ROOT/'cash-cart-selection.css').read_text())
    for page in (site/'index.html',site/'gestionale-v2/index.html',site/'gestionale-v3/index.html'):
        html=page.read_text()
        html=re.sub(r'(cash-register\.(?:js|css))(?:\?[^\s\"\'<>]*)?',lambda m:m[1]+'?v='+VERSION,html)
        page.write_text(html)
        if page.parent!=site:
            (page.parent/cash.name).write_bytes(cash.read_bytes())
            (page.parent/css.name).write_bytes(css.read_bytes())
    # The loaders can also live in standalone scripts.
    for js in site.glob('*.js'):
        if js==cash:continue
        s=js.read_text();n=re.sub(r'(cash-register\.js)(?:\?[^\s\"\'<>]*)?',lambda m:m[1]+'?v='+VERSION,s)
        if n!=s:js.write_text(n)
    (site/'cart-selection-version.json').write_text(json.dumps({'version':VERSION,'commit':os.environ.get('VERCEL_GIT_COMMIT_SHA') or os.environ.get('GITHUB_SHA',''),'sha256':hashlib.sha256(cash.read_bytes()).hexdigest()},indent=2)+'\n')
    print('Cart line selection installed:',VERSION)

if __name__=='__main__': main()

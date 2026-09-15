from pathlib import Path
import re
import shutil

ROOT=Path('_site')
VERSION='20260915-client-cart-route1'
OLD='https://whgziwaegjzqsgcntesr.supabase.co/functions/v1/optyker-cash-register-api'
V2='https://whgziwaegjzqsgcntesr.supabase.co/functions/v1/optyker-cash-register-api-v2'
MARK='OPTYKER_CLIENT_CART_ROUTE_20260915'

cash=ROOT/'cash-register.js'
s=cash.read_text(encoding='utf-8')
anchor="var API='"+OLD+"';"
if anchor not in s:
    raise SystemExit('cash-register API anchor not found')
s=s.replace(anchor,"var API='"+V2+"';/* "+MARK+" */",1)
cash.write_text(s,encoding='utf-8')

pos=ROOT/'cash-pos5.js'
p=pos.read_text(encoding='utf-8')
old="var isCash=sameUrl(input,CASH_OLD),isFiscal=sameUrl(input,FISCAL_OLD);if(!isCash&&!isFiscal)return nativeFetch(input,init);"
new="var isCash=sameUrl(input,CASH_OLD)||sameUrl(input,CASH_V2),isFiscal=sameUrl(input,FISCAL_OLD)||sameUrl(input,FISCAL_V2);if(!isCash&&!isFiscal)return nativeFetch(input,init);/* "+MARK+" */"
if old not in p:
    raise SystemExit('cash-pos5 routing anchor not found')
p=p.replace(old,new,1)
pos.write_text(p,encoding='utf-8')

# Force browsers/PWA tabs to take the corrected cash assets immediately.
for rel in ('index.html','gestionale-v2/index.html','gestionale-v3/index.html'):
    page=ROOT/rel
    html=page.read_text(encoding='utf-8')
    html=re.sub(r'([/\"]cash-register\.js)(?:\?[^\"\']*)?',lambda m:m.group(1)+'?v='+VERSION,html)
    html=re.sub(r'([/\"]cash-pos5\.js)(?:\?[^\"\']*)?',lambda m:m.group(1)+'?v='+VERSION,html)
    page.write_text(html,encoding='utf-8')

for alias in ('gestionale-v2','gestionale-v3'):
    d=ROOT/alias
    d.mkdir(parents=True,exist_ok=True)
    shutil.copyfile(cash,d/'cash-register.js')
    shutil.copyfile(pos,d/'cash-pos5.js')

# Fail closed if the special Laboratory/Busta IDs could still hit the legacy GraphQL path.
if ("var API='"+V2+"'" not in cash.read_text(encoding='utf-8')):
    raise SystemExit('cash-register still not pinned to POS v2')
if 'sameUrl(input,CASH_V2)' not in pos.read_text(encoding='utf-8'):
    raise SystemExit('POS5 does not recognize direct POS v2 requests')
print('Persistent client cart routed directly to POS v2:',VERSION)

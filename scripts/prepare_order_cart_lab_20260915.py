from pathlib import Path
import re

FILES=[Path('_site/index.html'),Path('_site/gestionale-v2/index.html'),Path('_site/gestionale-v3/index.html')]
for p in FILES:
    if not p.exists():
        continue
    s=p.read_text(encoding='utf-8')
    if 'OPTYKER_ORDER_CART_LAB_20260915' in s:
        continue
    pattern=r"function\s+statusLabel\(s\)\s*\{\s*return\s+(\{[^{}]*\}\[s\]\|\|s\|\|'Da fare')\s*;?\s*\}"
    s,n=re.subn(pattern,lambda m:"function statusLabel(s){return "+m.group(1)+"}",s,count=1,flags=re.S)
    if n!=1:
        raise SystemExit('Laboratory statusLabel normalization anchor not found in '+str(p))
    p.write_text(s,encoding='utf-8')
print('Laboratory statusLabel normalized for order/cart patch')

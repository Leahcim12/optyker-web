from pathlib import Path
import re

FILES=[Path('_site/index.html'),Path('_site/gestionale-v2/index.html'),Path('_site/gestionale-v3/index.html')]
LEGACY_HINT='Passaggio automatico a In costruzione: dopo 24 ore da lunedì a giovedì; da venerdì a domenica, lunedì alle 09:00.'
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
    # The old human-readable hint contains a semicolon. The following patch uses a
    # semicolon-delimited JS anchor, so neutralize the legacy text first; the full
    # expression is replaced immediately afterwards by patch_order_cart_lab_20260915.py.
    if LEGACY_HINT not in s:
        raise SystemExit('Legacy laboratory automation hint not found in '+str(p))
    s=s.replace(LEGACY_HINT,'Aggiornamento automatico Laboratorio legacy.',1)
    p.write_text(s,encoding='utf-8')
print('Laboratory statusLabel and legacy automation hint normalized for order/cart patch')

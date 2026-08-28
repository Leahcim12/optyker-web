from pathlib import Path
import re

p=Path('_site/index.html')
s=p.read_text(encoding='utf-8')

removed=[]
for sid in ('OPTYKER_OPERATOR_DIRECT_LOGIN_FIX_V2','OPTYKER_UI_CLICK_FIX_V1'):
    pat=re.compile(r'<script\s+id=["\']'+re.escape(sid)+r'["\'][^>]*>[\s\S]*?</script>\s*',re.I)
    s2,n=pat.subn('',s)
    if n:
        removed.append((sid,n))
        s=s2

# Questi vecchi fix non devono mai arrivare nella build pubblicata.
for sid in ('OPTYKER_OPERATOR_DIRECT_LOGIN_FIX_V2','OPTYKER_UI_CLICK_FIX_V1'):
    if sid in s:
        raise SystemExit('Fix legacy ancora presente: '+sid)

p.write_text(s,encoding='utf-8')
print('Fix login legacy rimossi:',removed)

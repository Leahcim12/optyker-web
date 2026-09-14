from pathlib import Path

p=Path('_site/index.html')
s=p.read_text(encoding='utf-8')
MARK='OPTYKER_SHIFTS_SAVE_REFRESH_20260914'
if MARK in s:
    raise SystemExit(0)
if 'OPTYKER_SHIFTS_MONTHLY_V16' not in s or "var API='optyker_staff_schedule_api'" not in s:
    raise SystemExit('Modulo Turni mensili non trovato')

replacements={
"api('day_save',p).then(function(){clearCached(S.month);closeEdit();return load(true)})":
"api('day_save',p).then(function(){clearCached(S.month);S.busy=false;closeEdit();return load(true)})",
"api('day_clear',{date:S.editing.date,operator_username:S.editing.op}).then(function(){clearCached(S.month);closeEdit();return load(true)})":
"api('day_clear',{date:S.editing.date,operator_username:S.editing.op}).then(function(){clearCached(S.month);S.busy=false;closeEdit();return load(true)})",
"api('store_day_save',p).then(function(){clearCached(S.month);closeStoreEdit();return load(true)})":
"api('store_day_save',p).then(function(){clearCached(S.month);S.busy=false;closeStoreEdit();return load(true)})",
"api('store_day_clear',{date:S.storeEditing.date}).then(function(){clearCached(S.month);closeStoreEdit();return load(true)})":
"api('store_day_clear',{date:S.storeEditing.date}).then(function(){clearCached(S.month);S.busy=false;closeStoreEdit();return load(true)})",
}
for old,new in replacements.items():
    n=s.count(old)
    if n!=1:
        raise SystemExit(f'Pattern refresh Turni inatteso ({n}): {old[:65]}')
    s=s.replace(old,new,1)

marker=f'<script id="optykerShiftsSaveRefresh20260914">/* {MARK} */</script>'
i=s.lower().rfind('</body>')
if i<0:
    raise SystemExit('body non trovato')
s=s[:i]+marker+'\n'+s[i:]
p.write_text(s,encoding='utf-8')

for alias in ('gestionale-v2','gestionale-v3'):
    q=Path('_site')/alias/'index.html'
    if q.exists():
        q.write_text(s,encoding='utf-8')

checks=[MARK,
"clearCached(S.month);S.busy=false;closeEdit();return load(true)",
"clearCached(S.month);S.busy=false;closeStoreEdit();return load(true)"]
for x in checks:
    if x not in s:
        raise SystemExit('Fix Turni incompleto: '+x)
print('Turni e orari: refresh post-salvataggio corretto')

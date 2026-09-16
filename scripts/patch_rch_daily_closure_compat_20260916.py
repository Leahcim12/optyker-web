from pathlib import Path

p=Path('_site/rch-cloud-relay.js')
s=p.read_text(encoding='utf-8')
old="function manualRegWorkerReady(d){return String(d&&d.connector_version||'')===MANUAL_REG_WORKER}"
new="function manualRegWorkerReady(d){return /^(?:2\\.1-manual-reg|2\\.2-daily-closure)$/.test(String(d&&d.connector_version||''))}"
if old in s:
    s=s.replace(old,new,1)
elif new not in s:
    raise SystemExit('manualRegWorkerReady anchor not found')
p.write_text(s,encoding='utf-8')
for alias in ('gestionale-v2','gestionale-v3'):
    q=Path('_site')/alias/'rch-cloud-relay.js'
    if q.exists(): q.write_text(s,encoding='utf-8')
if '2\\.2-daily-closure' not in s:
    raise SystemExit('daily closure worker compatibility missing')
print('RCH daily closure worker compatibility applied')

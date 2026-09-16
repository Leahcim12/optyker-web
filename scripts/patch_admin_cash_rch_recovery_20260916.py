from pathlib import Path

ROOT = Path('_site')
SRC = Path('admin-cash-rch-recovery.js')
TAG = '<script id="optykerAdminCashRchRecoveryJs" defer src="admin-cash-rch-recovery.js?v=20260916-rchrecovery1"></script>'
OLD_MARK = 'optykerAdminCashRchRecoveryJs'

if not SRC.exists():
    raise SystemExit('admin-cash-rch-recovery.js missing')

for rel in ('index.html','gestionale-v2/index.html','gestionale-v3/index.html'):
    p = ROOT / rel
    text = p.read_text(encoding='utf-8')
    # Remove any older tagged loader while preserving unrelated scripts.
    import re
    text = re.sub(r'<script[^>]+id=["\']optykerAdminCashRchRecoveryJs["\'][^>]*></script>\s*', '', text, flags=re.I)
    i = text.lower().rfind('</body>')
    if i < 0:
        raise SystemExit('Closing body not found in ' + rel)
    text = text[:i] + TAG + '\n' + text[i:]
    p.write_text(text, encoding='utf-8')

(ROOT / 'admin-cash-rch-recovery.js').write_bytes(SRC.read_bytes())
for alias in ('gestionale-v2','gestionale-v3'):
    q = ROOT / alias / 'admin-cash-rch-recovery.js'
    q.parent.mkdir(parents=True, exist_ok=True)
    q.write_bytes(SRC.read_bytes())

print('Admin cash RCH recovery published')

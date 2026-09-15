from pathlib import Path
import re

ROOT = Path('_site')
HTMLS = [ROOT/'index.html', ROOT/'gestionale-v2/index.html', ROOT/'gestionale-v3/index.html']
VERSION = '20260915-relay5'
TAG = f'<script id="optykerRchCloudRelayJs" defer src="/rch-cloud-relay.js?v={VERSION}"></script>'

# POS5 patches fetch/fiscal behaviour. The cloud relay must execute afterwards so
# checkReady()/issuePayment() see the final POS5 fiscal object and can route it to
# the Windows cashier PC when localhost is unavailable.
for path in HTMLS:
    if not path.exists():
        raise SystemExit(f'Manca {path}')
    text = path.read_text(encoding='utf-8')

    # Remove every older relay loader regardless of id/version/location.
    text = re.sub(
        r'<script\b[^>]*src=["\'][^"\']*rch-cloud-relay\.js(?:\?[^"\']*)?["\'][^>]*>\s*</script>\s*',
        '',
        text,
        flags=re.I,
    )

    pos5 = re.search(r'<script\b[^>]*id=["\']optykerCashPos5Js["\'][^>]*>\s*</script>', text, re.I)
    if not pos5:
        raise SystemExit(f'Loader POS5 non trovato in {path}')

    text = text[:pos5.end()] + '\n' + TAG + text[pos5.end():]
    path.write_text(text, encoding='utf-8')

main = (ROOT/'index.html').read_text(encoding='utf-8')
if main.count('id="optykerRchCloudRelayJs"') != 1:
    raise SystemExit('Loader Cloud Relay RCH non univoco')
if main.count('rch-cloud-relay.js?v='+VERSION) != 1:
    raise SystemExit('Versione Cloud Relay RCH non applicata')
pos5_at = main.find('id="optykerCashPos5Js"')
relay_at = main.find('id="optykerRchCloudRelayJs"')
if pos5_at < 0 or relay_at <= pos5_at:
    raise SystemExit('Il Cloud Relay RCH deve essere caricato dopo POS5')

relay = ROOT/'rch-cloud-relay.js'
if not relay.exists():
    raise SystemExit('Asset rch-cloud-relay.js non trovato')
code = relay.read_text(encoding='utf-8')
for required in [
    'function cloudReady()',
    "String(s.idleState)!=='0'",
    "['busy','errorCode','printerError','paperEnd','coverOpen']",
    'function wrapFiscal()',
    '__cloudRelay:true',
]:
    if required not in code:
        raise SystemExit('Controllo sicurezza Cloud Relay mancante: '+required)

if (ROOT/'gestionale-v2/index.html').read_bytes() != (ROOT/'index.html').read_bytes() or (ROOT/'gestionale-v3/index.html').read_bytes() != (ROOT/'index.html').read_bytes():
    raise SystemExit('Le tre pagine desktop non coincidono dopo il riordino RCH')

print('RCH Cloud Relay caricato dopo POS5; controlli REG/idle/errori preservati')

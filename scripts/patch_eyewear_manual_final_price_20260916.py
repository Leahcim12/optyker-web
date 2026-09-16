from pathlib import Path

ROOT=Path('_site')
MARK='OPTYKER_EYEWEAR_MANUAL_FINAL_PRICE_V14'
addon=Path('eyewear-manual-final-price-v14.js').read_text(encoding='utf-8')

page=ROOT/'index.html'
h=page.read_text(encoding='utf-8')

# Add the manual-final-price UI inside the native Eyewear V9 closure so it can
# reuse pricing(), payload(), api() and renderSummary() without duplicating the flow.
# The addon itself restores a persisted manual value by matching the opened
# Busta/Preventivo reference against OPTYKER_CLOUD.sheets.
if MARK not in h:
    start=h.find('<script id="optykerEyewearFlowV9Inline">')
    if start < 0: raise SystemExit('Runtime Occhiali V9 non trovato')
    end=h.find('</script>',start)
    if end < 0: raise SystemExit('Chiusura runtime Occhiali non trovata')
    body_start=h.find('>',start)+1
    body=h[body_start:end]
    pos=body.rfind('\n})();')
    if pos < 0: raise SystemExit('Chiusura IIFE Occhiali non trovata')
    body=body[:pos]+'\n'+addon+'\n'+body[pos:]
    h=h[:body_start]+body+h[end:]

page.write_text(h,encoding='utf-8')
for alias in ('gestionale-v2','gestionale-v3'):
    (ROOT/alias/'index.html').write_text(h,encoding='utf-8')

for needle in (MARK,'20260916-finalprice2','eyManualFinalPrice','manual_final_price','optyker-eyewear-final-price','restoreManualFinalCurrent'):
    if needle not in h: raise SystemExit('Prezzo finale Occhiali incompleto: '+needle)
print('Prezzo finale manuale Occhiali installato e auto-ripristinabile')

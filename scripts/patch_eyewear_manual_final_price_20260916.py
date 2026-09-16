from pathlib import Path

ROOT=Path('_site')
MARK='OPTYKER_EYEWEAR_MANUAL_FINAL_PRICE_V14'
RESTORE_MARK='__OPTYKER_EYEWEAR_MANUAL_FINAL_RESTORE__'
addon=Path('eyewear-manual-final-price-v14.js').read_text(encoding='utf-8')

page=ROOT/'index.html'
h=page.read_text(encoding='utf-8')

# Add the manual-final-price UI inside the native Eyewear V9 closure so it can
# reuse pricing(), payload(), api() and renderSummary() without duplicating the flow.
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

# Existing Busta/Preventivo: client-sheet-edit is inline in the assembled HTML.
# Restore a previously saved manual final price after opening the document.
if RESTORE_MARK not in h:
    old="setVal('eyNotes',d.notes,'input');setVal('eyReference',text(row.reference_code||row.reference_no),'input');"
    new="""setVal('eyNotes',d.notes,'input');/* __OPTYKER_EYEWEAR_MANUAL_FINAL_RESTORE__ */(function restoreManualFinalPrice(){var tries=0,pr=d.pricing||{},raw=pr.manual_final_price!=null?pr.manual_final_price:d.manual_final_price;if(raw==null||raw==='')return;var timer=setInterval(function(){var m=document.getElementById('eyManualFinalPrice');if(m){clearInterval(timer);var n=Number(raw);if(isFinite(n)){m.value=n.toFixed(2);m.dataset.manual='1';m.dataset.persisted='1';m.dataset.clear='0';m.dispatchEvent(new Event('input',{bubbles:true}))}}else if(++tries>20)clearInterval(timer)},60)})();setVal('eyReference',text(row.reference_code||row.reference_no),'input');"""
    if old not in h: raise SystemExit('Anchor ripristino prezzo Occhiali non trovato')
    h=h.replace(old,new,1)

page.write_text(h,encoding='utf-8')
for alias in ('gestionale-v2','gestionale-v3'):
    (ROOT/alias/'index.html').write_text(h,encoding='utf-8')

for needle in (MARK,'eyManualFinalPrice','manual_final_price','optyker-eyewear-final-price',RESTORE_MARK):
    if needle not in h: raise SystemExit('Prezzo finale Occhiali incompleto: '+needle)
print('Prezzo finale manuale Occhiali installato e ripristinabile')

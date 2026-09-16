from pathlib import Path

ROOT=Path('_site')
MARK='OPTYKER_EYEWEAR_MANUAL_FINAL_PRICE_V14'
addon=Path('eyewear-manual-final-price-v14.js').read_text(encoding='utf-8')

page=ROOT/'index.html'
h=page.read_text(encoding='utf-8')
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

# Existing Busta/Preventivo: restore the persisted manual final price into the editor.
js=ROOT/'client-sheet-edit.js'
s=js.read_text(encoding='utf-8')
RESTORE_MARK='__OPTYKER_EYEWEAR_MANUAL_FINAL_RESTORE__'
if RESTORE_MARK not in s:
    old="setVal('eyNotes',d.notes,'input');setVal('eyReference',text(row.reference_code||row.reference_no),'input');"
    new="""setVal('eyNotes',d.notes,'input');/* __OPTYKER_EYEWEAR_MANUAL_FINAL_RESTORE__ */(function restoreManualFinalPrice(){var tries=0,pr=d.pricing||{},raw=pr.manual_final_price!=null?pr.manual_final_price:d.manual_final_price;if(raw==null||raw==='')return;var timer=setInterval(function(){var m=E('eyManualFinalPrice');if(m){clearInterval(timer);var n=Number(raw);if(isFinite(n)){m.value=n.toFixed(2);m.dataset.manual='1';m.dataset.persisted='1';m.dataset.clear='0';fire(m,'input')}}else if(++tries>20)clearInterval(timer)},60)})();setVal('eyReference',text(row.reference_code||row.reference_no),'input');"""
    if old not in s: raise SystemExit('Anchor ripristino prezzo Occhiali non trovato')
    s=s.replace(old,new,1)
js.write_text(s,encoding='utf-8')

for alias in ('gestionale-v2','gestionale-v3'):
    (ROOT/alias/'index.html').write_text(h,encoding='utf-8')
    target=ROOT/alias/'client-sheet-edit.js'
    if target.exists(): target.write_text(s,encoding='utf-8')

for needle in (MARK,'eyManualFinalPrice','manual_final_price','optyker-eyewear-final-price'):
    if needle not in h: raise SystemExit('Prezzo finale Occhiali incompleto: '+needle)
if RESTORE_MARK not in s: raise SystemExit('Ripristino prezzo finale Occhiali mancante')
print('Prezzo finale manuale Occhiali installato')

from pathlib import Path

page=Path('_site/index.html')
if not page.exists():
    raise SystemExit('_site/index.html non trovato')
s=page.read_text(encoding='utf-8')
MARK='OPTYKER_EYEWEAR_DISCOUNTS_V10'
if MARK in s:
    raise SystemExit(0)
addon_path=Path('eyewear-discounts-v10.js')
if not addon_path.exists():
    raise SystemExit('eyewear-discounts-v10.js mancante')
addon=addon_path.read_text(encoding='utf-8')
start=s.find('<script id="optykerEyewearFlowV9Inline">')
if start<0:
    raise SystemExit('Runtime V9 non trovato')
end=s.find('</script>',start)
if end<0:
    raise SystemExit('Chiusura runtime V9 non trovata')
body_start=s.find('>',start)+1
body=s[body_start:end]
needle='\n})();'
pos=body.rfind(needle)
if pos<0:
    raise SystemExit('Chiusura IIFE V9 non trovata')
body=body[:pos]+'\n'+addon+'\n'+body[pos:]
s=s[:body_start]+body+s[end:]
page.write_text(s,encoding='utf-8')
required=[MARK,'20260906-eyewear-discounts-v10','STUDENTIBLU','OCCHIALI15','MONTATURA30','LENTI15','VICINOHARD','VICINOHMC','optyker-eyewear-api-v5']
for x in required:
    if x not in s:
        raise SystemExit('Runtime sconti incompleto: '+x)
print('Optyker eyewear discounts V10 OK')

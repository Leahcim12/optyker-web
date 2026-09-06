from pathlib import Path

page=Path('_site/index.html')
if not page.exists():
    raise SystemExit('_site/index.html non trovato')
s=page.read_text(encoding='utf-8')
MARK='OPTYKER_EYEWEAR_FLOW_V12'
if MARK in s:
    raise SystemExit(0)
addon_path=Path('eyewear-flow-v12.js')
if not addon_path.exists():
    raise SystemExit('eyewear-flow-v12.js mancante')
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
required=[MARK,'20260907-eyewear-flow-v12-stable1','Sportive','€ 25 a lente','solo monofocali','optyker-eyewear-api-v6']
for x in required:
    if x not in s:
        raise SystemExit('Runtime occhiali V12 incompleto: '+x)
print('Optyker eyewear flow V12 stable OK')

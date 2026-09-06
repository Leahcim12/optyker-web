from pathlib import Path

page=Path('_site/index.html')
if not page.exists():
    raise SystemExit('_site/index.html non trovato')
s=page.read_text(encoding='utf-8')
MARK='OPTYKER_EYEWEAR_RUNTIME_V9'
if MARK in s:
    raise SystemExit(0)
js=Path('eyewear-flow-v9.js')
if not js.exists():
    raise SystemExit('eyewear-flow-v9.js mancante')
code=js.read_text(encoding='utf-8')
block='\n<!-- '+MARK+' -->\n<script id="optykerEyewearFlowV9Inline">\n'+code+'\n</script>\n'
pos=s.lower().rfind('</body>')
if pos<0:
    raise SystemExit('Tag </body> non trovato')
s=s[:pos]+block+s[pos:]
page.write_text(s,encoding='utf-8')
for x in [MARK,'20260906-eyewear-flow9','SCELTA DELLA LENTE DX','SCELTA DELLA LENTE SX','Del cliente','€ 10 a lente','€ 15 a lente','€ 25 a lente','€ 20 a lente','Montaggio tradizionale','Montaggio speciale']:
    if x not in s:
        raise SystemExit('Runtime occhiali V9 incompleto: '+x)
if 'Idrofobico / oleofobico' not in s or 'Antigraffio' not in s:
    # Le vecchie etichette possono esistere nel sorgente base: V9 le rimuove a runtime.
    pass
print('Optyker eyewear runtime V9 OK')

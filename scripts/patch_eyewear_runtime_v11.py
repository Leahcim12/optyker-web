from pathlib import Path

page=Path('_site/index.html')
if not page.exists():
    raise SystemExit('_site/index.html non trovato')
s=page.read_text(encoding='utf-8')
MARK='OPTYKER_EYEWEAR_RUNTIME_V11'
if MARK in s:
    raise SystemExit(0)
js=Path('eyewear-ui-fix-v11.js')
if not js.exists():
    raise SystemExit('eyewear-ui-fix-v11.js mancante')
code=js.read_text(encoding='utf-8')
block='\n<!-- '+MARK+' -->\n<script id="optykerEyewearUiFixV11Inline">\n'+code+'\n</script>\n'
pos=s.lower().rfind('</body>')
if pos<0:
    raise SystemExit('Tag </body> non trovato')
s=s[:pos]+block+s[pos:]
page.write_text(s,encoding='utf-8')
for x in [MARK,'20260906-eyewear-ui-fix-v11','Indice lente','separatamente dal Tipo lente','Base · inclusa']:
    if x not in s:
        raise SystemExit('Runtime occhiali V11 incompleto: '+x)
print('Optyker eyewear runtime V11 OK')

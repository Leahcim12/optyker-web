from pathlib import Path

page=Path('_site/index.html')
if not page.exists():
    raise SystemExit('_site/index.html non trovato')
s=page.read_text(encoding='utf-8')
MARK='OPTYKER_EYEWEAR_SUMMARY_STABILITY_V13'
if MARK in s:
    raise SystemExit(0)
js=Path('eyewear-summary-stability-v13.js')
if not js.exists():
    raise SystemExit('eyewear-summary-stability-v13.js mancante')
code=js.read_text(encoding='utf-8')
block='\n<!-- '+MARK+' -->\n<script id="optykerEyewearSummaryStabilityV13Inline">\n'+code+'\n</script>\n'
pos=s.lower().rfind('</body>')
if pos<0:
    raise SystemExit('Tag </body> non trovato')
s=s[:pos]+block+s[pos:]
page.write_text(s,encoding='utf-8')
for x in [MARK,'20260907-eyewear-summary-v13','Lente DX','Lente SX']:
    if x not in s:
        raise SystemExit('Fix riepilogo V13 incompleto: '+x)
print('Optyker eyewear summary stability V13 OK')

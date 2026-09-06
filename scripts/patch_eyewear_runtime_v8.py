from pathlib import Path

page=Path('_site/index.html')
if not page.exists():
    raise SystemExit('_site/index.html non trovato')

s=page.read_text(encoding='utf-8')
MARK='OPTYKER_EYEWEAR_RUNTIME_V8'
if MARK in s:
    raise SystemExit(0)

parts=[]
for fn, sid in [
    ('eyewear-rules-addon.js','optykerEyewearRulesAddonInline'),
    ('eyewear-catalog-types-addon.js','optykerEyewearCatalogTypesInline'),
    ('eyewear-extra-treatments-addon.js','optykerEyewearFlowV7Inline'),
    ('eyewear-flow-v8-fix.js','optykerEyewearFlowV8FixInline'),
]:
    p=Path(fn)
    if not p.exists():
        raise SystemExit(f'File mancante: {fn}')
    code=p.read_text(encoding='utf-8')
    parts.append(f'\n<script id="{sid}">\n{code}\n</script>\n')

block='\n<!-- '+MARK+' -->\n'+''.join(parts)
pos=s.lower().rfind('</body>')
if pos<0:
    raise SystemExit('Tag </body> non trovato')
s=s[:pos]+block+s[pos:]
page.write_text(s,encoding='utf-8')

required=[
    MARK,
    '20260906-eyewear-flow8-fix1',
    'Es. Michael Optyker',
    'Tipo lente DX',
    'Tipo lente SX',
    '€ 20 a lente',
    '€ 40 a lente',
    'Garanzia',
    'Del cliente',
]
for x in required:
    if x not in s:
        raise SystemExit('Runtime occhiali incompleto: '+x)
print('Optyker eyewear runtime V8 OK')

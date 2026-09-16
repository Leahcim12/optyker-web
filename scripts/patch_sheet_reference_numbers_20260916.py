from pathlib import Path

ROOT=Path('_site')
SRC=Path('sheet-reference-numbers.js')
if not SRC.exists():
    raise SystemExit('sheet-reference-numbers.js mancante')
js=SRC.read_text(encoding='utf-8')
if 'OPTYKER_SHEET_REFERENCE_NUMBERS_20260916' not in js:
    raise SystemExit('Marker numeri schede mancante')

for rel in ('index.html','gestionale-v2/index.html','gestionale-v3/index.html'):
    page=ROOT/rel
    if not page.exists():
        raise SystemExit(f'{rel} non trovato')
    text=page.read_text(encoding='utf-8')
    tag='<script id="optykerSheetReferenceNumbersJs" src="/sheet-reference-numbers.js?v=20260916-sheetrefs1"></script>'
    if tag not in text:
        i=text.lower().rfind('</body>')
        if i<0:
            raise SystemExit(f'Chiusura body non trovata in {rel}')
        text=text[:i]+tag+'\n'+text[i:]
        page.write_text(text,encoding='utf-8')
    target=page.parent/'sheet-reference-numbers.js'
    target.write_text(js,encoding='utf-8')

for rel in ('index.html','gestionale-v2/index.html','gestionale-v3/index.html'):
    text=(ROOT/rel).read_text(encoding='utf-8')
    if 'optykerSheetReferenceNumbersJs' not in text:
        raise SystemExit(f'Loader numeri schede mancante in {rel}')
print('Numeri schede LAC e Occhiali installati')

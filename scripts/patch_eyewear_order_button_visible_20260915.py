from pathlib import Path

ROOT = Path('_site')
HTMLS = [ROOT/'index.html', ROOT/'gestionale-v2/index.html', ROOT/'gestionale-v3/index.html']
MARK = 'OPTYKER_EYEWEAR_ORDER_BUTTON_VISIBLE_20260915'

needle = '<div class=\\"eyFinalActions\\"><button id=\\"eySave\\" class=\\"eyBtn primary\\" type=\\"button\\">Salva Preventivo</button>'
with_button = needle + '<button id=\\"eyOrderProduct\\" class=\\"eyBtn primary\\" type=\\"button\\">Ordina lenti</button>'

for path in HTMLS:
    if not path.exists():
        raise SystemExit(f'Manca {path}')
    s = path.read_text(encoding='utf-8')
    if MARK not in s:
        if 'id=\\"eyOrderProduct\\"' not in s:
            if s.count(needle) != 1:
                raise SystemExit(f'Comandi finali Occhiali non trovati in {path}')
            s = s.replace(needle, with_button, 1)
        pos = s.lower().rfind('</body>')
        if pos < 0:
            raise SystemExit(f'Chiusura body non trovata in {path}')
        s = s[:pos] + '<!-- '+MARK+' -->\n' + s[pos:]
        path.write_text(s, encoding='utf-8')

    check = path.read_text(encoding='utf-8')
    if check.count('id=\\"eyOrderProduct\\"') != 1:
        raise SystemExit(f'Pulsante Ordina lenti non univoco in {path}')
    if 'id=\\"eyOrderProduct\\" class=\\"eyBtn primary\\"' not in check:
        raise SystemExit(f'Pulsante Ordina lenti non visibile/stilizzato in {path}')

ops = ROOT/'optyker-operations.js'
s = ops.read_text(encoding='utf-8')
# The final order/cart patch already makes the button available to both document modes.
# Make an already-present static button receive the same action and styling as a dynamically-created one.
anchor = "b.hidden=false;b.disabled=orderBusy;"
replacement = "b.className='eyBtn primary';b.onclick=()=>sendOrder();b.hidden=false;b.disabled=orderBusy;"
if replacement not in s:
    if s.count(anchor) != 1:
        raise SystemExit('Gestore visibilità Ordina lenti non trovato')
    s = s.replace(anchor, replacement, 1)

# Do not let an authentication timing race prevent the button from being wired.
tick_old = "function tick(){if(!logged()){"
tick_new = "function tick(){ensureOrderButton();if(!logged()){"
if tick_new not in s:
    if s.count(tick_old) != 1:
        raise SystemExit('Tick operazioni Occhiali non trovato')
    s = s.replace(tick_old, tick_new, 1)

ops.write_text(s, encoding='utf-8')
check = ops.read_text(encoding='utf-8')
for required in ["b.onclick=()=>sendOrder()", "b.className='eyBtn primary'", "function tick(){ensureOrderButton();if(!logged()){"]:
    if required not in check:
        raise SystemExit('Ordina lenti non collegato: '+required)

if (ROOT/'gestionale-v2/index.html').read_bytes() != (ROOT/'index.html').read_bytes() or (ROOT/'gestionale-v3/index.html').read_bytes() != (ROOT/'index.html').read_bytes():
    raise SystemExit('Le tre pagine desktop non coincidono dopo il pulsante Ordina lenti')

print('Busta/Preventivo Occhiali: Ordina lenti è visibile nei comandi finali e collegato al Laboratorio')

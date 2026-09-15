from pathlib import Path
import re

ROOT = Path('_site')
HTMLS = [ROOT/'index.html', ROOT/'gestionale-v2/index.html', ROOT/'gestionale-v3/index.html']
MARK = 'OPTYKER_EYEWEAR_ORDER_BUTTON_VISIBLE_20260915'
BUTTON = '<button id=\\"eyOrderProduct\\" class=\\"eyBtn primary\\" type=\\"button\\">Ordina lenti</button>'
SAVE_RE = re.compile(r'<button id=\\"eySave\\"[^>]*>.*?</button>')

for path in HTMLS:
    if not path.exists():
        raise SystemExit(f'Manca {path}')
    s = path.read_text(encoding='utf-8')
    if MARK not in s:
        if 'id=\\"eyOrderProduct\\"' not in s:
            matches = list(SAVE_RE.finditer(s))
            if len(matches) != 1:
                raise SystemExit(f'Comando eySave non univoco in {path}: {len(matches)}')
            m = matches[0]
            s = s[:m.end()] + BUTTON + s[m.end():]
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
    save_pos = check.find('id=\\"eySave\\"')
    order_pos = check.find('id=\\"eyOrderProduct\\"')
    if save_pos < 0 or order_pos < 0 or order_pos < save_pos or order_pos-save_pos > 500:
        raise SystemExit(f'Ordina lenti non è accanto a Salva in {path}')

ops = ROOT/'optyker-operations.js'
s = ops.read_text(encoding='utf-8')
# The final order/cart patch makes this control usable for the eyewear document flow.
# A static button must receive the same handler as a dynamically-created one.
anchor = "b.hidden=false;b.disabled=orderBusy;"
replacement = "b.className='eyBtn primary';b.onclick=()=>sendOrder();b.hidden=false;b.disabled=orderBusy;"
if replacement not in s:
    if s.count(anchor) != 1:
        raise SystemExit('Gestore visibilità Ordina lenti non trovato')
    s = s.replace(anchor, replacement, 1)

# Wire the control even if the authentication flag settles after the panel is rendered.
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

print('Occhiali: Ordina lenti è accanto a Salva nei comandi finali ed è collegato al Laboratorio')

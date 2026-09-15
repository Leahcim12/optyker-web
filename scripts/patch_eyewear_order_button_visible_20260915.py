from pathlib import Path
import hashlib
import json
import os
import re

ROOT = Path('_site')
ops = ROOT/'optyker-operations.js'
if not ops.exists():
    raise SystemExit('optyker-operations.js non trovato')

s = ops.read_text(encoding='utf-8')
MARK = 'OPTYKER_EYEWEAR_ORDER_BUTTON_VISIBLE_20260915'

# The order/cart patch already makes the eyewear order action valid for the
# current Occhiali document. Here we only make its UI deterministic: the
# runtime creates/wires the button whenever the final actions exist, even if
# operator authentication finishes after the eyewear panel has rendered.
if MARK not in s:
    # The simple-order patch has already changed this from b.hidden=!job.
    anchor = "b.hidden=false;b.disabled=orderBusy;"
    replacement = "b.className='eyBtn primary';b.onclick=()=>sendOrder();b.hidden=false;b.disabled=orderBusy;"
    if replacement not in s:
        if s.count(anchor) != 1:
            raise SystemExit('Gestore visibilità Ordina lenti non trovato')
        s = s.replace(anchor, replacement, 1)

    # Run ensureOrderButton before the login early-return. This is safe: it
    # only creates/wires a DOM button; sendOrder still performs its normal
    # authenticated API operations when the user actually presses it.
    tick_old = "function tick(){if(!logged()){"
    tick_new = "function tick(){ensureOrderButton();if(!logged()){"
    if tick_new not in s:
        if s.count(tick_old) != 1:
            raise SystemExit('Tick operazioni Occhiali non trovato')
        s = s.replace(tick_old, tick_new, 1)

    # Also make the initial boot attempt create the button immediately when
    # the final panel already exists, instead of waiting for the interval.
    boot_old = "function boot(){tick();installEyewearWrap();window.addEventListener('optyker:client-selected',()=>setTimeout(tick,20));}"
    boot_new = "function boot(){ensureOrderButton();tick();installEyewearWrap();window.addEventListener('optyker:client-selected',()=>setTimeout(tick,20));}"
    if boot_new not in s and boot_old in s:
        s = s.replace(boot_old, boot_new, 1)

    close = s.rfind('})();')
    if close < 0:
        raise SystemExit('Chiusura runtime operazioni non trovata')
    s = s[:close] + "window.OPTYKER_EYEWEAR_ORDER_BUTTON_VISIBLE='20260915-order-button2';/* "+MARK+" */\n" + s[close:]

s = s.replace("b.textContent=orderBusy?'Ordino…':'Ordina lenti'", "b.textContent=orderBusy?'Invio in corso…':($('eyModeJob')?.classList.contains('active')?'Invia ordine':'Ordina lenti')")
s = s.replace("b.textContent='Ordina lenti';b.onclick=()=>sendOrder(r)", "b.textContent=r.sheet_type==='eyewear_job'?'Invia ordine':'Ordina lenti';b.onclick=()=>sendOrder(r)")

ops.write_text(s, encoding='utf-8')
check = ops.read_text(encoding='utf-8')
required = [
    MARK,
    "function ensureOrderButton()",
    "eyOrderProduct",
    "eySave",
    "eyFinalActions",
    "b.className='eyBtn primary'",
    "b.onclick=()=>sendOrder()",
    "b.hidden=false;b.disabled=orderBusy",
    "function tick(){ensureOrderButton();if(!logged()){",
    "b.textContent=orderBusy?'Invio in corso…':",
    "?'Invia ordine':'Ordina lenti'",
]
for needle in required:
    if needle not in check:
        raise SystemExit('Ordina lenti non stabilizzato: '+needle)

# Do not reintroduce the old Busta-only visibility rule.
if "b.hidden=!job" in check:
    raise SystemExit('Ordina lenti risulta ancora nascosto dalla modalità documento')

asset_base = '/'
if os.environ.get('GITHUB_PAGES', '').lower() == 'true':
    repo = os.environ.get('GITHUB_REPOSITORY', 'Leahcim12/optyker-web').split('/')[-1]
    if not re.fullmatch(r'[A-Za-z0-9_.-]+', repo):
        raise SystemExit('Invalid GitHub Pages repository path')
    asset_base += repo+'/'
for rel in ('index.html', 'gestionale-v2/index.html', 'gestionale-v3/index.html'):
    page = ROOT/rel
    html = page.read_text(encoding='utf-8')
    html, count = re.subn(r'src="[^"<>]*\boptyker-operations\.js(?:\?[^"<>]*)?"', 'src="'+asset_base+'optyker-operations.js?v=20260915-eyewear-send-order"', html)
    if count != 1:
        raise SystemExit('Loader operazioni mancante o duplicato: '+rel)
    page.write_text(html, encoding='utf-8')
manifest = ROOT/'operations-version.json'
if manifest.exists():
    data = json.loads(manifest.read_text())
    data['assets']['optyker-operations.js'] = hashlib.sha256(ops.read_bytes()).hexdigest()
    manifest.write_text(json.dumps(data, indent=2)+'\n')

print('Occhiali: Ordina lenti viene creato e collegato stabilmente nei comandi finali')

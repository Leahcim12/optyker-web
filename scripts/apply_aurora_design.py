"""Apply the screen-only Optyker Aurora skin to the assembled production build.

No application JavaScript, handlers, database requests or print styles are changed.
Fails closed if the expected desktop template is missing. Safe to run twice.
"""
from pathlib import Path
import re
import shutil
import sys

VERSION = '20260909-aurora1'
ROOT = Path(sys.argv[1]) if len(sys.argv) > 1 else Path('_site')
REPO = Path(__file__).resolve().parent.parent
page = ROOT / 'index.html'
html = page.read_text(encoding='utf-8')
script_pattern = r'(?is)<script\b[^>]*>.*?</script>'
original_scripts = re.findall(script_pattern, html)
control_pattern = r'(?is)<(?:input|select|textarea)\b[^>]*>'
original_controls = re.findall(control_pattern, html)
for marker in ('id="mainApp"', 'id="moduleNav"', 'id="dashboardPanel"', 'id="optykerLoginScreen"', '</head>'):
    if marker not in html:
        raise SystemExit('Aurora: expected desktop marker missing: ' + marker)

# This skin is intentionally opt-in to the management application only.
html = re.sub(r'(<html\b[^>]*)(>)', lambda m: re.sub(r'\sdata-optyker-design="[^"]*"', '', m[1]) + ' data-optyker-design="aurora"' + m[2], html, count=1)
html = re.sub(r'<link\b[^>]*id="optykerAuroraCss"[^>]*>\s*', '', html)
link = '<link id="optykerAuroraCss" rel="stylesheet" media="screen" href="/optyker-aurora.css?v=' + VERSION + '">\n'
html = html.replace('</head>', link + '</head>', 1)

# Plain-text presentation changes in the existing dashboard, never in scripts.
replacements = {
    '<div class="sub">Programma di inserimento ed elaborazione dati della Mologni Company S.R.L.</div>': '<div class="sub">Ottica Visual Care · Gestionale</div>',
    '<div class="dashboardEyebrow">Dashboard iniziale</div>': '<div class="dashboardEyebrow">OTTICA VISUAL CARE · CENTRO OPERATIVO</div>',
    '<div class="dashboardTitle">Come vuoi iniziare?</div>': '<div class="dashboardTitle">La tua visione, sotto controllo.</div>',
    '<div class="dashboardSubtitle">Cerca un cliente già presente, creane uno nuovo oppure compila direttamente una scheda senza collegarla a nessun cliente.</div>': '<div class="dashboardSubtitle">Clienti, appuntamenti e dispositivi. Tutto il tuo lavoro, in un unico spazio.</div>',
}
for old, new in replacements.items():
    html = html.replace(old, new, 1)
intro = '''<div class="optykerAuroraIntro">
  <span class="optykerAuroraEyebrow">OTTICA VISUAL CARE</span>
  <h2>La tua visione.<br><span>Un nuovo spazio.</span></h2>
  <p>Precisione, persone e tecnologia.<br>Il tuo centro ottico, in un'unica interfaccia.</p>
  <span class="optykerAuroraSignature">OPTYKER / DESIGN 2026</span>
</div>
'''
if 'class="optykerAuroraIntro"' not in html:
    anchor = '<div class="optykerLoginShell">'
    if anchor not in html:
        raise SystemExit('Aurora: original login shell missing')
    html = html.replace(anchor, intro + anchor, 1)

if re.findall(script_pattern, html) != original_scripts:
    raise SystemExit('Aurora: refusing a change to application JavaScript')
if re.findall(control_pattern, html) != original_controls:
    raise SystemExit('Aurora: refusing a change to existing form controls')

shutil.copyfile(REPO / 'optyker-aurora.css', ROOT / 'optyker-aurora.css')
page.write_text(html, encoding='utf-8')
# These are the two existing supported desktop aliases, not mobile/Shopify apps.
for alias in ('gestionale-v2', 'gestionale-v3'):
    target = ROOT / alias / 'index.html'
    if target.is_file():
        target.write_text(html, encoding='utf-8')
print('Optyker Aurora: screen-only design applied to desktop entry points (' + VERSION + ').')

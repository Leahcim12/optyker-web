from pathlib import Path
import re

APP = Path('iphone-app-v13/index.html')
BOOK = Path('booking/index.html')
APP_CSS = Path('iphone-app-v13/premium-ui-v1.css')
APP_JS = Path('iphone-app-v13/premium-ui-v1.js')
BOOK_CSS = Path('booking/premium-ui-v1.css')

app = APP.read_text(encoding='utf-8')
book = BOOK.read_text(encoding='utf-8')
app_css = APP_CSS.read_text(encoding='utf-8')
app_js = APP_JS.read_text(encoding='utf-8')
book_css = BOOK_CSS.read_text(encoding='utf-8')

# Remove old external references. The production Pages build copies the HTML
# but not the premium assets, so keep the presentation self-contained.
app = re.sub(r'\s*<link[^>]+premium-ui-v1\.css[^>]*>\s*', '\n', app, flags=re.I)
app = re.sub(r'\s*<script[^>]+premium-ui-v1\.js[^>]*>\s*</script>\s*', '\n', app, flags=re.I)
book = re.sub(r'\s*<link[^>]+premium-ui-v1\.css[^>]*>\s*', '\n', book, flags=re.I)

# Idempotency: remove any previous inline premium blocks before reinserting.
app = re.sub(r'\s*<style id="optykerPremiumUiInlineV2">[\s\S]*?</style>\s*', '\n', app, flags=re.I)
app = re.sub(r'\s*<script id="optykerPremiumUiInlineV2">[\s\S]*?</script>\s*', '\n', app, flags=re.I)
book = re.sub(r'\s*<style id="optykerPremiumBookingInlineV2">[\s\S]*?</style>\s*', '\n', book, flags=re.I)

if '</head>' not in app or '</body>' not in app or '</head>' not in book:
    raise SystemExit('Struttura HTML app/booking non trovata')

# CSS must be available while the page paints, so it stays in <head>.
app_style = '<style id="optykerPremiumUiInlineV2">\n' + app_css + '\n</style>\n'
book_style = '<style id="optykerPremiumBookingInlineV2">\n' + book_css + '\n</style>\n'
app = app.replace('</head>', app_style + '</head>', 1)
book = book.replace('</head>', book_style + '</head>', 1)

# The premium JavaScript overrides dashboardMarkup/render/shell and therefore
# MUST run after the application's original JavaScript has defined them.
# Putting it immediately before </body> preserves the semantics of the old
# external `defer` script while remaining self-contained in the deployed HTML.
app_script = '<script id="optykerPremiumUiInlineV2">\n' + app_js + '\n</script>\n'
app = app.replace('</body>', app_script + '</body>', 1)

APP.write_text(app, encoding='utf-8')
BOOK.write_text(book, encoding='utf-8')

checks = [
    'id="optykerPremiumUiInlineV2"',
    'OPTYKER_IPHONE_PREMIUM_UI_V1',
    'premiumBottomNav',
    'premiumHomeHero',
    'const baseRender=render',
]
for item in checks:
    if item not in app:
        raise SystemExit('Restyling iPhone incompleto: ' + item)
if app.rfind('<script id="optykerPremiumUiInlineV2">') < app.rfind('async function boot'):
    raise SystemExit('Il JavaScript premium viene ancora eseguito prima del codice base')
if 'id="optykerPremiumBookingInlineV2"' not in book:
    raise SystemExit('Restyling booking incompleto')

print('Restyling premium iPhone incorporato ed eseguito dopo il codice base')

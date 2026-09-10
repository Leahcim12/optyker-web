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

# Remove the old external references: GitHub Pages' legacy build copied the
# HTML but not these assets, so the browser silently fell back to the old UI.
app = re.sub(r'\s*<link[^>]+premium-ui-v1\.css[^>]*>\s*', '\n', app, flags=re.I)
app = re.sub(r'\s*<script[^>]+premium-ui-v1\.js[^>]*>\s*</script>\s*', '\n', app, flags=re.I)
book = re.sub(r'\s*<link[^>]+premium-ui-v1\.css[^>]*>\s*', '\n', book, flags=re.I)

# Make the patch idempotent if it is ever re-run.
app = re.sub(r'\s*<style id="optykerPremiumUiInlineV2">[\s\S]*?</style>\s*', '\n', app, flags=re.I)
app = re.sub(r'\s*<script id="optykerPremiumUiInlineV2">[\s\S]*?</script>\s*', '\n', app, flags=re.I)
book = re.sub(r'\s*<style id="optykerPremiumBookingInlineV2">[\s\S]*?</style>\s*', '\n', book, flags=re.I)

needle = '</head>'
if needle not in app or needle not in book:
    raise SystemExit('Head app/booking non trovato')

app_inline = (
    '<style id="optykerPremiumUiInlineV2">\n' + app_css + '\n</style>\n'
    '<script id="optykerPremiumUiInlineV2">\n' + app_js + '\n</script>\n'
)
book_inline = '<style id="optykerPremiumBookingInlineV2">\n' + book_css + '\n</style>\n'

app = app.replace(needle, app_inline + needle, 1)
book = book.replace(needle, book_inline + needle, 1)

APP.write_text(app, encoding='utf-8')
BOOK.write_text(book, encoding='utf-8')

checks = [
    'id="optykerPremiumUiInlineV2"',
    'OPTYKER_IPHONE_PREMIUM_UI_V1',
    'premiumBottomNav',
    'premiumHomeHero',
]
for item in checks:
    if item not in app:
        raise SystemExit('Restyling iPhone incompleto: ' + item)
if 'id="optykerPremiumBookingInlineV2"' not in book:
    raise SystemExit('Restyling booking incompleto')

print('Restyling premium iPhone Optyker incorporato direttamente nell’app')

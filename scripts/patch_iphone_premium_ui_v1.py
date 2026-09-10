from pathlib import Path
import re

APP = Path('iphone-app-v13/index.html')
BOOK = Path('booking/index.html')
APP_CSS = Path('iphone-app-v13/premium-ui-v1.css')
APP_JS = Path('iphone-app-v13/premium-ui-v1.js')
INTERACTIONS_CSS = Path('iphone-app-v13/reference-interactions-v1.css')
INTERACTIONS_JS = Path('iphone-app-v13/reference-interactions-v1.js')
SHOP_CSS = Path('iphone-app-v13/shop-nav-v2.css')
SHOP_JS = Path('iphone-app-v13/shop-nav-v2.js')
BOOK_CSS = Path('booking/premium-ui-v1.css')

app = APP.read_text(encoding='utf-8')
book = BOOK.read_text(encoding='utf-8')
app_css = APP_CSS.read_text(encoding='utf-8')
app_js = APP_JS.read_text(encoding='utf-8')
interactions_css = INTERACTIONS_CSS.read_text(encoding='utf-8')
interactions_js = INTERACTIONS_JS.read_text(encoding='utf-8')
shop_css = SHOP_CSS.read_text(encoding='utf-8')
shop_js = SHOP_JS.read_text(encoding='utf-8')
book_css = BOOK_CSS.read_text(encoding='utf-8')

app = re.sub(r'\s*<link[^>]+premium-ui-v1\.css[^>]*>\s*', '\n', app, flags=re.I)
app = re.sub(r'\s*<script[^>]+premium-ui-v1\.js[^>]*>\s*</script>\s*', '\n', app, flags=re.I)
book = re.sub(r'\s*<link[^>]+premium-ui-v1\.css[^>]*>\s*', '\n', book, flags=re.I)

app = re.sub(r'\s*<style id="optykerPremiumUiInlineV2">[\s\S]*?</style>\s*', '\n', app, flags=re.I)
app = re.sub(r'\s*<script id="optykerPremiumUiInlineV2">[\s\S]*?</script>\s*', '\n', app, flags=re.I)
book = re.sub(r'\s*<style id="optykerPremiumBookingInlineV2">[\s\S]*?</style>\s*', '\n', book, flags=re.I)

if '</head>' not in app or '</body>' not in app or '</head>' not in book:
    raise SystemExit('Struttura HTML app/booking non trovata')

app_style = '<style id="optykerPremiumUiInlineV2">\n' + app_css + '\n' + interactions_css + '\n' + shop_css + '\n</style>\n'
book_style = '<style id="optykerPremiumBookingInlineV2">\n' + book_css + '\n</style>\n'
app = app.replace('</head>', app_style + '</head>', 1)
book = book.replace('</head>', book_style + '</head>', 1)

# Ordine: UI di riferimento, pannello novita, quindi Shop/nav V2.
app_script = '<script id="optykerPremiumUiInlineV2">\n' + app_js + '\n' + interactions_js + '\n' + shop_js + '\n</script>\n'
app = app.replace('</body>', app_script + '</body>', 1)

APP.write_text(app, encoding='utf-8')
BOOK.write_text(book, encoding='utf-8')

checks = [
    'id="optykerPremiumUiInlineV2"',
    'OPTYKER_IPHONE_REFERENCE_UI_V2',
    'OPTYKER_IPHONE_REFERENCE_INTERACTIONS_V1',
    'OPTYKER_IPHONE_SHOP_NAV_V2',
    'refBottomNav',
    'refHomeTop',
    'refProfilePage',
    'refEyewearPage',
    'refNewsDrawer',
    'toggleNewsDrawer',
    'refShopV2',
    'openShopHome',
    "center.setAttribute('onclick','openShopHome()')",
    'const baseRender=render',
]
for item in checks:
    if item not in app:
        raise SystemExit('Restyling iPhone incompleto: ' + item)
if app.rfind('<script id="optykerPremiumUiInlineV2">') < app.rfind('async function boot'):
    raise SystemExit('Il JavaScript reference UI viene ancora eseguito prima del codice base')
if 'id="optykerPremiumBookingInlineV2"' not in book:
    raise SystemExit('Restyling booking incompleto')

print('UI iPhone Optyker con Shop premium, cerchio Shop e notifiche laterali incorporata correttamente')

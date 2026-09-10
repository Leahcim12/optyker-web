from pathlib import Path

APP = Path('iphone-app-v13/index.html')
BOOK = Path('booking/index.html')

app = APP.read_text(encoding='utf-8')
book = BOOK.read_text(encoding='utf-8')

CSS = '<link rel="stylesheet" href="./premium-ui-v1.css?v=20260910-premium1">'
JS = '<script src="./premium-ui-v1.js?v=20260910-premium1" defer></script>'
BOOK_CSS = '<link rel="stylesheet" href="./premium-ui-v1.css?v=20260910-premium1">'

if CSS not in app:
    needle = '</head>'
    if needle not in app:
        raise SystemExit('Head app iPhone non trovato')
    app = app.replace(needle, f'  {CSS}\n  {JS}\n{needle}', 1)
elif JS not in app:
    app = app.replace(CSS, CSS + '\n  ' + JS, 1)

if BOOK_CSS not in book:
    needle = '</head>'
    if needle not in book:
        raise SystemExit('Head booking non trovato')
    book = book.replace(needle, BOOK_CSS + '\n' + needle, 1)

APP.write_text(app, encoding='utf-8')
BOOK.write_text(book, encoding='utf-8')

checks = [
    'premium-ui-v1.css?v=20260910-premium1',
    'premium-ui-v1.js?v=20260910-premium1',
]
for item in checks:
    if item not in app:
        raise SystemExit('Restyling iPhone incompleto: ' + item)
if 'premium-ui-v1.css?v=20260910-premium1' not in book:
    raise SystemExit('Restyling booking incompleto')

print('Restyling premium iPhone Optyker installato')

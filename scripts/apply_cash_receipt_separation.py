from pathlib import Path
from shutil import copyfile

root=Path('_site')
page=root/'index.html'
text=page.read_text()
MARK='OPTYKER_CASH_RECEIPT_SEPARATION_V1_LOADER'
if MARK not in text:
    pos=text.lower().rfind('</body>')
    if pos<0:
        raise SystemExit('Missing </body> in production HTML')
    tag='<script id="optykerCashReceiptSeparationJs" src="/cash-receipt-separation.js?v=20260914-rch-local1"></script>\n<!-- '+MARK+' -->\n'
    text=text[:pos]+tag+text[pos:]
copyfile('cash-receipt-separation.js',root/'cash-receipt-separation.js')
page.write_text(text)
for alias in ('gestionale-v2','gestionale-v3'):
    (root/alias/'index.html').write_text(text)
if text.count('id="optykerCashReceiptSeparationJs"')!=1:
    raise SystemExit('Cash receipt separation loader duplicated or missing')
print('Cash receipt / Shopify separation installed')

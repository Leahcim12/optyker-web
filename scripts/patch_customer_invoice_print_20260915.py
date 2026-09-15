from pathlib import Path
import re
import shutil

ROOT=Path('_site')
VERSION='20260915-invoice-print1'
SOURCE=Path('customer-invoice-print.js')
TARGET=ROOT/'customer-invoice-print.js'
HTMLS=[ROOT/'index.html',ROOT/'gestionale-v2/index.html',ROOT/'gestionale-v3/index.html']

if not SOURCE.is_file():
    raise SystemExit('customer-invoice-print.js missing')
shutil.copyfile(SOURCE,TARGET)

header_old='<th>Totale</th><th>Stato SDI</th></tr></thead><tbody>'
header_new='<th>Totale</th><th>Stato SDI</th><th>Azioni</th></tr></thead><tbody>'
literal_old=r'''<td><span class=\"optykerDocsStatus '+statusClass(r.sdi_status)+'\">'+esc(r.sdi_status||'—')+'</span></td></tr>'});'''
literal_new=r'''<td><span class=\"optykerDocsStatus '+statusClass(r.sdi_status)+'\">'+esc(r.sdi_status||'—')+'</span></td><td><button class=\"optykerInvoicePrintBtn\" type=\"button\" data-invoice-print=\"'+esc(r.id)+'\">Visualizza / Stampa</button></td></tr>'});'''
loader=f'<script id="optykerCustomerInvoicePrintJs" src="/customer-invoice-print.js?v={VERSION}"></script>'

for path in HTMLS:
    if not path.is_file():
        raise SystemExit(f'Missing desktop page: {path}')
    text=path.read_text(encoding='utf-8')
    text=re.sub(r'<script\b[^>]*id=["\']optykerCustomerInvoicePrintJs["\'][^>]*>\s*</script>\s*','',text,flags=re.I)
    if 'data-invoice-print=' not in text:
        if text.count(header_old)!=1:
            raise SystemExit(f'Customer invoice table header contract changed in {path}: {text.count(header_old)}')
        text=text.replace(header_old,header_new,1)
        if text.count(literal_old)!=1:
            raise SystemExit(f'Customer invoice row contract changed in {path}: {text.count(literal_old)}')
        text=text.replace(literal_old,literal_new,1)
    close=text.lower().rfind('</body>')
    if close<0:
        raise SystemExit(f'Closing body missing in {path}')
    text=text[:close]+loader+'\n'+text[close:]
    path.write_text(text,encoding='utf-8')

main=(ROOT/'index.html').read_text(encoding='utf-8')
if main.count('data-invoice-print=')!=1:
    raise SystemExit('Customer invoice print action missing or duplicated')
if main.count('optykerCustomerInvoicePrintJs')!=1:
    raise SystemExit('Customer invoice print loader missing or duplicated')
if 'Visualizza / Stampa' not in main:
    raise SystemExit('Customer invoice print label missing')
asset=SOURCE.read_text(encoding='utf-8')
if 'fic_send' in asset:
    raise SystemExit('Customer print asset must never send to SDI')
if 'optyker-customer-invoice-print-api' not in asset:
    raise SystemExit('Customer print asset is not using the print-only API')
if (ROOT/'gestionale-v2/index.html').read_bytes()!=(ROOT/'index.html').read_bytes() or (ROOT/'gestionale-v3/index.html').read_bytes()!=(ROOT/'index.html').read_bytes():
    raise SystemExit('Desktop aliases differ after customer invoice print patch')
print('Customer invoice preview/print added; SDI remains separate:',VERSION)

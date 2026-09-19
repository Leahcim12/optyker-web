"""Add staff-only client details, Focus import and the separated RCH receipt route."""
from pathlib import Path
from shutil import copyfile
import re
from apply_ts_connection import DocumentClosings

ROOT=Path('_site')
PAGE=ROOT/'index.html'
text=PAGE.read_text()
MARK='OPTYKER_CLIENT_DETAILS_V1_LOADER'
if MARK not in text:
    closings=DocumentClosings(text).closings
    inserts={
        'head':'<link id="optykerClientDetailsCss" rel="stylesheet" href="/client-details.css?v=20260913-client-details1">\n',
        'body':'<script id="optykerFocusClientParserJs" src="/focus-client-parser.js?v=20260913-client-details1"></script>\n<script id="optykerClientDetailsJs" src="/client-details.js?v=20260913-client-details1"></script>\n<script id="optykerClientImportChunkedJs" src="/client-import-chunked.js?v=20260913-client-import-chunked1"></script>\n<!-- '+MARK+' -->\n',
    }
    for tag in sorted(closings,key=closings.get,reverse=True):
        pos=closings[tag]
        text=text[:pos]+inserts[tag]+text[pos:]
else:
    if 'id="optykerClientImportChunkedJs"' not in text:
        pos=DocumentClosings(text).closings['body']
        asset='<script id="optykerClientImportChunkedJs" src="/client-import-chunked.js?v=20260913-client-import-chunked1"></script>\n'
        text=text[:pos]+asset+text[pos:]

# Physical receipt checkout must never create a Shopify order as a side effect.
# Load the fetch router after all existing cash/fiscal modules.
if 'id="optykerCashReceiptSeparationJs"' not in text:
    pos=DocumentClosings(text).closings['body']
    asset='<script id="optykerCashReceiptSeparationJs" src="/cash-receipt-separation.js?v=20260919-cash-open1"></script>\n<!-- OPTYKER_CASH_RECEIPT_SEPARATION_V1_LOADER -->\n'
    text=text[:pos]+asset+text[pos:]

# Refresh the script URL even when rebuilding an artifact with an older loader.
text = re.sub(r'(/cash-receipt-separation\.js)(?:\?[^"\']*)?(?=["\'])',
              r'\1?v=20260919-cash-open1', text)
if 'OPTYKER_CASH_OPEN_LOOP_FIXED_20260919' not in Path('cash-receipt-separation.js').read_text():
    raise SystemExit('Cash opening: idempotent receipt help script missing')
for name in ('client-details.js','client-details.css','focus-client-parser.js','client-import-chunked.js','cash-receipt-separation.js'):
    copyfile(name,ROOT/name)
for ident in ('optykerClientDetailsCss','optykerFocusClientParserJs','optykerClientDetailsJs','optykerClientImportChunkedJs','optykerCashReceiptSeparationJs'):
    if text.count('id="'+ident+'"')!=1:
        raise SystemExit('Expected exactly one production asset: '+ident)
PAGE.write_text(text)
for alias in ('gestionale-v2','gestionale-v3'):
    (ROOT/alias/'index.html').write_text(text)
print('Client tools and separated physical RCH receipt route installed: 20260919-cash-open1')

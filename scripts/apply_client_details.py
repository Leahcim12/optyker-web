"""Add staff-only client details and a local Focus file reader to the built app."""
from pathlib import Path
from shutil import copyfile
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
    # Existing builds from the earlier importer need the chunked fix injected once.
    if 'id="optykerClientImportChunkedJs"' not in text:
        pos=DocumentClosings(text).closings['body']
        asset='<script id="optykerClientImportChunkedJs" src="/client-import-chunked.js?v=20260913-client-import-chunked1"></script>\n'
        text=text[:pos]+asset+text[pos:]
for name in ('client-details.js','client-details.css','focus-client-parser.js','client-import-chunked.js'):
    copyfile(name,ROOT/name)
for ident in ('optykerClientDetailsCss','optykerFocusClientParserJs','optykerClientDetailsJs','optykerClientImportChunkedJs'):
    if text.count('id="'+ident+'"')!=1:
        raise SystemExit('Expected exactly one client details asset: '+ident)
PAGE.write_text(text)
for alias in ('gestionale-v2','gestionale-v3'):
    (ROOT/alias/'index.html').write_text(text)
print('Staff client details and chunked reviewed Focus importer installed')

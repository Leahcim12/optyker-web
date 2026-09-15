"""Last build step: publish coordinated TS/RCH cancellation without legacy overwrite."""
from pathlib import Path
import json,os,re
ROOT=Path(__file__).resolve().parent.parent
VERSION='20260915-unified1'
def main():
    site=ROOT/'_site'
    for name in ('fiscal-receipts.js','rch-cloud-relay.js','unified-fiscal-void.js'):
        (site/name).write_bytes((ROOT/name).read_bytes())
    for name in ('rch-optyker-connector.ps1','rch-optyker-cloud-worker.ps1'):
        (site/'rch-connector'/name).write_bytes((ROOT/'rch-connector'/name).read_bytes())
    for name in ('Installa-RCH-Optyker.ps1','Installa-RCH-Optyker.bat'):
        installer=site/'rch-connector'/name
        if installer.exists():
            text=installer.read_text()
            text=re.sub(r'\?v=20260914-cloud4(?!&unified=)', '?v=20260914-cloud4&unified='+VERSION,text)
            installer.write_text(text)
    # Preserve every existing cash/eyewear patch, only update the fiscal assets.
    h=(site/'index.html').read_text()
    if 'id="optykerUnifiedVoidJs"' not in h:
        h=h.replace('\n</body>','\n<script id="optykerUnifiedVoidJs" defer src="/unified-fiscal-void.js?v='+VERSION+'"></script>\n</body>')
    pattern=r'(fiscal-receipts\.js|rch-cloud-relay\.js)(?:\?[^\s\"\'<>]*)?'
    h=re.sub(pattern,lambda m:m[1]+'?v='+VERSION,h)
    (site/'index.html').write_text(h)
    for js in site.glob('*.js'):
        text=js.read_text();patched=re.sub(pattern,lambda m:m[1]+'?v='+VERSION,text)
        if text!=patched:js.write_text(patched)
    for alias in ('gestionale-v2','gestionale-v3'):
        (site/alias/'index.html').write_text(h)
        for name in ('fiscal-receipts.js','rch-cloud-relay.js','unified-fiscal-void.js'):(site/alias/name).write_bytes((site/name).read_bytes())
    (site/'unified-void-version.json').write_text(json.dumps({'version':VERSION,'commit':os.getenv('VERCEL_GIT_COMMIT_SHA') or os.getenv('GITHUB_SHA','')})+'\n')
    print('Unified TS/RCH void published:',VERSION)
if __name__=='__main__':main()

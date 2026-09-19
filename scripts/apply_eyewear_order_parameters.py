"""Final production patch: order measurements and recoverable order cancellation."""
from pathlib import Path
import hashlib,json,os,re

ROOT=Path(__file__).resolve().parent.parent
VERSION='20260915-order-params1'
MARK='OPTYKER_EYEWEAR_ORDER_PARAMETERS_20260915'

def once(s,a,b):
    if s.count(a)!=1:raise ValueError('Order parameters anchor must be unique: '+a[:90])
    return s.replace(a,b,1)

def patch_html(h):
    if MARK in h:return h
    start=h.index('<script id="optykerEyewearFlowV9Inline">')
    end=h.index('</script>',start)
    block=h[start:end]
    source=(ROOT/'eyewear-order-parameters.mjs').read_text().replace('export ','')
    addon=source+'\n'+(ROOT/'eyewear-order-parameters-ui.js').read_text()
    pos=block.rfind('})();')
    if pos<0:raise ValueError('Final eyewear closure not found')
    block=block[:pos]+'\n/* '+MARK+' */\n'+addon+'\n'+block[pos:]
    # Only the active print function is changed, not the legacy clinical printouts.
    a=block.index('function printSheet(){');b=block.index('function catalogSelected()',a)
    printable=once(block[a:b],"</table></body></html>'", "</table>'+orderParametersHtml(d.order_parameters)+'</body></html>'")
    block=block[:a]+printable+block[b:];h=h[:start]+block+h[end:]
    anchor='window.optykerEyewearRecentRows=function(){return S.recent.slice(0,15)};'
    h=once(h,anchor,anchor+"\nwindow.addEventListener('optyker:sheet-removed',function(ev){var ids=ev.detail.archived_sheet_ids||[ev.detail.sheet_id];S.recent=S.recent.filter(function(r){return !ids.includes(r.id)});renderRecent()});")
    h=once(h,'\n</head>','\n<style id="eyOrderParametersCss">'+(ROOT/'eyewear-order-parameters.css').read_text()+'</style>\n</head>')
    h=once(h,'\n</body>','\n<script defer src="/order-sheet-actions.js?v='+VERSION+'"></script>\n</body>')
    return h

def main():
    site=ROOT/'_site';page=site/'index.html';h=patch_html(page.read_text())
    assets=('cash-register.js','client-sheet-actions.js','client-sheet-edit.js')
    # Cash has its own final release. Do not replace it with the older eyewear key.
    cash_ref=re.search(r'cash-register\.js\?v=([A-Za-z0-9_.-]+)',h)
    if not cash_ref:raise ValueError('Cash asset version missing before eyewear assembly')
    cash_version=cash_ref[1]
    def cache_ref(m):return m[1]+'?v='+(cash_version if m[1]=='cash-register.js' else VERSION)
    pattern=r'('+ '|'.join(re.escape(n) for n in assets)+r')(?:\?[^\s\"\'<>]*)?'
    h=re.sub(pattern,cache_ref,h)
    page.write_text(h)
    for name in ('order-sheet-actions.js',): (site/name).write_bytes((ROOT/name).read_bytes())
    for js in site.glob('*.js'):
        s=js.read_text();n=re.sub(pattern,cache_ref,s)
        if n!=s:js.write_text(n)
    for alias in ('gestionale-v2','gestionale-v3'):
        (site/alias/'index.html').write_text(h)
        for name in (*assets,'order-sheet-actions.js'):
            if (site/name).exists():(site/alias/name).write_bytes((site/name).read_bytes())
    (site/'eyewear-order-version.json').write_text(json.dumps({'version':VERSION,'commit':os.environ.get('VERCEL_GIT_COMMIT_SHA') or os.environ.get('GITHUB_SHA',''),'html_sha256':hashlib.sha256(page.read_bytes()).hexdigest()},indent=2)+'\n')
    print('Eyewear parameters and recoverable order cancellation installed:',VERSION)

if __name__=='__main__':main()

"""POS customer lookup and fiscal preflight, without changing printer commands."""
from pathlib import Path
import hashlib,json,os,re
ROOT=Path(__file__).resolve().parent.parent
MARK='OPTYKER_CASH_CLIENT_SEARCH_20260919'
FISCAL_MARK='OPTYKER_CASH_FISCAL_PREFLIGHT_20260919'
VERSION='20260919-clientsearch1'

def patch(source):
    if MARK not in source:
        for anchor in ('function searchCashClients(', 'function clientCartLoad(', 'function clientCartHasPending(', 'function fillClients('):
            if source.count(anchor)!=1:raise ValueError('Customer search: unexpected anchor '+anchor)
        pos=source.rfind('})();')
        if pos<0:raise ValueError('Cash closure missing')
        source=source[:pos]+'\n'+(ROOT/'cash-client-search.js').read_text(encoding='utf-8')+'\n'+source[pos:]
    if FISCAL_MARK not in source:
        domain=(ROOT/'supabase/functions/optyker-fiscal-api/domain.mjs').read_text(encoding='utf-8')
        if "DEPARTMENTS = Object.freeze({1:{vat:'04',type:'goods'},2:{vat:'22',type:'goods'},3:{vat:'ART10',type:'services'}})" not in domain:
            raise ValueError('Fiscal mapping changed: review preflight instead of guessing departments')
        pos=source.rfind('})();')
        source=source[:pos]+'\n'+(ROOT/'cash-fiscal-preflight.js').read_text(encoding='utf-8')+'\n'+source[pos:]
    return source

def main():
    site=ROOT/'_site';cash=site/'cash-register.js';before=cash.read_text(encoding='utf-8');after=patch(before)
    if patch(after)!=after:raise ValueError('Customer search patch is not idempotent')
    cash.write_text(after,encoding='utf-8')
    css=site/'cash-register.css';styles=css.read_text(encoding='utf-8')
    if MARK not in styles:css.write_text(styles+'\n'+(ROOT/'cash-client-search.css').read_text(),encoding='utf-8')
    pattern=r'cash-register\.(?:js|css)(?:\?[^\s\"\'<>]*)?'
    def versioned(m):
        val=re.sub(r'&clientsearch=[^&\s\"\'<>]+','',m[0]);return val+('&' if '?' in val else '?')+'clientsearch='+VERSION
    for folder in (site,site/'gestionale-v2',site/'gestionale-v3'):
        page=folder/'index.html';page.write_text(re.sub(pattern,versioned,page.read_text(encoding='utf-8')),encoding='utf-8')
        if folder!=site:
            (folder/cash.name).write_bytes(cash.read_bytes());(folder/css.name).write_bytes(css.read_bytes())
    for js in site.glob('*.js'):
        if js==cash:continue
        s=js.read_text(encoding='utf-8');n=re.sub(pattern,versioned,s)
        if s!=n:js.write_text(n,encoding='utf-8')
    from apply_cash_recorded_balances import main as apply_balances
    apply_balances()
    (site/'cash-client-search-version.json').write_text(json.dumps({'version':VERSION,'fiscal_preflight':'20260919-preflight1','commit':os.environ.get('VERCEL_GIT_COMMIT_SHA') or os.environ.get('GITHUB_SHA',''),'cash_sha256':hashlib.sha256(cash.read_bytes()).hexdigest()},indent=2)+'\n')
    from apply_cash_print_recovery_ui import main as apply_error_details
    apply_error_details()
    print('Customer lookup and fiscal preflight installed:',VERSION,'(existing payment routes unchanged)')
if __name__=='__main__':main()

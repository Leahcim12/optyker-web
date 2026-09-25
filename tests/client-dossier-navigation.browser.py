"""Run the production DOM, styles and controllers offline with synthetic clients.

No live login, save, database mutation, order or fiscal dispatch is performed.
Assets are inlined because the sandbox browser prohibits URL navigation. The sole
source substitution supplies document.currentScript.src's base URL when inline.
"""
from pathlib import Path
from urllib.parse import urlsplit, unquote
from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright
import json, os

BASE = Path(__file__).resolve().parents[1]
SITE = BASE / '_site'
OUT = Path(os.environ.get('DOSSIER_TEST_OUTPUT', '/tmp/client-dossier-navigation'))
OUT.mkdir(parents=True, exist_ok=True)

def inline_build():
    html = BeautifulSoup((SITE / 'index.html').read_text(), 'html.parser')
    deferred = []
    for tag in list(html.find_all('link', href=True)):
        asset = SITE / unquote(urlsplit(tag['href']).path).lstrip('/')
        if 'stylesheet' in tag.get('rel', []) and asset.is_file():
            style = html.new_tag('style'); style.string = asset.read_text(); tag.replace_with(style)
    for tag in list(html.find_all('script', src=True)):
        asset = SITE / unquote(urlsplit(tag['src']).path).lstrip('/')
        if not asset.is_file() or tag.get('type') == 'module':
            continue
        del tag['src']
        code = asset.read_text().replace('</script', '<\\/script')
        code = code.replace('document.currentScript?.src||location.href', repr('https://offline.example.invalid/' + asset.name))
        if os.environ.get('DOSSIER_BASELINE') and asset.name == 'client-dossier.js':
            code = Path(os.environ['DOSSIER_BASELINE']).read_text()
        tag.string = code
        if tag.has_attr('defer'):
            del tag['defer']; deferred.append(tag.extract())
    for tag in deferred:
        html.body.append(tag)
    return str(html)

SEED = '''() => {
 const a='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',b='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
 window.optykerAuthenticated=true;window.OPTYKER_ACTIVE_USER='TEST';
 Object.assign(OPTYKER_CLOUD,{username:'TEST',password:'SYNTHETIC_NOT_A_CREDENTIAL',
 clients:[{id:a,name:'Cliente',surname:'Dimostrativo',reference_no:'1C',email:'demo@example.invalid'},{id:b,name:'Secondo',surname:'Dimostrativo',reference_no:'2C'}],
 sheets:{[a]:[{id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',client_id:a,sheet_type:'lac',reference_no:'1B26',created_at:'2026-09-25T09:00:00Z',data:{sheetType:'lac',examDate:'25/09/2026',lacState:{brand:'Demo',notes:'SOLO DATI SINTETICI',document:'Busta'}}},{id:'dddddddd-dddd-4ddd-8ddd-dddddddddddd',client_id:a,sheet_type:'lac',reference_no:'2P26',created_at:'2026-09-24T09:00:00Z',data:{sheetType:'lac',examDate:'24/09/2026',lacState:{notes:'Prova precedente',document:'Preventivo'}}}], [b]:[]},consents:{[a]:[],[b]:[]}});
 window.cloudLoadSheets=async id=>OPTYKER_CLOUD.sheets[id]||[];
 window.cloudLoadConsents=async id=>OPTYKER_CLOUD.consents[id]||[];
 document.getElementById('optykerLoginScreen').style.setProperty('display','none','important');
 document.getElementById('mainApp').style.display='grid';
 document.documentElement.classList.remove('optykerLoginActive20260919');
 clientSelect(a);optykerShowOnlyRootPanel('clientsPanel');clientShowView('edit');
}'''

with sync_playwright() as p:
    binary = '/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None
    browser = p.chromium.launch(executable_path=binary, headless=True, args=['--no-sandbox'])
    results = []
    for name, size in [('desktop', {'width':1280,'height':1000}), ('ipad', {'width':1180,'height':820})]:
        page = browser.new_page(viewport=size, service_workers='block')
        page.set_default_timeout(5000)
        errors, requests = [], []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.on('dialog', lambda d: d.dismiss())
        def block(route):
            requests.append({'method': route.request.method, 'url': urlsplit(route.request.url).path})
            if route.request.method != 'GET':
                route.fulfill(status=401, json={'ok':False, 'error':'SYNTHETIC_NO_REMOTE_ACCESS'})
            else:
                route.abort()
        page.route('**/*', block)
        page.evaluate('''()=>{for(const prop of ['localStorage','sessionStorage']){const m=new Map();Object.defineProperty(window,prop,{value:{getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k)}});}}''')
        page.set_content(inline_build(), wait_until='domcontentloaded')
        page.wait_for_timeout(2000)
        page.evaluate(SEED)
        page.wait_for_timeout(2200)
        checks = []
        def check(label, value):
            assert value, label
            checks.append(label)
        check('single client navigation', not page.locator('#clientPageNav').is_visible())
        check('legacy sidebar removed', not page.locator('#clientSidebarSubmenu').is_visible())
        check('twelve sheet categories available', page.locator('[data-cd-type]').count() == 12)
        check('old clinical header hidden', not page.locator('#reportSectionTop').is_visible())
        page.locator('[data-cd-type="lac"]').click()
        check('dated LAC binder', page.locator('#cdDocument').is_visible() and page.locator('[role="tab"][data-cd-date]').count() == 2)
        page.locator('[data-cd-date="dddddddd-dddd-4ddd-8ddd-dddddddddddd"]').click()
        check('date changes content', 'Prova precedente' in page.locator('#cdDocument').inner_text())
        page.locator('button[data-cd-page="anagrafica"]').click()
        check('anagrafica opens', page.locator('#clientDbName').is_visible() and not page.locator('#cdDocument').count())
        page.locator('#clientDbName').fill('Nome Non Ancora Salvato')
        page.wait_for_timeout(2000)
        check('typing survives legacy refresh', page.locator('#clientDbName').input_value() == 'Nome Non Ancora Salvato')
        page.locator('button[data-cd-page="ordini"]').click()
        page.wait_for_timeout(1300)
        check('client orders open', page.locator('#clientOnlineOrdersSection').is_visible())
        check('orders not covered by stale binder', not page.locator('#cdDocument').count())
        page.locator('button[data-cd-page="documenti"]').click()
        check('client documents open', page.locator('#clientInformativeSection').is_visible())
        page.locator('button[data-cd-page="schede"]').click()
        page.locator('[data-cd-type="lac"]').click()
        page.locator('button[data-cd-page="lac"]').click()
        check('supplies still accessible', page.locator('#clientLacPageExtras').is_visible())
        page.locator('.cdHeading [data-cd-page="schede"]').click()
        page.locator('#navDashboard').click()
        page.wait_for_timeout(700)
        check('dashboard shown', page.locator('#dashboardPanel').is_visible() and not page.locator('#clientsPanel').is_visible())
        page.locator('#navClients').click()
        page.wait_for_timeout(1400)
        check('return from dashboard not blank', page.locator('#clientDossier').is_visible() and not page.locator('#dashboardPanel').is_visible())
        page.evaluate("optykerClientOpenPage('anagrafica')")
        page.wait_for_timeout(100)
        check('legacy entry synchronized', page.locator('button[data-cd-page="anagrafica"]').get_attribute('aria-current') == 'page' and page.locator('#clientDbName').is_visible())
        check('unsaved profile preserved on routes', page.locator('#clientDbName').input_value() == 'Nome Non Ancora Salvato')
        page.locator('#navOrders').click()
        page.wait_for_timeout(500)
        check('global orders shown', page.locator('#onlineOrdersPanel').is_visible())
        page.locator('#navClients').click()
        page.wait_for_timeout(1300)
        check('return from orders not blank', page.locator('#clientDossier').is_visible() and not page.locator('#onlineOrdersPanel').is_visible())
        page.evaluate("clientSidebarOpenDate('lac','dddddddd-dddd-4ddd-8ddd-dddddddddddd')")
        page.wait_for_timeout(1400)
        check('legacy dated link routed to binder', page.locator('[data-cd-date="dddddddd-dddd-4ddd-8ddd-dddddddddddd"]').get_attribute('aria-selected') == 'true')
        page.locator('[data-cd-type="visualexam"]').click()
        check('empty category opens', 'Nessuna scheda' in page.locator('.cdBinder').inner_text())
        page.locator('[data-cd-type="lac"]').click()
        page.locator('[data-cd-date="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"]').click()
        page.screenshot(path=str(OUT / (name+'.png')), full_page=True)
        page.evaluate("clientSelect('cccccccc-cccc-4ccc-8ccc-cccccccccccc')")
        page.wait_for_timeout(1400)
        check('customer isolation', 'SOLO DATI SINTETICI' not in page.locator('#clientDossier').inner_text() and page.locator('[data-cd-type="lac"] small').inner_text() == '0')
        page.evaluate('optykerAuthenticated=false;OPTYKER_CLIENT_DOSSIER.render()')
        check('logout clears binder', page.locator('#clientDossier').is_hidden() and not page.locator('#clientDossier').inner_text())
        # Expected unauthorized read failures are from the deliberately blocked services.
        unexpected = [e for e in errors if e not in ['Sessione non autenticata','SYNTHETIC_NO_REMOTE_ACCESS'] and not e.startswith('Failed to fetch')]
        check('no navigation runtime errors', not unexpected)
        result={'viewport':name,'passed':len(checks),'checks':checks,'unexpected_errors':unexpected,'network':'all requests blocked','data':'synthetic only'}
        print(json.dumps(result));results.append(result)
        page.close()
    (OUT/'results.json').write_text(json.dumps(results,indent=2))
    browser.close()

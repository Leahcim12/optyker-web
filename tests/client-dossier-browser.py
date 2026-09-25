"""Synthetic browser checks. Never connect to client data or production APIs."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json
base = Path(__file__).resolve().parents[1]
out = Path('/tmp/client-dossier-check')
out.mkdir(exist_ok=True)
html = '''<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font-family:Arial;margin:20px;background:#f8f8fa}#clientsPanel{max-width:1080px;margin:auto;background:white;padding:24px;border-radius:16px}#clientWorkspaceHero{font-size:24px;font-weight:700}#clientWorkspaceHero small{font-size:12px;display:block;color:#777;margin-top:8px}</style></head><body><nav id="moduleNav"><button id="navSheets">Schede</button></nav><main id="clientsPanel"><div id="clientEditView"><header id="clientWorkspaceHero">Cliente dimostrativo<small>ID 21C · Dati sintetici di test</small></header><div class="clientWorkspaceGrid"><div id="clientAnagraficaSection">Anagrafica originale</div></div></div></main><div id="lacPanel" style="display:none"><input id="lacDate"><label for="lacOdSf">OD · Sfera</label><input id="lacOdSf"></div></body></html>'''
rows = [{'id':'a1','client_id':'A','sheet_type':'lac','reference_no':'15B26','created_at':'2026-09-25T10:00:00Z','updated_at':'2026-09-25T11:00:00Z','operator':'Operatore demo','data':{'sheetType':'lac','examDate':'25/09/2026','lacProductStage':'final','lacState':{'brand':'Marca demo','odProductName':'Lente destra demo','osProductName':'Lente sinistra demo','odCost':100,'osCost':100,'notes':'Controllo della centratura e del comfort.'},'elements':{'lacOdSf':{'value':'-2.50'},'lacOsSf':{'value':'-2.00'},'lacDate':{'value':'25/09/2026'},'password':{'value':'must-not-render'}}}},{'id':'a2','client_id':'A','sheet_type':'lac','reference_no':'18P26','created_at':'2026-09-25T09:00:00Z','data':{'sheetType':'lac','examDate':'25/09/2026','lacProductStage':'trial','lacState':{'brand':'Marca demo','notes':'Prova precedente'}}},{'id':'a3','client_id':'A','sheet_type':'lac','reference_no':'12P26','data':{'sheetType':'lac','examDate':'18/09/2026','lacProductStage':'trial','notes':'<img src=x onerror=alert(1)>'}},{'id':'foreign','client_id':'B','sheet_type':'lac','title':'PRIVATE OTHER CLIENT','data':{}},{'id':'rx1','client_id':'A','sheet_type':'prescription','title':'Prescrizione completa','data':{'examDate':'20/09/2026','elements':{'rx_od_sf_1':{'value':'-3.00'},'rx_os_sf_1':{'value':'-2.50'}}}}]
with sync_playwright() as p:
    binary = '/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None
    browser = p.chromium.launch(executable_path=binary, headless=True, args=['--no-sandbox'])
    page = browser.new_page(viewport={'width':1280,'height':980})
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.route('**/*', lambda r: r.abort())
    page.set_content(html)
    page.evaluate('''rows=>{window.clientCurrentId='A';window.optykerAuthenticated=true;window.OPTYKER_CLOUD={username:'synthetic',password:'synthetic',sheets:{A:rows,B:[{id:'b1',client_id:'B',sheet_type:'hearing',data:{examDate:'2026-09-01'}}]}};window.calls=[];window.fetch=()=>{throw Error('Navigation must not fetch or write')};window.optykerClientOpenPage=p=>calls.push(['page',p]);window.clientCreateNewLacSheet=()=>{calls.push(['new-lac']);document.getElementById('lacPanel').style.display='block'};window.optykerEditClientSheet=id=>{calls.push(['edit',id]);document.getElementById('lacPanel').style.display='block'};window.openEyewearSheet=(m,id)=>calls.push(['new-eyewear',m,id]);window.clientCreateNewSheet=t=>calls.push(['new',t]);window.cloudLoadSheets=async id=>calls.push(['refresh',id]);window.OPTYKER_CLIENT_SHEETS={open:(f,id)=>calls.push(['manage',f,id])};}''', rows)
    page.add_script_tag(path=str(base/'client-dossier.js'))
    assert page.locator('[data-cd-type]').count() == 12
    page.locator('[data-cd-type="lac"]').click()
    assert page.locator('[role="tab"]').count() == 3
    assert page.locator('[role="tab"][aria-selected="true"]').inner_text().endswith('15B26')
    assert 'must-not-render' not in page.locator('#clientDossier').inner_text()
    assert 'PRIVATE OTHER CLIENT' not in page.locator('#clientDossier').inner_text()
    page.locator('[data-cd-date="a2"]').click()
    assert 'Prova precedente' in page.locator('#cdDocument').inner_text()
    page.locator('[data-cd-stage="final"]').click()
    assert page.locator('[role="tab"]').count() == 1
    page.screenshot(path=str(out/'desktop.png'), full_page=True)
    page.locator('[data-cd-page="lac"]').click()
    assert page.evaluate('calls.at(-1)') == ['page','lac']
    page.locator('.cdHeading [data-cd-page="schede"]').click()
    page.locator('[data-cd-stage="all"]').click()
    page.locator('[data-cd-date="a1"]').focus()
    page.keyboard.press('ArrowRight')
    assert page.locator('[data-cd-date="a2"]').get_attribute('aria-selected') == 'true'
    page.locator('[data-cd-edit]').click()
    assert page.evaluate('calls.at(-1)') == ['edit','a2']
    page.locator('[data-cd-new]').click()
    assert page.evaluate('calls.at(-1)') == ['new-lac']
    page.locator('[data-cd-type="eyewear"]').click()
    assert 'Nessuna scheda' in page.locator('#clientDossier').inner_text()
    page.locator('[data-cd-new]').click()
    assert page.evaluate('calls.at(-1)') == ['new-eyewear','quote','A']
    page.locator('[data-cd-type="lac"]').click()
    page.locator('[data-cd-date="a3"]').click()
    assert page.locator('#cdDocument img').count() == 0
    page.evaluate("clientCurrentId='B';OPTYKER_CLIENT_DOSSIER.render()")
    assert '15B26' not in page.locator('#clientDossier').inner_text()
    assert page.locator('[data-cd-type="lac"] small').inner_text() == '0'
    page.evaluate("clientCurrentId='A';OPTYKER_CLIENT_DOSSIER.render()")
    page.locator('[data-cd-type="lac"]').click()
    page.set_viewport_size({'width':390,'height':844})
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
    page.screenshot(path=str(out/'mobile.png'), full_page=True)
    page.evaluate("optykerAuthenticated=false;OPTYKER_CLIENT_DOSSIER.render()")
    assert page.locator('#clientDossier').is_hidden()
    assert page.locator('#clientDossier').inner_text() == ''
    assert not errors, errors
    result = {'browser':'chromium','checks':16,'page_errors':errors,'result':'passed','data':'synthetic only'}
    (out/'browser-result.json').write_text(json.dumps(result))
    print(json.dumps(result))
    browser.close()

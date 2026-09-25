"""Real production DOM and native event loop; synthetic accounts/data, no network.

Reproduce the original search freeze while the initial archive request is pending.
Assert typing, client navigation, empty/error handling and cross-session isolation.
"""
from pathlib import Path
from urllib.parse import urlsplit, unquote
from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright
import json, os, re

BASE=Path(__file__).resolve().parents[1]
SITE=BASE/'_site'
OUT=Path(os.environ.get('OPERATOR_TEST_OUTPUT','/tmp/operator-responsiveness'))
OUT.mkdir(exist_ok=True,parents=True)


def inline_build():
    html=BeautifulSoup((SITE/'index.html').read_text(),'html.parser');deferred=[]
    for tag in list(html.find_all('link',href=True)):
        asset=SITE/unquote(urlsplit(tag['href']).path).lstrip('/')
        if 'stylesheet' in tag.get('rel',[]) and asset.is_file():
            style=html.new_tag('style');style.string=asset.read_text();tag.replace_with(style)
    for tag in list(html.find_all('script',src=True)):
        asset=SITE/unquote(urlsplit(tag['src']).path).lstrip('/')
        if not asset.is_file() or tag.get('type')=='module':tag.decompose();continue
        del tag['src'];code=asset.read_text().replace('</script','<\\/script')
        code=code.replace('document.currentScript?.src||location.href',repr('https://offline.example.invalid/'+asset.name))
        tag.string=code
        if tag.has_attr('defer'):del tag['defer'];deferred.append(tag.extract())
    for tag in deferred:html.body.append(tag)
    return str(html)

INIT=r'''cfg=>{
 for(const prop of ['localStorage','sessionStorage']){const m=new Map();m.set('test-draft','DIEGO PANSIERI: testo da non modificare');Object.defineProperty(window,prop,{value:{getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k),key:i=>[...m.keys()][i]||null,get length(){return m.size}}});}
 window.__test={ticks:0,reads:0,pending:0,mutations:0,requests:[],cfg};
 setInterval(()=>__test.ticks++,50);
 new MutationObserver(ms=>__test.mutations+=ms.length).observe(document,{childList:true,subtree:true,characterData:true});
 window.fetch=(url,init={})=>{
   const path=new URL(String(url),'https://offline.example.invalid').pathname;
   let body={};try{body=JSON.parse(init.body||'{}')}catch{}
   const action=body.p_action||body.action||'';
   __test.requests.push({path,action});
   const reply=(data,status=200,delay=0)=>new Promise(resolve=>setTimeout(()=>resolve(new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}})),delay));
   if(path.endsWith('optyker-staff-auth')&&['login','status'].includes(action))return reply({ok:true,username:cfg.user,needs_password:false,has_email:false});
   if(path.endsWith('optyker_api')){
     if(action==='ping')return reply({ok:true});
     if(action==='list_clients'){
       __test.reads++;__test.pending++;
       const clients=cfg.mode==='empty'?[]:Array.from({length:1600},(_,i)=>({id:'aaaaaaaa-aaaa-4aaa-8aaa-'+String(i+1).padStart(12,'0'),name:'Cliente '+(i+1),surname:i?'Sintetico':'Dimostrativo',reference_no:(i+1)+'C'}));
       return reply(cfg.mode==='error'?{ok:false,error:'SYNTHETIC_READ_ERROR'}:{ok:true,data:clients},cfg.mode==='error'?503:200,1800).finally(()=>__test.pending--);
     }
     if(['list_sheets','list_consents'].includes(action))return reply({ok:true,data:[]});
   }
   if(path.endsWith('optyker_chat_api')&&action==='profile_get')return reply({ok:true,data:{username:cfg.user,email:'',photo_data:''}});
   return reply({ok:false,error:'SYNTHETIC_NO_REMOTE_ACCESS'},401);
 };
}'''

with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None,headless=True,args=['--no-sandbox'])
    html=inline_build();results=[]
    for user,mode in [('Diego Panseri','ok'),('MICHAEL MOLOGNI','ok'),('GIORGIA BONO','ok'),('Diego Pansieri','ok'),('Diego Panseri','empty'),('Diego Panseri','error')]:
        page=browser.new_page(viewport={'width':1180,'height':820},service_workers='block');page.set_default_timeout(6000)
        page.on('dialog',lambda d:d.dismiss());errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
        page.route('**/*',lambda r:r.abort())
        page.evaluate(INIT,{'user':user,'mode':mode});page.set_content(html,wait_until='domcontentloaded')
        page.wait_for_timeout(450)
        option=page.locator('#optykerLoginOperator option').evaluate_all('(a)=>a.map(o=>({value:o.value,text:o.text}))')
        choice=next(x['value'] for x in option if x['text'].lower().startswith(user.split()[0].lower()))
        page.locator('#optykerLoginOperator').select_option(choice)
        page.locator('#optykerAuthPassword').fill('DIEGO PANSIERI: SYNTHETIC PASSWORD')
        page.locator('.optykerLoginButton').click()
        page.wait_for_function('window.optykerAuthenticated===true&&__test.pending>0')
        start=page.evaluate('__test.ticks')
        search=page.locator('#optykerGlobalSearchInput')
        search.fill('Dim');search.press_sequentially('ostrativo',delay=10)
        assert page.evaluate('__test.pending')>0,'must exercise typing DURING initial loading'
        page.wait_for_timeout(300)
        assert search.input_value()=='Dimostrativo','search text erased'
        assert page.evaluate('document.activeElement.id')=='optykerGlobalSearchInput','search lost focus'
        assert page.evaluate('__test.ticks')-start>=3,'event loop starved during cloud load'
        assert page.evaluate('__test.reads')==1,'duplicate client archive request'
        page.wait_for_timeout(2100)
        assert page.evaluate('__test.reads')==1,'empty or failed archive causes retry loop'
        assert page.evaluate("localStorage.getItem('test-draft')")=='DIEGO PANSIERI: testo da non modificare','legacy renamer changed stored text'
        assert page.evaluate('OPTYKER_CLOUD.password')=='DIEGO PANSIERI: SYNTHETIC PASSWORD','password changed'
        if mode=='ok':
            row=page.locator('#optykerGlobalSearchResults .optykerGlobalSearchItem').filter(has_text='Dimostrativo').first
            row.click();page.wait_for_timeout(1100)
            assert page.locator('#clientDossier').is_visible(),'search result did not open client'
            assert page.evaluate('clientCurrentId')=='aaaaaaaa-aaaa-4aaa-8aaa-000000000001'
            page.locator('[data-cd-page="anagrafica"]').click()
            page.locator('#clientDbName').fill('Modifica Sintetica Non Salvata')
            page.wait_for_timeout(900)
            assert page.locator('#clientDbName').input_value()=='Modifica Sintetica Non Salvata'
            page.locator('#navDashboard').click();page.locator('#navClients').click();page.wait_for_timeout(300)
            assert page.locator('#clientDossier').is_visible()
            if user=='Diego Panseri':page.screenshot(path=str(OUT/'diego-ipad.png'),full_page=True)
        else:
            search.fill('seconda ricerca');page.wait_for_timeout(300)
            assert search.input_value()=='seconda ricerca'
            assert page.evaluate('__test.reads')==1,'retries should be bounded after failure/empty result'
            page.locator('#navClients').click();page.wait_for_timeout(250)
            assert page.locator('#clientsPanel').is_visible(),'client area navigation frozen without data'
        unexpected=[e for e in errors if not any(s in e for s in ('Sessione non autenticata','SYNTHETIC_NO_REMOTE_ACCESS','Failed to fetch','Server 401','Server 503'))]
        assert not unexpected,unexpected
        results.append({'account':user,'mode':mode,'archive_requests':page.evaluate('__test.reads'),'typing':True,'native_event_loop':True,'network':'blocked','data':'synthetic'})
        print(json.dumps(results[-1]),flush=True);page.close()
    # Isolated native loaders exercise out-of-order completion and absent-client selection.
    parsed=BeautifulSoup((SITE/'index.html').read_text(),'html.parser')
    core=next(s.get_text() for s in parsed.find_all('script') if 'var optykerClientLoadRequest=null;' in s.get_text())
    loader=core[core.index('var optykerClientLoadRequest=null;'):core.index('function cloudLoadSheets')]
    selection=core[core.index('var optykerClientSelectionSequence=0;'):core.index('clientDeleteCurrent=function')]
    page=browser.new_page();page.route('**/*',lambda r:r.abort());page.set_content('<input id="search">')
    page.evaluate('''()=>{window.optykerAuthenticated=true;window.clientCurrentId='';window.OPTYKER_CLOUD={username:'Diego Panseri',password:'SYNTHETIC',clients:[],sheets:{},consents:{}};window.waiting=[];window.statuses=[];window.clientRefreshList=window.dashboardRenderClients=window.clientApplyToCurrentPatient=window.clientShowView=()=>{};window.cloudSetStatus=s=>statuses.push(s);window.cloudDbToClient=c=>c;window.cloudApi=()=>new Promise((resolve,reject)=>waiting.push({resolve,reject}));window.cloudFindClient=id=>OPTYKER_CLOUD.clients.find(c=>c.id===id);window.cloudLoadSheets=window.cloudLoadConsents=()=>Promise.resolve([]);window.clientRenderVisits=window.clientRenderInformativeDocs=()=>{};window.clientFillForm=m=>window.clientCurrentId=m.id;}''')
    page.add_script_tag(content=loader+'\n'+selection)
    page.evaluate("()=>{window.first=cloudLoadClients();window.reused=first===cloudLoadClients();first.catch(()=>null);}")
    assert page.evaluate('waiting.length')==1
    assert page.evaluate('reused') is True
    page.evaluate("()=>{OPTYKER_CLOUD.username='GIORGIA BONO';OPTYKER_CLOUD.clients=[];window.second=cloudLoadClients();}")
    page.evaluate("waiting[1].resolve({data:[{id:'new',name:'Nuova sessione'}]})")
    page.evaluate("waiting[0].resolve({data:[{id:'old',name:'Sessione precedente'}]})")
    page.wait_for_timeout(100)
    assert page.evaluate('OPTYKER_CLOUD.clients[0].id')=='new','late old-session response contaminated current account'
    page.evaluate("()=>{window.missing=clientSelect('absent');}")
    page.evaluate("waiting[2].resolve({data:[]})")
    page.wait_for_timeout(150)
    assert page.evaluate('waiting.length')==3,'missing client recursively reloads indefinitely'
    assert page.evaluate("statuses.some(s=>s.includes('Cliente non trovato'))")
    results.append({'session_isolation':True,'missing_client_no_recursion':True})
    (OUT/'results.json').write_text(json.dumps(results,indent=2));page.close();browser.close()

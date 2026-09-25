"""Bound client reads and UI maintenance; never change authentication or fiscal data.

Patch native functions before they execute, preserving later navigation wrappers.
The same verified artifact is used by desktop, iPad and both legacy entry points.
"""
from pathlib import Path
import hashlib
import json
import re

VERSION = '20260925-responsive1'
MARK = 'OPTYKER_OPERATOR_RESPONSIVENESS_20260925'

LOAD_CLIENTS = r'''var optykerClientLoadRequest=null;
function cloudLoadClients(){
  var c=OPTYKER_CLOUD,user=c.username,password=c.password,clients=c.clients;
  if(!optykerAuthenticated||!user||!password)return Promise.reject(new Error('Sessione non autenticata'));
  var previous=optykerClientLoadRequest;
  if(previous&&previous.user===user&&previous.password===password&&previous.clients===clients)return previous.promise;
  var request={user:user,password:password,clients:clients,promise:null},timer;
  optykerClientLoadRequest=request;c.loadingClients=true;
  function current(){return optykerAuthenticated&&c.username===user&&c.password===password&&optykerClientLoadRequest===request;}
  cloudSetStatus('Sincronizzazione clienti in corso…',true);
  var timeout=new Promise(function(resolve,reject){timer=setTimeout(function(){reject(new Error('Caricamento clienti troppo lento. Riprova la sincronizzazione.'))},15000)});
  request.promise=Promise.race([Promise.resolve().then(function(){if(!current())throw new Error('Sessione cambiata: richiesta ignorata.');return cloudApi('list_clients',{})}),timeout]).then(function(x){
    if(!current())throw new Error('Sessione cambiata: risposta precedente ignorata.');
    if(!Array.isArray(x&&x.data))throw new Error('Risposta clienti non valida. Riprova la sincronizzazione.');
    c.clients=x.data.map(cloudDbToClient);
    cloudSetStatus('Cloud collegato · '+c.clients.length+' clienti sincronizzati',true);
    clientRefreshList();dashboardRenderClients();return c.clients;
  }).catch(function(e){if(current())cloudSetStatus('Clienti non disponibili: '+e.message,false);throw e;}).finally(function(){
    clearTimeout(timer);if(optykerClientLoadRequest===request){optykerClientLoadRequest=null;c.loadingClients=false;}
  });
  return request.promise;
}
'''

SELECT_CLIENT = r'''var optykerClientSelectionSequence=0;
clientSelect=function(id){
  var seq=++optykerClientSelectionSequence,c=OPTYKER_CLOUD,user=c.username,password=c.password;
  function current(){return optykerAuthenticated&&c.username===user&&c.password===password&&seq===optykerClientSelectionSequence;}
  function open(m){
    if(!current())return;
    if(!m){cloudSetStatus('Cliente non trovato nell’archivio aggiornato. Ripeti la ricerca.',false);return;}
    clientFillForm(m);clientApplyToCurrentPatient();clientRefreshList();clientShowView('edit');
    cloudLoadSheets(id).then(function(){if(current()&&clientCurrentId===id)clientRenderVisits(true);}).catch(function(e){if(current()&&clientCurrentId===id&&g('clientVisitList'))g('clientVisitList').innerHTML='<div class="clientEmpty">Errore caricamento schede: '+escapeHtml(e.message)+'</div>';});
    cloudLoadConsents(id).then(function(){if(current()&&clientCurrentId===id)clientRenderInformativeDocs(true);}).catch(function(e){if(current()&&clientCurrentId===id&&g('clientConsentList'))g('clientConsentList').innerHTML='<div class="clientEmpty">Errore caricamento informative: '+escapeHtml(e.message)+'</div>';});
  }
  if(!id||!current())return;
  var m=cloudFindClient(id);if(m){open(m);return;}
  return cloudLoadClients().then(function(){if(current())open(cloudFindClient(id));}).catch(function(e){if(current())cloudSetStatus('Impossibile aprire il cliente: '+e.message,false);});
};
'''

SEARCH_LOADS = r'''var searchLoadSession=null;
  function searchSession(){
    var c=window.OPTYKER_CLOUD||{},u=String(c.username||''),p=String(c.password||'');
    if(!searchLoadSession||searchLoadSession.user!==u||searchLoadSession.password!==p){
      searchLoadSession={user:u,password:p,clientsPending:false,clientsRetryAt:0,ordersRetryAt:0};
      ordersCache=[];ordersLoadedAt=0;ordersLoading=false;currentResults=[];activeIndex=-1;
    }
    return searchLoadSession;
  }
  function sessionCurrent(s){var c=window.OPTYKER_CLOUD||{};return window.optykerAuthenticated===true&&s===searchLoadSession&&c.username===s.user&&c.password===s.password;}
  function maybeLoadClients(){
    var s=searchSession(),c=window.OPTYKER_CLOUD;
    if(!sessionCurrent(s)||!s.user||!s.password||!c||Array.isArray(c.clients)&&c.clients.length||s.clientsPending||Date.now()<s.clientsRetryAt||typeof window.cloudLoadClients!=='function')return;
    s.clientsPending=true;s.clientsRetryAt=Date.now()+30000;
    Promise.resolve().then(function(){return window.cloudLoadClients()}).then(function(){
      s.clientsPending=false;s.clientsRetryAt=Date.now()+30000;
      if(sessionCurrent(s)&&byId('optykerGlobalSearchInput')?.value.trim())renderSearch();
    }).catch(function(){s.clientsPending=false;s.clientsRetryAt=Date.now()+5000;});
  }
  function maybeLoadOrders(){
    var s=searchSession();
    if(!sessionCurrent(s)||!s.user||!s.password||ordersLoading||Date.now()-ordersLoadedAt<300000||Date.now()<s.ordersRetryAt||typeof window.optykerShopifyApi!=='function')return;
    ordersLoading=true;s.ordersRetryAt=Date.now()+5000;
    Promise.resolve().then(function(){return window.optykerShopifyApi('list_orders',{})}).then(function(x){
      if(!sessionCurrent(s))return;
      ordersCache=Array.isArray(x&&x.data)?x.data:[];ordersLoadedAt=Date.now();ordersLoading=false;
      if(byId('optykerGlobalSearchInput')?.value.trim())renderSearch();
    }).catch(function(){if(sessionCurrent(s)){ordersLoading=false;s.ordersRetryAt=Date.now()+5000;}});
  }
'''

NAME_PRESENTATION = r'''/* Static and server-provided operator identities are preserved verbatim.
No runtime rewriting of passwords, storage, free text, input values or script nodes. */
window.OPTYKER_OPERATOR_NAME_VERSION='20260925-responsive1';
'''


def replace_once(text, old, new):
    if text.count(old) != 1:
        raise ValueError('Responsiveness: existing function contract changed: '+old[:90])
    return text.replace(old, new, 1)


def patch(text):
    if MARK in text:
        return text
    # Refuse partial or unexpected patches. No global replacement of application APIs.
    match=re.search(r'function cloudLoadClients\(\)\{[\s\S]*?\n\}(?=\nfunction cloudLoadSheets)',text)
    if not match or 'OPTYKER_CLOUD.loadingClients' not in match[0]:
        raise ValueError('Responsiveness: native client loader missing')
    text=replace_once(text,match[0],LOAD_CLIENTS.rstrip())
    match=re.search(r'clientSelect=function\(id\)\{[^\n]*\};(?=\nclientDeleteCurrent=)',text)
    if not match or 'clientSelect(id)' not in match[0]:
        raise ValueError('Responsiveness: native client selection missing')
    text=replace_once(text,match[0],SELECT_CLIENT.rstrip())
    for kind in ('Sheets','Consents'):
        line=re.search(r'function cloudLoad'+kind+r'\(clientId\)\{[^\n]*\}',text)
        if not line:raise ValueError('Responsiveness: client-scoped loader missing: '+kind)
        key=kind.lower()
        replacement='''function cloudLoad%s(clientId){
  if(!clientId)return Promise.resolve([]);
  var c=OPTYKER_CLOUD,user=c.username,password=c.password;
  return cloudApi('list_%s',{client_id:clientId}).then(function(x){
    if(!optykerAuthenticated||c.username!==user||c.password!==password)throw new Error('Sessione cambiata: risposta precedente ignorata.');
    c.%s[clientId]=x.data||[];return c.%s[clientId];
  });
}''' % (kind,key,key,key)
        text=replace_once(text,line[0],replacement)
    search=re.search(r'  function maybeLoadClients\(\)\{[^\n]*\}\n  function maybeLoadOrders\(\)\{[^\n]*\}',text)
    if not search:raise ValueError('Responsiveness: native search load functions missing')
    text=replace_once(text,search[0],SEARCH_LOADS.rstrip())
    # Reset cross-session search results before rendering cached orders.
    text=replace_once(text,'function renderSearch(){var input=', 'function renderSearch(){searchSession();var input=')
    legacy=re.search(r'(<script id="optykerDiegoPanseriFix">)[\s\S]*?(</script>)',text)
    if not legacy:raise ValueError('Responsiveness: legacy operator name adapter missing')
    text=replace_once(text,legacy[0],legacy[1]+NAME_PRESENTATION+legacy[2])
    # The old inline UI guard precedes and masks the updated external guard.
    # Keep all modal semantics; only avoid identical writes and repeated layout reads.
    guard=re.search(r'(<script id="optykerInteractionGuardInline">)([\s\S]*?)(</script>)',text)
    if not guard:raise ValueError('Responsiveness: inline interaction guard missing')
    old=guard[2]
    new=old.replace("document.documentElement.style.removeProperty('pointer-events');", "if(document.documentElement.style.getPropertyValue('pointer-events'))document.documentElement.style.removeProperty('pointer-events');")
    new=new.replace("if(document.body){document.body.style.removeProperty('pointer-events');document.body.removeAttribute('inert')}", "if(document.body){if(document.body.style.getPropertyValue('pointer-events'))document.body.style.removeProperty('pointer-events');if(document.body.hasAttribute('inert'))document.body.removeAttribute('inert')}")
    new=new.replace("el.style.setProperty('pointer-events','none','important');", "if(el.style.getPropertyValue('pointer-events')!=='none'||el.style.getPropertyPriority('pointer-events')!=='important')el.style.setProperty('pointer-events','none','important');")
    new=replace_once(new,'new MutationObserver(function(){neutralizeInvisibleBlockers()})', "var uiGuardQueued=false;\nfunction queueUiGuard(){if(uiGuardQueued||document.hidden)return;uiGuardQueued=true;setTimeout(function(){uiGuardQueued=false;if(!document.hidden)neutralizeInvisibleBlockers()},120)}\nnew MutationObserver(queueUiGuard)")
    text=replace_once(text,guard[0],guard[1]+new+guard[3])
    # The release marker is not an asynchronous runtime enhancer.
    text=replace_once(text,'window.OPTYKER_OPERATOR_NAME_VERSION=', '/* '+MARK+' */\nwindow.OPTYKER_OPERATOR_NAME_VERSION=')
    return text


def main(site=Path('_site')):
    index=site/'index.html'
    updated=patch(index.read_text(encoding='utf-8'))
    if patch(updated)!=updated:raise ValueError('Responsiveness: patch not idempotent')
    for rel in ('index.html','gestionale-v2/index.html','gestionale-v3/index.html'):
        (site/rel).write_text(updated,encoding='utf-8')
    digest=hashlib.sha256(Path(__file__).read_bytes()).hexdigest()
    (site/'operator-responsiveness-version.json').write_text(json.dumps({'version':VERSION,'patch_sha256':digest,'data_migration':False,'fiscal_changes':False})+'\n')
    print('Operator responsiveness installed:',VERSION,'(client reads and UI only)')


if __name__=='__main__':
    import sys
    main(Path(sys.argv[1]) if len(sys.argv)>1 else Path('_site'))

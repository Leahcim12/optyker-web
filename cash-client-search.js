/* OPTYKER_CASH_CLIENT_SEARCH_20260919: read-only lookup, native customer selection.
   Included inside the existing POS closure. No receipts, checkout or fiscal writes. */
window.OPTYKER_CASH_CLIENT_SEARCH_VERSION='20260919-clientsearch1';
var cashLookup={seq:0,timer:0,controller:null,query:'',rows:[],open:false,pending:false,error:'',limited:false};
function cashLookupNorm(v){return String(v==null?'':v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim()}
function cashLookupMatches(c,q){
  var text=cashLookupNorm([c.surname,c.name,c.phone,c.email,c.reference_no,c.reference_code,c.fiscal,c.vat].join(' '));
  return cashLookupNorm(q).split(' ').filter(Boolean).every(function(t){return text.indexOf(t)>=0});
}
function cashLookupMerge(){
  var byId=new Map();
  for(var i=0;i<arguments.length;i++)(arguments[i]||[]).forEach(function(c){if(c&&typeof c.id==='string'&&c.id)byId.set(c.id,Object.assign({},byId.get(c.id)||{},c))});
  return Array.from(byId.values()).sort(function(a,b){return clientLabel(a).localeCompare(clientLabel(b),'it')});
}
function cashLookupBlock(){
  if(S.busy)return 'Incasso o operazione in corso: attendi l’esito prima di cambiare cliente.';
  if(clientCartHasPending())return 'Incasso precedente da verificare: usa Recupera incasso prima di cambiare cliente.';
  if(S.clientCartLoading)return 'Carrello in caricamento. Puoi cercare; attendi prima di selezionare un altro cliente.';
  if(S.clientCartError)return String(S.clientCartError);
  return '';
}
function cashLookupUi(){
  var input=E('optykerCashClientSearch'),parent=input&&input.closest('.optykerCashClientBox');if(!parent)return;
  var label=parent.querySelector('label');if(label)label.htmlFor=input.id;
  input.setAttribute('aria-controls','optykerCashClientResults');input.setAttribute('aria-describedby','optykerCashClientSearchStatus');
  var select=E('optykerCashClient'),sl=parent.querySelector('.optykerCashClientSelectLabel');if(sl&&select)sl.htmlFor=select.id;
  var box=E('optykerCashClientResults');
  if(!box){
    box=document.createElement('section');box.id='optykerCashClientResults';box.setAttribute('aria-label','Risultati ricerca clienti');
    var status=document.createElement('div');status.id='optykerCashClientSearchStatus';status.setAttribute('role','status');status.setAttribute('aria-live','polite');
    var rows=document.createElement('div');rows.className='cashClientSearchRows';
    var actions=document.createElement('div');actions.className='cashClientSearchActions';
    box.append(status,rows,actions);parent.appendChild(box);
  }
  return box;
}
function cashLookupPick(id){
  var blocked=cashLookupBlock();if(blocked){toast(blocked,'error');cashLookupRender();return;}
  if(String(S.clientId||'')===String(id||'')){cashLookup.open=false;cashLookupRender();return;}
  var c=cashLookup.rows.find(function(x){return x.id===id}),sel=E('optykerCashClient');if(!c||!sel)return;
  var current=currentCashClient();S.clients=cashLookupMerge(S.clients,[c],current?[current]:[]);
  fillClients(S.clientId,S.clients);
  sel.value=id;
  // Run the native persistence and customer handlers exactly once, never checkout.
  sel.dispatchEvent(new Event('change',{bubbles:true}));
  cashLookup.open=false;cashLookupRender();
}
function cashLookupRender(){
  var box=cashLookupUi();if(!box)return;
  var input=E('optykerCashClientSearch'),blocked=cashLookupBlock();
  // Searching is read-only. Cart loading/errors must not disable typing.
  input.disabled=!!S.busy;input.setAttribute('aria-expanded',cashLookup.open?'true':'false');
  box.hidden=!cashLookup.open;if(box.hidden)return;
  var matches=cashLookup.rows.filter(function(c){return cashLookupMatches(c,cashLookup.query)}),shown=matches.slice(0,60);
  var text=cashLookup.pending?'Ricerca in corso…':cashLookup.error?'Ricerca online non completata. '+cashLookup.error:matches.length?matches.length+' clienti trovati. Seleziona il cliente nei risultati.':'Nessun cliente trovato. Prova cognome, telefono, email o ID.';
  if(cashLookup.pending&&matches.length)text+=' Risultati già disponibili qui sotto.';
  if(cashLookup.error&&matches.length)text+=' Sono mostrati solo i clienti già caricati.';
  if(matches.length>60||cashLookup.limited)text+=' Affina la ricerca per vedere tutti i risultati pertinenti.';
  if(blocked)text+=' '+blocked;
  var status=E('optykerCashClientSearchStatus');if(status.textContent!==text)status.textContent=text;
  var rows=box.querySelector('.cashClientSearchRows');
  // Avoid replacing focused result buttons when unrelated POS renders run.
  var key=JSON.stringify([shown.map(function(c){return [c.id,clientLabel(c),c.phone,c.email]}),!!blocked]);
  if(rows.dataset.key!==key){
    rows.dataset.key=key;rows.replaceChildren();
    shown.forEach(function(c){
      var b=document.createElement('button');b.type='button';b.dataset.cashClientId=c.id;b.className='cashClientSearchResult';b.disabled=!!blocked;
      var name=document.createElement('strong');name.textContent=clientLabel(c);
      var meta=document.createElement('span');meta.textContent=[c.phone,c.email].filter(Boolean).join(' · ');
      b.append(name,meta);b.onclick=function(){cashLookupPick(c.id)};
      b.onkeydown=function(e){if(e.key==='Escape'){cashLookup.open=false;cashLookupRender();input.focus()}};
      rows.appendChild(b);
    });
  }
  var actions=box.querySelector('.cashClientSearchActions'),actionKey=JSON.stringify([!!cashLookup.error,!!S.clientCartReadFailed,!!S.busy]);
  if(actions.dataset.key!==actionKey){
    actions.dataset.key=actionKey;actions.replaceChildren();
    if(cashLookup.error){var retry=document.createElement('button');retry.type='button';retry.id='optykerCashClientSearchRetry';retry.textContent='Riprova ricerca';retry.disabled=!!S.busy;retry.onclick=function(){searchCashClients(input.value)};actions.appendChild(retry)}
    if(S.clientCartReadFailed&&!S.busy&&!clientCartHasPending()){
      var reload=document.createElement('button');reload.type='button';reload.id='optykerCashClientCartRetry';reload.textContent='Riprova caricamento carrello';
      reload.onclick=function(){if(!S.busy&&!clientCartHasPending()&&S.clientCartReadFailed)clientCartLoad(String(S.clientId||''))};actions.appendChild(reload);
    }
  }
}
function cashLookupCancel(){
  ++cashLookup.seq;clearTimeout(cashLookup.timer);clearTimeout(S.clientSearchTimer);
  if(cashLookup.controller)cashLookup.controller.abort();cashLookup.controller=null;
}
function cashLookupRead(action,payload,control){
  if(action!=='clients'&&action!=='client_cart_get')return Promise.reject(new Error('Ricerca non consentita.'));
  var c=creds();if(!c.username||!c.password)return Promise.reject(new Error('Sessione operatore scaduta: accedi nuovamente.'));
  return fetch('https://whgziwaegjzqsgcntesr.supabase.co/functions/v1/optyker-cash-register-api-v2',{
    method:'POST',headers:{'Content-Type':'application/json'},cache:'no-store',signal:control.signal,
    body:JSON.stringify({action:action,username:c.username,password:c.password,payload:payload})
  }).then(function(r){return r.json().catch(function(){return null}).then(function(x){if(!r.ok||!x||x.ok!==true)throw new Error(r.status===401?'Sessione operatore scaduta: accedi nuovamente.':x&&x.error||'Risposta del server non valida.');return x})});
}
function cashLookupDeadline(task,ctl,message){
  var timer,deadline=new Promise(function(resolve,reject){timer=setTimeout(function(){ctl.abort();reject(new Error(message));},12000)});
  return Promise.race([task,deadline]).finally(function(){clearTimeout(timer)});
}
searchCashClients=function(q,keepId){
  cashLookupCancel();var seq=cashLookup.seq,clean=String(q||'').trim().slice(0,80),ctl=new AbortController();cashLookup.controller=ctl;
  cashLookup.query=clean;cashLookup.open=!!clean;cashLookup.pending=true;cashLookup.error='';cashLookup.limited=false;
  cashLookup.rows=cashLookupMerge(clientsLocal(),S.clients);cashLookupRender();
  // The existing server matches one field at a time. Query a meaningful token,
  // then match every token across name/surname/contact fields, in either order.
  var terms=clean.split(/\s+/).filter(Boolean),term=terms.length>1?terms.slice().sort(function(a,b){return b.length-a.length})[0]:clean;
  return cashLookupDeadline(cashLookupRead('clients',{search:term,selected_id:S.clientId||keepId||''},ctl),ctl,'Nessuna risposta entro 12 secondi. Riprova ricerca.').then(function(x){
    if(seq!==cashLookup.seq||!S.cashOpen)return;
    if(!Array.isArray(x.data)||x.data.some(function(c){return !c||typeof c.id!=='string'||!c.id}))throw new Error('Elenco clienti non valido.');
    var current=currentCashClient();cashLookup.pending=false;cashLookup.limited=x.data.length>=300;
    cashLookup.rows=cashLookupMerge(clientsLocal(),x.data).filter(function(c){return cashLookupMatches(c,clean)});
    S.clients=cashLookupMerge(cashLookup.rows,current?[current]:[]);
    fillClients(S.clientId,S.clients);updateInvoiceAvailability();updateTsAvailability();cashLookupRender();
  }).catch(function(e){
    if(seq!==cashLookup.seq||!S.cashOpen)return;
    cashLookup.pending=false;cashLookup.error=String(e&&e.message||e);cashLookupRender();
  }).finally(function(){if(cashLookup.controller===ctl)cashLookup.controller=null});
};
// Bound read-only cart loading: a failed lookup must not freeze the client field.
// Queued writes are still awaited and never cancelled, retried or forgotten.
clientCartLoad=function(id){
  id=String(id||'');if(S.busy)return Promise.resolve();
  var seq=++clientCartSeq;clearTimeout(clientCartSaveTimer);S.cart={};S.clientCartError='';S.clientCartReadFailed=false;S.clientCartLoading=!!id;renderCart();
  if(!id){clientCartLastId='';return Promise.resolve()}
  var ctl=new AbortController();
  var task=clientCartQueue.catch(function(){}).then(function(){
    if(ctl.signal.aborted||seq!==clientCartSeq||String(S.clientId||'')!==id)throw new Error('Caricamento superato.');
    return cashLookupRead('client_cart_get',{client_id:id},ctl);
  });
  return cashLookupDeadline(task,ctl,'Il caricamento del carrello non ha risposto entro 12 secondi.').then(function(x){
    if(seq!==clientCartSeq||String(S.clientId||'')!==id)return;
    if(!x.data||String(x.data.client_id)!==id||!Array.isArray(x.data.items))throw new Error('Risposta del carrello non coerente con il cliente.');
    clientCartVersions[id]=x.data.updated_at||null;S.clientCartLoading=false;clientCartApply(x.data.items,id);
  }).catch(function(e){
    if(seq!==clientCartSeq||String(S.clientId||'')!==id)return;
    S.clientCartLoading=false;S.clientCartReadFailed=true;S.clientCartError='Carrello non caricato: '+String(e&&e.message||e)+' Premi Riprova caricamento carrello.';toast(S.clientCartError,'error');renderCart();
  });
};
var cashLookupEnsureNative=ensureUI;
ensureUI=function(){
  var r=cashLookupEnsureNative.apply(this,arguments),input=E('optykerCashClientSearch');if(!input)return r;
  cashLookupUi();
  if(!input.dataset.clientSearchReady){
    input.dataset.clientSearchReady='1';
    input.oninput=function(){
      cashLookupCancel();cashLookup.query=this.value.trim().slice(0,80);cashLookup.open=!!cashLookup.query;cashLookup.pending=!!cashLookup.query;cashLookup.error='';
      cashLookup.rows=cashLookupMerge(clientsLocal(),S.clients);cashLookupRender();
      cashLookup.timer=setTimeout(function(){searchCashClients(input.value)},180);
    };
    input.onfocus=function(){if(this.value.trim()){cashLookup.open=true;cashLookupRender()}};
    input.onkeydown=function(e){
      if(e.key==='Escape'){cashLookup.open=false;cashLookupRender();e.preventDefault();e.stopPropagation()}
      if(e.key==='ArrowDown'){var b=E('optykerCashClientResults').querySelector('.cashClientSearchResult:not(:disabled)');if(b){b.focus();e.preventDefault()}}
      if(e.key==='Enter'){e.preventDefault();searchCashClients(input.value)}
    };
  }
  return r;
};
var cashLookupRenderNative=renderCart;renderCart=function(){var r=cashLookupRenderNative.apply(this,arguments);cashLookupRender();return r};
var cashLookupCloseNative=closeCash;closeCash=function(){var r=cashLookupCloseNative.apply(this,arguments);if(!S.cashOpen){cashLookupCancel();cashLookup.open=false;cashLookup.rows=[];cashLookupRender()}return r};

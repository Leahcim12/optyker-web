/* Optyker · DDT modificabili · 20261126-ddt-edit1
 * In Documenti › Documento di trasporto ogni DDT ha «Modifica» accanto a «Visualizza / Stampa»: apre il DDT con
 * destinatario, destinazione, causale, trasportatore, colli, peso, stato, articoli e note, e lo salva con
 * optyker-documents-api (azione update_ddt). Numero, autore e data di creazione del DDT restano quelli originali.
 * Usa la grafica della finestra «Nuovo DDT» (classi optykerDdt*), con campi e pulsanti propri. */
(function(){
  'use strict';
  if(window.__OPTYKER_DDT_EDIT_20261126__)return;
  window.__OPTYKER_DDT_EDIT_20261126__=true;
  var VERSION='20261126-ddt-edit1';
  var API='https://whgziwaegjzqsgcntesr.supabase.co/functions/v1/optyker-documents-api';
  var REASONS=['Vendita','Conto visione','Reso','Riparazione','Trasferimento','Altro'];
  var STATUSES=[['draft','Bozza'],['issued','Emesso']];
  var S={doc:null,clientId:'',companyId:'',companies:null,clients:[],timer:null,saving:false,lastFocus:null};

  function E(id){return document.getElementById(id)}
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
  function norm(v){return String(v==null?'':v).trim()}
  function creds(){var c=window.OPTYKER_CLOUD||{};return {username:String(c.username||window.OPTYKER_ACTIVE_USER||'').trim(),password:String(c.password||'')}}
  function api(action,payload){
    var c=creds();
    if(!c.username||!c.password)return Promise.reject(new Error('Sessione operatore non disponibile. Esci e accedi nuovamente.'));
    return fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:action,username:c.username,password:c.password,payload:payload||{}})})
      .then(function(r){return r.json().catch(function(){return {}}).then(function(x){if(!r.ok||!x||x.ok===false)throw new Error(x&&x.error||('HTTP '+r.status));return x})})
  }
  function toast(m,t){
    var x=E('optykerDdtToast');
    if(!x){x=document.createElement('div');x.id='optykerDdtToast';x.className='optykerDdtToast';x.setAttribute('role','status');document.body.appendChild(x)}
    x.className='optykerDdtToast '+(t||'');x.textContent=m;x.style.display='block';clearTimeout(x.__tm);x.__tm=setTimeout(function(){x.style.display='none'},4200)
  }
  function today(){var d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
  function dateIt(v){var m=/^(\d{4})-(\d{2})-(\d{2})/.exec(String(v||''));if(m&&String(v).length===10)return m[3]+'/'+m[2]+'/'+m[1];try{var d=new Date(v);if(isNaN(d.getTime()))return '';return d.toLocaleDateString('it-IT',{day:'2-digit',month:'2-digit',year:'numeric',timeZone:'Europe/Rome'})}catch(e){return ''}}
  function clientName(c){return [c&&c.surname,c&&c.name].filter(Boolean).join(' ').trim()}
  function clientAddress(c){return [[c&&c.street,c&&c.street_number].filter(Boolean).join(' '),[c&&c.postal_code,c&&c.city].filter(Boolean).join(' '),c&&c.province].filter(Boolean).join(' · ')}
  function selectHtml(list,value){
    var h='',found=false;
    list.forEach(function(o){var v=Array.isArray(o)?o[0]:o,l=Array.isArray(o)?o[1]:o;if(v===value)found=true;h+='<option value="'+esc(v)+'"'+(v===value?' selected':'')+'>'+esc(l)+'</option>'});
    if(value&&!found)h='<option value="'+esc(value)+'" selected>'+esc(value)+'</option>'+h;
    return h
  }

  function ensureStyle(){
    if(E('optykerDdtEditCss'))return;
    var st=document.createElement('style');st.id='optykerDdtEditCss';
    st.textContent='#optykerDdtPanel .optykerDocsTable td:last-child{white-space:nowrap}'+
      '#optykerDdtEditModal .optykerDdtCard{position:relative}'+
      '#optykerDdtEditModal .optykerDdtEditLinked{margin-top:5px;font-size:9px;font-weight:800;color:#2d7542}'+
      '#optykerDdtEditModal .optykerDdtEditLinked.none{color:#8b5e08}'+
      '#optykerDdtEditModal .optykerDdtBtn[disabled]{opacity:.55;cursor:default}';
    document.head.appendChild(st)
  }

  function addItem(data){
    var box=E('ddtEItems');if(!box)return;data=data||{};
    var r=document.createElement('div');r.className='optykerDdtItem';
    r.innerHTML='<div><label>Codice</label><input class="code" value="'+esc(data.code||'')+'" placeholder="Codice / SKU"></div>'+
      '<div class="desc"><label>Descrizione</label><input class="description" value="'+esc(data.description||'')+'" placeholder="Descrizione articolo"></div>'+
      '<div><label>Quantità</label><input class="quantity" type="number" min="0" step="1" value="'+esc(data.quantity==null||data.quantity===''?1:data.quantity)+'"></div>'+
      '<div><label>Unità</label><input class="unit" value="'+esc(data.unit||'pz')+'"></div>'+
      '<div class="lot"><label>Lotto</label><input class="lotValue" value="'+esc(data.lot||'')+'" placeholder="Lotto"></div>'+
      '<button class="optykerDdtRemove" type="button" title="Rimuovi articolo" aria-label="Rimuovi articolo">×</button>';
    r.querySelector('.optykerDdtRemove').onclick=function(){
      if(box.children.length>1)r.remove();
      else r.querySelectorAll('input').forEach(function(x){x.value=x.classList.contains('quantity')?'1':(x.classList.contains('unit')?'pz':'')})
    };
    box.appendChild(r);return r
  }
  function collectItems(){
    var a=[];
    E('ddtEItems').querySelectorAll('.optykerDdtItem').forEach(function(r){
      var d={code:r.querySelector('.code').value.trim(),description:r.querySelector('.description').value.trim(),quantity:Number(r.querySelector('.quantity').value||0),unit:r.querySelector('.unit').value.trim()||'pz',lot:r.querySelector('.lotValue').value.trim()};
      if(d.code||d.description)a.push(d)
    });
    return a
  }

  function ensureModal(){
    if(E('optykerDdtEditModal'))return E('optykerDdtEditModal');
    ensureStyle();
    var m=document.createElement('div');m.id='optykerDdtEditModal';m.className='optykerDdtModal';
    m.setAttribute('role','dialog');m.setAttribute('aria-modal','true');m.setAttribute('aria-labelledby','ddtETitle');
    m.innerHTML='<div class="optykerDdtCard"><div class="optykerDdtModalHead"><div><div class="optykerDdtModalTitle" id="ddtETitle">Modifica DDT</div><div class="optykerDdtModalSub" id="ddtESub"></div></div><button class="optykerDdtClose" id="ddtEClose" type="button" aria-label="Chiudi">×</button></div>'+
      '<div class="optykerDdtSection"><div class="optykerDdtSectionTitle">Destinatario e destinazione</div><div class="optykerDdtClientSearch">'+
        '<div class="optykerDdtField"><label for="ddtERecipientType">Tipo destinatario</label><select id="ddtERecipientType"><option value="client">Cliente</option><option value="company">Ditta</option><option value="manual">Manuale</option></select></div>'+
        '<div id="ddtEClientWrap" class="optykerDdtField optykerDdtSearchWrap"><label for="ddtEClientSearch">Cambia cliente</label><input id="ddtEClientSearch" type="search" autocomplete="off" placeholder="Nome, cognome, codice fiscale…"><div id="ddtEClientResults" class="optykerDdtSearchResults"></div><div id="ddtEClientLinked" class="optykerDdtEditLinked"></div></div>'+
        '<div id="ddtECompanyWrap" class="optykerDdtField" style="display:none"><label for="ddtECompany">Ditta</label><select id="ddtECompany"><option value="">Caricamento ditte…</option></select></div>'+
      '</div><div class="optykerDdtGrid" style="margin-top:9px">'+
        '<div class="optykerDdtField two"><label for="ddtECustomerName">Intestatario</label><input id="ddtECustomerName"></div>'+
        '<div class="optykerDdtField"><label for="ddtEVat">Partita IVA</label><input id="ddtEVat"></div>'+
        '<div class="optykerDdtField"><label for="ddtEFiscal">Codice fiscale</label><input id="ddtEFiscal"></div>'+
        '<div class="optykerDdtField full"><label for="ddtEDestination">Destinazione merce</label><input id="ddtEDestination" placeholder="Indirizzo completo di consegna"></div>'+
      '</div></div>'+
      '<div class="optykerDdtSection"><div class="optykerDdtSectionTitle">Dati DDT</div><div class="optykerDdtGrid">'+
        '<div class="optykerDdtField"><label for="ddtEDate">Data documento</label><input id="ddtEDate" type="date"></div>'+
        '<div class="optykerDdtField"><label for="ddtENumber">Numero</label><input id="ddtENumber" disabled></div>'+
        '<div class="optykerDdtField"><label for="ddtEReason">Causale</label><select id="ddtEReason"></select></div>'+
        '<div class="optykerDdtField"><label for="ddtEReasonDetail">Causa / descrizione</label><input id="ddtEReasonDetail" placeholder="Scrivi la causa"></div>'+
        '<div class="optykerDdtField"><label for="ddtEStatus">Stato</label><select id="ddtEStatus"></select></div>'+
        '<div class="optykerDdtField two"><label for="ddtECarrier">Trasportatore</label><input id="ddtECarrier" placeholder="Vettore / trasportatore"></div>'+
        '<div class="optykerDdtField"><label for="ddtEPackages">Colli</label><input id="ddtEPackages" type="number" min="1" step="1"></div>'+
        '<div class="optykerDdtField"><label for="ddtEWeight">Peso kg</label><input id="ddtEWeight" type="number" min="0" step="0.01"></div>'+
      '</div></div>'+
      '<div class="optykerDdtSection"><div class="optykerDdtSectionTitle">Articoli trasportati</div><div id="ddtEItems" class="optykerDdtItems"></div><button id="ddtEAddItem" class="optykerDdtAddItem" type="button">+ Aggiungi articolo</button></div>'+
      '<div class="optykerDdtSection"><div class="optykerDdtField full"><label for="ddtENotes">Note</label><textarea id="ddtENotes" placeholder="Annotazioni, istruzioni, riferimenti…"></textarea></div></div>'+
      '<div class="optykerDdtFooter"><div class="optykerDdtHint">Numero e data di creazione del DDT non cambiano.</div><div class="optykerDdtFooterRight"><button id="ddtECancel" class="optykerDdtBtn" type="button">Annulla</button><button id="ddtESavePrint" class="optykerDdtBtn" type="button">Salva e stampa</button><button id="ddtESave" class="optykerDdtBtn primary" type="button">Salva modifiche</button></div></div></div>';
    document.body.appendChild(m);
    E('ddtEClose').onclick=close;E('ddtECancel').onclick=close;
    E('ddtEAddItem').onclick=function(){var r=addItem({});if(r)try{r.querySelector('.code').focus()}catch(e){}};
    E('ddtERecipientType').onchange=function(){showRecipient(this.value)};
    E('ddtEClientSearch').oninput=function(){searchClients(this.value)};
    E('ddtECompany').onchange=function(){applyCompany(this.value)};
    E('ddtESave').onclick=function(){save(false)};
    E('ddtESavePrint').onclick=function(){save(true)};
    m.addEventListener('click',function(ev){if(ev.target===m)close()});
    m.addEventListener('keydown',function(ev){if(ev.key==='Escape'){ev.preventDefault();close()}});
    return m
  }

  function linkedNote(){
    var el=E('ddtEClientLinked');if(!el)return;
    if(S.clientId){el.className='optykerDdtEditLinked';el.textContent='Collegato al cliente: '+(norm(E('ddtECustomerName').value)||'in anagrafica')}
    else{el.className='optykerDdtEditLinked none';el.textContent='Nessun cliente collegato: cercalo qui sopra per collegarlo.'}
  }
  function showRecipient(type){
    E('ddtEClientWrap').style.display=type==='client'?'flex':'none';
    E('ddtECompanyWrap').style.display=type==='company'?'flex':'none';
    var box=E('ddtEClientResults');if(box)box.classList.remove('open');
    if(type==='company')loadCompanies();
    linkedNote()
  }
  function loadCompanies(){
    if(S.companies){fillCompanies();return Promise.resolve()}
    return api('list_companies',{}).then(function(x){S.companies=Array.isArray(x.data)?x.data:[];fillCompanies()})
      .catch(function(e){var s=E('ddtECompany');if(s)s.innerHTML='<option value="">Ditte non disponibili</option>';toast('Impossibile caricare le ditte: '+e.message,'error')})
  }
  function fillCompanies(){
    var s=E('ddtECompany');if(!s)return;
    var h='<option value="">Seleziona ditta</option>',found=false;
    (S.companies||[]).forEach(function(x){if(String(x.id)===String(S.companyId))found=true;h+='<option value="'+esc(x.id)+'">'+esc(String(x.name||'').trim()+(x.vat?' · P.IVA '+x.vat:'')+(x.fiscal_code?' · CF '+x.fiscal_code:''))+'</option>'});
    if(S.companyId&&!found)h+='<option value="'+esc(S.companyId)+'">'+esc((S.doc&&S.doc.customer_name)||'Ditta attuale')+' (attuale)</option>';
    s.innerHTML=h;s.value=S.companyId||''
  }
  function applyCompany(id){
    S.companyId=id||'';
    var x=(S.companies||[]).find(function(v){return String(v.id)===String(id)});if(!x)return;
    E('ddtECustomerName').value=x.name||'';E('ddtEVat').value=x.vat||'';E('ddtEFiscal').value=x.fiscal_code||'';if(x.address)E('ddtEDestination').value=x.address
  }
  function searchClients(q){
    q=norm(q);clearTimeout(S.timer);
    var box=E('ddtEClientResults');
    if(!q){if(box)box.classList.remove('open');return}
    S.timer=setTimeout(function(){
      api('list_clients',{search:q}).then(function(x){
        if(norm(E('ddtEClientSearch').value)!==q)return;
        S.clients=Array.isArray(x.data)?x.data:[];renderClients()
      }).catch(function(e){toast('Ricerca cliente non riuscita: '+e.message,'error')})
    },220)
  }
  function renderClients(){
    var box=E('ddtEClientResults');if(!box)return;
    if(!S.clients.length){box.innerHTML='<div class="optykerDdtSearchRow"><div class="optykerDdtSearchMeta">Nessun cliente trovato</div></div>';box.classList.add('open');return}
    box.innerHTML=S.clients.slice(0,30).map(function(c){return '<div class="optykerDdtSearchRow" role="button" tabindex="0" data-ddt-eclient="'+esc(c.id)+'"><div class="optykerDdtSearchName">'+esc(clientName(c)||'Cliente')+'</div><div class="optykerDdtSearchMeta">'+esc([c.reference_no,c.fiscal,c.vat,c.email,c.phone].filter(Boolean).join(' · '))+'</div></div>'}).join('');
    box.classList.add('open');
    box.querySelectorAll('[data-ddt-eclient]').forEach(function(row){
      function pick(){applyClient(row.getAttribute('data-ddt-eclient'))}
      row.onclick=pick;row.onkeydown=function(ev){if(ev.key==='Enter'||ev.key===' '){ev.preventDefault();pick()}}
    })
  }
  function applyClient(id){
    var c=S.clients.find(function(x){return String(x.id)===String(id)});if(!c)return;
    S.clientId=String(c.id);
    E('ddtECustomerName').value=clientName(c);E('ddtEVat').value=c.vat||'';E('ddtEFiscal').value=c.fiscal||'';
    var addr=clientAddress(c);if(addr)E('ddtEDestination').value=addr;
    E('ddtEClientSearch').value='';var box=E('ddtEClientResults');if(box)box.classList.remove('open');
    linkedNote()
  }

  function open(r){
    if(!r||!r.id){toast('DDT non disponibile: aggiorna l’elenco.','error');return}
    var m=ensureModal();S.doc=r;S.saving=false;S.clientId=r.client_id?String(r.client_id):'';S.companyId=r.company_id?String(r.company_id):'';S.clients=[];
    S.lastFocus=document.activeElement;
    var num=norm(r.document_number)||'Bozza';
    E('ddtETitle').textContent='Modifica DDT '+num;
    var sub=[];if(r.created_by)sub.push('Creato da '+r.created_by+(r.created_at?' il '+dateIt(r.created_at):''));else if(r.created_at)sub.push('Creato il '+dateIt(r.created_at));
    if(r.updated_at&&r.created_at&&String(r.updated_at).slice(0,16)!==String(r.created_at).slice(0,16))sub.push('ultima modifica il '+dateIt(r.updated_at));
    E('ddtESub').textContent=sub.join(' · ')||'Modifica i dati del documento di trasporto e salva.';
    var type=S.companyId?'company':(S.clientId?'client':'manual');
    E('ddtERecipientType').value=type;
    E('ddtEClientSearch').value='';
    E('ddtECustomerName').value=r.customer_name||'';
    E('ddtEVat').value=r.customer_vat||'';
    E('ddtEFiscal').value=r.customer_fiscal_code||'';
    E('ddtEDestination').value=r.destination||'';
    E('ddtEDate').value=/^\d{4}-\d{2}-\d{2}$/.test(String(r.document_date||''))?r.document_date:today();
    E('ddtENumber').value=num;
    E('ddtEReason').innerHTML=selectHtml(REASONS,norm(r.reason)||'Vendita');
    E('ddtEReasonDetail').value=r.reason_detail||'';
    E('ddtEStatus').innerHTML=selectHtml(STATUSES,norm(r.status)||'draft');
    E('ddtECarrier').value=r.carrier||'';
    E('ddtEPackages').value=r.packages==null||r.packages===''?1:r.packages;
    E('ddtEWeight').value=r.weight==null?'':r.weight;
    E('ddtENotes').value=r.notes||'';
    E('ddtEItems').innerHTML='';
    var items=Array.isArray(r.items)?r.items:[];
    if(items.length)items.forEach(function(x){addItem(x)});else addItem({});
    if(type==='company'){E('ddtECompany').innerHTML='<option value="'+esc(S.companyId)+'">'+esc(r.customer_name||'Ditta attuale')+'</option>';E('ddtECompany').value=S.companyId}
    showRecipient(type);
    setBusy(false);
    m.classList.add('open');
    try{m.querySelector('.optykerDdtCard').scrollTop=0;E('ddtECustomerName').focus()}catch(e){}
  }
  function close(){
    var m=E('optykerDdtEditModal');if(!m||S.saving)return;
    m.classList.remove('open');
    var box=E('ddtEClientResults');if(box)box.classList.remove('open');
    try{if(S.lastFocus&&document.body.contains(S.lastFocus))S.lastFocus.focus()}catch(e){}
  }
  function setBusy(on){
    S.saving=on;
    ['ddtESave','ddtESavePrint','ddtECancel','ddtEClose'].forEach(function(id){var b=E(id);if(b)b.disabled=on});
    var a=E('ddtESave');if(a)a.textContent=on?'Salvataggio…':'Salva modifiche'
  }
  function payload(){
    var type=E('ddtERecipientType').value;
    return {
      id:S.doc.id,
      client_id:type==='client'?S.clientId:'',
      company_id:type==='company'?(E('ddtECompany').value||''):'',
      customer_name:norm(E('ddtECustomerName').value),
      customer_vat:norm(E('ddtEVat').value),
      customer_fiscal_code:norm(E('ddtEFiscal').value),
      destination:norm(E('ddtEDestination').value),
      document_date:E('ddtEDate').value||today(),
      reason:E('ddtEReason').value,
      reason_detail:norm(E('ddtEReasonDetail').value),
      carrier:norm(E('ddtECarrier').value),
      packages:Number(E('ddtEPackages').value||1),
      weight:E('ddtEWeight').value,
      status:E('ddtEStatus').value,
      notes:norm(E('ddtENotes').value),
      items:collectItems()
    }
  }
  function save(doPrint){
    if(S.saving||!S.doc)return;
    var p=payload();
    if(!p.customer_name){toast('Inserisci il cliente o l’intestatario.','error');E('ddtECustomerName').focus();return}
    if(!p.destination){toast('Inserisci la destinazione della merce.','error');E('ddtEDestination').focus();return}
    if(!p.items.length){toast('Inserisci almeno un articolo.','error');return}
    setBusy(true);
    api('update_ddt',p).then(function(x){
      var saved=x.data||null;setBusy(false);close();
      toast('DDT '+((saved&&saved.document_number)||S.doc.document_number||'')+' aggiornato.','ok');
      try{if(typeof window.openOptykerDdt==='function')window.openOptykerDdt()}catch(e){}
      if(doPrint&&saved){if(typeof window.optykerViewDdt==='function')window.optykerViewDdt(saved);else toast('DDT salvato: aprilo dall’elenco per stamparlo.','ok')}
    }).catch(function(e){setBusy(false);toast('Modifica DDT non riuscita: '+e.message,'error')})
  }

  window.optykerEditDdt=open;
  window.OPTYKER_DDT_EDIT={version:VERSION,open:open};
})();

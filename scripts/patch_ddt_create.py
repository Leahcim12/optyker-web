from pathlib import Path

p=Path("_site/index.html")
s=p.read_text(encoding="utf-8")
MARK="OPTYKER_DDT_CREATE_V3"
if MARK in s:
    raise SystemExit(0)

css=r'''
<style id="optykerDdtCreateCss">
/* OPTYKER_DDT_CREATE_V3 */
.optykerDdtNewBtn{min-height:36px;border:1px solid #1769aa;border-radius:8px;background:#1769aa;color:#fff;padding:0 12px;font-size:9px;font-weight:950;cursor:pointer;margin-right:7px}
.optykerDdtNewBtn:hover{background:#135b93}
.optykerDdtHeadActions{display:flex;align-items:center;gap:7px}
.optykerDdtModal{position:fixed;z-index:260000;inset:0;background:rgba(12,34,51,.48);display:none;align-items:center;justify-content:center;padding:18px}
.optykerDdtModal.open{display:flex}
.optykerDdtCard{width:min(980px,96vw);max-height:92vh;overflow:auto;background:#fff;border:1px solid #d7e2ea;border-radius:15px;box-shadow:0 24px 70px rgba(16,42,62,.28);padding:18px}
.optykerDdtModalHead{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:14px}
.optykerDdtModalTitle{font-size:21px;font-weight:950;color:#17334b}
.optykerDdtModalSub{font-size:9px;color:#748797;margin-top:3px}
.optykerDdtClose{width:34px;height:34px;border:1px solid #d3dfe7;border-radius:8px;background:#fff;color:#536c80;font-size:18px;cursor:pointer}
.optykerDdtSection{border:1px solid #dce5ec;border-radius:11px;background:#fbfdfe;padding:12px;margin-top:10px}
.optykerDdtSectionTitle{font-size:10px;font-weight:950;color:#315168;margin-bottom:9px;text-transform:uppercase;letter-spacing:.05em}
.optykerDdtGrid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px}
.optykerDdtField{display:flex;flex-direction:column;gap:5px;min-width:0}
.optykerDdtField.two{grid-column:span 2}.optykerDdtField.full{grid-column:1/-1}
.optykerDdtField label{font-size:8px;font-weight:950;color:#718493;text-transform:uppercase;letter-spacing:.04em}
.optykerDdtField input,.optykerDdtField select,.optykerDdtField textarea{width:100%;box-sizing:border-box;border:1px solid #cbd8e2;border-radius:8px;background:#fff;color:#2b465d;font:750 10px/1.35 "Segoe UI",Arial,sans-serif;outline:none}
.optykerDdtField input,.optykerDdtField select{height:36px;padding:0 9px}.optykerDdtField textarea{min-height:68px;padding:9px;resize:vertical}
.optykerDdtField input:focus,.optykerDdtField select:focus,.optykerDdtField textarea:focus{border-color:#1769aa;box-shadow:0 0 0 2px rgba(23,105,170,.1)}
.optykerDdtClientSearch{display:grid;grid-template-columns:150px minmax(220px,1fr) minmax(280px,1.5fr);gap:8px}.optykerDdtSearchWrap{position:relative}.optykerDdtSearchResults{position:absolute;z-index:20;left:0;right:0;top:100%;margin-top:4px;display:none;max-height:240px;overflow:auto;border:1px solid #cbd9e3;border-radius:9px;background:#fff;box-shadow:0 12px 32px rgba(24,55,78,.16)}.optykerDdtSearchResults.open{display:block}.optykerDdtSearchRow{padding:9px 10px;border-bottom:1px solid #edf2f5;cursor:pointer}.optykerDdtSearchRow:last-child{border-bottom:0}.optykerDdtSearchRow:hover{background:#f2f8fc}.optykerDdtSearchName{font-size:10px;font-weight:900;color:#29475e}.optykerDdtSearchMeta{font-size:8px;color:#7a8d9c;margin-top:2px}
.optykerDdtItems{display:grid;gap:7px}
.optykerDdtItem{display:grid;grid-template-columns:120px minmax(220px,1fr) 90px 85px 120px 34px;gap:7px;align-items:end}
.optykerDdtItem input{height:34px;border:1px solid #ccd9e3;border-radius:7px;background:#fff;padding:0 8px;font-size:9px;font-weight:750;color:#2d485d;box-sizing:border-box;width:100%}
.optykerDdtItem label{display:block;font-size:7px;font-weight:950;color:#748797;margin-bottom:4px;text-transform:uppercase}
.optykerDdtRemove{height:34px;border:1px solid #e1c9c9;border-radius:7px;background:#fff8f8;color:#a53737;font-weight:950;cursor:pointer}
.optykerDdtAddItem{min-height:33px;border:1px solid #c9d8e2;border-radius:8px;background:#fff;color:#1769aa;padding:0 10px;font-size:8px;font-weight:900;cursor:pointer;margin-top:8px}
.optykerDdtFooter{display:flex;align-items:center;justify-content:space-between;gap:9px;margin-top:14px;padding-top:12px;border-top:1px solid #e1e8ed}
.optykerDdtFooterRight{display:flex;gap:7px}
.optykerDdtBtn{min-height:36px;border:1px solid #cad8e2;border-radius:8px;background:#fff;color:#1769aa;padding:0 11px;font-size:9px;font-weight:900;cursor:pointer}
.optykerDdtBtn.primary{background:#1769aa;border-color:#1769aa;color:#fff}.optykerDdtBtn.primary:hover{background:#135b93}
.optykerDdtHint{font-size:8px;color:#768999;line-height:1.4}
.optykerDdtToast{position:fixed;z-index:270000;right:20px;bottom:20px;max-width:420px;display:none;border-radius:10px;background:#17334b;color:#fff;padding:11px 13px;box-shadow:0 14px 36px rgba(18,42,63,.25);font-size:11px;font-weight:800}
.optykerDdtToast.ok{background:#25693b}.optykerDdtToast.error{background:#8f2f2f}
@media(max-width:850px){.optykerDdtGrid{grid-template-columns:1fr 1fr}.optykerDdtField.full{grid-column:1/-1}.optykerDdtItem{grid-template-columns:1fr 1fr 80px 75px}.optykerDdtItem .lot{grid-column:span 3}}
@media(max-width:620px){.optykerDdtGrid,.optykerDdtClientSearch{grid-template-columns:1fr}.optykerDdtField.two,.optykerDdtField.full{grid-column:auto}.optykerDdtItem{grid-template-columns:1fr 1fr}.optykerDdtItem .desc,.optykerDdtItem .lot{grid-column:1/-1}.optykerDdtFooter{flex-direction:column;align-items:stretch}.optykerDdtFooterRight{justify-content:flex-end}}
</style>
'''

js=r'''
<script id="optykerDdtCreateJs">
(function(){/* OPTYKER_DDT_CREATE_V3 */
  if(window.__optykerDdtCreateV1)return;window.__optykerDdtCreateV1=true;
  var API='https://whgziwaegjzqsgcntesr.supabase.co/functions/v1/optyker-documents-api';
  var D={clients:[],companies:[],selectedClient:null,selectedCompany:null,lastSaved:null,clientSearchTimer:null};
  function E(id){return document.getElementById(id)}
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
  function creds(){var c=window.OPTYKER_CLOUD||{};return {username:String(c.username||window.OPTYKER_ACTIVE_USER||'').trim(),password:String(c.password||'')}}
  function api(action,payload){var c=creds();if(!c.username||!c.password)return Promise.reject(new Error('Sessione operatore non disponibile. Esci e accedi nuovamente.'));return fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:action,username:c.username,password:c.password,payload:payload||{}})}).then(function(r){return r.json().catch(function(){return {}}).then(function(x){if(!r.ok||!x||x.ok===false)throw new Error(x&&x.error||('HTTP '+r.status));return x})})}
  function toast(m,t){var x=E('optykerDdtToast');if(!x){x=document.createElement('div');x.id='optykerDdtToast';x.className='optykerDdtToast';document.body.appendChild(x)}x.className='optykerDdtToast '+(t||'');x.textContent=m;x.style.display='block';clearTimeout(x.__tm);x.__tm=setTimeout(function(){x.style.display='none'},4200)}
  function today(){var d=new Date(),m=String(d.getMonth()+1).padStart(2,'0'),g=String(d.getDate()).padStart(2,'0');return d.getFullYear()+'-'+m+'-'+g}
  function clientName(c){return [c&&c.surname,c&&c.name].filter(Boolean).join(' ').trim()}
  function clientAddress(c){return [[c&&c.street,c&&c.street_number].filter(Boolean).join(' '),[c&&c.postal_code,c&&c.city].filter(Boolean).join(' '),c&&c.province].filter(Boolean).join(' · ')}
  function companyName(x){return String(x&&x.name||'').trim()}
  function companyOptions(rows){var h='<option value="">Seleziona ditta</option>';rows.forEach(function(x){h+='<option value="'+esc(x.id)+'">'+esc(companyName(x)+(x.vat?' · P.IVA '+x.vat:'')+(x.fiscal_code?' · CF '+x.fiscal_code:''))+'</option>'});return h}
  function populateCompanySelect(){var s=E('ddtCompanySelect');if(!s)return;var current=s.value;s.innerHTML=companyOptions(D.companies);if(current&&Array.prototype.some.call(s.options,function(o){return o.value===current}))s.value=current}
  function applyCompany(id){var x=D.companies.find(function(v){return String(v.id)===String(id)});D.selectedCompany=x||null;D.selectedClient=null;if(!x)return;E('ddtClientSelect').value='';E('ddtCustomerName').value=x.name||'';E('ddtVat').value=x.vat||'';E('ddtFiscal').value=x.fiscal_code||'';E('ddtDestination').value=x.address||''}
  function switchRecipientType(v){var isClient=v==='client',isCompany=v==='company';E('ddtClientSearchWrap').style.display=isClient?'flex':'none';E('ddtClientSelectWrap').style.display=isClient?'flex':'none';E('ddtCompanySelectWrap').style.display=isCompany?'flex':'none';if(v==='manual'){D.selectedClient=null;D.selectedCompany=null;E('ddtClientSelect').value='';E('ddtCompanySelect').value=''}}
  function clientOptions(rows){var h='<option value="">Intestatario manuale / nessun cliente</option>';rows.forEach(function(c){h+='<option value="'+esc(c.id)+'">'+esc(clientName(c)+(c.reference_no?' · '+c.reference_no:'')+(c.fiscal?' · '+c.fiscal:''))+'</option>'});return h}
  function filterClients(q){q=String(q||'').trim().toLowerCase();if(!q)return D.clients;return D.clients.filter(function(c){return [c.name,c.surname,c.fiscal,c.vat,c.reference_no,c.email,c.phone].join(' ').toLowerCase().indexOf(q)>=0})}
  function populateClientSelect(q){var s=E('ddtClientSelect');if(!s)return;var current=s.value;s.innerHTML=clientOptions(filterClients(q));if(current&&Array.prototype.some.call(s.options,function(o){return o.value===current}))s.value=current}
  function renderClientSearchResults(rows){
    var box=E('ddtClientSearchResults');if(!box)return;
    if(!rows||!rows.length){box.innerHTML='<div class="optykerDdtSearchRow"><div class="optykerDdtSearchMeta">Nessun cliente trovato</div></div>';box.classList.add('open');return}
    box.innerHTML=rows.slice(0,30).map(function(c){return '<div class="optykerDdtSearchRow" data-ddt-client="'+esc(c.id)+'"><div class="optykerDdtSearchName">'+esc(clientName(c)||'Cliente')+'</div><div class="optykerDdtSearchMeta">'+esc([c.reference_no,c.fiscal,c.vat,c.email,c.phone].filter(Boolean).join(' · '))+'</div></div>'}).join('');
    box.classList.add('open');
    box.querySelectorAll('[data-ddt-client]').forEach(function(r){r.onclick=function(){var id=this.getAttribute('data-ddt-client');E('ddtClientSelect').value=id;applyClient(id);var c=D.clients.find(function(x){return String(x.id)===String(id)});E('ddtClientSearch').value=c?clientName(c):'';box.classList.remove('open')}})
  }
  function searchClientsBar(q){
    q=String(q||'').trim();
    clearTimeout(D.clientSearchTimer);
    D.clientSearchTimer=setTimeout(function(){
      api('list_clients',{search:q}).then(function(x){
        D.clients=Array.isArray(x.data)?x.data:[];
        populateClientSelect(q);
        renderClientSearchResults(D.clients)
      }).catch(function(e){toast('Ricerca cliente non riuscita: '+e.message,'error')})
    },220)
  }
  function applyClient(id){var c=D.clients.find(function(x){return String(x.id)===String(id)});D.selectedClient=c||null;D.selectedCompany=null;if(!c)return;E('ddtCompanySelect').value='';E('ddtCustomerName').value=clientName(c);E('ddtVat').value=c.vat||'';E('ddtFiscal').value=c.fiscal||'';E('ddtDestination').value=clientAddress(c);var rb=E('ddtClientSearchResults');if(rb)rb.classList.remove('open')}
  function addItem(data){var box=E('ddtItems');if(!box)return;var r=document.createElement('div');r.className='optykerDdtItem';data=data||{};r.innerHTML='<div><label>Codice</label><input class="code" value="'+esc(data.code||'')+'" placeholder="Codice / SKU"></div><div class="desc"><label>Descrizione</label><input class="description" value="'+esc(data.description||'')+'" placeholder="Descrizione articolo"></div><div><label>Quantità</label><input class="quantity" type="number" min="0" step="1" value="'+esc(data.quantity==null?1:data.quantity)+'"></div><div><label>Unità</label><input class="unit" value="'+esc(data.unit||'pz')+'"></div><div class="lot"><label>Lotto</label><input class="lotValue" value="'+esc(data.lot||'')+'" placeholder="Lotto"></div><button class="optykerDdtRemove" type="button" title="Rimuovi">×</button>';r.querySelector('.optykerDdtRemove').onclick=function(){if(box.children.length>1)r.remove();else{r.querySelectorAll('input').forEach(function(x){x.value=x.classList.contains('quantity')?'1':(x.classList.contains('unit')?'pz':'')})}};box.appendChild(r)}
  function collectItems(){var a=[];E('ddtItems').querySelectorAll('.optykerDdtItem').forEach(function(r){var d={code:r.querySelector('.code').value.trim(),description:r.querySelector('.description').value.trim(),quantity:Number(r.querySelector('.quantity').value||0),unit:r.querySelector('.unit').value.trim()||'pz',lot:r.querySelector('.lotValue').value.trim()};if(d.code||d.description)a.push(d)});return a}
  function ensureModal(){
    if(E('optykerDdtCreateModal'))return;
    var m=document.createElement('div');m.id='optykerDdtCreateModal';m.className='optykerDdtModal';
    m.innerHTML='<div class="optykerDdtCard"><div class="optykerDdtModalHead"><div><div class="optykerDdtModalTitle">Nuovo documento di trasporto</div><div class="optykerDdtModalSub">Crea un DDT, collegalo a un cliente e aggiungi gli articoli trasportati.</div></div><button class="optykerDdtClose" type="button">×</button></div>'+
      '<div class="optykerDdtSection"><div class="optykerDdtSectionTitle">Destinatario e destinazione</div><div class="optykerDdtClientSearch"><div class="optykerDdtField"><label>Tipo destinatario</label><select id="ddtRecipientType"><option value="client">Cliente</option><option value="company">Ditta</option><option value="manual">Manuale</option></select></div><div id="ddtClientSearchWrap" class="optykerDdtField optykerDdtSearchWrap"><label>Cerca cliente</label><input id="ddtClientSearch" type="search" autocomplete="off" placeholder="Nome, cognome, codice fiscale, telefono…"><div id="ddtClientSearchResults" class="optykerDdtSearchResults"></div></div><div id="ddtClientSelectWrap" class="optykerDdtField"><label>Cliente</label><select id="ddtClientSelect"><option>Caricamento clienti…</option></select></div><div id="ddtCompanySelectWrap" class="optykerDdtField" style="display:none"><label>Ditta</label><select id="ddtCompanySelect"><option>Caricamento ditte…</option></select></div></div><div class="optykerDdtGrid" style="margin-top:9px"><div class="optykerDdtField two"><label>Intestatario</label><input id="ddtCustomerName"></div><div class="optykerDdtField"><label>Partita IVA</label><input id="ddtVat"></div><div class="optykerDdtField"><label>Codice fiscale</label><input id="ddtFiscal"></div><div class="optykerDdtField full"><label>Destinazione merce</label><input id="ddtDestination" placeholder="Indirizzo completo di consegna"></div></div></div>'+
      '<div class="optykerDdtSection"><div class="optykerDdtSectionTitle">Dati DDT</div><div class="optykerDdtGrid"><div class="optykerDdtField"><label>Data documento</label><input id="ddtDate" type="date"></div><div class="optykerDdtField"><label>Numero</label><input value="Generato automaticamente" disabled></div><div class="optykerDdtField"><label>Causale</label><select id="ddtReason"><option value="Vendita">Vendita</option><option value="Conto visione">Conto visione</option><option value="Reso">Reso</option><option value="Riparazione">Riparazione</option><option value="Trasferimento">Trasferimento</option><option value="Altro">Altro</option></select></div><div class="optykerDdtField"><label>Causa / descrizione</label><input id="ddtReasonDetail" placeholder="Scrivi la causa"></div><div class="optykerDdtField"><label>Stato</label><select id="ddtStatus"><option value="draft">Bozza</option><option value="issued">Emesso</option></select></div><div class="optykerDdtField two"><label>Trasportatore</label><input id="ddtCarrier" placeholder="Vettore / trasportatore"></div><div class="optykerDdtField"><label>Colli</label><input id="ddtPackages" type="number" min="1" step="1" value="1"></div><div class="optykerDdtField"><label>Peso kg</label><input id="ddtWeight" type="number" min="0" step="0.01"></div></div></div>'+
      '<div class="optykerDdtSection"><div class="optykerDdtSectionTitle">Articoli trasportati</div><div id="ddtItems" class="optykerDdtItems"></div><button id="ddtAddItem" class="optykerDdtAddItem" type="button">+ Aggiungi articolo</button></div>'+
      '<div class="optykerDdtSection"><div class="optykerDdtField full"><label>Note</label><textarea id="ddtNotes" placeholder="Annotazioni, istruzioni, riferimenti…"></textarea></div></div>'+
      '<div class="optykerDdtFooter"><div class="optykerDdtHint">Il numero DDT viene assegnato automaticamente al salvataggio.</div><div class="optykerDdtFooterRight"><button id="ddtCancel" class="optykerDdtBtn" type="button">Annulla</button><button id="ddtSavePrint" class="optykerDdtBtn" type="button">Salva e stampa</button><button id="ddtSave" class="optykerDdtBtn primary" type="button">Salva DDT</button></div></div></div>';
    document.body.appendChild(m);
    m.querySelector('.optykerDdtClose').onclick=closeModal;E('ddtCancel').onclick=closeModal;E('ddtAddItem').onclick=function(){addItem({})};E('ddtRecipientType').onchange=function(){switchRecipientType(this.value)};E('ddtClientSearch').oninput=function(){searchClientsBar(this.value)};E('ddtClientSearch').onfocus=function(){if(this.value.trim())searchClientsBar(this.value)};E('ddtClientSelect').onchange=function(){applyClient(this.value);var c=D.clients.find(function(x){return String(x.id)===String(E('ddtClientSelect').value)});if(c)E('ddtClientSearch').value=clientName(c)};E('ddtCompanySelect').onchange=function(){applyCompany(this.value)};E('ddtSave').onclick=function(){save(false)};E('ddtSavePrint').onclick=function(){save(true)};m.onclick=function(ev){if(ev.target===m)closeModal()}
  }
  function resetForm(){D.selectedClient=null;D.selectedCompany=null;E('ddtRecipientType').value='client';switchRecipientType('client');E('ddtDate').value=today();E('ddtCustomerName').value='';E('ddtVat').value='';E('ddtFiscal').value='';E('ddtDestination').value='';E('ddtReason').value='Vendita';E('ddtReasonDetail').value='';E('ddtStatus').value='draft';E('ddtCarrier').value='';E('ddtPackages').value='1';E('ddtWeight').value='';E('ddtNotes').value='';E('ddtClientSearch').value='';if(E('ddtClientSearchResults')){E('ddtClientSearchResults').innerHTML='';E('ddtClientSearchResults').classList.remove('open')}E('ddtItems').innerHTML='';addItem({});populateClientSelect('');populateCompanySelect()}
  function openModal(){ensureModal();resetForm();E('optykerDdtCreateModal').classList.add('open');loadRecipients()}
  function closeModal(){var m=E('optykerDdtCreateModal');if(m)m.classList.remove('open')}
  function loadRecipients(){Promise.all([api('list_clients',{}),api('list_companies',{})]).then(function(all){D.clients=Array.isArray(all[0].data)?all[0].data:[];D.companies=Array.isArray(all[1].data)?all[1].data:[];populateClientSelect('');populateCompanySelect()}).catch(function(e){toast('Impossibile caricare clienti e ditte: '+e.message,'error')})}
  function payload(){return {client_id:D.selectedClient&&D.selectedClient.id||'',company_id:D.selectedCompany&&D.selectedCompany.id||'',customer_name:E('ddtCustomerName').value.trim(),customer_vat:E('ddtVat').value.trim(),customer_fiscal_code:E('ddtFiscal').value.trim(),destination:E('ddtDestination').value.trim(),document_date:E('ddtDate').value||today(),reason:E('ddtReason').value,reason_detail:E('ddtReasonDetail').value.trim(),carrier:E('ddtCarrier').value.trim(),packages:Number(E('ddtPackages').value||1),weight:E('ddtWeight').value,status:E('ddtStatus').value,notes:E('ddtNotes').value.trim(),items:collectItems()}}
  function save(doPrint){var p=payload();if(!p.customer_name){toast('Inserisci il cliente o l’intestatario.','error');return}if(!p.destination){toast('Inserisci la destinazione della merce.','error');return}if(!p.items.length){toast('Inserisci almeno un articolo.','error');return}var a=E('ddtSave'),b=E('ddtSavePrint');a.disabled=true;b.disabled=true;a.textContent='Salvataggio…';api('create_ddt',p).then(function(x){D.lastSaved=x.data;toast('DDT '+(x.data&&x.data.document_number||'')+' creato correttamente.','ok');closeModal();if(window.openOptykerDdt)window.openOptykerDdt();if(doPrint)printDdt(x.data)}).catch(function(e){toast('Creazione DDT non riuscita: '+e.message,'error')}).finally(function(){a.disabled=false;b.disabled=false;a.textContent='Salva DDT'})}
  function printDdt(r){if(!r)return;var w=window.open('','_blank','width=900,height=720');if(!w){toast('Il browser ha bloccato la finestra di stampa.','error');return}var items=Array.isArray(r.items)?r.items:[],rows=items.map(function(x){return '<tr><td>'+esc(x.code||'')+'</td><td>'+esc(x.description||'')+'</td><td style="text-align:right">'+esc(x.quantity||'')+'</td><td>'+esc(x.unit||'')+'</td><td>'+esc(x.lot||'')+'</td></tr>'}).join('');var html='<!doctype html><html><head><meta charset="utf-8"><title>'+esc(r.document_number||'DDT')+'</title><style>@page{size:A4;margin:12mm}body{font-family:Arial,sans-serif;color:#1d3448;font-size:11px}.head{display:flex;justify-content:space-between;border-bottom:2px solid #17334b;padding-bottom:10px}.brand{font-size:20px;font-weight:800}.muted{color:#718493;font-size:9px}.num{text-align:right;font-size:14px;font-weight:800}.box{border:1px solid #cfdbe4;border-radius:7px;padding:10px;margin-top:10px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}table{width:100%;border-collapse:collapse;margin-top:10px}th{background:#eef3f7;text-align:left;font-size:9px;padding:7px;border:1px solid #dbe4ea}td{padding:8px;border:1px solid #e0e7ec}.sign{display:grid;grid-template-columns:1fr 1fr;gap:30px;margin-top:35px}.line{border-top:1px solid #7c8d99;padding-top:5px;text-align:center;color:#718493}</style></head><body><div class="head"><div><div class="brand">Ottica Visual Care</div><div class="muted">Documento di trasporto</div></div><div class="num">'+esc(r.document_number||'')+'<div class="muted">Data '+esc(r.document_date||'')+'</div></div></div><div class="grid"><div class="box"><b>Destinatario</b><br>'+esc(r.customer_name||'')+'<br><span class="muted">'+esc([r.customer_vat?('P.IVA '+r.customer_vat):'',r.customer_fiscal_code?('CF '+r.customer_fiscal_code):''].filter(Boolean).join(' · '))+'</span></div><div class="box"><b>Destinazione merce</b><br>'+esc(r.destination||'')+'</div></div><div class="grid"><div class="box"><b>Causale:</b> '+esc(r.reason||'')+(r.reason_detail?' · '+esc(r.reason_detail):'')+'<br><b>Trasportatore:</b> '+esc(r.carrier||'—')+'</div><div class="box"><b>Colli:</b> '+esc(r.packages||1)+'<br><b>Peso:</b> '+esc(r.weight==null?'—':r.weight+' kg')+'</div></div><table><thead><tr><th>Codice</th><th>Descrizione</th><th>Q.tà</th><th>U.M.</th><th>Lotto</th></tr></thead><tbody>'+rows+'</tbody></table>'+(r.notes?'<div class="box"><b>Note</b><br>'+esc(r.notes)+'</div>':'')+'<div class="sign"><div class="line">Firma cedente</div><div class="line">Firma destinatario / vettore</div></div><script>window.onload=function(){setTimeout(function(){window.print()},180)}<\/script></body></html>';w.document.open();w.document.write(html);w.document.close()}
  function install(){var p=E('optykerDdtPanel');if(!p)return;var head=p.querySelector('.optykerDocsHead');if(!head||E('optykerDdtNewBtn'))return;var refresh=head.querySelector('.optykerDocsRefresh');var wrap=document.createElement('div');wrap.className='optykerDdtHeadActions';var b=document.createElement('button');b.id='optykerDdtNewBtn';b.className='optykerDdtNewBtn';b.type='button';b.textContent='+ Nuovo DDT';b.onclick=openModal;if(refresh){refresh.parentNode.insertBefore(wrap,refresh);wrap.appendChild(b);wrap.appendChild(refresh)}else{wrap.appendChild(b);head.appendChild(wrap)}}
  window.openOptykerNewDdt=openModal;
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setTimeout(install,200)});else setTimeout(install,200);
  setInterval(install,700);
})();
</script>
'''

pos=s.lower().rfind("</body>")
if pos<0:
    raise SystemExit("Tag </body> non trovato")
s=s[:pos]+css+js+s[pos:]
p.write_text(s,encoding="utf-8")
for req in [MARK,'optykerDdtNewBtn','Nuovo documento di trasporto','ddtCompanySelect','ddtReasonDetail','ddtClientSearchResults','create_ddt','Salva e stampa']:
    if req not in s:
        raise SystemExit("Patch creazione DDT incompleta: "+req)
print("DDT create UI OK")

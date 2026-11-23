(function () {
  'use strict';
  if (window.OPTYKER_TS_CONNECTION) return;
  var API = 'https://whgziwaegjzqsgcntesr.supabase.co/functions/v1/optyker-ts-api';
  var current = null;
  function checkLabel(code) { return {TS_VERIFIED:'Collegamento verificato',TS_AUTH_FAILED:'Credenziali non accettate dal Sistema TS',TS_CONNECTION_FAILED:'Sistema TS non raggiungibile',TS_CERTIFICATE_EXPIRED:'Certificato TS da aggiornare'}[code] || code; }
  function esc(value) { return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  async function request(body, file) {
    var token = sessionStorage.getItem('optyker_billing_admin_token');
    if (!window.OPTYKER_BILLING_ADMIN || !token) throw new Error('Accedi come Amministrazione per configurare il Sistema TS.');
    var headers = {Authorization:'Bearer ' + token};
    if (file) { headers['Content-Type'] = 'application/octet-stream'; headers['x-ts-filename'] = encodeURIComponent(file.name); }
    else headers['Content-Type'] = 'application/json';
    var controller = new AbortController(), timer = setTimeout(function () { controller.abort(); }, file ? 60000 : 25000);
    try {
      var response = await fetch(API + (file ? '?action=upload' : ''), {method:'POST',headers:headers,body:file || JSON.stringify(body),signal:controller.signal});
      var data = await response.json().catch(function () { return {}; });
      if (!response.ok || !data.ok) throw new Error(data.error || 'Operazione non completata. Chiudi e riapri Sistema TS per verificare lo stato.');
      return data;
    } catch (e) {
      if (e.name === 'AbortError') throw new Error('Risposta non ricevuta. Aggiorna lo stato e verifica l’esito prima di ripetere un invio.');
      throw e;
    } finally { clearTimeout(timer); }
  }
  function close() {
    if (!current) return;
    var item = current; current = null;
    item.node.querySelectorAll('input[type=password]').forEach(function (input) { input.value = ''; });
    item.node.remove(); document.removeEventListener('keydown', item.keys);
    if (item.previous && item.previous.isConnected) item.previous.focus();
  }
  function field(id, label, value, attrs) {
    return '<label for="' + id + '">' + label + '<input id="' + id + '" name="' + id + '" value="' + esc(value) + '" ' + (attrs || '') + '></label>';
  }
  function queueHtml(rows, ready) {
    var labels={awaiting_configuration:'Da inviare',sending:'Invio in corso',submitted:'Protocollo ricevuto · verifica esito',uncertain:'Esito da verificare',ts_cancelled:'Spesa cancellata dal TS · annullo RCH da eseguire',accepted:'Accettato dal Sistema TS',rejected:'Scartato dal Sistema TS',held_for_void:'Sospeso per annullo RCH',voided:'Annullato · escluso dagli invii'};
    return '<section><h3>Spese da scontrini RCH</h3><p>I nuovi scontrini con righe TS vengono trasmessi dopo la conferma di numero e data. I documenti già in coda si inviano singolarmente da qui.</p>' +
      (!rows.length?'<p>Nessun documento in coda.</p>':'<div class="otsTable"><table><thead><tr><th>Documento</th><th>Importo TS</th><th>Esito</th><th>Azioni</th></tr></thead><tbody>'+rows.map(function(r){
        var button=function(action,label){return '<button type="button" data-ts-action="'+action+'" data-ts-id="'+esc(r.id)+'" data-ts-number="'+esc(r.number)+'">'+label+'</button>';};
        return '<tr><td>'+esc(r.number)+'<br><small>'+esc(r.date)+(r.opposition?' · opposizione':'')+'</small></td><td>'+esc((r.total_cents/100).toLocaleString('it-IT',{style:'currency',currency:'EUR'}))+'</td><td>'+esc(labels[r.state]||r.state)+(r.protocol?'<br><small>Protocollo '+esc(r.protocol)+'</small>':'')+(r.code?'<br><small>'+esc(r.code)+'</small>':'')+'</td><td>'+(ready&&r.state==='awaiting_configuration'&&!r.attempted?button('send','Invia al TS'):'')+(['sending','submitted','uncertain'].includes(r.state)?button('reconcile','Verifica esito'):'')+(r.protocol?button('receipt','Ricevuta'):'')+'</td></tr>';
      }).join('')+'</tbody></table></div>')+'</section>';
  }
  function render(item, result, notice) {
    if (current !== item) return;
    var config = result.config, files = result.files || [];
    var ready=result.transport_ready===true;
    item.body.innerHTML = '<p class="otsStatus'+(ready?' otsReady':'')+'"><strong>'+(ready?'Invii TS attivi':'Invio TS da attivare')+'</strong><br>'+(ready?'Invio automatico dei nuovi documenti RCH confermati. Ogni spesa conserva protocollo ed esito.':'Le credenziali salvate devono superare la verifica del collegamento prima di trasmettere.')+'</p>'+
      '<div class="otsActions"><button type="button" id="otsVerify" class="otsPrimary">Verifica collegamento e attiva invii</button>'+(ready?'<button type="button" id="otsPause">Sospendi invii automatici</button>':'')+'<button type="button" id="otsRefresh">Aggiorna stato</button></div>'+
      (config.last_check_code?'<p class="otsHelp">Ultima verifica: '+esc(checkLabel(config.last_check_code))+'</p>':'')+
      '<form id="otsForm"><h3>Credenziali Sistema TS</h3><div class="otsGrid">' +
      field('otsUsername','Codice identificativo',config.username,'required maxlength="64" autocomplete="username"') +
      field('otsOwner','Codice proprietario / Ufficio TS',config.owner_code,'required pattern="[0-9]{3}-[0-9]{3}-[0-9]{6}" placeholder="000-000-000000"') +
      field('otsFiscalCode','Codice fiscale del titolare / legale rappresentante',config.owner_fiscal_code,'required minlength="16" maxlength="16"') +
      field('otsVat','Partita IVA dell’attività',config.business_vat,'required pattern="[0-9]{11}"') +
      field('otsPassword','Password TS' + (config.password_saved ? ' · già salvata' : ' · da inserire'),'','type="password" maxlength="256" autocomplete="new-password" placeholder="' + (config.password_saved ? 'Lascia vuoto per mantenerla' : 'Password con cui accedi al portale TS') + '"') +
      field('otsPin','PIN TS' + (config.pin_saved ? ' · già salvato' : ' · da inserire'),'','type="password" maxlength="64" autocomplete="new-password" placeholder="' + (config.pin_saved ? 'Lascia vuoto per mantenerlo' : 'PIN dell’attestato Sistema TS') + '"') +
      '</div><p class="otsHelp">Password e PIN vengono cifrati sul server e non vengono restituiti al browser. I campi vuoti mantengono le credenziali già salvate.</p><button type="submit" class="otsPrimary">Salva credenziali</button></form>' +
      '<section><h3>Kit tecnico TS</h3><p>Scarica dal portale TS il kit per le <strong>spese sanitarie</strong>, con WSDL/XSD, specifiche di autenticazione e certificato, poi caricalo qui.</p>' +
      '<p><a href="https://sistemats1.sanita.finanze.it/portale/spese-sanitarie" target="_blank" rel="noopener noreferrer">Apri il portale ufficiale TS ↗</a> → Documenti e specifiche tecniche → Strumenti per lo sviluppo.</p>' +
      '<form id="otsUpload"><label for="otsFile">Documentazione tecnica (massimo 10 MB per file)<input id="otsFile" type="file" accept=".zip,.pdf,.wsdl,.xsd,.xml,.cer,.crt,.pem" required></label><button type="submit">Carica documento</button></form>' +
      '<p class="otsHelp">I documenti vengono conservati in un’area privata. Il caricamento richiede una verifica tecnica prima di attivare gli invii.</p>' +
      (files.length ? '<ul class="otsFiles">' + files.map(function (file) { return '<li><strong>' + esc(file.filename) + '</strong> · ' + Math.ceil(file.size_bytes / 1024) + ' KB · '+(file.review_state==='verified'?'Verificato':'Da verificare')+'</li>'; }).join('') + '</ul>' : '<p>Nessun documento tecnico caricato.</p>') +
      '</section>'+queueHtml(result.queue||[],ready)+'<p id="otsMessage" role="status" aria-live="polite">' + esc(notice || '') + '</p>';
    var form = item.body.querySelector('#otsForm'), upload = item.body.querySelector('#otsUpload');
    function message(text) { var node = item.body.querySelector('#otsMessage'); if (node) node.textContent = text; }
    function busy(value) { item.body.querySelectorAll('button,input').forEach(function (el) { el.disabled = value; }); item.body.setAttribute('aria-busy', String(value)); }
    async function action(payload){
      if(item.busy)return;item.busy=true;busy(true);message('Operazione in corso…');
      try{
        var data=await request(payload);
        if(payload.action==='receipt'){
          var r=data.receipt,bytes=Uint8Array.from(atob(r.data),function(c){return c.charCodeAt(0);});
          var url=URL.createObjectURL(new Blob([bytes],{type:r.kind==='pdf'?'application/pdf':'application/zip'}));
          var link=document.createElement('a');link.href=url;link.download='Ricevuta-TS-'+r.protocol+'.'+r.kind;link.click();setTimeout(function(){URL.revokeObjectURL(url);},30000);message('Ricevuta scaricata.');
        }else render(item,data,data.check?(data.check.verified?'Collegamento verificato. Invii attivati.':'Verifica non riuscita: '+checkLabel(data.check.code)+'. Gli invii restano disattivati.'):(data.result&&data.result.check_error?'Controllo esito non riuscito: '+checkLabel(data.result.check_error):'Stato aggiornato.'));
      }catch(error){message(error.message);}finally{item.busy=false;if(current===item)busy(false);}
    }
    item.body.querySelector('#otsVerify').onclick=function(){return action({action:'verify'});};
    item.body.querySelector('#otsRefresh').onclick=function(){return action({action:'status'});};
    var pause=item.body.querySelector('#otsPause');if(pause)pause.onclick=function(){return action({action:'pause'});};
    item.body.querySelectorAll('[data-ts-action]').forEach(function(button){button.onclick=function(){
      var name=button.dataset.tsAction;
      if(name==='send'&&!window.confirm('Inviare al Sistema TS la spesa dello scontrino '+button.dataset.tsNumber+'?'))return;
      return action({action:name,id:button.dataset.tsId,confirmed:name==='send'});
    };});
    form.onsubmit = async function (event) {
      event.preventDefault(); if (item.busy) return;
      var payload = {action:'save',revision:config.revision,username:form.elements.otsUsername.value.trim(),owner_code:form.elements.otsOwner.value.trim(),
        owner_fiscal_code:form.elements.otsFiscalCode.value.trim(),business_vat:form.elements.otsVat.value.trim(),password:form.elements.otsPassword.value || null,pin:form.elements.otsPin.value || null};
      item.busy = true; busy(true); message('Salvataggio in corso…');
      try { var data = await request(payload); render(item, data, 'Credenziali salvate. Invio TS ancora da attivare.'); }
      catch (error) { message(error.message); }
      finally {
        payload.password = null; payload.pin = null;
        form.elements.otsPassword.value = ''; form.elements.otsPin.value = '';
        item.busy = false; if (current === item) busy(false);
      }
    };
    upload.onsubmit = async function (event) {
      event.preventDefault(); if (item.busy) return;
      var file = upload.querySelector('input').files[0];
      if (!file) { message('Scegli il documento tecnico da caricare.'); return; }
      if (file.size > 10 * 1024 * 1024) { message('Il file supera il limite di 10 MB.'); return; }
      item.busy = true; busy(true); message('Caricamento in corso…');
      try { var data = await request(null, file); render(item,data,data.duplicate ? 'Questo documento è già presente.' : 'Documento caricato. In attesa della verifica tecnica.'); }
      catch (error) { message(error.message); }
      finally { upload.querySelector('input').value = ''; item.busy = false; if (current === item) busy(false); }
    };
  }
  async function open() {
    if (current) { current.node.querySelector('button').focus(); return; }
    var node = document.createElement('div'); node.id = 'optykerTsConnection';
    node.setAttribute('role','dialog'); node.setAttribute('aria-modal','true'); node.setAttribute('aria-labelledby','otsTitle');
    node.innerHTML = '<div class="otsCard"><header><h2 id="otsTitle">Sistema TS</h2><button type="button" aria-label="Chiudi Sistema TS">Chiudi</button></header><div class="otsBody"><p role="status">Caricamento configurazione…</p></div></div>';
    var item = {node:node,body:node.querySelector('.otsBody'),previous:document.activeElement,busy:false};
    item.keys = function (event) {
      if (event.key === 'Escape') { event.preventDefault(); close(); }
      if (event.key === 'Tab') {
        var focusable = node.querySelectorAll('button:not(:disabled),input:not(:disabled),a[href]'), first = focusable[0], last = focusable[focusable.length-1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    current = item; document.body.appendChild(node); document.addEventListener('keydown',item.keys);
    node.querySelector('header button').onclick = close; node.querySelector('header button').focus();
    try { render(item, await request({action:'status'})); }
    catch (error) { if (current === item) item.body.textContent = error.message; }
  }
  window.OPTYKER_TS_CONNECTION = Object.freeze({open:open});
})();


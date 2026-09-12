(function () {
  'use strict';
  if (window.OPTYKER_TS_CONNECTION) return;
  var API = 'https://whgziwaegjzqsgcntesr.supabase.co/functions/v1/optyker-ts-api';
  var current = null;
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
      if (e.name === 'AbortError') throw new Error('Risposta non ricevuta. Chiudi e riapri Sistema TS per verificare se il salvataggio è riuscito.');
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
  function render(item, result, notice) {
    if (current !== item) return;
    var config = result.config, files = result.files || [];
    item.body.innerHTML = '<p class="otsStatus"><strong>Invio TS da attivare</strong><br>Il salvataggio delle credenziali non effettua un accesso al Sistema TS. Le spese in coda non vengono ancora trasmesse.</p>' +
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
      (files.length ? '<ul class="otsFiles">' + files.map(function (file) { return '<li><strong>' + esc(file.filename) + '</strong> · ' + Math.ceil(file.size_bytes / 1024) + ' KB · Da verificare</li>'; }).join('') + '</ul>' : '<p>Nessun documento tecnico caricato.</p>') +
      '</section><p id="otsMessage" role="status" aria-live="polite">' + esc(notice || '') + '</p>';
    var form = item.body.querySelector('#otsForm'), upload = item.body.querySelector('#otsUpload');
    function message(text) { var node = item.body.querySelector('#otsMessage'); if (node) node.textContent = text; }
    function busy(value) { item.body.querySelectorAll('form button, form input').forEach(function (el) { el.disabled = value; }); item.body.setAttribute('aria-busy', String(value)); }
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

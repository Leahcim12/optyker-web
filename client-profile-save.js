(function () {
  'use strict';
  if (window.OPTYKER_CLIENT_PROFILE_SAVE) return;
  window.OPTYKER_CLIENT_PROFILE_SAVE = '20260913-profile1';
  var pending = null, baseline = '', generation = 0;
  var section, bar, status, button;
  function controls() { return section ? Array.from(section.querySelectorAll('input[id^="clientDb"],textarea[id^="clientDb"],select[id^="clientDb"]')) : []; }
  function snapshot() { return JSON.stringify(controls().map(function (x) { return [x.id, x.value]; })); }
  function currentId() { return String(window.clientCurrentId || ''); }
  function buttons() { return Array.from(document.querySelectorAll('[data-client-profile-save]')); }
  function tell(text, kind) {
    if (status) status.textContent = text;
    if (bar) bar.dataset.state = kind || 'ready';
  }
  function labels() {
    buttons().forEach(function (b) {
      b.textContent = pending ? 'Salvataggio…' : (currentId() ? 'Salva modifiche' : 'Salva cliente');
      b.disabled = !!pending;
    });
  }
  function reset() {
    generation++;
    baseline = snapshot();
    tell(currentId() ? 'Modifica i dati e premi Salva modifiche.' : 'Compila i dati e premi Salva cliente.');
    labels();
  }
  function changed() {
    if (!pending) tell(snapshot() === baseline ? 'Nessuna modifica da salvare.' : 'Modifiche da salvare', snapshot() === baseline ? 'ready' : 'dirty');
  }
  function refresh(name) {
    try { if (typeof window[name] === 'function') window[name](); }
    catch (_) { /* A display refresh must not turn a confirmed save into a failed write. */ }
  }
  function save() {
    if (pending) return pending;
    var m = window.clientMetadataFromForm();
    if (!m.name && !m.surname) {
      tell('Inserisci almeno il nome o il cognome.', 'error');
      var name = document.getElementById('clientDbName'); if (name) name.focus();
      return Promise.resolve(false);
    }
    var id = currentId(), record = document.getElementById('clientRecordId');
    if ((id && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) || (record && String(record.value || '') !== id)) {
      tell('Il cliente aperto non corrisponde all’anagrafica. Riapri il cliente prima di salvare.', 'error');
      return Promise.resolve(false);
    }
    var payload = window.cloudClientPayload(m);
    payload.fiscal = String(payload.fiscal || '').replace(/\s+/g, '').toUpperCase();
    if (id) payload.id = id; else delete payload.id;
    var view = generation, sent = snapshot(), frozen = controls().map(function (x) { return {node:x, disabled:x.disabled}; });
    frozen.forEach(function (x) { x.node.disabled = true; });
    tell('Salvataggio…', 'saving');
    pending = Promise.resolve().then(function () { return window.cloudApi('save_client', payload); }).then(function (result) {
      var row = result && result.data;
      if (!result || result.ok === false || !row || !row.id || (id && row.id !== id)) {
        throw new Error('Il server non ha confermato il salvataggio. I dati inseriti sono ancora nella scheda.');
      }
      var saved = window.cloudDbToClient(row), cloud = window.OPTYKER_CLOUD;
      var index = cloud.clients.findIndex(function (c) { return c.id === saved.id; });
      if (index < 0) cloud.clients.push(saved); else cloud.clients[index] = Object.assign({}, cloud.clients[index], saved);
      // A late reply must never replace another customer or later form edits.
      if (generation === view && currentId() === id) {
        if (snapshot() === sent) {
          window.clientFillForm(saved);
          baseline = snapshot();
          tell('Modifiche salvate', 'saved');
          refresh('clientApplyToCurrentPatient');
        } else {
          if (!id) { window.clientCurrentId = saved.id; if (record) record.value = saved.id; }
          baseline = sent;
          tell('Dati inviati salvati. Ci sono altre modifiche da salvare.', 'dirty');
        }
        refresh('clientRenderVisits'); refresh('clientRenderInformativeDocs');
      }
      refresh('clientRefreshList'); refresh('dashboardRenderClients');
      window.dispatchEvent(new CustomEvent('optyker:client-saved', {detail:{client_id:saved.id}}));
      return true;
    }).catch(function (error) {
      if (generation === view && currentId() === id) tell('Salvataggio non riuscito: ' + String(error.message || 'controlla la connessione e riprova.'), 'error');
      return false;
    }).finally(function () {
      pending = null;
      frozen.forEach(function (x) { x.node.disabled = x.disabled; });
      labels();
    });
    labels();
    return pending;
  }
  function boot() {
    section = document.getElementById('clientAnagraficaSection');
    if (!section || typeof window.cloudApi !== 'function' || typeof window.clientMetadataFromForm !== 'function') return;
    bar = document.createElement('div'); bar.id = 'optykerClientSaveBar';
    var copy = document.createElement('div'), title = document.createElement('strong');
    title.textContent = 'Anagrafica cliente';
    status = document.createElement('span'); status.id = 'optykerClientSaveStatus'; status.setAttribute('role','status'); status.setAttribute('aria-live','polite');
    copy.append(title, status);
    button = document.createElement('button'); button.type = 'button'; button.id = 'optykerClientSaveButton'; button.className = 'primary'; button.setAttribute('data-client-profile-save',''); button.setAttribute('aria-describedby',status.id); button.onclick = save;
    bar.append(copy, button);
    var header = section.querySelector('.clientIdentityHeader');
    if (header) header.insertAdjacentElement('afterend', bar); else section.prepend(bar);
    document.querySelectorAll('#clientWorkspaceHero button[onclick*="clientSaveMetadata"]').forEach(function (b) {
      b.removeAttribute('onclick'); b.setAttribute('data-client-profile-save',''); b.onclick = save;
    });
    ['clientFillForm', 'clientClearForm'].forEach(function (name) {
      var original = window[name];
      if (typeof original === 'function') window[name] = function () { var result = original.apply(this, arguments); reset(); return result; };
    });
    section.addEventListener('input', changed); section.addEventListener('change', changed);
    window.clientSaveMetadata = save;
    reset();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once:true}); else boot();
}());

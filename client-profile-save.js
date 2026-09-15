(function () {
  'use strict';
  if (window.OPTYKER_CLIENT_PROFILE_SAVE) return;
  window.OPTYKER_CLIENT_PROFILE_SAVE = '20260915-profile-id';
  var pending = null, baseline = '', generation = 0;
  var section, bar, status, button, profileObserver;
  var birthPlaceDirtyFor = '';
  function controls() { return section ? Array.from(section.querySelectorAll('input[id^="clientDb"],textarea[id^="clientDb"],select[id^="clientDb"]')) : []; }
  function snapshot() { return JSON.stringify(controls().map(function (x) { return [x.id, x.value]; })); }
  function currentId() { return String(window.clientCurrentId || ''); }
  var referenceGeneration = 0, referenceLabel;
  function showClientReference(row) {
    if (!referenceLabel) return;
    var code = row && String(row.reference_no || row.reference_code || '').trim();
    referenceLabel.textContent = !currentId() ? 'ID cliente: assegnato al salvataggio' : code ? 'ID cliente: ' + code : 'ID cliente: non disponibile';
  }
  function updateClientReference() {
    var id = currentId(), view = ++referenceGeneration;
    var rows = window.OPTYKER_CLOUD && window.OPTYKER_CLOUD.clients || [];
    var row = rows.find(function (c) { return String(c.id) === id; });
    showClientReference(row);
    if (!id || row && (row.reference_no || row.reference_code)) return;
    // Older cloud form adapters omit the public reference. Read the saved row,
    // without replacing the form or assigning a new customer number.
    referenceLabel.textContent = 'ID cliente: caricamento…';
    Promise.resolve().then(function () { return window.cloudApi('get_client', {id:id}); }).then(function (r) {
      if (view !== referenceGeneration || currentId() !== id) return;
      showClientReference(r && r.ok !== false && r.data && String(r.data.id) === id ? r.data : null);
    }).catch(function () { if (view === referenceGeneration && currentId() === id) showClientReference(null); });
  }
  function currentBirthKey() { return currentId() || '__new__'; }
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
  function parseBirth(value) {
    var text = String(value || '').trim(), m, day, month, year;
    m = text.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})$/);
    if (m) { day = Number(m[1]); month = Number(m[2]); year = Number(m[3]); }
    else {
      m = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
      if (!m) return null;
      year = Number(m[1]); month = Number(m[2]); day = Number(m[3]);
    }
    var d = new Date(year, month - 1, day);
    if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null;
    return d;
  }
  function updateAge() {
    var birth = document.getElementById('clientDbBirth'), age = document.getElementById('clientDbAge');
    if (!birth || !age) return;
    var d = parseBirth(birth.value), now = new Date();
    if (!d || d > now) { age.value = ''; age.placeholder = '—'; return; }
    var years = now.getFullYear() - d.getFullYear();
    if (now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) years--;
    age.value = years >= 0 ? String(years) : '';
    age.placeholder = years >= 0 ? '' : '—';
  }
  function notifyClientDetailsChanged() {
    var fields = document.getElementById('optykerExtraFields');
    if (fields) fields.dispatchEvent(new Event('input', {bubbles:true}));
  }
  function markBirthPlaceDirty() {
    birthPlaceDirtyFor = currentBirthKey();
    notifyClientDetailsChanged();
    changed();
  }
  function mountBirthProfileFields() {
    var birth = document.getElementById('clientDbBirth');
    if (!birth) return false;
    var birthWrap = birth.closest('label'), grid = birthWrap && birthWrap.parentElement;
    if (!birthWrap || !grid) return false;
    var age = document.getElementById('clientDbAge'), ageWrap;
    if (!age) {
      ageWrap = document.createElement('label');
      ageWrap.className = 'clientProfileField optykerAgeField';
      var ageCaption = document.createElement('span'); ageCaption.textContent = 'Età';
      age = document.createElement('input'); age.id = 'clientDbAge'; age.type = 'text'; age.readOnly = true; age.tabIndex = -1; age.setAttribute('aria-readonly','true'); age.placeholder = '—';
      ageWrap.append(ageCaption, age);
      birthWrap.insertAdjacentElement('afterend', ageWrap);
    } else ageWrap = age.closest('label');
    if (!birth.dataset.optykerAgeHook) {
      birth.dataset.optykerAgeHook = '1';
      birth.addEventListener('input', updateAge);
      birth.addEventListener('change', updateAge);
    }
    updateAge();
    var place = document.getElementById('optykerExtra-luogoDiNascita');
    if (place) {
      var placeWrap = place.closest('label');
      if (placeWrap) {
        var caption = placeWrap.querySelector('span');
        if (caption) caption.textContent = 'Paese di nascita';
        placeWrap.className = 'clientProfileField optykerBirthPlaceField';
        placeWrap.dataset.optykerBirthPlaceMain = '1';
        placeWrap.hidden = false;
        place.placeholder = 'Paese di nascita';
        place.autocomplete = 'off';
        if (!place.dataset.optykerBirthPlaceHook) {
          place.dataset.optykerBirthPlaceHook = '1';
          place.addEventListener('input', markBirthPlaceDirty);
          place.addEventListener('change', markBirthPlaceDirty);
        }
        if (ageWrap && placeWrap.previousElementSibling !== ageWrap) ageWrap.insertAdjacentElement('afterend', placeWrap);
      }
    }
    return true;
  }
  function reset() {
    generation++;
    updateClientReference();
    mountBirthProfileFields();
    updateAge();
    baseline = snapshot();
    tell(currentId() ? 'Modifica i dati e premi Salva modifiche.' : 'Compila i dati e premi Salva cliente.');
    labels();
  }
  function changed() {
    var dirty = snapshot() !== baseline || birthPlaceDirtyFor === currentBirthKey();
    if (!pending) tell(dirty ? 'Modifiche da salvare' : 'Nessuna modifica da salvare.', dirty ? 'dirty' : 'ready');
  }
  function refresh(name) {
    try { if (typeof window[name] === 'function') window[name](); }
    catch (_) { /* A display refresh must not turn a confirmed save into a failed write. */ }
  }
  function saveBirthPlaceAfterProfile(clientId, value, shouldSave, attempt) {
    if (!shouldSave) return Promise.resolve(true);
    attempt = attempt || 0;
    mountBirthProfileFields();
    var place = document.getElementById('optykerExtra-luogoDiNascita');
    var fields = document.getElementById('optykerExtraFields');
    var extraSave = document.getElementById('optykerExtraSave');
    if (currentId() === clientId && place && fields && !fields.disabled && extraSave && typeof extraSave.onclick === 'function') {
      if (place.value !== value) place.value = value;
      notifyClientDetailsChanged();
      if (extraSave.disabled) {
        birthPlaceDirtyFor = '';
        return Promise.resolve(true);
      }
      tell('Anagrafica salvata · salvataggio Paese di nascita…', 'saving');
      return Promise.resolve(extraSave.onclick()).then(function () {
        var extraStatus = document.getElementById('optykerExtraStatus');
        if (extraStatus && extraStatus.classList.contains('bad')) throw new Error(extraStatus.textContent || 'Paese di nascita non salvato.');
        birthPlaceDirtyFor = '';
        return true;
      });
    }
    if (attempt >= 100) return Promise.reject(new Error('Anagrafica salvata, ma il Paese di nascita non è stato confermato. Riapri il cliente e premi Salva modifiche.'));
    return new Promise(function (resolve) { setTimeout(resolve, 50); }).then(function () {
      return saveBirthPlaceAfterProfile(clientId, value, shouldSave, attempt + 1);
    });
  }
  function save() {
    if (pending) return pending;
    mountBirthProfileFields();
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
    var place = document.getElementById('optykerExtra-luogoDiNascita');
    var birthPlaceValue = place ? String(place.value || '') : '';
    var saveBirthPlace = birthPlaceDirtyFor === (id || '__new__');
    var payload = window.cloudClientPayload(m);
    payload.fiscal = String(payload.fiscal || '').replace(/\s+/g, '').toUpperCase();
    if (id) payload.id = id; else delete payload.id;
    var freezeControls = controls(); if (place) freezeControls.push(place);
    var view = generation, sent = snapshot(), frozen = freezeControls.map(function (x) { return {node:x, disabled:x.disabled}; });
    frozen.forEach(function (x) { x.node.disabled = true; });
    tell('Salvataggio…', 'saving');
    pending = Promise.resolve().then(function () { return window.cloudApi('save_client', payload); }).then(function (result) {
      var row = result && result.data;
      if (!result || result.ok === false || !row || !row.id || (id && row.id !== id)) {
        throw new Error('Il server non ha confermato il salvataggio. I dati inseriti sono ancora nella scheda.');
      }
      var saved = window.cloudDbToClient(row), cloud = window.OPTYKER_CLOUD;
      if (row.reference_no) saved.reference_no = row.reference_no;
      if (row.reference_code) saved.reference_code = row.reference_code;
      var index = cloud.clients.findIndex(function (c) { return c.id === saved.id; });
      if (index < 0) cloud.clients.push(saved); else cloud.clients[index] = Object.assign({}, cloud.clients[index], saved);
      // A late reply must never replace another customer or later form edits.
      if (generation === view && currentId() === id) {
        if (snapshot() === sent) {
          window.clientFillForm(saved);
          baseline = snapshot();
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
      return saveBirthPlaceAfterProfile(saved.id, birthPlaceValue, saveBirthPlace, 0).then(function () {
        if (generation === view || currentId() === saved.id) tell('Modifiche salvate', 'saved');
        return true;
      });
    }).catch(function (error) {
      if (generation === view || currentId() === id) tell('Salvataggio non riuscito: ' + String(error.message || 'controlla la connessione e riprova.'), 'error');
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
    referenceLabel = document.createElement('span'); referenceLabel.id = 'optykerClientProfileId';
    referenceLabel.setAttribute('aria-live','polite');
    status = document.createElement('span'); status.id = 'optykerClientSaveStatus'; status.setAttribute('role','status'); status.setAttribute('aria-live','polite');
    copy.append(title, referenceLabel, status);
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
    window.addEventListener('optyker:client-saved', updateClientReference);
    if (window.MutationObserver) {
      profileObserver = new MutationObserver(function () { mountBirthProfileFields(); });
      profileObserver.observe(section, {childList:true, subtree:true});
    }
    window.clientSaveMetadata = save;
    mountBirthProfileFields();
    reset();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once:true}); else boot();
}());

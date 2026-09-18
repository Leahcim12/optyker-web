/* Original Optyker client workspace. Presentation only: no database writes, storage,
   imported source assets, new authentication or replacement of native form controls. */
(function (root) {
  'use strict';
  const VERSION = '20260919-original1';
  const own = (o, k) => Object.prototype.hasOwnProperty.call(o || {}, k);
  const str = v => String(v == null ? '' : v);
  function scopedRows(map, id) {
    if (!id || !own(map, id) || !Array.isArray(map[id])) return null;
    const seen = new Set();
    return map[id].filter(row => {
      if (!row || (row.client_id && str(row.client_id) !== id)) return false;
      if (!row.id) return true;
      if (seen.has(str(row.id))) return false;
      seen.add(str(row.id)); return true;
    });
  }
  function dateValue(v) {
    const s = str(v).trim(); let m, d;
    if ((m = /^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/.exec(s))) {
      d = new Date(+m[3], +m[2] - 1, +m[1]);
      if (d.getFullYear() !== +m[3] || d.getMonth() !== +m[2] - 1 || d.getDate() !== +m[1]) return null;
    } else if ((m = /^(\d{4})-(\d{2})-(\d{2})(?:T.+)?$/.exec(s))) {
      const check = new Date(+m[1], +m[2] - 1, +m[3]);
      if (check.getFullYear() !== +m[1] || check.getMonth() !== +m[2] - 1 || check.getDate() !== +m[3]) return null;
      d = new Date(s.length === 10 ? s + 'T12:00:00' : s);
    }
    else return null;
    return Number.isFinite(+d) ? d : null;
  }
  function summarize(cloud, id, orderCounts) {
    const rows = scopedRows(cloud && cloud.sheets, id);
    const consents = scopedRows(cloud && cloud.consents, id);
    const dated = (rows || []).map(row => {
      const data = row.data || {};
      return {row, date: dateValue(data.examDate || data.savedAt || row.created_at || row.updated_at)};
    }).filter(x => x.date).sort((a, b) => b.date - a.date);
    const count = own(orderCounts, id) && orderCounts[id] !== null && str(orderCounts[id]).trim() !== '' && typeof orderCounts[id] !== 'boolean' && Number.isInteger(Number(orderCounts[id])) && Number(orderCounts[id]) >= 0 ? Number(orderCounts[id]) : null;
    return {sheets: rows === null ? null : rows.length, consents: consents === null ? null : consents.length, orders: count, latest: dated[0] || null};
  }
  const helpers = {scopedRows, dateValue, summarize};
  if (typeof module !== 'undefined' && module.exports) module.exports = helpers;
  if (!root || !root.document || root.OPTYKER_CLIENT_WORKSPACE_ORIGINAL) return;
  const doc = root.document;
  const E = id => doc.getElementById(id);
  let panel, timer, lastSignature = '';
  function node(tag, text, cls) {
    const el = doc.createElement(tag); if (text !== undefined) el.textContent = text; if (cls) el.className = cls; return el;
  }
  function setText(el, value) { if (el && el.textContent !== str(value)) el.textContent = str(value); }
  function currentId() { return str(root.clientCurrentId || ''); }
  function val(id) { return str(E(id) && E(id).value).trim(); }
  function nativePage(page) {
    if (!currentId()) return;
    if (typeof root.optykerClientOpenPage === 'function') root.optykerClientOpenPage(page);
  }
  function metric(key, label, hint, onClick) {
    const b = node('button', undefined, 'cwoMetric'); b.type = 'button'; b.dataset.cwoMetric = key;
    b.append(node('span', label, 'cwoMetricLabel'), node('strong', '—', 'cwoMetricValue'), node('span', hint, 'cwoMetricHint'));
    b.addEventListener('click', onClick); return b;
  }
  function mount() {
    panel = E('clientsPanel'); const edit = E('clientEditView'), hero = E('clientWorkspaceHero'), ana = E('clientAnagraficaSection');
    if (!panel || !edit || !hero || !ana) return false;
    panel.classList.add('optykerOriginalClients');
    const title = panel.querySelector('.clientTitle'); if (title) setText(title, 'Clienti');
    if (!E('cwoHeroLabel')) {
      const name = E('clientWorkspaceName');
      if (name) { const line = node('div', undefined, 'cwoHeroLabel'); line.id = 'cwoHeroLabel'; line.append(node('span', 'DOSSIER CLIENTE'), node('span', '—', 'cwoReference')); name.before(line); }
    }
    if (!E('cwoSummary')) {
      const summary = node('section', undefined, 'cwoSummary'); summary.id = 'cwoSummary'; summary.setAttribute('aria-label', 'Riepilogo del cliente selezionato');
      summary.append(metric('sheets', 'Schede cliente', 'Apri lo storico delle schede', () => nativePage('schede')),
        metric('latest', 'Ultima scheda', 'Apri la scheda più recente', () => {
          const s = summarize(root.OPTYKER_CLOUD || {}, currentId(), root.OPTYKER_CLIENT_ONLINE_ORDER_COUNTS || {});
          if (!s.latest) return;
          const r = s.latest.row, type = r.sheet_type || (r.data && r.data.sheetType);
          if (r.id && type && typeof root.optykerOpenClientSheetByDate === 'function') root.optykerOpenClientSheetByDate(type, r.id);
          else nativePage('schede');
        }),
        metric('orders', 'Ordini online', 'Acquisti collegati al cliente', () => nativePage('ordini')),
        metric('consents', 'Documenti firmati', 'Apri informative e consensi', () => nativePage('documenti')));
      hero.after(summary);
    }
    if (!E('cwoSectionIndex')) {
      const nav = node('nav', undefined, 'cwoSectionIndex'); nav.id = 'cwoSectionIndex'; nav.setAttribute('aria-label', 'Sezioni dei dati anagrafici');
      const items = [['Identità', 'clientDbName'], ['Recapiti', 'clientDbPhone'], ['Indirizzo e fatturazione', 'clientDbStreet'], ['Profilo e abitudini', 'clientDbProfession'], ['Altri dettagli', 'optykerExtraFields']];
      for (const [label, id] of items) {
        const b = node('button', label); b.type = 'button'; b.dataset.cwoTarget = id;
        b.onclick = () => {
          const target = E(id); if (!target) return;
          const card = target.closest('.clientProfileCard, .optykerClientExtras') || target;
          card.scrollIntoView({behavior: root.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start'});
          if (/^(INPUT|SELECT|TEXTAREA)$/.test(target.tagName)) target.focus({preventScroll: true});
          nav.querySelectorAll('button').forEach(x => { x.classList.toggle('active', x === b); x.setAttribute('aria-current', x === b ? 'location' : 'false'); });
        }; nav.append(b);
      }
      const sections = ana.querySelector('.clientProfileSections'); if (sections) sections.before(nav);
    }
    // Keep the original card, form nodes and event handlers; only its position changes.
    const card = E('ovcCardSection'), sections = ana.querySelector('.clientProfileSections');
    if (card && sections && !card.dataset.cwoPositioned) { sections.after(card); card.dataset.cwoPositioned = '1'; }
    return true;
  }
  function update() {
    if (doc.hidden || !mount()) return;
    const edit = E('clientEditView'), ana = E('clientAnagraficaSection');
    const visible = edit && edit.style.display !== 'none';
    panel.dataset.cwoView = visible ? 'edit' : 'archive';
    panel.dataset.cwoForm = ana && ana.style.display !== 'none' ? 'yes' : 'no';
    if (!visible || panel.style.display === 'none') return;
    const id = currentId(), cloud = root.OPTYKER_CLOUD || {};
    const saved = (Array.isArray(cloud.clients) ? cloud.clients : []).find(c => str(c.id) === id);
    let ref = saved && (saved.reference_no || saved.reference_code);
    // The existing profile save adapter is responsible for loading missing references.
    if (!ref && id && E('optykerClientProfileId')) {
      const m = /^ID cliente:\s*(\d+C)\s*$/i.exec(E('optykerClientProfileId').textContent); if (m) ref = m[1];
    }
    const data = summarize(cloud, id, root.OPTYKER_CLIENT_ONLINE_ORDER_COUNTS || {});
    const name = [val('clientDbSurname'), val('clientDbName')].filter(Boolean).join(' ') || (id ? 'Cliente' : 'Nuovo cliente');
    const contacts = [val('clientDbPhone'), val('clientDbEmail'), val('clientDbCity')].filter(Boolean).join(' · ');
    const sig = JSON.stringify([id, ref, name, contacts, data.sheets, data.consents, data.orders, data.latest && [data.latest.row.id, +data.latest.date]]);
    if (lastSignature !== sig) {
      lastSignature = sig;
      setText(E('clientWorkspaceName'), name);
      setText(E('clientWorkspaceMeta'), contacts || (id ? 'Completa i recapiti nella scheda anagrafica.' : 'Inserisci i dati e salva per creare il cliente.'));
      setText(E('clientWorkspaceAvatar'), [val('clientDbName'), val('clientDbSurname')].filter(Boolean).map(v => v.charAt(0).toUpperCase()).join('') || 'NC');
      setText(panel.querySelector('.cwoReference'), !id ? 'NUOVO' : ref ? 'ID ' + ref : 'ID non disponibile');
      const values = {sheets: data.sheets, orders: data.orders, consents: data.consents, latest: data.latest ? data.latest.date.toLocaleDateString('it-IT') : null};
      panel.querySelectorAll('[data-cwo-metric]').forEach(b => {
        const k = b.dataset.cwoMetric, v = values[k];
        setText(b.querySelector('.cwoMetricValue'), v == null ? '—' : v);
        const hints = {sheets: 'Apri lo storico delle schede', orders: 'Acquisti collegati al cliente', consents: 'Apri informative e consensi', latest: 'Apri la scheda più recente'};
        setText(b.querySelector('.cwoMetricHint'), !id ? 'Disponibile dopo il salvataggio' : v == null ? (k === 'latest' && data.sheets !== null ? 'Nessuna data disponibile' : 'Dati non ancora caricati') : hints[k]);
        b.disabled = !id || (k === 'latest' && !data.latest);
      });
    }
    const nav = E('clientPageNav');
    if (nav) {
      nav.setAttribute('role', 'navigation'); nav.setAttribute('aria-label', 'Dossier del cliente');
      nav.querySelectorAll('[data-client-page]').forEach(b => b.setAttribute('aria-current', b.classList.contains('active') ? 'page' : 'false'));
    }
    E('cwoSectionIndex')?.querySelectorAll('[data-cwo-target]').forEach(b => b.hidden = !E(b.dataset.cwoTarget));
  }
  function boot() {
    if (!mount()) return;
    root.OPTYKER_CLIENT_WORKSPACE_ORIGINAL = {version: VERSION, refresh: update, helpers};
    panel.addEventListener('input', update); panel.addEventListener('change', update);
    root.addEventListener('optyker:client-saved', () => { lastSignature = ''; update(); });
    doc.addEventListener('visibilitychange', update);
    // A single read-only refresh; no observers on the form, no autosaving and no API calls.
    timer = root.setInterval(update, 1000); update();
    root.addEventListener('pagehide', () => { root.clearInterval(timer); timer = null; });
    root.addEventListener('pageshow', () => { if (!timer) timer = root.setInterval(update, 1000); update(); });
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', boot, {once: true}); else boot();
})(typeof window === 'undefined' ? null : window);

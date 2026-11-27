/* OPTYKER_LAB_READY_NOTICE_20261127
   Laboratorio: l'avviso WhatsApp «busta pronta» parte solo dopo la conferma dell'operatore.
   1. Quando una busta passa a «Pronto per la consegna» dal menu Stato ordine, prima di salvare chiede:
      «Sì, invia il messaggio» / «No, solo Pronto per la consegna» / «Annulla» (lo stato torna com'era).
   2. Sotto le buste già in «Pronto per la consegna» (anche quelle arrivate da sole dopo 10 giorni) mostra se
      l'avviso è partito e il pulsante «Avvisa il cliente su WhatsApp», con la stessa conferma.
   Le conferme passano da optyker_lab_ready_notice_api; il messaggio parte dall'automazione WhatsApp di ogni minuto
   (dalle 8 alle 21), con il modello ordine_pronto. «No» usa il cambio di stato originale del Laboratorio. */
(function () {
'use strict';
if (window.OPTYKER_LAB_READY_NOTICE) return;
window.OPTYKER_LAB_READY_NOTICE = '20261127-confirm1';

const API = 'optyker_lab_ready_notice_api';
const READY = 'pronto_consegna';
const TTL = 30000;
const cache = new Map();
const wanted = new Set();
let statusTimer = 0, pollTimer = 0, queued = false, dialog = null;

const E = (id) => document.getElementById(id);
const txt = (v) => String(v == null ? '' : v);

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

function rpc(action, payload) {
  const c = window.OPTYKER_CLOUD || {};
  const user = txt(c.username || window.OPTYKER_ACTIVE_USER).trim();
  if (!c.root || !c.key) return Promise.reject(new Error('Cloud Optyker non disponibile'));
  if (!user) return Promise.reject(new Error('Sessione operatore non disponibile'));
  return fetch(c.root + '/rest/v1/rpc/' + API, {
    method: 'POST',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json', apikey: c.key, Authorization: 'Bearer ' + c.key },
    body: JSON.stringify({ p_username: user, p_password: txt(c.password), p_action: action, p_payload: payload || {} }),
  }).then((r) => r.json().catch(() => ({})).then((x) => {
    if (!r.ok || !x || x.ok === false) {
      const e = new Error((x && (x.error || x.message)) || ('Server ' + r.status));
      e.data = x && x.data;
      throw e;
    }
    return x;
  }));
}

/* ---------- testi ---------- */
function phoneLabel(info) {
  const d = txt(info && info.phone_to);
  if (/^39\d{9,10}$/.test(d)) return '+39 ' + d.slice(2, 5) + ' ' + d.slice(5, 8) + ' ' + d.slice(8);
  return d ? '+' + d : txt(info && info.phone);
}
function when(iso) {
  const t = new Date(iso);
  if (!iso || isNaN(t)) return '';
  const o = { timeZone: 'Europe/Rome' };
  return t.toLocaleDateString('it-IT', Object.assign({ day: '2-digit', month: '2-digit' }, o)) + ' alle ' +
    t.toLocaleTimeString('it-IT', Object.assign({ hour: '2-digit', minute: '2-digit' }, o));
}
const kindLabel = (t) => (t === 'lac_busta' ? 'LAC' : t === 'eyewear_busta' ? 'Occhiali' : 'Busta');
function sendAtText(info) {
  if (info.send_at === 'today_8') return 'Prima delle 8 i messaggi non partono: questo partirà oggi alle 8:00.';
  if (info.send_at === 'tomorrow_8') return 'Dopo le 21 i messaggi non partono: questo partirà domattina alle 8:00.';
  return 'Il messaggio parte entro un minuto.';
}
function deliveryText(last) {
  if (last.delivery === 'read') return ' · letto';
  if (last.delivery === 'delivered') return ' · consegnato';
  if (last.delivery === 'failed') return ' · non consegnato' + (last.delivery_error ? ' (' + last.delivery_error + ')' : '');
  return '';
}

/* ---------- Laboratorio ---------- */
function idOf(sel) {
  const m = sel && /labUpdateStatus\(\s*'([^']+)'/.exec(sel.getAttribute('onchange') || '');
  return m ? m[1] : '';
}
function selectFor(id) {
  const list = document.querySelectorAll('#labOrdersList .labStatusBox select');
  for (let i = 0; i < list.length; i++) if (idOf(list[i]) === id) return list[i];
  return null;
}
// Stato salvato sul server: è l'opzione marcata «selected» quando il Laboratorio ha disegnato la scheda.
function savedStatus(sel) {
  const o = sel && Array.prototype.find.call(sel.options, (x) => x.defaultSelected);
  return o ? o.value : '';
}
function revert(sel) {
  if (!sel) return;
  Array.prototype.forEach.call(sel.options, (o) => { o.selected = o.defaultSelected; });
  // Le schede per stato si ricalcolano quando cambia la lista: un segnaposto vuoto, tolto subito.
  const list = E('labOrdersList');
  if (list) { const m = el('i', 'lrnMark'); m.hidden = true; list.appendChild(m); setTimeout(() => m.remove(), 0); }
}
function cardLine(sel, info) {
  const card = sel && sel.closest('.labCard');
  const ref = (info && info.reference_code) || txt(card && card.querySelector('.labRef') && card.querySelector('.labRef').firstChild && card.querySelector('.labRef').firstChild.textContent).trim();
  const client = (info && info.client_name) || txt(card && card.querySelector('.labClient') && card.querySelector('.labClient').textContent).trim();
  return [ref, info ? kindLabel(info.order_type) : '', client].filter(Boolean).join(' · ');
}
function reloadLab() {
  const b = E('labRefresh');
  if (b) b.click(); else if (typeof window.openLaboratory === 'function') window.openLaboratory();
}
function labVisible() {
  const p = E('labOrdersPanel');
  return !!p && p.getClientRects().length > 0;
}

/* ---------- finestra di conferma ---------- */
function openDialog(title, sub) {
  if (dialog) dialog.close();
  const overlay = el('div', 'lrnOverlay');
  const box = el('div', 'lrnDialog');
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-modal', 'true');
  box.setAttribute('aria-labelledby', 'lrnTitle');
  const h = el('h2', '', title); h.id = 'lrnTitle';
  const p = el('p', 'lrnSub', sub || '');
  const body = el('div', 'lrnBody');
  const err = el('p', 'lrnError'); err.setAttribute('role', 'alert'); err.hidden = true;
  const actions = el('div', 'lrnActions');
  box.append(h, p, body, err, actions);
  overlay.appendChild(box);
  document.body.appendChild(overlay);
  const d = {
    alive: true, busy: false, onEscape: null,
    sub(t) { p.textContent = t || ''; },
    body(nodes) { body.replaceChildren(...nodes); },
    error(t) { err.textContent = t || ''; err.hidden = !t; },
    actions(list) {
      actions.replaceChildren();
      list.forEach((a) => {
        const b = el('button', a.kind || '', a.label);
        b.type = 'button';
        if (a.id) b.setAttribute('data-lrn-action', a.id);
        b.onclick = async () => {
          if (d.busy) return;
          d.error('');
          if (!a.busy) { a.run(); return; }
          d.busy = true;
          const old = b.textContent;
          actions.querySelectorAll('button').forEach((x) => { x.disabled = true; });
          b.textContent = a.busy;
          try { await a.run(); } catch (e) {
            if (d.alive) d.error(e.message || String(e));
          } finally {
            d.busy = false;
            if (d.alive) { b.textContent = old; actions.querySelectorAll('button').forEach((x) => { x.disabled = false; }); }
          }
        };
        actions.appendChild(b);
      });
      const first = actions.querySelector('button.primary') || actions.querySelector('button');
      if (first) setTimeout(() => { if (d.alive) first.focus(); }, 0);
    },
    close() {
      if (!d.alive) return;
      d.alive = false;
      document.removeEventListener('keydown', key, true);
      overlay.remove();
      if (dialog === d) dialog = null;
    },
  };
  function key(ev) {
    if (ev.key !== 'Escape' || d.busy) return;
    ev.preventDefault();
    ev.stopPropagation();
    if (d.onEscape) d.onEscape(); else d.close();
  }
  document.addEventListener('keydown', key, true);
  d.body([el('p', 'lrnNote', 'Controllo i dati del cliente…')]);
  dialog = d;
  return d;
}

function messageBlock(info, question) {
  const nodes = [el('p', 'lrnQuestion', question)];
  const rows = el('dl', 'lrnRows');
  rows.append(el('dt', '', 'Cliente'), el('dd', '', info.client_name || '—'), el('dt', '', 'WhatsApp'), el('dd', '', phoneLabel(info)));
  nodes.push(rows);
  nodes.push(el('div', 'lrnPreview', info.preview || ''));
  if (info.pending) {
    nodes.push(el('p', 'lrnWarn', 'Un avviso per questa busta è già in partenza (confermato' +
      (info.pending.requested_by ? ' da ' + info.pending.requested_by : '') + ' il ' + when(info.pending.requested_at) +
      '). Confermando ne parte comunque uno solo.'));
  } else if (info.last && info.last.status === 'sent') {
    nodes.push(el('p', 'lrnWarn', 'Attenzione: questo avviso è già stato inviato il ' + when(info.last.at) + deliveryText(info.last) +
      '. Confermando, il cliente lo riceve di nuovo.'));
  }
  nodes.push(el('p', 'lrnNote', sendAtText(info)));
  return nodes;
}

function remember(info) {
  if (info && info.id) cache.set(info.id, { info: info, at: Date.now() });
}

// Busta messa su «Pronto per la consegna» dal menu: chiede sempre prima di salvare.
async function askReady(id, original) {
  const sel = selectFor(id);
  const d = openDialog('Busta pronta per la consegna', cardLine(sel, null));
  const cancel = () => { d.close(); revert(sel); };
  const onlyStatus = () => { d.close(); original(id, READY); };
  d.onEscape = cancel;
  d.actions([{ label: 'Annulla', kind: 'ghost', run: cancel }]);
  let info = null, problem = '';
  try { info = (await rpc('info', { id: id })).data; } catch (e) { problem = e.message || String(e); }
  if (!d.alive) return;
  if (info) { remember(info); d.sub(cardLine(sel, info)); }
  if (info && info.can_send) {
    d.body(messageBlock(info, 'Vuoi avvisare il cliente su WhatsApp che la busta è pronta?'));
    d.actions([
      { id: 'send', label: 'Sì, invia il messaggio', kind: 'primary', busy: 'Invio…', run: async () => {
        const x = await rpc('set_ready', { id: id, notify: true });
        remember(x.data);
        d.close();
        toast('Busta pronta. ' + (x.data && x.data.send_at === 'now' ? 'Il messaggio WhatsApp parte entro un minuto.' : sendAtText(x.data || {})));
        reloadLab();
      } },
      { id: 'status-only', label: 'No, solo «Pronto per la consegna»', run: onlyStatus },
      { id: 'cancel', label: 'Annulla', kind: 'ghost', run: cancel },
    ]);
  } else {
    const why = info ? (info.block_reason || 'Avviso WhatsApp non disponibile.') : 'Non riesco a controllare l’avviso WhatsApp: ' + problem;
    d.body([el('p', 'lrnWarn', why), el('p', 'lrnNote', 'Puoi mettere la busta su «Pronto per la consegna» senza mandare il messaggio.')]);
    d.actions([
      { id: 'status-only', label: 'Segna pronto senza messaggio', kind: 'primary', run: onlyStatus },
      { id: 'cancel', label: 'Annulla', kind: 'ghost', run: cancel },
    ]);
  }
}

// Busta già in «Pronto per la consegna»: avviso su richiesta, con conferma.
async function askSend(id) {
  const sel = selectFor(id);
  const d = openDialog('Avvisa il cliente su WhatsApp', cardLine(sel, (cache.get(id) || {}).info));
  d.actions([{ label: 'Annulla', kind: 'ghost', run: () => d.close() }]);
  let info = null, problem = '';
  try { info = (await rpc('info', { id: id })).data; } catch (e) { problem = e.message || String(e); }
  if (!d.alive) return;
  if (info) { remember(info); d.sub(cardLine(sel, info)); decorate(); }
  if (info && info.can_send && info.status === READY) {
    d.body(messageBlock(info, 'Vuoi mandare al cliente il messaggio WhatsApp «busta pronta»?'));
    d.actions([
      { id: 'send', label: 'Sì, invia il messaggio', kind: 'primary', busy: 'Invio…', run: async () => {
        const x = await rpc('send', { id: id });
        remember(x.data);
        d.close();
        decorate();
        schedulePoll();
        toast(x.repeat ? 'Avviso già confermato poco fa: ne parte uno solo.' : 'Avviso confermato. ' + sendAtText(x.data || {}));
      } },
      { id: 'cancel', label: 'Annulla', kind: 'ghost', run: () => d.close() },
    ]);
  } else {
    const why = !info ? 'Non riesco a controllare l’avviso WhatsApp: ' + problem
      : info.status !== READY ? 'La busta non è più in «Pronto per la consegna»: premi Aggiorna.'
      : (info.block_reason || 'Avviso WhatsApp non disponibile.');
    d.body([el('p', 'lrnWarn', why)]);
    d.actions([{ id: 'cancel', label: 'Chiudi', kind: 'primary', run: () => d.close() }]);
  }
}

async function askCancel(id) {
  const sel = selectFor(id);
  const d = openDialog('Annullare l’avviso WhatsApp?', cardLine(sel, (cache.get(id) || {}).info));
  d.body([el('p', 'lrnNote', 'Il messaggio «busta pronta» non partirà. Potrai mandarlo più tardi con «Avvisa il cliente su WhatsApp».')]);
  d.actions([
    { id: 'confirm-cancel', label: 'Sì, annulla l’avviso', kind: 'primary', busy: 'Annullo…', run: async () => {
      const x = await rpc('cancel', { id: id });
      remember(x.data);
      d.close();
      decorate();
      toast(x.cancelled ? 'Avviso annullato: il messaggio non partirà.' : 'Il messaggio era già in invio e non si può più fermare.', !x.cancelled);
    } },
    { id: 'cancel', label: 'No', kind: 'ghost', run: () => d.close() },
  ]);
}

/* ---------- stato dell'avviso sotto le buste pronte ---------- */
function slotState(info) {
  if (!info) return null;
  if (info.pending) {
    return { cls: 'wait', text: 'Avviso WhatsApp in partenza' + (info.send_at === 'now' ? '' : ' alle 8:00'),
      note: 'Confermato' + (info.pending.requested_by ? ' da ' + info.pending.requested_by : '') + ' il ' + when(info.pending.requested_at),
      button: { action: 'cancel', label: 'Annulla avviso' } };
  }
  const last = info.last;
  const again = info.can_send ? { action: 'send', label: 'Invia di nuovo' } : null;
  if (last && last.status === 'sending') return { cls: 'wait', text: 'Avviso WhatsApp in invio…' };
  if (last && last.status === 'sent') {
    return { cls: last.delivery === 'failed' ? 'bad' : 'ok', text: 'Avviso WhatsApp inviato il ' + when(last.at) + deliveryText(last), button: again };
  }
  if (last && (last.status === 'failed' || last.status === 'skipped')) {
    return { cls: 'bad', text: 'Avviso WhatsApp non inviato' + (last.error ? ': ' + last.error : ''),
      button: info.can_send ? { action: 'send', label: 'Riprova' } : null };
  }
  if (!info.can_send) return { cls: 'muted', text: 'Avviso WhatsApp non disponibile: ' + (info.block_reason || '') };
  // Pulsante verde per le buste pronte da poco; per quelle ferme da più di 14 giorni resta un pulsante normale.
  const since = Date.parse(info.status_since);
  const recent = !isNaN(since) && Date.now() - since < 14 * 86400000;
  return { cls: 'none', text: 'Cliente non ancora avvisato su WhatsApp.', button: { action: 'send', label: 'Avvisa il cliente su WhatsApp', primary: recent } };
}

function renderSlot(box, id, entry) {
  let slot = box.querySelector('.lrnSlot');
  const state = entry && entry.error ? { cls: 'muted', text: 'Stato avviso WhatsApp non disponibile: ' + entry.error } : slotState(entry && entry.info);
  if (!state) { if (slot) slot.remove(); return; }
  const sig = JSON.stringify(state);
  if (slot && slot.getAttribute('data-sig') === sig) return;
  if (!slot) { slot = el('div', 'lrnSlot'); box.appendChild(slot); }
  const nodes = [el('div', 'lrnState ' + state.cls, state.text)];
  if (state.note) nodes.push(el('div', 'lrnMuted', state.note));
  if (state.button) {
    const b = el('button', state.button.primary ? 'primary' : '', state.button.label);
    b.type = 'button';
    b.setAttribute('data-lrn', state.button.action);
    b.setAttribute('data-lrn-id', id);
    nodes.push(b);
  }
  slot.replaceChildren(...nodes);
  slot.setAttribute('data-sig', sig);
}

function decorate() {
  const list = E('labOrdersList');
  if (!list) return;
  const need = [];
  list.querySelectorAll('.labCard').forEach((card) => {
    const box = card.querySelector('.labStatusBox');
    const sel = box && box.querySelector('select');
    const id = idOf(sel);
    if (!id) return;
    if (savedStatus(sel) !== READY) { const s = box.querySelector('.lrnSlot'); if (s) s.remove(); return; }
    const entry = cache.get(id);
    if (!entry || Date.now() - entry.at > TTL) need.push(id);
    renderSlot(box, id, entry);
  });
  if (need.length) fetchLater(need);
}

function fetchLater(ids) {
  ids.forEach((id) => wanted.add(id));
  clearTimeout(statusTimer);
  statusTimer = setTimeout(fetchStatus, 250);
}

async function fetchStatus() {
  const ids = Array.from(wanted).slice(0, 300);
  wanted.clear();
  if (!ids.length || !labVisible()) return;
  const now = Date.now();
  try {
    const x = await rpc('status', { ids: ids });
    const seen = new Set();
    (x.data || []).forEach((info) => { seen.add(info.id); cache.set(info.id, { info: info, at: now }); });
    ids.forEach((id) => { if (!seen.has(id)) cache.set(id, { info: null, at: now }); });
  } catch (e) {
    ids.forEach((id) => cache.set(id, { info: null, error: e.message || String(e), at: now }));
  }
  decorate();
  schedulePoll();
}

// Mentre un avviso è in partenza, ricontrolla ogni 20 secondi (solo con il Laboratorio aperto).
function schedulePoll() {
  clearTimeout(pollTimer);
  const busy = [];
  cache.forEach((v, id) => {
    const i = v.info;
    if (i && (i.pending || (i.last && i.last.status === 'sending'))) busy.push(id);
  });
  if (!busy.length) return;
  pollTimer = setTimeout(() => {
    if (!labVisible()) return;
    busy.forEach((id) => { const v = cache.get(id); if (v) v.at = 0; });
    decorate();
  }, 20000);
}

function queueDecorate() {
  if (queued) return;
  queued = true;
  setTimeout(() => { queued = false; decorate(); }, 60);
}

function own(node) {
  return node && node.nodeType === 1 && (node.classList.contains('lrnSlot') || node.classList.contains('lrnMark') || !!node.closest('.lrnSlot'));
}

/* ---------- avvisi brevi ---------- */
function toast(message, bad) {
  let t = E('lrnToast');
  if (!t) { t = el('div'); t.id = 'lrnToast'; t.setAttribute('role', 'status'); t.setAttribute('aria-live', 'polite'); document.body.appendChild(t); }
  t.textContent = message;
  t.className = 'show' + (bad ? ' bad' : '');
  clearTimeout(t._lrn);
  t._lrn = setTimeout(() => { t.className = ''; }, 7000);
}

/* ---------- aggancio ---------- */
function install() {
  const fn = window.labUpdateStatus;
  if (typeof fn !== 'function' || fn.__lrn) return;
  const wrapped = function (id, status) {
    if (status !== READY) return fn.apply(this, arguments);
    return askReady(txt(id), fn);
  };
  wrapped.__lrn = true;
  window.labUpdateStatus = wrapped;
}

const css = el('style');
css.id = 'optykerLabReadyNoticeCss';
css.textContent =
  '.lrnOverlay{position:fixed;inset:0;z-index:2147483000;background:rgba(15,30,45,.48);display:flex;align-items:center;justify-content:center;padding:16px}' +
  '.lrnDialog{background:#fff;color:#17324a;border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,.28);width:min(540px,100%);max-height:calc(100vh - 32px);overflow:auto;padding:20px 20px 16px;font:14px/1.45 system-ui,-apple-system,"Segoe UI",Arial,sans-serif;text-align:left}' +
  '.lrnDialog h2{margin:0 0 4px;font-size:19px;font-weight:850;color:#17324a}' +
  '.lrnSub{margin:0 0 10px;color:#5d7385;font-size:13px;font-weight:650}' +
  '.lrnQuestion{margin:6px 0 8px;font-weight:750}' +
  '.lrnRows{display:grid;grid-template-columns:auto 1fr;gap:3px 12px;margin:8px 0;font-size:14px}' +
  '.lrnRows dt{color:#5d7385}.lrnRows dd{margin:0;font-weight:750}' +
  '.lrnPreview{white-space:pre-wrap;background:#e9f8ee;border:1px solid #c3e8cf;border-radius:12px;padding:10px 12px;font-size:13px;color:#1c3b2a;margin:10px 0}' +
  '.lrnNote{font-size:12.5px;color:#5d7385;margin:8px 0}' +
  '.lrnWarn{font-size:13px;background:#fff6e5;border:1px solid #f1d59c;color:#7a4e00;border-radius:10px;padding:8px 10px;margin:8px 0}' +
  '.lrnError{font-size:13px;background:#fdecec;border:1px solid #f3c1c1;color:#9b1c1c;border-radius:10px;padding:8px 10px;margin:8px 0}' +
  '.lrnActions{display:flex;flex-wrap:wrap;gap:8px;justify-content:flex-end;margin-top:14px}' +
  '.lrnActions button{min-height:44px;padding:10px 16px;border-radius:10px;border:1px solid #c9d6e0;background:#fff;color:#17324a;font:inherit;font-weight:750;cursor:pointer}' +
  '.lrnActions button.primary{background:#1f9d55;border-color:#1a8a4a;color:#fff}' +
  '.lrnActions button.ghost{border-color:transparent;background:transparent;color:#5d7385}' +
  '.lrnActions button:disabled{opacity:.6;cursor:default}' +
  '.lrnSlot{margin-top:4px;padding-top:7px;border-top:1px dashed #dce5ec;font-size:10px;line-height:1.4;color:#36536a}' +
  '.lrnSlot .lrnState{font-weight:850}.lrnSlot .lrnState.ok{color:#1a7f45}.lrnSlot .lrnState.wait{color:#9a6700}.lrnSlot .lrnState.bad{color:#b42318}.lrnSlot .lrnState.muted,.lrnSlot .lrnMuted{color:#7a8a96;font-weight:600}' +
  '.lrnSlot button{display:block;margin-top:6px;padding:7px 10px;border-radius:9px;border:1px solid #c9d6e0;background:#fff;color:#17324a;font:inherit;font-size:10.5px;font-weight:850;cursor:pointer}' +
  '.lrnSlot button.primary{background:#1f9d55;border-color:#1a8a4a;color:#fff}' +
  '#lrnToast{position:fixed;left:50%;bottom:24px;transform:translate(-50%,16px);opacity:0;pointer-events:none;background:#17324a;color:#fff;padding:10px 16px;border-radius:12px;font:650 13px/1.4 system-ui,-apple-system,"Segoe UI",Arial,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.22);transition:opacity .2s,transform .2s;z-index:2147483001;max-width:min(560px,calc(100vw - 32px))}' +
  '#lrnToast.show{opacity:1;transform:translate(-50%,0)}#lrnToast.bad{background:#9b1c1c}';
document.head.appendChild(css);

document.addEventListener('click', (ev) => {
  const b = ev.target && ev.target.closest && ev.target.closest('.lrnSlot [data-lrn]');
  if (!b) return;
  ev.preventDefault();
  const id = b.getAttribute('data-lrn-id');
  if (b.getAttribute('data-lrn') === 'cancel') askCancel(id); else askSend(id);
});

new MutationObserver((records) => {
  const list = E('labOrdersList');
  if (!list) return;
  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    if (r.target !== list && !list.contains(r.target)) continue;
    if (own(r.target)) continue;
    const nodes = Array.prototype.slice.call(r.addedNodes).concat(Array.prototype.slice.call(r.removedNodes));
    if (nodes.length && nodes.every(own)) continue;
    queueDecorate();
    return;
  }
}).observe(document.documentElement, { childList: true, subtree: true });

install();
setInterval(install, 1000);
queueDecorate();
})();

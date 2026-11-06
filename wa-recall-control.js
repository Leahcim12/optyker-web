/* Optyker: WhatsApp eye-exam recall per client, shown in the optometric prescription panel.
   "Controllo 6 mesi" switches this client's recall from the default (24 months, 12 if under 18) to every 6 months. */
(function () {
'use strict';
if (window.OPTYKER_WA_RECALL) return;
window.OPTYKER_WA_RECALL = '20261107-controllo6';
const ENDPOINT = 'https://whgziwaegjzqsgcntesr.supabase.co/functions/v1/optyker-whatsapp-360';
const $ = id => document.getElementById(id);
const client = () => String(window.clientCurrentId || '');
const it = d => d ? String(d).slice(0, 10).split('-').reverse().join('/') : '';
let shownFor = '', seq = 0, busy = false, info = null;

async function api(action, payload) {
  const c = window.OPTYKER_CLOUD || {};
  if (!c.username || !c.password) throw Error('Accedi a Optyker.');
  const r = await fetch(ENDPOINT, {method: 'POST', cache: 'no-store', signal: AbortSignal.timeout(20000),
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({username: c.username, password: c.password, action, payload})});
  const x = await r.json().catch(() => ({}));
  if (!r.ok || !x.ok) throw Error(x.error || 'Operazione non riuscita.');
  return x.data || {};
}

function render() {
  const box = $('waRecallBox'); if (!box) return;
  const btn = $('waRecall6'), txt = $('waRecallText');
  const six = info && info.custom_months === 6;
  btn.textContent = six ? 'Controllo 6 mesi: attivo' : 'Controllo 6 mesi';
  btn.setAttribute('aria-pressed', six ? 'true' : 'false');
  btn.classList.toggle('on', six);
  btn.disabled = busy || !client() || !info;
  if (!client()) { txt.textContent = 'Seleziona un cliente.'; return; }
  if (!info) { txt.textContent = 'Richiamo WhatsApp: caricamento…'; return; }
  const every = six ? 'ogni 6 mesi' : (info.months === 12 ? 'ogni 12 mesi (minorenne)' : 'ogni ' + info.months + ' mesi');
  let t = 'Richiamo WhatsApp esame vista: ' + every + '.';
  if (info.next_due) t += ' Prossimo: ' + it(info.next_due) + '.';
  else t += ' Partirà dopo il primo esame salvato.';
  if (!info.has_phone) t += ' Manca il cellulare del cliente.';
  if (info.enabled === false) t += ' (Automazione spenta)';
  txt.textContent = t;
}

function status(message, bad) { const e = $('waRecallStatus'); if (e) { e.textContent = message || ''; e.classList.toggle('bad', !!bad); } }

async function load() {
  const id = client(), my = ++seq; info = null; status(''); render();
  if (!id) return;
  try { const x = await api('eye_pref_get', {client_id: id}); if (my === seq && id === client()) { info = x; render(); } }
  catch (e) { if (my === seq) status(e.message, true); }
}

async function toggle() {
  const id = client(); if (!id || !info || busy) return;
  busy = true; render(); status('Salvataggio…');
  try {
    const x = await api('eye_pref_set', {client_id: id, months: info.custom_months === 6 ? null : 6});
    if (id === client()) { info = x; status(info.custom_months === 6 ? 'Salvato: richiamo ogni 6 mesi.' : 'Salvato: richiamo standard.'); }
  } catch (e) { status(e.message, true); }
  finally { busy = false; render(); }
}

function ensure() {
  const panel = $('prescriptionPanel'); if (!panel) return;
  if (!$('waRecallBox')) {
    const box = document.createElement('section'); box.id = 'waRecallBox';
    box.innerHTML = '<span id="waRecallText"></span><button type="button" id="waRecall6" aria-pressed="false">Controllo 6 mesi</button><span id="waRecallStatus" role="status" aria-live="polite"></span>';
    const anchor = $('rxOphthalmicBlock') || panel.querySelector('.rxTitleRow');
    if (anchor) anchor.after(box); else panel.prepend(box);
    $('waRecall6').onclick = toggle;
    shownFor = ''; render();
  }
  if (shownFor !== client()) { shownFor = client(); load(); }
}

const css = document.createElement('style');
css.textContent = '#waRecallBox{display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px;margin:8px 0 12px;padding:10px 12px;border:1px solid #cfe3dc;border-radius:10px;background:#f4faf8;font-size:13px}' +
  '#waRecallBox #waRecallText{flex:1 1 260px}' +
  '#waRecall6{padding:7px 12px;border-radius:8px;border:1px solid #25a36f;background:#fff;color:#1d7a54;font-weight:600;cursor:pointer}' +
  '#waRecall6.on{background:#25a36f;color:#fff}#waRecall6:disabled{opacity:.6;cursor:default}' +
  '#waRecallStatus{flex-basis:100%;font-size:12px;color:#1d7a54}#waRecallStatus:empty{display:none}#waRecallStatus.bad{color:#b42318}' +
  '@media print{#waRecallBox{display:none!important}}';
document.head.appendChild(css);
setInterval(ensure, 800);
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ensure, {once: true}); else ensure();
})();

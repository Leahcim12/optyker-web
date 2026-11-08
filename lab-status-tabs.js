/* Optyker Laboratorio: separa le buste in quattro schede (In corso, In preparazione, Consegnate, Annullate).
   Non cambia il caricamento né il salvataggio: legge lo stato dal menu di ogni scheda e mostra solo quelle della scheda scelta. */
(function () {
'use strict';
if (window.OPTYKER_LAB_TABS) return;
window.OPTYKER_LAB_TABS = '20261108';
const TABS = [
  { id: 'open', label: 'In corso', match: (s) => !['in_preparazione', 'completato', 'annullato'].includes(s) },
  { id: 'prep', label: 'In preparazione', match: (s) => s === 'in_preparazione' },
  { id: 'done', label: 'Consegnate', match: (s) => s === 'completato' },
  { id: 'cancelled', label: 'Annullate', match: (s) => s === 'annullato' },
];
let active = 'open', busy = false;
try { active = localStorage.getItem('optykerLabTab') || 'open'; } catch (e) { /* ignore */ }
if (!TABS.some((t) => t.id === active)) active = 'open';

function bar(list) {
  let b = document.getElementById('labStatusTabs');
  if (b) return b;
  b = document.createElement('div');
  b.id = 'labStatusTabs';
  b.setAttribute('role', 'tablist');
  b.innerHTML = TABS.map((t) => '<button type="button" role="tab" data-lab-tab="' + t.id + '">' + t.label + ' <span>0</span></button>').join('');
  list.parentNode.insertBefore(b, list);
  b.addEventListener('click', (ev) => {
    const btn = ev.target.closest('[data-lab-tab]');
    if (!btn) return;
    active = btn.getAttribute('data-lab-tab');
    try { localStorage.setItem('optykerLabTab', active); } catch (e) { /* ignore */ }
    apply();
  });
  return b;
}

function apply() {
  const list = document.getElementById('labOrdersList');
  if (!list || busy) return;
  busy = true;
  try {
    const b = bar(list);
    const cards = [...list.querySelectorAll('.labCard')];
    const counts = { open: 0, prep: 0, done: 0, cancelled: 0 };
    for (const c of cards) {
      const s = c.querySelector('.labStatusBox select')?.value || '';
      const tab = TABS.find((t) => t.match(s)) || TABS[0];
      counts[tab.id]++;
      c.style.display = tab.id === active ? '' : 'none';
    }
    b.querySelectorAll('[data-lab-tab]').forEach((x) => {
      const id = x.getAttribute('data-lab-tab');
      x.classList.toggle('on', id === active);
      x.setAttribute('aria-selected', id === active ? 'true' : 'false');
      const sp = x.querySelector('span');
      if (sp.textContent !== String(counts[id])) sp.textContent = String(counts[id]);
    });
    let empty = document.getElementById('labTabEmpty');
    const none = cards.length > 0 && counts[active] === 0;
    if (none && !empty) {
      empty = document.createElement('div');
      empty.id = 'labTabEmpty';
      empty.className = 'labEmpty';
      list.appendChild(empty);
    }
    if (empty) {
      empty.style.display = none ? '' : 'none';
      const msg = 'Nessuna busta in "' + TABS.find((t) => t.id === active).label + '".';
      if (empty.textContent !== msg) empty.textContent = msg;
    }
  } finally {
    busy = false;
  }
}

const css = document.createElement('style');
css.textContent = '#labStatusTabs{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0 14px}' +
  '#labStatusTabs button{padding:8px 14px;border-radius:999px;border:1px solid rgba(0,0,0,.15);background:#fff;color:inherit;font:inherit;font-weight:600;cursor:pointer}' +
  '#labStatusTabs button span{display:inline-block;min-width:20px;margin-left:4px;padding:1px 7px;border-radius:999px;background:rgba(0,0,0,.07);font-size:12px}' +
  '#labStatusTabs button.on{background:#1f2937;color:#fff;border-color:#1f2937}#labStatusTabs button.on span{background:rgba(255,255,255,.2)}';
document.head.appendChild(css);

// La lista viene ridisegnata a ogni caricamento, ricerca o cambio di stato: riapplica la scheda scelta.
// Si ricalcola solo quando cambia qualcosa dentro la lista del laboratorio (o quando la lista compare).
new MutationObserver((records) => {
  if (busy) return;
  const list = document.getElementById('labOrdersList');
  if (!list) return;
  if (!document.getElementById('labStatusTabs') || records.some((r) => list.contains(r.target) && r.target !== document.getElementById('labTabEmpty'))) apply();
}).observe(document.documentElement, { childList: true, subtree: true });
document.addEventListener('change', (ev) => { if (ev.target.closest && ev.target.closest('#labOrdersList')) setTimeout(apply, 0); }, true);
})();

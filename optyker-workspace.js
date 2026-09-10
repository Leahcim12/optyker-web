/* OPTYKER VISION WORKSPACE / 20260910-workspace1
 * Presentation and accessible labels only. No network, storage, form values,
 * authentication, calendar geometry or application event handlers are changed.
 */
(function () {
  'use strict';
  if (window.__optykerWorkspaceV1) return;
  window.__optykerWorkspaceV1 = true;
  var version = '20260910-workspace1', root = document.documentElement;
  function byId(id) { return document.getElementById(id); }
  function setAttr(node, name, value) {
    if (node && node.getAttribute(name) !== value) node.setAttribute(name, value);
  }
  function label(id, text) {
    var el = byId(id);
    if (el && !el.hasAttribute('aria-label')) el.setAttribute('aria-label', text);
    if (el && !el.hasAttribute('title')) el.setAttribute('title', text);
  }
  function visible(el) {
    return !!el && !el.hidden && el.getClientRects().length > 0 && getComputedStyle(el).display !== 'none';
  }
  function activeWorkspace() {
    var view = visible(byId('clientsPanel')) ? 'clients' : visible(byId('optykerAppointmentsPanel')) ? 'agenda' : '';
    if (view) setAttr(root, 'data-optyker-active-workspace', view);
    else root.removeAttribute('data-optyker-active-workspace');
  }
  function appointmentLabels() {
    var calendar = byId('oaCalendar');
    if (!calendar) return;
    calendar.querySelectorAll('.oaEvent[data-id],.oaMonthEvent[data-id]').forEach(function (event) {
      var content = Array.from(event.children).map(function (x) { return x.textContent.trim(); }).filter(Boolean).join(' · ');
      content = content || event.textContent.trim();
      if (content) {
        setAttr(event, 'title', content);
        setAttr(event, 'aria-label', content);
      }
    });
    label('oaCalendar', 'Calendario appuntamenti. Scorri per vedere tutti i giorni e gli orari.');
    setAttr(calendar, 'tabindex', '0');
  }
  function formLabels() {
    document.querySelectorAll('#oaNewModal .oaF,#oaManageModal .oaV10F').forEach(function (field) {
      var l = field.querySelector(':scope > label');
      var control = field.querySelector(':scope > input[id],:scope > select[id],:scope > textarea[id]');
      if (l && control && !l.htmlFor && !l.querySelector('input,select,textarea')) l.htmlFor = control.id;
    });
    label('oaPrev', 'Periodo precedente'); label('oaNext', 'Periodo successivo');
    label('oaOpFilter', 'Filtra per operatore'); label('oaStudioFilter', 'Filtra per studio');
    label('oa17Search', 'Cerca appuntamenti per nome o cognome');
    label('clientArchiveSearch', 'Cerca nell’archivio clienti');
    document.querySelectorAll('#oaNewModal .oaClose,#oaManageModal .oaClose').forEach(function (x) {
      if (!x.hasAttribute('aria-label')) x.setAttribute('aria-label', 'Chiudi appuntamento');
    });
  }
  // Legacy add-ons can append whole cards inside the narrow name/avatar row.
  // Move only those existing nodes to a responsive area, preserving their handlers.
  var printing = false, moved = [];
  function clientToolLayout() {
    if (printing) return;
    var hero = byId('clientWorkspaceHero'), edit = byId('clientEditView');
    if (!hero || !edit) return;
    moved = moved.filter(function (entry) { return entry.node.isConnected; });
    var ids = ['optykerClientReferenceTools','optykerClientClinicalTools','optykerClientAnomalyTools','optykerClientPaymentTools'];
    var nodes = ids.map(byId).filter(function (node) { return node && hero.contains(node); });
    if (!nodes.length) return;
    var holder = byId('optykerWorkspaceClientTools');
    if (!holder) {
      holder = document.createElement('div'); holder.id = 'optykerWorkspaceClientTools';
      edit.appendChild(holder);
    }
    nodes.forEach(function (node) {
      var entry = moved.find(function (x) { return x.node === node; });
      if (!entry) {
        var place = document.createComment('optyker-workspace-original-position');
        node.parentNode.insertBefore(place, node);
        entry = {node:node, place:place}; moved.push(entry);
      }
      holder.appendChild(node);
    });
  }
  window.addEventListener('beforeprint', function () {
    printing = true;
    moved.forEach(function (entry) {
      if (entry.node.isConnected && entry.place.isConnected) entry.place.parentNode.insertBefore(entry.node, entry.place.nextSibling);
    });
  });
  window.addEventListener('afterprint', function () { printing = false; clientToolLayout(); });
  function boot() {
    if (!byId('clientsPanel') || !byId('optykerAppointmentsPanel')) return;
    setAttr(root, 'data-optyker-workspace-release', version);
    var title = document.querySelector('#clientsPanel .clientTitle');
    if (title && title.textContent.trim() === 'CLIENTI') title.textContent = 'Clienti';
    activeWorkspace(); formLabels(); appointmentLabels(); clientToolLayout();
    var hero = byId('clientWorkspaceHero');
    if (hero) new MutationObserver(clientToolLayout).observe(hero, {childList:true,subtree:true});
    var scheduled = false;
    function schedule() {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(function () { scheduled = false; activeWorkspace(); });
    }
    var observer = new MutationObserver(schedule);
    ['mainApp', 'clientsPanel', 'optykerAppointmentsPanel'].forEach(function (id) {
      var node = byId(id);
      if (node) observer.observe(node, { attributes: true, attributeFilter: ['style','class','hidden'] });
    });
    var calendar = byId('oaCalendar');
    if (calendar) new MutationObserver(appointmentLabels).observe(calendar, {childList:true,subtree:true,characterData:true});
    ['oaNewModal','oaManageModal'].forEach(function (id) {
      var node = byId(id);
      if (node) new MutationObserver(formLabels).observe(node, {attributes:true,attributeFilter:['class'],childList:true,subtree:false});
    });
    window.addEventListener('pageshow', schedule);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once:true});
  else boot();
}());

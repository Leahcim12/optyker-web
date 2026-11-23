/* OPTYKER VISION SERVICES / 20260910-services1
 * Accessibility only. No network, storage, business handlers or form values.
 */
(function () {
 'use strict';
 if (window.__optykerServicesV1) return;
 window.__optykerServicesV1 = true;
 function attr(el, name, value) { if (el && el.getAttribute(name) !== value) el.setAttribute(name, value); }
 function label(id, text) { var el=document.getElementById(id); if(el && !el.hasAttribute('aria-label')) attr(el,'aria-label',text); }
 var placements=[],printing=false;
 function cashFooter(){
  if(printing)return;
  var cart=document.querySelector('#optykerCashOverlay .optykerCashCart');
  var checkout=cart&&cart.querySelector('.optykerCashCheckout');
  if(!checkout)return;
  var nodes=[checkout.querySelector('.optykerCashRchHelp'),checkout.querySelector('#optykerCashCheckoutBtn'),checkout.querySelector('.optykerCashSecondaryActions')].filter(Boolean);
  if(!nodes.length)return;
  var footer=cart.querySelector('.optykerServicesCashFooter');
  if(!footer){footer=document.createElement('div');footer.className='optykerServicesCashFooter';cart.appendChild(footer);}
  nodes.forEach(function(node){
   if(!placements.some(function(p){return p.node===node;})){
    var marker=document.createComment('optyker-services-original-position');node.parentNode.insertBefore(marker,node);placements.push({node:node,marker:marker});
   }
   footer.appendChild(node);
  });
 }
 window.addEventListener('beforeprint',function(){printing=true;placements.forEach(function(p){if(p.node.isConnected&&p.marker.isConnected)p.marker.parentNode.insertBefore(p.node,p.marker.nextSibling);});});
 window.addEventListener('afterprint',function(){printing=false;cashFooter();});
 function enhance() {
  cashFooter();
  var labels={
   optykerChatClientSelect:'Seleziona il cliente per aprire una conversazione',optykerChatSearch:'Cerca nelle conversazioni',
   optykerChatText:'Messaggio al cliente',clientChatText:'Messaggio nella chat del cliente',
   optykerCashSearch:'Cerca nel catalogo della cassa',optykerCashClientSearch:'Cerca un cliente per la vendita',
   optykerCashClient:'Cliente della vendita',optykerCashClose:'Chiudi la cassa',
   optykerCashDeposit:'Importo acconto in euro',optykerCashNote:'Nota della vendita',
   optykerChatMessages:'Messaggi della conversazione',clientChatMessages:'Messaggi del cliente'
  };
  Object.keys(labels).forEach(function(id){label(id,labels[id]);});
  ['optykerChatStatus','clientChatStatus'].forEach(function(id){var el=document.getElementById(id);attr(el,'role','status');attr(el,'aria-live','polite');});
  document.querySelectorAll('.optykerDocsPanel').forEach(function(panel){
   [['.optykerDocsSearch','Cerca documenti'],['.optykerDocsYear','Filtra documenti per anno'],['.optykerDocsMonth','Filtra documenti per mese']].forEach(function(pair){var el=panel.querySelector(pair[0]);if(el&&!el.hasAttribute('aria-label'))attr(el,'aria-label',pair[1]);});
   var wrap=panel.querySelector('.optykerDocsTableWrap');attr(wrap,'tabindex','0');attr(wrap,'role','region');
   attr(wrap,'aria-label','Archivio documenti. Scorri orizzontalmente per tutte le colonne.');
   var table=panel.querySelector('table');attr(table,'aria-label',panel.id==='optykerDdtPanel'?'Documenti di trasporto':'Fatture clienti');
   panel.querySelectorAll('th').forEach(function(th){attr(th,'scope','col');});
  });
  document.querySelectorAll('.optykerDdtField').forEach(function(field){var l=field.querySelector(':scope > label'),el=field.querySelector(':scope > input[id],:scope > select[id],:scope > textarea[id]');if(l&&el&&!l.htmlFor&&!l.querySelector('input,select,textarea'))l.htmlFor=el.id;});
  document.querySelectorAll('.optykerDdtClose').forEach(function(el){attr(el,'aria-label','Chiudi il documento di trasporto');});
  document.querySelectorAll('.optykerDdtRemove').forEach(function(el){attr(el,'aria-label','Rimuovi questa riga dal documento');});
  document.querySelectorAll('#optykerCashCartItems [data-minus]').forEach(function(el){attr(el,'aria-label','Diminuisci quantità');});
  document.querySelectorAll('#optykerCashCartItems [data-plus]').forEach(function(el){attr(el,'aria-label','Aumenta quantità');});
  document.querySelectorAll('.optykerCashStage,.optykerCashPayMode,.optykerCashType,.optykerChatChannelBtn').forEach(function(el){attr(el,'aria-pressed',el.classList.contains('active')?'true':'false');});
  document.querySelectorAll('.clientChatPhoto').forEach(function(el){attr(el,'tabindex','0');attr(el,'role','button');attr(el,'aria-label','Ingrandisci la foto allegata');});
 }
 function boot(){
  if(!document.getElementById('mainApp'))return;
  enhance();
  var pending=false;
  new MutationObserver(function(changes){
   if(!changes.some(function(c){return c.type==='childList'||(c.target.matches&&c.target.matches('.optykerCashStage,.optykerCashPayMode,.optykerCashType,.optykerChatChannelBtn'));}))return;
   if(pending)return;pending=true;
   requestAnimationFrame(function(){pending=false;enhance();});
  }).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
  document.addEventListener('keydown',function(e){if((e.key==='Enter'||e.key===' ')&&e.target.matches&&e.target.matches('.clientChatPhoto')){e.preventDefault();e.target.click();}});
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
}());

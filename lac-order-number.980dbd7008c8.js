/* OPTYKER_LAC_ORDER_NUMBER_20261121
   Scheda LAC: riporta il «Numero d'ordine» di ciascuna lente (caselle lacOdOrderNumber e lacOsOrderNumber in
   Prodotto -> Identificazione lenti e richiami) nel modulo riepilogativo, subito dopo il lotto della stessa
   lente. Stampa e invio al Laboratorio usano il contenuto del riepilogo, quindi lo riportano anche loro.
   Osserva #lacSummaryBody invece di avvolgere lacOpenSummary, già avvolta da altri moduli. */
(function(){
'use strict';
if(window.__optykerLacOrderNumber)return;
window.__optykerLacOrderNumber='20261121-lac-order2';
var SECTION='Identificazione lenti e richiami',
    DATES=['Data richiamo per riordino','Data richiamo scheda per riordino','Data controllo'],
    ROWS=[{key:'od',id:'lacOdOrderNumber',label:'Numero d\'ordine lente DX',before:['Colore lente SX','Lotto lente SX'].concat(DATES)},
          {key:'os',id:'lacOsOrderNumber',label:'Numero d\'ordine lente SX',before:DATES}];
function E(id){return document.getElementById(id)}
function txt(v){return String(v==null?'':v).replace(/\s+/g,' ').trim()}
function make(tag,cls,text){var n=document.createElement(tag);n.className=cls;if(text!=null)n.textContent=text;return n}
function wanted(){
  var out=[],i,f,v;
  for(i=0;i<ROWS.length;i++){f=E(ROWS[i].id);v=f?txt(f.value):'';if(v)out.push({row:ROWS[i],value:v})}
  return out;
}
function shown(body){
  var list=body.querySelectorAll('[data-lac-order-number]'),out=[],i,c;
  for(i=0;i<list.length;i++){c=list[i].querySelector('.lacSummaryRowValue');out.push(list[i].getAttribute('data-lac-order-number')+'='+(c?txt(c.textContent):''))}
  return out.join('|');
}
function traceSection(body){
  var list=body.querySelectorAll('.lacSummarySection'),i,h;
  for(i=0;i<list.length;i++){h=list[i].querySelector('.lacSummarySectionHead');if(h&&txt(h.textContent)===SECTION)return list[i]}
  return null;
}
function place(rows,spec,value){
  var next=null,i,label;
  for(i=0;i<rows.children.length&&!next;i++){
    label=rows.children[i].querySelector('.lacSummaryRowLabel');
    if(label&&spec.before.indexOf(txt(label.textContent))>=0)next=rows.children[i];
  }
  var row=make('div','lacSummaryRow');row.setAttribute('data-lac-order-number',spec.key);
  row.appendChild(make('div','lacSummaryRowLabel',spec.label));
  row.appendChild(make('div','lacSummaryRowValue',value));
  rows.insertBefore(row,next);
}
function sync(){
  var body=E('lacSummaryBody');if(!body)return;
  var want=wanted(),first=body.querySelector('.lacSummarySection'),i;
  if(shown(body)===want.map(function(w){return w.row.key+'='+w.value}).join('|')&&(want.length===0||first))return;
  var old=body.querySelectorAll('[data-lac-order-number]');
  for(i=0;i<old.length;i++)if(old[i].parentNode)old[i].parentNode.removeChild(old[i]);
  var own=body.querySelector('[data-lac-order-number-section]');
  if(own&&!own.querySelector('.lacSummaryRow')&&own.parentNode)own.parentNode.removeChild(own);
  first=body.querySelector('.lacSummarySection');
  if(!want.length||!first)return;
  var section=traceSection(body);
  if(!section){
    section=make('section','lacSummarySection');section.setAttribute('data-lac-order-number-section','');
    section.appendChild(make('div','lacSummarySectionHead',SECTION));
    section.appendChild(make('div','lacSummaryRows'));
    first.parentNode.insertBefore(section,first.nextSibling);
  }
  var rows=section.querySelector('.lacSummaryRows')||section;
  for(i=0;i<want.length;i++)place(rows,want[i].row,want[i].value);
}
function start(){
  var body=E('lacSummaryBody');if(!body||!window.MutationObserver)return;
  new MutationObserver(sync).observe(body,{childList:true,subtree:true});
  sync();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();

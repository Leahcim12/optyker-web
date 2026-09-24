/* OPTYKER_CASH_CLOSURE_ACCESS_20260925: open the review, never submit a fiscal operation. */
(function(){
 'use strict';
 if(window.__OPTYKER_UNIFIED_CASH_BUTTONS__)return;
 window.__OPTYKER_UNIFIED_CASH_BUTTONS__=true;
 var SELECTOR='#optykerCashDayCloseBtn,#optykerCashClosureBtn,#optykerCashDayOpenBtn';
 function today(){
  var parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()),p={};
  parts.forEach(function(x){p[x.type]=x.value});return p.year+'-'+p.month+'-'+p.day;
 }
 function validDate(value){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||value>today())return false;
  var parsed=new Date(value+'T12:00:00Z');return !isNaN(parsed.getTime())&&parsed.toISOString().slice(0,10)===value;
 }
 function installDateAccess(){
  var sessions=window.OPTYKER_CASH_SESSIONS;
  if(!sessions||typeof sessions.open!=='function'||sessions.open.__closureDateAccess)return;
  var original=sessions.open;
  var wrapped=function(kind,date,admin){
   var before=document.getElementById('optykerCashSessionsModal');
   var result=original.apply(this,arguments);
   var modal=document.getElementById('optykerCashSessionsModal');
   // A busy operation refuses navigation. Never change its context or the displayed date.
   if(kind!=='close'||!modal||modal===before)return result;
   var body=modal.querySelector('.csBody');if(!body||!body.parentNode)return result;
   var controls=document.createElement('div');controls.className='csDateAccess';
   var label=document.createElement('label');label.textContent='Giornata da chiudere';
   var input=document.createElement('input');input.type='date';input.id='csBusinessDate';input.max=today();input.value=date;
   input.setAttribute('aria-label','Giornata da chiudere');
   input.style.cssText='display:block;margin:6px 0;padding:9px;border:1px solid #b9c7cf;border-radius:6px;font:inherit';
   label.appendChild(input);controls.appendChild(label);
   var help=document.createElement('p');help.style.cssText='font-size:12px;margin:6px 0 12px';
   help.textContent=date===today()?'Dopo mezzanotte puoi selezionare la giornata precedente per consultarne e completarne il riepilogo gestionale.':'Giornata precedente: solo riepilogo gestionale. Questa operazione non stampa una chiusura fiscale RCH e non ne modifica la data.';
   controls.appendChild(help);body.parentNode.insertBefore(controls,body);
   input.onchange=function(){
    var selected=input.value;if(!validDate(selected)){input.value=date;return}
    sessions.open('close',selected,admin);
    if(document.getElementById('optykerCashSessionsModal')===modal)input.value=date;
   };
   return result;
  };
  wrapped.__closureDateAccess=true;sessions.open=wrapped;sessions.entrypointsVersion='20260925-close-access1';
 }
 function buttonFromEvent(event){
  var path=typeof event.composedPath==='function'?event.composedPath():[event.target];
  for(var i=0;i<path.length;i++){
   var node=path[i];if(node&&node.nodeType===3)node=node.parentElement;
   var button=node&&node.closest?node.closest(SELECTOR):null;if(button)return button;
  }
  return null;
 }
 installDateAccess();
 document.addEventListener('click',function(event){
  var button=buttonFromEvent(event),sessions=window.OPTYKER_CASH_SESSIONS;
  if(!button||button.disabled||!sessions||typeof sessions.open!=='function')return;
  event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
  installDateAccess();
  sessions.open(button.id==='optykerCashDayOpenBtn'?'open':'close',today(),false);
 },true);
})();

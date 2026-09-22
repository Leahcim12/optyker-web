/* Unify the header and the older inline footer closure before their legacy onclick handlers. */
(function(){
 'use strict';
 if(window.__OPTYKER_UNIFIED_CASH_BUTTONS__)return;
 window.__OPTYKER_UNIFIED_CASH_BUTTONS__=true;
 document.addEventListener('click',function(event){
  var target=event.target,button=target&&target.closest?target.closest('#optykerCashDayCloseBtn,#optykerCashClosureBtn,#optykerCashDayOpenBtn'):null;
  if(!button||button.disabled||!window.OPTYKER_CASH_SESSIONS)return;
  event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
  var date=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  window.OPTYKER_CASH_SESSIONS.open(button.id==='optykerCashDayOpenBtn'?'open':'close',date,false);
 },true);
})();

(function(){
'use strict';
if(window.__OPTYKER_ADMIN_CASH_TODAY_CONTROLS__)return;
window.__OPTYKER_ADMIN_CASH_TODAY_CONTROLS__=true;
var API='https://whgziwaegjzqsgcntesr.supabase.co/functions/v1/optyker-admin-cash-api';
var TOKEN_KEY='optyker_billing_admin_token';
var refreshTimer=null,tableObserver=null;
function E(id){return document.getElementById(id)}
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function euro(v){try{return new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR'}).format(Number(v||0))}catch(e){return Number(v||0).toFixed(2)+' €'}}
function today(){return new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())}
function tok(){try{return sessionStorage.getItem(TOKEN_KEY)||''}catch(e){return ''}}
function callDay(){return fetch(API,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+tok()},body:JSON.stringify({action:'day',business_date:today()})}).then(function(r){return r.json().catch(function(){return {}}).then(function(x){if(!r.ok||x.ok===false)throw new Error(x.error||('HTTP '+r.status));return x.data||{}})})}
function parts(){var p=today().split('-');return {year:Number(p[0]),month:Number(p[1])}}
function ensureCard(){
 var panel=E('optykerAdminCashPanel');if(!panel)return null;
 var card=E('optykerAdminCashToday');
 if(!card){card=document.createElement('section');card.id='optykerAdminCashToday';card.className='optykerAdminCashToday';var top=panel.querySelector('.optykerAdminCashTop');if(top&&top.parentNode)top.parentNode.insertBefore(card,top.nextSibling);else panel.insertBefore(card,panel.firstChild)}
 if(!tableObserver){var days=E('optykerAdminCashDays');if(days){tableObserver=new MutationObserver(function(){scheduleRefresh(80)});tableObserver.observe(days,{childList:true,subtree:true})}}
 return card
}
function statePill(m){if(m.closed)return '<span class="optykerAdminCashPill closed">CHIUSA</span>';if(m.opened)return '<span class="optykerAdminCashPill open">APERTA</span>';return '<span class="optykerAdminCashPill todo">DA APRIRE</span>'}
function render(m){
 var card=ensureCard();if(!card)return;
 var opening=m.opening||{},closure=m.closure||{};
 var cash=m.closed?closure.next_opening_cash:(m.opened?opening.opening_cash:m.suggested_opening_cash);
 var checks=m.closed?closure.next_opening_checks:(m.opened?opening.opening_checks:m.suggested_opening_checks);
 var fundLabel=m.closed?'Fondo lasciato per la prossima apertura':(m.opened?'Fondo registrato all’apertura':'Fondo proposto dalla chiusura precedente');
 var openDisabled=m.opened||m.closed?' disabled':'';
 var closeDisabled=!m.opened||m.closed?' disabled':'';
 var extra=m.closed?'<button id="optykerAdminCashViewToday" type="button" class="optykerAdminCashTodayView">VEDI CHIUSURA</button>':'';
 card.innerHTML='<div class="optykerAdminCashTodayHead"><div><span>CASSA DI OGGI · '+esc(today().split('-').reverse().join('/'))+'</span><h3>Apertura e chiusura cassa</h3><p>Il fondo cassa viene riportato automaticamente dall’ultima chiusura e può essere corretto prima dell’apertura.</p></div>'+statePill(m)+'</div>'+
 '<div class="optykerAdminCashTodayBody"><div class="optykerAdminCashTodayFund"><span>'+esc(fundLabel)+'</span><b>'+esc(euro(cash))+'</b><small>Contanti</small><b class="checks">'+esc(euro(checks))+'</b><small>Assegni</small></div><div class="optykerAdminCashTodayActions"><button id="optykerAdminCashOpenToday" type="button" class="open"'+openDisabled+'>APRI CASSA</button><button id="optykerAdminCashCloseToday" type="button" class="close"'+closeDisabled+'>CHIUDI CASSA</button>'+extra+'</div></div>';
 var ob=E('optykerAdminCashOpenToday'),cb=E('optykerAdminCashCloseToday'),vb=E('optykerAdminCashViewToday');if(ob&&!ob.disabled)ob.onclick=function(){route('open')};if(cb&&!cb.disabled)cb.onclick=function(){route('close')};if(vb)vb.onclick=function(){route('view')}
}
function renderError(message){var card=ensureCard();if(card)card.innerHTML='<div class="optykerAdminCashTodayHead"><div><span>CASSA DI OGGI</span><h3>Apertura e chiusura cassa</h3><p>'+esc(message)+'</p></div></div>'}
function scheduleRefresh(ms){clearTimeout(refreshTimer);refreshTimer=setTimeout(refresh,ms||0)}
function refresh(){if(!E('optykerAdminCashPanel'))return;callDay().then(render).catch(function(e){renderError(e.message)})}
function relabelOpening(){
 var cash=E('optykerOpeningCash'),checks=E('optykerOpeningChecks');
 function rename(input,text){if(!input)return;var label=input.closest('label');if(!label)return;for(var i=0;i<label.childNodes.length;i++){if(label.childNodes[i].nodeType===3){label.childNodes[i].nodeValue=text;break}}}
 rename(cash,'Fondo cassa contanti');rename(checks,'Fondo cassa assegni');
 var info=document.querySelector('#optykerAdminCashModal .optykerAdminCashInfo');if(info)info.innerHTML='Il fondo è già compilato con quello lasciato nella <b>chiusura precedente</b>. Puoi modificarlo prima di confermare l’apertura.';
}
function findAction(kind){var panel=E('optykerAdminCashPanel');if(!panel)return null;return panel.querySelector('[data-'+kind+'="'+today()+'"]')}
function waitAction(kind,tries){var b=findAction(kind);if(b){b.click();if(kind==='open')setTimeout(relabelOpening,80);return}if(tries<24)setTimeout(function(){waitAction(kind,tries+1)},150);else renderError('Non riesco ad aprire il comando di oggi. Premi Aggiorna e riprova.')}
function route(kind){
 var btn=findAction(kind);if(btn){btn.click();if(kind==='open')setTimeout(relabelOpening,80);return}
 var p=parts(),y=E('optykerAdminCashYear'),m=E('optykerAdminCashMonth');
 if(y&&m){y.value=String(p.year);m.value=String(p.month);try{if(typeof y.onchange==='function')y.onchange()}catch(e){}try{if(typeof m.onchange==='function')m.onchange()}catch(e){}setTimeout(function(){var r=E('optykerAdminCashReload');if(r)r.click();waitAction(kind,0)},650);return}
 waitAction(kind,0)
}
function boot(){var card=ensureCard();if(card)scheduleRefresh(0)}
var bootTimer=setInterval(function(){if(E('optykerAdminCashPanel')){boot();if(E('optykerAdminCashToday'))clearInterval(bootTimer)}},500);
document.addEventListener('visibilitychange',function(){if(!document.hidden)scheduleRefresh(100)});
document.addEventListener('click',function(e){var id=e.target&&e.target.id;if(id==='optykerAdminCashReload'||id==='optykerOpeningSave')scheduleRefresh(900)},true);
})();

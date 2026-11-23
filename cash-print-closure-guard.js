/* OPTYKER_CASH_PRINT_CLOSURE_GUARD_20261123
   Nessuna stampa RCH finché manca la chiusura del giorno precedente (giorno di chiusura, ferie o
   chiusura dimenticata). Caricato per primo nella pagina:
   - i pulsanti di stampa diventano grigi e non si possono premere;
   - la cassa mostra cosa fare (Apertura cassa -> Chiusura cassa e RCH);
   - nessuna richiesta di stampa parte verso il connettore o il Cloud Relay.
   La regola vive sul server (optyker_cash_print_gate). Questo file non invia comandi alla RCH. */
(function(){
'use strict';
if(window.OPTYKER_PRINT_GUARD)return;
var VERSION='20261123-guard1';
var FN_BASE='https://whgziwaegjzqsgcntesr.supabase.co/functions/v1/';
var GATE_URL=FN_BASE+'optyker-cash-print-gate';
// Endpoint del connettore locale che stampano sulla RCH (stato, verifica, cassetto e REG restano liberi).
var LOCAL_PRINT={'/receipt':1,'/receipt/void':1,'/receipt/reprint':1,'/gift-receipt':1};
var FISCAL_FN={'optyker-fiscal-api':1,'optyker-fiscal-api-v2':1};
var FISCAL_PRINT={prepare:1,prepare_void:1,unified_void_start:1,unified_void_prepare:1,reissue_prepare:1};
var CASH_FN={'optyker-cash-register-api':1,'optyker-cash-register-api-v2':1,'optyker-cash-local-api':1};
var LOCK='data-optyker-print-lock',LOCK_TITLE='data-optyker-print-lock-title';
var SHORT='Stampa bloccata: fai prima la chiusura RCH del giorno precedente.';
var nativeFetch=typeof window.fetch==='function'?window.fetch.bind(window):null;
var S={gate:null,day:'',at:0,pending:null,authBlocked:'',error:'',errorAt:0,feedbackAt:0,queued:false,locked:0};

function pad(n){return (n<10?'0':'')+n}
function todayRome(){
 try{return new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())}
 catch(e){var d=new Date();return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())}
}
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function creds(){var c=window.OPTYKER_CLOUD||{};return {username:String(c.username||window.OPTYKER_ACTIVE_USER||'').trim(),password:String(c.password||'')}}
function parseDay(v){var m=/^(\d{4})-(\d{2})-(\d{2})/.exec(String(v||''));return m?Date.UTC(+m[1],+m[2]-1,+m[3]):NaN}
function dayLabel(v,withWeekday){
 var t=typeof v==='number'?v:parseDay(v);if(!isFinite(t))return '';
 try{return new Intl.DateTimeFormat('it-IT',withWeekday===false?{day:'2-digit',month:'2-digit',timeZone:'UTC'}:{weekday:'long',day:'2-digit',month:'2-digit',timeZone:'UTC'}).format(new Date(t))}
 catch(e){var d=new Date(t);return pad(d.getUTCDate())+'/'+pad(d.getUTCMonth()+1)}
}

/* ---- Stato del blocco: la risposta del server vale per il giorno in cui è stata letta. ---- */
function todayGate(){return S.gate&&S.day===todayRome()?S.gate:null}
function overrideOver(g){return !!(g&&g.reason==='override'&&g.override_until&&Date.parse(g.override_until)<=Date.now())}
function isBlocked(){var g=todayGate();return !!(g&&g.allowed===false)}
function settledAllowed(){var g=todayGate();return !!(g&&g.allowed===true&&!overrideOver(g))}
function messageFor(g){return String(g&&g.message||SHORT)}
function refresh(force){
 if(!nativeFetch)return Promise.resolve(todayGate());
 var c=creds();
 // Mai un accesso senza credenziali complete; dopo un rifiuto si riprova solo con credenziali nuove.
 if(!c.username||c.password.length<8)return Promise.resolve(todayGate());
 var key=c.username+'\n'+c.password;
 if(S.authBlocked&&S.authBlocked===key)return Promise.resolve(todayGate());
 if(S.pending)return S.pending;
 if(!force&&todayGate()&&Date.now()-S.at<30000)return Promise.resolve(todayGate());
 var ctl=typeof AbortController==='function'?new AbortController():null,timer=setTimeout(function(){if(ctl)ctl.abort()},9000),day=todayRome();
 S.pending=nativeFetch(GATE_URL,{method:'POST',headers:{'Content-Type':'application/json'},cache:'no-store',body:JSON.stringify({username:c.username,password:c.password}),signal:ctl?ctl.signal:undefined})
  .then(function(r){return r.json().catch(function(){return {}}).then(function(x){
   if(r.status===401){S.authBlocked=key;throw new Error(x&&x.error||'Sessione operatore non valida')}
   if(!r.ok||!x||x.ok!==true||!x.data||typeof x.data.allowed!=='boolean')throw new Error(x&&x.error||('Controllo chiusura non disponibile (HTTP '+r.status+')'));
   var wasBlocked=isBlocked();S.gate=x.data;S.day=day;S.at=Date.now();S.error='';
   if(wasBlocked&&!isBlocked())toast('Chiusura RCH registrata: la stampa è di nuovo disponibile.','ok');
  })})
  .catch(function(e){S.error=String(e&&e.message||e);S.errorAt=Date.now()})
  .then(function(){clearTimeout(timer);S.pending=null;schedule();return todayGate()});
 return S.pending;
}
// Prima di ogni stampa: se oggi la stampa è già consentita non serve chiedere (dopo una chiusura
// resta consentita fino a domani); altrimenti si chiede al server. Se il controllo non risponde e
// oggi non era bloccata, il flusso resta quello di prima.
function decide(){return settledAllowed()?Promise.resolve(todayGate()):refresh(true)}
function assertAllowed(){
 return decide().then(function(g){
  if(g&&g.allowed===false){feedback();var e=new Error(messageFor(g));e.optykerPrintBlocked=true;throw e}
  return g;
 });
}

/* ---- Richieste di stampa: nessuna parte finché la chiusura manca. ---- */
function safeJson(text){try{return JSON.parse(text)}catch(e){return null}}
function printKind(input,init){
 var url=typeof input==='string'?input:(input&&typeof input.url==='string'?input.url:String(input||''));
 var method=String(init&&init.method||input&&input.method||'GET').toUpperCase();
 if(method!=='POST')return '';
 var local=/^https?:\/\/(?:127\.0\.0\.1|localhost):8765(\/[^?#]*)?/i.exec(url);
 if(local){var path=(local[1]||'/').replace(/\/+$/,'')||'/';return LOCAL_PRINT[path]?'rch'+path:''}
 if(url.indexOf(FN_BASE)!==0)return '';
 var fn=url.slice(FN_BASE.length).split(/[\/?#]/)[0];
 if(!FISCAL_FN[fn]&&!CASH_FN[fn]&&fn!=='optyker-rch-relay-api')return '';
 var body=init&&typeof init.body==='string'?safeJson(init.body):null;
 if(!body||typeof body!=='object')return '';
 var a=String(body.action||''),p=body.payload&&typeof body.payload==='object'?body.payload:{};
 if(FISCAL_FN[fn])return FISCAL_PRINT[a]?'fiscal:'+a:'';
 if(fn==='optyker-rch-relay-api')return a==='queue_fiscal'?'relay:queue_fiscal':a==='queue_aux'&&p.kind==='gift_receipt'?'relay:gift_receipt':'';
 return p.auto_receipt===true&&p.invoice_requested!==true?'cash:'+a:'';
}
function blockedResponse(g){return new Response(JSON.stringify({ok:false,error:messageFor(g),print_blocked:true}),{status:423,headers:{'Content-Type':'application/json'}})}
if(nativeFetch){
 var guardedFetch=function(input,init){
  var kind='';try{kind=printKind(input,init)}catch(e){kind=''}
  if(!kind)return nativeFetch(input,init);
  return decide().then(function(g){
   if(g&&g.allowed===false){feedback();return blockedResponse(g)}
   return nativeFetch(input,init);
  });
 };
 guardedFetch.__optykerPrintGuard=VERSION;
 window.fetch=guardedFetch;
}

/* ---- Modulo stampa: il controllo arriva prima che la vendita o il pagamento vengano registrati. ---- */
function wrapFiscal(){
 var f=window.OPTYKER_FISCAL;
 if(!f||f.__printGuard||typeof f.checkReady!=='function')return;
 var inner=f,next={};
 Object.keys(inner).forEach(function(k){next[k]=inner[k]});
 next.checkReady=function(){var a=arguments;return assertAllowed().then(function(){return inner.checkReady.apply(inner,a)})};
 if(typeof inner.issuePayment==='function')next.issuePayment=function(){var a=arguments;return assertAllowed().then(function(){return inner.issuePayment.apply(inner,a)})};
 next.__printGuard=VERSION;
 try{window.OPTYKER_FISCAL=Object.freeze(next)}catch(e){}
}

/* ---- Pulsanti di stampa: grigi e non cliccabili. ---- */
function invoiceRequested(){var i=document.getElementById('optykerCashInvoice');return !!(i&&i.checked)}
function cartTotalIsZero(){
 var t=document.getElementById('optykerCashTotal');if(!t)return false;
 var s=String(t.textContent||'').replace(/[^0-9,.\-]/g,'');if(!/[0-9]/.test(s))return false;
 var n=Number(s.replace(/\./g,'').replace(',','.'));return isFinite(n)&&n===0;
}
function isPrintControl(b){
 if(!b||!b.matches)return false;
 var id=b.id||'';
 if(id==='optykerCashCheckoutBtn')return !invoiceRequested()&&!cartTotalIsZero();
 if(id==='optykerCashRecover'||id==='optykerCashGiftBtn')return true;
 if(b.matches('#optykerCashDepositsModal [data-settle]'))return !invoiceRequested();
 if(b.matches('[data-receipt],[data-receipt-reissue],.ofAutoIssue,.ofEmit,.ofVoidEmit,#optykerRchCloudModal [data-pay]'))return true;
 return !!(b.closest('#optykerFiscalModal,#optykerRchCloudModal')&&/^\s*(Ristampa|Emetti|Stampa scontrino)/i.test(b.textContent||''));
}
function printControl(target){
 var el=target&&target.nodeType===1?target:target&&target.parentElement;
 var b=el&&el.closest?el.closest('button,input[type="submit"],input[type="button"],[role="button"]'):null;
 return b&&isPrintControl(b)?b:null;
}
var CANDIDATES='#optykerCashCheckoutBtn,#optykerCashRecover,#optykerCashGiftBtn,#optykerCashDepositsModal [data-settle],[data-receipt],[data-receipt-reissue],.ofAutoIssue,.ofEmit,.ofVoidEmit,#optykerRchCloudModal [data-pay],#optykerFiscalModal button,#optykerRchCloudModal button';
// Stile in linea con !important: la cassa forza opacity:1!important sui suoi pulsanti.
var LOCK_STYLE={opacity:'0.42',filter:'grayscale(0.8)',cursor:'not-allowed'},LOCK_PREV='data-optyker-print-lock-style';
function lockEl(b){
 if(b.getAttribute(LOCK)!=='1'){
  b.setAttribute(LOCK,'1');
  if(b.hasAttribute('title'))b.setAttribute(LOCK_TITLE,b.getAttribute('title'));
  b.setAttribute('title',SHORT);b.setAttribute('aria-disabled','true');
  var prev={};
  Object.keys(LOCK_STYLE).forEach(function(p){prev[p]=[b.style.getPropertyValue(p),b.style.getPropertyPriority(p)]});
  b.setAttribute(LOCK_PREV,JSON.stringify(prev));
 }
 // Riapplicato anche se un altro modulo ha riscritto lo stile del pulsante.
 Object.keys(LOCK_STYLE).forEach(function(p){if(b.style.getPropertyValue(p)!==LOCK_STYLE[p]||b.style.getPropertyPriority(p)!=='important')b.style.setProperty(p,LOCK_STYLE[p],'important')});
}
function unlockEl(b){
 var prev=safeJson(b.getAttribute(LOCK_PREV)||'')||{};
 Object.keys(LOCK_STYLE).forEach(function(p){var v=prev[p];if(v&&v[0])b.style.setProperty(p,v[0],v[1]||'');else b.style.removeProperty(p)});
 b.removeAttribute(LOCK_PREV);b.removeAttribute(LOCK);b.removeAttribute('aria-disabled');
 if(b.hasAttribute(LOCK_TITLE)){b.setAttribute('title',b.getAttribute(LOCK_TITLE));b.removeAttribute(LOCK_TITLE)}else b.removeAttribute('title');
}
function onActivate(ev){
 if(!isBlocked())return;
 var b=printControl(ev.target);if(!b)return;
 ev.preventDefault();ev.stopPropagation();if(ev.stopImmediatePropagation)ev.stopImmediatePropagation();
 feedback();
}
window.addEventListener('click',onActivate,true);
window.addEventListener('submit',function(ev){
 if(!isBlocked())return;var f=ev.target;
 if(f&&f.matches&&f.matches('form.ofIssue,form.ofVoidForm')){ev.preventDefault();ev.stopPropagation();if(ev.stopImmediatePropagation)ev.stopImmediatePropagation();feedback()}
},true);

/* ---- Avviso in cassa: cosa fare per sbloccare. ---- */
function reasonText(g){
 var last=g.last_closure_text?'Ultima chiusura RCH: '+g.last_closure_text+'.':'';
 if(g.reason==='documents_after_closure')return 'Ci sono scontrini di '+dayLabel(g.documents_from)+' stampati dopo l’ultima chiusura RCH'+(g.last_closure_text?' ('+g.last_closure_text+')':'')+': fai la chiusura prima del primo scontrino di oggi.';
 if(g.reason==='no_closure')return 'In Optyker non risulta nessuna chiusura RCH: fai la chiusura prima del primo scontrino.';
 if(g.reason==='missing_closure'&&g.last_closure_date){
  var from=parseDay(g.last_closure_date)+86400000,to=parseDay(g.today)-86400000;
  var gap=from===to?'di '+dayLabel(from):'del periodo dal '+dayLabel(from,false)+' al '+dayLabel(to,false);
  return 'Manca la chiusura RCH '+gap+' (giorno di chiusura, ferie o chiusura dimenticata). '+last+' Finché non fai la chiusura, la RCH non stampa.';
 }
 return messageFor(g);
}
function bannerHtml(g){
 var opened=g.today_opened===true,unc=Number(g.uncertain_jobs||0)>0,pend=g.pending_closure;
 var h='<div class="oplbIcon" aria-hidden="true">🔒</div><div class="oplbText"><b>Stampa bloccata: fai prima la chiusura</b><p>'+esc(reasonText(g))+'</p>';
 if(unc)h+='<p class="oplbWarn">C’è uno scontrino con esito da verificare: aprilo da <b>Ultime vendite → Emissione / esito RCH</b> e verificalo, altrimenti la RCH non accetta la chiusura.</p>';
 if(pend)h+='<p class="oplbWarn">Una chiusura RCH aspetta la conferma: aprila con «Chiusura cassa e RCH» e premi «Verifica esito».</p>';
 h+='</div><div class="oplbActions">';
 if(!opened)h+='<button type="button" class="primary" data-oplb="open">1 · Apertura cassa</button><button type="button" data-oplb="close">2 · Chiusura cassa e RCH</button>';
 else h+='<button type="button" class="primary" data-oplb="close">Chiusura cassa e RCH</button>';
 if(unc)h+='<button type="button" data-oplb="recent">Ultime vendite</button>';
 return h+'<button type="button" class="link" data-oplb="refresh">Ricontrolla</button></div>';
}
function openSessions(kind){
 var s=window.OPTYKER_CASH_SESSIONS;
 if(s&&typeof s.open==='function'){s.open(kind,todayRome(),false);return}
 var b=document.getElementById(kind==='open'?'optykerCashDayOpenBtn':'optykerCashDayCloseBtn');
 if(b){b.click();return}
 toast('Usa «'+(kind==='open'?'Apertura cassa':'Chiusura cassa')+'» in alto nella Cassa.','error');
}
function bindBanner(bn){
 bn.querySelectorAll('[data-oplb]').forEach(function(b){b.onclick=function(ev){
  ev.preventDefault();var k=b.getAttribute('data-oplb');
  if(k==='open'||k==='close')openSessions(k);
  else if(k==='recent'){var r=document.getElementById('optykerCashRecentBtn');if(r)r.click()}
  else if(k==='refresh'){b.disabled=true;refresh(true).then(function(g){b.disabled=false;if(g&&g.allowed===false)toast('Chiusura RCH di oggi non ancora registrata in Optyker.','error')})}
 }});
}
function syncBanner(blocked){
 var ov=document.getElementById('optykerCashOverlay'),bn=document.getElementById('optykerPrintLockBanner');
 if(!blocked||!ov){if(bn)bn.remove();return}
 var header=ov.querySelector('.optykerCashHeader');
 if(!bn){bn=document.createElement('section');bn.id='optykerPrintLockBanner';bn.setAttribute('role','alert');bn.setAttribute('aria-live','polite')}
 // Inserito una volta sotto l'intestazione; non viene spostato di nuovo (nessun rimpallo con altri moduli).
 if(bn.parentNode!==ov){if(header&&header.parentNode===ov)ov.insertBefore(bn,header.nextSibling);else ov.insertBefore(bn,ov.firstChild)}
 var html=bannerHtml(todayGate());
 if(bn.getAttribute('data-html')!==html){bn.setAttribute('data-html',html);bn.innerHTML=html;bindBanner(bn)}
}
function syncNotes(cards){
 document.querySelectorAll('.optykerPrintLockNote').forEach(function(n){if(!cards.has(n.parentNode))n.remove()});
 cards.forEach(function(c){
  if(c.querySelector(':scope > .optykerPrintLockNote'))return;
  var n=document.createElement('div');n.className='optykerPrintLockNote';n.setAttribute('role','alert');
  n.textContent='🔒 '+SHORT+' Usa «Chiusura cassa e RCH» in Cassa: poi la stampa si sblocca.';
  var title=c.querySelector(':scope > .optykerCashModalTitle');
  c.insertBefore(n,title?title.nextSibling:c.firstChild);
 });
}
function sync(){
 S.queued=false;wrapFiscal();maybeRefresh();
 var blocked=isBlocked();
 if(!blocked&&!S.locked&&!document.getElementById('optykerPrintLockBanner')&&!document.querySelector('.optykerPrintLockNote'))return;
 var want=[];
 if(blocked)document.querySelectorAll(CANDIDATES).forEach(function(b){if(isPrintControl(b))want.push(b)});
 var keep=new Set(want),cards=new Set();
 document.querySelectorAll('['+LOCK+']').forEach(function(b){if(!keep.has(b))unlockEl(b)});
 want.forEach(function(b){lockEl(b);var c=b.closest('.optykerCashModalCard');if(c)cards.add(c)});
 S.locked=want.length;syncNotes(cards);syncBanner(blocked);
}
function schedule(){
 if(S.queued)return;S.queued=true;
 (window.requestAnimationFrame||function(f){return setTimeout(f,40)})(sync);
}

/* ---- Messaggi ---- */
function toast(text,type){
 if(!document.body)return;
 var t=document.getElementById('optykerPrintLockToast');
 if(!t){t=document.createElement('div');t.id='optykerPrintLockToast';t.setAttribute('role','status');t.setAttribute('aria-live','assertive');document.body.appendChild(t)}
 t.className=type||'';t.textContent=text;t.style.display='block';clearTimeout(t.__h);t.__h=setTimeout(function(){t.style.display='none'},6000);
}
function feedback(){
 var now=Date.now();if(now-S.feedbackAt<1200)return;S.feedbackAt=now;
 toast(messageFor(todayGate()),'error');
 var bn=document.getElementById('optykerPrintLockBanner');
 if(bn){bn.classList.remove('pulse');void bn.offsetWidth;bn.classList.add('pulse')}
}
function injectStyle(){
 if(document.getElementById('optykerPrintLockCss'))return;
 var s=document.createElement('style');s.id='optykerPrintLockCss';
 s.textContent='['+LOCK+'="1"]{opacity:.42!important;cursor:not-allowed!important;filter:grayscale(.8)!important;box-shadow:none!important}'+
 '#optykerPrintLockBanner{flex:0 0 auto;position:relative;z-index:5;display:flex;align-items:center;flex-wrap:wrap;gap:12px 16px;margin:10px 14px 0;padding:13px 16px;border:2px solid #b3261e;border-radius:12px;background:#fff2f0;color:#4e130d;box-shadow:0 8px 24px rgba(150,35,25,.14);font:14px/1.45 "Segoe UI",system-ui,Arial,sans-serif;text-align:left}'+
 '#optykerPrintLockBanner .oplbIcon{font-size:26px;line-height:1}'+
 '#optykerPrintLockBanner .oplbText{flex:1 1 340px;min-width:0}'+
 '#optykerPrintLockBanner .oplbText b{display:block;font-size:16px;color:#8f1d14}'+
 '#optykerPrintLockBanner .oplbText p{margin:3px 0 0}'+
 '#optykerPrintLockBanner .oplbText .oplbWarn{margin-top:7px;padding:6px 9px;border-radius:8px;background:#fff6dc;color:#6d4500}'+
 '#optykerPrintLockBanner .oplbActions{display:flex;flex-wrap:wrap;align-items:center;gap:8px}'+
 '#optykerPrintLockBanner .oplbActions button{height:40px;padding:0 14px;border-radius:9px;border:1px solid #cfa29c;background:#fff;color:#6b1a12;font:700 13px "Segoe UI",system-ui,Arial,sans-serif;cursor:pointer;opacity:1;filter:none}'+
 '#optykerPrintLockBanner .oplbActions button.primary{background:#b3261e;border-color:#b3261e;color:#fff}'+
 '#optykerPrintLockBanner .oplbActions button.link{border-color:transparent;background:transparent;text-decoration:underline;padding:0 6px}'+
 '#optykerPrintLockBanner .oplbActions button:disabled{opacity:.6;cursor:wait}'+
 '#optykerPrintLockBanner.pulse{animation:oplbPulse .45s ease 3}'+
 '@keyframes oplbPulse{50%{box-shadow:0 0 0 5px rgba(179,38,30,.28)}}'+
 '.optykerPrintLockNote{margin:8px 0 12px;padding:9px 12px;border-radius:9px;border:1px solid #e3a49c;background:#fff2f0;color:#7d1c14;font:600 13px/1.4 "Segoe UI",system-ui,Arial,sans-serif}'+
 '#optykerPrintLockToast{position:fixed;left:50%;bottom:22px;transform:translateX(-50%);z-index:2147483647;display:none;max-width:min(560px,calc(100vw - 32px));padding:12px 16px;border-radius:11px;background:#173b5e;color:#fff;font:700 13px/1.45 "Segoe UI",system-ui,Arial,sans-serif;box-shadow:0 14px 36px rgba(12,35,55,.28)}'+
 '#optykerPrintLockToast.error{background:#a3261c}#optykerPrintLockToast.ok{background:#1f6b3d}'+
 '@media(max-width:760px){#optykerPrintLockBanner{margin:8px 8px 0;padding:11px 12px}#optykerPrintLockBanner .oplbActions{width:100%}#optykerPrintLockBanner .oplbActions button{flex:1 1 auto}}';
 (document.head||document.documentElement).appendChild(s);
}

/* ---- Aggiornamenti: all'accesso, all'apertura della Cassa e dopo ogni apertura/chiusura. ---- */
function cashActive(){
 var ov=document.getElementById('optykerCashOverlay');
 return !!(ov&&ov.classList.contains('open'))||!!document.querySelector('#optykerFiscalModal,#optykerRchCloudModal,#optykerCashDepositsModal.open');
}
// Una lettura all'accesso e all'apertura della Cassa; dopo «consentita» non serve rileggere fino a
// domani; mentre è bloccata si ricontrolla ogni 20 secondi con la Cassa aperta.
function maybeRefresh(){
 if(S.pending||document.visibilityState==='hidden')return;
 if(S.error&&Date.now()-S.errorAt<60000)return;
 var g=todayGate();
 if(!g){if(!S.at||cashActive())refresh(false)}
 else if(g.allowed===false){if(Date.now()-S.at>20000&&cashActive())refresh(true)}
 else if(overrideOver(g))refresh(true);
}
function tick(){wrapFiscal();maybeRefresh();if(isBlocked())schedule()}
window.addEventListener('optyker:cash-session-changed',function(){
 S.error='';refresh(true);setTimeout(function(){refresh(true)},3500);setTimeout(function(){refresh(true)},12000);
});
document.addEventListener('visibilitychange',tick);
window.addEventListener('focus',tick);
window.addEventListener('change',schedule,true);
injectStyle();
new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
setInterval(tick,5000);
setTimeout(tick,1500);

window.OPTYKER_PRINT_GUARD=Object.freeze({
 version:VERSION,
 refresh:function(){return refresh(true)},
 state:function(){return todayGate()},
 blocked:isBlocked,
 printKind:printKind,
 assertAllowed:assertAllowed
});
})();

(function(root){
'use strict';
var VERSION='20260923-ipadnavlab1';
function normalizeSearch(v){
  return String(v==null?'':v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'');
}
function searchMatch(text,query){
  var q=normalizeSearch(query);return !q||normalizeSearch(text).indexOf(q)>=0;
}
function isTextEntry(el){
  if(!el)return false;
  var tag=String(el.tagName||'').toUpperCase();
  if(tag==='TEXTAREA')return true;
  if(el.isContentEditable===true)return true;
  if(tag!=='INPUT')return false;
  var type=String(el.type||'text').toLowerCase();
  return ['text','search','email','tel','url','password','number','date','time','datetime-local','month','week'].indexOf(type)>=0;
}
if(typeof module!=='undefined'&&module.exports)module.exports={normalizeSearch:normalizeSearch,searchMatch:searchMatch,isTextEntry:isTextEntry};
if(!root||!root.document)return;
if(root.__OPTYKER_IPAD_NAV_LAB_FIX__)return;
root.__OPTYKER_IPAD_NAV_LAB_FIX__=VERSION;
var doc=root.document;
function E(id){return doc.getElementById(id)}
function visible(el){if(!el||!el.getBoundingClientRect)return false;var r=el.getBoundingClientRect(),s=root.getComputedStyle?root.getComputedStyle(el):null;return !!(r.width&&r.height)&&(!s||s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity||1)>0.01)}
function fullScreen(el){if(!el||!el.getBoundingClientRect)return false;var r=el.getBoundingClientRect(),s=root.getComputedStyle?root.getComputedStyle(el):null;return !!s&&s.position==='fixed'&&r.width>=root.innerWidth*.88&&r.height>=root.innerHeight*.88}
function staleBlocker(el,target){
  if(!el||el===target||el.contains&&el.contains(target))return false;
  var cls=el.classList;
  if(el.hasAttribute&&el.hasAttribute('inert'))return true;
  if(el.getAttribute&&el.getAttribute('aria-hidden')==='true')return true;
  if(cls&&cls.contains('optykerCashModal')&&!cls.contains('open'))return true;
  if(cls&&cls.contains('optykerCashOverlay')&&!cls.contains('open'))return true;
  if(fullScreen(el)&&!visible(el))return true;
  return false;
}
function repairEditable(target){
  if(!isTextEntry(target)||target.disabled||target.readOnly)return;
  var n=target;
  while(n&&n.nodeType===1){
    if(n.hasAttribute&&n.hasAttribute('inert'))n.removeAttribute('inert');
    if(n.getAttribute&&n.getAttribute('aria-hidden')==='true')n.removeAttribute('aria-hidden');
    if(n.style&&n.style.getPropertyValue('pointer-events')==='none')n.style.removeProperty('pointer-events');
    n=n.parentElement;
  }
  [doc.documentElement,doc.body].forEach(function(x){
    if(!x)return;if(x.hasAttribute&&x.hasAttribute('inert'))x.removeAttribute('inert');
    if(x.style&&x.style.getPropertyValue('pointer-events')==='none')x.style.removeProperty('pointer-events');
  });
  try{
    target.style.setProperty('touch-action','manipulation');
    target.style.setProperty('-webkit-user-select','text');
    target.style.setProperty('user-select','text');
    if(root.getComputedStyle(target).pointerEvents==='none')target.style.setProperty('pointer-events','auto','important');
  }catch(e){}
  doc.querySelectorAll('.optykerCashModal,.optykerCashOverlay,[aria-hidden="true"],[inert]').forEach(function(el){
    if(staleBlocker(el,target))el.style.setProperty('pointer-events','none','important');
  });
}
function textTarget(ev){
  var t=ev&&ev.target;
  return isTextEntry(t)?t:(t&&t.closest?t.closest('input,textarea,[contenteditable="true"]'):null);
}
function editableStart(ev){var t=textTarget(ev);if(t)repairEditable(t)}
function editableEnd(ev){
  var t=textTarget(ev);if(!t||t.disabled||t.readOnly)return;
  repairEditable(t);
  setTimeout(function(){try{if(t.isConnected&&doc.activeElement!==t)t.focus({preventScroll:true})}catch(e){}},0);
}
doc.addEventListener('pointerdown',editableStart,true);
doc.addEventListener('touchstart',editableStart,{capture:true,passive:true});
doc.addEventListener('focusin',editableStart,true);
doc.addEventListener('touchend',editableEnd,{capture:true,passive:true});
root.addEventListener('pageshow',function(){if(doc.body)doc.body.removeAttribute('inert');doc.documentElement.removeAttribute('inert')});
doc.addEventListener('visibilitychange',function(){if(!doc.hidden&&doc.activeElement)repairEditable(doc.activeElement)});

function hideLaboratory(){
  ['optykerLaboratoryPanel','labOrdersPanel'].forEach(function(id){var p=E(id);if(p)p.style.display='none'});
  var nav=E('navLaboratory');if(nav)nav.classList.remove('active');
}
function clientsVisible(){
  hideLaboratory();
  var p=E('clientsPanel');if(p){p.hidden=false;if(!visible(p))p.style.display='block'}
}
function wrap(name,kind){
  var old=root[name];if(typeof old!=='function'||old.__ipadNavLabFix)return;
  var w=function(){
    var args=arguments;
    if(kind==='showModule'){
      if(String(args[0]||'')==='clients')hideLaboratory();
      var r=old.apply(this,args);
      if(String(args[0]||'')==='clients')setTimeout(clientsVisible,0);
      return r;
    }
    if(kind==='client'){
      hideLaboratory();
      if(E('clientsPanel')&&!visible(E('clientsPanel'))&&typeof root.showModule==='function')root.showModule('clients');
      var out=old.apply(this,args);setTimeout(clientsVisible,0);return out;
    }
    if(kind==='page'){
      hideLaboratory();
      if(typeof root.showModule==='function')root.showModule('clients');
      var result=old.apply(this,args);setTimeout(clientsVisible,0);return result;
    }
    if(kind==='lab'){
      var value=old.apply(this,args);setTimeout(ensureLaboratorySearch,0);setTimeout(ensureLaboratorySearch,120);return value;
    }
    return old.apply(this,args);
  };
  w.__ipadNavLabFix=true;w.__ipadNavLabOriginal=old;root[name]=w;
}
function installNavigation(){
  wrap('showModule','showModule');
  wrap('clientSelect','client');
  wrap('optykerClientOpenPage','page');
  wrap('openLaboratory','lab');
}
doc.addEventListener('click',function(ev){
  var t=ev.target&&ev.target.closest?ev.target.closest('#navClients,[data-client-page],#clientPageNav button'):null;
  if(t)hideLaboratory();
},true);

function labCards(panel){return panel?Array.prototype.slice.call(panel.querySelectorAll('.optykerLabCard,.labCard')):[]}
function filterCards(panel,input){
  var q=input&&input.value||'';
  labCards(panel).forEach(function(card){card.style.display=searchMatch(card.textContent||'',q)?'':'none'});
}
function bindLabInput(panel,input){
  if(!input||input.dataset.optykerReferenceSearch==='1')return;
  input.dataset.optykerReferenceSearch='1';
  input.placeholder='Cerca riferimento / codice busta, cliente o prodotto…';
  input.setAttribute('aria-label','Cerca riferimento o codice della busta');
  input.setAttribute('autocomplete','off');
  var toolbar=input.closest('.optykerLabToolbar,.labToolbar')||input.parentElement;
  if(toolbar&&!toolbar.querySelector('.optykerLabSearchLabel')){
    var label=doc.createElement('label');label.className='optykerLabSearchLabel';label.textContent='Cerca riferimento / codice busta';
    if(!input.id)input.id='optykerLabReferenceSearch';label.htmlFor=input.id;toolbar.insertBefore(label,input);
  }
  input.addEventListener('input',function(){setTimeout(function(){filterCards(panel,input)},0);setTimeout(function(){filterCards(panel,input)},60)});
}
function ensureOneLaboratory(panel){
  if(!panel)return;
  var input=panel.querySelector('#optykerLabSearch,#labSearch,input[type="search"]');
  if(!input){
    var toolbar=panel.querySelector('.optykerLabToolbar,.labToolbar')||panel.firstElementChild||panel;
    input=doc.createElement('input');input.type='search';input.id='optykerLabReferenceSearch';toolbar.insertBefore(input,toolbar.firstChild);
  }
  bindLabInput(panel,input);
}
function ensureLaboratorySearch(){
  ensureOneLaboratory(E('optykerLaboratoryPanel'));
  ensureOneLaboratory(E('labOrdersPanel'));
}
function installStyle(){
  if(E('optykerIpadNavLabStyle'))return;
  var s=doc.createElement('style');s.id='optykerIpadNavLabStyle';
  s.textContent='.optykerLabSearchLabel{display:block;flex:0 0 100%;font-size:11px;font-weight:900;letter-spacing:.25px;color:#53697a;margin:0 0 2px}.optykerLabToolbar,.labToolbar{flex-wrap:wrap}.optykerLabToolbar input[type="search"],.labToolbar input[type="search"]{min-height:44px;font-size:16px!important;touch-action:manipulation;-webkit-user-select:text!important;user-select:text!important}@supports (-webkit-touch-callout:none){input:not([type="button"]):not([type="submit"]):not([type="checkbox"]):not([type="radio"]),textarea,[contenteditable="true"]{font-size:16px!important;-webkit-user-select:text!important;user-select:text!important;touch-action:manipulation}}';
  doc.head.appendChild(s);
}
function boot(){installStyle();installNavigation();ensureLaboratorySearch()}
if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
setTimeout(boot,120);setTimeout(boot,700);setTimeout(boot,1800);
root.addEventListener('pageshow',function(){setTimeout(boot,60)});
})(typeof window==='undefined'?null:window);

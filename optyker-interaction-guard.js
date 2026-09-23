(function(){
'use strict';
if(window.__OPTYKER_INTERACTION_GUARD__)return;
window.__OPTYKER_INTERACTION_GUARD__=true;
var bootAt=Date.now();
var agendaLayoutQueued=false;
var CASH_API='https://whgziwaegjzqsgcntesr.supabase.co/functions/v1/optyker-cash-register-api';
var LOCAL_CASH_API='https://whgziwaegjzqsgcntesr.supabase.co/functions/v1/optyker-cash-local-api';
function installCashChannelSeparation(){
  if(window.__OPTYKER_CASH_CHANNEL_SEPARATION_20260914__)return;
  window.__OPTYKER_CASH_CHANNEL_SEPARATION_20260914__=true;
  var nativeFetch=window.fetch.bind(window);
  window.fetch=function(input,init){
    try{
      var url=typeof input==='string'?input:(input&&input.url)||'';
      if(url===CASH_API&&init&&String(init.method||'GET').toUpperCase()==='POST'&&typeof init.body==='string'){
        var body=JSON.parse(init.body);
        if(body&&body.action==='checkout')return nativeFetch(LOCAL_CASH_API,init);
      }
    }catch(e){}
    return nativeFetch(input,init);
  };
}
function visible(el){
  if(!el||!el.getBoundingClientRect)return false;
  var s=getComputedStyle(el),r=el.getBoundingClientRect();
  return s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity||1)>0.01&&r.width>0&&r.height>0;
}
function fullScreen(el){
  if(!el||!el.getBoundingClientRect)return false;
  var s=getComputedStyle(el),r=el.getBoundingClientRect();
  return s.position==='fixed'&&r.width>=innerWidth*.9&&r.height>=innerHeight*.9;
}
function setPointerNone(el){
  if(!el||!el.style)return;
  if(el.style.getPropertyValue('pointer-events')!=='none'||el.style.getPropertyPriority('pointer-events')!=='important')el.style.setProperty('pointer-events','none','important');
}
function neutralizeInvisibleBlockers(){
  try{
    if(document.documentElement.style.getPropertyValue('pointer-events'))document.documentElement.style.removeProperty('pointer-events');
    if(document.body){
      if(document.body.style.getPropertyValue('pointer-events'))document.body.style.removeProperty('pointer-events');
      if(document.body.hasAttribute('inert'))document.body.removeAttribute('inert');
    }
    document.querySelectorAll('.optykerCashModal:not(.open),.optykerCashOverlay:not(.open),[aria-hidden="true"]').forEach(function(el){
      if(fullScreen(el))setPointerNone(el);
    });
    Array.prototype.forEach.call(document.body?document.body.children:[],function(el){
      if(!fullScreen(el))return;
      var s=getComputedStyle(el),opacity=Number(s.opacity||1);
      if((s.visibility==='hidden'||opacity<=0.01)&&s.display!=='none')setPointerNone(el);
    });
  }catch(e){}
}
function closeStartupStaleOverlays(){
  if(Date.now()-bootAt>2500)return;
  ['optykerRchCloudModal','optykerCashClosureModal','optykerFiscalModal','optykerCashRchModal','optykerCashDepositsModal','optykerCashTsModal'].forEach(function(id){
    var el=document.getElementById(id);
    if(el&&el.classList.contains('open'))el.classList.remove('open');
  });
  var cash=document.getElementById('optykerCashOverlay');
  if(cash&&cash.classList.contains('open')){
    cash.classList.remove('open');
    cash.style.setProperty('display','none','important');
    if(document.body)document.body.style.removeProperty('overflow');
  }
}
function unlockAllKnown(){
  ['optykerRchCloudModal','optykerCashClosureModal','optykerFiscalModal','optykerCashRchModal','optykerCashDepositsModal','optykerCashTsModal'].forEach(function(id){
    var el=document.getElementById(id);if(el){el.classList.remove('open');el.style.setProperty('pointer-events','none','important')}
  });
  var cash=document.getElementById('optykerCashOverlay');if(cash){cash.classList.remove('open');cash.style.setProperty('display','none','important');cash.style.setProperty('pointer-events','none','important')}
  if(document.body){document.body.style.removeProperty('overflow');document.body.style.removeProperty('pointer-events');document.body.removeAttribute('inert')}
  document.documentElement.style.removeProperty('pointer-events');
}
function addEmergencyButton(){
  if(document.getElementById('optykerInteractionUnlock'))return;
  var b=document.createElement('button');b.id='optykerInteractionUnlock';b.type='button';b.textContent='Sblocca interfaccia';
  b.style.cssText='position:fixed;right:14px;bottom:14px;z-index:2147483647;border:0;border-radius:10px;background:#173b56;color:#fff;padding:10px 13px;font:800 11px Segoe UI,Arial,sans-serif;box-shadow:0 8px 28px rgba(0,0,0,.25);display:none;pointer-events:auto!important';
  b.onclick=function(){unlockAllKnown();b.style.display='none'};document.body.appendChild(b);
  setInterval(function(){
    var blocked=false;
    document.querySelectorAll('.optykerCashModal.open,.optykerCashOverlay.open').forEach(function(el){if(fullScreen(el)&&!visible(el.querySelector('.optykerCashModalCard,.optykerCashHeader,.optykerCashMain')))blocked=true});
    b.style.display=blocked?'block':'none';
  },800);
}
function installAgendaOverlapStyle(){
  if(document.getElementById('optykerAgendaOverlapStyle'))return;
  var s=document.createElement('style');s.id='optykerAgendaOverlapStyle';
  s.textContent='/* OPTYKER_AGENDA_OVERLAP_SIDE_BY_SIDE_20260914 */\n'+
    '#oaCalendar.oaCalendarWeek .oaTimelineDay>.oaTimedEvent[data-optyker-overlap="1"],.oaV14DayBody>.oaV14Event[data-optyker-overlap="1"]{left:calc(var(--optyker-overlap-left) + 3px)!important;right:auto!important;width:calc(var(--optyker-overlap-width) - 6px)!important;max-width:none!important;min-width:0!important;}';
  document.head.appendChild(s);
}
function eventMetric(el){
  var cs=getComputedStyle(el),top=parseFloat(el.style.top||cs.top),height=parseFloat(el.style.height||cs.height);
  if(!isFinite(top))top=el.offsetTop||0;
  if(!isFinite(height)||height<=0)height=el.offsetHeight||1;
  return {el:el,start:top,end:top+Math.max(1,height),lane:0};
}
function clearOverlap(el){
  if(el.getAttribute('data-optyker-overlap')!==null)el.removeAttribute('data-optyker-overlap');
  if(el.style.getPropertyValue('--optyker-overlap-left'))el.style.removeProperty('--optyker-overlap-left');
  if(el.style.getPropertyValue('--optyker-overlap-width'))el.style.removeProperty('--optyker-overlap-width');
}
function setOverlap(el,lane,count){
  var left=(lane*100/count)+'%',width=(100/count)+'%';
  if(el.getAttribute('data-optyker-overlap')!=='1')el.setAttribute('data-optyker-overlap','1');
  if(el.style.getPropertyValue('--optyker-overlap-left')!==left)el.style.setProperty('--optyker-overlap-left',left);
  if(el.style.getPropertyValue('--optyker-overlap-width')!==width)el.style.setProperty('--optyker-overlap-width',width);
}
function layoutCluster(items){
  if(items.length<2){items.forEach(function(x){clearOverlap(x.el)});return}
  var ends=[],maxLanes=0;
  items.forEach(function(x){
    var lane=-1;
    for(var i=0;i<ends.length;i++){if(ends[i]<=x.start+0.5){lane=i;break}}
    if(lane<0){lane=ends.length;ends.push(x.end)}else ends[lane]=x.end;
    x.lane=lane;if(ends.length>maxLanes)maxLanes=ends.length;
  });
  if(maxLanes<2){items.forEach(function(x){clearOverlap(x.el)});return}
  items.forEach(function(x){setOverlap(x.el,x.lane,maxLanes)});
}
function layoutDay(parent,events){
  var items=events.map(eventMetric).sort(function(a,b){return a.start-b.start||(b.end-b.start)-(a.end-a.start)}),cluster=[],clusterEnd=-Infinity;
  function flush(){if(cluster.length)layoutCluster(cluster);cluster=[];clusterEnd=-Infinity}
  items.forEach(function(x){
    if(cluster.length&&x.start>=clusterEnd-0.5)flush();
    cluster.push(x);if(x.end>clusterEnd)clusterEnd=x.end;
  });
  flush();
}
function layoutAgendaOverlaps(){
  try{
    installAgendaOverlapStyle();
    var all=Array.prototype.slice.call(document.querySelectorAll('.oaV14DayBody>.oaV14Event,#oaCalendar.oaCalendarWeek .oaTimelineDay>.oaTimedEvent'));
    var parents=[];
    all.forEach(function(el){if(el.parentElement&&parents.indexOf(el.parentElement)<0)parents.push(el.parentElement)});
    parents.forEach(function(parent){
      var events=all.filter(function(el){return el.parentElement===parent&&getComputedStyle(el).display!=='none'});
      layoutDay(parent,events);
    });
  }catch(e){}
}
function scheduleAgendaOverlapLayout(){
  if(agendaLayoutQueued)return;agendaLayoutQueued=true;
  requestAnimationFrame(function(){agendaLayoutQueued=false;layoutAgendaOverlaps()});
}

function isEditable(el){
  if(!el)return false;
  var t=String(el.tagName||'').toUpperCase();
  if(t==='TEXTAREA'||el.isContentEditable)return true;
  if(t!=='INPUT')return false;
  return ['button','submit','reset','checkbox','radio','file','image','range','color','hidden'].indexOf(String(el.type||'text').toLowerCase())<0;
}
function repairEditableAncestors(el){
  if(!isEditable(el)||el.disabled||el.readOnly)return;
  for(var n=el;n&&n.nodeType===1;n=n.parentElement){
    if(n.hasAttribute&&n.hasAttribute('inert'))n.removeAttribute('inert');
    if(n.getAttribute&&n.getAttribute('aria-hidden')==='true'&&n.contains(el))n.removeAttribute('aria-hidden');
  }
}
function hideLaboratoryPanels(){
  ['optykerLaboratoryPanel','labOrdersPanel'].forEach(function(id){var p=document.getElementById(id);if(p)p.style.display='none'});
  var n=document.getElementById('navLaboratory');if(n)n.classList.remove('active');
}
function revealClientsPanel(){
  hideLaboratoryPanels();
  var p=document.getElementById('clientsPanel');if(p){p.hidden=false;p.style.display='block'}
}
function ensureLaboratorySearch(){
  ['optykerLaboratoryPanel','labOrdersPanel'].forEach(function(id){
    var p=document.getElementById(id);if(!p)return;
    var input=p.querySelector('#optykerLabSearch,#labSearch,input[type="search"]');if(!input)return;
    input.placeholder='Cerca riferimento / codice busta, cliente o prodotto…';
    input.setAttribute('aria-label','Cerca riferimento o codice della busta');
    input.setAttribute('autocomplete','off');
    if(!input.previousElementSibling||!input.previousElementSibling.classList||!input.previousElementSibling.classList.contains('optykerLabSearchLabel')){
      var l=document.createElement('label');l.className='optykerLabSearchLabel';l.textContent='Cerca riferimento / codice busta';
      if(!input.id)input.id='optykerLabReferenceSearch';l.htmlFor=input.id;input.parentNode.insertBefore(l,input);
    }
  });
}
function wrapNavigation(name,kind){
  var old=window[name];if(typeof old!=='function'||old.__optykerStableNavFix)return;
  var w=function(){
    if(kind==='clients')hideLaboratoryPanels();
    var r=old.apply(this,arguments);
    if(kind==='clients')setTimeout(revealClientsPanel,0);
    if(kind==='lab')setTimeout(ensureLaboratorySearch,0);
    return r;
  };
  w.__optykerStableNavFix=true;w.__optykerStableNavOriginal=old;window[name]=w;
}
function installStableNavigation(){
  wrapNavigation('showModule','clients-aware');
  var sm=window.showModule;
  if(typeof sm==='function'&&!sm.__optykerClientAware){
    var base=sm;
    var w=function(which){if(String(which||'')==='clients')hideLaboratoryPanels();var r=base.apply(this,arguments);if(String(which||'')==='clients')setTimeout(revealClientsPanel,0);return r};
    w.__optykerClientAware=true;w.__optykerStableNavFix=true;window.showModule=w;
  }
  wrapNavigation('optykerClientOpenPage','clients');
  wrapNavigation('clientSelect','clients');
  wrapNavigation('openLaboratory','lab');
  ensureLaboratorySearch();
}

function boot(){installCashChannelSeparation();neutralizeInvisibleBlockers();closeStartupStaleOverlays();addEmergencyButton();installStableNavigation();scheduleAgendaOverlapLayout()}
installCashChannelSeparation();
window.optykerLayoutAgendaOverlaps=layoutAgendaOverlaps;
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
window.addEventListener('pageshow',function(){bootAt=Date.now();setTimeout(boot,0)});
window.addEventListener('resize',scheduleAgendaOverlapLayout,{passive:true});
document.addEventListener('keydown',function(e){if(e.key==='Escape')unlockAllKnown()},true);
document.addEventListener('focusin',function(e){repairEditableAncestors(e.target)},true);
document.addEventListener('click',function(e){
  var t=e.target&&e.target.closest?e.target.closest('#navClients,[data-client-page="anagrafica"],#clientPageNav [data-client-page]'):null;
  if(t)setTimeout(revealClientsPanel,0);
},false);
new MutationObserver(function(){neutralizeInvisibleBlockers();scheduleAgendaOverlapLayout()}).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['class','aria-hidden','inert']});
setTimeout(boot,100);setTimeout(boot,600);setTimeout(boot,1800);
})();
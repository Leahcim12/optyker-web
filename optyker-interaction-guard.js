(function(){
'use strict';
if(window.__OPTYKER_INTERACTION_GUARD__)return;
window.__OPTYKER_INTERACTION_GUARD__=true;
var bootAt=Date.now();
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
        if(body&&body.action==='checkout'){
          return nativeFetch(LOCAL_CASH_API,init);
        }
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
function neutralizeInvisibleBlockers(){
  try{
    document.documentElement.style.removeProperty('pointer-events');
    if(document.body){document.body.style.removeProperty('pointer-events');document.body.removeAttribute('inert')}
    document.querySelectorAll('.optykerCashModal:not(.open),.optykerCashOverlay:not(.open),[aria-hidden="true"]').forEach(function(el){
      if(fullScreen(el))el.style.setProperty('pointer-events','none','important');
    });
    Array.prototype.forEach.call(document.body?document.body.children:[],function(el){
      if(!fullScreen(el))return;
      var s=getComputedStyle(el),opacity=Number(s.opacity||1);
      if((s.visibility==='hidden'||opacity<=0.01)&&s.display!=='none')el.style.setProperty('pointer-events','none','important');
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
function boot(){installCashChannelSeparation();neutralizeInvisibleBlockers();closeStartupStaleOverlays();addEmergencyButton()}
installCashChannelSeparation();
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
window.addEventListener('pageshow',function(){bootAt=Date.now();setTimeout(boot,0)});
document.addEventListener('keydown',function(e){if(e.key==='Escape')unlockAllKnown()},true);
new MutationObserver(function(){neutralizeInvisibleBlockers()}).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['class','style','aria-hidden','inert']});
setTimeout(boot,100);setTimeout(boot,600);setTimeout(boot,1800);
})();
(function(){
if(window.__optykerEyewearCatalogTypes1)return;
window.__optykerEyewearCatalogTypes1=true;
window.OPTYKER_EYEWEAR_CATALOG_TYPES_BUILD='20260906-lens-list1';
function add(sel,value){
  if(!sel)return;
  var exists=Array.prototype.some.call(sel.options,function(o){return String(o.value||o.textContent).trim()===value});
  if(exists)return;
  var o=document.createElement('option');o.value=value;o.textContent=value;
  var alt=Array.prototype.find.call(sel.options,function(x){return String(x.textContent||'').trim()==='Altro'});
  if(alt)sel.insertBefore(o,alt);else sel.appendChild(o)
}
function run(){
  ['eyLensType','eyLensTypeOS'].forEach(function(id){var s=document.getElementById(id);add(s,'Zoom di ricetta');add(s,'Profondità di campo')})
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run,{once:true});else run();
new MutationObserver(run).observe(document.documentElement,{childList:true,subtree:true});
setTimeout(run,200);setTimeout(run,800);setTimeout(run,1800)
})();

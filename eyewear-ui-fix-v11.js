(function(){
if(window.__optykerEyewearUiFixV11)return;
window.__optykerEyewearUiFixV11=true;
window.OPTYKER_EYEWEAR_UI_FIX_BUILD='20260906-eyewear-ui-fix-v11';

function E(id){return document.getElementById(id)}
function txt(v){return String(v==null?'':v).trim()}
function low(v){return txt(v).toLocaleLowerCase('it-IT')}
function num(v){var n=Number(String(v==null?'':v).replace(',','.'));return isFinite(n)?n:0}
function clientFrame(){return low(E('eyFrameType')&&E('eyFrameType').value)==='del cliente'}
function framePrice(){return clientFrame()?0:num(E('eyFramePrice')&&E('eyFramePrice').value)}

function warrantyMarkup(){
  return framePrice()>150
    ? '<option value="Base">Base · inclusa</option><option value="Gold">Gold · + € 100</option>'
    : '<option value="Base">Base · inclusa</option><option value="Silver">Silver · + € 20</option>'
}
function syncWarranty(){
  var sel=E('eyWarranty');if(!sel)return;
  var current=txt(sel.value)||'Base',allowed=framePrice()>150?['Base','Gold']:['Base','Silver'];
  if(allowed.indexOf(current)<0)current='Base';
  var html=warrantyMarkup();
  if(sel.innerHTML!==html)sel.innerHTML=html;
  sel.value=current;
  var hint=E('eyWarrantyBox')&&E('eyWarrantyBox').querySelector('.eyWarrantyHint');
  if(hint){
    var wanted=framePrice()>150?'Base inclusa. Gold disponibile per montature oltre € 150.':'Base inclusa. Silver disponibile per montature fino a € 150.';
    if(hint.textContent!==wanted)hint.textContent=wanted
  }
}

/*
  Le vecchie versioni della Scheda Occhiali riscrivevano periodicamente il select
  della garanzia con due testi diversi. Intercettiamo esclusivamente eyWarranty,
  lasciando invariati tutti gli altri select della pagina.
*/
(function installWarrantyGuard(){
  try{
    var proto=window.HTMLSelectElement&&HTMLSelectElement.prototype;
    var base=Object.getOwnPropertyDescriptor(Element.prototype,'innerHTML');
    if(!proto||!base||!base.get||!base.set||Object.getOwnPropertyDescriptor(proto,'innerHTML'))return;
    Object.defineProperty(proto,'innerHTML',{
      configurable:true,enumerable:base.enumerable,
      get:function(){return base.get.call(this)},
      set:function(v){
        if(this&&this.id==='eyWarranty')return base.set.call(this,warrantyMarkup());
        return base.set.call(this,v)
      }
    })
  }catch(e){}
})();

function cleanTypeText(v){
  var s=txt(v);if(!s)return '';
  s=s.replace(/\b(?:indice|index|refractive\s*index)\s*[:=-]?\s*1[\.,](?:5|50|6|60|67|74)\b/gi,' ');
  s=s.replace(/\b1[\.,](?:50|5|60|6|67|74)\b/g,' ');
  s=s.replace(/\s*[·|/\-]+\s*$/g,'').replace(/^\s*[·|/\-]+\s*/g,'').replace(/\s{2,}/g,' ').trim();
  if(/^(indice|index)$/i.test(s))return '';
  return s
}
function cleanLensTypeSelect(sel){
  if(!sel)return;
  var current=cleanTypeText(sel.value),seen={};
  Array.prototype.slice.call(sel.options).forEach(function(o){
    var original=txt(o.value||o.textContent),clean=cleanTypeText(original);
    if(!original)return;
    if(!clean){o.remove();return}
    var key=low(clean);
    if(seen[key]){o.remove();return}
    seen[key]=1;
    if(clean!==original){o.value=clean;o.textContent=clean}
  });
  if(current){
    var match=Array.prototype.find.call(sel.options,function(o){return low(o.value||o.textContent)===low(current)});
    if(match)sel.value=match.value
  }
}
function keepIndexOutOfLensType(){
  cleanLensTypeSelect(E('eyLensType'));
  cleanLensTypeSelect(E('eyLensTypeOS'));
}
function orderOptics(){
  var idx=E('eyLensIndexBox'),w=E('eyWarrantyBox');
  if(idx&&w&&idx.parentNode===w.parentNode&&idx.nextSibling!==w)w.parentNode.insertBefore(idx,w);
  if(idx){
    var lab=idx.querySelector('label');if(lab)lab.textContent='Indice lente';
    var sm=idx.querySelector('small');if(sm)sm.textContent='L’indice si seleziona qui, separatamente dal Tipo lente.'
  }
}
function sync(){keepIndexOutOfLensType();orderOptics();syncWarranty()}

document.addEventListener('change',function(ev){
  if(E('eyewearPanel')&&E('eyewearPanel').contains(ev.target))setTimeout(sync,0)
},true);
document.addEventListener('input',function(ev){
  if(E('eyewearPanel')&&E('eyewearPanel').contains(ev.target))setTimeout(sync,0)
},true);
new MutationObserver(function(){sync()}).observe(document.documentElement,{childList:true,subtree:true});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',sync,{once:true});else sync();
setTimeout(sync,100);setTimeout(sync,500);setTimeout(sync,1500);
})();

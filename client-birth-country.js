(function(){
'use strict';
if(window.OPTYKER_CLIENT_BIRTH_COUNTRY)return;
window.OPTYKER_CLIENT_BIRTH_COUNTRY='20260915-birth-country1';
var mirror=null,wrap=null,lastClient=null,dirty=false,lastPushed='';
function current(){return String(window.clientCurrentId||'');}
function original(){return document.getElementById('optykerExtra-luogoDiNascita');}
function birth(){return document.getElementById('clientDbBirth');}
function ensure(){
  var b=birth();if(!b)return false;
  var bw=b.closest('label'),grid=bw&&bw.parentElement;if(!bw||!grid)return false;
  mirror=document.getElementById('optykerBirthCountryMainInput');
  wrap=document.getElementById('optykerBirthCountryMainWrap');
  if(!mirror){
    wrap=document.createElement('label');wrap.id='optykerBirthCountryMainWrap';wrap.className='clientProfileField optykerBirthPlaceField';
    var cap=document.createElement('span');cap.textContent='Paese di nascita';
    mirror=document.createElement('input');mirror.id='optykerBirthCountryMainInput';mirror.type='text';mirror.placeholder='Paese di nascita';mirror.autocomplete='country-name';mirror.maxLength=3000;
    wrap.append(cap,mirror);
    var age=document.getElementById('clientDbAge'),anchor=age&&age.closest('label')||bw;
    anchor.insertAdjacentElement('afterend',wrap);
    mirror.addEventListener('input',function(){dirty=true;push();});
    mirror.addEventListener('change',function(){dirty=true;push();});
  }
  wrap.hidden=false;wrap.style.display='';
  return true;
}
function push(){
  if(!mirror)return;
  var o=original();if(!o)return;
  var value=String(mirror.value||'');
  if(o.value!==value)o.value=value;
  if(lastPushed!==value){lastPushed=value;o.dispatchEvent(new Event('input',{bubbles:true}));o.dispatchEvent(new Event('change',{bubbles:true}));}
}
function sync(){
  if(!ensure())return;
  var cid=current();
  if(lastClient===null)lastClient=cid;
  else if(cid!==lastClient){lastClient=cid;dirty=false;lastPushed='';mirror.value='';}
  var o=original();
  if(!o)return;
  var ow=o.closest('label');if(ow&&ow!==wrap){ow.hidden=true;ow.style.display='none';}
  if(dirty)push();
  else {
    var v=String(o.value||'');
    if(mirror.value!==v)mirror.value=v;
    lastPushed=v;
  }
}
function boot(){
  sync();
  if(window.MutationObserver){new MutationObserver(sync).observe(document.getElementById('clientAnagraficaSection')||document.body,{childList:true,subtree:true});}
  window.addEventListener('optyker:client-saved',function(){setTimeout(sync,50);setTimeout(sync,350);});
  setInterval(function(){if(!document.hidden)sync();},300);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();

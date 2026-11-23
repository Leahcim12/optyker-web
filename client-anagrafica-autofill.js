(function(){
'use strict';
if(window.OPTYKER_CLIENT_ANAGRAFICA_AUTOFILL)return;
window.OPTYKER_CLIENT_ANAGRAFICA_AUTOFILL='20260915-anagrafica-autofill2';

var ROOT='https://whgziwaegjzqsgcntesr.supabase.co';
var requestSeq=0,lastClient=null,sexMirror=null,sexWrap=null,sexDirty=false,lastSexPushed='',pendingDetail=null;
var fiscalStatus=null;
var omocodeDigits={L:'0',M:'1',N:'2',P:'3',Q:'4',R:'5',S:'6',T:'7',U:'8',V:'9'};
var months={A:1,B:2,C:3,D:4,E:5,H:6,L:7,M:8,P:9,R:10,S:11,T:12};
var odd={
 '0':1,'1':0,'2':5,'3':7,'4':9,'5':13,'6':15,'7':17,'8':19,'9':21,
 A:1,B:0,C:5,D:7,E:9,F:13,G:15,H:17,I:19,J:21,K:2,L:4,M:18,N:20,O:11,P:3,Q:6,R:8,S:12,T:14,U:16,V:10,W:22,X:25,Y:24,Z:23
};
var even={
 '0':0,'1':1,'2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,
 A:0,B:1,C:2,D:3,E:4,F:5,G:6,H:7,I:8,J:9,K:10,L:11,M:12,N:13,O:14,P:15,Q:16,R:17,S:18,T:19,U:20,V:21,W:22,X:23,Y:24,Z:25
};
function E(id){return document.getElementById(id);}
function current(){return String(window.clientCurrentId||'');}
function extraSex(){return E('optykerExtra-sesso');}
function extraPlace(){return E('optykerExtra-luogoDiNascita');}
function birthCountry(){return E('optykerBirthCountryMainInput');}
function cleanFiscal(v){return String(v||'').replace(/\s+/g,'').toUpperCase();}
function titleCase(v){
 return String(v||'').toLocaleLowerCase('it-IT').replace(/(^|[\s'’\-])([\p{L}])/gu,function(_,a,b){return a+b.toLocaleUpperCase('it-IT');});
}
function normalizePersonName(input){
 if(!input||input.readOnly||input.disabled)return;
 var before=String(input.value||''),after=titleCase(before);if(before===after)return;
 var start=input.selectionStart,end=input.selectionEnd;
 input.value=after;
 try{if(document.activeElement===input&&start!=null&&end!=null)input.setSelectionRange(start,end);}catch(_){ }
}
function checksumOk(cf){
 if(!/^[A-Z]{6}[0-9LMNPQRSTUV]{2}[ABCDEHLMPRST][0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{3}[A-Z]$/.test(cf))return false;
 var sum=0;
 for(var i=0;i<15;i++){
  var table=i%2===0?odd:even,v=table[cf.charAt(i)];if(v===undefined)return false;sum+=v;
 }
 return String.fromCharCode(65+(sum%26))===cf.charAt(15);
}
function digit(ch){return Number(omocodeDigits[ch]!==undefined?omocodeDigits[ch]:ch);}
function localDecode(cf){
 if(!checksumOk(cf))return null;
 var yy=digit(cf.charAt(6))*10+digit(cf.charAt(7)),month=months[cf.charAt(8)];
 var rawDay=digit(cf.charAt(9))*10+digit(cf.charAt(10)),gender=rawDay>40?'F':'M',day=rawDay>40?rawDay-40:rawDay;
 if(!month||day<1||day>31)return null;
 var currentYear=new Date().getFullYear(),candidate=2000+yy,year=candidate<=currentYear?candidate:1900+yy;
 var d=new Date(year,month-1,day);if(d.getFullYear()!==year||d.getMonth()!==month-1||d.getDate()!==day)return null;
 return {birth_date:String(day).padStart(2,'0')+'/'+String(month).padStart(2,'0')+'/'+String(year),gender:gender};
}
function setStatus(text,state){
 ensureFiscalStatus();if(!fiscalStatus)return;fiscalStatus.textContent=text||'';fiscalStatus.dataset.state=state||'';fiscalStatus.hidden=!text;
}
function ensureFiscalStatus(){
 var fiscal=E('clientDbFiscal');if(!fiscal)return false;
 fiscalStatus=E('optykerFiscalAutofillStatus');
 if(!fiscalStatus){
  fiscalStatus=document.createElement('small');fiscalStatus.id='optykerFiscalAutofillStatus';fiscalStatus.hidden=true;fiscalStatus.setAttribute('role','status');fiscalStatus.setAttribute('aria-live','polite');
  var wrap=fiscal.closest('label');if(wrap)wrap.append(fiscalStatus);else fiscal.insertAdjacentElement('afterend',fiscalStatus);
 }
 return true;
}
function ensureSex(){
 var birth=E('clientDbBirth');if(!birth)return false;
 sexMirror=E('optykerSexMainInput');sexWrap=E('optykerSexMainWrap');
 if(!sexMirror){
  sexWrap=document.createElement('label');sexWrap.id='optykerSexMainWrap';sexWrap.className='clientProfileField optykerSexField';
  var cap=document.createElement('span');cap.textContent='Sesso (M/F)';
  sexMirror=document.createElement('select');sexMirror.id='optykerSexMainInput';sexMirror.setAttribute('aria-label','Sesso M o F');
  [['','Non indicato'],['M','M'],['F','F']].forEach(function(x){var o=document.createElement('option');o.value=x[0];o.textContent=x[1];sexMirror.append(o);});
  sexWrap.append(cap,sexMirror);
  var countryWrap=E('optykerBirthCountryMainWrap'),age=E('clientDbAge'),birthWrap=birth.closest('label'),anchor=countryWrap||(age&&age.closest('label'))||birthWrap;
  if(anchor)anchor.insertAdjacentElement('afterend',sexWrap);
  sexMirror.addEventListener('input',function(){sexDirty=true;pushSex();});
  sexMirror.addEventListener('change',function(){sexDirty=true;pushSex();});
 }
 sexWrap.hidden=false;sexWrap.style.display='';
 return true;
}
function nudgeExtendedSave(){
 var p=extraPlace();if(p)p.dispatchEvent(new Event('input',{bubbles:true}));
}
function pushSex(){
 if(!sexMirror)return;
 var o=extraSex();if(!o)return;
 var value=String(sexMirror.value||'');if(o.value!==value)o.value=value;
 if(lastSexPushed!==value){lastSexPushed=value;o.dispatchEvent(new Event('input',{bubbles:true}));o.dispatchEvent(new Event('change',{bubbles:true}));nudgeExtendedSave();}
}
function syncSex(){
 if(!ensureSex())return;
 var cid=current();
 if(lastClient===null)lastClient=cid;
 else if(cid!==lastClient){lastClient=cid;sexDirty=false;lastSexPushed='';sexMirror.value='';setStatus('','');}
 var o=extraSex();if(!o)return;
 var ow=o.closest('label');if(ow&&ow!==sexWrap){ow.hidden=true;ow.style.display='none';}
 if(sexDirty)pushSex();else{var v=String(o.value||'');if(sexMirror.value!==v)sexMirror.value=v;lastSexPushed=v;}
}
function setBirth(v){
 var e=E('clientDbBirth');if(!e||!v)return;
 if(e.value!==v){e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));}
}
function setSex(v){
 if(!ensureSex()||!v)return;
 if(sexMirror.value!==v){sexMirror.value=v;sexDirty=true;sexMirror.dispatchEvent(new Event('input',{bubbles:true}));sexMirror.dispatchEvent(new Event('change',{bubbles:true}));}
}
function setCountry(v){
 var e=birthCountry();if(!e||!v)return;v=titleCase(v);
 if(e.value!==v){e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));}
}
async function remoteDecode(cf,seq){
 var ac=new AbortController(),timer=setTimeout(function(){ac.abort();},12000);
 try{
  var r=await fetch(ROOT+'/functions/v1/optyker-fiscal-code-decode',{method:'POST',cache:'no-store',signal:ac.signal,headers:{'Content-Type':'application/json'},body:JSON.stringify({cf:cf})});
  var x=await r.json().catch(function(){return {};});
  if(seq!==requestSeq||cleanFiscal(E('clientDbFiscal')&&E('clientDbFiscal').value)!==cf)return;
  if(!r.ok||!x||x.ok===false)throw new Error(x&&x.error||'Luogo di nascita non disponibile');
  var d=x.data||{};if(d.birth_place)setCountry(d.birth_place);
  setStatus(d.birth_place?'Data, sesso e luogo di nascita compilati automaticamente.':'Data e sesso compilati automaticamente. Inserisci il luogo di nascita manualmente.','ok');
 }catch(e){
  if(seq!==requestSeq)return;
  setStatus('Data e sesso compilati. Luogo di nascita non disponibile automaticamente: inseriscilo manualmente.','warn');
 }finally{clearTimeout(timer);}
}
function fiscalChanged(input){
 var cf=cleanFiscal(input.value);if(input.value!==cf)input.value=cf;
 requestSeq++;
 if(!cf){setStatus('','');return;}
 if(cf.length<16){setStatus('Completa il codice fiscale per compilare automaticamente i dati.','');return;}
 var decoded=localDecode(cf);
 if(!decoded){setStatus('Codice fiscale non valido: controlla i caratteri e la lettera finale.','bad');return;}
 setBirth(decoded.birth_date);setSex(decoded.gender);
 setStatus('Codice fiscale valido: data e sesso compilati. Ricerca luogo di nascita…','loading');
 remoteDecode(cf,requestSeq);
}
function rememberDetailSave(){
 if(!sexDirty||!sexMirror)return;
 pendingDetail={sex:String(sexMirror.value||''),place:String((birthCountry()&&birthCountry().value)||''),client:current()};
}
function finishDetailSave(clientId,detail,attempt){
 attempt=attempt||0;
 if(!detail||current()!==String(clientId||''))return;
 var sex=extraSex(),place=extraPlace(),fields=E('optykerExtraFields'),btn=E('optykerExtraSave');
 if(!sex||!place||!fields||fields.disabled||!btn||typeof btn.onclick!=='function'){
  if(attempt<100)setTimeout(function(){finishDetailSave(clientId,detail,attempt+1);},60);
  return;
 }
 var changed=false;
 if(sex.value!==detail.sex){sex.value=detail.sex;sex.dispatchEvent(new Event('input',{bubbles:true}));sex.dispatchEvent(new Event('change',{bubbles:true}));changed=true;}
 if(detail.place&&place.value!==detail.place){place.value=detail.place;place.dispatchEvent(new Event('input',{bubbles:true}));place.dispatchEvent(new Event('change',{bubbles:true}));changed=true;}
 fields.dispatchEvent(new Event('input',{bubbles:true}));
 if(!changed&&btn.disabled){sexDirty=false;pendingDetail=null;return;}
 if(btn.disabled){if(attempt<100)setTimeout(function(){finishDetailSave(clientId,detail,attempt+1);},60);return;}
 Promise.resolve(btn.onclick()).then(function(){
  var st=E('optykerExtraStatus');if(st&&st.classList.contains('bad'))throw new Error(st.textContent||'Dati anagrafici non salvati');
  sexDirty=false;pendingDetail=null;
 }).catch(function(){
  if(attempt<100)setTimeout(function(){finishDetailSave(clientId,detail,attempt+1);},120);
 });
}
function bindCore(){
 ensureFiscalStatus();ensureSex();syncSex();
 var fiscal=E('clientDbFiscal');
 if(fiscal&&!fiscal.dataset.optykerAutoFiscal){
  fiscal.dataset.optykerAutoFiscal='1';
  fiscal.autocomplete='off';
  fiscal.addEventListener('input',function(){fiscalChanged(fiscal);});
  fiscal.addEventListener('change',function(){fiscalChanged(fiscal);});
 }
 ['clientDbName','clientDbSurname'].forEach(function(id){
  var e=E(id);if(!e||e.dataset.optykerNameCase)return;e.dataset.optykerNameCase='1';
  e.addEventListener('input',function(ev){if(!ev.isComposing)normalizePersonName(e);});
  e.addEventListener('change',function(){normalizePersonName(e);});
  e.addEventListener('blur',function(){normalizePersonName(e);});
 });
}
function boot(){
 bindCore();
 var root=E('clientAnagraficaSection')||document.body;
 if(window.MutationObserver)new MutationObserver(function(){bindCore();syncSex();}).observe(root,{childList:true,subtree:true});
 document.addEventListener('click',function(ev){
  var b=ev.target&&ev.target.closest?ev.target.closest('[data-client-profile-save],#optykerClientSaveButton'):null;if(b)rememberDetailSave();
 },true);
 window.addEventListener('optyker:client-saved',function(ev){
  var id=String(ev&&ev.detail&&ev.detail.client_id||current());var detail=pendingDetail;
  setTimeout(syncSex,50);setTimeout(syncSex,350);
  if(detail)setTimeout(function(){finishDetailSave(id,detail,0);},250);
 });
 setInterval(function(){if(!document.hidden){bindCore();syncSex();}},400);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();

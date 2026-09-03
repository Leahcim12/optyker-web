(function(){
if(window.__optykerFormAutomationV1)return;
window.__optykerFormAutomationV1=true;
window.OPTYKER_FORM_AUTOMATION_BUILD='20260903-rxrules2';

var internal=false;

function E(id){return document.getElementById(id)}
function text(v){return String(v==null?'':v)}
function low(v){return text(v).toLocaleLowerCase('it-IT').normalize('NFD').replace(/[\u0300-\u036f]/g,'')}
function attr(el,n){try{return el&&el.getAttribute?text(el.getAttribute(n)):''}catch(e){return ''}}
function fields(root){return root?Array.prototype.slice.call(root.querySelectorAll('input,select,textarea')):[]}
function valueSetter(el,v){
  if(!el)return;
  var val=text(v),proto=el.tagName==='SELECT'?HTMLSelectElement.prototype:(el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype);
  try{
    var d=Object.getOwnPropertyDescriptor(proto,'value');
    if(d&&d.set)d.set.call(el,val);else el.value=val
  }catch(e){el.value=val}
}
function emit(el){
  if(!el)return;
  try{el.dispatchEvent(new Event('input',{bubbles:true}))}catch(e){}
  try{el.dispatchEvent(new Event('change',{bubbles:true}))}catch(e){}
}
function setAuto(el,v){
  if(!el||text(el.value)===text(v))return;
  internal=true;
  try{valueSetter(el,v);emit(el)}finally{internal=false}
}

/* Nomi clienti: iniziale maiuscola, resto minuscolo. Gestisce anche nomi composti. */
function capitalizeName(v){
  var s=text(v).toLocaleLowerCase('it-IT');
  var out='',upper=true;
  for(var i=0;i<s.length;i++){
    var ch=s.charAt(i);
    if(upper&&/[A-Za-zÀ-ÖØ-öø-ÿ]/.test(ch)){out+=ch.toLocaleUpperCase('it-IT');upper=false}
    else{out+=ch}
    if(ch===' '||ch==="'"||ch==='’'||ch==='-')upper=true
  }
  return out
}
function associatedLabel(el){
  var a=[];
  if(el&&el.id){
    try{
      var l=document.querySelector('label[for="'+CSS.escape(el.id)+'"]');
      if(l)a.push(l.textContent||'')
    }catch(e){}
  }
  var p=el&&el.closest?el.closest('label'):null;if(p)a.push(p.textContent||'');
  var field=el&&el.closest?el.closest('.clientProfileField,.field,.formField,.inputGroup,[data-field],[data-key]'):null;
  if(field){
    var l2=field.querySelector('label');if(l2)a.push(l2.textContent||'');
  }
  return a.join(' ')
}
function hasClientContext(el){
  var p=el;
  for(var i=0;p&&i<8;i++,p=p.parentElement){
    var m=low((p.id||'')+' '+(typeof p.className==='string'?p.className:'')+' '+attr(p,'data-section')+' '+attr(p,'data-module'));
    if(/client|cliente|anagraf|pazient/.test(m))return true
  }
  return false
}
function isPersonNameInput(el){
  if(!el||el.tagName!=='INPUT')return false;
  var type=low(el.type||'text');if(type&&['text','search'].indexOf(type)<0)return false;
  var own=low([el.id,el.name,attr(el,'autocomplete'),attr(el,'placeholder'),attr(el,'aria-label'),attr(el,'data-field'),attr(el,'data-key')].join(' '));
  if(/user.?name|username|login|email|azienda|ditta|prodotto|servizio|marca/.test(own))return false;
  if(/given.?name|family.?name|first.?name|last.?name|client.*(?:name|nome|surname|cognome)|(?:name|nome|surname|cognome).*client/.test(own))return true;
  var lab=low(associatedLabel(el)).replace(/\s+/g,' ').trim();
  if(/^(nome|cognome|nome cliente|cognome cliente|nome paziente|cognome paziente)\b/.test(lab)&&hasClientContext(el))return true;
  return false
}
function normalizePersonName(el){
  if(!isPersonNameInput(el))return;
  var v=text(el.value),n=capitalizeName(v);
  if(v===n)return;
  var start=null,end=null;try{start=el.selectionStart;end=el.selectionEnd}catch(e){}
  valueSetter(el,n);
  try{if(start!=null)el.setSelectionRange(start,end)}catch(e){}
}

/* Prescrizione */
function explicitRxParts(el){
  var k=attr(el,'data-rx-key')||attr(el,'name')||attr(el,'id'),m=text(k).match(/^rx_(od|os)_(sf|cil|asse|add|visus|voo|distan)_(\d+)$/i);
  return m?{eye:m[1].toLowerCase(),field:m[2].toLowerCase(),row:parseInt(m[3],10)}:null
}
function refreshAddLocks(root){
  root=root||E('prescriptionPanel')||document;
  var xs=root.querySelectorAll('[data-rx-key*="_add_"],input[name*="_add_"],input[id*="_add_"]');
  for(var i=0;i<xs.length;i++){
    var p=explicitRxParts(xs[i]);if(!p)continue;
    var lock=p.row===1||p.row===4;
    xs[i].disabled=lock;
    xs[i].readOnly=lock;
    xs[i].setAttribute('aria-disabled',lock?'true':'false');
    if(lock){xs[i].value='';xs[i].setAttribute('title','ADD disponibile solo nelle righe 2 e 3')}
    else xs[i].removeAttribute('title')
  }
}
function explicitPrescriptionInput(el){
  var p=explicitRxParts(el);if(!p)return false;
  var root=el.closest('[data-rx-sheet]')||E('prescriptionPanel')||document;
  if(p.field==='add'){
    if(p.row===1||p.row===4){setAuto(el,'');refreshAddLocks(root);return true}
    var sf1=root.querySelector('[data-rx-key="rx_'+p.eye+'_sf_1"]'),target=root.querySelector('[data-rx-key="rx_'+p.eye+'_sf_'+p.row+'"]');
    var add=parseOptical(el.value),base=sf1?parseOptical(sf1.value):NaN;
    if(target&&isFinite(add)&&isFinite(base))setAuto(target,formatOptical(base+add,target));
    return true
  }
  if((p.field==='cil'||p.field==='asse')&&p.row!==4){
    for(var r=1;r<=3;r++){
      var dst=root.querySelector('[data-rx-key="rx_'+p.eye+'_'+p.field+'_'+r+'"]');
      if(dst&&dst!==el)setAuto(dst,el.value)
    }
    return true
  }
  return true
}

function prescriptionRoot(el){
  var p=E('prescriptionPanel');
  if(p&&p.contains(el))return p;
  return el&&el.closest?el.closest('[id*="prescription"],[class*="prescription"],[data-module="prescription"]'):null
}
function ownMeta(el){
  return low([
    el&&el.id,el&&el.name,attr(el,'placeholder'),attr(el,'aria-label'),attr(el,'title'),
    attr(el,'data-field'),attr(el,'data-key'),attr(el,'data-name'),attr(el,'data-col'),attr(el,'data-type')
  ].join(' '))
}
function cellIndex(cell){
  if(!cell||!cell.parentElement)return -1;
  var cs=Array.prototype.filter.call(cell.parentElement.children,function(x){return /^(TD|TH)$/.test(x.tagName)});
  return cs.indexOf(cell)
}
function headerFor(el){
  var cell=el&&el.closest?el.closest('td,th'):null,table=el&&el.closest?el.closest('table'):null;
  if(!cell||!table)return '';
  var idx=cellIndex(cell),parts=[];
  if(idx<0)return '';
  var hrs=table.querySelectorAll('thead tr');
  for(var i=0;i<hrs.length;i++){
    var c=Array.prototype.filter.call(hrs[i].children,function(x){return /^(TD|TH)$/.test(x.tagName)})[idx];
    if(c)parts.push(c.textContent||'')
  }
  if(!parts.length){
    var first=table.querySelector('tr');
    if(first){
      var c2=Array.prototype.filter.call(first.children,function(x){return /^(TD|TH)$/.test(x.tagName)})[idx];
      if(c2&&c2!==cell)parts.push(c2.textContent||'')
    }
  }
  return parts.join(' ')
}
function semanticText(el){
  var parts=[ownMeta(el),associatedLabel(el),headerFor(el)];
  var cell=el&&el.closest?el.closest('td,th'):null;
  if(cell){
    parts.push(attr(cell,'data-field'),attr(cell,'data-key'),attr(cell,'data-col'),attr(cell,'aria-label'));
    var cloned;
    try{
      cloned=cell.cloneNode(true);
      Array.prototype.forEach.call(cloned.querySelectorAll('input,select,textarea,button'),function(x){x.remove()});
      parts.push(cloned.textContent||'')
    }catch(e){}
  }
  return low(parts.join(' ')).replace(/\s+/g,' ').trim()
}
function kind(el){
  var s=semanticText(el);
  if(/\badd\b|addiz/.test(s))return 'add';
  if(/cilind|\bcyl\b/.test(s))return 'cylinder';
  if(/\basse\b|\baxis\b|\bax\b/.test(s))return 'axis';
  if(/sfer|\bsph\b|\bsphere\b/.test(s))return 'sphere';
  return ''
}
function rowFor(el){return el&&el.closest?el.closest('tr'):null}
function tableFor(el){return el&&el.closest?el.closest('table'):null}
function dataRows(table){
  if(!table)return [];
  var body=table.tBodies&&table.tBodies.length?table.tBodies[0]:null;
  var rows=Array.prototype.slice.call((body||table).querySelectorAll('tr'));
  return rows.filter(function(r){
    var fs=fields(r);
    if(!fs.length)return false;
    return fs.some(function(x){return !!kind(x)})
  })
}
function kindsInRow(row,k){
  return fields(row).filter(function(x){return kind(x)===k})
}
function ordinal(row,el,k){
  var a=kindsInRow(row,k),i=a.indexOf(el);return i<0?0:i
}
function sameKindAt(row,k,ord){
  var a=kindsInRow(row,k);if(!a.length)return null;
  return a[Math.min(Math.max(0,ord),a.length-1)]
}
function parseOptical(v){
  var s=text(v).trim().replace(',','.').replace(/[^0-9+\-.]/g,'');
  if(!s||s==='+'||s==='-'||s==='.')return NaN;
  var n=Number(s);return isFinite(n)?n:NaN
}
function formatOptical(n,el){
  var x=Math.round(Number(n)*100)/100;if(!isFinite(x))return '';
  var t=low(el&&el.type||'');
  if(t==='number')return x.toFixed(2);
  return (x>0?'+':'')+x.toFixed(2).replace('.',',')
}
function propagateColumn(el,k){
  var table=tableFor(el),row=rowFor(el);if(!table||!row)return;
  var rows=dataRows(table);if(rows.length<2)return;
  var ord=ordinal(row,el,k),v=text(el.value);
  /* Tutta la colonna, tranne l'ultima riga. */
  for(var i=0;i<rows.length-1;i++){
    var dst=sameKindAt(rows[i],k,ord);
    if(dst&&dst!==el)setAuto(dst,v)
  }
}
function applyAdd(el){
  var table=tableFor(el),row=rowFor(el);if(!table||!row)return;
  var rows=dataRows(table),ri=rows.indexOf(row);if(ri<1)return;
  var add=parseOptical(el.value);if(!isFinite(add))return;
  var ord=ordinal(row,el,'add');
  var source=sameKindAt(rows[0],'sphere',ord);
  var target=sameKindAt(row,'sphere',ord);
  if(!source||!target)return;
  var sph=parseOptical(source.value);if(!isFinite(sph))return;
  setAuto(target,formatOptical(sph+add,target))
}
function prescriptionInput(el){
  if(!prescriptionRoot(el))return;
  if(explicitPrescriptionInput(el)){refreshAddLocks(el.closest('[data-rx-sheet]')||prescriptionRoot(el));return}
  var k=kind(el);
  if(k==='cylinder'||k==='axis')propagateColumn(el,k);
  else if(k==='add')applyAdd(el)
}

function onInput(ev){
  if(internal)return;
  var el=ev.target;if(!el||!el.tagName)return;
  normalizePersonName(el);
  prescriptionInput(el)
}
function onChange(ev){
  if(internal)return;
  var el=ev.target;if(!el||!el.tagName)return;
  normalizePersonName(el);
  prescriptionInput(el)
}
document.addEventListener('input',onInput,true);
document.addEventListener('change',onChange,true);
document.addEventListener('blur',function(ev){if(!internal)normalizePersonName(ev.target)},true);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){refreshAddLocks()}, {once:true});else refreshAddLocks();
setInterval(function(){refreshAddLocks()},800);

})();
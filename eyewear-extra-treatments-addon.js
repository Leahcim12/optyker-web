(function(){
if(window.__optykerEyewearFlowV6)return;
window.__optykerEyewearFlowV6=true;
window.OPTYKER_EYEWEAR_FLOW_BUILD='20260906-eyewear-flow6';
var scheduled=0,observer=null,osTouched=false,fetchWrapped=false;
function E(id){return document.getElementById(id)}
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function euro(v){try{return new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR'}).format(Number(v||0))}catch(e){return Number(v||0).toFixed(2)+' €'}}
function num(id){var n=Number(E(id)&&E(id).value||0);return isFinite(n)?Math.round(n*100)/100:0}
function lensTypes(){return [String(E('eyLensType')&&E('eyLensType').value||''),String(E('eyLensTypeOS')&&E('eyLensTypeOS').value||'')]}
function isClientLens(t){return String(t||'').trim().toLowerCase()==='del cliente'}
function isPrescriptionLens(t){var x=String(t||'').trim().toLowerCase();return !!x&&x!=='del cliente'&&!/neutra|sole/.test(x)}
function isProgressiveSupport(t){return /progressiv|supporto\s+accomod/.test(String(t||'').toLowerCase())}
function soldLensTypes(){return lensTypes().filter(function(t){return String(t||'').trim()&&!isClientLens(t)})}
function prescriptionLensTypes(){return soldLensTypes().filter(isPrescriptionLens)}
function treatments(){var p=E('eyewearPanel')||document;return Array.prototype.slice.call(p.querySelectorAll('[data-ey-treatment]:checked')).map(function(x){return x.value})}
function mountingInfo(){var m=String(E('eyMounting')&&E('eyMounting').value||''),price=0,label='';if(m==='special'){price=25;label='Montaggio speciale'}else if(m==='traditional'){price=lensTypes().some(isProgressiveSupport)?25:15;label='Montaggio tradizionale'}return {mode:m,label:label,price:price}}
function colorMode(){var x=(E('eyewearPanel')||document).querySelector('[data-ey-color].active');return x?String(x.getAttribute('data-ey-color')||''):''}
function colorInfo(){var m=colorMode().toLowerCase(),qty=soldLensTypes().length,unit=0,label='';if(/photo|foto/.test(m)){unit=40;label='Fotocromatico'}else if(/sun|sole/.test(m)){unit=20;label='Sole'}return {mode:m,label:label,unit:unit,qty:qty,total:Math.round(unit*qty*100)/100}}
function warranty(){return String(E('eyWarranty')&&E('eyWarranty').value||'')}
function treatmentDetails(){
 var sold=soldLensTypes(),rx=prescriptionLensTypes(),out=[];
 treatments().forEach(function(tr){
  var amount=0,unit=0,count=0,free=false;
  if(tr==='Indurente'){unit=10;count=sold.length;amount=unit*count}
  else if(tr==='Antiriflesso'){unit=15;count=sold.length;amount=unit*count}
  else if(tr==='Filtro luce blu'){unit=25;count=sold.length;amount=unit*count}
  else if(tr==='UV'){unit=5;count=sold.length;amount=unit*count}
  else if(tr==='Precal'){unit=25;count=sold.length;amount=unit*count}
  else if(tr==='Personalizzazione'){unit=0;count=sold.length;amount=0;free=true}
  else if(tr==='Polarizzato'){unit=20;count=rx.length;amount=unit*count}
  else if(tr==='Antiriflesso premium'){count=rx.length;amount=rx.reduce(function(sum,t){return sum+(isProgressiveSupport(t)?25:20)},0)}
  out.push({name:tr,unit:tr==='Antiriflesso premium'?null:unit,count:count,total:Math.round(amount*100)/100,free:free})
 });
 return out
}
function pricing(){
 var frame=isClientLens(E('eyFrameType')&&E('eyFrameType').value)?0:num('eyFramePrice'),unit=num('eyLensPrice'),qty=soldLensTypes().length,discount=Math.max(0,Math.min(100,Number(E('eyDiscount')&&E('eyDiscount').value||0)));
 var gross=Math.round(unit*qty*100)/100,disc=Math.round(gross*discount)/100,net=Math.round((gross-disc)*100)/100,details=treatmentDetails();
 var treatmentTotal=Math.round(details.reduce(function(a,x){return a+Number(x.total||0)},0)*100)/100,mi=mountingInfo(),ci=colorInfo(),total=Math.round((frame+net+treatmentTotal+mi.price+ci.total)*100)/100;
 return {frame:frame,unit:unit,qty:qty,discount:discount,gross:gross,disc:disc,net:net,details:details,treatmentTotal:treatmentTotal,mounting:mi,color:ci,warranty:warranty(),total:total}
}
function treatmentLabel(x){var q=x.count?' · '+x.count+' lente'+(x.count===1?'':'i'):'';return esc(x.name)+q}
function summaryHtml(){
 var p=pricing(),extras=p.details.map(function(x){return '<div class="eySummaryRow"><span>'+treatmentLabel(x)+'</span><b>'+(x.free?'In omaggio':esc(euro(x.total)))+'</b></div>'}).join('');
 var color=p.color.label?'<div class="eySummaryRow"><span>'+esc(p.color.label)+' · '+p.color.qty+' lente'+(p.color.qty===1?'':'i')+'</span><b>'+esc(euro(p.color.total))+'</b></div>':'';
 var warr='<div class="eySummaryRow"><span>Garanzia</span><b>'+esc(p.warranty||'Da selezionare')+'</b></div>';
 return '<div class="eySummaryRow"><span>Montatura</span><b>'+esc(euro(p.frame))+'</b></div><div class="eySummaryRow"><span>Lenti · '+p.qty+' × '+esc(euro(p.unit))+'</span><b>'+esc(euro(p.gross))+'</b></div>'+warr+(p.discount?'<div class="eySummaryRow discount"><span>Sconto lenti '+p.discount+'%</span><b>− '+esc(euro(p.disc))+'</b></div>':'')+'<div class="eySummaryRow"><span>Totale lenti dopo sconto</span><b>'+esc(euro(p.net))+'</b></div>'+extras+color+(p.mounting.label?'<div class="eySummaryRow"><span>'+esc(p.mounting.label)+'</span><b>'+esc(euro(p.mounting.price))+'</b></div>':'')+'<div class="eySummaryRow total"><span>Totale</span><b>'+esc(euro(p.total))+'</b></div>'
}
function render(){var box=E('eySummary');if(!box)return;var html=summaryHtml();if(box.innerHTML!==html)box.innerHTML=html}
function schedule(){clearTimeout(scheduled);scheduled=setTimeout(render,25)}
function addTreatment(value,title,sub){
 var panel=E('eyewearPanel'),box=panel&&panel.querySelector('.eyTreatments');if(!box||box.querySelector('[data-ey-treatment][value="'+value+'"]'))return;
 var lab=document.createElement('label');lab.className='eyCheck';lab.innerHTML='<input type="checkbox" data-ey-treatment value="'+esc(value)+'"><span>'+esc(title)+'<small>'+esc(sub)+'</small></span>';box.appendChild(lab)
}
function ensureWarranty(){
 if(E('eyWarranty'))return;
 var disc=E('eyDiscount'),row=disc&&disc.closest('.eyDiscountRow'),price=E('eyLensPrice'),target=row||(price&&price.closest('.eyField'));
 if(!target||!target.parentNode)return;
 var box=document.createElement('div');box.id='eyWarrantyBox';box.className='eyWarrantyBox eyField';
 box.innerHTML='<label class="eyRequired">Garanzia</label><select id="eyWarranty"><option value="">Seleziona garanzia…</option><option value="Nessuna garanzia">Nessuna garanzia</option><option value="Garanzia inclusa">Garanzia inclusa</option></select><small class="eyWarrantyHint">Seleziona la garanzia prima di prezzo e sconto.</small>';
 target.parentNode.insertBefore(box,target)
}
function syncWarrantyGate(){
 var ok=!!warranty(),price=E('eyLensPrice'),disc=E('eyDiscount');
 [price,disc].forEach(function(x){if(!x)return;x.disabled=!ok;x.setAttribute('aria-disabled',ok?'false':'true')});
 var box=E('eyWarrantyBox');if(box)box.classList.toggle('pending',!ok)
}
function syncFrameClient(){
 var t=E('eyFrameType'),brand=E('eyFrameBrand');if(!t||!brand)return;
 var client=isClientLens(t.value),ids=['eyFrameModel','eyFrameColor','eyFrameDescription','eyFramePrice','eyFrameBarcode','eyFrameSku'];
 if(client){
  if(brand.value!=='Del cliente'){brand.dataset.beforeClient=brand.value||'';brand.value='Del cliente'}
  brand.readOnly=true;
  ids.forEach(function(id){var x=E(id);if(!x)return;if(id==='eyFramePrice')x.value='0';else x.value='';x.disabled=true});
  var sb=(E('eyFrameBarcodeSearch')||E('eyFrameWarehouseSearch'));var search=sb&&sb.closest('.eyFrameSearchBox');if(search)search.style.display='none'
 }else{
  if(brand.value==='Del cliente')brand.value=brand.dataset.beforeClient||'';
  brand.readOnly=false;
  ids.forEach(function(id){var x=E(id);if(x)x.disabled=false});
  var sb2=(E('eyFrameBarcodeSearch')||E('eyFrameWarehouseSearch'));var search2=sb2&&sb2.closest('.eyFrameSearchBox');if(search2)search2.style.display=''
 }
}
function syncLensSequence(){
 var dx=E('eyLensType'),os=E('eyLensTypeOS');if(!dx||!os)return;
 if(!String(dx.value||'').trim()){os.value='';os.disabled=true;osTouched=false}
 else {os.disabled=false}
 var wrap=os.closest('.eyField');if(wrap)wrap.classList.toggle('eyLensWaiting',os.disabled)
}
function clearProgrammaticOS(){
 var dx=E('eyLensType'),os=E('eyLensTypeOS');if(!dx||!os||!String(dx.value||'').trim()||osTouched)return;
 if(os.value){os.value='';os.dispatchEvent(new Event('input',{bubbles:true}))}
 os.disabled=false;try{os.focus()}catch(e){}
}
function labelColors(){
 var p=E('eyewearPanel');if(!p)return;
 p.querySelectorAll('[data-ey-color]').forEach(function(b){
  var v=String(b.getAttribute('data-ey-color')||'').toLowerCase(),sm=b.querySelector('small');
  if(!sm){sm=document.createElement('small');b.appendChild(sm)}
  if(/photo|foto/.test(v))sm.textContent='€ 40 / lente';
  else if(/sun|sole/.test(v))sm.textContent='€ 20 / lente'
 })
}
function ensureStyle(){
 if(E('optykerEyewearFlowV6Css'))return;
 var st=document.createElement('style');st.id='optykerEyewearFlowV6Css';st.textContent='.eyWarrantyBox{margin:12px 0;padding:11px;border:1px solid #cfe0eb;border-radius:10px;background:#f6fbfe}.eyWarrantyBox.pending{border-color:#e1b9b5;background:#fff9f8}.eyWarrantyHint{display:block;margin-top:5px;font-size:8px;color:#718493}.eyLensWaiting{opacity:.55}.eyField select:disabled,.eyField input:disabled{background:#eef2f5;color:#8a9aa6;cursor:not-allowed}';document.head.appendChild(st)
}
function wrapFetch(){
 if(fetchWrapped)return;fetchWrapped=true;
 var old=window.fetch.bind(window);
 window.fetch=function(input,init){
  var url=typeof input==='string'?input:(input&&input.url)||'';
  if(url.indexOf('/optyker-eyewear-api-v3')>=0){
   url=url.replace('/optyker-eyewear-api-v3','/optyker-eyewear-api-v4');
   if(init&&typeof init.body==='string'){
    try{var body=JSON.parse(init.body);if(body&&body.action==='save'){body.payload=body.payload||{};body.payload.warranty=warranty();if(body.payload.frame&&isClientLens(body.payload.frame.type)){body.payload.frame.brand='';body.payload.frame.model='';body.payload.frame.description='';body.payload.frame.price=0}}init=Object.assign({},init,{body:JSON.stringify(body)})}catch(e){}
   }
   return old(url,init)
  }
  return old(input,init)
 }
}
function ensure(){
 var panel=E('eyewearPanel');if(!panel)return false;
 addTreatment('Precal','Precal','€ 25 / lente');
 addTreatment('Personalizzazione','Personalizzazione','In omaggio');
 ensureWarranty();ensureStyle();labelColors();syncFrameClient();syncLensSequence();syncWarrantyGate();wrapFetch();
 if(!panel.dataset.eyFlowV6){
  panel.dataset.eyFlowV6='1';
  panel.addEventListener('input',function(){syncFrameClient();syncLensSequence();syncWarrantyGate();schedule()},true);
  panel.addEventListener('change',function(ev){
   if(ev.target===E('eyLensType')){osTouched=false;setTimeout(clearProgrammaticOS,0)}
   if(ev.target===E('eyLensTypeOS')&&ev.isTrusted)osTouched=true;
   syncFrameClient();syncLensSequence();syncWarrantyGate();schedule()
  },true);
  panel.addEventListener('click',function(ev){
   if(ev.target&&ev.target.closest&&ev.target.closest('.eyLensRow')){osTouched=false;setTimeout(clearProgrammaticOS,0)}
   setTimeout(function(){labelColors();syncFrameClient();syncLensSequence();syncWarrantyGate();render()},35)
  },true)
 }
 if(!observer){observer=new MutationObserver(function(){schedule()});observer.observe(panel,{childList:true,subtree:true})}
 schedule();return true
}
function validatePrint(){
 if(!warranty()){alert('Seleziona la garanzia prima di continuare.');return false}
 var ft=E('eyFrameType');if(ft&&isClientLens(ft.value))return true;
 var brand=E('eyFrameBrand'),model=E('eyFrameModel'),desc=E('eyFrameDescription');if(!String((brand&&brand.value)||(model&&model.value)||(desc&&desc.value)||'').trim()){alert('Inserisci la montatura oppure seleziona Del cliente.');return false}
 var lt=lensTypes();if(!lt[0]||!lt[1]){alert('Seleziona prima la lente DX e poi la lente SX.');return false}
 return true
}
function printAccurate(){
 if(!validatePrint())return;
 var p=pricing(),client=E('eyClient')&&E('eyClient').options[E('eyClient').selectedIndex],clientText=client?client.textContent:'',ref=E('eyReference')&&E('eyReference').value||'',w=window.open('','_blank','width=860,height=760');if(!w)return;
 var extras=p.details.map(function(x){return '<div class="row"><span>'+treatmentLabel(x)+'</span><b>'+(x.free?'In omaggio':esc(euro(x.total)))+'</b></div>'}).join('');
 var color=p.color.label?'<div class="row"><span>'+esc(p.color.label)+' · '+p.color.qty+' lente'+(p.color.qty===1?'':'i')+'</span><b>'+esc(euro(p.color.total))+'</b></div>':'';
 var html='<!doctype html><html><head><meta charset="utf-8"><title>Scheda occhiali</title><style>body{font-family:Arial,sans-serif;color:#17334b;padding:34px}h1{font-size:24px}.muted{color:#718493;font-size:10px}.box{border:1px solid #d7e2ea;border-radius:10px;padding:14px;margin-top:14px}.row{display:flex;justify-content:space-between;gap:16px;padding:6px 0;font-size:12px;border-bottom:1px solid #edf1f4}.row:last-child{border-bottom:0}.tot{font-size:17px;font-weight:bold;border-top:2px solid #17334b;margin-top:10px;padding-top:10px}</style></head><body><div class="muted">OPTYKER · OTTICA VISUAL CARE</div><h1>Riepilogo occhiali</h1><div class="muted">'+esc(ref)+(clientText?' · '+esc(clientText):'')+'</div><div class="box"><div class="row"><span>Garanzia</span><b>'+esc(p.warranty)+'</b></div><div class="row"><span>Montatura</span><b>'+esc(euro(p.frame))+'</b></div><div class="row"><span>Lenti · '+p.qty+'</span><b>'+esc(euro(p.gross))+'</b></div>'+(p.discount?'<div class="row"><span>Sconto lenti '+p.discount+'%</span><b>− '+esc(euro(p.disc))+'</b></div>':'')+extras+color+(p.mounting.label?'<div class="row"><span>'+esc(p.mounting.label)+'</span><b>'+esc(euro(p.mounting.price))+'</b></div>':'')+'</div><div class="row tot"><span>Totale</span><span>'+esc(euro(p.total))+'</span></div><script>window.onload=function(){window.print()}<\/script></body></html>';
 w.document.open();w.document.write(html);w.document.close()
}
document.addEventListener('click',function(ev){var b=ev.target&&ev.target.closest?ev.target.closest('#eyPrint'):null;if(!b)return;ev.preventDefault();ev.stopImmediatePropagation();printAccurate()},true);
function boot(){if(!ensure())setTimeout(boot,250)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
setInterval(ensure,800);
})();
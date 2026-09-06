(function(){
if(window.__optykerEyewearExtraTreatmentsV5)return;
window.__optykerEyewearExtraTreatmentsV5=true;
window.OPTYKER_EYEWEAR_EXTRA_TREATMENTS_BUILD='20260906-eyewear-treatments5';
var scheduled=0,observer=null;
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
  var frame=num('eyFramePrice'),unit=num('eyLensPrice'),qty=soldLensTypes().length,discount=Math.max(0,Math.min(100,Number(E('eyDiscount')&&E('eyDiscount').value||0)));
  var gross=Math.round(unit*qty*100)/100,disc=Math.round(gross*discount)/100,net=Math.round((gross-disc)*100)/100,details=treatmentDetails();
  var treatmentTotal=Math.round(details.reduce(function(a,x){return a+Number(x.total||0)},0)*100)/100,mi=mountingInfo(),total=Math.round((frame+net+treatmentTotal+mi.price)*100)/100;
  return {frame:frame,unit:unit,qty:qty,discount:discount,gross:gross,disc:disc,net:net,details:details,treatmentTotal:treatmentTotal,mounting:mi,total:total}
}
function treatmentLabel(x){var q=x.count?' · '+x.count+' lente'+(x.count===1?'':'i'):'';return esc(x.name)+q}
function summaryHtml(){
  var p=pricing();
  var extras=p.details.map(function(x){return '<div class="eySummaryRow" data-ey-extra-treatment="'+esc(x.name)+'"><span>'+treatmentLabel(x)+'</span><b>'+(x.free?'In omaggio':esc(euro(x.total)))+'</b></div>'}).join('');
  return '<div class="eySummaryRow"><span>Montatura</span><b>'+esc(euro(p.frame))+'</b></div><div class="eySummaryRow"><span>Lenti · '+p.qty+' × '+esc(euro(p.unit))+'</span><b>'+esc(euro(p.gross))+'</b></div>'+(p.discount?'<div class="eySummaryRow discount"><span>Sconto lenti '+p.discount+'%</span><b>− '+esc(euro(p.disc))+'</b></div>':'')+'<div class="eySummaryRow"><span>Totale lenti dopo sconto</span><b>'+esc(euro(p.net))+'</b></div>'+extras+(p.mounting.label?'<div class="eySummaryRow"><span>'+esc(p.mounting.label)+'</span><b>'+esc(euro(p.mounting.price))+'</b></div>':'')+'<div class="eySummaryRow total"><span>Totale</span><b>'+esc(euro(p.total))+'</b></div>'
}
function render(){var box=E('eySummary');if(!box)return;var html=summaryHtml();if(box.innerHTML!==html)box.innerHTML=html}
function schedule(){clearTimeout(scheduled);scheduled=setTimeout(render,20)}
function addTreatment(value,title,sub){
  var panel=E('eyewearPanel'),box=panel&&panel.querySelector('.eyTreatments');if(!box||box.querySelector('[data-ey-treatment][value="'+value+'"]'))return;
  var lab=document.createElement('label');lab.className='eyCheck';lab.innerHTML='<input type="checkbox" data-ey-treatment value="'+esc(value)+'"><span>'+esc(title)+'<small>'+esc(sub)+'</small></span>';box.appendChild(lab)
}
function ensure(){
  var panel=E('eyewearPanel');if(!panel)return false;
  addTreatment('Precal','Precal','€ 25 / lente');
  addTreatment('Personalizzazione','Personalizzazione','In omaggio');
  if(!panel.dataset.eyExtraTreatmentsV5){
    panel.dataset.eyExtraTreatmentsV5='1';
    panel.addEventListener('input',schedule,true);panel.addEventListener('change',schedule,true);panel.addEventListener('click',function(){setTimeout(render,30)},true)
  }
  if(!observer){observer=new MutationObserver(function(){schedule()});observer.observe(panel,{childList:true,subtree:true})}
  schedule();return true
}
function printAccurate(){
  var p=pricing(),client=E('eyClient')&&E('eyClient').options[E('eyClient').selectedIndex],clientText=client?client.textContent:'',ref=E('eyReference')&&E('eyReference').value||'',w=window.open('','_blank','width=860,height=760');
  if(!w)return;
  var extras=p.details.map(function(x){return '<div class="row"><span>'+treatmentLabel(x)+'</span><b>'+(x.free?'In omaggio':esc(euro(x.total)))+'</b></div>'}).join('');
  var html='<!doctype html><html><head><meta charset="utf-8"><title>Scheda occhiali</title><style>body{font-family:Arial,sans-serif;color:#17334b;padding:34px}h1{font-size:24px}.muted{color:#718493;font-size:10px}.box{border:1px solid #d7e2ea;border-radius:10px;padding:14px;margin-top:14px}.row{display:flex;justify-content:space-between;gap:16px;padding:6px 0;font-size:12px;border-bottom:1px solid #edf1f4}.row:last-child{border-bottom:0}.tot{font-size:17px;font-weight:bold;border-top:2px solid #17334b;margin-top:10px;padding-top:10px}</style></head><body><div class="muted">OPTYKER · OTTICA VISUAL CARE</div><h1>Riepilogo occhiali</h1><div class="muted">'+esc(ref)+(clientText?' · '+esc(clientText):'')+'</div><div class="box"><div class="row"><span>Montatura</span><b>'+esc(euro(p.frame))+'</b></div><div class="row"><span>Lenti · '+p.qty+'</span><b>'+esc(euro(p.gross))+'</b></div>'+(p.discount?'<div class="row"><span>Sconto lenti '+p.discount+'%</span><b>− '+esc(euro(p.disc))+'</b></div>':'')+extras+(p.mounting.label?'<div class="row"><span>'+esc(p.mounting.label)+'</span><b>'+esc(euro(p.mounting.price))+'</b></div>':'')+'</div><div class="row tot"><span>Totale</span><span>'+esc(euro(p.total))+'</span></div><script>window.onload=function(){window.print()}<\/script></body></html>';
  w.document.open();w.document.write(html);w.document.close()
}
document.addEventListener('click',function(ev){var b=ev.target&&ev.target.closest?ev.target.closest('#eyPrint'):null;if(!b)return;ev.preventDefault();ev.stopImmediatePropagation();printAccurate()},true);
function boot(){if(!ensure())setTimeout(boot,250)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
setInterval(ensure,1000);
})();
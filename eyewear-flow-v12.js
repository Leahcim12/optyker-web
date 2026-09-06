/* OPTYKER_EYEWEAR_FLOW_V12 */
window.OPTYKER_EYEWEAR_FLOW_V12_BUILD='20260906-eyewear-flow-v12';
API='https://whgziwaegjzqsgcntesr.supabase.co/functions/v1/optyker-eyewear-api-v6';

function v12MonofocalOnly(){
  var a=supplied();
  return !!a.length&&a.every(function(s){return isMono(sideType(s))})
}

var _promoEligibleV12Base=promoEligible;
promoEligible=function(code){
  if(code==='VICINO'||code==='VICINOHARD'||code==='VICINOHMC'){
    return _promoEligibleV12Base(code)&&v12MonofocalOnly()
  }
  return _promoEligibleV12Base(code)
};

var _promoLabelV12Base=promoLabel;
promoLabel=function(code){
  var x=_promoLabelV12Base(code);
  if(code==='VICINO'||code==='VICINOHARD'||code==='VICINOHMC')x+=' · solo monofocali';
  return x
};

var _ensureTreatmentUIV12Base=ensureTreatmentUI;
ensureTreatmentUI=function(){
  _ensureTreatmentUIV12Base();
  var p=E('eyewearPanel'),box=p&&p.querySelector('.eyTreatments');
  if(!box)return;
  var input=box.querySelector('[data-ey-treatment][value="Sportive"]');
  if(!input){
    var lab=document.createElement('label');lab.className='eyCheck';
    lab.innerHTML='<input type="checkbox" data-ey-treatment value="Sportive"><span>Sportive<small>€ 25 a lente</small></span>';
    box.appendChild(lab)
  }else{
    var l=input.closest('label'),sp=l&&l.querySelector('span');
    if(sp)sp.innerHTML='Sportive<small>€ 25 a lente</small>'
  }
};

var _treatmentDetailsV12Base=treatmentDetails;
treatmentDetails=function(){
  var out=_treatmentDetailsV12Base().filter(function(x){return x&&x.name!=='Sportive'});
  if(treatments().indexOf('Sportive')>=0){
    var count=supplied().length;
    out.push({name:'Sportive',unit:25,count:count,total:num(25*count),free:false})
  }
  return out
};

var _validateV12Base=validate;
validate=function(){
  if(!_validateV12Base())return false;
  var c=promotionCode();
  if((c==='VICINO'||c==='VICINOHARD'||c==='VICINOHMC')&&!v12MonofocalOnly()){
    toast(c+' è disponibile solo con lenti monofocali.','error');return false
  }
  return true
};

function v12Refresh(){
  ensureTreatmentUI();refreshDiscountOptions();renderSummary()
}
document.addEventListener('change',function(ev){
  if(E('eyewearPanel')&&E('eyewearPanel').contains(ev.target))setTimeout(v12Refresh,35)
},true);
document.addEventListener('input',function(ev){
  if(E('eyewearPanel')&&E('eyewearPanel').contains(ev.target))setTimeout(v12Refresh,35)
},true);
setTimeout(v12Refresh,120);
setInterval(function(){if(E('eyewearPanel'))ensureTreatmentUI()},900);

(function(){
if(window.__optykerEyewearSummaryStabilityV13)return;
window.__optykerEyewearSummaryStabilityV13=true;
window.OPTYKER_EYEWEAR_SUMMARY_STABILITY_BUILD='20260907-eyewear-summary-v13';

/*
  La Scheda Occhiali contiene ancora renderer legacy necessari per alcuni campi,
  ma il riepilogo finale deve essere scritto esclusivamente dal flusso V9+.
  I renderer precedenti usano la riga "Lenti · ..." mentre il renderer corrente
  usa "Lente DX" + "Lente SX". Blocchiamo solo le riscritture legacy di #eySummary.
*/
try{
  var proto=window.HTMLDivElement&&HTMLDivElement.prototype;
  var base=Object.getOwnPropertyDescriptor(Element.prototype,'innerHTML');
  if(proto&&base&&base.get&&base.set&&!Object.getOwnPropertyDescriptor(proto,'innerHTML')){
    Object.defineProperty(proto,'innerHTML',{
      configurable:true,
      enumerable:base.enumerable,
      get:function(){return base.get.call(this)},
      set:function(v){
        if(this&&this.id==='eySummary'&&window.__optykerEyewearFlowV9){
          var s=String(v==null?'':v);
          var latest=s.indexOf('Lente DX')>=0&&s.indexOf('Lente SX')>=0;
          var summaryMarkup=s.indexOf('eySummaryRow')>=0;
          if(summaryMarkup&&!latest)return;
          if(!s&&base.get.call(this).indexOf('Lente DX')>=0)return;
        }
        return base.set.call(this,v)
      }
    })
  }
}catch(e){}
})();

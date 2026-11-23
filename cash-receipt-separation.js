/* OPTYKER_CASH_RECEIPT_SEPARATION_V1 · OPTYKER_CASH_OPEN_LOOP_FIXED_20260919 */
(function(){
'use strict';
if(window.OPTYKER_CASH_RECEIPT_SEPARATION_V1)return;
window.OPTYKER_CASH_RECEIPT_SEPARATION_V1='20260919-cash-open1';
var SHOP_API='https://whgziwaegjzqsgcntesr.supabase.co/functions/v1/optyker-cash-register-api';
var LOCAL_API='https://whgziwaegjzqsgcntesr.supabase.co/functions/v1/optyker-cash-local-api';
var nativeFetch=window.fetch.bind(window);
window.fetch=function(input,init){
  var url=typeof input==='string'?input:(input&&input.url)||'';
  if(url===SHOP_API&&init&&String(init.method||'GET').toUpperCase()==='POST'&&typeof init.body==='string'){
    try{
      var body=JSON.parse(init.body);
      if(body&&body.action==='checkout'&&body.payload&&body.payload.auto_receipt===true&&body.payload.invoice_requested!==true){
        return nativeFetch(LOCAL_API,init);
      }
    }catch(ignore){}
  }
  return nativeFetch(input,init);
};
function label(){
  var b=document.getElementById('optykerCashCheckoutBtn');
  if(b&&b.textContent!=='Incassa e stampa scontrino RCH')b.textContent='Incassa e stampa scontrino RCH';
  var help=document.querySelector('.optykerCashRchHelp');
  var message='<b>Vendita Optyker + scontrino fisico RCH.</b> Questa operazione non crea ordini Shopify. Gli ordini online restano separati nel modulo Ordini.';
  // Reassigning identical innerHTML creates another childList mutation. This
  // observer must settle after its own edit, without starving input and paint.
  if(help&&help.closest('.optykerCashCheckout')&&help.innerHTML!==message)help.innerHTML=message;
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',label,{once:true});else label();
new MutationObserver(label).observe(document.documentElement,{childList:true,subtree:true});
})();

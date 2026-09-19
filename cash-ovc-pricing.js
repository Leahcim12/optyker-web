/* Injected in POS closure. Quote every cart/customer change, server authoritative. */
window.OPTYKER_CASH_QUOTE_VERSION='20260919-quote1';
S.ovcPriceKey='';S.ovcQuoteKey='';S.ovcPriceEpoch=0;S.ovcPriceSeq=0;S.ovcPricePending=false;S.ovcPriceError='';S.ovcCard=null;S.ovcPricingScope='';
var ovcQuoteController=null;
function ovcCartKey(){return JSON.stringify([S.clientId||'',S.ovcPriceEpoch,cartRows().map(function(x){return [String(x.item.variant_id),x.qty,Number(x.department||0),x.unitPrice==null?null:Number(x.unitPrice)]}).sort(function(a,b){return a[0].localeCompare(b[0])})]);}
function ovcPayRows(){return typeof payableCartRows==='function'?payableCartRows():cartRows()}
function ovcMissingVat(){
  if(S.invoice||S.payment==='pending'||cartTotal()<=0)return [];
  return ovcPayRows().filter(function(x){return !Number(x.department||({'04':1,'22':2,'ART10':3}[x.item.fiscal_vat_code||x.item.vat_code])||0)});
}
function ovcStatus(){
  var el=E('optykerCashOvcStatus');
  if(!el){var head=document.querySelector('#optykerCashOverlay .optykerCashCartHead');if(!head)return;el=document.createElement('div');el.id='optykerCashOvcStatus';el.setAttribute('role','status');head.appendChild(el);}
  var missing=ovcMissingVat(),unverified=S.ovcQuoteKey!==ovcCartKey();
  var text=S.ovcPricePending?'Verifica tariffe del cliente…':S.ovcPriceError||(unverified?'Tariffe da verificare. Premi Riprova ricalcolo.':missing.length?'Seleziona l’IVA nella riga del carrello prima di stampare.':S.ovcPricingScope==='stored_orders'?'Importi Buste verificati · prezzi salvati dell’ordine':!S.clientId?'Cliente occasionale · tariffa standard':S.ovcCard&&S.ovcCard.active?'OVC CARD attiva · prezzi riservati applicati ai servizi configurati':'OVC CARD non attiva · tariffa standard');
  var isError=!!S.ovcPriceError||(!S.ovcPricePending&&(unverified||missing.length>0));
  if(el.dataset.active!==(S.ovcCard&&S.ovcCard.active?'true':'false'))el.dataset.active=S.ovcCard&&S.ovcCard.active?'true':'false';
  if(el.dataset.error!==(isError?'true':'false'))el.dataset.error=isError?'true':'false';
  if(el.dataset.message!==text){
    el.dataset.message=text;el.textContent=text;
    if(S.ovcPriceError||(!S.ovcPricePending&&unverified)){
      var b=document.createElement('button');b.id='optykerCashQuoteRetry';b.type='button';b.textContent='Riprova ricalcolo';b.onclick=function(){if(!S.busy)ovcInvalidate()};el.appendChild(b);
    }
  }
  var cb=E('optykerCashCheckoutBtn');if(cb&&(S.ovcPricePending||S.ovcPriceError||unverified||missing.length))cb.disabled=true;
  var total=E('optykerCashTotal');if(total&&(S.ovcPricePending||S.ovcPriceError||unverified))total.textContent=S.ovcPricePending?'Verifica…':'Da verificare';
  var retry=E('optykerCashQuoteRetry');if(retry)retry.disabled=!!S.busy;
  var client=E('optykerCashClient');if(client)client.disabled=!!S.busy;
}
/* A read-only request with a deadline, never a payment retry or price fallback. */
function ovcQuoteRequest(payload){
  var c=creds();if(!c.username||!c.password)return Promise.reject(new Error('Sessione operatore non disponibile. Esci e accedi nuovamente.'));
  if(ovcQuoteController)ovcQuoteController.abort();
  var ctl=new AbortController();ovcQuoteController=ctl;
  var timer,deadline=new Promise(function(resolve,reject){timer=setTimeout(function(){ctl.abort();reject(new Error('Il controllo tariffe non ha risposto entro 15 secondi. Riprova il ricalcolo; nessun incasso è stato eseguito da questa verifica.'));},15000)});
  var request=fetch('https://whgziwaegjzqsgcntesr.supabase.co/functions/v1/optyker-cash-register-api-v2',{
    method:'POST',headers:{'Content-Type':'application/json'},cache:'no-store',signal:ctl.signal,
    body:JSON.stringify({action:'quote_lines',username:c.username,password:c.password,payload:payload})
  }).then(function(r){return r.json().catch(function(){return null}).then(function(x){if(!r.ok||!x||x.ok!==true)throw new Error(x&&x.error||'Risposta del controllo tariffe non valida.');return x})});
  return Promise.race([request,deadline]).catch(function(e){if(e&&e.name==='AbortError')throw new Error('Controllo tariffe interrotto. Premi Riprova ricalcolo.');throw e}).finally(function(){clearTimeout(timer);if(ovcQuoteController===ctl)ovcQuoteController=null;});
}
function ovcValidateQuote(q,lines){
  if(!q||q.ovc_version!=='20260910-ovc2')throw new Error('Modulo tariffe in aggiornamento. Premi Riprova ricalcolo.');
  var quoted=q.lines;if(!Array.isArray(quoted)||quoted.length!==lines.length)throw new Error('Ricalcolo del carrello incompleto.');
  var ids=new Set();
  quoted.forEach(function(l){
    var id=String(l&&l.variant_id||''),want=lines.find(function(x){return String(x.variant_id)===id});
    if(!want||ids.has(id)||Number(l.quantity)!==Number(want.quantity)||l.price==null||!Number.isFinite(Number(l.price))||Number(l.price)<0)throw new Error('Risposta tariffe non coerente con il carrello.');
    ids.add(id);
  });return quoted;
}
var ovcOriginalRenderCart=renderCart;
renderCart=function(){
  if(S.cashOpen){var key=ovcCartKey();if(key!==S.ovcPriceKey){
    S.ovcPriceKey=key;S.ovcPricePending=true;S.ovcPriceError='';var seq=++S.ovcPriceSeq;
    if(ovcQuoteController)ovcQuoteController.abort();
    clearTimeout(S.ovcPriceTimer);S.ovcPriceTimer=setTimeout(function(){
      if(seq!==S.ovcPriceSeq)return;
      if(!S.cashOpen){S.ovcPricePending=false;S.ovcPriceKey='';return;}
      if(key!==ovcCartKey()){renderCart();return;}
      var lines=cartRows().map(function(x){return {variant_id:x.item.variant_id,quantity:x.qty,department:Number(x.department||0)||null}}),clientId=S.clientId||'';
      ovcQuoteRequest({client_id:clientId,lines:lines}).then(function(x){
        if(seq!==S.ovcPriceSeq)return;
        if(key!==ovcCartKey()){renderCart();return;}
        var q=x.data,quoted=ovcValidateQuote(q,lines);
        quoted.forEach(function(l){if(S.cart[l.variant_id])S.cart[l.variant_id].item=Object.assign({},S.cart[l.variant_id].item,l);});
        S.ovcCard=q.card||null;S.ovcPricingScope=q.pricing_scope||'';S.ovcQuoteKey=key;S.ovcPricePending=false;S.ovcPriceError='';renderCart();
      }).catch(function(e){
        if(seq!==S.ovcPriceSeq)return;
        S.ovcPricePending=false;S.ovcPriceError='Tariffe non verificate: '+String(e&&e.message||e);renderCart();
      });
    },170);
  }}
  ovcOriginalRenderCart();ovcStatus();
};
function ovcInvalidate(){if(S.busy)return;S.ovcPriceEpoch++;if(S.cashOpen){renderCart();if(E('optykerCashProductPicker')&&E('optykerCashProductPicker').open)loadProducts(false);}}
var ovcOriginalCheckout=checkout;
checkout=function(){
  if(S.ovcPricePending||S.ovcPriceError||S.ovcQuoteKey!==ovcCartKey()){toast('Attendi il ricalcolo delle tariffe oppure premi Riprova ricalcolo.','error');return;}
  return ovcOriginalCheckout.apply(this,arguments);
};
var ovcOldDiscountLabel=discountLabel;
discountLabel=function(p,qty){return p.is_service?(p.ovc_card_applied?'Tariffa OVC CARD · standard '+euro(Number(p.standard_price)*qty):'Servizio · tariffa standard'):ovcOldDiscountLabel(p,qty);};
window.addEventListener('optyker:ovc-updated',ovcInvalidate);
window.addEventListener('focus',function(){if(S.cashOpen&&!S.busy&&!S.ovcPricePending)ovcInvalidate();});
setInterval(function(){if(!document.hidden&&S.cashOpen&&!S.busy&&!S.ovcPricePending&&!S.ovcPriceError)ovcInvalidate();},60000);

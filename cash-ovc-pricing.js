/* Injected in POS closure. Quote every cart/customer change, server authoritative. */
S.ovcPriceKey='';S.ovcQuoteKey='';S.ovcPriceEpoch=0;S.ovcPriceSeq=0;S.ovcPricePending=false;S.ovcPriceError='';S.ovcCard=null;
function ovcCartKey(){return JSON.stringify([S.clientId||'',S.ovcPriceEpoch,cartRows().map(function(x){return [String(x.item.variant_id),x.qty]}).sort(function(a,b){return a[0].localeCompare(b[0])})]);}
function ovcStatus(){
  var el=E('optykerCashOvcStatus');
  if(!el){var head=document.querySelector('#optykerCashOverlay .optykerCashCartHead');if(!head)return;el=document.createElement('div');el.id='optykerCashOvcStatus';el.setAttribute('role','status');head.appendChild(el);}
  el.dataset.active=S.ovcCard&&S.ovcCard.active?'true':'false';el.dataset.error=S.ovcPriceError?'true':'false';
  var text=S.ovcPricePending?'Verifica tariffe del cliente…':S.ovcPriceError||(!S.clientId?'Cliente occasionale · tariffa standard':S.ovcCard&&S.ovcCard.active?'OVC CARD attiva · prezzi riservati applicati ai servizi configurati':'OVC CARD non attiva · tariffa standard');
  if(el.dataset.message!==text){el.dataset.message=text;el.textContent=text;if(S.ovcPriceError){var b=document.createElement('button');b.type='button';b.textContent='Riprova';b.onclick=function(){ovcInvalidate()};el.appendChild(b);}}
  var cb=E('optykerCashCheckoutBtn');if(cb&&(S.ovcPricePending||S.ovcPriceError||S.ovcQuoteKey!==ovcCartKey()))cb.disabled=true;
  if(S.ovcPricePending&&E('optykerCashTotal'))E('optykerCashTotal').textContent='Verifica…';
  var client=E('optykerCashClient');if(client)client.disabled=!!S.busy;
}
var ovcOriginalRenderCart=renderCart;
renderCart=function(){
  if(S.cashOpen){var key=ovcCartKey();if(key!==S.ovcPriceKey){
    S.ovcPriceKey=key;S.ovcPricePending=true;S.ovcPriceError='';var seq=++S.ovcPriceSeq;
    clearTimeout(S.ovcPriceTimer);S.ovcPriceTimer=setTimeout(function(){
      var lines=cartRows().map(function(x){return {variant_id:x.item.variant_id,quantity:x.qty}}),clientId=S.clientId||'';
      api('quote_lines',{client_id:clientId,lines:lines}).then(function(x){
        if(seq!==S.ovcPriceSeq||key!==ovcCartKey())return;
        var q=x.data||{},quoted=q.lines||[];
        if(q.ovc_version!=='20260910-ovc2')throw new Error('Modulo tariffe in aggiornamento. Riprova tra pochi istanti.');
        if(quoted.length!==lines.length)throw new Error('Ricalcolo del carrello incompleto.');
        quoted.forEach(function(l){if(S.cart[l.variant_id])S.cart[l.variant_id].item=l;});
        S.ovcCard=q.card||null;S.ovcQuoteKey=key;S.ovcPricePending=false;S.ovcPriceError='';
        ovcOriginalRenderCart();ovcStatus();
      }).catch(function(e){if(seq!==S.ovcPriceSeq)return;S.ovcPricePending=false;S.ovcPriceError='Tariffe non verificate: '+e.message;ovcOriginalRenderCart();ovcStatus();});
    },170);
  }}
  ovcOriginalRenderCart();ovcStatus();
};
function ovcInvalidate(){S.ovcPriceEpoch++;if(S.cashOpen){renderCart();if(E('optykerCashProductPicker')&&E('optykerCashProductPicker').open)loadProducts(false);}}
var ovcOriginalCheckout=checkout;
checkout=function(){
  if(S.ovcPricePending||S.ovcPriceError||S.ovcQuoteKey!==ovcCartKey()){toast('Attendi il ricalcolo delle tariffe oppure premi Riprova.','error');return;}
  return ovcOriginalCheckout.apply(this,arguments);
};
var ovcOldDiscountLabel=discountLabel;
discountLabel=function(p,qty){return p.is_service?(p.ovc_card_applied?'Tariffa OVC CARD · standard '+euro(Number(p.standard_price)*qty):'Servizio · tariffa standard'):ovcOldDiscountLabel(p,qty);};
window.addEventListener('optyker:ovc-updated',ovcInvalidate);
window.addEventListener('focus',function(){if(S.cashOpen&&!S.busy)ovcInvalidate();});
setInterval(function(){if(!document.hidden&&S.cashOpen&&!S.busy)ovcInvalidate();},60000);

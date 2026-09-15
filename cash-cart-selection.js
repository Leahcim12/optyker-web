/* Injected last in the cash closure: OPTYKER_CART_SELECTION_20260915 */
window.OPTYKER_CART_SELECTION='20260915-selection1';
function payableCartRows(){return cartRows().filter(function(x){return x.selected!==false})}
cartTotal=function(){return Math.round(payableCartRows().reduce(function(n,x){return n+Number(x.unitPrice==null?x.item.price:x.unitPrice)*x.qty},0)*100)/100};

var selectionNativeRender=renderCart;
renderCart=function(){
  var result=selectionNativeRender.apply(this,arguments),box=E('optykerCashCartItems');if(!box)return result;
  var selected=payableCartRows(),all=cartRows(),locked=S.busy||S.clientCartLoading||!!S.clientCartError||clientCartHasPending();
  box.querySelectorAll('[data-vat]').forEach(function(vat){
    var id=vat.dataset.vat,x=S.cart[id],row=vat.closest('.optykerCashCartItem');if(!x||!row)return;
    row.classList.toggle('optykerCashExcluded',x.selected===false);
    var label=document.createElement('label');label.className='optykerCashSelectLine';
    var input=document.createElement('input');input.type='checkbox';input.checked=x.selected!==false;
    input.dataset.payLine=id;input.disabled=locked;input.setAttribute('aria-label','Da pagare: '+String(x.item.title||'Articolo'));
    var text=document.createElement('span');text.textContent=x.selected===false?'Da pagare in seguito':'Da pagare ora';
    label.append(input,text);row.firstElementChild.prepend(label);
    input.onchange=function(){if(S.busy||S.clientCartLoading||S.clientCartError)return;x.selected=this.checked;renderCart();clientCartSchedule()};
  });
  if(locked)box.querySelectorAll('button,input,select').forEach(function(b){b.disabled=true});
  var count=E('optykerCashCartCount');if(count&&all.length)count.textContent=selected.length+' voc'+(selected.length===1?'e':'i')+' da pagare · '+all.length+' nel carrello';
  var totalLabel=document.querySelector('#optykerCashOverlay .optykerCashTotalLabel');if(totalLabel)totalLabel.textContent='Totale da pagare';
  var button=E('optykerCashCheckoutBtn');if(button&&(locked||!selected.length))button.disabled=true;
  if(button&&!selected.length&&all.length&&!S.busy)button.textContent='Seleziona le voci da pagare';
  var client=E('optykerCashClient');if(client&&locked)client.disabled=true;
  var search=E('optykerCashClientSearch');if(search)search.disabled=!!locked;
  return result;
};

function applyCheckoutCart(sale,rows){
  var current=String(S.clientId||''),client=String(sale.client_id||'');
  if(current!==client)return;
  if(current){
    if(!sale.client_cart||String(sale.client_cart.client_id)!==current)throw new Error('Carrello da sincronizzare: usa Recupera incasso prima di continuare.');
    clientCartMutation++;clientCartSeq++;clearTimeout(clientCartSaveTimer);
    clientCartVersions[current]=sale.client_cart.updated_at||null;
    clientCartApply(sale.client_cart.items||[],current);return;
  }
  (rows||[]).forEach(function(x){var id=String(x.item.variant_id),now=S.cart[id];if(!now)return;now.qty-=x.qty;if(now.qty<=0)delete S.cart[id]});
}

var selectionNativeCheckout=checkout;
checkout=function(){
  if(S.busy||!payableCartRows().length)return;
  if(S.clientCartLoading||S.clientCartError){toast(S.clientCartError||'Attendi il caricamento del carrello.','error');return}
  if(sessionStorage.getItem('optykerCashPendingRequest')){toast('Usa Recupera incasso per verificare il tentativo precedente.','error');return}
  return selectionNativeCheckout.apply(this,arguments);
};

/* Injected last in the cash closure: OPTYKER_CART_SELECTION_20260916 */
window.OPTYKER_CART_SELECTION='20260916-selection3';
function payableCartRows(){return cartRows().filter(function(x){return x.selected!==false})}
function cartManualPrice(v){var s=String(v==null?'':v).trim().replace(',','.');if(!s)return null;var n=Number(s);return isFinite(n)&&n>=0&&n<=1000000?Math.round(n*100)/100:null}
cartTotal=function(){return Math.round(payableCartRows().reduce(function(n,x){return n+Number(x.unitPrice==null?x.item.price:x.unitPrice)*x.qty},0)*100)/100};

function installOrderPriceEditor(row,x,id,locked){
  if(String(id||'').indexOf('client_cart:')!==0)return;
  var holder=row.querySelector('.optykerCashCartItemPrice');if(!holder)return;
  var base=Math.round(Number(x.item&&x.item.price||0)*100)/100,unit=x.unitPrice==null?base:Number(x.unitPrice||0);
  holder.classList.add('optykerCashOrderPriceEditor');
  holder.innerHTML='<label>Prezzo finale</label><div><span>€</span><input type="text" inputmode="decimal" data-price="'+esc(id)+'" value="'+esc(unit.toFixed(2))+'" aria-label="Prezzo finale '+esc(x.item&&x.item.title||'ordine')+'"><button type="button" data-price-reset="'+esc(id)+'" title="Ripristina il prezzo della Busta">↺</button></div><small>Prezzo Busta: '+esc(euro(base))+(x.unitPrice!=null&&Math.abs(unit-base)>.004?' · manuale':'')+'</small>';
  var input=holder.querySelector('[data-price]'),reset=holder.querySelector('[data-price-reset]');
  input.disabled=locked;reset.disabled=locked||x.unitPrice==null;
  input.oninput=function(){var n=cartManualPrice(this.value);if(n!=null){x.unitPrice=n;var total=E('optykerCashTotal');if(total)total.textContent=euro(cartTotal())}};
  input.onchange=function(){if(locked)return;var raw=String(this.value||'').trim(),n=cartManualPrice(raw);if(!raw){x.unitPrice=null}else if(n==null){toast('Prezzo finale non valido.','error');this.value=Number(x.unitPrice==null?base:x.unitPrice).toFixed(2);return}else{x.unitPrice=n;this.value=n.toFixed(2)}renderCart();clientCartSchedule()};
  reset.onclick=function(){if(locked)return;x.unitPrice=null;renderCart();clientCartSchedule()};
}

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
    installOrderPriceEditor(row,x,id,locked);
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

function localDeliveredRows(sale,rows){
  if(Array.isArray(rows)&&rows.length)return rows;
  var lines=sale&&sale.data&&Array.isArray(sale.data.lines)?sale.data.lines:[];
  return lines.map(function(x){return {item:{variant_id:String(x.variant_id||x.catalog_id||'')},qty:Math.max(0,Number(x.quantity||0))}});
}
function applyCheckoutCart(sale,rows){
  var current=String(S.clientId||''),client=String(sale&&sale.client_id||'');
  if(current!==client)return;
  if(current){
    if(!sale.client_cart||String(sale.client_cart.client_id)!==current)throw new Error('Carrello da sincronizzare: usa Recupera incasso prima di continuare.');
    clientCartMutation++;clientCartSeq++;clearTimeout(clientCartSaveTimer);
    clientCartVersions[current]=sale.client_cart.updated_at||null;
    clientCartApply(sale.client_cart.items||[],current);return;
  }
  // An occasional/local cart follows the same rule: only physical delivery consumes lines.
  if(!sale||!sale.delivered_at)return;
  localDeliveredRows(sale,rows).forEach(function(x){var id=String(x.item.variant_id),now=S.cart[id];if(!now)return;now.qty-=x.qty;if(now.qty<=0)delete S.cart[id]});
}

var selectionNativeCheckout=checkout;
checkout=function(){
  if(S.busy||!payableCartRows().length)return;
  if(S.clientCartLoading||S.clientCartError){toast(S.clientCartError||'Attendi il caricamento del carrello.','error');return}
  if(sessionStorage.getItem('optykerCashPendingRequest')){toast('Usa Recupera incasso per verificare il tentativo precedente.','error');return}
  return selectionNativeCheckout.apply(this,arguments);
};

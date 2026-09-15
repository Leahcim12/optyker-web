/* __OPTYKER_CLIENT_CART_PERSISTENCE_V1__ — serialized saves and partial checkout */
var clientCartSaveTimer=0,clientCartSeq=0,clientCartMutation=0,clientCartLastId='';
var clientCartQueue=Promise.resolve(),clientCartVersions={};
function clientCartHasPending(){try{return !!sessionStorage.getItem('optykerCashPendingRequest')}catch(e){return false}}
function clientCartSnapshot(){return cartRows().map(function(x){var p=x.item||{};return {variant_id:String(p.variant_id||''),title:String(p.title||''),variant_title:String(p.variant_title||''),sku:String(p.sku||''),barcode:String(p.barcode||''),image:String(p.image||''),price:Number(p.price||0),list_price:Number(p.list_price==null?p.price:p.list_price||0),fiscal_vat_code:String(p.fiscal_vat_code||p.vat_code||''),fiscal_item_type:String(p.fiscal_item_type||''),quantity:Number(x.qty||1),department:Number(x.department||0)||null,selected:x.selected!==false,unit_price_override:x.unitPrice==null?null:Number(x.unitPrice),locked_price:!!p.locked_price,source_work_order_id:p.source_work_order_id||null,source_sheet_id:p.source_sheet_id||null,source_type:p.source_type||''}})}
function clientCartApply(items,id){if(String(S.clientId||'')!==String(id||''))return;S.cart={};(Array.isArray(items)?items:[]).forEach(function(p){var k=String(p&&p.variant_id||'');if(!k)return;S.cart[k]={item:p,qty:Math.max(1,Math.min(99,Number(p.quantity||1))),department:Number(p.department||0)||null,selected:p.selected!==false,unitPrice:p.unit_price_override==null?null:Number(p.unit_price_override)}});clientCartLastId=id||'';renderCart()}
function clientCartFailure(e,id){if(String(S.clientId||'')===id){S.clientCartError='Carrello non sincronizzato: '+e.message+' Chiudi e riapri la Cassa.';toast(S.clientCartError,'error');renderCart()}}
function clientCartLoad(id){
  id=String(id||'');if(S.busy)return Promise.resolve();
  var seq=++clientCartSeq;clearTimeout(clientCartSaveTimer);S.cart={};S.clientCartError='';S.clientCartLoading=!!id;renderCart();
  if(!id){clientCartLastId='';return Promise.resolve()}
  return clientCartQueue.catch(function(){}).then(function(){return api('client_cart_get',{client_id:id})}).then(function(x){
    if(seq!==clientCartSeq||String(S.clientId||'')!==id)return;
    clientCartVersions[id]=x.data.updated_at||null;S.clientCartLoading=false;clientCartApply(x.data.items||[],id);
  }).catch(function(e){if(seq===clientCartSeq){S.clientCartLoading=false;clientCartFailure(e,id)}});
}
function clientCartSaveNow(id,snapshot,mutation){
  id=String(id||'');if(!id)return Promise.resolve();
  snapshot=Array.isArray(snapshot)?snapshot:clientCartSnapshot();mutation=mutation==null?clientCartMutation:mutation;
  var seq=clientCartSeq;
  var task=clientCartQueue.then(function(){return api('client_cart_save',{client_id:id,items:snapshot,expected_updated_at:clientCartVersions[id]||null})}).then(function(x){
    clientCartVersions[id]=x.data.updated_at||null;
    if(!S.busy&&seq===clientCartSeq&&String(S.clientId||'')===id&&mutation===clientCartMutation)clientCartApply(x.data.items||[],id);
    return x;
  });
  clientCartQueue=task;return task;
}
function clientCartSchedule(){
  if(!S.clientId||S.busy||S.clientCartLoading||S.clientCartError||clientCartHasPending())return;
  var id=String(S.clientId),snapshot=clientCartSnapshot(),m=++clientCartMutation;
  clearTimeout(clientCartSaveTimer);clientCartSaveTimer=setTimeout(function(){clientCartSaveNow(id,snapshot,m).catch(function(e){clientCartFailure(e,id)})},140);
}
function clientCartBeforeCheckout(){
  clearTimeout(clientCartSaveTimer);if(!S.clientId)return Promise.resolve();
  var id=String(S.clientId);return clientCartSaveNow(id,clientCartSnapshot(),++clientCartMutation).catch(function(e){clientCartFailure(e,id);throw e});
}
function clientCartLockUi(){
  var box=E('optykerCashCartItems');if(!box)return;
  box.querySelectorAll('[data-minus^="client_cart:"],[data-plus^="client_cart:"]').forEach(function(b){b.disabled=true;b.title='Voce generata da una Busta ordinata. Togli la spunta per pagarla in seguito.'});
  box.querySelectorAll('[data-remove^="client_cart:"]').forEach(function(b){b.disabled=!!S.busy;b.textContent='Elimina scheda e annulla ordine';b.title='Annulla l’ordine in Laboratorio e archivia la scheda collegata. Pagamenti e scontrini restano invariati.'});
  box.querySelectorAll('[data-minus^="client_cart:"]').forEach(function(b){var row=b.closest('.optykerCashCartItem');if(!row||row.querySelector('.optykerClientCartOrderBadge'))return;var title=row.querySelector('.optykerCashCartItemTitle');if(title){var n=document.createElement('div');n.className='optykerClientCartOrderBadge';n.textContent='Ordine Laboratorio · importo della Busta';title.insertAdjacentElement('afterend',n)}});
}
var clientCartNativeRender=renderCart;
renderCart=function(){var r=clientCartNativeRender.apply(this,arguments);clientCartLockUi();var box=E('optykerCashCartItems');if(box)box.querySelectorAll('[data-vat],[data-price]').forEach(function(v){var old=v.onchange;v.onchange=function(){if(S.busy)return;if(old)old.apply(this,arguments);clientCartSchedule()}});return r};
var clientCartNativeAdd=add;add=function(id){if(S.busy||S.clientCartLoading||S.clientCartError||clientCartHasPending())return;var r=clientCartNativeAdd.apply(this,arguments);clientCartSchedule();return r};
var clientCartNativeQty=qty;qty=function(id,d){if(S.busy||S.clientCartLoading||S.clientCartError||clientCartHasPending()||String(id||'').indexOf('client_cart:')===0)return;var r=clientCartNativeQty.apply(this,arguments);clientCartSchedule();return r};
async function cancelCartOrder(id){
  var row=S.cart[id];if(!row||!S.clientId)return;
  if(!window.confirm('Eliminare '+String(row.item.title||'questa scheda')+'?\n\nAnnulla anche l’ordine di Laboratorio e archivia gli eventuali Preventivo/Busta collegati allo stesso ordine. La voce sarà rimossa dal carrello.\nPagamenti, acconti e scontrini già registrati NON vengono annullati né rimborsati. Una copia delle schede resta conservata.'))return;
  var cid=String(S.clientId);S.busy=true;renderCart();
  try{
    await clientCartBeforeCheckout();
    var x=await api('cancel_order_sheet',{client_id:cid,work_order_id:String(id).slice('client_cart:'.length),expected_cart_updated_at:clientCartVersions[cid],confirm:true});
    clientCartMutation++;clientCartSeq++;clientCartVersions[cid]=x.data.client_cart.updated_at||null;clientCartApply(x.data.client_cart.items||[],cid);
    window.dispatchEvent(new CustomEvent('optyker:sheet-removed',{detail:{client_id:cid,sheet_id:x.data.sheet_id,archived_sheet_ids:x.data.archived_sheet_ids||[x.data.sheet_id]}}));
    toast('Scheda eliminata e ordine annullato. Pagamenti e scontrini invariati.','ok');
  }catch(e){toast('Annullamento da verificare: '+e.message,'error')}finally{S.busy=false;renderCart()}
}
var clientCartNativeRemove=removeLine;removeLine=function(id){if(S.busy||S.clientCartLoading||S.clientCartError||clientCartHasPending())return;if(String(id||'').indexOf('client_cart:')===0)return cancelCartOrder(id);var r=clientCartNativeRemove.apply(this,arguments);clientCartSchedule();return r};
var clientCartNativeEnsure=ensureUI;ensureUI=function(){var r=clientCartNativeEnsure.apply(this,arguments),sel=E('optykerCashClient');if(sel&&!sel.__clientCartPersist){sel.__clientCartPersist=true;var old=sel.onchange;sel.onchange=function(){if(S.busy)return;var previous=String(S.clientId||'');clearTimeout(clientCartSaveTimer);if(previous&&!S.clientCartLoading&&!S.clientCartError&&!clientCartHasPending())clientCartSaveNow(previous,clientCartSnapshot(),++clientCartMutation).catch(function(e){clientCartFailure(e,previous)});if(old)old.apply(this,arguments);clientCartLoad(String(S.clientId||''))}}return r};
var clientCartNativeOpen=openCash;openCash=function(clientId){if(S.busy)return;var r=clientCartNativeOpen.apply(this,arguments);clientCartQueue=clientCartQueue.catch(function(){});clientCartLoad(String(S.clientId||''));return r};
var clientCartNativeClose=closeCash;closeCash=function(ev){if(S.busy)return clientCartNativeClose.apply(this,arguments);clearTimeout(clientCartSaveTimer);if(S.clientId&&!S.clientCartLoading&&!S.clientCartError&&!clientCartHasPending()){var id=String(S.clientId);clientCartSaveNow(id,clientCartSnapshot(),++clientCartMutation).catch(function(e){clientCartFailure(e,id)})}return clientCartNativeClose.apply(this,arguments)};
window.optykerCashReloadClientCart=function(clientId){var id=String(clientId||S.clientId||'');if(id&&String(S.clientId||'')===id)return clientCartLoad(id);return Promise.resolve()};
window.addEventListener('optyker:client-cart-updated',function(ev){var id=String(ev&&ev.detail&&ev.detail.client_id||'');if(id&&String(S.clientId||'')===id)clientCartLoad(id)});

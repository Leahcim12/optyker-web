/* OPTYKER_CASH_FISCAL_PREFLIGHT_20260919: validate before checkout, never print. */
window.OPTYKER_CASH_FISCAL_PREFLIGHT_VERSION='20260919-preflight1';
// Matches the already configured and verified RCH mapping, not new tax rules.
var cashFiscalDepartments={1:{vat:'04',type:'goods',label:'4% · bene'},2:{vat:'22',type:'goods',label:'22% · bene'},3:{vat:'ART10',type:'services',label:'Esente Art.10 · servizio'}};
function cashFiscalMismatch(row){
 var p=row.item||{},dep=Number(row.department||({'04':1,'22':2,'ART10':3}[p.fiscal_vat_code||p.vat_code])||0),map=cashFiscalDepartments[dep];
 return !!(map&&p.fiscal_item_type&&p.fiscal_item_type!==map.type);
}
function cashCatalogDepartment(row){
 var p=row.item||{};
 return Object.keys(cashFiscalDepartments).map(Number).find(function(k){var d=cashFiscalDepartments[k];return d.vat===(p.fiscal_vat_code||p.vat_code)&&d.type===p.fiscal_item_type})||0;
}
function cashFiscalPreflightUi(){
 var box=E('optykerCashCartItems');if(!box)return;
 box.querySelectorAll('[data-vat]').forEach(function(sel){
  var row=S.cart[sel.dataset.vat];if(!row||!cashFiscalMismatch(row))return;
  var note=document.createElement('div');note.className='cashFiscalMismatch';note.setAttribute('role','alert');
  note.textContent='IVA / tipologia non compatibile con questo articolo. ';sel.setAttribute('aria-invalid','true');
  var suggested=cashCatalogDepartment(row);
  if(suggested){
   var b=document.createElement('button');b.type='button';b.textContent='Usa IVA da magazzino: '+cashFiscalDepartments[suggested].label;b.dataset.cashCatalogVat=sel.dataset.vat;
   b.disabled=!!(S.busy||S.clientCartLoading||S.clientCartError||clientCartHasPending()||S.ovcPricePending||S.ovcPriceError||S.ovcQuoteKey!==ovcCartKey());
   b.onclick=function(){
    if(S.busy||S.clientCartLoading||S.clientCartError||clientCartHasPending()||S.ovcPricePending||S.ovcPriceError||S.ovcQuoteKey!==ovcCartKey())return;
    // Explicit click only: reuse the native VAT change and serialized cart save.
    sel.value=String(suggested);sel.dispatchEvent(new Event('change',{bubbles:true}));
   };note.appendChild(b);
  }else note.appendChild(document.createTextNode('Verifica la configurazione IVA in magazzino.'));
  sel.parentElement.after(note);
 });
 if(!S.invoice&&S.payment!=='pending'&&cartTotal()>0&&payableCartRows().some(cashFiscalMismatch)){
  var b=E('optykerCashCheckoutBtn');if(b)b.disabled=true;
 }
}
var cashPreflightNativeRender=renderCart;
renderCart=function(){var r=cashPreflightNativeRender.apply(this,arguments);cashFiscalPreflightUi();return r};
var cashPreflightNativeCheckout=checkout;
checkout=function(){
 if(!S.invoice&&S.payment!=='pending'&&cartTotal()>0&&payableCartRows().some(cashFiscalMismatch)){
  toast('Controlla IVA e tipologia nelle righe evidenziate. Nessun incasso è stato inviato.','error');renderCart();return;
 }
 return cashPreflightNativeCheckout.apply(this,arguments);
};
(function(){var s=document.createElement('style');s.id='optykerCashFiscalPreflightCss';s.textContent='.cashFiscalMismatch{max-width:600px;margin:8px 0;padding:10px;border:1px solid #d8968e;background:#fff5f2;color:#8b2720;border-radius:8px;font-size:12px;line-height:1.5}.cashFiscalMismatch button{display:block;margin-top:8px;padding:9px;border:1px solid #bca7a2;border-radius:6px;background:#fff;color:#702820;cursor:pointer}.cashFiscalMismatch button:disabled{opacity:.55;cursor:default}';document.head.appendChild(s)})();

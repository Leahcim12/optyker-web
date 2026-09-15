from pathlib import Path
import re
import runpy

ROOT=Path('_site')
MARK='OPTYKER_ORDER_CART_LAB_20260915'

# 1) Cash register: keep a different persistent cart for every selected client.
p=ROOT/'cash-register.js'
s=p.read_text(encoding='utf-8')
if '__OPTYKER_CLIENT_CART_PERSISTENCE_V1__' not in s:
    pos=s.rfind('})();')
    if pos<0: raise SystemExit('Cash closure not found')
    addon=r'''
/* __OPTYKER_CLIENT_CART_PERSISTENCE_V1__ */
var clientCartSaveTimer=0,clientCartSeq=0,clientCartMutation=0,clientCartLastId='';
function clientCartSnapshot(){return cartRows().map(function(x){var p=x.item||{};return {variant_id:String(p.variant_id||''),title:String(p.title||''),variant_title:String(p.variant_title||''),sku:String(p.sku||''),barcode:String(p.barcode||''),image:String(p.image||''),price:Number(p.price||0),list_price:Number(p.list_price==null?p.price:p.list_price||0),fiscal_vat_code:String(p.fiscal_vat_code||p.vat_code||''),fiscal_item_type:String(p.fiscal_item_type||''),quantity:Number(x.qty||1),department:Number(x.department||0)||null,locked_price:!!p.locked_price,source_work_order_id:p.source_work_order_id||null,source_sheet_id:p.source_sheet_id||null,source_type:p.source_type||''}})}
function clientCartApply(items,id){if(String(S.clientId||'')!==String(id||''))return;S.cart={};(Array.isArray(items)?items:[]).forEach(function(p){var k=String(p&&p.variant_id||'');if(!k)return;var q=Math.max(1,Math.min(99,Number(p.quantity||1)));S.cart[k]={item:p,qty:q,department:Number(p.department||0)||null}});clientCartLastId=id||'';renderCart()}
function clientCartLoad(id){id=String(id||'');var seq=++clientCartSeq;clearTimeout(clientCartSaveTimer);S.cart={};renderCart();if(!id){clientCartLastId='';return Promise.resolve()};return api('client_cart_get',{client_id:id}).then(function(x){if(seq!==clientCartSeq||String(S.clientId||'')!==id)return;clientCartApply(x&&x.data&&x.data.items||[],id)}).catch(function(e){if(seq===clientCartSeq&&String(S.clientId||'')===id)toast('Carrello cliente non caricato: '+e.message,'error')})}
function clientCartSaveNow(id,snapshot,mutation){id=String(id||'');if(!id)return Promise.resolve();snapshot=Array.isArray(snapshot)?snapshot:clientCartSnapshot();mutation=mutation==null?clientCartMutation:mutation;return api('client_cart_save',{client_id:id,items:snapshot}).then(function(x){if(String(S.clientId||'')===id&&mutation===clientCartMutation&&x&&x.data)clientCartApply(x.data.items||[],id);return x}).catch(function(e){if(String(S.clientId||'')===id)toast('Carrello non sincronizzato: '+e.message,'error')})}
function clientCartSchedule(){if(!S.clientId)return;clientCartMutation++;var id=String(S.clientId),snap=clientCartSnapshot(),m=clientCartMutation;clearTimeout(clientCartSaveTimer);clientCartSaveTimer=setTimeout(function(){clientCartSaveNow(id,snap,m)},140)}
function clientCartLockUi(){
 var box=E('optykerCashCartItems');if(!box)return;
 box.querySelectorAll('[data-minus^="client_cart:"],[data-plus^="client_cart:"],[data-remove^="client_cart:"]').forEach(function(b){b.disabled=true;b.title='Voce generata da una Busta ordinata: resta nel carrello fino alla registrazione della vendita.'});
 box.querySelectorAll('[data-minus^="client_cart:"]').forEach(function(b){var row=b.closest('.optykerCashCartItem');if(!row||row.querySelector('.optykerClientCartOrderBadge'))return;var title=row.querySelector('.optykerCashCartItemTitle');if(title){var n=document.createElement('div');n.className='optykerClientCartOrderBadge';n.textContent='Ordine Laboratorio · importo della Busta';title.insertAdjacentElement('afterend',n)}});
 if(!E('optykerClientCartCss')){var st=document.createElement('style');st.id='optykerClientCartCss';st.textContent='.optykerClientCartOrderBadge{display:inline-flex;margin-top:4px;padding:3px 7px;border-radius:999px;background:#edf6fc;color:#1769aa;font-size:9px;font-weight:900}.optykerCashCartItem button:disabled{opacity:.42;cursor:not-allowed}';document.head.appendChild(st)}
}
var clientCartNativeRender=renderCart;
renderCart=function(){var r=clientCartNativeRender.apply(this,arguments);clientCartLockUi();var box=E('optykerCashCartItems');if(box)box.querySelectorAll('[data-vat]').forEach(function(v){if(v.__clientCartPersist)return;v.__clientCartPersist=true;var old=v.onchange;v.onchange=function(){if(old)old.apply(this,arguments);clientCartSchedule()}});return r};
var clientCartNativeAdd=add;add=function(id){var r=clientCartNativeAdd.apply(this,arguments);clientCartSchedule();return r};
var clientCartNativeQty=qty;qty=function(id,d){if(String(id||'').indexOf('client_cart:')===0)return;var r=clientCartNativeQty.apply(this,arguments);clientCartSchedule();return r};
var clientCartNativeRemove=removeLine;removeLine=function(id){if(String(id||'').indexOf('client_cart:')===0){toast('Questa voce deriva da un ordine di Laboratorio e resta nel carrello fino alla registrazione.','');return}var r=clientCartNativeRemove.apply(this,arguments);clientCartSchedule();return r};
var clientCartNativeEnsure=ensureUI;ensureUI=function(){var r=clientCartNativeEnsure.apply(this,arguments),sel=E('optykerCashClient');if(sel&&!sel.__clientCartPersist){sel.__clientCartPersist=true;var old=sel.onchange;sel.onchange=function(){var previous=String(S.clientId||''),snapshot=clientCartSnapshot(),m=++clientCartMutation;if(previous)clientCartSaveNow(previous,snapshot,m);if(old)old.apply(this,arguments);clientCartLoad(String(S.clientId||''))}}return r};
var clientCartNativeOpen=openCash;openCash=function(clientId){var r=clientCartNativeOpen.apply(this,arguments);clientCartLoad(String(S.clientId||''));return r};
var clientCartNativeClose=closeCash;closeCash=function(ev){if(S.clientId){clientCartMutation++;clientCartSaveNow(String(S.clientId),clientCartSnapshot(),clientCartMutation)}return clientCartNativeClose.apply(this,arguments)};
window.optykerCashReloadClientCart=function(clientId){var id=String(clientId||S.clientId||'');if(id&&String(S.clientId||'')===id)return clientCartLoad(id);return Promise.resolve()};
window.addEventListener('optyker:client-cart-updated',function(ev){var id=String(ev&&ev.detail&&ev.detail.client_id||'');if(id&&String(S.clientId||'')===id)clientCartLoad(id)});
'''
    s=s[:pos]+addon+'\n'+s[pos:]
p.write_text(s,encoding='utf-8')

# 2) Eyewear: concise Ordina button, then refresh that client's persistent cart.
p=ROOT/'optyker-operations.js'
s=p.read_text(encoding='utf-8')
s=s.replace("b.textContent='Ordina prodotto'","b.textContent='Ordina'")
s=s.replace("b.textContent=orderBusy?'Invio in corso…':'Ordina prodotto';","b.textContent=orderBusy?'Ordino…':'Ordina';")
s=s.replace("b.textContent='Ordina prodotto';b.onclick=()=>sendOrder(r);","b.textContent='Ordina';b.onclick=()=>sendOrder(r);")
old="""orderStatus((result.already_sent?'Ordine già presente in laboratorio':'Ordine inviato al laboratorio')+' · '+sentRef+'. Stato: '+({da_fare:'Da fare',in_preparazione:'In preparazione',costruzione:'In costruzione',in_spedizione:'In spedizione'}[result.data.status]||result.data.status),true);"""
new="""orderStatus((result.already_sent?'Ordine già presente in laboratorio':'Ordine inviato al laboratorio')+' · '+sentRef+'. Stato: '+({da_fare:'Inserito',in_preparazione:'In preparazione',costruzione:'In lavorazione',in_spedizione:'In spedizione',pronto_consegna:'Pronto per la consegna',completato:'Consegnato',annullato:'Annullato'}[result.data.status]||result.data.status),true);\n     try{window.dispatchEvent(new CustomEvent('optyker:client-cart-updated',{detail:{client_id:r.client_id}}));window.optykerCashReloadClientCart?.(r.client_id);}catch(cartEvent){}"""
if old not in s: raise SystemExit('Eyewear order status anchor not found')
s=s.replace(old,new,1)
p.write_text(s,encoding='utf-8')

# 3) Laboratory/LAC embedded UI. Work-order rows now expose the 48h/10d timeline.
p=ROOT/'index.html'
h=p.read_text(encoding='utf-8')
if MARK not in h:
    h=h.replace('Buste Occhiali e LAC. Da fare → In preparazione → In costruzione → In spedizione. I passaggi automatici rispettano il fine settimana.',
                'Buste Occhiali e LAC. Inserito → dopo 48 ore In lavorazione → dopo 10 giorni Pronto per la consegna. Un operatore può modificare lo stato in qualsiasi momento.')
    h=h.replace('Passaggio automatico a In costruzione: dopo 24 ore da lunedì a giovedì; da venerdì a domenica, lunedì alle 09:00.',
                'Automazione: dopo 48 ore passa a In lavorazione; dopo 10 giorni passa a Pronto per la consegna. Una modifica manuale dell’operatore prevale sull’automazione.')
    h,n=re.subn(r"function statusLabel\(s\)\{return \{[^}]*\}\[s\]\|\|s\|\|'Da fare'\}",
                "function statusLabel(s){return {da_fare:'Inserito',in_preparazione:'In preparazione',costruzione:'In lavorazione',in_spedizione:'In spedizione',pronto_consegna:'Pronto per la consegna',completato:'Consegnato',annullato:'Annullato'}[s]||s||'Inserito'}",h,count=1)
    if n!=1: raise SystemExit('Laboratory statusLabel anchor not found')
    h,n=re.subn(r"var prods=productsFor\(o\),automatic=o\.status==='in_preparazione'[^;]*;",
                "var prods=productsFor(o),automatic=o.manual_status?'Stato modificato manualmente da '+(o.manual_status_by||'operatore'):(o.status==='da_fare'||o.status==='in_preparazione'?'In lavorazione prevista · '+dt(o.auto_work_at)+' · Pronto consegna · '+dt(o.auto_ready_at):o.status==='costruzione'||o.status==='in_spedizione'?'Pronto consegna previsto · '+dt(o.auto_ready_at):'');",h,count=1)
    if n!=1: raise SystemExit('Laboratory automatic hint anchor not found')
    opt="<option value=\"in_spedizione\"'+(o.status==='in_spedizione'?' selected':'')+'>In spedizione</option>"
    if opt not in h: raise SystemExit('Laboratory status options anchor not found')
    extra="<option value=\"pronto_consegna\"'+(o.status==='pronto_consegna'?' selected':'')+'>Pronto per la consegna</option><option value=\"completato\"'+(o.status==='completato'?' selected':'')+'>Consegnato</option><option value=\"annullato\"'+(o.status==='annullato'?' selected':'')+'>Annullato</option>"
    h=h.replace(opt,opt+extra,1)
    h=h.replace('>Da fare</option>','>Inserito</option>',1).replace('>In costruzione</option>','>In lavorazione</option>',1)
    h=h.replace("b.textContent=\"Invia l'ordine\"","b.textContent='Ordina'")
    h=h.replace("b.textContent='Invio…'","b.textContent='Ordino…'")
    h=h.replace("if(b){b.disabled=true;b.textContent='Ordine inviato'+(ref?' · '+ref:'');}","if(b){b.disabled=true;b.textContent='Ordinato'+(ref?' · '+ref:'');}")
    h=h.replace("alert('Ordine inviato al Laboratorio'+(ref?' · riferimento '+ref:'')+'. Stato iniziale: Da fare.');",
                "try{window.dispatchEvent(new CustomEvent('optyker:client-cart-updated',{detail:{client_id:row.client_id||clientId}}));if(window.optykerCashReloadClientCart)window.optykerCashReloadClientCart(row.client_id||clientId);}catch(cartEvent){}alert('Ordine inviato al Laboratorio'+(ref?' · riferimento '+ref:'')+'. Stato iniziale: Inserito. La spesa è stata aggiunta al carrello del cliente.');")
    h=h.replace("b.textContent=\"Invia l'ordine\";","b.textContent='Ordina';")
    h=h.replace("premi Invia l'ordine.","premi Ordina.")
    body=h.rfind('</body>')
    if body<0: raise SystemExit('Closing body not found')
    h=h[:body]+'<!-- '+MARK+' -->\n'+h[body:]
p.write_text(h,encoding='utf-8')
for alias in ('gestionale-v2','gestionale-v3'):
    (ROOT/alias/'index.html').write_text(h,encoding='utf-8')

checks=[
 ('cash-register.js','__OPTYKER_CLIENT_CART_PERSISTENCE_V1__'),
 ('cash-register.js','client_cart_get'),('cash-register.js','client_cart_save'),
 ('optyker-operations.js',"b.textContent='Ordina'"),
 ('index.html',MARK),('index.html','Pronto per la consegna'),('index.html','client-cart-updated')
]
for name,needle in checks:
    if needle not in (ROOT/name).read_text(encoding='utf-8'):
        raise SystemExit('Missing order/cart/lab patch: '+name+' -> '+needle)
print('Order + persistent client cart + 48h/10d laboratory UI installed')

# Final eyewear usability repair: quote/job ordering, current-client binding and visible order button.
runpy.run_path(str(Path(__file__).with_name('patch_eyewear_simple_order_20260915.py')),run_name='__main__')

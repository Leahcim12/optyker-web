(function(){
if(window.__optykerCashLoaded)return;window.__optykerCashLoaded=true;
var API='https://whgziwaegjzqsgcntesr.supabase.co/functions/v1/optyker-cash-register-api';
var S={products:[],cart:{},type:'',payment:'card',clientId:'',busy:false,searchTimer:null};

function E(id){return document.getElementById(id)}
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function creds(){var c=window.OPTYKER_CLOUD||{};return {username:String(c.username||window.OPTYKER_ACTIVE_USER||'').trim(),password:String(c.password||'')}}
function api(action,payload){
  var c=creds();if(!c.username||!c.password)return Promise.reject(new Error('Sessione operatore non disponibile. Esci e accedi nuovamente.'));
  return fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:action,username:c.username,password:c.password,payload:payload||{}})})
    .then(function(r){return r.json().catch(function(){return {}}).then(function(x){if(!r.ok||!x||x.ok===false)throw new Error(x&&x.error||('HTTP '+r.status));return x})})
}
function euro(v){try{return new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR'}).format(Number(v||0))}catch(e){return (Number(v||0).toFixed(2)+' €')}}
function toast(m,t){var x=E('optykerCashToast');if(!x){x=document.createElement('div');x.id='optykerCashToast';document.body.appendChild(x)}x.className=t||'';x.textContent=m;x.style.display='block';clearTimeout(x.__tm);x.__tm=setTimeout(function(){x.style.display='none'},3600)}

function installTop(){
  if(window.OPTYKER_BILLING_ADMIN)return;
  var n=E('optykerQuickNewClient');if(!n||E('optykerCashBtn'))return;
  var b=document.createElement('button');b.id='optykerCashBtn';b.type='button';b.textContent='Cassa';b.onclick=function(){openCash('')};
  n.insertAdjacentElement('afterend',b)
}
function installClient(){
  if(window.OPTYKER_BILLING_ADMIN)return;
  var name=E('clientWorkspaceName');if(!name||E('optykerClientCashBtn'))return;
  var b=document.createElement('button');b.id='optykerClientCashBtn';b.type='button';b.textContent='🛒 Cassa cliente';
  b.onclick=function(){openCash(String(window.clientCurrentId||''))};
  name.insertAdjacentElement('afterend',b)
}
function clientsLocal(){
  var a=(window.OPTYKER_CLOUD&&Array.isArray(OPTYKER_CLOUD.clients))?OPTYKER_CLOUD.clients:[];
  return a.slice().sort(function(a,b){return String((a.surname||'')+' '+(a.name||'')).localeCompare(String((b.surname||'')+' '+(b.name||'')),'it')})
}
function clientLabel(c){var n=((c.surname||'')+' '+(c.name||'')).trim()||'Cliente';return n+(c.reference_no?' · '+c.reference_no:'')}
function ensureUI(){
  if(E('optykerCashOverlay'))return;
  var d=document.createElement('div');d.id='optykerCashOverlay';d.className='optykerCashOverlay';
  d.innerHTML='<div class="optykerCashHeader">'+
    '<div class="optykerCashBrand"><div class="optykerCashBrandMark">€</div><div><div class="optykerCashBrandTitle">Cassa</div><div class="optykerCashBrandSub">Optyker · vendita in negozio</div></div></div>'+
    '<div class="optykerCashSearchWrap"><input id="optykerCashSearch" type="search" autocomplete="off" placeholder="Cerca prodotto, marca, SKU o codice…"></div>'+
    '<div class="optykerCashHeaderRight"><div id="optykerCashOperator" class="optykerCashHeaderBadge"></div><button id="optykerCashClose" type="button">×</button></div></div>'+
    '<div class="optykerCashMain"><section class="optykerCashCatalog"><div class="optykerCashCatalogTop"><div id="optykerCashTypes"></div><button id="optykerCashRefresh" type="button">Aggiorna catalogo</button></div><div id="optykerCashProducts" class="optykerCashProducts"></div></section>'+
    '<aside class="optykerCashCart"><div class="optykerCashCartHead"><div class="optykerCashCartTitle">Carrello</div><div id="optykerCashCartCount" class="optykerCashCartCount">0 articoli</div><div class="optykerCashClientBox"><label>Cliente</label><select id="optykerCashClient"></select></div></div><div id="optykerCashCartItems" class="optykerCashCartItems"></div>'+
    '<div class="optykerCashCheckout"><div class="optykerCashTotalRow"><div class="optykerCashTotalLabel">Totale</div><div id="optykerCashTotal">€ 0,00</div></div><div class="optykerCashPayLabel">Pagamento</div><div class="optykerCashPayModes">'+
    '<button class="optykerCashPayMode" data-pay="cash" type="button">Contanti</button><button class="optykerCashPayMode active" data-pay="card" type="button">Carta</button><button class="optykerCashPayMode" data-pay="bank" type="button">Bonifico</button><button class="optykerCashPayMode" data-pay="pending" type="button">Da pagare</button></div>'+
    '<textarea id="optykerCashNote" placeholder="Nota vendita (facoltativa)"></textarea><button id="optykerCashCheckoutBtn" type="button" disabled>Conferma vendita</button><button id="optykerCashRecentBtn" type="button">Ultime vendite</button></div></aside></div>';
  document.body.appendChild(d);
  E('optykerCashClose').onclick=closeCash;E('optykerCashRefresh').onclick=function(){loadProducts(true)};
  E('optykerCashSearch').oninput=function(){clearTimeout(S.searchTimer);S.searchTimer=setTimeout(function(){loadProducts(false)},280)};
  E('optykerCashClient').onchange=function(){S.clientId=this.value||''};
  var ps=d.querySelectorAll('[data-pay]');for(var i=0;i<ps.length;i++)ps[i].onclick=function(){S.payment=this.getAttribute('data-pay')||'card';renderPay()};
  E('optykerCashCheckoutBtn').onclick=checkout;E('optykerCashRecentBtn').onclick=recentSales;
}
function fillClients(id){
  var s=E('optykerCashClient');if(!s)return;
  var a=clientsLocal();var h='<option value="">Cliente occasionale</option>';
  for(var i=0;i<a.length;i++)h+='<option value="'+esc(a[i].id)+'">'+esc(clientLabel(a[i]))+'</option>';
  s.innerHTML=h;s.value=id||'';S.clientId=s.value||''
}
function openCash(clientId){
  ensureUI();fillClients(clientId||'');S.clientId=clientId||'';
  var o=E('optykerCashOperator'),c=creds();if(o)o.textContent=c.username?'Operatore · '+c.username:'Operatore';
  E('optykerCashOverlay').classList.add('open');document.body.style.overflow='hidden';
  renderCart();loadProducts(false);setTimeout(function(){try{E('optykerCashSearch').focus()}catch(e){}},60)
}
function closeCash(){var o=E('optykerCashOverlay');if(o)o.classList.remove('open');document.body.style.overflow=''}
function loadProducts(force){
  var box=E('optykerCashProducts');if(!box)return;
  box.innerHTML='<div class="optykerCashLoading">Caricamento catalogo…</div>';
  var q=String(E('optykerCashSearch')&&E('optykerCashSearch').value||'').trim();
  api('products',{search:q,first:70,force:!!force}).then(function(x){S.products=Array.isArray(x.data)?x.data:[];S.type='';renderTypes();renderProducts()}).catch(function(e){box.innerHTML='<div class="optykerCashEmpty">Errore catalogo: '+esc(e.message)+'</div>'})
}
function renderTypes(){
  var b=E('optykerCashTypes');if(!b)return;var types={};
  S.products.forEach(function(p){var t=String(p.product_type||'').trim();if(t)types[t]=1});
  var arr=Object.keys(types).sort(function(a,b){return a.localeCompare(b,'it')});
  var h='<button type="button" class="optykerCashType active" data-type="">Tutti</button>';
  arr.slice(0,8).forEach(function(t){h+='<button type="button" class="optykerCashType" data-type="'+esc(t)+'">'+esc(t)+'</button>'});
  b.innerHTML=h;var bs=b.querySelectorAll('[data-type]');for(var i=0;i<bs.length;i++)bs[i].onclick=function(){S.type=this.getAttribute('data-type')||'';var all=b.querySelectorAll('[data-type]');for(var j=0;j<all.length;j++)all[j].classList.toggle('active',all[j]===this);renderProducts()}
}
function renderProducts(){
  var box=E('optykerCashProducts');if(!box)return;var rows=S.products.filter(function(p){return !S.type||String(p.product_type||'')===S.type});
  if(!rows.length){box.innerHTML='<div class="optykerCashEmpty">Nessun prodotto trovato.</div>';return}
  var h='';
  rows.forEach(function(p){
    var v=String(p.variant_title||'');if(v==='Default Title')v='';
    h+='<article class="optykerCashProduct" data-variant="'+esc(p.variant_id)+'"><div class="optykerCashProductImage">'+(p.image?'<img src="'+esc(p.image)+'" alt="">':'<div style="font-size:28px;opacity:.35">◉</div>')+'</div><div class="optykerCashProductBody"><div class="optykerCashProductTitle">'+esc(p.title)+'</div><div class="optykerCashProductVariant">'+esc([v,p.sku].filter(Boolean).join(' · '))+'</div><div class="optykerCashProductFoot"><div class="optykerCashProductPrice">'+esc(euro(p.price))+'</div><div class="optykerCashProductStock">'+(p.inventory_quantity==null?'':('Disp. '+esc(p.inventory_quantity)))+'</div></div></div></article>'
  });
  box.innerHTML=h;var cards=box.querySelectorAll('[data-variant]');for(var i=0;i<cards.length;i++)cards[i].onclick=function(){add(this.getAttribute('data-variant'))}
}
function add(id){
  var p=null;for(var i=0;i<S.products.length;i++)if(S.products[i].variant_id===id){p=S.products[i];break}if(!p)return;
  if(!S.cart[id])S.cart[id]={item:p,qty:0};S.cart[id].qty=Math.min(99,S.cart[id].qty+1);renderCart();toast(p.title+' aggiunto','ok')
}
function qty(id,d){if(!S.cart[id])return;S.cart[id].qty+=d;if(S.cart[id].qty<=0)delete S.cart[id];renderCart()}
function removeLine(id){delete S.cart[id];renderCart()}
function cartRows(){return Object.keys(S.cart).map(function(k){return S.cart[k]}).filter(function(x){return x&&x.qty>0})}
function renderCart(){
  var box=E('optykerCashCartItems');if(!box)return;var rows=cartRows(),total=0,count=0;rows.forEach(function(x){total+=Number(x.item.price||0)*x.qty;count+=x.qty});
  E('optykerCashCartCount').textContent=count+' articol'+(count===1?'o':'i');E('optykerCashTotal').textContent=euro(total);
  var cb=E('optykerCashCheckoutBtn');cb.disabled=!rows.length||S.busy;cb.textContent=rows.length?('Conferma vendita · '+euro(total)):'Conferma vendita';
  if(!rows.length){box.innerHTML='<div class="optykerCashCartEmpty">Il carrello è vuoto.<br>Seleziona un prodotto per iniziare.</div>';return}
  var h='';rows.forEach(function(x){var p=x.item,v=String(p.variant_title||'');if(v==='Default Title')v='';
    h+='<div class="optykerCashCartItem"><div><div class="optykerCashCartItemTitle">'+esc(p.title)+'</div><div class="optykerCashCartItemMeta">'+esc([v,p.sku].filter(Boolean).join(' · '))+'</div><div class="optykerCashQty"><button type="button" data-minus="'+esc(p.variant_id)+'">−</button><span>'+x.qty+'</span><button type="button" data-plus="'+esc(p.variant_id)+'">+</button></div><button type="button" class="optykerCashRemove" data-remove="'+esc(p.variant_id)+'">Rimuovi</button></div><div class="optykerCashCartItemPrice">'+esc(euro(Number(p.price||0)*x.qty))+'</div></div>'
  });box.innerHTML=h;
  var ms=box.querySelectorAll('[data-minus]'),ps=box.querySelectorAll('[data-plus]'),rs=box.querySelectorAll('[data-remove]');
  for(var i=0;i<ms.length;i++)ms[i].onclick=function(){qty(this.getAttribute('data-minus'),-1)};
  for(i=0;i<ps.length;i++)ps[i].onclick=function(){qty(this.getAttribute('data-plus'),1)};
  for(i=0;i<rs.length;i++)rs[i].onclick=function(){removeLine(this.getAttribute('data-remove'))}
}
function renderPay(){var bs=document.querySelectorAll('.optykerCashPayMode');for(var i=0;i<bs.length;i++)bs[i].classList.toggle('active',bs[i].getAttribute('data-pay')===S.payment)}
function checkout(){
  var rows=cartRows();if(!rows.length||S.busy)return;var total=0;rows.forEach(function(x){total+=Number(x.item.price||0)*x.qty});
  var sel=E('optykerCashClient'),client=sel&&sel.selectedOptions&&sel.selectedOptions[0]?sel.selectedOptions[0].textContent:'Cliente occasionale';
  if(!window.confirm('Confermare la vendita di '+euro(total)+' per '+client+'?'))return;
  S.busy=true;renderCart();
  api('checkout',{client_id:S.clientId,payment_method:S.payment,note:String(E('optykerCashNote').value||''),lines:rows.map(function(x){return {variant_id:x.item.variant_id,quantity:x.qty}})})
    .then(function(x){var sale=x.data||{};S.cart={};E('optykerCashNote').value='';renderCart();toast('Vendita registrata'+(sale.shopify_order_name?' · '+sale.shopify_order_name:''),'ok')})
    .catch(function(e){toast('Vendita non completata: '+e.message,'error')})
    .finally(function(){S.busy=false;renderCart()})
}
function recentSales(){
  var m=E('optykerCashRecentModal');if(!m){m=document.createElement('div');m.id='optykerCashRecentModal';m.className='optykerCashModal';document.body.appendChild(m)}
  m.innerHTML='<div class="optykerCashModalCard"><div class="optykerCashModalTitle">Ultime vendite</div><div class="optykerCashModalSub">Movimenti registrati dalla cassa Optyker.</div><div id="optykerCashSaleList" class="optykerCashSaleList"><div class="optykerCashLoading">Caricamento…</div></div><button class="optykerCashModalClose" type="button">Chiudi</button></div>';m.classList.add('open');
  m.querySelector('.optykerCashModalClose').onclick=function(){m.classList.remove('open')};m.onclick=function(ev){if(ev.target===m)m.classList.remove('open')};
  api('recent_sales',{client_id:S.clientId}).then(function(x){var box=E('optykerCashSaleList'),a=Array.isArray(x.data)?x.data:[];if(!a.length){box.innerHTML='<div class="optykerCashEmpty">Nessuna vendita registrata.</div>';return}
    box.innerHTML=a.map(function(r){var dt='';try{dt=new Date(r.created_at).toLocaleString('it-IT')}catch(e){}return '<div class="optykerCashSaleRow"><div class="optykerCashSaleTop"><div class="optykerCashSaleName">'+esc(r.shopify_order_name||'Vendita')+'</div><div class="optykerCashSaleAmount">'+esc(euro(r.total))+'</div></div><div class="optykerCashSaleMeta">'+esc(dt+' · '+(r.payment_method||'')+' · '+(r.status||''))+'</div></div>'}).join('')
  }).catch(function(e){E('optykerCashSaleList').innerHTML='<div class="optykerCashEmpty">Errore: '+esc(e.message)+'</div>'})
}
window.openOptykerCash=function(clientId){openCash(clientId||'')};
function tick(){installTop();installClient()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',tick);else tick();setInterval(tick,700);
})();
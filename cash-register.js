(function(){
if(window.__optykerCashLoaded)return;window.__optykerCashLoaded=true;
window.OPTYKER_CASH_BUILD='20260903-giftreceipt1';
var API='https://whgziwaegjzqsgcntesr.supabase.co/functions/v1/optyker-cash-register-api';
var S={products:[],clients:[],cart:{},type:'',payment:'card',stage:'balance',clientId:'',invoice:false,tsRequested:false,tsCode:'AD',tsOpposition:false,busy:false,searchTimer:null,clientSearchTimer:null,rchOk:false,cashOpen:false};

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
function rchBridge(){return 'http://127.0.0.1:8765'}
function rchStatusUi(ok,label){
  S.rchOk=!!ok;var b=E('optykerCashRch');if(!b)return;
  b.classList.toggle('ok',!!ok);b.classList.toggle('error',!ok);
  b.textContent=label||((ok?'● RCH collegato':'○ RCH'))
}
function rchRequest(path,opts){
  opts=opts||{};opts.cache='no-store';
  return fetch(rchBridge()+path,opts).then(function(r){return r.json().catch(function(){return {}}).then(function(x){if(!r.ok||!x||x.ok===false)throw new Error(x&&x.error||('HTTP '+r.status));return x})})
}
function testRch(quiet){
  return rchRequest('/status').then(function(x){
    var extra=x.mode?(' · '+x.mode):'';rchStatusUi(true,'● RCH collegato'+extra);
    if(!quiet)toast('RCH PRINT! collegato correttamente'+extra,'ok');return x
  }).catch(function(e){
    rchStatusUi(false,'○ RCH non collegato');
    if(!quiet)toast('Connettore RCH non raggiungibile: '+e.message,'error');
    throw e
  })
}
function openCashDrawer(){
  var b=E('optykerCashDrawer');if(b)b.disabled=true;
  return rchRequest('/drawer',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}).then(function(x){
    rchStatusUi(true,'● RCH collegato');
    toast('Cassetto contanti aperto','ok');
    return x
  }).catch(function(e){
    var msg=String(e&&e.message||e||'Errore RCH');
    if(/Endpoint non valido|HTTP 400/i.test(msg))msg='Il connettore RCH va aggiornato. Apri RCH e premi Installa / aggiorna connettore.';
    toast('Cassetto non aperto: '+msg,'error');
    throw e
  }).finally(function(){if(b)b.disabled=false})
}
function printGiftReceipt(){
  var b=E('optykerCashGiftBtn');
  if(!window.confirm('Stampare lo scontrino di cortesia dell\'ultimo documento fiscale emesso?\n\nVerrà stampato senza prezzi.'))return;
  if(b){b.disabled=true;b.textContent='Stampa…'}
  return rchRequest('/gift-receipt',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}).then(function(x){
    rchStatusUi(true,'● RCH collegato');
    toast('Scontrino di cortesia stampato senza prezzi','ok');
    return x
  }).catch(function(e){
    var msg=String(e&&e.message||e||'Errore RCH');
    if(/Endpoint non valido|HTTP 400/i.test(msg))msg='Aggiorna il connettore RCH da RCH → Installa / aggiorna connettore.';
    toast('Scontrino di cortesia non stampato: '+msg,'error');
    throw e
  }).finally(function(){if(b){b.disabled=false;b.textContent='Scontrino cortesia'}})
}
function openRch(){
  var m=E('optykerCashRchModal');if(!m){m=document.createElement('div');m.id='optykerCashRchModal';m.className='optykerCashModal';document.body.appendChild(m)}
  m.innerHTML='<div class="optykerCashModalCard optykerCashRchCard"><div class="optykerCashModalTitle">Registratore fiscale RCH</div>'+
    '<div class="optykerCashModalSub">Optyker usa un piccolo connettore locale per comunicare in sicurezza con RCH PRINT! RT su 192.168.1.10.</div>'+
    '<div class="optykerCashRchInfo"><div><span>Registratore</span><b>RCH PRINT! RT</b></div><div><span>IP</span><b>192.168.1.10</b></div><div><span>Web Service</span><b>/service.cgi</b></div><div><span>Bridge Optyker</span><b>127.0.0.1:8765</b></div></div>'+
    '<div id="optykerCashRchResult" class="optykerCashRchResult">Pronto per il test.</div>'+
    '<div class="optykerCashRchDownloads optykerCashRchDownloadsAuto"><a class="primary" href="/rch-connector/Installa-RCH-Optyker.bat?v=20260903-giftreceipt1" download>Installa / aggiorna connettore</a><a href="/rch-connector/Disinstalla-RCH-Optyker.ps1" download>Rimuovi avvio automatico</a></div>'+
    '<div class="optykerCashRchHelp">Il <b>Test collegamento</b> controlla soltanto la comunicazione e non emette documenti fiscali. <b>Apri cassetto</b> è la prova hardware più semplice: apre solo il cassetto contanti senza stampare uno scontrino.</div>'+
    '<div class="optykerCashRchActions optykerCashRchActions3"><button id="optykerCashRchTest" type="button">Test collegamento</button><button id="optykerCashRchDrawerTest" type="button">Apri cassetto</button><button class="optykerCashModalClose" type="button">Chiudi</button></div></div>';
  m.classList.add('open');
  m.querySelector('.optykerCashModalClose').onclick=function(){m.classList.remove('open')};
  m.onclick=function(ev){if(ev.target===m)m.classList.remove('open')};
  E('optykerCashRchTest').onclick=function(){
    var r=E('optykerCashRchResult');r.textContent='Collegamento in corso…';r.className='optykerCashRchResult';
    testRch(true).then(function(x){r.textContent='Collegamento riuscito · stampante pronta'+(x.mode?' · modalità '+x.mode:'');r.className='optykerCashRchResult ok'})
      .catch(function(e){r.textContent='Non collegato · '+e.message;r.className='optykerCashRchResult error'})
  };
  E('optykerCashRchDrawerTest').onclick=function(){
    var r=E('optykerCashRchResult');r.textContent='Apertura cassetto in corso…';r.className='optykerCashRchResult';
    openCashDrawer().then(function(){r.textContent='Comando inviato · cassetto aperto';r.className='optykerCashRchResult ok'})
      .catch(function(e){r.textContent='Apertura non riuscita · '+e.message;r.className='optykerCashRchResult error'})
  }
}

function installTop(){
  if(window.OPTYKER_BILLING_ADMIN)return;
  var n=E('optykerTopNewClientBtn')||E('optykerQuickNewClient');
  if(!n)return;
  n.setAttribute('data-optyker-cash-managed','1');
  n.innerHTML='<span aria-hidden="true">€</span> Cassa';
  n.title='Cassa Optyker';
  n.style.setProperty('display','inline-flex','important');
  n.style.setProperty('visibility','visible','important');
  n.style.setProperty('opacity','1','important');
  n.style.setProperty('pointer-events','auto','important');
  n.onclick=function(ev){if(ev){ev.preventDefault();ev.stopPropagation()}openCash('')};
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
    '<div class="optykerCashHeaderRight"><button id="optykerCashDrawer" class="optykerCashDrawerBtn" type="button" title="Apri solo il cassetto dei contanti"><span aria-hidden="true">▱</span> Apri cassetto</button><button id="optykerCashRch" class="optykerCashRchBadge" type="button">○ RCH</button><div id="optykerCashOperator" class="optykerCashHeaderBadge"></div><button id="optykerCashClose" type="button">×</button></div></div>'+
    '<div class="optykerCashMain"><section class="optykerCashCatalog"><div class="optykerCashCatalogTop"><div id="optykerCashTypes"></div><button id="optykerCashRefresh" type="button">Aggiorna catalogo</button></div><div id="optykerCashProducts" class="optykerCashProducts"></div></section>'+
    '<aside class="optykerCashCart"><div class="optykerCashCartHead"><div class="optykerCashCartTitle">Carrello</div><div id="optykerCashCartCount" class="optykerCashCartCount">0 articoli</div><div class="optykerCashClientBox"><label>Cerca cliente</label><input id="optykerCashClientSearch" type="search" autocomplete="off" placeholder="Nome, cognome, telefono, email, riferimento…"><label class="optykerCashClientSelectLabel">Cliente</label><select id="optykerCashClient"></select></div></div><div id="optykerCashCartItems" class="optykerCashCartItems"></div>'+
    '<div class="optykerCashCheckout">'+
      '<div class="optykerCashTotalRow"><div class="optykerCashTotalLabel">Totale vendita</div><div id="optykerCashTotal">€ 0,00</div></div>'+
      '<div class="optykerCashPayLabel">Operazione</div><div class="optykerCashStages">'+
        '<button class="optykerCashStage" data-stage="deposit" type="button">Acconto</button>'+
        '<button class="optykerCashStage active" data-stage="balance" type="button">Saldo</button>'+
        '<button class="optykerCashStage" data-stage="delivery_balance" type="button">Saldo consegna</button>'+
      '</div>'+
      '<div id="optykerCashDepositWrap" class="optykerCashDepositWrap" style="display:none"><div><label>Importo acconto</label><input id="optykerCashDeposit" type="number" min="0.01" step="0.01" inputmode="decimal" placeholder="0,00"></div><div class="optykerCashDuePreview"><span>Resterà da saldare</span><b id="optykerCashDue">€ 0,00</b></div></div>'+
      '<div class="optykerCashPayLabel optykerCashPayLabelSpaced">Metodo di pagamento</div><div class="optykerCashPayModes">'+
        '<button class="optykerCashPayMode" data-pay="cash" type="button">Contanti</button><button class="optykerCashPayMode active" data-pay="card" type="button">Carta</button><button class="optykerCashPayMode" data-pay="bank" type="button">Bonifico</button><button class="optykerCashPayMode" data-pay="pending" type="button" title="Pagamento dilazionato" aria-label="RATE - pagamento dilazionato">RATE</button>'+
      '</div>'+
      '<label id="optykerCashTsBox" class="optykerCashTsBox"><input id="optykerCashTs" type="checkbox"><span class="optykerCashTsCheck">✓</span><span><b>Detrazione fiscale · Sistema TS</b><small id="optykerCashTsHint">Seleziona un cliente con Codice Fiscale.</small></span></label>'+
      '<div id="optykerCashTsOptions" class="optykerCashTsOptions" style="display:none"><div><label for="optykerCashTsCode">Codice spesa</label><select id="optykerCashTsCode"><option value="AD">AD · Dispositivo medico</option><option value="AA">AA · Prestazione sanitaria</option></select></div><label class="optykerCashTsOpposition"><input id="optykerCashTsOpposition" type="checkbox"> Il cliente si oppone all\'invio al Sistema TS</label></div>'+
      '<label id="optykerCashInvoiceBox" class="optykerCashInvoiceBox"><input id="optykerCashInvoice" type="checkbox"><span class="optykerCashInvoiceCheck">✓</span><span><b>Crea fattura per questo pagamento</b><small id="optykerCashInvoiceHint">La fattura verrà preparata con i dati del cliente.</small></span></label>'+
      '<textarea id="optykerCashNote" placeholder="Nota vendita (facoltativa)"></textarea>'+
      '<button id="optykerCashCheckoutBtn" type="button" disabled>Conferma vendita</button>'+
      '<div class="optykerCashSecondaryActions"><button id="optykerCashDepositsBtn" type="button">Acconti aperti</button><button id="optykerCashRecentBtn" type="button">Ultime vendite</button><button id="optykerCashGiftBtn" class="optykerCashGiftBtn" type="button" title="Stampa l'ultimo scontrino fiscale senza prezzi">Scontrino cortesia</button><button id="optykerCashTsDocsBtn" type="button">Sistema TS</button></div>'+
    '</div></aside></div>';
  document.body.appendChild(d);
  E('optykerCashClose').onclick=function(ev){return closeCash(ev)};E('optykerCashRch').onclick=openRch;E('optykerCashDrawer').onclick=openCashDrawer;E('optykerCashRefresh').onclick=function(){loadProducts(true)};
  E('optykerCashSearch').oninput=function(){clearTimeout(S.searchTimer);S.searchTimer=setTimeout(function(){loadProducts(false)},280)};
  E('optykerCashClient').onchange=function(){S.clientId=this.value||'';updateInvoiceAvailability();updateTsAvailability()};E('optykerCashClientSearch').oninput=function(){var q=this.value||'';clearTimeout(S.clientSearchTimer);S.clientSearchTimer=setTimeout(function(){searchCashClients(q)},220)};
  var ps=d.querySelectorAll('[data-pay]');for(var i=0;i<ps.length;i++)ps[i].onclick=function(){S.payment=this.getAttribute('data-pay')||'card';renderPay();renderCart();updateTsAvailability()};
  var ss=d.querySelectorAll('[data-stage]');for(i=0;i<ss.length;i++)ss[i].onclick=function(){S.stage=this.getAttribute('data-stage')||'balance';renderStage();renderCart()};
  E('optykerCashDeposit').oninput=renderCart;
  E('optykerCashTs').onchange=function(){
    S.tsRequested=!!this.checked;
    var o=E('optykerCashTsOptions');if(o)o.style.display=S.tsRequested?'grid':'none';
    if(S.tsRequested&&E('optykerCashInvoice')){E('optykerCashInvoice').checked=false;S.invoice=false}
    updateTsAvailability()
  };
  E('optykerCashTsCode').onchange=function(){S.tsCode=this.value==='AA'?'AA':'AD';updateTsAvailability()};
  E('optykerCashTsOpposition').onchange=function(){S.tsOpposition=!!this.checked;updateTsAvailability()};
  E('optykerCashInvoice').onchange=function(){
    S.invoice=!!this.checked;
    if(S.invoice&&E('optykerCashTs')&&E('optykerCashTs').checked){
      E('optykerCashTs').checked=false;S.tsRequested=false;
      var o=E('optykerCashTsOptions');if(o)o.style.display='none'
    }
  };
  E('optykerCashCheckoutBtn').onclick=checkout;E('optykerCashRecentBtn').onclick=recentSales;E('optykerCashDepositsBtn').onclick=openDeposits;E('optykerCashGiftBtn').onclick=printGiftReceipt;E('optykerCashTsDocsBtn').onclick=openTsDocuments;
}
function fillClients(id,rows){
  var s=E('optykerCashClient');if(!s)return;
  var a=Array.isArray(rows)?rows:(S.clients.length?S.clients:clientsLocal());
  var h='<option value="">Cliente occasionale</option>';
  for(var i=0;i<a.length;i++)h+='<option value="'+esc(a[i].id)+'">'+esc(clientLabel(a[i]))+'</option>';
  s.innerHTML=h;
  if(id&&Array.prototype.some.call(s.options,function(o){return o.value===id}))s.value=id;else if(!id)s.value='';
  S.clientId=s.value||''
}
function searchCashClients(q,keepId){
  var clean=String(q||'').trim();
  return api('clients',{search:clean}).then(function(x){
    S.clients=Array.isArray(x.data)?x.data:[];
    fillClients(keepId||S.clientId,S.clients);
    updateInvoiceAvailability();updateTsAvailability()
  }).catch(function(){
    var all=clientsLocal(),k=clean.toLowerCase();
    S.clients=k?all.filter(function(c){return [c.name,c.surname,c.email,c.phone,c.fiscal,c.vat,c.reference_no].join(' ').toLowerCase().indexOf(k)>=0}):all;
    fillClients(keepId||S.clientId,S.clients);updateInvoiceAvailability();updateTsAvailability()
  })
}
function openCash(clientId){
  S.cashOpen=true;ensureUI();var overlay=E('optykerCashOverlay');if(overlay){overlay.style.removeProperty('display');overlay.removeAttribute('aria-hidden')};S.stage='balance';S.payment='card';S.invoice=false;S.tsRequested=false;S.tsCode='AD';S.tsOpposition=false;S.clients=clientsLocal();fillClients(clientId||'',S.clients);S.clientId=clientId||'';if(E('optykerCashClientSearch'))E('optykerCashClientSearch').value='';searchCashClients('',clientId||'');
  var o=E('optykerCashOperator'),c=creds();if(o)o.textContent=c.username?'Operatore · '+c.username:'Operatore';
  E('optykerCashOverlay').classList.add('open');document.body.style.overflow='hidden';testRch(true).catch(function(){});
  var inv=E('optykerCashInvoice');if(inv)inv.checked=false;
  var ts=E('optykerCashTs');if(ts)ts.checked=false;var tso=E('optykerCashTsOptions');if(tso)tso.style.display='none';
  if(E('optykerCashTsCode'))E('optykerCashTsCode').value='AD';if(E('optykerCashTsOpposition'))E('optykerCashTsOpposition').checked=false;
  renderPay();renderStage();updateInvoiceAvailability();updateTsAvailability();renderCart();loadProducts(false);setTimeout(function(){try{E('optykerCashSearch').focus()}catch(e){}},60)
}
function closeCash(ev){
  if(ev){try{ev.preventDefault()}catch(e){}try{ev.stopPropagation()}catch(e){}}
  S.cashOpen=false;
  var o=E('optykerCashOverlay');
  if(o){
    o.classList.remove('open');
    o.setAttribute('aria-hidden','true');
    o.style.setProperty('display','none','important');
  }
  document.body.style.overflow='';
  document.documentElement.style.overflow='';
  try{
    var focus=E('optykerCashBtn')||E('optykerQuickNewClient');
    if(focus&&focus.focus)focus.focus()
  }catch(e){}
  return false
}
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
    h+='<div class="optykerCashProduct" role="button" tabindex="0" data-variant="'+esc(p.variant_id)+'"><div class="optykerCashProductImage">'+(p.image?'<img src="'+esc(p.image)+'" alt="">':'<div class="optykerCashProductPlaceholder">◉</div>')+'</div><div class="optykerCashProductBody"><div class="optykerCashProductTitle">'+esc(p.title)+'</div><div class="optykerCashProductVariant">'+esc([v,p.sku].filter(Boolean).join(' · '))+'</div><div class="optykerCashProductFoot"><div class="optykerCashProductPrice">'+esc(euro(p.price))+'</div><div class="optykerCashProductStock">'+(p.inventory_quantity==null?'':('Disp. '+esc(p.inventory_quantity)))+'</div></div></div></div>'
  });
  box.innerHTML=h;var cards=box.querySelectorAll('[data-variant]');for(var i=0;i<cards.length;i++){cards[i].onclick=function(){add(this.getAttribute('data-variant'))};cards[i].onkeydown=function(ev){if(ev.key==='Enter'||ev.key===' '){ev.preventDefault();add(this.getAttribute('data-variant'))}}}
}
function add(id){
  var p=null;for(var i=0;i<S.products.length;i++)if(S.products[i].variant_id===id){p=S.products[i];break}if(!p)return;
  if(!S.cart[id])S.cart[id]={item:p,qty:0};S.cart[id].qty=Math.min(99,S.cart[id].qty+1);renderCart();toast(p.title+' aggiunto','ok')
}
function qty(id,d){if(!S.cart[id])return;S.cart[id].qty+=d;if(S.cart[id].qty<=0)delete S.cart[id];renderCart()}
function removeLine(id){delete S.cart[id];renderCart()}
function cartRows(){return Object.keys(S.cart).map(function(k){return S.cart[k]}).filter(function(x){return x&&x.qty>0})}
function cartTotal(){
  var total=0;cartRows().forEach(function(x){total+=Number(x.item.price||0)*x.qty});return Math.round(total*100)/100
}
function depositAmount(){
  var x=E('optykerCashDeposit'),n=Number(x&&x.value||0);return isFinite(n)?Math.round(n*100)/100:0
}
function stageLabel(s){return s==='deposit'?'Acconto':(s==='delivery_balance'?'Saldo consegna':'Saldo')}
function renderCart(){
  var box=E('optykerCashCartItems');if(!box)return;var rows=cartRows(),total=cartTotal(),count=0;rows.forEach(function(x){count+=x.qty});
  E('optykerCashCartCount').textContent=count+' articol'+(count===1?'o':'i');E('optykerCashTotal').textContent=euro(total);
  var dep=depositAmount(),validDep=S.stage!=='deposit'||(dep>0&&dep<total);
  var due=S.stage==='deposit'?Math.max(0,total-dep):0;if(E('optykerCashDue'))E('optykerCashDue').textContent=euro(due);
  var cb=E('optykerCashCheckoutBtn');cb.disabled=!rows.length||S.busy||!validDep;
  var payNow=S.payment==='pending'?0:(S.stage==='deposit'?dep:total);
  cb.textContent=rows.length?(stageLabel(S.stage)+' · '+euro(payNow)):'Conferma vendita';
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
function renderStage(){
  var bs=document.querySelectorAll('.optykerCashStage');for(var i=0;i<bs.length;i++)bs[i].classList.toggle('active',bs[i].getAttribute('data-stage')===S.stage);
  var w=E('optykerCashDepositWrap');if(w)w.style.display=S.stage==='deposit'?'grid':'none';
}
function currentCashClient(){
  var id=String(S.clientId||'');if(!id)return null;
  var pools=[S.clients,clientsLocal()];
  for(var p=0;p<pools.length;p++){var a=Array.isArray(pools[p])?pools[p]:[];for(var i=0;i<a.length;i++)if(String(a[i]&&a[i].id||'')===id)return a[i]}
  return null
}
function cleanFiscal(v){return String(v||'').toUpperCase().replace(/\s+/g,'')}
function updateTsAvailability(){
  var box=E('optykerCashTsBox'),ck=E('optykerCashTs'),hint=E('optykerCashTsHint'),opts=E('optykerCashTsOptions');
  if(!box||!ck)return;
  var cl=currentCashClient(),fiscal=cleanFiscal(cl&&cl.fiscal),ok=!!cl&&/^[A-Z0-9]{16}$/.test(fiscal);
  ck.disabled=!ok;box.classList.toggle('disabled',!ok);
  if(!ok){
    ck.checked=false;S.tsRequested=false;S.tsOpposition=false;
    if(opts)opts.style.display='none';
    if(hint)hint.textContent=cl?'Completa il Codice Fiscale del cliente per la detrazione.':'Seleziona un cliente con Codice Fiscale.';
    return
  }
  S.tsRequested=!!ck.checked;
  if(opts)opts.style.display=S.tsRequested?'grid':'none';
  var code=E('optykerCashTsCode');S.tsCode=code&&code.value==='AA'?'AA':'AD';
  var opp=E('optykerCashTsOpposition');S.tsOpposition=!!(opp&&opp.checked);
  if(hint){
    if(S.tsOpposition)hint.textContent='Opposizione registrata: la spesa non verrà trasmessa al Sistema TS.';
    else if(S.tsCode==='AA'&&S.payment==='cash')hint.textContent='AA richiede un pagamento tracciabile per essere detraibile.';
    else hint.textContent='La spesa verrà preparata per FOCUS TS dopo il documento fiscale RCH.'
  }
}
function updateInvoiceAvailability(){
  var box=E('optykerCashInvoiceBox'),inv=E('optykerCashInvoice'),hint=E('optykerCashInvoiceHint');if(!box||!inv)return;
  var ok=!!S.clientId;inv.disabled=!ok;box.classList.toggle('disabled',!ok);
  if(!ok){inv.checked=false;S.invoice=false;if(hint)hint.textContent='Per la fattura seleziona prima un cliente.'}
  else if(hint)hint.textContent='Verrà creata la fattura del solo importo pagato.';
}
function checkout(){
  var rows=cartRows();if(!rows.length||S.busy)return;var total=cartTotal(),dep=depositAmount();
  if(S.stage==='deposit'&&!(dep>0&&dep<total)){toast("Inserisci un acconto maggiore di 0 e inferiore al totale.",'error');return}
  var inv=!!(E('optykerCashInvoice')&&E('optykerCashInvoice').checked);
  var ts=!!(E('optykerCashTs')&&E('optykerCashTs').checked);
  var tsCode=E('optykerCashTsCode')&&E('optykerCashTsCode').value==='AA'?'AA':'AD';
  var tsOpp=!!(E('optykerCashTsOpposition')&&E('optykerCashTsOpposition').checked);
  if(inv&&!S.clientId){toast('Per creare la fattura seleziona un cliente.','error');return}
  if(ts&&!S.clientId){toast('Per il Sistema TS seleziona un cliente con Codice Fiscale.','error');return}
  if(ts&&inv){toast('Per una spesa Sistema TS non usare la fattura elettronica.','error');return}
  if(ts&&S.payment==='pending'){toast('Per preparare il Sistema TS registra prima un pagamento.','error');return}
  if(ts&&tsCode==='AA'&&S.payment==='cash'){toast('Le spese AA richiedono un pagamento tracciabile.','error');return}
  var sel=E('optykerCashClient'),client=sel&&sel.selectedOptions&&sel.selectedOptions[0]?sel.selectedOptions[0].textContent:'Cliente occasionale';
  var payNow=S.payment==='pending'?0:(S.stage==='deposit'?dep:total);
  var msg=stageLabel(S.stage)+' di '+euro(payNow)+' per '+client+'.';
  if(S.stage==='deposit')msg+=' Resteranno '+euro(total-dep)+' da saldare.';
  if(inv)msg+=' Verrà preparata anche la fattura del pagamento.';
  if(ts)msg+=tsOpp?' Verrà registrata l\'opposizione al Sistema TS.':' Verrà preparata la spesa '+tsCode+' per il Sistema TS.';
  if(!window.confirm(msg+'\n\nConfermare?'))return;
  S.busy=true;renderCart();
  api('checkout',{
    client_id:S.clientId,payment_method:S.payment,payment_stage:S.stage,deposit_amount:dep,
    invoice_requested:inv,ts_requested:ts,ts_expense_code:tsCode,ts_opposition:tsOpp,
    note:String(E('optykerCashNote').value||''),
    lines:rows.map(function(x){return {variant_id:x.item.variant_id,quantity:x.qty}})
  }).then(function(x){
    var sale=x.data||{};S.cart={};E('optykerCashNote').value='';
    if(E('optykerCashDeposit'))E('optykerCashDeposit').value='';
    if(E('optykerCashInvoice'))E('optykerCashInvoice').checked=false;S.invoice=false;
    if(E('optykerCashTs'))E('optykerCashTs').checked=false;S.tsRequested=false;
    if(E('optykerCashTsOptions'))E('optykerCashTsOptions').style.display='none';
    if(E('optykerCashTsOpposition'))E('optykerCashTsOpposition').checked=false;S.tsOpposition=false;
    renderCart();updateTsAvailability();
    var text='Vendita registrata'+(sale.shopify_order_name?' · '+sale.shopify_order_name:'');
    if(Number(sale.due_amount||0)>0)text+=' · da saldare '+euro(sale.due_amount);
    if(sale.billing_invoice&&sale.billing_invoice.id)text+=' · fattura preparata';
    if(sale.ts_document&&sale.ts_document.id)text+=sale.ts_document.opposition?' · opposizione TS registrata':' · Sistema TS preparato';
    toast(text,'ok')
  }).catch(function(e){toast('Vendita non completata: '+e.message,'error')}).finally(function(){S.busy=false;renderCart()})
}
function openDeposits(){
  var m=E('optykerCashDepositsModal');if(!m){m=document.createElement('div');m.id='optykerCashDepositsModal';m.className='optykerCashModal';document.body.appendChild(m)}
  m.innerHTML='<div class="optykerCashModalCard optykerCashDepositsCard"><div class="optykerCashModalTitle">Acconti aperti</div><div class="optykerCashModalSub">Seleziona un acconto per registrare il saldo oppure il saldo alla consegna.</div><div id="optykerCashDepositsList"><div class="optykerCashLoading">Caricamento…</div></div><button class="optykerCashModalClose" type="button">Chiudi</button></div>';
  m.classList.add('open');m.querySelector('.optykerCashModalClose').onclick=function(){m.classList.remove('open')};m.onclick=function(ev){if(ev.target===m)m.classList.remove('open')};
  api('open_deposits',{client_id:S.clientId}).then(function(x){
    var box=E('optykerCashDepositsList'),a=Array.isArray(x.data)?x.data:[];if(!a.length){box.innerHTML='<div class="optykerCashEmpty">Nessun acconto da saldare.</div>';return}
    box.innerHTML=a.map(function(r){
      var cl=r.client?(((r.client.surname||'')+' '+(r.client.name||'')).trim()||'Cliente'):'Cliente occasionale',dt='';try{dt=new Date(r.created_at).toLocaleDateString('it-IT')}catch(e){}
      return '<div class="optykerCashDepositRow"><div class="optykerCashDepositInfo"><b>'+esc(r.shopify_order_name||'Vendita')+' · '+esc(cl)+'</b><span>'+esc(dt)+' · Totale '+esc(euro(r.total))+' · Pagato '+esc(euro(r.paid_amount))+'</span></div><div class="optykerCashDepositDue"><span>Da saldare</span><b>'+esc(euro(r.due_amount))+'</b></div><div class="optykerCashDepositActions"><button type="button" data-settle="balance" data-sale="'+esc(r.id)+'">Saldo</button><button type="button" data-settle="delivery_balance" data-sale="'+esc(r.id)+'">Saldo consegna</button></div></div>'
    }).join('');
    var bs=box.querySelectorAll('[data-settle]');for(var i=0;i<bs.length;i++)bs[i].onclick=function(){settleExisting(this.getAttribute('data-sale'),this.getAttribute('data-settle'),m)}
  }).catch(function(e){E('optykerCashDepositsList').innerHTML='<div class="optykerCashEmpty">Errore: '+esc(e.message)+'</div>'})
}
function settleExisting(saleId,stage,modal){
  if(S.payment==='pending'){toast('Per saldare seleziona Contanti, Carta o Bonifico.','error');return}
  var inv=!!(E('optykerCashInvoice')&&E('optykerCashInvoice').checked);
  var ts=!!(E('optykerCashTs')&&E('optykerCashTs').checked);
  var tsCode=E('optykerCashTsCode')&&E('optykerCashTsCode').value==='AA'?'AA':'AD';
  var tsOpp=!!(E('optykerCashTsOpposition')&&E('optykerCashTsOpposition').checked);
  if(ts&&inv){toast('Per una spesa Sistema TS non usare la fattura elettronica.','error');return}
  if(ts&&tsCode==='AA'&&S.payment==='cash'){toast('Le spese AA richiedono un pagamento tracciabile.','error');return}
  var label=stage==='delivery_balance'?'saldo alla consegna':'saldo';
  var extra=inv?'\nVerrà preparata anche la fattura del pagamento.':'';
  if(ts)extra+=tsOpp?'\nVerrà registrata l\'opposizione al Sistema TS.':'\nVerrà preparata la spesa '+tsCode+' per il Sistema TS.';
  if(!window.confirm('Registrare il '+label+'?'+extra))return;
  api('settle',{sale_id:saleId,payment_stage:stage,payment_method:S.payment,invoice_requested:inv,ts_requested:ts,ts_expense_code:tsCode,ts_opposition:tsOpp,note:String(E('optykerCashNote').value||'')})
    .then(function(x){var sale=x.data||{};var t='Saldo registrato'+(sale.billing_invoice?' · fattura preparata':'');if(sale.ts_document)t+=sale.ts_document.opposition?' · opposizione TS registrata':' · Sistema TS preparato';toast(t,'ok');if(modal)modal.classList.remove('open');openDeposits()})
    .catch(function(e){toast('Saldo non completato: '+e.message,'error')})
}
function openTsDocuments(){
  var m=E('optykerCashTsModal');if(!m){m=document.createElement('div');m.id='optykerCashTsModal';m.className='optykerCashModal';document.body.appendChild(m)}
  m.innerHTML='<div class="optykerCashModalCard optykerCashTsModalCard"><div class="optykerCashModalTitle">Sistema Tessera Sanitaria</div><div class="optykerCashModalSub">Spese preparate da Optyker per FOCUS TS. L\'invio telematico resta bloccato finché non è disponibile il numero del documento fiscale RCH.</div><div id="optykerCashTsList"><div class="optykerCashLoading">Caricamento…</div></div><button class="optykerCashModalClose" type="button">Chiudi</button></div>';
  m.classList.add('open');m.querySelector('.optykerCashModalClose').onclick=function(){m.classList.remove('open')};m.onclick=function(ev){if(ev.target===m)m.classList.remove('open')};
  api('ts_documents',{client_id:S.clientId}).then(function(x){
    var box=E('optykerCashTsList'),a=Array.isArray(x.data)?x.data:[];if(!a.length){box.innerHTML='<div class="optykerCashEmpty">Nessuna spesa TS preparata.</div>';return}
    function sl(v){if(v==='opposition_recorded')return 'Opposizione';if(v==='ready_focus_ts')return 'Pronto FOCUS TS';if(v==='sent')return 'Inviato';if(v==='accepted')return 'Accettato';if(v==='rejected')return 'Scartato';if(v==='error')return 'Errore';return 'Attende documento fiscale'}
    box.innerHTML=a.map(function(r){var dt='';try{dt=new Date(r.payment_date||r.created_at).toLocaleDateString('it-IT')}catch(e){}var doc=r.document_number?(' · Doc. '+r.document_number):'';var proto=r.ts_protocol?(' · Protocollo '+r.ts_protocol):'';return '<div class="optykerCashTsRow"><div><b>'+esc(r.expense_code)+' · '+esc(euro(r.amount))+'</b><span>'+esc(dt+doc+' · '+(r.payment_method||''))+'</span></div><div class="optykerCashTsStatus '+esc(r.status||'')+'">'+esc(sl(r.status))+esc(proto)+'</div></div>'}).join('')
  }).catch(function(e){E('optykerCashTsList').innerHTML='<div class="optykerCashEmpty">Errore: '+esc(e.message)+'</div>'})
}
function recentSales(){
  var m=E('optykerCashRecentModal');if(!m){m=document.createElement('div');m.id='optykerCashRecentModal';m.className='optykerCashModal';document.body.appendChild(m)}
  m.innerHTML='<div class="optykerCashModalCard"><div class="optykerCashModalTitle">Ultime vendite</div><div class="optykerCashModalSub">Movimenti registrati dalla cassa Optyker.</div><div id="optykerCashSaleList" class="optykerCashSaleList"><div class="optykerCashLoading">Caricamento…</div></div><button class="optykerCashModalClose" type="button">Chiudi</button></div>';m.classList.add('open');
  m.querySelector('.optykerCashModalClose').onclick=function(){m.classList.remove('open')};m.onclick=function(ev){if(ev.target===m)m.classList.remove('open')};
  api('recent_sales',{client_id:S.clientId}).then(function(x){var box=E('optykerCashSaleList'),a=Array.isArray(x.data)?x.data:[];if(!a.length){box.innerHTML='<div class="optykerCashEmpty">Nessuna vendita registrata.</div>';return}
    box.innerHTML=a.map(function(r){var dt='';try{dt=new Date(r.created_at).toLocaleString('it-IT')}catch(e){}var st=stageLabel(r.payment_stage||'balance');var extra=Number(r.due_amount||0)>0?(' · Da saldare '+euro(r.due_amount)):' · Saldato';if(r.invoice_requested)extra+=' · Fattura';return '<div class="optykerCashSaleRow"><div class="optykerCashSaleTop"><div class="optykerCashSaleName">'+esc(r.shopify_order_name||'Vendita')+'</div><div class="optykerCashSaleAmount">'+esc(euro(r.total))+'</div></div><div class="optykerCashSaleMeta">'+esc(dt+' · '+st+' · '+(r.payment_method||'')+extra)+'</div></div>'}).join('')
  }).catch(function(e){E('optykerCashSaleList').innerHTML='<div class="optykerCashEmpty">Errore: '+esc(e.message)+'</div>'})
}
window.openOptykerCash=function(clientId){openCash(clientId||'')};
function keepCashOpen(){
  if(!S.cashOpen)return;
  ensureUI();
  var o=E('optykerCashOverlay');
  if(o){
    o.classList.add('open');
    o.style.setProperty('display','flex','important');
    o.style.setProperty('visibility','visible','important');
    o.style.setProperty('opacity','1','important');
    o.style.setProperty('pointer-events','auto','important');
  }
  if(document.body)document.body.style.overflow='hidden';
}
function tick(){
  installTop();installClient();
  keepCashOpen();
}
function installCashObserver(){
  if(window.__optykerCashObserverInstalled)return;
  window.__optykerCashObserverInstalled=true;
  var pending=false;
  var repair=function(){
    if(pending)return;pending=true;
    setTimeout(function(){pending=false;tick()},25);
  };
  try{
    var mo=new MutationObserver(function(){repair()});
    mo.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['class','style','hidden']});
    window.__optykerCashObserver=mo;
  }catch(e){}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){tick();installCashObserver()});else{tick();installCashObserver()}
setInterval(tick,250);
})();
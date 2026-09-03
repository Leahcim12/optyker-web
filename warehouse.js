(function(){
if(window.__optykerWarehouseLoaded)return;window.__optykerWarehouseLoaded=true;
window.OPTYKER_WAREHOUSE_BUILD='20260903-services-vat1';
var API='https://whgziwaegjzqsgcntesr.supabase.co/functions/v1/optyker-inventory-api';
var CATS={
  frames:'Montature da vista',
  sunglasses:'Occhiali da sole',
  contact_lenses:'Lenti a contatto per diottria',
  supplements:'Integratori',
  accessories:'Accessori',
  services:'Servizi'
};
var VAT_CODES={
  '04':'04 - IVA Agevolata',
  '10':'10 - IVA 10%',
  '22':'22 - IVA Default',
  'ART10':'ART10 - Esente IVA - Art.10',
  'ART15':'ART15 - Esclusa IVA - Art.15',
  'NV':'NV - No Vendite'
};
function vatLabel(v){return VAT_CODES[String(v||'22').toUpperCase()]||VAT_CODES['22']}
function vatOptions(v){var cur=String(v||'22').toUpperCase();return Object.keys(VAT_CODES).map(function(k){return '<option value="'+k+'"'+(k===cur?' selected':'')+'>'+esc(VAT_CODES[k])+'</option>'}).join('')}
var W={category:'frames',rows:[],count:0,page:1,limit:120,companies:[],loading:false,syncing:false,search:'',firstOpen:true,lastAutoSync:0,canViewCost:false,selected:new Set()};

function E(id){return document.getElementById(id)}
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function euro(v){try{return new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR'}).format(Number(v||0))}catch(e){return Number(v||0).toFixed(2)+' €'}}
function date(v){if(!v)return '—';try{return new Date(String(v).length===10?v+'T12:00:00':v).toLocaleDateString('it-IT')}catch(e){return String(v)}}
function creds(){var c=window.OPTYKER_CLOUD||{};return {username:String(c.username||window.OPTYKER_ACTIVE_USER||'').trim(),password:String(c.password||'')}}
function api(action,payload){
  var c=creds();if(!c.username||!c.password)return Promise.reject(new Error('Sessione operatore non disponibile. Esci e accedi nuovamente.'));
  return fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:action,username:c.username,password:c.password,payload:payload||{}})})
    .then(function(r){return r.json().catch(function(){return {}}).then(function(x){if(!r.ok||!x||x.ok===false)throw new Error(x&&x.error||('HTTP '+r.status));return x})})
}
function toast(m,t){
  var x=E('whToast');if(!x){x=document.createElement('div');x.id='whToast';x.className='whToast';document.body.appendChild(x)}
  x.className='whToast '+(t||'');x.textContent=m;x.style.display='block';clearTimeout(x.__tm);x.__tm=setTimeout(function(){x.style.display='none'},4200)
}
function categoryLabel(k){return CATS[k]||k||'Magazzino'}
function companyName(r){var c=r&&r.optyker_inventory_companies;return c&&c.name?String(c.name):''}
function optionText(r){
  var inf=r&&r.infinite_options||{},parts=[];
  var vo=Array.isArray(inf.variant_options)?inf.variant_options:[];
  vo.forEach(function(x){if(x&&x.value)parts.push((x.name?x.name+': ':'')+x.value)});
  if(!parts.length&&r.variant_title&&r.variant_title!=='Default Title')parts.push(r.variant_title);
  return parts.slice(0,5).join(' · ')
}
function hasInfinite(r){var m=r&&r.infinite_options&&Array.isArray(r.infinite_options.metafields)?r.infinite_options.metafields:[];return m.length>0}
function expiryClass(v){
  if(!v)return '';var d=new Date(v+'T12:00:00').getTime(),now=Date.now(),days=(d-now)/86400000;
  if(days<0)return 'expired';if(days<90)return 'soon';return ''
}
function isMichaelUser(){return /^michael(?:\s+mologni)?$/i.test(String(creds().username||'').trim())}
function lotGroups(r){
  var a=Array.isArray(r&&r.lots)?r.lots:[],m={},loaded=0;
  a.forEach(function(x){
    var q=Math.max(0,Math.trunc(Number(x.quantity||0)));if(!q)return;loaded+=q;
    var lot=String(x.lot_number||'').trim()||'Senza lotto',exp=String(x.expiry_date||'');
    var k=lot+'|'+exp;if(!m[k])m[k]={lot:lot,expiry:exp,quantity:0};m[k].quantity+=q
  });
  var rest=Math.max(0,Math.trunc(Number(r&&r.inventory_quantity||0))-loaded);
  if(rest>0){var k='Senza lotto|';if(!m[k])m[k]={lot:'Senza lotto',expiry:'',quantity:0};m[k].quantity+=rest}
  return Object.keys(m).map(function(k){return m[k]}).sort(function(a,b){return String(a.expiry||'9999').localeCompare(String(b.expiry||'9999'))||String(a.lot).localeCompare(String(b.lot),'it')})
}
function lotsHtml(r){
  var a=lotGroups(r);if(!a.length)return '<div class="whLotEmpty">Nessun lotto</div>';
  return '<div class="whLots">'+a.map(function(x){return '<div class="whLotRow"><div><b>'+esc(x.lot)+'</b>'+(x.expiry?'<span>Scad. '+esc(date(x.expiry))+'</span>':'')+'</div><strong>'+esc(x.quantity)+'</strong></div>'}).join('')+'</div>'
}

function installNav(){
  if(window.OPTYKER_BILLING_ADMIN||E('navWarehouseGroup'))return;
  var nav=E('moduleNav'),lab=E('navLaboratory');if(!nav||!lab)return;
  var g=document.createElement('div');g.id='navWarehouseGroup';
  var sub='';
  Object.keys(CATS).forEach(function(k){sub+='<button type="button" data-wh-cat="'+esc(k)+'">'+esc(CATS[k])+'</button>'});
  g.innerHTML='<button id="navWarehouse" class="moduleBtn" type="button"><span>Magazzino</span><span style="margin-left:auto">⌄</span></button><div id="navWarehouseSub">'+sub+'</div>';
  if(lab.parentNode)lab.parentNode.insertBefore(g,lab.nextSibling);else nav.appendChild(g);
  E('navWarehouse').onclick=function(){g.classList.toggle('open');if(!E('warehousePanel')||E('warehousePanel').style.display==='none')openWarehouse(W.category||'frames')};
  var bs=g.querySelectorAll('[data-wh-cat]');for(var i=0;i<bs.length;i++)bs[i].onclick=function(){openWarehouse(this.getAttribute('data-wh-cat')||'frames')};
}
function installPanel(){
  if(E('warehousePanel'))return;
  var p=document.createElement('div');p.id='warehousePanel';p.className='panel';
  p.innerHTML='<div class="whHead"><div><div class="whEyebrow">Optyker · Magazzino</div><div id="whTitle" class="whTitle">Magazzino</div><div class="whSub">Prodotti, giacenze controllate da Optyker, barcode, lotti, scadenze e ditte.</div></div>'+
    '<div class="whHeadActions"><button id="whCompaniesBtn" class="whBtn" type="button">Ditte / fornitori</button><button id="whNewBtn" class="whBtn" type="button">+ Inserisci prodotto</button><button id="whSyncBtn" class="whBtn primary" type="button">Sincronizza Shopify</button></div></div>'+
    '<div class="whStats"><div class="whStat"><b id="whCount">0</b><span>Prodotti / varianti</span></div><div class="whStat"><b id="whStockTotal">0</b><span>Giacenza nella pagina</span></div><div class="whStat"><b id="whExpirySoon">0</b><span>Scadenze entro 90 gg</span></div><div class="whStat"><b id="whNoImage">0</b><span>Senza immagine</span></div></div>'+
    '<div class="whToolbar"><input id="whSearch" type="search" placeholder="Cerca prodotto, diottria, Infinite Options, SKU, barcode o lotto…"><select id="whCategory"></select><select id="whRows"><option value="60">60 righe</option><option value="120" selected>120 righe</option><option value="250">250 righe</option></select><button id="whApply" class="whBtn" type="button">Applica</button></div>'+
    '<div id="whBulkBar" class="whBulkBar"><div><b id="whBulkCount">0 selezionati</b><span>Seleziona più prodotti per modificarli insieme.</span></div><div class="whBulkActions"><button id="whBulkClear" class="whBtn" type="button">Deseleziona</button><button id="whBulkCategory" class="whBtn primary" type="button" disabled>CAMBIA CATEGORIA</button></div></div>'+
    '<div id="whSyncInfo" class="whSyncInfo">La giacenza si aggiorna esclusivamente con CARICA e DIFFERENZA MAGAZZINO. Optyker aggiorna Shopify con la quantità impostata qui.</div>'+
    '<div id="whTableWrap" class="whTableWrap"><div class="whLoading">Caricamento magazzino…</div></div><div id="whPager" class="whPager"></div>';
  var a=E('labOrdersPanel')||E('onlineOrdersPanel')||E('clientsPanel')||document.querySelector('.panel');
  if(a&&a.parentNode)a.parentNode.insertBefore(p,a.nextSibling);else (E('mainApp')||document.body).appendChild(p);
  var cat=E('whCategory'),h='';Object.keys(CATS).forEach(function(k){h+='<option value="'+k+'">'+esc(CATS[k])+'</option>'});cat.innerHTML=h;
  E('whSearch').onkeydown=function(ev){if(ev.key==='Enter'){ev.preventDefault();W.search=this.value||'';W.page=1;loadItems()}};
  E('whApply').onclick=function(){W.search=E('whSearch').value||'';W.category=E('whCategory').value||W.category;W.limit=Number(E('whRows').value||120);W.page=1;setNavActive();loadItems()};
  E('whCategory').onchange=function(){W.category=this.value||'frames';W.page=1;setNavActive();loadItems()};
  E('whRows').onchange=function(){W.limit=Number(this.value||120);W.page=1;loadItems()};
  E('whSyncBtn').onclick=function(){syncShopify(false,true)};E('whNewBtn').onclick=function(){openItemModal(null)};E('whCompaniesBtn').onclick=openCompanies;
  E('whBulkClear').onclick=function(){W.selected.clear();render();updateBulkBar()};
  E('whBulkCategory').onclick=openBulkCategoryModal;
}
function hideOther(){
  var ids=['dashboardPanel','analysisPanel','prescriptionPanel','visualExamPanel','indicationsPanel','hearingPanel','clientsPanel','lacPanel','onlineOrdersPanel','labOrdersPanel','optykerDdtPanel','optykerCustomerInvoicesPanel','eyewearPanel'];
  ids.forEach(function(id){var x=E(id);if(x)x.style.display='none'});
  var r=E('reportSectionTop');if(r)r.style.display='none';var t=E('analysisTabs');if(t)t.style.display='none';
}
function hideWarehouse(){var p=E('warehousePanel');if(p)p.style.display='none';var n=E('navWarehouse');if(n)n.classList.remove('active')}
function setNavActive(){
  var g=E('navWarehouseGroup');if(g)g.classList.add('open');var n=E('navWarehouse');if(n)n.className='moduleBtn active';
  var bs=document.querySelectorAll('#navWarehouseSub [data-wh-cat]');for(var i=0;i<bs.length;i++)bs[i].classList.toggle('active',bs[i].getAttribute('data-wh-cat')===W.category);
  if(E('whCategory'))E('whCategory').value=W.category;if(E('whTitle'))E('whTitle').textContent='Magazzino · '+categoryLabel(W.category)
}
function openWarehouse(cat){
  W.category=cat&&CATS[cat]?cat:(W.category||'frames');installPanel();hideOther();var p=E('warehousePanel');if(p)p.style.display='block';setNavActive();
  if(E('whCategory'))E('whCategory').value=W.category;
  loadCompanies().finally(function(){loadItems(false).finally(function(){autoSyncShopify(true)})});
  try{window.scrollTo(0,0)}catch(e){}
}
window.openWarehouse=openWarehouse;

function loadCompanies(){
  return api('companies',{}).then(function(x){W.companies=Array.isArray(x.data)?x.data:[];return W.companies}).catch(function(){W.companies=[];return []})
}
function loadItems(autoSync){
  if(W.loading)return;W.loading=true;var box=E('whTableWrap');if(box)box.innerHTML='<div class="whLoading">Caricamento '+esc(categoryLabel(W.category))+'…</div>';
  return api('list',{category:W.category,search:W.search,page:W.page,limit:W.limit}).then(function(x){
    var d=x.data||{},rows=Array.isArray(d.rows)?d.rows:[];W.rows=rows;W.count=Number(d.count||0);W.page=Number(d.page||W.page);W.limit=Number(d.limit||W.limit);W.canViewCost=!!d.can_view_confidential_cost||isMichaelUser();
    render();
    if(autoSync&&W.firstOpen&&W.count===0){W.firstOpen=false;W.loading=false;return syncShopify()}
    W.firstOpen=false;
  }).catch(function(e){if(box)box.innerHTML='<div class="whEmpty">Impossibile caricare il magazzino: '+esc(e.message)+'</div>'}).finally(function(){W.loading=false})
}
function updateBulkBar(){
  var n=W.selected.size,b=E('whBulkBar'),c=E('whBulkCount'),btn=E('whBulkCategory');
  if(c)c.textContent=n+' selezionat'+(n===1?'o':'i');
  if(btn)btn.disabled=n===0;
  if(b)b.classList.toggle('active',n>0)
}
function toggleRowSelection(id,checked){
  id=String(id||'');if(!id)return;
  if(checked)W.selected.add(id);else W.selected.delete(id);
  updateBulkBar()
}
function openBulkCategoryModal(){
  if(!W.selected.size)return;
  var opts=Object.keys(CATS).map(function(k){return '<option value="'+esc(k)+'">'+esc(CATS[k])+'</option>'}).join('');
  var body='<div class="whBulkModalIntro"><b>'+W.selected.size+' prodotti selezionati</b><span>Scegli la nuova categoria da applicare a tutti.</span></div><div class="whForm whDiffForm"><div class="whField wide"><label>Nuova categoria</label><select id="whBulkCategorySelect">'+opts+'</select></div></div><div class="whFormFooter"><span></span><div class="whFormFooterRight"><button id="whBulkCancel" class="whBtn" type="button">Annulla</button><button id="whBulkSave" class="whBtn primary" type="button">CAMBIA CATEGORIA</button></div></div>';
  var m=modalShell('whBulkCategoryModal','Cambia categoria','La categoria verrà modificata per tutti i prodotti selezionati.',body);
  if(E('whBulkCategorySelect'))E('whBulkCategorySelect').value=W.category||'frames';
  E('whBulkCancel').onclick=function(){m.classList.remove('open')};
  E('whBulkSave').onclick=function(){
    var category=E('whBulkCategorySelect').value,ids=Array.from(W.selected),b=E('whBulkSave');
    if(!ids.length)return;
    b.disabled=true;b.textContent='Aggiornamento…';
    api('bulk_change_category',{ids:ids,category:category}).then(function(x){
      var n=Number(x&&x.data&&x.data.updated||ids.length);
      toast(n+' prodotti spostati in '+categoryLabel(category),'ok');
      W.selected.clear();m.classList.remove('open');W.page=1;return loadItems()
    }).catch(function(e){toast('Cambio categoria non riuscito: '+e.message,'error')}).finally(function(){b.disabled=false;b.textContent='CAMBIA CATEGORIA'})
  }
}

function renderServices(box){
  var visibleIds=W.rows.map(function(r){return String(r.id||'')});
  var allSelected=visibleIds.length>0&&visibleIds.every(function(id){return W.selected.has(id)});
  var h='<table class="whTable whServiceTable"><thead><tr><th class="whSelectCol"><input id="whSelectAll" class="whCheck" type="checkbox" '+(allSelected?'checked':'')+' aria-label="Seleziona tutti i servizi visibili"></th><th>Nome servizio</th><th>Costo</th><th>IVA</th><th>Azioni</th></tr></thead><tbody>';
  W.rows.forEach(function(r){
    h+='<tr class="'+(W.selected.has(String(r.id))?'whRowSelected':'')+'">'+
      '<td class="whSelectCol"><input class="whCheck" data-select="'+esc(r.id)+'" type="checkbox" '+(W.selected.has(String(r.id))?'checked':'')+' aria-label="Seleziona servizio"></td>'+
      '<td><div class="whServiceName">'+esc(r.title||'Servizio')+'</div></td>'+
      '<td><div class="whServicePrice">'+esc(euro(r.price))+'</div></td>'+
      '<td><div class="whVatBadge">'+esc(vatLabel(r.vat_code))+'</div></td>'+
      '<td><div class="whActions whServiceActions"><button class="whIconBtn" data-edit="'+esc(r.id)+'" type="button">Mod.</button></div></td>'+
      '</tr>'
  });
  box.innerHTML=h+'</tbody></table>';
  var all=E('whSelectAll');if(all)all.onchange=function(){var checked=this.checked;W.rows.forEach(function(r){var id=String(r.id||'');if(!id)return;if(checked)W.selected.add(id);else W.selected.delete(id)});render()};
  var sels=box.querySelectorAll('[data-select]');for(var si=0;si<sels.length;si++)sels[si].onchange=function(){toggleRowSelection(this.getAttribute('data-select'),this.checked);var tr=this.closest('tr');if(tr)tr.classList.toggle('whRowSelected',this.checked)};
  var es=box.querySelectorAll('[data-edit]');for(var j=0;j<es.length;j++)es[j].onclick=function(){openItemModal(findRow(this.getAttribute('data-edit')))};
  updateBulkBar();renderPager()
}

function render(){
  var box=E('whTableWrap');if(!box)return;
  E('whCount').textContent=String(W.count);
  var stock=0,soon=0,noimg=0;W.rows.forEach(function(r){stock+=Number(r.inventory_quantity||0);var la=lotGroups(r);if(la.some(function(x){return expiryClass(x.expiry)==='soon'}))soon++;if(!r.image_url)noimg++});
  E('whStockTotal').textContent=String(stock);E('whExpirySoon').textContent=String(soon);E('whNoImage').textContent=String(noimg);
  if(!W.rows.length){box.innerHTML='<div class="whEmpty">'+(W.category==='services'?'Nessun servizio inserito.<br>Premi + Inserisci prodotto per creare un servizio.':'Nessun prodotto in questa sezione.<br>Puoi inserire un prodotto e poi caricare la giacenza con il pulsante CARICA.')+'</div>';renderPager();return}
  if(W.category==='services'){renderServices(box);return}
  var costHead=W.canViewCost?'<th>Costo conf.</th>':'';
  var visibleIds=W.rows.map(function(r){return String(r.id||'')});var allSelected=visibleIds.length>0&&visibleIds.every(function(id){return W.selected.has(id)});
  var h='<table class="whTable"><thead><tr><th class="whSelectCol"><input id="whSelectAll" class="whCheck" type="checkbox" '+(allSelected?'checked':'')+' aria-label="Seleziona tutti i prodotti visibili"></th><th>Prodotto</th><th>Diottria / opzioni</th><th>Barcode</th><th>Giacenza</th><th>Prezzo vendita</th>'+costHead+'<th>Lotti / quantità</th><th>Azioni</th></tr></thead><tbody>';
  W.rows.forEach(function(r){
    var opt=optionText(r),src=r.source==='shopify'?'Shopify':'Optyker';
    var costCell=W.canViewCost?'<td><div class="whCostMask" data-cost="'+esc(r.confidential_cost==null?'':r.confidential_cost)+'" title="Tocca per mostrare">••••••</div></td>':'';
    h+='<tr class="'+(W.selected.has(String(r.id))?'whRowSelected':'')+'"><td class="whSelectCol"><input class="whCheck" data-select="'+esc(r.id)+'" type="checkbox" '+(W.selected.has(String(r.id))?'checked':'')+' aria-label="Seleziona prodotto"></td><td><div class="whProductCell"><div class="whImg">'+(r.image_url?'<img src="'+esc(r.image_url)+'" alt="">':'Nessuna<br>immagine')+'</div><div><div class="whName">'+esc(r.title||'Prodotto')+'</div><div class="whVariant">'+esc(r.variant_title&&r.variant_title!=='Default Title'?r.variant_title:'')+(r.sku?' · SKU '+esc(r.sku):'')+'</div><span class="whSource '+(r.source==='shopify'?'shopify':'')+'">'+src+'</span></div></div></td>'+
      '<td><div class="whOptions">'+esc(opt||'—')+'</div>'+(hasInfinite(r)?'<span class="whInfinite">Infinite Options</span>':'')+'</td>'+
      '<td><div class="whBarcode">'+esc(r.barcode||'—')+'</div></td>'+
      '<td><div class="whStock '+(Number(r.inventory_quantity)<0?'neg':'')+'">'+esc(r.inventory_quantity)+'</div><div class="whVariant">Aggiornabile solo dai pulsanti</div></td>'+
      '<td><div class="whPrice">'+esc(euro(r.price))+'</div></td>'+costCell+
      '<td>'+lotsHtml(r)+'</td>'+
      '<td><div class="whActions whActionsStock"><button class="whIconBtn whLoadBtn" data-load="'+esc(r.id)+'" type="button">CARICA</button><button class="whIconBtn whDiffBtn" data-diff="'+esc(r.id)+'" type="button">DIFFERENZA MAGAZZINO</button><button class="whIconBtn" data-edit="'+esc(r.id)+'" type="button">Mod.</button><button class="whIconBtn" data-label="'+esc(r.id)+'" type="button">Etich.</button></div></td></tr>';
  });
  box.innerHTML=h+'</tbody></table>';
  var all=E('whSelectAll');if(all)all.onchange=function(){var checked=this.checked;W.rows.forEach(function(r){var id=String(r.id||'');if(!id)return;if(checked)W.selected.add(id);else W.selected.delete(id)});render()};
  var sels=box.querySelectorAll('[data-select]');for(var si=0;si<sels.length;si++)sels[si].onchange=function(){toggleRowSelection(this.getAttribute('data-select'),this.checked);var tr=this.closest('tr');if(tr)tr.classList.toggle('whRowSelected',this.checked)};
  updateBulkBar();
  if(W.canViewCost){var costs=box.querySelectorAll('.whCostMask');for(var i=0;i<costs.length;i++)costs[i].onclick=function(){var v=this.getAttribute('data-cost');this.classList.toggle('revealed');this.textContent=this.classList.contains('revealed')?(v!==''?euro(v):'—'):'••••••'}}
  var loads=box.querySelectorAll('[data-load]');for(var j=0;j<loads.length;j++)loads[j].onclick=function(){openLoadModal(findRow(this.getAttribute('data-load')))};
  var diffs=box.querySelectorAll('[data-diff]');for(j=0;j<diffs.length;j++)diffs[j].onclick=function(){openDifferenceModal(findRow(this.getAttribute('data-diff')))};
  var es=box.querySelectorAll('[data-edit]');for(j=0;j<es.length;j++)es[j].onclick=function(){openItemModal(findRow(this.getAttribute('data-edit')))};
  var ls=box.querySelectorAll('[data-label]');for(j=0;j<ls.length;j++)ls[j].onclick=function(){printLabel(findRow(this.getAttribute('data-label')))};
  renderPager()
}
function renderPager(){
  var p=E('whPager');if(!p)return;var pages=Math.max(1,Math.ceil(W.count/W.limit));
  p.innerHTML='<button id="whPrev" type="button"'+(W.page<=1?' disabled':'')+'>← Precedente</button><span>Pagina '+W.page+' di '+pages+' · '+W.count+' risultati</span><button id="whNext" type="button"'+(W.page>=pages?' disabled':'')+'>Successiva →</button>';
  E('whPrev').onclick=function(){if(W.page>1){W.page--;loadItems()}};E('whNext').onclick=function(){if(W.page<pages){W.page++;loadItems()}}
}
function findRow(id){for(var i=0;i<W.rows.length;i++)if(String(W.rows[i].id)===String(id))return W.rows[i];return null}

function syncShopify(quiet,force){
  if(W.syncing)return Promise.resolve();W.syncing=true;var b=E('whSyncBtn');if(b){b.disabled=true;b.textContent='Sincronizzazione…'}var info=E('whSyncInfo');
  if(info&&!quiet)info.textContent='Sincronizzazione bidirezionale in corso: Optyker ↔ Shopify…';
  return api('sync_shopify',{force:!!force}).then(function(x){
    var d=x.data||{};W.lastAutoSync=Date.now();
    if(!quiet)toast('Shopify sincronizzato · '+Number(d.products_seen||0)+' prodotti aggiornati · '+Number(d.variants_seen||0)+' varianti · '+Number(d.local_pushed||0)+' prodotti pubblicati online · '+Number(d.barcodes_created||0)+' barcode creati','ok');
    if(info)info.textContent='Sincronizzato con Shopify · '+new Date().toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'})+' · aggiornamento automatico attivo.';
    W.page=1;return loadItems()
  }).catch(function(e){
    if(!quiet)toast('Sincronizzazione non riuscita: '+e.message,'error');
    if(info)info.textContent='Sincronizzazione automatica Shopify temporaneamente non disponibile: '+e.message
  }).finally(function(){W.syncing=false;if(b){b.disabled=false;b.textContent='Sincronizza ora'}})
}
function autoSyncShopify(immediate){
  var p=E('warehousePanel');if(!p||p.style.display==='none')return;
  if(W.syncing)return;
  if(!immediate&&Date.now()-Number(W.lastAutoSync||0)<55000)return;
  syncShopify(true,false)
}
window.syncWarehouseShopify=function(){return syncShopify(false,true)};


function modalShell(id,title,sub,body){
  var m=E(id);if(!m){m=document.createElement('div');m.id=id;m.className='whModal';document.body.appendChild(m)}
  m.innerHTML='<div class="whModalCard"><div class="whModalHead"><div><div class="whModalTitle">'+esc(title)+'</div><div class="whModalSub">'+esc(sub||'')+'</div></div><button class="whModalClose" type="button">×</button></div>'+body+'</div>';
  m.classList.add('open');m.querySelector('.whModalClose').onclick=function(){m.classList.remove('open')};m.onclick=function(ev){if(ev.target===m)m.classList.remove('open')};return m
}
function companyOptions(selected){
  var h='<option value="">Nessuna ditta</option>';W.companies.forEach(function(c){h+='<option value="'+esc(c.id)+'"'+(String(selected||'')===String(c.id)?' selected':'')+'>'+esc(c.name)+'</option>'});return h
}
function field(id,label,value,type,cls){
  return '<div class="whField '+(cls||'')+'"><label>'+esc(label)+'</label><input id="'+id+'" type="'+(type||'text')+'" value="'+esc(value==null?'':value)+'"></div>'
}
function openServiceModal(r){
  r=r||{};var editing=!!r.id;
  var body='<div class="whServiceForm">'+
    '<div class="whField wide"><label>Nome servizio</label><input id="whsTitle" type="text" value="'+esc(r.title||'')+'" autocomplete="off"></div>'+
    '<div class="whField"><label>Costo</label><input id="whsPrice" type="number" min="0" step="0.01" inputmode="decimal" value="'+esc(r.price==null?'':r.price)+'"></div>'+
    '<div class="whField"><label>IVA</label><select id="whsVat">'+vatOptions(r.vat_code||'22')+'</select></div>'+
    '</div>'+
    '<div class="whServiceHint">Il servizio non usa giacenza, lotti, scadenze o DDT.</div>'+
    '<div class="whFormFooter"><span></span><div class="whFormFooterRight"><button id="whsCancel" class="whBtn" type="button">Annulla</button><button id="whsSave" class="whBtn primary" type="button">'+(editing?'Salva modifiche':'Inserisci servizio')+'</button></div></div>';
  var m=modalShell('whServiceModal',editing?'Modifica servizio':'Inserisci servizio',editing?'Modifica nome, costo e IVA del servizio.':'Inserisci nome, costo e IVA come nel gestionale fiscale.',body);
  E('whsCancel').onclick=function(){m.classList.remove('open')};
  E('whsSave').onclick=function(){saveServiceItem(r,m)}
}
function saveServiceItem(old,m){
  var title=String(E('whsTitle').value||'').trim(),price=Number(E('whsPrice').value||0),vat=String(E('whsVat').value||'22');
  if(!title){toast('Inserisci il nome del servizio.','error');return}
  if(!isFinite(price)||price<0){toast('Inserisci un costo valido.','error');return}
  var payload={id:old.id||'',category:'services',title:title,price:price,vat_code:vat,variant_title:'',vendor:'',product_type:'Servizio',sku:'',barcode:'',notes:'',image_url:'',image_data:''};
  var b=E('whsSave');b.disabled=true;b.textContent='Salvataggio…';
  api(old.id?'update_item':'create_item',payload).then(function(){
    toast(old.id?'Servizio aggiornato':'Servizio inserito','ok');m.classList.remove('open');W.category='services';W.page=1;setNavActive();return loadItems()
  }).catch(function(e){toast('Salvataggio non riuscito: '+e.message,'error')}).finally(function(){b.disabled=false;b.textContent=old.id?'Salva modifiche':'Inserisci servizio'})
}

function openItemModal(r){
  r=r||{};
  if((r.category||W.category)==='services'){openServiceModal(r);return}
  var editing=!!r.id;
  var body='<div class="whForm">'+
    field('whfTitle','Nome prodotto',r.title||'','text','two')+
    '<div class="whField"><label>Categoria</label><select id="whfCategory">'+Object.keys(CATS).map(function(k){return '<option value="'+k+'"'+((r.category||W.category)===k?' selected':'')+'>'+esc(CATS[k])+'</option>'}).join('')+'</select></div>'+
    field('whfVariant','Variante / diottria',r.variant_title&&r.variant_title!=='Default Title'?r.variant_title:'')+
    field('whfVendor','Ditta / marca commerciale',r.vendor||'')+
    field('whfType','Tipo prodotto',r.product_type||'')+
    field('whfSku','SKU',r.sku||'')+
    field('whfBarcode','Barcode',r.barcode||'')+
    field('whfPrice','Prezzo vendita',r.price==null?0:r.price,'number')+
    '<div class="whField wide"><div class="whStockLocked"><b>Giacenza: '+esc(r.inventory_quantity==null?0:r.inventory_quantity)+'</b><span>La quantità non si modifica da questa schermata. Usa CARICA oppure DIFFERENZA MAGAZZINO.</span></div></div>'+
    '<div class="whField wide"><label>Immagine prodotto</label><input id="whfImage" type="file" accept="image/*"><div id="whfImagePreview" class="whImagePreview">'+(r.image_url?'<img src="'+esc(r.image_url)+'" alt="">':'Carica una foto oppure verrà usata quella Shopify')+'</div></div>'+
    '<div class="whField wide"><label>Note</label><textarea id="whfNotes">'+esc(r.notes||'')+'</textarea></div>'+
    '<div class="whField wide"><div class="whSecretNote"><b>Giacenza protetta:</b> i salvataggi del prodotto non possono cambiare la quantità in magazzino.</div></div>'+
    '</div><div class="whFormFooter"><button id="whfCompanies" class="whBtn" type="button">Gestisci ditte</button><div class="whFormFooterRight"><button id="whfCancel" class="whBtn" type="button">Annulla</button><button id="whfSave" class="whBtn primary" type="button">'+(editing?'Salva modifiche':'Inserisci prodotto')+'</button></div></div>';
  var m=modalShell('whItemModal',editing?'Modifica prodotto':'Inserisci prodotto',editing?'Modifica i dati anagrafici del prodotto. La giacenza resta invariata.':'Il prodotto nasce con giacenza 0. Dopo il salvataggio usa CARICA per inserire la merce.',body);
  E('whfCancel').onclick=function(){m.classList.remove('open')};E('whfCompanies').onclick=function(){openCompanies()};
  if(!editing&&E('whfCategory'))E('whfCategory').onchange=function(){if(this.value==='services'){var temp={category:'services',title:E('whfTitle').value||'',price:E('whfPrice').value||''};m.classList.remove('open');openServiceModal(temp)}};
  E('whfImage').onchange=function(ev){var file=ev.target.files&&ev.target.files[0];if(!file)return;readImage(file).then(function(data){m.__imageData=data;E('whfImagePreview').innerHTML='<img src="'+data+'" alt="">' }).catch(function(e){toast(e.message,'error')})};
  E('whfSave').onclick=function(){saveItem(r,m)}
}
function readImage(file){
  return new Promise(function(resolve,reject){if(!file||!/^image\//.test(file.type||'')){reject(new Error('Seleziona un’immagine'));return}if(file.size>5*1024*1024){reject(new Error('Immagine troppo grande (max 5 MB)'));return}var rd=new FileReader();rd.onerror=function(){reject(new Error('Impossibile leggere l’immagine'))};rd.onload=function(){resolve(String(rd.result||''))};rd.readAsDataURL(file)})
}
function saveItem(old,m){
  var payload={
    id:old.id||'',category:E('whfCategory').value,title:E('whfTitle').value,variant_title:E('whfVariant').value,vendor:E('whfVendor').value,product_type:E('whfType').value,
    sku:E('whfSku').value,barcode:E('whfBarcode').value,price:Number(E('whfPrice').value||0),notes:E('whfNotes').value,image_data:m.__imageData||'',image_url:old.image_url||''
  };
  if(!String(payload.title||'').trim()){toast('Inserisci il nome del prodotto.','error');return}
  var b=E('whfSave');b.disabled=true;b.textContent='Salvataggio…';
  api(old.id?'update_item':'create_item',payload).then(function(){toast(old.id?'Prodotto aggiornato':'Prodotto inserito con giacenza 0','ok');m.classList.remove('open');W.category=payload.category;W.page=1;setNavActive();return loadItems()}).catch(function(e){toast('Salvataggio non riuscito: '+e.message,'error')}).finally(function(){b.disabled=false;b.textContent=old.id?'Salva modifiche':'Inserisci prodotto'})
}

function openLoadModal(r){
  if(!r)return;
  var costField=W.canViewCost?field('whlCost','Prezzo confidenziale unitario',r.confidential_cost==null?'':r.confidential_cost,'number'):'';
  var body='<div class="whLoadProduct"><b>'+esc(r.title||'Prodotto')+'</b><span>Giacenza attuale: '+esc(r.inventory_quantity||0)+'</span></div><div class="whForm">'+
    field('whlQty','Quantità da caricare','','number')+
    field('whlLot','Lotto','')+
    field('whlExpiry','Data di scadenza','','date')+
    field('whlDdt','Numero DDT','')+
    field('whlDdtDate','Data DDT','','date')+
    field('whlPrice','Prezzo di vendita',r.price==null?0:r.price,'number')+
    costField+
    '<div class="whField"><label>Ditta / fornitore</label><select id="whlCompany">'+companyOptions(r.company_id)+'</select></div>'+
    '<div class="whField wide"><div class="whSecretNote">Numero e data DDT vengono salvati nel carico ma non vengono mostrati nella tabella del Magazzino.</div></div>'+
    '</div><div class="whFormFooter"><span></span><div class="whFormFooterRight"><button id="whlCancel" class="whBtn" type="button">Annulla</button><button id="whlSave" class="whBtn primary" type="button">CARICA</button></div></div>';
  var m=modalShell('whLoadModal','CARICA','Aggiungi merce alla giacenza e registra lotto, scadenza e DDT.',body);
  E('whlCancel').onclick=function(){m.classList.remove('open')};
  E('whlSave').onclick=function(){
    var qty=Math.trunc(Number(E('whlQty').value||0));if(qty<=0){toast('Inserisci la quantità da caricare.','error');return}
    var p={id:r.id,quantity:qty,lot_number:E('whlLot').value,expiry_date:E('whlExpiry').value,ddt_reference:E('whlDdt').value,ddt_date:E('whlDdtDate').value,price:E('whlPrice').value,company_id:E('whlCompany').value};
    if(W.canViewCost&&E('whlCost'))p.confidential_cost=E('whlCost').value;
    var b=E('whlSave');b.disabled=true;b.textContent='Caricamento…';
    api('stock_load',p).then(function(){toast('Carico registrato e giacenza aggiornata','ok');m.classList.remove('open');return loadItems()}).catch(function(e){toast('Carico non riuscito: '+e.message,'error')}).finally(function(){b.disabled=false;b.textContent='CARICA'})
  }
}
function openDifferenceModal(r){
  if(!r)return;
  var body='<div class="whLoadProduct"><b>'+esc(r.title||'Prodotto')+'</b><span>Giacenza registrata: '+esc(r.inventory_quantity||0)+'</span></div><div class="whForm whDiffForm">'+
    field('whdQty','Quantità realmente presente',r.inventory_quantity==null?0:r.inventory_quantity,'number','wide')+
    '<div class="whField wide"><div class="whSecretNote">Il valore inserito sostituirà completamente la giacenza attuale. Se necessario verranno riallineate anche le quantità dei lotti.</div></div>'+
    '</div><div class="whFormFooter"><span></span><div class="whFormFooterRight"><button id="whdCancel" class="whBtn" type="button">Annulla</button><button id="whdSave" class="whBtn primary" type="button">SALVA DIFFERENZA</button></div></div>';
  var m=modalShell('whDifferenceModal','DIFFERENZA MAGAZZINO','Inserisci la quantità fisicamente presente: questo dato sostituisce la giacenza.',body);
  E('whdCancel').onclick=function(){m.classList.remove('open')};
  E('whdSave').onclick=function(){
    var q=Math.trunc(Number(E('whdQty').value));if(!isFinite(q)||q<0){toast('Inserisci una quantità valida.','error');return}
    var b=E('whdSave');b.disabled=true;b.textContent='Salvataggio…';
    api('stock_difference',{id:r.id,actual_quantity:q}).then(function(){toast('Giacenza sostituita con '+q,'ok');m.classList.remove('open');return loadItems()}).catch(function(e){toast('Differenza non salvata: '+e.message,'error')}).finally(function(){b.disabled=false;b.textContent='SALVA DIFFERENZA'})
  }
}

function openCompanies(){
  loadCompanies().then(function(){
    var body='<div class="whCompanies"><div><div class="whCompanyList" id="whCompanyList"></div></div><div><div class="whForm">'+
      '<input id="whcId" type="hidden">'+field('whcName','Nome ditta','','text','wide')+field('whcVat','Partita IVA','')+field('whcFiscal','Codice fiscale','')+field('whcEmail','Email','','email')+field('whcPhone','Telefono','','tel')+field('whcAddress','Indirizzo','','text','wide')+
      '<div class="whField wide"><label>Note</label><textarea id="whcNotes"></textarea></div></div><div class="whFormFooter"><button id="whcReset" class="whBtn" type="button">Nuova</button><button id="whcSave" class="whBtn primary" type="button">Salva ditta</button></div></div></div>';
    var m=modalShell('whCompaniesModal','Ditte / fornitori','Le ditte salvate sono disponibili nei prodotti, lotti e DDT del magazzino.',body);
    renderCompanies();E('whcReset').onclick=resetCompanyForm;E('whcSave').onclick=function(){saveCompany(m)}
  })
}
function renderCompanies(){
  var box=E('whCompanyList');if(!box)return;if(!W.companies.length){box.innerHTML='<div class="whEmpty">Nessuna ditta inserita.</div>';return}
  box.innerHTML=W.companies.map(function(c){return '<div class="whCompanyRow"><div><b>'+esc(c.name)+'</b><span>'+esc([c.vat,c.email,c.phone].filter(Boolean).join(' · '))+'</span></div><div class="whCompanyActions"><button class="whIconBtn" data-c-edit="'+esc(c.id)+'" type="button">Mod.</button><button class="whIconBtn" data-c-del="'+esc(c.id)+'" type="button">×</button></div></div>'}).join('');
  var es=box.querySelectorAll('[data-c-edit]');for(var i=0;i<es.length;i++)es[i].onclick=function(){editCompany(this.getAttribute('data-c-edit'))};
  var ds=box.querySelectorAll('[data-c-del]');for(i=0;i<ds.length;i++)ds[i].onclick=function(){deleteCompany(this.getAttribute('data-c-del'))}
}
function editCompany(id){
  var c=W.companies.find(function(x){return String(x.id)===String(id)});if(!c)return;
  E('whcId').value=c.id||'';E('whcName').value=c.name||'';E('whcVat').value=c.vat||'';E('whcFiscal').value=c.fiscal_code||'';E('whcEmail').value=c.email||'';E('whcPhone').value=c.phone||'';E('whcAddress').value=c.address||'';E('whcNotes').value=c.notes||''
}
function resetCompanyForm(){['whcId','whcName','whcVat','whcFiscal','whcEmail','whcPhone','whcAddress','whcNotes'].forEach(function(id){if(E(id))E(id).value=''})}
function saveCompany(m){
  var p={id:E('whcId').value,name:E('whcName').value,vat:E('whcVat').value,fiscal_code:E('whcFiscal').value,email:E('whcEmail').value,phone:E('whcPhone').value,address:E('whcAddress').value,notes:E('whcNotes').value};
  if(!p.name.trim()){toast('Inserisci il nome della ditta.','error');return}
  E('whcSave').disabled=true;api('save_company',p).then(function(){toast('Ditta salvata','ok');resetCompanyForm();return loadCompanies()}).then(renderCompanies).catch(function(e){toast(e.message,'error')}).finally(function(){E('whcSave').disabled=false})
}
function deleteCompany(id){
  if(!confirm('Disattivare questa ditta?'))return;api('delete_company',{id:id}).then(function(){return loadCompanies()}).then(renderCompanies).catch(function(e){toast(e.message,'error')})
}

function ean13Svg(code){
  code=String(code||'').replace(/\D/g,'');if(code.length!==13)return '';
  var L=['0001101','0011001','0010011','0111101','0100011','0110001','0101111','0111011','0110111','0001011'];
  var G=['0100111','0110011','0011011','0100001','0011101','0111001','0000101','0010001','0001001','0010111'];
  var R=['1110010','1100110','1101100','1000010','1011100','1001110','1010000','1000100','1001000','1110100'];
  var P=['LLLLLL','LLGLGG','LLGGLG','LLGGGL','LGLLGG','LGGLLG','LGGGLL','LGLGLG','LGLGGL','LGGLGL'];
  var bits='101',par=P[Number(code[0])];
  for(var i=1;i<=6;i++)bits+=(par[i-1]==='L'?L:G)[Number(code[i])];
  bits+='01010';for(i=7;i<=12;i++)bits+=R[Number(code[i])];bits+='101';
  var w=2,x=10,rects='';for(i=0;i<bits.length;i++)if(bits[i]==='1')rects+='<rect x="'+(x+i*w)+'" y="4" width="'+w+'" height="54"/>';
  return '<svg xmlns="http://www.w3.org/2000/svg" width="210" height="76" viewBox="0 0 210 76"><rect width="210" height="76" fill="white"/><g fill="black">'+rects+'</g><text x="105" y="72" text-anchor="middle" font-family="Arial" font-size="12">'+esc(code)+'</text></svg>'
}
function printLabel(r){
  if(!r)return;var svg=ean13Svg(r.barcode),img=r.image_url?'<img class="prod" src="'+esc(r.image_url)+'" alt="">':'';
  var w=window.open('','_blank','width=520,height=420');if(!w){toast('Il browser ha bloccato la finestra di stampa.','error');return}
  var html='<!doctype html><html><head><meta charset="utf-8"><title>Etichetta</title><style>@page{size:50mm 30mm;margin:0}html,body{margin:0;padding:0;width:50mm;height:30mm;font-family:Arial,sans-serif}body{display:flex;align-items:center;justify-content:center}.label{box-sizing:border-box;width:49mm;height:29mm;padding:2mm;display:grid;grid-template-columns:10mm 1fr;gap:1.5mm;overflow:hidden}.prod{width:10mm;height:10mm;object-fit:contain}.info{min-width:0}.title{font-size:7pt;font-weight:700;line-height:1.1;max-height:6mm;overflow:hidden}.var{font-size:5.5pt;margin-top:1mm;color:#333;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.price{font-size:8pt;font-weight:bold;margin-top:.7mm}.barcode{grid-column:1/-1;display:flex;justify-content:center;transform:scale(.72);transform-origin:center top;height:14mm}.barcode svg{max-width:100%}.plain{grid-column:1/-1;text-align:center;font-family:monospace;font-size:8pt;font-weight:bold;margin-top:3mm}@media print{body{-webkit-print-color-adjust:exact}}</style></head><body><div class="label">'+img+'<div class="info"><div class="title">'+esc(r.title||'Prodotto')+'</div><div class="var">'+esc(r.variant_title&&r.variant_title!=='Default Title'?r.variant_title:'')+'</div><div class="price">'+esc(euro(r.price))+'</div></div>'+(svg?'<div class="barcode">'+svg+'</div>':'<div class="plain">'+esc(r.barcode||'')+'</div>')+'</div><script>window.onload=function(){setTimeout(function(){window.print()},150)}<\/script></body></html>';
  w.document.open();w.document.write(html);w.document.close()
}
window.printWarehouseLabel=printLabel;

function installSettingsCompanyCard(){
  var panels=document.querySelectorAll('.panel');for(var i=0;i<panels.length;i++){
    var p=panels[i],txt=String(p.textContent||'');if(!/impostazioni/i.test(txt)||p.querySelector('#whSettingsCompanies'))continue;
    var d=document.createElement('div');d.id='whSettingsCompanies';d.className='whSettingsCompanyCard';
    d.innerHTML='<h3>Ditte / fornitori</h3><p>Gestisci le ditte utilizzate nel magazzino, nei DDT, nei lotti e nei costi di acquisto.</p><button class="whBtn" type="button">Gestisci ditte</button>';
    d.querySelector('button').onclick=openCompanies;p.appendChild(d)
  }
}
function outsideClick(ev){
  var b=ev.target&&ev.target.closest?ev.target.closest('#moduleNav button'):null;if(!b)return;
  if(b.id==='navWarehouse'||b.closest('#navWarehouseGroup'))return;hideWarehouse()
}
function install(){installNav();installPanel();installSettingsCompanyCard()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
document.addEventListener('click',outsideClick,true);
setInterval(function(){installNav();installPanel();installSettingsCompanyCard()},900);
setInterval(function(){autoSyncShopify(false)},60000);
})();
/* OPTYKER POS5: stock override, zero receipts, delivery and lottery-code UI. */
(function(){
'use strict';
if(window.__optykerPos5Loaded)return;window.__optykerPos5Loaded=true;
var CASH_OLD='https://whgziwaegjzqsgcntesr.supabase.co/functions/v1/optyker-cash-register-api';
var CASH_V2='https://whgziwaegjzqsgcntesr.supabase.co/functions/v1/optyker-cash-register-api-v2';
var FISCAL_OLD='https://whgziwaegjzqsgcntesr.supabase.co/functions/v1/optyker-fiscal-api';
var FISCAL_V2='https://whgziwaegjzqsgcntesr.supabase.co/functions/v1/optyker-fiscal-api-v2';
var VERSION='20260914-pos5',nativeFetch=window.fetch.bind(window),zeroPayments=new Set(),patchedFiscal=false;
function E(id){return document.getElementById(id)}
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function creds(){var c=window.OPTYKER_CLOUD||{};return {username:String(c.username||window.OPTYKER_ACTIVE_USER||'').trim(),password:String(c.password||'')}}
function cashApi(action,payload){var c=creds();return nativeFetch(CASH_V2,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:action,payload:payload||{},username:c.username,password:c.password})}).then(function(r){return r.json().then(function(x){if(!r.ok||x.ok!==true)throw new Error(x.error||'Operazione cassa non disponibile');return x})})}
function fiscalApi(action,payload){var c=creds();return nativeFetch(FISCAL_V2,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:action,payload:payload||{},username:c.username,password:c.password})}).then(function(r){return r.json().then(function(x){if(!r.ok||x.ok!==true)throw new Error(x.error||'Registro fiscale non disponibile');return x})})}
function cleanLottery(v){return String(v||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,8)}
function lotteryCode(){var x=E('optykerCashLotteryCode');return cleanLottery(x&&x.value)}
function notify(text,type){if(typeof window.toast==='function'){window.toast(text,type);return}var x=E('optykerPos5Toast');if(!x){x=document.createElement('div');x.id='optykerPos5Toast';x.style.cssText='position:fixed;right:24px;bottom:24px;z-index:2147483647;background:#172b40;color:#fff;padding:14px 18px;border-radius:12px;box-shadow:0 12px 30px #0003;max-width:420px';document.body.appendChild(x)}x.textContent=text;x.style.display='block';clearTimeout(x.__t);x.__t=setTimeout(function(){x.style.display='none'},5200)}
function modal(id,title,html){var m=E(id);if(!m){m=document.createElement('div');m.id=id;m.className='optykerCashModal';document.body.appendChild(m)}m.innerHTML='<div class="optykerCashModalCard" style="max-width:860px"><div class="optykerCashModalTitle">'+esc(title)+'</div>'+html+'<button class="optykerCashModalClose" type="button">Chiudi</button></div>';m.classList.add('open');var close=function(){m.classList.remove('open')};m.querySelector('.optykerCashModalClose').onclick=close;m.onclick=function(ev){if(ev.target===m)close()};return m}
function showLottery(code,sale){
 var order=sale&&sale.shopify_order_name?(' · '+sale.shopify_order_name):'';
 var m=modal('optykerLotteryModal','Codice lotteria','<div class="optykerPos5LotteryNotice"><p>Vendita registrata'+esc(order)+'.</p><div class="optykerPos5Code">'+esc(code)+'</div><p>Il codice è stato acquisito in Optyker. Per questa vendita il documento commerciale va emesso sulla RCH con il codice lotteria prima della chiusura del documento.</p><p><b>Optyker non invia un comando lotteria non verificato alla RCH:</b> così non rischia di stampare uno scontrino senza partecipazione.</p><button type="button" class="optykerPos5CopyLottery">Copia codice</button></div>');
 var b=m.querySelector('.optykerPos5CopyLottery');b.onclick=function(){navigator.clipboard&&navigator.clipboard.writeText(code).then(function(){notify('Codice lotteria copiato','ok')}).catch(function(){})};
}
function showZeroUpdater(){
 var m=modal('optykerZeroReceiptModal','Scontrino a € 0,00','<div class="optykerPos5ZeroNotice"><p>La vendita a zero è registrata. Per stampare il documento a <b>€ 0,00</b> serve il connettore RCH aggiornato che gestisce la chiusura con sconto totale senza passare in modalità Z.</p><p>L’aggiornamento non cancella gli esiti fiscali in sospeso e non esegue la chiusura giornaliera.</p><p><a class="optykerPos5UpdateRch" href="/rch-connector/Aggiorna-RCH-POS.bat?v='+VERSION+'" download>Aggiorna RCH per scontrino a zero</a></p></div>');
 return m;
}
function parseApiBody(init){try{return JSON.parse(String(init&&init.body||'{}'))}catch(e){return null}}
function cloneInit(init,body){var o={};Object.keys(init||{}).forEach(function(k){o[k]=init[k]});o.body=JSON.stringify(body);return o}
function sameUrl(input,target){var u=typeof input==='string'?input:(input&&input.url)||'';return u===target}
function newResponse(x,r){var h=new Headers(r.headers);h.set('Content-Type','application/json; charset=utf-8');return new Response(JSON.stringify(x),{status:r.status,statusText:r.statusText,headers:h})}
window.fetch=function(input,init){
 var raw=typeof input==='string'?input:(input&&input.url)||'';
 if(raw==='http://127.0.0.1:8765/health'){return nativeFetch(input,init).then(function(r){return r.text().then(function(t){var x;try{x=JSON.parse(t)}catch(e){return new Response(t,{status:r.status,statusText:r.statusText,headers:r.headers})}if(x&&x.version==='1.9-pos'){x.actualVersion=x.version;x.version='1.8-auto-receipt';x.capabilities=x.capabilities||{};x.capabilities.automaticReference=true}return newResponse(x,r)})})}
 var isCash=sameUrl(input,CASH_OLD),isFiscal=sameUrl(input,FISCAL_OLD);if(!isCash&&!isFiscal)return nativeFetch(input,init);
 var body=parseApiBody(init),lot='';
 if(isCash&&body&&body.action==='checkout'){
   lot=lotteryCode();body.payload=body.payload||{};body.payload.lottery_code=lot;
   if(lot)body.payload.auto_receipt=false;
   init=cloneInit(init,body);
 }
 var url=isCash?CASH_V2:FISCAL_V2;
 return nativeFetch(url,init).then(function(r){
   if(!isCash||!body||!['checkout','checkout_status'].includes(body.action))return r;
   return r.text().then(async function(text){
     var x;try{x=JSON.parse(text)}catch(e){return new Response(text,{status:r.status,statusText:r.statusText,headers:r.headers})}
     if(r.ok&&x&&x.ok===true&&x.data){
       var sale=x.data;
       if(body.action==='checkout'){
         if(sale.zero_receipt&&sale.payment&&sale.payment.id){zeroPayments.add(String(sale.payment.id));if(sale.zero_receipt_supported===false){sale.payment=null;showZeroUpdater()}}
         var missing=Array.isArray(sale.missing_items)?sale.missing_items:[];
         if(missing.length){
           var names=missing.slice(0,6).map(function(i){return (i.title||'Articolo')+(Number(i.missing_quantity||0)>1?' × '+i.missing_quantity:'')}).join('\n');
           if(window.confirm('La vendita è stata registrata. Alcuni articoli non sono in giacenza:\n\n'+names+'\n\nVuoi creare adesso la richiesta di ordine?')){
             try{await nativeFetch(CASH_V2,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'order_missing_items',payload:{sale_id:sale.id},username:body.username,password:body.password})}).then(function(rr){return rr.json().then(function(y){if(!rr.ok||y.ok!==true)throw new Error(y.error||'Ordine non creato')})});notify('Richiesta di ordine creata','ok')}catch(err){notify('Vendita salvata, ma richiesta ordine non creata: '+err.message,'error')}
           }
         }
         if(lot&&sale.manual_lottery_required){showLottery(lot,sale);sale.payment=null}
         var f=E('optykerCashLotteryCode');if(f)f.value='';
       }else if(body.action==='checkout_status'){
         var p=sale.payment;if(p&&p.zero_receipt)zeroPayments.add(String(p.id));if(p&&p.manual_lottery_required){showLottery(sale.lottery_code||'',sale.sale);sale.payment=null}
       }
     }
     return newResponse(x,r);
   })
 })
};
function installLottery(){
 var modes=document.querySelector('#optykerCashOverlay .optykerCashPayModes');if(!modes||E('optykerCashLotteryBox'))return;
 var box=document.createElement('div');box.id='optykerCashLotteryBox';box.className='optykerCashLotteryBox';box.innerHTML='<label for="optykerCashLotteryCode">Codice lotteria</label><input id="optykerCashLotteryCode" maxlength="8" autocomplete="off" spellcheck="false" autocapitalize="characters" placeholder="8 caratteri"><small>Facoltativo · solo pagamento elettronico. Non usare insieme alla detrazione con codice fiscale.</small>';
 modes.insertAdjacentElement('afterend',box);var f=E('optykerCashLotteryCode');f.oninput=function(){this.value=cleanLottery(this.value)};
}
function markOutOfStock(){document.querySelectorAll('#optykerCashProducts .optykerCashProductStock').forEach(function(s){var t=String(s.textContent||'');if(/Disp\.\s*-?0\b/.test(t)&&!/DA ORDINARE/.test(t)){s.textContent=t+' · DA ORDINARE';s.closest('.optykerCashProduct')&&s.closest('.optykerCashProduct').classList.add('optykerPos5Out')}})}
function installDelivery(){
 var sec=document.querySelector('#optykerCashOverlay .optykerCashSecondaryActions');if(!sec||E('optykerCashDeliveryBtn'))return;var b=document.createElement('button');b.id='optykerCashDeliveryBtn';b.type='button';b.textContent='Consegna';sec.insertBefore(b,sec.firstChild);b.onclick=openDeliveries;
}
function openDeliveries(){
 var m=modal('optykerDeliveryModal','Consegna','<div class="optykerCashModalSub">Vendite non ancora segnate come consegnate. Se manca un saldo, Optyker apre direttamente il saldo alla consegna.</div><div id="optykerDeliveryList"><div class="optykerCashLoading">Caricamento…</div></div>');
 cashApi('deliveries',{}).then(function(x){var a=Array.isArray(x.data)?x.data:[],box=E('optykerDeliveryList');if(!a.length){box.innerHTML='<div class="optykerCashEmpty">Nessuna consegna aperta.</div>';return}box.innerHTML=a.map(function(r){var c=r.client?(((r.client.surname||'')+' '+(r.client.name||'')).trim()||'Cliente'):'Cliente occasionale',items=(r.items||[]).slice(0,3).map(function(i){return i.title+' × '+i.quantity}).join(' · ');return '<div class="optykerPos5DeliveryRow"><div><b>'+esc(r.shopify_order_name||'Vendita')+' · '+esc(c)+'</b><span>'+esc(items||'Vendita cassa')+'</span></div><div><b>'+esc(new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR'}).format(Number(r.total||0)))+'</b><span>'+(Number(r.due_amount)>0?'Da saldare '+esc(new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR'}).format(Number(r.due_amount))):'Pagato')+'</span></div><button type="button" data-delivery="'+esc(r.id)+'" data-due="'+esc(r.due_amount)+'">'+(Number(r.due_amount)>0?'Saldo e consegna':'Consegna')+'</button></div>'}).join('');box.querySelectorAll('[data-delivery]').forEach(function(b){b.onclick=function(){var id=this.dataset.delivery,due=Number(this.dataset.due||0);if(due>0){m.classList.remove('open');openDeliveryBalance(id);return}this.disabled=true;cashApi('mark_delivery',{sale_id:id}).then(function(){notify('Consegna registrata','ok');openDeliveries()}).catch(function(e){notify(e.message,'error');b.disabled=false})}})}).catch(function(e){E('optykerDeliveryList').innerHTML='<div class="optykerCashEmpty">Errore: '+esc(e.message)+'</div>'})
}
function openDeliveryBalance(saleId){var b=E('optykerCashDepositsBtn');if(!b){notify('Apri Acconti aperti e seleziona Saldo consegna.','error');return}b.click();var tries=0,t=setInterval(function(){tries++;var x=document.querySelector('[data-sale="'+CSS.escape(saleId)+'"][data-settle="delivery_balance"]');if(x){clearInterval(t);x.click()}else if(tries>30){clearInterval(t);notify('Vendita non trovata tra gli acconti aperti.','error')}},100)}
function patchFiscal(){
 if(patchedFiscal||!window.OPTYKER_FISCAL)return;var old=window.OPTYKER_FISCAL,origCheck=old.checkReady,origIssue=old.issuePayment,origOpen=old.openSale;
 var replacement={};Object.keys(old).forEach(function(k){replacement[k]=old[k]});
 replacement.checkReady=function(){if(lotteryCode())return Promise.resolve(true);return origCheck.apply(old,arguments)};
 replacement.issuePayment=function(saleId,paymentId){var args=arguments;if(!zeroPayments.has(String(paymentId)))return origIssue.apply(old,args);return nativeFetch('http://127.0.0.1:8765/health',{cache:'no-store',signal:AbortSignal.timeout(5000)}).then(function(r){return r.json()}).then(function(h){if(!h||h.ok!==true||!h.capabilities||h.capabilities.zeroReceipt!==true){showZeroUpdater();return null}return origIssue.apply(old,args)}).catch(function(){showZeroUpdater();return null})};
 replacement.openSale=function(saleId){return fiscalApi('sale',{sale_id:saleId}).then(function(x){var payments=x.data&&x.data.payments||[],manual=payments.find(function(p){return p.manual_lottery_required}),zero=payments.find(function(p){return Number(p.amount)===0&&p.automatic_receipt});if(manual){showLottery(manual.lottery_code||'',x.data);return}if(zero){zeroPayments.add(String(zero.id));return replacement.issuePayment(saleId,zero.id)}return origOpen.call(old,saleId)}).catch(function(){return origOpen.call(old,saleId)})};
 window.OPTYKER_FISCAL=Object.freeze(replacement);patchedFiscal=true;
}
function fixZeroReference(){var form=document.querySelector('#optykerFiscalModal .ofReference'),amount=form&&form.querySelector('[name=amount]');if(!amount)return;var text=String(E('optykerFiscalModal').textContent||'');if(/Importo:\s*(?:€\s*)?0[,\.]00|€\s*0,00/.test(text)){amount.min='0';amount.value='0';amount.step='0.01'}}
function installCss(){if(E('optykerPos5Css'))return;var s=document.createElement('style');s.id='optykerPos5Css';s.textContent='.optykerCashLotteryBox{margin:12px 0;padding:12px;border:1px solid #d8e0e7;border-radius:14px;display:grid;gap:6px}.optykerCashLotteryBox input{font:inherit;padding:10px 12px;border:1px solid #c8d3dd;border-radius:10px;text-transform:uppercase;letter-spacing:.12em}.optykerCashLotteryBox small{opacity:.7}.optykerPos5Out{outline:2px solid #d9a44155}.optykerPos5Code{font-size:30px;font-weight:800;letter-spacing:.18em;padding:18px;text-align:center;border:1px dashed #8da2b4;border-radius:14px;margin:12px 0}.optykerPos5UpdateRch{display:inline-block;padding:11px 15px;border-radius:10px;background:#173b5f;color:white;text-decoration:none}.optykerPos5DeliveryRow{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:14px;align-items:center;padding:12px;border-bottom:1px solid #e3e8ed}.optykerPos5DeliveryRow div{display:grid;gap:4px}.optykerPos5DeliveryRow span{font-size:12px;opacity:.7}.optykerPos5DeliveryRow button,.optykerPos5CopyLottery{padding:9px 12px;border-radius:9px;border:1px solid #cbd5df;background:#fff;cursor:pointer}@media(max-width:720px){.optykerPos5DeliveryRow{grid-template-columns:1fr}.optykerPos5DeliveryRow button{width:100%}}';document.head.appendChild(s)}
function tick(){installCss();installLottery();installDelivery();markOutOfStock();patchFiscal();fixZeroReference()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',tick);else tick();
new MutationObserver(function(){setTimeout(tick,0)}).observe(document.documentElement,{childList:true,subtree:true});setInterval(tick,1000);
})();

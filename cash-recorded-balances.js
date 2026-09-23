/* OPTYKER_RECORDED_BALANCES_20260921: server-recorded deposits, no price/payment rewrites. */
window.OPTYKER_RECORDED_BALANCES_VERSION='20260921-balance1';
var recordedBalance={seq:0,key:'',requested:'',data:null,loading:false,error:'',timer:0,controller:null,checking:false};
function balanceKey(){return JSON.stringify([String(S.clientId||''),cartRows().map(function(r){return [String(r.item.variant_id),Number(r.qty)]}).sort(function(a,b){return a[0].localeCompare(b[0])})])}
function balanceData(){return recordedBalance.key===balanceKey()?recordedBalance.data:null}
function balanceLine(id){var d=balanceData(),found=null;(d&&d.groups||[]).some(function(g){var l=g.lines.find(function(l){return l.variant_id===String(id)});if(l){found={group:g,line:l};return true}return false});return found}
function balanceFetch(id){
 var c=creds(),ctl=new AbortController();if(recordedBalance.controller)recordedBalance.controller.abort();recordedBalance.controller=ctl;
 var timer,limit=new Promise(function(_,reject){timer=setTimeout(function(){ctl.abort();reject(new Error('Verifica acconti non completata entro 12 secondi.'));},12000)});
 var task=fetch('https://whgziwaegjzqsgcntesr.supabase.co/functions/v1/optyker-cash-register-api-v2',{method:'POST',headers:{'Content-Type':'application/json'},cache:'no-store',signal:ctl.signal,body:JSON.stringify({action:'balance_snapshot',username:c.username,password:c.password,payload:{client_id:id}})}).then(function(r){return r.json().then(function(x){if(!r.ok||!x||x.ok!==true)throw new Error(x&&x.error||'Verifica acconti non disponibile');return x.data})});
 return Promise.race([task,limit]).finally(function(){clearTimeout(timer);if(recordedBalance.controller===ctl)recordedBalance.controller=null});
}
function balanceLoad(){
 clearTimeout(recordedBalance.timer);if(!S.cashOpen)return Promise.resolve(null);
 var id=String(S.clientId||''),key=balanceKey(),seq=++recordedBalance.seq;recordedBalance.requested=key;recordedBalance.loading=true;recordedBalance.error='';balancePaint();
 return balanceFetch(id).then(function(d){
  if(seq!==recordedBalance.seq||key!==balanceKey()||!S.cashOpen)return null;
  if(!d||d.version!=='20260921-balance1'||d.client_id!==id||!Array.isArray(d.groups)||!Array.isArray(d.conflicts)||!Array.isArray(d.blockers))throw new Error('Risposta acconti non coerente con il cliente');
  d.groups.forEach(function(g){if(!g.sale_id||!Array.isArray(g.lines)||!Array.isArray(g.payments)||![g.total_cents,g.paid_cents,g.due_cents].every(function(n){return Number.isSafeInteger(n)&&n>=0})||g.paid_cents+g.due_cents!==g.total_cents)throw new Error('Saldo non valido');g.lines.forEach(function(l){if(!l.variant_id||![l.total_cents,l.paid_cents,l.due_cents].every(function(n){return Number.isSafeInteger(n)&&n>=0})||l.paid_cents+l.due_cents!==l.total_cents)throw new Error('Riga saldo non valida')})});
  recordedBalance.key=key;recordedBalance.data=d;recordedBalance.loading=false;renderCart();return d;
 }).catch(function(e){if(seq===recordedBalance.seq&&key===balanceKey()&&S.cashOpen){recordedBalance.loading=false;recordedBalance.error=String(e.message||e);renderCart()}return null});
}
function balanceQueue(){var key=balanceKey();if(S.cashOpen&&key!==recordedBalance.requested){recordedBalance.requested=key;recordedBalance.loading=true;clearTimeout(recordedBalance.timer);recordedBalance.timer=setTimeout(balanceLoad,100)}}
cartTotal=function(){return Math.round(payableCartRows().reduce(function(n,r){var a=balanceLine(r.item.variant_id);return n+(a?a.line.due_cents/100:Number(r.unitPrice==null?r.item.price:r.unitPrice)*r.qty)},0)*100)/100};
function balanceBlock(){var d=balanceData(),c=balanceChosen(),saleIds=new Set(c.linked.map(function(x){return String(x.group.sale_id||'')}));return d&&d.blockers&&d.blockers.find(function(x){return saleIds.has(String(x.sale_id||''))})}
function balanceChosen(){var linked=[],fresh=[];payableCartRows().forEach(function(r){var a=balanceLine(r.item.variant_id);if(a)linked.push(a);else fresh.push(r)});return {linked:linked,fresh:fresh}}
function balanceOpenReceipt(saleId){if(S.busy)return;var f=window.OPTYKER_FISCAL;if(f&&f.openSale)return f.openSale(saleId);toast('Modulo RCH non disponibile. Apri Ultime vendite.','error')}
function balancePaint(){
 var head=document.querySelector('#optykerCashOverlay .optykerCashCartHead');if(!head)return;
 var box=E('optykerCashRecordedBalance');if(!box){box=document.createElement('section');box.id='optykerCashRecordedBalance';box.setAttribute('aria-label','Acconti registrati e stato scontrini');head.appendChild(box)}
 var d=balanceData(),blocked=balanceBlock(),valid=!!d&&!recordedBalance.loading&&!recordedBalance.error,choice=balanceChosen(),linked=choice.linked,groups=d&&d.groups||[];
 var html='';
 if(recordedBalance.loading||!d&&!recordedBalance.error)html='<p>Verifica acconti già registrati…</p>';
 if(recordedBalance.error)html='<p>Saldo non verificato: '+esc(recordedBalance.error)+'</p><button type="button" data-balance-refresh>Riprova verifica acconti</button>';
 if(d){
  if(blocked)html+='<div class="balanceFiscalAlert" role="alert"><b>Stampa sospesa per questa vendita: esito RCH da verificare'+(blocked.amount_cents!=null?' · '+esc(euro(blocked.amount_cents/100)):'')+'</b><p>La modalità REG non risolve un’emissione con esito incerto. Verifica il documento già registrato prima di un nuovo incasso.</p><button type="button" data-balance-receipt="'+esc(blocked.sale_id)+'">Apri esito scontrino</button> <button type="button" data-balance-refresh>Aggiorna esito</button></div>';
  (d.conflicts||[]).forEach(function(c){html+='<p class="balanceFiscalAlert">'+esc(c.message)+' · usa Acconti aperti / Ultime vendite senza creare un nuovo incasso.</p>'});
  groups.forEach(function(g){
   html+='<div class="recordedBalanceGroup"><span>Prezzo '+esc(euro(g.total_cents/100))+' − già versato '+esc(euro(g.paid_cents/100))+'</span><strong>'+(g.due_cents?'Saldo residuo '+esc(euro(g.due_cents/100)):'Saldato · da consegnare')+'</strong>';
   g.payments.filter(function(p){return p.receipt_state!=='invoice'}).forEach(function(p){var labels={completed:'Scontrino registrato',prepared:'Scontrino da emettere',not_started:'Emissione non avviata',unissued:'Scontrino da verificare',sending:'Emissione da verificare',uncertain:'Esito scontrino incerto',awaiting_reference:'Numero scontrino da verificare',cancelled:'Emissione annullata'};html+='<button type="button" data-balance-receipt="'+esc(g.sale_id)+'">'+esc((labels[p.receipt_state]||'Verifica scontrino')+' · '+euro(p.amount_cents/100))+'</button>'});
   html+='</div>';
  });
  if(groups.length)html+='<small>Il prezzo originario non cambia. L’articolo resta nel carrello fino alla consegna.</small>';
 }
 box.hidden=!html;if(box.dataset.html!==html){box.dataset.html=html;box.innerHTML=html;box.querySelectorAll('[data-balance-refresh]').forEach(function(b){b.onclick=function(){if(!S.busy)balanceLoad()}});box.querySelectorAll('[data-balance-receipt]').forEach(function(b){b.onclick=function(){balanceOpenReceipt(b.dataset.balanceReceipt)}})}
 box.querySelectorAll('button').forEach(function(b){b.disabled=!!S.busy||recordedBalance.checking});
 document.querySelectorAll('#optykerCashCartItems [data-vat]').forEach(function(v){var a=balanceLine(v.dataset.vat),row=v.closest('.optykerCashCartItem');if(!a||!row)return;
  row.querySelectorAll('[data-price],[data-price-reset],[data-vat],[data-minus],[data-plus]').forEach(function(b){b.disabled=true;b.title='Importi della vendita già registrata: usa il saldo, non modificare il prezzo'});
  var holder=row.querySelector('.optykerCashCartItemPrice');if(holder&&!holder.querySelector('.recordedLineBalance')){holder.innerHTML='<div class="recordedLineBalance"><span>Prezzo '+esc(euro(a.line.total_cents/100))+'</span><span>Già versato −'+esc(euro(a.line.paid_cents/100))+'</span><strong>'+esc(euro(a.line.due_cents/100))+'</strong><small>'+(a.line.due_cents?'Da saldare':'Saldato · da consegnare')+'</small></div>'}
 });
 var b=E('optykerCashCheckoutBtn'),total=E('optykerCashTotal');if(!b)return;
 if(!valid||d.conflicts.length||recordedBalance.checking){b.disabled=true;if(total)total.textContent=recordedBalance.error?'Da verificare':recordedBalance.loading?'Verifica acconti…':total.textContent;return}
 if(blocked&&!S.invoice&&S.payment!=='pending'){b.disabled=true;return}
 if(linked.length){
  var ids=new Set(linked.map(function(x){return x.group.sale_id})),g=linked[0].group;
  var whole=ids.size===1&&!choice.fresh.length&&g.lines.every(function(l){return linked.some(function(x){return x.line.variant_id===l.variant_id})});
  b.disabled=!!(S.busy||S.clientCartLoading||S.clientCartError||clientCartHasPending()||!whole||g.due_cents===0||S.stage==='deposit');
  if(total)total.textContent=euro(cartTotal());
  var hint=E('optykerCashBalanceHint');if(!hint){hint=document.createElement('p');hint.id='optykerCashBalanceHint';box.appendChild(hint)}
  hint.textContent=!whole?'Salda una vendita già registrata alla volta, selezionando tutte le sue righe e togliendo la spunta agli altri articoli.':g.due_cents===0?'Già saldato: usa Consegna, non Incassa.':S.stage==='deposit'?'Acconto già registrato. Seleziona Saldo per incassare soltanto il residuo.':'Con Saldo incassi '+euro(g.due_cents/100)+' sulla vendita esistente, non il prezzo originario.';
 }else {var hint=E('optykerCashBalanceHint');if(hint)hint.remove()}
}
var balanceNativeRender=renderCart;
renderCart=function(){balanceQueue();var r=balanceNativeRender.apply(this,arguments);balancePaint();return r};
var balanceNativeApply=applyCheckoutCart;
applyCheckoutCart=function(sale,rows){var r=balanceNativeApply.apply(this,arguments);if(String(sale&&sale.client_id||'')===String(S.clientId||'')){if(Number(sale.due_amount)>0){S.stage='balance';renderStage()}recordedBalance.requested='';balanceQueue()}return r};
var balanceNativeCheckout=checkout;
checkout=async function(){
 if(S.busy||recordedBalance.checking||clientCartHasPending())return;
 recordedBalance.checking=true;var before=balanceKey();balancePaint();
 var d=await balanceLoad();recordedBalance.checking=false;
 if(!d||before!==balanceKey()||!S.cashOpen){balancePaint();return}
 if(d.conflicts.length){toast('Prima verifica gli acconti della vendita esistente.','error');balancePaint();return}
 if(balanceBlock()&&!S.invoice&&S.payment!=='pending'){toast('Uno scontrino ha esito da verificare. Apri esito scontrino: nessun nuovo incasso inviato.','error');balancePaint();return}
 var c=balanceChosen();
 if(c.linked.length){
  var g=c.linked[0].group,whole=!c.fresh.length&&c.linked.every(function(x){return x.group.sale_id===g.sale_id})&&g.lines.every(function(l){return c.linked.some(function(x){return x.line.variant_id===l.variant_id})});
  if(!whole||!g.due_cents||S.stage==='deposit'){balancePaint();return}
  return settleExisting(g.sale_id,S.stage==='delivery_balance'?'delivery_balance':'balance',null);
 }
 return balanceNativeCheckout.apply(this,arguments);
};
var balanceNativeSettle=settleExisting;
settleExisting=function(){var args=arguments;if(S.busy||recordedBalance.checking)return;recordedBalance.checking=true;balancePaint();return balanceLoad().then(function(d){recordedBalance.checking=false;if(!d)return;if(balanceBlock()&&!S.invoice){toast('Verifica prima lo scontrino incerto collegato a questa vendita. Nessun saldo registrato.','error');balancePaint();return}return balanceNativeSettle.apply(null,args)})};
var balanceNativeOpen=openCash;
openCash=function(){recordedBalance.requested='';recordedBalance.key='';recordedBalance.data=null;recordedBalance.error='';var r=balanceNativeOpen.apply(this,arguments);balanceQueue();return r};
var balanceNativeClose=closeCash;
closeCash=function(){var r=balanceNativeClose.apply(this,arguments);if(!S.cashOpen){++recordedBalance.seq;clearTimeout(recordedBalance.timer);if(recordedBalance.controller)recordedBalance.controller.abort();recordedBalance.key='';recordedBalance.requested='';recordedBalance.data=null;recordedBalance.loading=false;recordedBalance.checking=false}return r};
window.addEventListener('focus',function(){if(S.cashOpen&&!S.busy&&!recordedBalance.loading)balanceLoad()});
(function(){var s=document.createElement('style');s.id='optykerRecordedBalanceCss';s.textContent='#optykerCashRecordedBalance{font-size:13px;line-height:1.5;margin-top:12px}#optykerCashRecordedBalance button{padding:8px 11px;border:1px solid #c9d3df;border-radius:7px;background:white;color:#183652;cursor:pointer}#optykerCashRecordedBalance button:disabled{opacity:.55}.recordedBalanceGroup{display:flex;gap:12px;flex-wrap:wrap;align-items:center;padding:12px;margin:7px 0;background:#f2f6fb;border:1px solid #d9e2ed;border-radius:9px}.recordedBalanceGroup strong{font-size:18px}.balanceFiscalAlert{padding:12px;border:1px solid #db9893;background:#fff3f1;border-radius:9px;color:#86291f}.recordedLineBalance{display:grid;gap:5px;min-width:130px;text-align:right}.recordedLineBalance span{font-size:12px;color:#536170}.recordedLineBalance strong{font-size:25px;color:#183652}.recordedLineBalance small{font-size:12px}#optykerFiscalModal.open{z-index:2147483601!important;pointer-events:auto!important}';document.head.appendChild(s)})();

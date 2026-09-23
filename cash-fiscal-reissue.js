/* OPTYKER_FISCAL_REISSUE_20260923: paid receipts after verified voids, never another checkout. */
window.OPTYKER_FISCAL_REISSUE_VERSION='20260923-reissue2';
var receiptReissue={busy:false,message:'',clientId:''};
function receiptReissueCall(url,action,payload){var c=creds(),ctl=new AbortController(),timer=setTimeout(function(){ctl.abort()},20000);return fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},cache:'no-store',signal:ctl.signal,body:JSON.stringify({action:action,username:c.username,password:c.password,payload:payload||{}})}).then(function(r){return r.json().then(function(x){if(!r.ok||x.ok!==true)throw new Error(x.error||'Riemissione non disponibile');return x.data})}).finally(function(){clearTimeout(timer)})}
var receiptReissueBase='https://whgziwaegjzqsgcntesr.supabase.co/functions/v1/';
function receiptReissueApi(action,p){return receiptReissueCall(receiptReissueBase+'optyker-fiscal-api-v2','reissue_'+action,p)}
var receiptReissueNativeFetch=balanceFetch;
balanceFetch=function(id){return Promise.all([receiptReissueNativeFetch(id),id?receiptReissueApi('status',{client_id:id}).catch(function(e){return {error:e.message}}):Promise.resolve({sales:[]})]).then(function(parts){var d=parts[0],r=parts[1];d.receipt_reissues=Array.isArray(r.sales)?r.sales:[];d.receipt_reissue_error=r.error||'';return d})};
function receiptReissuePlans(){var d=balanceData();return d&&d.receipt_reissues||[]}
function receiptReissueLabel(state){return {ready:'Pronto da riemettere',prepared:'Preparato, non stampato',not_started:'Stampa non avviata',completed:'Riemesso e registrato',void_reference:'Riferimento annullo da verificare',sending:'Emissione in corso',uncertain:'Esito emissione da verificare',awaiting_reference:'Numero del nuovo scontrino da verificare',cancelled:'Preparazione annullata'}[state]||'Da verificare'}
var receiptReissueNativePaint=balancePaint;
balancePaint=function(){
 var r=receiptReissueNativePaint.apply(this,arguments),head=document.querySelector('#optykerCashOverlay .optykerCashCartHead');if(!head)return r;
 var box=E('optykerReceiptReissuePanel'),plans=receiptReissuePlans(),d=balanceData();
 if(!box){box=document.createElement('section');box.id='optykerReceiptReissuePanel';box.setAttribute('aria-label','Riemissione scontrini già pagati');head.appendChild(box)}
 var html='';
 if(d&&d.receipt_reissue_error&&cartRows().some(function(x){return !!x.item.fiscal_reissue_sale_id})){html='<p role="alert">Riemissione da verificare: '+esc(d.receipt_reissue_error)+'</p>';}
 if(plans.length){
  html='<div style="padding:14px;border:2px solid #b32937;border-radius:10px;background:#fff8f8"><b>Scontrini annullati · importi già incassati</b><p>Usa Riemetti scontrini. Non viene registrato un nuovo pagamento.</p>';
  plans.forEach(function(g){html+='<div><b>Da riemettere '+esc(euro(g.remaining_cents/100))+' · nuovo incasso 0,00 €</b><p>'+g.payments.map(function(p){return esc(euro(p.amount_cents/100)+' — '+receiptReissueLabel(p.state)+(p.document_number?' · '+p.document_number:''))}).join('<br>')+'</p><button type="button" data-receipt-reissue="'+esc(g.sale_id)+'">'+(g.complete?'Completa e aggiorna carrello':'Riemetti scontrini · '+esc(euro(g.remaining_cents/100)))+'</button> <button type="button" data-receipt-reissue-details="'+esc(g.sale_id)+'">Verifica riferimenti</button></div>'});
  html+='<p role="status" aria-live="polite">'+esc(receiptReissue.clientId===String(S.clientId||'')?receiptReissue.message:'')+'</p><button type="button" data-receipt-reissue-refresh>Aggiorna esito riemissione</button></div>';
  var checkoutButton=E('optykerCashCheckoutBtn');if(checkoutButton){checkoutButton.disabled=true;checkoutButton.textContent='Già pagato · usa Riemetti scontrini'}
 }
 box.hidden=!html;
 if(box.dataset.html!==html){box.dataset.html=html;box.innerHTML=html;
  box.querySelectorAll('[data-receipt-reissue]').forEach(function(b){b.onclick=function(){runReceiptReissue(b.dataset.receiptReissue)}});
  box.querySelectorAll('[data-receipt-reissue-refresh]').forEach(function(b){b.onclick=function(){if(!receiptReissue.busy)balanceLoad()}});
  box.querySelectorAll('[data-receipt-reissue-details]').forEach(function(b){b.onclick=function(){if(!receiptReissue.busy)balanceOpenReceipt(b.dataset.receiptReissueDetails)}});
 }
 box.querySelectorAll('button').forEach(function(b){b.disabled=receiptReissue.busy||!!S.busy});return r;
};
function receiptReissueMessage(message){receiptReissue.message=message;receiptReissue.clientId=String(S.clientId||'');balancePaint()}
async function receiptReissueWait(jobId,commandId){var end=Date.now()+150000;while(Date.now()<end){var data=await receiptReissueCall(receiptReissueBase+'optyker-fiscal-api-v2','job',{job_id:jobId}),j=data&&data.job;if(j&&['completed','awaiting_reference','uncertain','not_started'].indexOf(j.state)>=0)return j;var c=await receiptReissueCall(receiptReissueBase+'optyker-rch-relay-api','command_status',{command_id:commandId});if(c&&['failed','expired'].indexOf(c.state)>=0)throw new Error(c.error||'Il PC cassa non ha avviato la stampa');await new Promise(function(resolve){setTimeout(resolve,1000)})}throw new Error('Attesa terminata. Aggiorna esito riemissione prima di riprovare; nessun secondo pagamento è stato creato.')}
async function runReceiptReissue(saleId){
 if(S.busy||receiptReissue.busy||S.clientCartLoading)return;
 var cid=String(S.clientId||'');if(!cid)return;
 receiptReissue.busy=true;S.busy=true;receiptReissueMessage('Verifica dei documenti originali e degli annulli…');
 var finished=false;
 try{
  clearTimeout(clientCartSaveTimer);await clientCartQueue.catch(function(){});
  var status=await receiptReissueApi('status',{client_id:cid}),g=status.sales.find(function(x){return x.sale_id===saleId});if(!g)throw new Error('La riemissione è cambiata: aggiorna la Cassa');
  if(!g.complete){
   var blocked=g.payments.find(function(p){return ['ready','prepared','not_started','completed'].indexOf(p.state)<0});if(blocked)throw new Error(receiptReissueLabel(blocked.state)+'. Usa Verifica riferimenti; non ripetere l’emissione.');
   var todo=g.payments.filter(function(p){return p.state!=='completed'});
   if(!confirm('Riemettere '+todo.length+' scontrino/i per '+euro(g.remaining_cents/100)+' già incassati, dopo i relativi annulli?\n\nNessun nuovo pagamento e nessun nuovo scarico magazzino.\nConferma soltanto se questi documenti NON sono già stati riemessi con Focus o con un altro programma.'))return;
   var connection=await receiptReissueCall(receiptReissueBase+'optyker-rch-relay-api','status',{}),st=connection.status||{};
   if(!connection.online||st.ok!==true||!/^REG(?:\s*\(OP\s*\d+\))?$/.test(String(st.mode||''))||String(st.idleState)!=='0'||['busy','errorCode','printerError','paperEnd','coverOpen'].some(function(k){return Number(st[k])!==0}))throw new Error('Il PC cassa deve risultare online e la RCH pronta in REG');
   for(var p of todo){
    receiptReissueMessage('Riemissione di '+euro(p.amount_cents/100)+' sul pagamento originale…');
    var prepared=await receiptReissueApi('prepare',{client_id:cid,sale_id:saleId,payment_id:p.payment_id,original_job_id:p.original_job_id,void_job_id:p.void_job_id,confirm_not_already_reissued:true}),job=prepared.job;
    if(prepared.claim_token){var q=await receiptReissueCall(receiptReissueBase+'optyker-rch-relay-api','queue_fiscal',{job_id:job.id,token:prepared.claim_token,operation:'sale'});job=await receiptReissueWait(job.id,q.id)}
    if(job.state!=='completed')throw new Error(receiptReissueLabel(job.state)+' per '+euro(p.amount_cents/100)+'. Non ripetere: usa Verifica riferimenti.');
   }
  }
  await receiptReissueApi('finish',{client_id:cid,sale_id:saleId});finished=true;receiptReissueMessage('Riemissione completata con riferimenti registrati. Nessun nuovo incasso.');
 }catch(e){receiptReissueMessage(String(e.message||e))}
 finally{
  S.busy=false;receiptReissue.busy=false;
  if(finished){try{await window.optykerCashReloadClientCart(cid)}catch(e){receiptReissueMessage('Documenti registrati. Chiudi e riapri la Cassa per aggiornare il carrello.')}}
  recordedBalance.requested='';await balanceLoad();balancePaint();
 }
}
var receiptReissueNativeCheckout=checkout;
checkout=function(){if(receiptReissue.busy)return;if(receiptReissuePlans().length){receiptReissueMessage('I pagamenti sono già registrati: usa Riemetti scontrini, non Incassa.');return;}return receiptReissueNativeCheckout.apply(this,arguments)};

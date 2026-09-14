(function(){
'use strict';
var API='https://whgziwaegjzqsgcntesr.supabase.co/functions/v1/optyker-fiscal-api',VERSION='1.8-auto-receipt';
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function euro(v){return new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR'}).format(v)}
function api(action,payload){var c=window.OPTYKER_CLOUD||{};return fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:action,payload:payload||{},username:c.username||window.OPTYKER_ACTIVE_USER,password:c.password})}).then(function(r){return r.json().then(function(x){if(!r.ok||x.ok!==true)throw new Error(x.error||'Registro fiscale non disponibile');return x})})}
function bridge(path,payload){return fetch('http://127.0.0.1:8765'+path,{method:payload?'POST':'GET',headers:payload?{'Content-Type':'application/json'}:{},body:payload?JSON.stringify(payload):undefined,cache:'no-store',signal:AbortSignal.timeout(150000)}).then(function(r){return r.json().then(function(x){if(!r.ok||x.ok!==true)throw new Error(x.error||'Connettore non disponibile');return x})})}
function modal(title){var old=document.getElementById('optykerFiscalModal');if(old)old.remove();var m=document.createElement('div');m.id='optykerFiscalModal';m.className='optykerCashModal open';m.setAttribute('role','dialog');m.setAttribute('aria-modal','true');m.setAttribute('aria-label',title);m.innerHTML='<div class="optykerCashModalCard" style="max-width:950px"><div class="optykerCashModalTitle">'+esc(title)+'</div><div class="ofBody">Caricamento…</div><p class="ofMessage" role="status" aria-live="polite"></p><button type="button" class="ofClose optykerCashModalClose">Chiudi</button></div>';document.body.appendChild(m);m.querySelector('.ofClose').onclick=function(){m.remove()};return m}
function message(m,s){m.querySelector('.ofMessage').textContent=s}
function stateLabel(s){return {prepared:'Pronto per l’invio alla RCH',sending:'Emissione in corso o esito da recuperare',not_started:'Nessun comando fiscale inviato',uncertain:'Esito da verificare sul registratore',awaiting_reference:'Chiusura confermata: registra il numero stampato',completed:'Documento registrato',awaiting_configuration:'Da inviare al TS',submitted:'Protocollo TS ricevuto: verifica esito',accepted:'Accettato dal Sistema TS',rejected:'Scartato dal Sistema TS',held_for_void:'Sospesa: annullo RCH da verificare',voided:'Scontrino annullato: escluso dall’invio TS'}[s]||s}
function drawJob(m,job,refresh){
 if(job.operation!=='void'&&job.void_job){drawJob(m,job.void_job,refresh);return}
 var isVoid=job.operation==='void',box=m.querySelector('.ofBody');
 var label=isVoid?({prepared:'Annullo pronto per la conferma',sending:'Annullo in corso: recupera l’esito',not_started:'Annullo non avviato',uncertain:'Esito annullo da verificare sulla RCH',awaiting_reference:'Annullo confermato dalla RCH: registra la nuova stampa',completed:'Scontrino annullato'}[job.state]||stateLabel(job.state)):stateLabel(job.state);

 box.innerHTML='<p><b>'+esc(label)+'</b></p><p>Importo: '+esc(euro(job.total))+' · '+(isVoid?'Documento di annullo':job.talking_receipt?'Con codice fiscale':'Scontrino ordinario')+'</p>'+(job.document_number?'<p>Documento <b>'+esc(job.document_number)+'</b> del '+esc(job.document_date)+'</p>':'')+'<p>Riferimento operazione: '+esc(job.id)+'</p>';
 if(isVoid&&job.original_document)box.innerHTML+='<p>Scontrino originale: <b>'+esc(job.original_document.number)+'</b> del '+esc(job.original_document.date)+'. Motivo: '+esc(job.void_reason||'')+'</p>';
 if(['sending','uncertain'].includes(job.state))box.innerHTML+='<p>Controlla la carta e il display della RCH. Non registrare nuovamente questa vendita e non ripetere la stampa. Se il connettore è stato interrotto, l’esito deve essere verificato prima di altre emissioni.</p>';
 if(job.state==='awaiting_reference'){
  box.innerHTML+='<p>La risposta del registratore non contiene il numero documento. Copialo dal documento commerciale appena stampato.</p><form class="ofReference"><label>Numero documento <input name="number" placeholder="1160-0001" pattern="[0-9]{4}-[0-9]{4}" required></label><label>Data stampata <input name="date" type="date" required></label><label>Totale stampato <input name="amount" type="number" min="0.01" step="0.01" required></label><label><input name="verified" type="checkbox" required> Ho verificato numero, data, totale e codice fiscale sul documento.</label><button type="submit">Registra documento</button></form>';
  var form=box.querySelector('form');if(isVoid){form.insertAdjacentHTML('afterbegin','<p>Trascrivi il numero del <b>nuovo documento di annullo</b>, diverso da quello originale.</p>');form.querySelector('[name=verified]').parentNode.lastChild.textContent=' Ho verificato che la stampa è un documento di annullo riferito allo scontrino originale, con data e importo corretti.'}form.elements.date.value=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Rome'}).format(new Date());
  form.onsubmit=async function(e){e.preventDefault();var b=form.querySelector('button');b.disabled=true;try{var x=await api('reference',{job_id:job.id,document_number:form.elements.number.value,document_date:form.elements.date.value,amount:form.elements.amount.value,paper_verified:form.elements.verified.checked,void_verified:isVoid&&form.elements.verified.checked});drawJob(m,x.data.job,refresh);message(m,isVoid?'Annullo registrato. Ordine e pagamento Shopify invariati.':job.ts_requested?'Documento salvato. Spese TS nella coda di invio.':'Documento salvato.')}catch(err){message(m,err.message);b.disabled=false}};
 }
 if(isVoid&&['awaiting_reference','completed'].includes(job.state))box.insertAdjacentHTML('beforeend','<p>Le eventuali spese TS preparate per lo scontrino originale sono escluse dall’invio. L’ordine e il pagamento Shopify restano invariati.</p>');
 if(!isVoid&&job.state==='completed'&&job.ts_requested)box.innerHTML+='<p>Le righe sanitarie sono nella coda TS. Consulta stato e ricevute in Amministrazione → Sistema TS.</p>';
 if(job.state==='completed'&&job.document_number&&job.document_date){var rp=document.createElement('button');rp.type='button';rp.textContent='Ristampa su RCH RT';box.appendChild(rp);rp.onclick=function(){return reprintJob(job,rp,m)}}
 var b=document.createElement('button');b.type='button';b.textContent='Aggiorna esito';box.appendChild(b);b.onclick=async function(){b.disabled=true;try{await bridge('/receipt/status',{jobId:job.id}).catch(function(){});var r=await api('job',{job_id:job.id});drawJob(m,r.data.job,refresh)}catch(e){message(m,e.message);b.disabled=false}};
 if(['prepared','not_started'].includes(job.state)){var back=document.createElement('button');back.type='button';back.textContent=isVoid?'Rivedi annullo':'Rivedi dati per emissione';box.appendChild(back);back.onclick=isVoid?function(){openVoid(job.original_job_id)}:refresh}
 if(isVoid&&['prepared','not_started'].includes(job.state)){
  var check=document.createElement('button');check.type='button';check.textContent='Verifica blocco locale';box.appendChild(check);
  check.onclick=async function(){
   check.disabled=true;
   try{
    var local=await bridge('/receipt/status',{jobId:job.original_job_id});
    if(['uncertain','claiming','sending'].includes(local.state))message(m,'Il PC conserva ancora lo scontrino originale come da verificare. Stato locale: '+local.state+'. '+String(local.error||'')+' L’annullo resta bloccato: non ripeterlo.');
    else message(m,'Stato locale dello scontrino originale: '+String(local.state||'non disponibile')+'. '+String(local.error||'')+' Nessun comando di stampa inviato.');
   }catch(err){message(m,'Verifica locale: '+String(err.message||err)+'. Nessun comando di stampa inviato.');}
   finally{check.disabled=false}
  };
 }
 if(!isVoid&&job.state==='completed'){var cancel=document.createElement('button');cancel.type='button';cancel.className='ofVoid';cancel.textContent='Annulla scontrino';box.appendChild(cancel);cancel.onclick=function(){return openVoid(job.id)}}
}
async function reprintJob(job,button,m){
 button.disabled=true;m.querySelector('.ofClose').disabled=true;
 try{
  var h;try{h=await bridge('/health')}catch(e){throw new Error('Apri Optyker sul PC Windows collegato alla RCH per ristampare.')}
  if(!h.capabilities||h.capabilities.reprintReceipt!==true){
   message(m,'Aggiorna la funzione ristampa sul PC della cassa, poi riavvia il connettore.');
   var a=document.createElement('a');a.href='/rch-connector/Aggiorna-Ristampa-RCH.bat?v=20260914-reprint1';a.textContent='Scarica aggiornamento ristampa RCH';a.setAttribute('download','');m.querySelector('.ofMessage').appendChild(document.createElement('br'));m.querySelector('.ofMessage').appendChild(a);return;
  }
  var c=window.OPTYKER_CLOUD||{};
  message(m,'Verifica del documento e ristampa sulla RCH in corso…');
  await bridge('/receipt/reprint',{jobId:job.id,username:c.username||window.OPTYKER_ACTIVE_USER,password:c.password});
  message(m,'Ristampa confermata dalla RCH.');
 }catch(e){message(m,e.message)}finally{button.disabled=false;m.querySelector('.ofClose').disabled=false}
}
async function openReprint(saleId){
 var m=modal('Ristampa scontrino su RCH RT');
 try{
  var r=await api('sale',{sale_id:saleId}),jobs=(r.data.jobs||[]).filter(function(j){return j.state==='completed'&&j.document_number&&j.document_date});
  var box=m.querySelector('.ofBody');box.textContent=jobs.length?'Seleziona il documento da ristampare sulla RCH del PC cassa.':'Nessuno scontrino RCH con numero e data confermati per questa vendita. Apri Emissione / esito RCH per verificarne il riferimento.';
  jobs.forEach(function(j){var b=document.createElement('button');b.type='button';b.textContent='Ristampa '+j.document_number+' · '+j.document_date+' · '+euro(j.total);box.appendChild(b);b.onclick=function(){return reprintJob(j,b,m)}});
 }catch(e){m.querySelector('.ofBody').textContent='';message(m,e.message)}
}
window.OPTYKER_RCH_REPRINT=Object.freeze({openSale:openReprint});
async function openVoid(originalId){
 var m=modal('Annulla scontrino RCH');
 try{
  var r=await api('job',{job_id:originalId}),original=r.data.job;
  if(original.operation==='void'||original.state!=='completed')throw new Error('Seleziona lo scontrino originale con riferimento confermato.');
  if(original.void_job&&!['prepared','not_started'].includes(original.void_job.state)){drawJob(m,original.void_job,function(){openVoid(originalId)});return}
  var body=m.querySelector('.ofBody');
  body.innerHTML='<p>Annullo completo dello scontrino <b>'+esc(original.document_number)+'</b> del <b>'+esc(original.document_date)+'</b>, importo <b>'+esc(euro(original.total))+'</b>.</p><p>La RCH stamperà un documento di annullo. Questa operazione non annulla l’ordine Shopify e non rimborsa il pagamento. Le spese TS ancora da inviare verranno escluse dalla coda.</p><form class="ofVoidForm"><label>Motivo dell’annullo <input name="reason" minlength="3" maxlength="200" required placeholder="Es. vendita non effettuata"></label><label><input name="confirmed" type="checkbox" required> Ho verificato lo scontrino originale e confermo di annullarlo interamente. Non è già stato annullato sulla RCH o da altri programmi.</label><button class="ofVoidEmit" type="submit">Conferma annullo di '+esc(euro(original.total))+'</button></form>';
  var form=body.querySelector('form');
  form.onsubmit=async function(e){
   e.preventDefault();if(!form.reportValidity())return;
   var emit=form.querySelector('button'),jobId='';emit.disabled=true;m.querySelector('.ofClose').disabled=true;
   try{
    message(m,'Verifica connettore per annullo…');var health=await bridge('/health');
    if(health.version!==VERSION||!health.capabilities||health.capabilities.voidReceipt!==true)throw new Error('Aggiorna il connettore sul PC: Cassa → RCH → Installa / aggiorna connettore. Poi riapri questo annullo.');
    var prepared=await api('prepare_void',{original_job_id:originalId,expected_number:original.document_number,expected_date:original.document_date,expected_total:original.total,reason:form.elements.reason.value,confirmed:form.elements.confirmed.checked});
    jobId=prepared.data.job.id;
    if(prepared.data.claim_token){message(m,'Annullo in corso. Attendi il documento stampato dalla RCH.');await bridge('/receipt/void',{jobId:jobId,token:prepared.data.claim_token})}
    var result=await api('job',{job_id:jobId});drawJob(m,result.data.job,function(){openVoid(originalId)});message(m,'');
   }catch(err){
    if(jobId){try{await bridge('/receipt/status',{jobId:jobId});var current=await api('job',{job_id:jobId});drawJob(m,current.data.job,function(){openVoid(originalId)})}catch(ignore){}message(m,'Il connettore ha risposto: '+String(err.message||'Risposta incompleta')+'. Usa Verifica blocco locale. Non ripetere l’annullo.');}
    else message(m,err.message);
    emit.disabled=false;
   }finally{m.querySelector('.ofClose').disabled=false}
  };
 }catch(e){m.querySelector('.ofBody').textContent='';message(m,e.message)}
}
function departmentOptions(selected){return '<option value="">Seleziona IVA e tipo</option>'+[[1,'Bene · IVA 4%'],[2,'Bene · IVA 22%'],[3,'Servizio · esente Art.10']].map(function(x){return '<option value="'+x[0]+'"'+(Number(selected)===x[0]?' selected':'')+'>'+x[1]+'</option>'}).join('')}
function addLine(tbody,line){var row=document.createElement('tr');row.innerHTML='<td><input data-field="description" aria-label="Descrizione" maxlength="100" value="'+esc(line.description||'')+'" required></td><td><input data-field="quantity" aria-label="Quantità" type="number" min="1" max="99" step="1" value="'+esc(line.quantity||1)+'" required style="width:55px"></td><td><input data-field="unit_price" aria-label="Prezzo unitario" type="number" min="0.01" step="0.01" value="'+esc(line.unit_price||'')+'" required style="width:85px"></td><td><select data-field="department" aria-label="IVA e tipo" required>'+departmentOptions(line.department)+'</select></td><td><select data-field="expense_code" aria-label="Tipo spesa sanitaria"><option value="none">Non sanitaria</option><option value="AD">AD · dispositivo medico CE</option><option value="AA">AA · altra spesa sanitaria</option></select></td><td><button type="button" aria-label="Rimuovi riga">×</button></td>';tbody.appendChild(row);row.querySelector('button').onclick=function(){row.remove()}}
async function checkReady(){
 var h=await bridge('/health');
 if(h.version!==VERSION||!h.capabilities||h.capabilities.automaticReference!==true)throw new Error('Aggiorna il connettore sul PC: Cassa → RCH → Installa / aggiorna connettore.');
 var status=await bridge('/status');
 if(!/^REG(?:\s*\(OP\s*\d+\))?$/.test(String(status.mode||''))||String(status.idleState)!=='0'||['busy','errorCode','printerError','paperEnd','coverOpen'].some(function(k){return Number(status[k])!==0}))throw new Error('La RCH deve essere pronta in REG, con carta e nessun documento aperto.');
 return true;
}
async function issuePayment(saleId,paymentId){
 var m=modal('Stampa scontrino'),jobId='';m.querySelector('.ofClose').disabled=true;
 m.querySelector('.ofBody').textContent='Vendita registrata. Emissione dello scontrino in corso…';
 try{
  var prepared=await api('prepare',{payment_id:paymentId,automatic:true});jobId=prepared.data.job.id;
  if(prepared.data.claim_token)await bridge('/receipt',{jobId:jobId,token:prepared.data.claim_token});
  var final=await api('job',{job_id:jobId});drawJob(m,final.data.job,function(){openSale(saleId)});
  if(final.data.job.state==='completed')message(m,'Scontrino stampato e dati registrati automaticamente.');
 }catch(err){
  if(jobId){try{await bridge('/receipt/status',{jobId:jobId});var current=await api('job',{job_id:jobId});drawJob(m,current.data.job,function(){openSale(saleId)});
    if(current.data.job.state==='completed'){message(m,'Documento recuperato e registrato.');return}
   }catch(ignore){}}
  message(m,'La vendita è già registrata. '+err.message+' Recupera l’esito da Ultime vendite → Emissione / esito RCH.');
 }finally{m.querySelector('.ofClose').disabled=false}
}
async function openSale(saleId){
 var m=modal('Emissione scontrino RCH');
 try{
  var r=await api('sale',{sale_id:saleId}),data=r.data,payments=data.payments.filter(function(p){return !p.invoice_requested&&!p.billing_invoice_id&&Number(p.amount)>0});
  if(!payments.length){m.querySelector('.ofBody').textContent='Non ci sono pagamenti da emettere con il registratore per questa vendita.';return}
  function render(selected){
   var payment=payments.find(function(p){return p.id===selected})||payments[payments.length-1];
   var job=data.jobs.find(function(j){return j.payment_id===payment.id});
   if(job&&!['prepared','not_started'].includes(job.state)){drawJob(m,job,function(){openSale(saleId)});if(payments.length>1){var chooser=document.createElement('select');chooser.setAttribute('aria-label','Seleziona pagamento');chooser.innerHTML=payments.map(function(p){return '<option value="'+esc(p.id)+'"'+(p.id===payment.id?' selected':'')+'>'+esc(p.payment_stage+' · '+euro(p.amount))+'</option>'}).join('');m.querySelector('.ofBody').prepend(chooser);chooser.onchange=function(){render(this.value)}}return}
   if(payment.automatic_receipt){var automatic=m.querySelector('.ofBody');automatic.innerHTML='<p>'+esc(euro(payment.amount))+' · dati fiscali già registrati con il pagamento.</p><button type="button" class="ofAutoIssue">Stampa scontrino</button>';automatic.querySelector('button').onclick=async function(){this.disabled=true;try{await checkReady();m.remove();await issuePayment(saleId,payment.id)}catch(err){message(m,err.message);this.disabled=false}};return}
   var body=m.querySelector('.ofBody');body.innerHTML='<p>Emetti il documento per un pagamento già registrato. Durante l’emissione usa solo Optyker e lascia chiuso il carrello di Focus.</p><form class="ofIssue"><label>Pagamento <select name="payment">'+payments.map(function(p){return '<option value="'+esc(p.id)+'"'+(p.id===payment.id?' selected':'')+'>'+esc(p.payment_stage+' · '+euro(p.amount)+' · '+p.payment_method+' · '+new Date(p.created_at).toLocaleDateString('it-IT'))+'</option>'}).join('')+'</select></label><div style="overflow-x:auto"><table style="width:100%;margin:14px 0"><thead><tr><th>Descrizione</th><th>Qtà</th><th>Prezzo</th><th>IVA e tipo</th><th>Spesa TS</th><th></th></tr></thead><tbody></tbody></table></div><button type="button" class="ofAdd">Aggiungi riga</button><p>Per acconti e saldi ripartisci il solo importo pagato tra le aliquote corrette. Il totale deve essere '+esc(euro(payment.amount))+'.</p><label><input name="talking" type="checkbox"'+(!data.has_fiscal_code?' disabled':'')+'> Scontrino parlante con il codice fiscale del cliente'+(!data.has_fiscal_code?' (manca nella vendita)':'')+'</label><label><input name="ts" type="checkbox"> Prepara le righe sanitarie per TS</label><label><input name="opposition" type="checkbox"> Il cliente ha espresso opposizione alla precompilata</label><p>Seleziona AD o AA soltanto per le righe sanitarie pertinenti. Consulta invii ed esiti in Amministrazione → Sistema TS.</p><label><input name="notIssued" type="checkbox" required> Questo pagamento non ha già uno scontrino o una fattura, anche emessi da Focus o direttamente sulla RCH.</label><p><button type="submit" class="ofEmit">Emetti scontrino di '+esc(euro(payment.amount))+'</button></p></form>';
   var form=body.querySelector('form'),tbody=body.querySelector('tbody');
   if(Number(payment.amount)===Number(data.total))data.lines.forEach(function(l){var d=l.fiscal_vat_code==='04'&&l.fiscal_item_type==='goods'?1:l.fiscal_vat_code==='22'&&l.fiscal_item_type==='goods'?2:l.fiscal_vat_code==='ART10'&&l.fiscal_item_type==='services'?3:'';addLine(tbody,{description:l.title,quantity:l.quantity,unit_price:l.price,department:d})});
   else addLine(tbody,{description:payment.payment_stage==='deposit'?'ACCONTO':'SALDO',quantity:1,unit_price:payment.amount});
   form.elements.payment.onchange=function(){render(this.value)};body.querySelector('.ofAdd').onclick=function(){addLine(tbody,{})};
   form.onsubmit=async function(e){
    e.preventDefault();var emit=body.querySelector('.ofEmit');emit.disabled=true;m.querySelector('.ofClose').disabled=true;
    var jobId='';try{
     message(m,'Verifica connettore e dati fiscali…');var health=await bridge('/health');if(health.version!==VERSION||health.capabilities.receipt!==true)throw new Error('Installa / aggiorna il connettore RCH dal pulsante RCH della Cassa sul PC Windows.');
     var lines=[].map.call(tbody.rows,function(row){var l={};row.querySelectorAll('[data-field]').forEach(function(x){l[x.dataset.field]=x.value});return l});
     var prepared=await api('prepare',{payment_id:payment.id,lines:lines,talking_receipt:form.elements.talking.checked,ts_requested:form.elements.ts.checked,opposition:form.elements.opposition.checked,not_already_issued:form.elements.notIssued.checked});
     jobId=prepared.data.job.id;
     if(!prepared.data.claim_token){drawJob(m,prepared.data.job,function(){openSale(saleId)});return}
     message(m,'Emissione in corso. Attendi lo scontrino prima di altre operazioni.');
     await bridge('/receipt',{jobId:jobId,token:prepared.data.claim_token});
     var final=await api('job',{job_id:jobId});drawJob(m,final.data.job,function(){openSale(saleId)});message(m,'');
    }catch(err){
     if(jobId){try{await bridge('/receipt/status',{jobId:jobId});var current=await api('job',{job_id:jobId});drawJob(m,current.data.job,function(){openSale(saleId)})}catch(ignore){}message(m,'Risposta incompleta. Usa Aggiorna esito e controlla la RCH prima di qualsiasi nuova emissione.');}
     else message(m,err.message);
     emit.disabled=false;
    }finally{m.querySelector('.ofClose').disabled=false}
   };
  }
  render();
 }catch(e){m.querySelector('.ofBody').textContent='';message(m,e.message)}
}
async function openTs(){var m=modal('Spese collegate ai documenti RCH');try{var x=await api('ts_outbox');m.querySelector('.ofBody').innerHTML='<p>'+esc(x.reason)+'. Per invii, verifica esiti e ricevute apri Amministrazione → Sistema TS.</p>'+(x.data.length?'<table><thead><tr><th>Documento</th><th>Data</th><th>Stato</th><th>Protocollo TS</th></tr></thead><tbody>'+x.data.map(function(r){return '<tr><td>'+esc(r.document.number)+'</td><td>'+esc(r.document.date)+'</td><td>'+esc(({sending:'Invio TS in corso',uncertain:'Esito TS da verificare'}[r.state])||stateLabel(r.state))+'</td><td>'+esc(r.protocol||'—')+'</td></tr>'}).join('')+'</tbody></table>':'<p>Nessuna spesa collegata a un documento RCH confermato.</p>')}catch(e){message(m,e.message)}}
window.OPTYKER_FISCAL=Object.freeze({openSale:openSale,openTs:openTs,checkReady:checkReady,issuePayment:issuePayment});
})();

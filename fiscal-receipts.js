(function(){
'use strict';
var API='https://whgziwaegjzqsgcntesr.supabase.co/functions/v1/optyker-fiscal-api',VERSION='1.6-fiscal-journal';
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function euro(v){return new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR'}).format(v)}
function api(action,payload){var c=window.OPTYKER_CLOUD||{};return fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:action,payload:payload||{},username:c.username||window.OPTYKER_ACTIVE_USER,password:c.password})}).then(function(r){return r.json().then(function(x){if(!r.ok||x.ok!==true)throw new Error(x.error||'Registro fiscale non disponibile');return x})})}
function bridge(path,payload){return fetch('http://127.0.0.1:8765'+path,{method:payload?'POST':'GET',headers:payload?{'Content-Type':'application/json'}:{},body:payload?JSON.stringify(payload):undefined,cache:'no-store',signal:AbortSignal.timeout(150000)}).then(function(r){return r.json().then(function(x){if(!r.ok||x.ok!==true)throw new Error(x.error||'Connettore non disponibile');return x})})}
function modal(title){var old=document.getElementById('optykerFiscalModal');if(old)old.remove();var m=document.createElement('div');m.id='optykerFiscalModal';m.className='optykerCashModal open';m.setAttribute('role','dialog');m.setAttribute('aria-modal','true');m.setAttribute('aria-label',title);m.innerHTML='<div class="optykerCashModalCard" style="max-width:950px"><div class="optykerCashModalTitle">'+esc(title)+'</div><div class="ofBody">Caricamento…</div><p class="ofMessage" role="status" aria-live="polite"></p><button type="button" class="ofClose optykerCashModalClose">Chiudi</button></div>';document.body.appendChild(m);m.querySelector('.ofClose').onclick=function(){m.remove()};return m}
function message(m,s){m.querySelector('.ofMessage').textContent=s}
function stateLabel(s){return {prepared:'Pronto per l’invio alla RCH',sending:'Emissione in corso o esito da recuperare',not_started:'Nessun comando fiscale inviato',uncertain:'Esito da verificare sul registratore',awaiting_reference:'Chiusura confermata: registra il numero stampato',completed:'Documento registrato',awaiting_configuration:'Attende collegamento TS',accepted:'Accettato dal Sistema TS',rejected:'Scartato dal Sistema TS'}[s]||s}
function drawJob(m,job,refresh){
 var box=m.querySelector('.ofBody');
 box.innerHTML='<p><b>'+esc(stateLabel(job.state))+'</b></p><p>Importo: '+esc(euro(job.total))+' · '+(job.talking_receipt?'Con codice fiscale':'Scontrino ordinario')+'</p>'+(job.document_number?'<p>Documento <b>'+esc(job.document_number)+'</b> del '+esc(job.document_date)+'</p>':'')+'<p>Riferimento operazione: '+esc(job.id)+'</p>';
 if(['sending','uncertain'].includes(job.state))box.innerHTML+='<p>Controlla la carta e il display della RCH. Non registrare nuovamente questa vendita e non ripetere la stampa. Se il connettore è stato interrotto, l’esito deve essere verificato prima di altre emissioni.</p>';
 if(job.state==='awaiting_reference'){
  box.innerHTML+='<p>La risposta del registratore non contiene il numero documento. Copialo dal documento commerciale appena stampato.</p><form class="ofReference"><label>Numero documento <input name="number" placeholder="1160-0001" pattern="[0-9]{4}-[0-9]{4}" required></label><label>Data stampata <input name="date" type="date" required></label><label>Totale stampato <input name="amount" type="number" min="0.01" step="0.01" required></label><label><input name="verified" type="checkbox" required> Ho verificato numero, data, totale e codice fiscale sul documento.</label><button type="submit">Registra documento</button></form>';
  var form=box.querySelector('form');form.elements.date.value=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Rome'}).format(new Date());
  form.onsubmit=async function(e){e.preventDefault();var b=form.querySelector('button');b.disabled=true;try{var x=await api('reference',{job_id:job.id,document_number:form.elements.number.value,document_date:form.elements.date.value,amount:form.elements.amount.value,paper_verified:form.elements.verified.checked});drawJob(m,x.data.job,refresh);message(m,job.ts_requested?'Documento salvato. Spese TS preparate: trasmissione non ancora attiva.':'Documento salvato.')}catch(err){message(m,err.message);b.disabled=false}};
 }
 if(job.state==='completed'&&job.ts_requested)box.innerHTML+='<p>Le righe sanitarie sono nella coda TS. L’invio richiede il collegamento TS ancora da completare.</p>';
 var b=document.createElement('button');b.type='button';b.textContent='Aggiorna esito';box.appendChild(b);b.onclick=async function(){b.disabled=true;try{await bridge('/receipt/status',{jobId:job.id}).catch(function(){});var r=await api('job',{job_id:job.id});drawJob(m,r.data.job,refresh)}catch(e){message(m,e.message);b.disabled=false}};
 if(['prepared','not_started'].includes(job.state)){var back=document.createElement('button');back.type='button';back.textContent='Rivedi dati per emissione';box.appendChild(back);back.onclick=refresh}
}
function departmentOptions(selected){return '<option value="">Seleziona IVA e tipo</option>'+[[1,'Bene · IVA 4%'],[2,'Bene · IVA 22%'],[3,'Servizio · esente Art.10']].map(function(x){return '<option value="'+x[0]+'"'+(Number(selected)===x[0]?' selected':'')+'>'+x[1]+'</option>'}).join('')}
function addLine(tbody,line){var row=document.createElement('tr');row.innerHTML='<td><input data-field="description" aria-label="Descrizione" maxlength="100" value="'+esc(line.description||'')+'" required></td><td><input data-field="quantity" aria-label="Quantità" type="number" min="1" max="99" step="1" value="'+esc(line.quantity||1)+'" required style="width:55px"></td><td><input data-field="unit_price" aria-label="Prezzo unitario" type="number" min="0.01" step="0.01" value="'+esc(line.unit_price||'')+'" required style="width:85px"></td><td><select data-field="department" aria-label="IVA e tipo" required>'+departmentOptions(line.department)+'</select></td><td><select data-field="expense_code" aria-label="Tipo spesa sanitaria"><option value="none">Non sanitaria</option><option value="AD">AD · dispositivo medico CE</option><option value="AA">AA · altra spesa sanitaria</option></select></td><td><button type="button" aria-label="Rimuovi riga">×</button></td>';tbody.appendChild(row);row.querySelector('button').onclick=function(){row.remove()}}
async function openSale(saleId){
 var m=modal('Emissione scontrino RCH');
 try{
  var r=await api('sale',{sale_id:saleId}),data=r.data,payments=data.payments.filter(function(p){return !p.invoice_requested&&!p.billing_invoice_id&&Number(p.amount)>0});
  if(!payments.length){m.querySelector('.ofBody').textContent='Non ci sono pagamenti da emettere con il registratore per questa vendita.';return}
  function render(selected){
   var payment=payments.find(function(p){return p.id===selected})||payments[payments.length-1];
   var job=data.jobs.find(function(j){return j.payment_id===payment.id});
   if(job&&!['prepared','not_started'].includes(job.state)){drawJob(m,job,function(){openSale(saleId)});if(payments.length>1){var chooser=document.createElement('select');chooser.setAttribute('aria-label','Seleziona pagamento');chooser.innerHTML=payments.map(function(p){return '<option value="'+esc(p.id)+'"'+(p.id===payment.id?' selected':'')+'>'+esc(p.payment_stage+' · '+euro(p.amount))+'</option>'}).join('');m.querySelector('.ofBody').prepend(chooser);chooser.onchange=function(){render(this.value)}}return}
   var body=m.querySelector('.ofBody');body.innerHTML='<p>Emetti il documento per un pagamento già registrato. Durante l’emissione usa solo Optyker e lascia chiuso il carrello di Focus.</p><form class="ofIssue"><label>Pagamento <select name="payment">'+payments.map(function(p){return '<option value="'+esc(p.id)+'"'+(p.id===payment.id?' selected':'')+'>'+esc(p.payment_stage+' · '+euro(p.amount)+' · '+p.payment_method+' · '+new Date(p.created_at).toLocaleDateString('it-IT'))+'</option>'}).join('')+'</select></label><div style="overflow-x:auto"><table style="width:100%;margin:14px 0"><thead><tr><th>Descrizione</th><th>Qtà</th><th>Prezzo</th><th>IVA e tipo</th><th>Spesa TS</th><th></th></tr></thead><tbody></tbody></table></div><button type="button" class="ofAdd">Aggiungi riga</button><p>Per acconti e saldi ripartisci il solo importo pagato tra le aliquote corrette. Il totale deve essere '+esc(euro(payment.amount))+'.</p><label><input name="talking" type="checkbox"'+(!data.has_fiscal_code?' disabled':'')+'> Scontrino parlante con il codice fiscale del cliente'+(!data.has_fiscal_code?' (manca nella vendita)':'')+'</label><label><input name="ts" type="checkbox"> Prepara le righe sanitarie per TS</label><label><input name="opposition" type="checkbox"> Il cliente ha espresso opposizione alla precompilata</label><p>Seleziona AD o AA soltanto per le righe sanitarie pertinenti. Il collegamento TS non è ancora attivo.</p><label><input name="notIssued" type="checkbox" required> Questo pagamento non ha già uno scontrino o una fattura, anche emessi da Focus o direttamente sulla RCH.</label><p><button type="submit" class="ofEmit">Emetti scontrino di '+esc(euro(payment.amount))+'</button></p></form>';
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
async function openTs(){var m=modal('Spese collegate ai documenti RCH');try{var x=await api('ts_outbox');m.querySelector('.ofBody').innerHTML='<p>Trasmissione TS da completare: servono il kit tecnico aggiornato e l’accesso abilitato. Nessuna di queste righe è stata inviata.</p>'+(x.data.length?'<table><thead><tr><th>Documento</th><th>Data</th><th>Stato</th><th>Protocollo TS</th></tr></thead><tbody>'+x.data.map(function(r){return '<tr><td>'+esc(r.document.number)+'</td><td>'+esc(r.document.date)+'</td><td>'+esc(stateLabel(r.state))+'</td><td>'+esc(r.protocol||'—')+'</td></tr>'}).join('')+'</tbody></table>':'<p>Nessuna spesa collegata a un documento RCH confermato.</p>')}catch(e){message(m,e.message)}}
window.OPTYKER_FISCAL=Object.freeze({openSale:openSale,openTs:openTs});
})();

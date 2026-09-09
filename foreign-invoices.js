(function(){
 'use strict';
 var api,changed,modal,configured=false,offset=0,generation=0;
 var EU='AT BE BG HR CY CZ DK EE FI FR DE GR HU IE IT LV LT LU MT NL PL PT RO SK SI ES SE'.split(' ');
 var names={uploaded:'Originale salvato',extracting:'Lettura in corso',extracted:'Dati da verificare',extract_error:'Lettura da completare'};
 function E(id){return document.getElementById(id)}
 function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
 function error(e){var b=E('fiError');if(b){b.hidden=false;b.textContent=e.message||String(e)}}
 function today(){return new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Rome'}).format(new Date())}
 function field(id,label,value,type,attrs){return '<label>'+esc(label)+'<input id="'+id+'" type="'+(type||'text')+'" value="'+esc(value)+'" '+(attrs||'')+'></label>'}
 function opt(v,t,selected){return '<option value="'+esc(v)+'"'+(selected?' selected':'')+'>'+esc(t)+'</option>'}
 function select(id,label,html){return '<label>'+esc(label)+'<select id="'+id+'" required>'+html+'</select></label>'}
 function layout(title){generation++;modal.innerHTML='<section class="ficCard" role="dialog" aria-modal="true" aria-label="'+esc(title)+'"><header><div><small>MOLOGNI COMPANY S.R.L.</small><h2>'+esc(title)+'</h2></div><button id="fiClose" type="button">Chiudi</button></header><nav><button id="fiHome" type="button">Fatture estere caricate</button></nav><div id="fiError" role="alert" hidden></div><main id="fiBody"></main></section>';E('fiClose').onclick=function(){generation++;modal.remove();modal=null};E('fiHome').onclick=home;}
 function run(b,fn){var g=generation,old=b.textContent;b.disabled=true;b.textContent='Attendi…';E('fiError').hidden=true;return Promise.resolve().then(fn).catch(function(e){if(g===generation)error(e)}).finally(function(){if(b.isConnected){b.disabled=false;b.textContent=old}})}
 function asBase64(file){return new Promise(function(resolve,reject){var r=new FileReader();r.onload=function(){resolve(String(r.result).split(',')[1])};r.onerror=function(){reject(new Error('Impossibile leggere il file selezionato'))};r.readAsDataURL(file)})}
 async function home(){
  layout('Fatture estere');E('fiBody').textContent='Caricamento…';var g=generation;
  try{var all=await Promise.all([api('foreign_status',{}),api('foreign_list',{offset:offset})]);if(g!==generation)return;configured=all[0].configured;
   E('fiBody').innerHTML='<div class="fiUpload"><h3>Carica la fattura del fornitore</h3><p>PDF, JPG o PNG · massimo 8 MB · una fattura per file.</p><p class="ficHint">'+(configured?'La lettura automatica utilizza OpenAI per ricavare i dati dal documento. Potrai verificarli prima di creare e inviare l’integrazione.':'Lettura automatica da attivare: il collegamento OpenAI non è configurato. Puoi già caricare l’originale e compilare i dati.')+'</p><input id="fiFile" type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"><button id="fiUpload" class="ficPrimary" type="button">'+(configured?'Carica e leggi la fattura':'Carica fattura')+'</button><p id="fiUploadStatus" role="status"></p></div><h3>Originali caricati</h3><div id="fiSources" class="ficDraftList"></div><footer><button id="fiPrev" type="button" '+(!offset?'disabled':'')+'>Precedenti</button><span>Pagina '+(Math.floor(offset/30)+1)+'</span><button id="fiNext" type="button" '+(!all[1].has_more?'disabled':'')+'>Successivi</button></footer>';
   E('fiSources').innerHTML=all[1].sources.length?all[1].sources.map(function(s){return '<button type="button" data-source="'+esc(s.id)+'"><strong>'+esc(s.filename)+'</strong><span>'+esc(names[s.status]||s.status)+'</span><span>'+esc(new Date(s.created_at).toLocaleString('it-IT'))+'</span></button>'}).join(''):'Nessuna fattura estera caricata.';
   E('fiSources').querySelectorAll('[data-source]').forEach(function(b){b.onclick=function(){openSource(b.dataset.source)}});
   E('fiPrev').onclick=function(){offset=Math.max(0,offset-30);home()};E('fiNext').onclick=function(){offset+=30;home()};
   E('fiUpload').onclick=function(){run(this,async function(){
    var file=E('fiFile').files[0];if(!file)throw new Error('Seleziona una fattura');
    if(file.size>8*1024*1024||!file.size)throw new Error('Il file deve essere compreso tra 1 byte e 8 MB');
    var mime=file.type||(/\.pdf$/i.test(file.name)?'application/pdf':/\.png$/i.test(file.name)?'image/png':/\.jpe?g$/i.test(file.name)?'image/jpeg':'');
    if(['application/pdf','image/jpeg','image/png'].indexOf(mime)<0)throw new Error('Carica un PDF, JPG o PNG');
    E('fiUploadStatus').textContent='Salvataggio originale…';
    var uploaded=await api('foreign_upload',{filename:file.name,mime:mime,base64:await asBase64(file)});
    if(g!==generation)return;
    var warning=uploaded.duplicate?'Questo file era già presente: ho riaperto l’originale.':'';
    if(configured&&!uploaded.source.extraction){
     E('fiUploadStatus').textContent='Originale salvato. Lettura dei dati in corso…';
     try{await api('foreign_extract',{id:uploaded.source.id,consent_ai:true})}catch(e){warning='Originale salvato. '+e.message}
    }
    if(g===generation)await openSource(uploaded.source.id,warning)
   })};
  }catch(e){if(g===generation)error(e)}
 }
 function countryName(code,list){
  if(!code)return '';
  var aliases={US:["Stati Uniti d'America",'Stati Uniti'],GB:['Regno Unito','Gran Bretagna'],KR:['Corea del Sud'],CZ:['Repubblica Ceca','Cechia']};
  var expected=aliases[code]||[];try{expected.push(new Intl.DisplayNames('it',{type:'region'}).of(code))}catch(e){}
  return list.find(function(n){return expected.some(function(x){return x.toLowerCase()===n.toLowerCase()})})||''
 }
 async function composer(options){
  if(!window.OptykerInvoices)await new Promise(function(resolve,reject){var s=document.createElement('script');s.src='/billing-compose.js?v=20260909-foreign1';s.onload=resolve;s.onerror=function(){reject(new Error('Impossibile aprire l’integrazione'))};document.head.appendChild(s)});
  window.OptykerInvoices.open(Object.assign({call:api,onChanged:changed},options));generation++;modal.remove();modal=null
 }
 async function openSource(id,message){
  layout('Prepara integrazione estera');E('fiBody').textContent='Caricamento originale e dati…';var g=generation;
  try{
   var all=await Promise.all([api('foreign_get',{id:id}),api('fic_form',{series:'foreign'}),api('foreign_status',{})]);if(g!==generation)return;configured=all[2].configured;
   var s=all[0].source,draft=all[0].draft,x=s.extraction||{},supplier=x.supplier||{},info=all[1].info,countries=info.countries_list||[];
   if(draft){E('fiBody').innerHTML='<p><strong>'+esc(s.filename)+'</strong></p><p>Questo originale è già collegato a un’integrazione. Apri il documento esistente per continuare.</p><button id="fiExisting" class="ficPrimary" type="button">Apri integrazione</button>';E('fiExisting').onclick=function(){run(this,function(){return composer({draftId:draft.id})})};return}
   
   E('fiBody').innerHTML='<div class="fiOriginal"><strong>'+esc(s.filename)+'</strong><a id="fiOriginal" target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer">Preparazione originale…</a><button id="fiRefresh" type="button">Aggiorna</button>'+(configured?'<button id="fiExtract" type="button" '+(s.extraction?'disabled':'')+'>Leggi i dati con OpenAI</button>':'')+'</div><p class="ficHint">'+(s.extraction?'I dati letti dal documento sono una proposta. Confrontali con l’originale.':'Puoi compilare i dati dell’originale. La lettura automatica '+(configured?'è disponibile con il pulsante sopra.':'è in attesa del collegamento OpenAI.'))+'</p>'+
    (x.operation_evidence?'<p class="ficHint">Operazione rilevata: '+esc(x.operation_evidence)+'</p>':'')+
    ((x.warnings||[]).length?'<ul class="fiWarnings">'+x.warnings.map(function(w){return '<li>'+esc(w)+'</li>'}).join('')+'</ul>':'')+
    '<form id="fiForm"><h3>Fattura originale</h3><div class="ficGrid">'+select('fiKind','Tipo originale',opt('invoice','Fattura',!x.document_kind||x.document_kind==='invoice')+opt('credit_note','Nota di credito',x.document_kind==='credit_note')+opt('other','Altro documento',x.document_kind==='other'))+field('fiNumber','Numero fattura',x.invoice_number,'text','required')+field('fiDate','Data fattura',x.invoice_date,'date','required')+field('fiBuyer','P.IVA del destinatario della fattura',x.buyer_vat,'text','required placeholder="04679780165"')+'</div>'+
    '<h3>Fornitore estero</h3><div class="ficGrid">'+field('fiName','Ragione sociale',supplier.name,'text','required')+field('fiVat','Identificativo fiscale estero',supplier.vat_number,'text','required')+field('fiIso','Codice paese del fornitore',supplier.country_code,'text','required minlength="2" maxlength="2" placeholder="Es. DE, IE, US"')+select('fiCountry','Paese',opt('','Scegli il paese',true)+countries.filter(function(c){return c!=='Italia'}).map(function(c){return opt(c,c,c===countryName(supplier.country_code,countries))}).join(''))+field('fiStreet','Indirizzo',supplier.address_street,'text','required')+field('fiZip','CAP',supplier.address_postal_code,'text','required')+field('fiCity','Città',supplier.address_city,'text','required')+'</div>'+
    '<h3>Operazione e importi</h3><div class="ficGrid">'+select('fiOperation','Natura dell’acquisto',opt('unknown','Da verificare',!x.operation||x.operation==='unknown')+opt('services','Servizi acquistati dall’estero · TD17',x.operation==='services')+opt('goods_eu_to_it','Beni spediti da UE in Italia · TD18',x.operation==='goods_eu_to_it')+opt('goods_in_it','Beni già in Italia, fornitore estero · TD19',x.operation==='goods_in_it')+opt('import_customs','Importazione con bolletta doganale',x.operation==='import_customs'))+field('fiReceived','Data ricezione fattura (fornitore UE)','','date')+field('fiOperationDate','Data operazione (fornitore extra UE)',x.operation_date,'date')+field('fiCurrency','Valuta originale',x.currency,'text','required maxlength="3" placeholder="EUR, USD…"')+field('fiNet','Imponibile originale',x.net_total,'number','required min="0.01" step="any"')+field('fiTax','IVA / imposte riportate nell’originale',x.tax_amount,'number','required min="0" step="any"')+field('fiGross','Totale originale',x.gross_total,'number','required min="0.01" step="any"')+field('fiRate','Euro per 1 unità di valuta originale',x.currency==='EUR'?1:'','number','required min="0.000001" step="any"')+field('fiExchangeRef','Fonte e data del cambio (se valuta diversa da EUR)','','text')+select('fiVatRate','Aliquota IVA italiana da applicare',opt('','Scegli IVA',true)+(info.vat_types_list||[]).filter(function(v){return !v.is_disabled&&v.e_invoice!==false}).map(function(v){return opt(v.id,v.value+'% · '+(v.description||v.ei_type||''),false)}).join(''))+'</div>'+
    '<p class="ficHint">Per l’integrazione usa la data di ricezione per il fornitore UE o la data dell’operazione per il fornitore extra UE. La presenza di imposte nell’originale, importazioni doganali e note di credito richiedono una gestione specifica.</p><h3>Righe nella valuta originale</h3><div class="ficTableScroll"><table><thead><tr><th>Descrizione</th><th>Quantità</th><th>Prezzo netto unitario</th><th></th></tr></thead><tbody id="fiItems"></tbody></table></div><button id="fiAdd" type="button">+ Riga</button><label class="ficCheck"><input id="fiConfirm" type="checkbox" required>Ho confrontato i dati con l’originale: intestazione, natura dell’acquisto, date, importi, IVA italiana e cambio sono corretti.</label><footer><button id="fiPrepare" class="ficPrimary" type="submit">Prepara integrazione</button></footer></form>';
   if(message||s.extraction_error)error(new Error(message||s.extraction_error));
   api('foreign_original',{id:id}).then(function(r){if(g!==generation)return;var a=E('fiOriginal');var u=new URL(r.url);if(u.protocol==='https:'){a.href=u.href;a.textContent='Apri originale · link valido 2 minuti'}}).catch(function(e){if(g===generation)error(e)});
   E('fiRefresh').onclick=function(){openSource(id)};
   if(E('fiExtract'))E('fiExtract').onclick=function(){run(this,async function(){await api('foreign_extract',{id:id,consent_ai:true});if(g===generation)await openSource(id)})};
   function dates(){var ue=EU.indexOf(E('fiIso').value.trim().toUpperCase())>=0;E('fiReceived').required=ue;E('fiOperationDate').required=!ue}
   E('fiIso').onchange=function(){this.value=this.value.toUpperCase();var name=countryName(this.value,countries);if(name)E('fiCountry').value=name;dates()};dates();
   E('fiCurrency').onchange=function(){this.value=this.value.toUpperCase();if(this.value==='EUR')E('fiRate').value='1'};
   function row(i){i=i||{quantity:1};var tr=document.createElement('tr');tr.innerHTML='<td><input data-k="name" aria-label="Descrizione" value="'+esc(i.description)+'" required maxlength="500"></td><td><input data-k="qty" aria-label="Quantità" type="number" min="0.001" step="any" value="'+esc(i.quantity)+'" required></td><td><input data-k="price" aria-label="Prezzo netto originale" type="number" min="0" step="any" value="'+esc(i.unit_net)+'" required></td><td><button type="button" aria-label="Rimuovi riga">×</button></td>';tr.querySelector('button').onclick=function(){tr.remove()};E('fiItems').appendChild(tr)}
   (x.items&&x.items.length?x.items:[{}]).forEach(row);E('fiAdd').onclick=function(){if(E('fiItems').children.length<40)row();else error(new Error('Massimo 40 righe'))};
   E('fiForm').onsubmit=function(ev){ev.preventDefault();run(E('fiPrepare'),async function(){
    function v(k){return E(k).value.trim()}
    if(!E('fiConfirm').checked)throw new Error('Conferma il controllo dell’originale');
    if(v('fiKind')!=='invoice'||x.multiple_documents)throw new Error('Carica una singola fattura; note di credito e documenti multipli richiedono una gestione separata.');
    var operation=v('fiOperation'),td={services:'TD17',goods_eu_to_it:'TD18',goods_in_it:'TD19'}[operation];if(!td)throw new Error('Questa operazione richiede una verifica specifica prima dell’integrazione');
    var net=Number(v('fiNet')),tax=Number(v('fiTax')),gross=Number(v('fiGross')),rate=Number(v('fiRate')),currency=v('fiCurrency').toUpperCase();
    if(tax!==0)throw new Error('L’originale riporta imposte: verifica il trattamento prima di proseguire');
    if(Math.abs(net+tax-gross)>.02)throw new Error('I totali dell’originale non coincidono');
    if(!Number.isFinite(rate)||rate<=0||currency==='EUR'&&rate!==1)throw new Error('Controlla il cambio in euro');
    if(currency!=='EUR'&&!v('fiExchangeRef'))throw new Error('Indica fonte e data del cambio');
    var items=Array.from(E('fiItems').children).map(function(r){return {name:r.querySelector('[data-k="name"]').value,qty:Number(r.querySelector('[data-k="qty"]').value),net_price:Number(r.querySelector('[data-k="price"]').value)*rate,vat_id:Number(v('fiVatRate'))}});
    if(!items.length||Math.abs(items.reduce(function(n,i){return n+i.qty*i.net_price},0)-net*rate)>.02)throw new Error('Le righe non coincidono con l’imponibile dell’originale');
    var code=v('fiIso').toUpperCase(),docDate=EU.indexOf(code)>=0?v('fiReceived'):v('fiOperationDate');
    var context={document_kind:v('fiKind'),multiple_documents:false,buyer_vat:v('fiBuyer'),country_code:code,supplier_country_name:v('fiCountry'),operation:operation,received_date:v('fiReceived'),operation_date:v('fiOperationDate'),currency:currency,net_total:net,tax_amount:tax,gross_total:gross,exchange_rate:rate,exchange_reference:v('fiExchangeRef'),confirm_exchange:true};
    await composer({prefill:{series:'foreign',channel:'sdi',td:td,date:docDate,original_number:v('fiNumber'),original_date:v('fiDate'),entity:{type:'company',name:v('fiName'),vat_number:v('fiVat'),country:v('fiCountry'),address_street:v('fiStreet'),address_postal_code:v('fiZip'),address_city:v('fiCity')},items:items,source_id:id,source_context:context,source_confirm:false,subject:'Integrazione fattura estera '+v('fiNumber'),notes:'Fattura originale '+v('fiNumber')+' del '+v('fiDate')+'. Valuta '+currency+'.'+(currency!=='EUR'?' Cambio EUR '+rate+' · '+v('fiExchangeRef'):'')}})
   })};
  }catch(e){if(g===generation)error(e)}
 }
 window.OptykerForeignInvoices={open:function(options){api=options.call;changed=options.onChanged||function(){};offset=0;if(modal)modal.remove();if(!E('ficComposerCss')){var css=document.createElement('link');css.id='ficComposerCss';css.rel='stylesheet';css.href='/billing-compose.css?v=20260909-foreign1';document.head.appendChild(css)}modal=document.createElement('div');modal.className='ficOverlay';document.body.appendChild(modal);home()}};
})();

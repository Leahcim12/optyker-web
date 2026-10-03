(function(){
  if(window.__optykerClientToolsPatch)return;window.__optykerClientToolsPatch=true;
  var API='https://whgziwaegjzqsgcntesr.supabase.co/functions/v1/optyker-client-tools-api';
  var state={clientId:'',data:null,loading:false,last:0,open:{},drafts:{}};
  var defs={
    usage:{title:"Indicazioni d’uso",fields:['examDate','instructions','products','maintenance','notes']},
    protocol_ovc:{title:'Protocollo VC',fields:['examDate','reason','anamnesis','visualAcuity','refraction','binocularVision','accommodation','motility','outcome','notes']},
    protocol_ovc_bambini:{title:'Protocollo VC Bambini',fields:['examDate','reason','parentNotes','visualAcuity','coverTest','motility','accommodation','stereopsis','colorVision','outcome','notes']},
    analisi_visiva_integrata:{title:'Analisi Visiva Integrata',fields:['examDate','reason','anamnesis','visualAcuity','refraction','binocularVision','accommodation','motility','outcome','recommendations','notes']},
    fondo_oculare:{title:'Fondo Oculare',fields:[]},
    visual_anomalies:{title:'Anomalie visive',fields:['examDate','anomaly','tests','findings','outcome','recommendations','notes']}
  };
  var labels={examDate:'Data esame',reason:'Motivo',anamnesis:'Anamnesi',visualAcuity:'Acuità visiva',refraction:'Refrazione',binocularVision:'Visione binoculare',accommodation:'Accomodazione',motility:'Motilità',outcome:'Esito',recommendations:'Indicazioni / raccomandazioni',notes:'Note',parentNotes:'Note genitore',coverTest:'Cover test',stereopsis:'Stereopsi',colorVision:'Visione dei colori',anomaly:'Anomalia visiva',tests:'Test eseguiti',findings:'Risultati',odFindings:'Fondo OD',osFindings:'Fondo OS',instructions:"Indicazioni d’uso",products:'Prodotti',maintenance:'Manutenzione'};
  // Fondo oculare: modulo "Oftalmoscopio" (valori separati OD / OS).
  var FUNDUS_ROWS=[
    {k:'fo_escavazione',label:'Tipo di escavazione (Elschnig)',type:'choice',opts:['I','II','III','IV','V']},
    {k:'fo_cd',label:'Rapporto diametro coppa / papilla',type:'num',suffix:'/10',min:0,max:10},
    {k:'fo_focus',label:'Focalizzazione papilla / profondità escavazione',type:'num',suffix:'D'},
    {k:'fo_av',label:'Rapporto arteria-vena',type:'choice',opts:['4/5','3/4','2/3','1/2']},
    {k:'fo_reflex',label:'Rapporto arteria / suo riflesso',type:'choice',opts:['<1/3','=1/3','>1/3']},
    {k:'fo_macula',label:'Macula',type:'choice',opts:['con riflesso','senza riflesso']}
  ];
  var FUNDUS_TEXT=[{k:'fo_media',label:'Trasparenza mezzi'},{k:'notes',label:'Note'}];
  var FUNDUS_KEYS=['examDate'];
  FUNDUS_ROWS.forEach(function(r){['od','os'].forEach(function(e){var key=r.k+'_'+e;FUNDUS_KEYS.push(key);labels[key]=r.label+(r.suffix?' ('+r.suffix+')':'')+' · '+e.toUpperCase()})});
  FUNDUS_TEXT.forEach(function(t){FUNDUS_KEYS.push(t.k);if(!labels[t.k])labels[t.k]=t.label});
  defs.fondo_oculare.fields=FUNDUS_KEYS.slice();
  function E(id){return document.getElementById(id)}
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(ch){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]})}
  function op(){return String(window.OPTYKER_ACTIVE_USER||(window.OPTYKER_CLOUD&&OPTYKER_CLOUD.username)||'').trim()}
  function call(action,payload){var b=payload||{};b.action=action;b.operator=op();return fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)}).then(function(r){return r.json().catch(function(){return {}}).then(function(x){if(!r.ok||x&&x.ok===false)throw new Error((x&&x.error)||('HTTP '+r.status));return x})})}
  function money(v,c){var n=Number(v);if(!isFinite(n))return '—';try{return new Intl.NumberFormat('it-IT',{style:'currency',currency:c||'EUR'}).format(n)}catch(z){return n.toFixed(2)+' €'}}
  function dt(v){if(!v)return '—';try{return new Date(v).toLocaleString('it-IT',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'})}catch(z){return String(v)}}
  function getVal(s,k){var d=s&&s.data||{},e=d.elements&&d.elements[k];if(e&&typeof e==='object'&&Object.prototype.hasOwnProperty.call(e,'value'))return String(e.value==null?'':e.value);if(typeof e==='string'||typeof e==='number')return String(e);if(Object.prototype.hasOwnProperty.call(d,k)&&['string','number','boolean'].indexOf(typeof d[k])>=0)return String(d[k]);return ''}
  function fieldsFor(s){var d=defs[s.kind]||{fields:[]},keys=d.fields.slice(),els=s&&s.data&&s.data.elements||{};Object.keys(els).forEach(function(k){if(['clientName','clientSurname','specialistName'].indexOf(k)<0&&keys.indexOf(k)<0)keys.push(k)});return keys}
  function wide(k,v){return ['notes','outcome','recommendations','findings','anamnesis','instructions','tests','parentNotes','odFindings','osFindings'].indexOf(k)>=0||String(v||'').length>55}
  function fieldHtml(s,k){var v=getVal(s,k),w=wide(k,v),lab=labels[k]||String(k).replace(/_/g,' ').replace(/([a-z])([A-Z])/g,'$1 $2');return '<div class="optykerClinicalField '+(w?'wide':'')+'"><label>'+esc(lab)+'</label>'+(w?'<textarea data-tools-key="'+esc(k)+'">'+esc(v)+'</textarea>':'<input data-tools-key="'+esc(k)+'" value="'+esc(v)+'">')+'</div>'}
  function cloudReplace(row){var cid=String(row&&row.client_id||state.clientId||'');if(!cid||!window.OPTYKER_CLOUD||!OPTYKER_CLOUD.sheets)return;var a=Array.isArray(OPTYKER_CLOUD.sheets[cid])?OPTYKER_CLOUD.sheets[cid]:[],i=a.findIndex(function(x){return String(x&&x.id||'')===String(row&&row.id||'')});if(i>=0)a[i]=row;else a.unshift(row);OPTYKER_CLOUD.sheets[cid]=a}
  function ensureBlock(id,after){var b=E(id);if(b)return b;b=document.createElement('section');b.id=id;b.className='optykerClientToolsBlock';if(after&&after.parentNode)after.parentNode.insertBefore(b,after.nextSibling);else{var n=E('clientWorkspaceName');if(n&&n.parentNode&&n.parentNode.parentNode)n.parentNode.parentNode.appendChild(b)}return b}
  function rootAnchor(){return E('optykerClientQuotesSection')||E('optykerClientReferenceBadge')||E('clientWorkspaceName')?.parentNode||E('clientWorkspaceName')}
  function sheetDisplay(s){var ref=String(s&&((s.reference_code||s.reference_no)||s.data&&s.data.documentReference)||'').trim();return ref||('Scheda n. '+String(s&&s.display_no||'—'))}
  function renderReferences(){
    var a=rootAnchor(),b=ensureBlock('optykerClientReferenceTools',a);if(!b)return;
    var c=state.data&&state.data.client||{},l=Array.isArray(state.data&&state.data.lenses)?state.data.lenses:[];
    var h='<div class="optykerClientToolsHead"><div><h3>Numeri e riferimenti</h3><div class="optykerClientToolsSub">Riferimenti reali del cliente, delle schede e delle forniture.</div></div>'+(c.reference_no?'<span class="optykerRefBadge">CLIENTE '+esc(c.reference_no)+'</span>':'')+'</div>';
    if(l.length){h+='<div class="optykerRefList">'+l.map(function(x,i){var r=String(x.in_store_order_ref||'').trim()||('Fornitura '+(i+1));return '<div class="optykerRefLine"><b>'+esc([x.brand,x.product_name,x.eye].filter(Boolean).join(' · ')||'Fornitura LAC')+'</b><span>'+esc(r)+'</span></div>'}).join('')+'</div>'}
    else h+='<div class="optykerEmptySmall">Nessuna fornitura LAC collegata.</div>';
    b.innerHTML=h;
  }
  function clinicalGroups(){var rows=state.data&&state.data.clinical_sheets||[],kinds=['usage','protocol_ovc','protocol_ovc_bambini','analisi_visiva_integrata','fondo_oculare'];return kinds.map(function(k){var a=rows.filter(function(x){return x.kind===k}),d=defs[k];return '<div class="optykerClinicalGroup" data-tools-group="'+k+'"><div class="optykerClinicalGroupHead"><div class="optykerClinicalGroupTitle">'+esc(d.title)+'</div><button class="optykerClientToolsBtn" data-tools-new="'+k+'" type="button">+ Crea scheda</button></div>'+(a.length?a.map(cardHtml).join(''):'<div class="optykerEmptySmall">Nessuna scheda.</div>')+'</div>'}).join('')}
  function todayIt(){var d=new Date();return ('0'+d.getDate()).slice(-2)+'/'+('0'+(d.getMonth()+1)).slice(-2)+'/'+d.getFullYear()}
  function hasValues(s){var els=s&&s.data&&s.data.elements||{};return Object.keys(els).some(function(k){return ['clientName','clientSurname','specialistName'].indexOf(k)<0&&getVal(s,k)!==''})}
  function fundusInput(s,r,key,eye){
    var v=getVal(s,key),aria=esc(r.label+' '+eye);
    if(r.type==='choice')return '<div class="optykerChoice" role="group" aria-label="'+aria+'"><input type="hidden" data-tools-key="'+key+'" value="'+esc(v)+'">'+r.opts.map(function(o){var on=o===v;return '<button type="button" data-choice-val="'+esc(o)+'" aria-pressed="'+on+'" class="'+(on?'on':'')+'">'+esc(o)+'</button>'}).join('')+'<button type="button" class="optykerChoiceClear" data-choice-clear title="Togli la selezione" aria-label="Togli la selezione"'+(v?'':' hidden')+'>×</button></div>';
    return '<label class="optykerFundusNum"><input data-tools-key="'+key+'" inputmode="decimal" autocomplete="off" aria-label="'+aria+'" value="'+esc(v)+'"'+(r.min!=null?' data-num-min="'+r.min+'"':'')+(r.max!=null?' data-num-max="'+r.max+'"':'')+' data-num-label="'+aria+'"><span>'+esc(r.suffix||'')+'</span></label>';
  }
  function fundusHtml(s){
    var date=getVal(s,'examDate');if(!date&&!hasValues(s))date=todayIt();
    var h='<div class="optykerFundus"><div class="optykerClinicalFields"><div class="optykerClinicalField"><label>Data esame</label><input data-tools-key="examDate" placeholder="gg/mm/aaaa" value="'+esc(date)+'"></div></div>';
    h+='<div class="optykerFundusTable"><div class="optykerFundusHead"><span>Oftalmoscopio</span><b>OD</b><b>OS</b></div><div class="optykerFundusHint">Tutte le voci sono facoltative: lascia vuoto o premi × per togliere una scelta. In stampa compaiono solo le voci compilate.</div>';
    FUNDUS_ROWS.forEach(function(r){h+='<div class="optykerFundusRow"><div class="optykerFundusLabel">'+esc(r.label)+'</div>'+['od','os'].map(function(e){return '<div class="optykerFundusCell" data-eye="'+e.toUpperCase()+'">'+fundusInput(s,r,r.k+'_'+e,e.toUpperCase())+'</div>'}).join('')+'</div>'});
    h+='</div><div class="optykerClinicalFields">'+FUNDUS_TEXT.map(function(t){return '<div class="optykerClinicalField wide"><label>'+esc(t.label)+'</label><textarea data-tools-key="'+t.k+'">'+esc(getVal(s,t.k))+'</textarea></div>'}).join('')+'</div>';
    var legacy=fieldsFor(s).filter(function(k){return FUNDUS_KEYS.indexOf(k)<0&&getVal(s,k)!==''});
    if(legacy.length)h+='<div class="optykerFundusLegacy"><div class="optykerFundusLegacyTitle">Dati registrati con la scheda precedente</div><div class="optykerClinicalFields">'+legacy.map(function(k){return fieldHtml(s,k)}).join('')+'</div></div>';
    return h+'</div>';
  }
  function syncChoices(root){Array.prototype.forEach.call((root||document).querySelectorAll('.optykerChoice'),function(g){var inp=g.querySelector('[data-tools-key]'),v=inp?inp.value:'';Array.prototype.forEach.call(g.querySelectorAll('[data-choice-val]'),function(b){var on=b.getAttribute('data-choice-val')===v;b.classList.toggle('on',on);b.setAttribute('aria-pressed',String(on))});var c=g.querySelector('[data-choice-clear]');if(c)c.hidden=!v})}
  function validateCard(card){var bad='';Array.prototype.forEach.call(card.querySelectorAll('[data-num-label]'),function(x){x.classList.remove('invalid');var raw=String(x.value||'').trim();if(!raw||bad)return;var n=Number(raw.replace(',','.'));var lo=x.getAttribute('data-num-min'),hi=x.getAttribute('data-num-max');if(!isFinite(n)||(lo!=null&&n<Number(lo))||(hi!=null&&n>Number(hi))){x.classList.add('invalid');bad=x.getAttribute('data-num-label')+': valore non valido'+(lo!=null&&hi!=null?' (da '+lo+' a '+hi+')':'')+'.'}});return bad}
  function cardHtml(s){var out=getVal(s,'outcome');return '<div class="optykerClinicalCard" data-tools-card="'+esc(s.id)+'"><div class="optykerClinicalSummary"><strong>'+esc((defs[s.kind]&&defs[s.kind].title)||s.title||'Scheda')+' <em>'+esc(sheetDisplay(s))+'</em></strong><span class="optykerCardMeta">'+esc(dt(s.updated_at||s.created_at))+'</span><span class="optykerCardActions"><button type="button" class="optykerCardBtn" data-tools-edit="'+esc(s.id)+'">Modifica</button><button type="button" class="optykerCardBtn" data-tools-print="'+esc(s.id)+'">Stampa</button><button type="button" class="optykerCardBtn danger" data-tools-delete="'+esc(s.id)+'">Elimina</button></span></div>'+(s.kind==='visual_anomalies'&&out?'<div class="optykerAnomalyOutcome"><b>Esito:</b> '+esc(out)+'</div>':'')+'<div class="optykerClinicalEditor">'+(s.kind==='fondo_oculare'?fundusHtml(s):'<div class="optykerClinicalFields">'+fieldsFor(s).map(function(k){return fieldHtml(s,k)}).join('')+'</div>')+'<div class="optykerClinicalSaveRow"><button class="optykerClientToolsBtn primary" data-tools-save="'+esc(s.id)+'" type="button">SALVA SCHEDA</button></div></div></div>'}
  function renderClinical(){
    var a=rootAnchor(),b=ensureBlock('optykerClientClinicalTools',a);if(!b)return;
    b.innerHTML='<div class="optykerClientToolsHead"><div><h3>Schede cliniche</h3><div class="optykerClientToolsSub">Crea e modifica le schede direttamente dall’anagrafica cliente.</div></div></div><div class="optykerClientToolsGrid">'+clinicalGroups()+'</div>';
    bind(b);
  }
  function renderAnomalies(){
    var rows=(state.data&&state.data.clinical_sheets||[]).filter(function(x){return x.kind==='visual_anomalies'}),after=E('optykerClientClinicalTools')||rootAnchor(),b=ensureBlock('optykerClientAnomalyTools',after);if(!b)return;
    b.innerHTML='<div class="optykerClientToolsHead"><div><h3>Anomalie visive · esiti</h3><div class="optykerClientToolsSub">Storico degli esiti e nuove valutazioni per il cliente.</div></div><button class="optykerClientToolsBtn" data-tools-new="visual_anomalies" type="button">+ Crea anomalia visiva</button></div>'+(rows.length?rows.map(cardHtml).join(''):'<div class="optykerEmptySmall">Nessuna anomalia visiva registrata.</div>');
    bind(b);
  }
  function renderPayments(){
    var p=state.data&&state.data.payment_cart||{},pos=Array.isArray(p.pos_open)?p.pos_open:[],online=Array.isArray(p.online_unpaid)?p.online_unpaid:[],after=E('optykerClientAnomalyTools')||E('optykerClientClinicalTools')||rootAnchor(),b=ensureBlock('optykerClientPaymentTools',after);if(!b)return;
    var h='<div class="optykerClientToolsHead"><div><h3>Carrello / da pagare</h3><div class="optykerClientToolsSub">Controlla subito se il cliente ha ancora un saldo aperto.</div></div></div>';
    if(!pos.length&&!online.length)h+='<div class="optykerPaidOk">Nessun importo residuo: il cliente non risulta avere pagamenti aperti.</div>';
    else{h+='<div class="optykerDueTop"><b>TOTALE ANCORA DA PAGARE</b><strong>'+esc(money(p.total_due,p.currency||'EUR'))+'</strong></div>';h+=pos.map(function(x){return '<div class="optykerDueRow"><div><div class="optykerDueRowTitle">'+esc(x.shopify_order_name||x.note||'Vendita Optyker')+'</div><div class="optykerDueRowMeta">'+esc(dt(x.created_at))+' · '+esc(x.payment_stage||x.payment_status||x.status||'Pagamento aperto')+'</div></div><div class="optykerDueRowAmount">'+esc(money(x.due_amount,x.currency||'EUR'))+'</div></div>'}).join('');h+=online.map(function(o){return '<div class="optykerDueRow"><div><div class="optykerDueRowTitle">'+esc(o.order_name||'Ordine online')+'</div><div class="optykerDueRowMeta">Ordine online · '+esc(o.financial_status||'Da pagare')+'</div></div><div class="optykerDueRowAmount">'+esc(money(o.total,o.currency||'EUR'))+'</div></div>'}).join('')}
    b.innerHTML=h;
  }
  function captureCards(){Array.prototype.forEach.call(document.querySelectorAll('.optykerClinicalCard[data-tools-card]'),function(c){var id=c.getAttribute('data-tools-card');if(c.classList.contains('open'))state.open[id]=true;else delete state.open[id];var d={};Array.prototype.forEach.call(c.querySelectorAll('[data-tools-key]'),function(x){d[x.getAttribute('data-tools-key')]=x.value});if(c.classList.contains('open'))state.drafts[id]=d})}
  function restoreCards(){Array.prototype.forEach.call(document.querySelectorAll('.optykerClinicalCard[data-tools-card]'),function(c){var id=c.getAttribute('data-tools-card');if(state.open[id])c.classList.add('open');var d=state.drafts[id];if(d)Array.prototype.forEach.call(c.querySelectorAll('[data-tools-key]'),function(x){var k=x.getAttribute('data-tools-key');if(Object.prototype.hasOwnProperty.call(d,k))x.value=d[k]})});syncChoices(document)}
  function blocksMissing(){return ['optykerClientReferenceTools','optykerClientClinicalTools','optykerClientAnomalyTools','optykerClientPaymentTools'].some(function(id){return !E(id)})}
  function renderAll(){if(String(window.clientCurrentId||'')!==state.clientId)return;captureCards();renderReferences();renderClinical();renderAnomalies();renderPayments();restoreCards()}
  function openCard(id){var c=null;Array.prototype.forEach.call(document.querySelectorAll('.optykerClinicalCard[data-tools-card]'),function(x){if(x.getAttribute('data-tools-card')===String(id))c=x});if(!c)return false;state.open[String(id)]=true;c.classList.add('open');c.scrollIntoView({behavior:'smooth',block:'center'});var f=c.querySelector('[data-tools-key]');if(f)try{f.focus({preventScroll:true})}catch(z){}return true}
  function bind(root){
    Array.prototype.forEach.call(root.querySelectorAll('.optykerClinicalSummary'),function(x){x.onclick=function(){var c=this.closest('.optykerClinicalCard'),id=c.getAttribute('data-tools-card');c.classList.toggle('open');if(c.classList.contains('open'))state.open[id]=true;else{delete state.open[id];delete state.drafts[id]}}});
    Array.prototype.forEach.call(root.querySelectorAll('[data-tools-new]'),function(x){x.onclick=function(){createSheet(this.getAttribute('data-tools-new'))}});
    Array.prototype.forEach.call(root.querySelectorAll('[data-tools-edit]'),function(b){b.onclick=function(ev){ev.stopPropagation();openCard(this.getAttribute('data-tools-edit'))}});
    Array.prototype.forEach.call(root.querySelectorAll('[data-tools-print]'),function(b){b.onclick=function(ev){ev.stopPropagation();var id=this.getAttribute('data-tools-print'),row=rowById(id);if(!row)return;try{printRow(row)}catch(e){alert(e.message||String(e))}}});
    Array.prototype.forEach.call(root.querySelectorAll('[data-tools-delete]'),function(b){b.onclick=function(ev){ev.stopPropagation();var row=rowById(this.getAttribute('data-tools-delete'));if(row)deleteFromCard(row,this)}});
    Array.prototype.forEach.call(root.querySelectorAll('[data-choice-clear]'),function(b){b.onclick=function(){var g=this.closest('.optykerChoice'),inp=g&&g.querySelector('[data-tools-key]');if(inp){inp.value='';syncChoices(g.parentNode)}}});
    Array.prototype.forEach.call(root.querySelectorAll('[data-choice-val]'),function(b){b.onclick=function(){var g=this.closest('.optykerChoice'),inp=g&&g.querySelector('[data-tools-key]'),v=this.getAttribute('data-choice-val');if(!inp)return;inp.value=inp.value===v?'':v;syncChoices(g.parentNode)}});
    Array.prototype.forEach.call(root.querySelectorAll('[data-tools-save]'),function(x){x.onclick=function(){saveSheet(this.getAttribute('data-tools-save'),this.closest('.optykerClinicalCard'))}});
  }
  function load(force){
    var cid=String(window.clientCurrentId||'');if(!cid){state.clientId='';state.data=null;['optykerClientReferenceTools','optykerClientClinicalTools','optykerClientAnomalyTools','optykerClientPaymentTools'].forEach(function(id){var x=E(id);if(x)x.remove()});return Promise.resolve()}
    if(state.loading)return Promise.resolve();if(!force&&cid===state.clientId&&Date.now()-state.last<10000){renderAll();return Promise.resolve()}
    if(cid!==state.clientId){state.open={};state.drafts={}}state.clientId=cid;state.loading=true;
    return call('list',{client_id:cid}).then(function(x){if(cid===String(window.clientCurrentId||'')){state.data=x.data||{};state.last=Date.now();renderAll()}}).catch(function(e){console.warn('Optyker client tools:',e)}).finally(function(){state.loading=false})
  }
  function createSheet(k){var cid=String(window.clientCurrentId||'');if(!cid||state.creating)return;state.creating=true;var newId='';call('create',{client_id:cid,kind:k}).then(function(x){if(x.data){cloudReplace(x.data);newId=String(x.data.id||'')}if(newId)state.open[newId]=true;state.loading=false;return load(true)}).then(function(){setTimeout(function(){if(newId&&openCard(newId))return;var g=document.querySelector('[data-tools-new="'+k+'"]'),c=g&&g.closest('.optykerClinicalGroup,.optykerClientToolsBlock'),first=c&&c.querySelector('.optykerClinicalCard[data-tools-card]');if(first)openCard(first.getAttribute('data-tools-card'))},60)}).catch(function(e){alert('Impossibile creare la scheda: '+e.message)}).finally(function(){state.creating=false})}
  function saveSheet(id,card){var cid=String(window.clientCurrentId||'');if(!cid||!id||!card)return;var invalid=validateCard(card);if(invalid){alert(invalid);return}var values={};Array.prototype.forEach.call(card.querySelectorAll('[data-tools-key]'),function(x){values[x.getAttribute('data-tools-key')]=x.value});var b=card.querySelector('[data-tools-save]');if(b){b.disabled=true;b.textContent='Salvataggio…'}call('update',{client_id:cid,id:id,values:values}).then(function(x){if(x.data)cloudReplace(x.data);delete state.drafts[id];return load(true)}).then(function(){alert('Scheda aggiornata')}).catch(function(e){alert('Impossibile salvare: '+e.message)}).finally(function(){if(b){b.disabled=false;b.textContent='SALVA SCHEDA'}})}
  // ---------- Stampa e cancellazione delle schede ----------
  var TOOL_KIND={indications:'usage',analysis:'visual_anomalies',usage:'usage',visual_anomalies:'visual_anomalies',protocol_ovc:'protocol_ovc',protocol_ovc_bambini:'protocol_ovc_bambini',analisi_visiva_integrata:'analisi_visiva_integrata',fondo_oculare:'fondo_oculare'};
  function rowById(id){var rows=state.data&&state.data.clinical_sheets||[];for(var i=0;i<rows.length;i++)if(String(rows[i].id)===String(id))return rows[i];return null}
  function cardFor(id){var c=null;Array.prototype.forEach.call(document.querySelectorAll('.optykerClinicalCard[data-tools-card]'),function(x){if(x.getAttribute('data-tools-card')===String(id))c=x});return c}
  function valuesFor(row){var out={},card=cardFor(row.id);if(card){Array.prototype.forEach.call(card.querySelectorAll('[data-tools-key]'),function(x){out[x.getAttribute('data-tools-key')]=String(x.value||'').trim()});return out}var els=row&&row.data&&row.data.elements||{};Object.keys(els).forEach(function(k){out[k]=getVal(row,k).trim()});return out}
  function clientName(){var n=E('clientWorkspaceName');return n?String(n.textContent||'').replace(/\s+/g,' ').trim():''}
  function nl2br(v){return esc(v).replace(/\n/g,'<br>')}
  function clinicalBody(row,kind){
    var v=valuesFor(row),h='';
    if(kind==='fondo_oculare'){
      var filled=FUNDUS_ROWS.filter(function(r){return v[r.k+'_od']||v[r.k+'_os']});
      if(filled.length)h+='<table class="otkTable"><thead><tr><th>Oftalmoscopio</th><th>OD</th><th>OS</th></tr></thead><tbody>'+filled.map(function(r){var f=function(x){return x?esc(x)+(r.suffix?(r.suffix.charAt(0)==='/'?'':' ')+esc(r.suffix):''):''};return '<tr><td>'+esc(r.label)+'</td><td>'+f(v[r.k+'_od'])+'</td><td>'+f(v[r.k+'_os'])+'</td></tr>'}).join('')+'</tbody></table>';
      FUNDUS_TEXT.forEach(function(t){if(v[t.k])h+='<div class="otkText"><b>'+esc(t.label)+'</b><p>'+nl2br(v[t.k])+'</p></div>'});
      var legacy=Object.keys(v).filter(function(k){return FUNDUS_KEYS.indexOf(k)<0&&v[k]&&['clientName','clientSurname','specialistName'].indexOf(k)<0});
      if(legacy.length)h+='<dl class="otkList">'+legacy.map(function(k){return '<div><dt>'+esc(labels[k]||k)+'</dt><dd>'+nl2br(v[k])+'</dd></div>'}).join('')+'</dl>';
      return h;
    }
    var keys=(defs[kind]&&defs[kind].fields||[]).slice();Object.keys(v).forEach(function(k){if(keys.indexOf(k)<0)keys.push(k)});
    var list=keys.filter(function(k){return k!=='examDate'&&v[k]&&['clientName','clientSurname','specialistName'].indexOf(k)<0});
    return list.length?'<dl class="otkList">'+list.map(function(k){return '<div><dt>'+esc(labels[k]||String(k).replace(/_/g,' ').replace(/([a-z])([A-Z])/g,'$1 $2'))+'</dt><dd>'+nl2br(v[k])+'</dd></div>'}).join('')+'</dl>':'<p class="otkEmpty">Nessun dato compilato.</p>';
  }
  // Intestazione e piè di pagina presi dalla stampa della Prescrizione.
  function prescriptionFrame(){
    var out={head:'',foot:'',css:''};
    try{
      if(typeof window.prescriptionPrintHtml!=='function')return out;
      var rx=new DOMParser().parseFromString(window.prescriptionPrintHtml(),'text/html');
      out.css=Array.prototype.map.call(rx.querySelectorAll('style'),function(x){return x.textContent}).join('\n');
      var head=rx.querySelector('.head');if(head)out.head=head.outerHTML;
      var leaf=null;Array.prototype.forEach.call(rx.body.querySelectorAll('*'),function(e){if(/OTTICO OPTOMETRISTA/i.test(e.textContent||'')&&!Array.prototype.some.call(e.children,function(c){return /OTTICO OPTOMETRISTA/i.test(c.textContent||'')}))leaf=e});
      if(leaf){var foot=leaf;while(foot.parentElement&&foot.parentElement!==rx.body&&!foot.parentElement.classList.contains('onePage')&&(foot.parentElement.textContent||'').trim().length<=(foot.textContent||'').trim().length+80)foot=foot.parentElement;out.foot=foot.outerHTML}
    }catch(e){console.warn('Optyker: intestazione prescrizione non leggibile',e)}
    return out;
  }
  function printDocument(title,meta,bodyHtml){
    var f=prescriptionFrame();
    var head=f.head||'<div class="otkHeadFallback"><b>Ottica Visual Care</b><br>Via primo maggio 4 · 24040 Lallio (BG)<br>Registrazione Ministero della Salute n.419926</div>';
    var foot=f.foot||'<div class="otkFootFallback">OTTICO OPTOMETRISTA CONTATTOLOGO SPECIALISTA — '+esc(op())+'</div>';
    var css=f.css+'\n@page{size:A4 portrait;margin:0}html,body{margin:0;padding:0;background:#fff}.onePage.otkPage{position:relative;box-sizing:border-box;width:210mm;min-height:296mm;height:auto!important;overflow:visible!important;padding:8mm 10mm 22mm;font-family:Segoe UI,Arial,sans-serif;color:#172b4d}'
      +'.otkTitle{margin:10px 0 6px;font-size:18px;font-weight:900;letter-spacing:.02em;color:#172b4d;text-transform:uppercase;text-align:center}.otkMeta{display:flex;flex-wrap:wrap;gap:4px 18px;font-size:12px;margin:0 0 14px;padding:6px 0;border-top:1px solid #9aa6b2;border-bottom:1px solid #9aa6b2}'
      +'.otkTable{width:100%;border-collapse:collapse;font-size:12px;margin:6px 0 12px}.otkTable th,.otkTable td{border:1px solid #9aa6b2;padding:6px 8px;text-align:center}.otkTable th:first-child,.otkTable td:first-child{text-align:left;width:46%}.otkTable thead th{background:#eef3f7;font-weight:900}'
      +'.otkText{margin:0 0 10px;font-size:12px}.otkText b{display:block;font-size:11px;text-transform:uppercase;letter-spacing:.03em;margin-bottom:3px}.otkText p{margin:0;white-space:normal;border-bottom:1px dotted #9aa6b2;padding-bottom:4px}'
      +'.otkList{margin:0;font-size:12px}.otkList>div{display:flex;gap:14px;border-bottom:1px solid #dde3e8;padding:6px 0}.otkList dt{min-width:190px;font-weight:800}.otkList dd{margin:0}.otkEmpty{font-size:12px;color:#5d7486}'
      +'.otkBody h3{font-size:12px;margin:14px 0 4px;text-transform:uppercase;letter-spacing:.03em}.otkBody dl{margin:0;font-size:12px}.otkBody dl>div{display:flex;gap:14px;border-bottom:1px solid #dde3e8;padding:5px 0}.otkBody dt{min-width:190px;font-weight:800}.otkBody dd{margin:0;white-space:pre-wrap}.otkBody img{max-width:100%;max-height:90mm}.otkBody h4{font-size:11px;margin:10px 0 4px}'+'.otkHeadFallback{font-size:12px}.otkFootFallback{position:absolute;left:10mm;right:10mm;bottom:8mm;border-top:1px solid #9aa6b2;padding-top:4px;font-size:10px;font-weight:800}';
    var html='<!doctype html><html><head><meta charset="utf-8"><title>'+esc(title)+'</title><style>'+css+'</style></head><body><div class="onePage otkPage">'+head+'<div class="otkTitle">'+esc(title)+'</div>'+(meta?'<div class="otkMeta">'+meta+'</div>':'')+'<div class="otkBody">'+bodyHtml+'</div>'+foot+'</div></body></html>';
    var w=window.open('','_blank');if(!w)throw new Error('Il browser ha bloccato la finestra di stampa: consenti i popup per Optyker e riprova.');
    w.document.open();w.document.write(html);w.document.close();
    if(window.optykerQuotePrint&&typeof window.optykerQuotePrint.finish==='function')window.optykerQuotePrint.finish(w);else setTimeout(function(){try{w.focus();w.print()}catch(e){}},250);
  }
  function printRow(row,kindHint){
    var kind=TOOL_KIND[kindHint]||TOOL_KIND[row&&row.kind]||row&&row.kind||'';
    var v=valuesFor(row),title=(defs[kind]&&defs[kind].title)||row.title||'Scheda';
    var meta='<span><b>Cliente:</b> '+esc(clientName()||'—')+'</span><span><b>Data esame:</b> '+esc(v.examDate||dt(row.updated_at||row.created_at).split(',')[0])+'</span><span><b>'+esc(sheetDisplay(row))+'</b></span>';
    printDocument(title,meta,clinicalBody(row,kind));
  }
  function sheetRpc(action,payload){
    var c=window.OPTYKER_CLOUD||{};
    if(!(window.optykerAuthenticated&&c.username&&c.password&&c.root&&c.key))return Promise.reject(new Error('Accedi con un operatore autorizzato per eliminare la scheda.'));
    return fetch(c.root+'/rest/v1/rpc/optyker_client_sheet_actions',{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json',apikey:c.key,Authorization:'Bearer '+c.key},body:JSON.stringify({p_username:c.username,p_password:c.password,p_action:action,p_payload:payload})}).then(function(r){return r.json().catch(function(){return {}}).then(function(x){if(!r.ok||!x||!x.ok)throw new Error(x&&x.error||('HTTP '+r.status));return x})});
  }
  // Elimina tramite l'azione sicura del gestionale (copia di recupero, ordini protetti).
  function deleteRow(row,clientId){
    var cid=String(clientId||window.clientCurrentId||''),id=String(row&&row.id||'');
    if(!cid||!id)return Promise.reject(new Error('Scheda non selezionata.'));
    return sheetRpc('get',{client_id:cid,sheet_id:id}).then(function(g){
      var cur=g.data||{};return sheetRpc('delete',{client_id:cid,sheet_id:id,expected_updated_at:cur.updated_at,confirm:true});
    },function(e){
      if(!/non disponibile/i.test(e.message||''))throw e;
      return call('delete',{client_id:cid,id:id}).catch(function(){throw e});
    }).then(function(result){
      var arr=window.OPTYKER_CLOUD&&OPTYKER_CLOUD.sheets&&OPTYKER_CLOUD.sheets[cid];if(Array.isArray(arr))OPTYKER_CLOUD.sheets[cid]=arr.filter(function(x){return String(x&&x.id)!==id});
      delete state.open[id];delete state.drafts[id];
      window.dispatchEvent(new CustomEvent('optyker:sheet-removed',{detail:{client_id:cid,sheet_id:id,archived_sheet_ids:(result&&result.archived_sheet_ids)||[id]}}));window.dispatchEvent(new CustomEvent('optyker:client-cart-updated',{detail:{client_id:cid}}));
      return result;
    });
  }
  function deleteFromCard(row,btn){
    var title=(defs[row.kind]&&defs[row.kind].title)||'Scheda';
    if(!confirm('Eliminare la scheda '+title+' ('+sheetDisplay(row)+')'+(clientName()?' di '+clientName():'')+'?\n\nVerrà conservata una copia di recupero. Il cliente non viene eliminato.'))return;
    if(btn){btn.disabled=true;btn.textContent='Eliminazione…'}
    deleteRow(row).then(function(){return load(true)}).catch(function(e){alert('Impossibile eliminare la scheda: '+(e.message||e));if(btn&&btn.isConnected){btn.disabled=false;btn.textContent='Elimina'}});
  }
  window.OPTYKER_CLIENT_TOOLS={version:'20261003-actions1',toolKind:function(k){return TOOL_KIND[k]||''},printRow:printRow,printDocument:printDocument,deleteRow:deleteRow};
  window.addEventListener('optyker:sheet-removed',function(e){var d=e&&e.detail||{};if(String(d.client_id||'')===state.clientId)load(true)});
  function hook(){
    if(typeof window.clientSelect==='function'&&!window.clientSelect.__clientToolsHook){var old=window.clientSelect,w=function(){var r=old.apply(this,arguments);setTimeout(function(){load(true)},120);return r};w.__clientToolsHook=true;window.clientSelect=w}
  }
  function install(){hook();var cid=String(window.clientCurrentId||'');if(cid&&cid!==state.clientId)load(true);else if(cid&&state.data&&blocksMissing())renderAll()}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
  setInterval(install,800);
})();

(function(){
  if(window.__optykerCashDayControlLoader)return;window.__optykerCashDayControlLoader=true;
  var s=document.createElement('script');s.src='https://raw.githubusercontent.com/Leahcim12/optyker-web/main/cash-day-control.js?v=20260915-2';s.async=true;(document.head||document.documentElement).appendChild(s);
})();

/* OPTYKER_CASH_DAY_CONTROL_INLINE_V1 */
(function(){
'use strict';
if(window.__optykerCashDayControlV1)return;
window.__optykerCashDayControlV1='20260915-inline1';

var API_DAY='https://whgziwaegjzqsgcntesr.supabase.co/functions/v1/optyker-cash-day-api';
var cashDayState={metrics:null,loading:false,last:0};

function cashDayE(id){return document.getElementById(id)}
function cashDayMoney(v){var n=Number(v||0);if(!isFinite(n))n=0;try{return new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR'}).format(n)}catch(e){return n.toFixed(2)+' €'}}
function cashDayNum(v){var n=Number(String(v==null?'':v).replace(',','.'));return isFinite(n)?Math.round(n*100)/100:NaN}
function cashDayEsc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function cashDayCreds(){var c=window.OPTYKER_CLOUD||{};return {username:String(c.username||window.OPTYKER_ACTIVE_USER||'').trim(),password:String(c.password||'')}}
function cashDayTodayRome(){
  var p=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()),o={};
  p.forEach(function(x){if(x.type!=='literal')o[x.type]=x.value});
  return o.year+'-'+o.month+'-'+o.day;
}
function cashDayCall(action,payload){
  var c=cashDayCreds();
  if(!c.username||!c.password)return Promise.reject(new Error('Sessione operatore non disponibile. Esci e accedi nuovamente.'));
  return fetch(API_DAY,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:action,username:c.username,password:c.password,payload:payload||{}})})
    .then(function(r){return r.json().catch(function(){return {}}).then(function(x){if(!r.ok||!x||x.ok===false)throw new Error(x&&x.error||('HTTP '+r.status));return x})});
}
function cashDayToast(msg,type){
  var t=cashDayE('optykerCashDayToast');
  if(!t){t=document.createElement('div');t.id='optykerCashDayToast';document.body.appendChild(t)}
  t.className=type||'';t.textContent=msg;t.style.display='block';clearTimeout(t.__timer);t.__timer=setTimeout(function(){t.style.display='none'},4200);
}
function cashDayInjectStyle(){
  if(cashDayE('optykerCashDayStyle'))return;
  var s=document.createElement('style');s.id='optykerCashDayStyle';s.textContent='\
#optykerCashDayActions{display:flex;align-items:center;gap:7px;margin-right:2px}.optykerCashDayBtn{height:36px;border:1px solid #c9d8e5;border-radius:9px;background:#fff;color:#173b5e;padding:0 11px;font:800 11px/1 "Segoe UI",Arial,sans-serif;cursor:pointer;white-space:nowrap;box-shadow:0 1px 3px rgba(20,48,72,.06)}.optykerCashDayBtn:hover:not(:disabled){border-color:#1769aa;background:#f3f9fd}.optykerCashDayBtn.open{background:#eaf7ef;border-color:#b8dfc5;color:#176b39}.optykerCashDayBtn.close{background:#fff1f0;border-color:#efc8c4;color:#a2352d}.optykerCashDayBtn:disabled{opacity:.45;cursor:not-allowed}.optykerCashDayState{height:28px;display:inline-flex;align-items:center;border-radius:999px;padding:0 9px;background:#eef4f8;color:#526a7d;font:800 9px/1 "Segoe UI",Arial,sans-serif;white-space:nowrap}.optykerCashDayState.open{background:#e8f6ed;color:#176b39}.optykerCashDayState.closed{background:#eef1f4;color:#4b5c6b}.optykerCashDayState.pending{background:#fff7df;color:#87640e}\
#optykerCashDayModal{position:fixed;inset:0;z-index:2147483644;background:rgba(10,28,45,.52);display:none;align-items:center;justify-content:center;padding:18px;box-sizing:border-box;backdrop-filter:blur(2px)}#optykerCashDayModal.open{display:flex}.optykerCashDayCard{width:min(560px,100%);max-height:92vh;overflow:auto;background:#fff;border:1px solid #dbe5ed;border-radius:18px;box-shadow:0 24px 70px rgba(11,35,58,.28);padding:22px;box-sizing:border-box}.optykerCashDayHead{display:flex;justify-content:space-between;gap:16px;align-items:flex-start}.optykerCashDayEyebrow{font-size:9px;font-weight:900;letter-spacing:.11em;color:#1769aa;text-transform:uppercase}.optykerCashDayTitle{font-size:23px;font-weight:950;color:#173b5e;margin-top:3px}.optykerCashDaySub{font-size:11px;line-height:1.45;color:#6c7f8f;margin-top:6px}.optykerCashDayX{width:34px;height:34px;border:0;border-radius:9px;background:#eef3f7;color:#486176;font-size:21px;cursor:pointer}.optykerCashDaySummary{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;margin:17px 0}.optykerCashDayMetric{border:1px solid #e0e8ef;border-radius:11px;background:#f8fbfd;padding:11px}.optykerCashDayMetric span{display:block;font-size:9px;font-weight:850;color:#748696;text-transform:uppercase;letter-spacing:.05em}.optykerCashDayMetric b{display:block;font-size:17px;color:#1d3d58;margin-top:4px}.optykerCashDayField{margin-top:13px}.optykerCashDayField label{display:block;font-size:11px;font-weight:850;color:#3f566a;margin-bottom:6px}.optykerCashDayField input,.optykerCashDayField textarea{width:100%;box-sizing:border-box;border:1px solid #cbd8e3;border-radius:10px;background:#fff;color:#173b5e;font:700 14px/1.2 "Segoe UI",Arial,sans-serif;padding:11px;outline:none}.optykerCashDayField input:focus,.optykerCashDayField textarea:focus{border-color:#1769aa;box-shadow:0 0 0 3px rgba(23,105,170,.11)}.optykerCashDayField textarea{min-height:72px;resize:vertical;font-size:12px;font-weight:600}.optykerCashDayHint{font-size:10px;color:#7b8c99;margin-top:5px;line-height:1.4}.optykerCashDayCalc{margin-top:13px;border-radius:10px;background:#eef7fd;border:1px solid #d1e6f5;padding:11px;display:flex;justify-content:space-between;gap:12px;align-items:center;font-size:11px;color:#4e6678}.optykerCashDayCalc strong{font-size:16px;color:#1769aa}.optykerCashDayNotice{margin-top:14px;border:1px solid #dde7ee;border-radius:10px;background:#f8fbfd;padding:10px;font-size:10px;line-height:1.45;color:#657989}.optykerCashDayActionsRow{display:flex;justify-content:flex-end;gap:9px;margin-top:18px}.optykerCashDayActionsRow button{height:40px;border:0;border-radius:10px;padding:0 15px;font:850 11px/1 "Segoe UI",Arial,sans-serif;cursor:pointer}.optykerCashDayCancel{background:#edf2f6;color:#425a70}.optykerCashDayConfirm{background:#1769aa;color:#fff;box-shadow:0 5px 14px rgba(23,105,170,.22)}.optykerCashDayConfirm.danger{background:#a84035}.optykerCashDayActionsRow button:disabled{opacity:.55;cursor:wait}#optykerCashDayToast{position:fixed;z-index:2147483647;right:20px;bottom:20px;max-width:min(440px,calc(100vw - 40px));display:none;background:#173b5e;color:#fff;border-radius:11px;padding:12px 15px;font:750 11px/1.4 "Segoe UI",Arial,sans-serif;box-shadow:0 14px 36px rgba(12,35,55,.25)}#optykerCashDayToast.ok{background:#176b39}#optykerCashDayToast.error{background:#a2352d}\
@media(max-width:1050px){#optykerCashDayActions{gap:4px}.optykerCashDayState{display:none}.optykerCashDayBtn{padding:0 8px;font-size:10px}}@media(max-width:760px){#optykerCashDayActions{order:5;width:100%;justify-content:flex-end;margin-top:6px}.optykerCashDaySummary{grid-template-columns:1fr}}';
  document.head.appendChild(s);
}
function cashDayEnsureModal(){
  var m=cashDayE('optykerCashDayModal');if(m)return m;
  m=document.createElement('div');m.id='optykerCashDayModal';m.innerHTML='<div class="optykerCashDayCard" role="dialog" aria-modal="true"><div id="optykerCashDayModalBody"></div></div>';
  m.addEventListener('click',function(ev){if(ev.target===m)cashDayCloseModal()});document.body.appendChild(m);return m;
}
function cashDayCloseModal(){var m=cashDayE('optykerCashDayModal');if(m)m.classList.remove('open')}
function cashDayOpenModal(html){var m=cashDayEnsureModal(),b=cashDayE('optykerCashDayModalBody');b.innerHTML=html;m.classList.add('open');var x=b.querySelector('[data-day-x]');if(x)x.onclick=cashDayCloseModal;var c=b.querySelector('[data-day-cancel]');if(c)c.onclick=cashDayCloseModal}
function cashDayMetricVal(m,k){var n=Number(m&&m[k]||0);return isFinite(n)?n:0}
function cashDayOpeningCash(m){return cashDayMetricVal(m&&m.opening,'opening_cash')}
function cashDayExpectedCash(m){return Math.round((cashDayOpeningCash(m)+cashDayMetricVal(m,'cash_total'))*100)/100}
function cashDaySetButtons(m){
  var ob=cashDayE('optykerCashDayOpenBtn'),cb=cashDayE('optykerCashDayCloseBtn'),st=cashDayE('optykerCashDayState');if(!ob||!cb||!st)return;
  var opened=!!(m&&m.opened),closed=!!(m&&m.closed),suggest=cashDayMetricVal(m,'suggested_opening_cash');
  ob.disabled=opened||closed||cashDayState.loading;cb.disabled=!opened||closed||cashDayState.loading;
  st.className='optykerCashDayState '+(closed?'closed':opened?'open':'pending');
  if(closed)st.textContent='Cassa chiusa';
  else if(opened)st.textContent='Aperta · fondo '+cashDayMoney(cashDayOpeningCash(m));
  else st.textContent='Da aprire · fondo '+cashDayMoney(suggest);
}
function cashDayRefresh(force){
  if(cashDayState.loading)return Promise.resolve(cashDayState.metrics);
  if(!force&&cashDayState.metrics&&Date.now()-cashDayState.last<12000){cashDaySetButtons(cashDayState.metrics);return Promise.resolve(cashDayState.metrics)}
  cashDayState.loading=true;cashDaySetButtons(cashDayState.metrics);
  return cashDayCall('status',{date:cashDayTodayRome()}).then(function(x){cashDayState.metrics=x.data||{};cashDayState.last=Date.now();cashDaySetButtons(cashDayState.metrics);return cashDayState.metrics})
    .catch(function(e){var st=cashDayE('optykerCashDayState');if(st){st.className='optykerCashDayState';st.textContent='Stato non disponibile'};throw e})
    .finally(function(){cashDayState.loading=false;cashDaySetButtons(cashDayState.metrics)});
}
function cashDayHead(title,sub){return '<div class="optykerCashDayHead"><div><div class="optykerCashDayEyebrow">Gestione giornata</div><div class="optykerCashDayTitle">'+cashDayEsc(title)+'</div><div class="optykerCashDaySub">'+cashDayEsc(sub)+'</div></div><button class="optykerCashDayX" data-day-x type="button" aria-label="Chiudi">×</button></div>'}
function cashDayNotesField(){return '<div class="optykerCashDayField"><label>Note (facoltative)</label><textarea id="optykerCashDayNotes" maxlength="500" placeholder="Eventuali annotazioni sulla giornata…"></textarea></div>'}
function cashDayOpenOpening(){
  cashDayRefresh(true).then(function(m){
    if(m.closed)return cashDayToast('La cassa di oggi risulta già chiusa.','error');
    if(m.opened)return cashDayToast('La cassa di oggi è già aperta.','error');
    var suggested=cashDayMetricVal(m,'suggested_opening_cash');
    cashDayOpenModal(cashDayHead('Apertura cassa','Inserisci il fondo presente nel cassetto. Il valore è già proposto dalla chiusura precedente.')+
      '<div class="optykerCashDaySummary"><div class="optykerCashDayMetric"><span>Fondo dalla chiusura precedente</span><b>'+cashDayMoney(suggested)+'</b></div><div class="optykerCashDayMetric"><span>Data</span><b>'+cashDayTodayRome().split('-').reverse().join('/')+'</b></div></div>'+
      '<div class="optykerCashDayField"><label>Fondo cassa iniziale</label><input id="optykerCashDayOpening" type="number" min="0" step="0.01" inputmode="decimal" value="'+suggested.toFixed(2)+'"><div class="optykerCashDayHint">Puoi modificarlo se il contante realmente presente è diverso.</div></div>'+cashDayNotesField()+
      '<div class="optykerCashDayNotice"><b>Nessun comando fiscale:</b> l’apertura registra solo il fondo in Optyker e non apre il cassetto RCH.</div>'+
      '<div class="optykerCashDayActionsRow"><button class="optykerCashDayCancel" data-day-cancel type="button">Annulla</button><button class="optykerCashDayConfirm" id="optykerCashDayOpenConfirm" type="button">Conferma apertura</button></div>');
    var input=cashDayE('optykerCashDayOpening');if(input){input.focus();input.select()}
    cashDayE('optykerCashDayOpenConfirm').onclick=function(){
      var amount=cashDayNum(cashDayE('optykerCashDayOpening').value),notes=String(cashDayE('optykerCashDayNotes').value||'').trim();
      if(!isFinite(amount)||amount<0)return cashDayToast('Inserisci un fondo cassa valido.','error');
      var b=this;b.disabled=true;b.textContent='Apertura…';
      cashDayCall('open',{date:cashDayTodayRome(),opening_cash:amount,notes:notes}).then(function(x){cashDayState.metrics=x.data||{};cashDayState.last=Date.now();cashDaySetButtons(cashDayState.metrics);cashDayCloseModal();cashDayToast('Cassa aperta · fondo '+cashDayMoney(amount),'ok')})
        .catch(function(e){cashDayToast('Apertura non registrata: '+e.message,'error')}).finally(function(){b.disabled=false;b.textContent='Conferma apertura'});
    };
  }).catch(function(e){cashDayToast('Impossibile leggere la cassa: '+e.message,'error')});
}
function cashDayOpenClosure(){
  cashDayRefresh(true).then(function(m){
    if(m.closed)return cashDayToast('La cassa di oggi risulta già chiusa.','error');
    if(!m.opened)return cashDayToast('Prima devi registrare l’apertura cassa.','error');
    var expected=cashDayExpectedCash(m),currentFund=cashDayOpeningCash(m),cashSales=cashDayMetricVal(m,'cash_total');
    cashDayOpenModal(cashDayHead('Chiusura cassa','Conta il contante e scegli quanto lasciare come fondo per la prossima apertura.')+
      '<div class="optykerCashDaySummary"><div class="optykerCashDayMetric"><span>Fondo iniziale</span><b>'+cashDayMoney(currentFund)+'</b></div><div class="optykerCashDayMetric"><span>Incassi contanti Optyker</span><b>'+cashDayMoney(cashSales)+'</b></div><div class="optykerCashDayMetric"><span>Contante previsto</span><b>'+cashDayMoney(expected)+'</b></div><div class="optykerCashDayMetric"><span>Pagamenti carta</span><b>'+cashDayMoney(cashDayMetricVal(m,'card_total'))+'</b></div></div>'+
      '<div class="optykerCashDayField"><label>Contante realmente contato</label><input id="optykerCashDayCounted" type="number" min="0" step="0.01" inputmode="decimal" value="'+expected.toFixed(2)+'"></div>'+
      '<div class="optykerCashDayField"><label>Fondo da lasciare per la prossima apertura</label><input id="optykerCashDayNextFund" type="number" min="0" step="0.01" inputmode="decimal" value="'+currentFund.toFixed(2)+'"><div class="optykerCashDayHint">Questo importo comparirà automaticamente nel pulsante Apertura cassa della giornata successiva.</div></div>'+
      '<div class="optykerCashDayCalc"><span>Contante da prelevare dal cassetto</span><strong id="optykerCashDayTake">'+cashDayMoney(Math.max(0,expected-currentFund))+'</strong></div>'+cashDayNotesField()+
      '<div class="optykerCashDayNotice"><b>Chiusura gestionale Optyker:</b> non esegue la chiusura fiscale Z e non invia comandi alla RCH.</div>'+
      '<div class="optykerCashDayActionsRow"><button class="optykerCashDayCancel" data-day-cancel type="button">Annulla</button><button class="optykerCashDayConfirm danger" id="optykerCashDayCloseConfirm" type="button">Conferma chiusura</button></div>');
    function calc(){var counted=cashDayNum(cashDayE('optykerCashDayCounted').value),fund=cashDayNum(cashDayE('optykerCashDayNextFund').value),take=(isFinite(counted)&&isFinite(fund))?counted-fund:NaN;cashDayE('optykerCashDayTake').textContent=isFinite(take)?cashDayMoney(Math.max(0,take)):'—'}
    cashDayE('optykerCashDayCounted').oninput=calc;cashDayE('optykerCashDayNextFund').oninput=calc;cashDayE('optykerCashDayCounted').focus();cashDayE('optykerCashDayCounted').select();
    cashDayE('optykerCashDayCloseConfirm').onclick=function(){
      var counted=cashDayNum(cashDayE('optykerCashDayCounted').value),fund=cashDayNum(cashDayE('optykerCashDayNextFund').value),notes=String(cashDayE('optykerCashDayNotes').value||'').trim();
      if(!isFinite(counted)||counted<0)return cashDayToast('Inserisci il contante contato.','error');
      if(!isFinite(fund)||fund<0)return cashDayToast('Inserisci un fondo valido per la prossima apertura.','error');
      if(fund>counted+0.005)return cashDayToast('Il fondo non può superare il contante contato.','error');
      var diff=Math.round((counted-expected)*100)/100;
      var confirmText='Chiudere la cassa con '+cashDayMoney(counted)+' contati e lasciare '+cashDayMoney(fund)+' come fondo per la prossima apertura?'+(Math.abs(diff)>=0.01?'\n\nDifferenza rispetto al previsto: '+cashDayMoney(diff):'');
      if(!window.confirm(confirmText))return;
      var b=this;b.disabled=true;b.textContent='Chiusura…';
      cashDayCall('close',{date:cashDayTodayRome(),cash_counted:counted,next_opening_cash:fund,notes:notes}).then(function(x){cashDayState.metrics=x.data||{};cashDayState.last=Date.now();cashDaySetButtons(cashDayState.metrics);cashDayCloseModal();cashDayToast('Cassa chiusa · fondo prossimo giorno '+cashDayMoney(fund),'ok')})
        .catch(function(e){cashDayToast('Chiusura non registrata: '+e.message,'error')}).finally(function(){b.disabled=false;b.textContent='Conferma chiusura'});
    };
  }).catch(function(e){cashDayToast('Impossibile leggere la cassa: '+e.message,'error')});
}
function cashDayInstall(){
  cashDayInjectStyle();
  var overlay=cashDayE('optykerCashOverlay'),right=overlay&&overlay.querySelector('.optykerCashHeaderRight');if(!overlay||!right)return;
  if(!cashDayE('optykerCashDayActions')){
    var box=document.createElement('div');box.id='optykerCashDayActions';
    box.innerHTML='<span id="optykerCashDayState" class="optykerCashDayState">Verifica cassa…</span><button id="optykerCashDayOpenBtn" class="optykerCashDayBtn open" type="button">Apertura cassa</button><button id="optykerCashDayCloseBtn" class="optykerCashDayBtn close" type="button">Chiusura cassa</button>';
    right.insertBefore(box,right.firstChild);
    cashDayE('optykerCashDayOpenBtn').onclick=cashDayOpenOpening;cashDayE('optykerCashDayCloseBtn').onclick=cashDayOpenClosure;
    cashDayRefresh(true).catch(function(){});
  }else if(Date.now()-cashDayState.last>30000){cashDayRefresh(false).catch(function(){})}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',cashDayInstall);else cashDayInstall();
new MutationObserver(function(){cashDayInstall()}).observe(document.documentElement,{childList:true,subtree:true});
setInterval(function(){if(cashDayE('optykerCashOverlay'))cashDayInstall()},5000);
})();

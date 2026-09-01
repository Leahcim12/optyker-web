(function(){
  if(window.__optykerClientToolsPatch)return;window.__optykerClientToolsPatch=true;
  var API='https://whgziwaegjzqsgcntesr.supabase.co/functions/v1/optyker-client-tools-api';
  var state={clientId:'',data:null,loading:false,last:0};
  var defs={
    usage:{title:"Indicazioni d’uso",fields:['examDate','instructions','products','maintenance','notes']},
    protocol_ovc:{title:'Protocollo VC',fields:['examDate','reason','anamnesis','visualAcuity','refraction','binocularVision','accommodation','motility','outcome','notes']},
    protocol_ovc_bambini:{title:'Protocollo VC Bambini',fields:['examDate','reason','parentNotes','visualAcuity','coverTest','motility','accommodation','stereopsis','colorVision','outcome','notes']},
    analisi_visiva_integrata:{title:'Analisi Visiva Integrata',fields:['examDate','reason','anamnesis','visualAcuity','refraction','binocularVision','accommodation','motility','outcome','recommendations','notes']},
    fondo_oculare:{title:'Fondo Oculare',fields:['examDate','odFindings','osFindings','outcome','recommendations','notes']},
    visual_anomalies:{title:'Anomalie visive',fields:['examDate','anomaly','tests','findings','outcome','recommendations','notes']}
  };
  var labels={examDate:'Data esame',reason:'Motivo',anamnesis:'Anamnesi',visualAcuity:'Acuità visiva',refraction:'Refrazione',binocularVision:'Visione binoculare',accommodation:'Accomodazione',motility:'Motilità',outcome:'Esito',recommendations:'Indicazioni / raccomandazioni',notes:'Note',parentNotes:'Note genitore',coverTest:'Cover test',stereopsis:'Stereopsi',colorVision:'Visione dei colori',anomaly:'Anomalia visiva',tests:'Test eseguiti',findings:'Risultati',odFindings:'Fondo OD',osFindings:'Fondo OS',instructions:"Indicazioni d’uso",products:'Prodotti',maintenance:'Manutenzione'};
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
  function clinicalGroups(){var rows=state.data&&state.data.clinical_sheets||[],kinds=['usage','protocol_ovc','protocol_ovc_bambini','analisi_visiva_integrata','fondo_oculare'];return kinds.map(function(k){var a=rows.filter(function(x){return x.kind===k}),d=defs[k];return '<div class="optykerClinicalGroup"><div class="optykerClinicalGroupHead"><div class="optykerClinicalGroupTitle">'+esc(d.title)+'</div><button class="optykerClientToolsBtn" data-tools-new="'+k+'" type="button">+ Crea scheda</button></div>'+(a.length?a.map(cardHtml).join(''):'<div class="optykerEmptySmall">Nessuna scheda.</div>')+'</div>'}).join('')}
  function cardHtml(s){var out=getVal(s,'outcome');return '<div class="optykerClinicalCard" data-tools-card="'+esc(s.id)+'"><div class="optykerClinicalSummary"><strong>'+esc((defs[s.kind]&&defs[s.kind].title)||s.title||'Scheda')+'</strong><span>'+esc(dt(s.updated_at||s.created_at))+' ▾</span></div>'+(s.kind==='visual_anomalies'&&out?'<div class="optykerAnomalyOutcome"><b>Esito:</b> '+esc(out)+'</div>':'')+'<div class="optykerClinicalEditor"><div class="optykerClinicalFields">'+fieldsFor(s).map(function(k){return fieldHtml(s,k)}).join('')+'</div><div class="optykerClinicalSaveRow"><button class="optykerClientToolsBtn primary" data-tools-save="'+esc(s.id)+'" type="button">SALVA SCHEDA</button></div></div></div>'}
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
  function renderAll(){if(String(window.clientCurrentId||'')!==state.clientId)return;renderClinical();renderAnomalies();renderPayments()}
  function bind(root){
    Array.prototype.forEach.call(root.querySelectorAll('.optykerClinicalSummary'),function(x){x.onclick=function(){this.closest('.optykerClinicalCard').classList.toggle('open')}});
    Array.prototype.forEach.call(root.querySelectorAll('[data-tools-new]'),function(x){x.onclick=function(){createSheet(this.getAttribute('data-tools-new'))}});
    Array.prototype.forEach.call(root.querySelectorAll('[data-tools-save]'),function(x){x.onclick=function(){saveSheet(this.getAttribute('data-tools-save'),this.closest('.optykerClinicalCard'))}});
  }
  function load(force){
    var cid=String(window.clientCurrentId||'');if(!cid){state.clientId='';state.data=null;['optykerClientClinicalTools','optykerClientAnomalyTools','optykerClientPaymentTools'].forEach(function(id){var x=E(id);if(x)x.remove()});return Promise.resolve()}
    if(state.loading)return Promise.resolve();if(!force&&cid===state.clientId&&Date.now()-state.last<10000){renderAll();return Promise.resolve()}
    state.clientId=cid;state.loading=true;
    return call('list',{client_id:cid}).then(function(x){if(cid===String(window.clientCurrentId||'')){state.data=x.data||{};state.last=Date.now();renderAll()}}).catch(function(e){console.warn('Optyker client tools:',e)}).finally(function(){state.loading=false})
  }
  function createSheet(k){var cid=String(window.clientCurrentId||'');if(!cid)return;call('create',{client_id:cid,kind:k}).then(function(x){if(x.data)cloudReplace(x.data);return load(true)}).then(function(){setTimeout(function(){var cards=document.querySelectorAll('.optykerClinicalCard');if(cards.length){cards[0].classList.add('open');cards[0].scrollIntoView({behavior:'smooth',block:'center'})}},60)}).catch(function(e){alert('Impossibile creare la scheda: '+e.message)})}
  function saveSheet(id,card){var cid=String(window.clientCurrentId||'');if(!cid||!id||!card)return;var values={};Array.prototype.forEach.call(card.querySelectorAll('[data-tools-key]'),function(x){values[x.getAttribute('data-tools-key')]=x.value});var b=card.querySelector('[data-tools-save]');if(b){b.disabled=true;b.textContent='Salvataggio…'}call('update',{client_id:cid,id:id,values:values}).then(function(x){if(x.data)cloudReplace(x.data);return load(true)}).then(function(){alert('Scheda aggiornata')}).catch(function(e){alert('Impossibile salvare: '+e.message)}).finally(function(){if(b){b.disabled=false;b.textContent='SALVA SCHEDA'}})}
  function hook(){
    if(typeof window.clientSelect==='function'&&!window.clientSelect.__clientToolsHook){var old=window.clientSelect,w=function(){var r=old.apply(this,arguments);setTimeout(function(){load(true)},120);return r};w.__clientToolsHook=true;window.clientSelect=w}
  }
  function install(){hook();var cid=String(window.clientCurrentId||'');if(cid&&cid!==state.clientId)load(true);else if(cid&&state.data)renderAll()}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
  setInterval(install,800);
})();
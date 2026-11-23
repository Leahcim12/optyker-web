/* OPTYKER_SEPT11_PREPARED */
(function(){
if(window.__optykerCashLoaded)return;window.__optykerCashLoaded=true;
window.OPTYKER_CASH_BUILD='20260914-stock-cf1';
/* OPTYKER_MANUAL_POS_PRICE_20260914 */
var API='https://whgziwaegjzqsgcntesr.supabase.co/functions/v1/optyker-cash-register-api';
var LOCAL_API='https://whgziwaegjzqsgcntesr.supabase.co/functions/v1/optyker-cash-local-api';
var S={products:[],clients:[],cart:{},type:'',payment:'card',stage:'balance',clientId:'',invoice:false,tsRequested:false,tsCode:'AD',tsOpposition:false,busy:false,searchTimer:null,clientSearchTimer:null,rchOk:false,cashOpen:false};

function E(id){return document.getElementById(id)}
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function creds(){var c=window.OPTYKER_CLOUD||{};return {username:String(c.username||window.OPTYKER_ACTIVE_USER||'').trim(),password:String(c.password||'')}}
function api(action,payload){
  var c=creds();if(!c.username||!c.password)return Promise.reject(new Error('Sessione operatore non disponibile. Esci e accedi nuovamente.'));
  var endpoint=action==='checkout'?LOCAL_API:API;
  return fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:action,username:c.username,password:c.password,payload:payload||{}})})
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
  var control=new AbortController(),timer=setTimeout(function(){control.abort()},30000);opts.signal=control.signal;
  return fetch(rchBridge()+path,opts).then(function(r){return r.json().then(function(x){if(!r.ok||!x||x.ok!==true)throw new Error(x&&x.error||('Risposta RCH non valida · HTTP '+r.status));return x})})
    .catch(function(e){if(e.name==='AbortError')throw new Error('La risposta RCH non è arrivata. Verifica il registratore prima di ripetere un comando di stampa.');throw e})
    .finally(function(){clearTimeout(timer)})
}
function testRch(quiet){
  return rchRequest('/health').then(function(h){
    if(h.version!=='1.8-auto-receipt')throw new Error('Aggiorna il connettore RCH dalla finestra di configurazione.');
    return rchRequest('/status')
  }).then(function(x){
    var extra=x.mode?(' · '+x.mode):' · modalità non disponibile';
    var reg=!!window.OPTYKER_RCH_PREFLIGHT&&window.OPTYKER_RCH_PREFLIGHT.registrationMode(x);
    rchStatusUi(reg,'● RCH raggiungibile'+extra);
    if(!quiet)toast(reg?'RCH pronta: puoi usare Incassa e stampa.':'RCH risponde, ma non risulta in modalità REG.','');return x
  }).catch(function(e){
    rchStatusUi(false,'○ RCH da verificare');
    if(!quiet)toast('RCH da verificare: '+e.message,'error');
    throw e
  })
}
function downloadRchDiagnostics(){
  var b=E('optykerCashRchDiagnostics'),r=E('optykerCashRchResult');
  b.disabled=true;r.textContent='Raccolta diagnosi dal PC della cassa…';r.className='optykerCashRchResult';
  return rchRequest('/health').then(function(h){
    if(h.version!=='1.8-auto-receipt')throw new Error('Installa / aggiorna il connettore, poi riprova.');
    return rchRequest('/diagnostics')
  }).then(function(report){
    if(report.reportGenerated!==true||report.readOnly!==true)throw new Error('Rapporto diagnostico incompleto.');
    if(window.OPTYKER_RCH_PREFLIGHT){
      report.acquiredConfiguration=window.OPTYKER_RCH_PREFLIGHT.getProfile();
      report.configurationNote='Configurazione letta dalla RCH il 12/09/2026 e confrontata con i dati del negozio. Non viene riletta durante questa diagnosi.';
      var probes=report.probes||[],last=probes.length?probes[probes.length-1].result:null;
      report.registrationModeVerified=window.OPTYKER_RCH_PREFLIGHT.registrationMode(last);
    }
    var url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}));
    var a=document.createElement('a');a.href=url;a.download='Diagnostica-RCH-Optyker.json';document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(url)},1000);
    r.textContent='Diagnosi scaricata. '+(report.statusAccepted?'Richiesta di stato accettata.':report.printerReached?'RCH raggiungibile, ma la richiesta di stato non è stata accettata.':'Nessuna risposta RCH valida: verificare il collegamento.')+(report.registrationModeVerified?' Modalità REG rilevata.':' Modalità REG non verificata.')+' Diagnosi di sola lettura: per emettere apri Emissione / esito RCH dalla vendita.';
    r.className='optykerCashRchResult'+(report.registrationModeVerified?' ok':' error')
  }).catch(function(e){r.textContent=e.message+' Se il browser blocca l’accesso locale, usa “Diagnostica Windows”.';r.className='optykerCashRchResult error'})
    .finally(function(){b.disabled=false})
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
    '<div class="optykerCashRchHelp"><b>Configurazione letta dalla cassa · 12/09/2026</b><div id="optykerCashRchProfile"></div></div>'+
    '<div class="optykerCashRchHelp"><b>Stampa al pagamento e registrazione automatica</b><br>Aggiorna il connettore alla versione 1.8 per acquisire numero, data e totale direttamente dal giornale della RCH.<br>Invii e ricevute Sistema TS sono consultabili in Amministrazione → Sistema TS.</div>'+
    '<div class="optykerCashRchHelp"><button id="optykerCashRchPreflight" type="button">Controlla carrello · senza stampa</button><div id="optykerCashRchPreflightResult" role="status" aria-live="polite"></div></div>'+
    '<div id="optykerCashRchResult" class="optykerCashRchResult">Pronto per il test.</div>'+
    '<div class="optykerCashRchDownloads optykerCashRchDownloadsAuto"><a class="primary" href="/rch-connector/Attiva-Avvio-Automatico-RCH.bat?v=20260913-autostart1" download>Attiva avvio automatico Windows</a><a href="/rch-connector/Installa-RCH-Optyker.bat?v=20260913-cash4" download>Installa / aggiorna connettore</a><a href="/rch-connector/Diagnostica-RCH-Optyker.bat?v=20260912-void1" download>Diagnostica Windows</a><a href="/rch-connector/Disinstalla-RCH-Optyker.ps1?v=20260913-autostart1" download>Rimuovi avvio automatico</a></div>'+
    '<div class="optykerCashRchHelp">Il <b>Test collegamento</b> controlla soltanto la comunicazione e non emette documenti fiscali. <b>Apri cassetto</b> è la prova hardware più semplice: apre solo il cassetto contanti senza stampare uno scontrino.</div>'+
    '<div class="optykerCashRchActions optykerCashRchActions4"><button id="optykerCashRchTest" type="button">Test collegamento</button><button id="optykerCashRchDiagnostics" type="button">Scarica diagnosi</button><button id="optykerCashRchDrawerTest" type="button">Apri cassetto</button><button class="optykerCashModalClose" type="button">Chiudi</button></div></div>';
  m.classList.add('open');
  var preflight=window.OPTYKER_RCH_PREFLIGHT,profileBox=E('optykerCashRchProfile');
  if(preflight){
    var profile=preflight.getProfile();
    profileBox.innerHTML='<p>Matricola rilevata: <b>'+esc(profile.expectedSerial)+'</b>. La configurazione mostrata si riferisce alla lettura del 12/09/2026.</p>'+
      '<table><caption>Reparti confermati per Optyker</caption><thead><tr><th scope="col">Reparto</th><th scope="col">Tipo</th><th scope="col">IVA</th></tr></thead><tbody>'+profile.departments.map(function(d){return '<tr><td>'+esc(d.department)+'</td><td>'+esc(d.saleType==='goods'?'Beni':'Servizi')+'</td><td>'+esc(d.nature?'Esente '+d.nature+' · '+d.vatCode:d.rate+'%')+'</td></tr>'}).join('')+'</tbody></table>'+
      '<table><caption>Codici pagamento del registratore</caption><thead><tr><th scope="col">Codice</th><th scope="col">Pagamento</th></tr></thead><tbody>'+profile.payments.filter(function(p){return p.code===1||p.code===2||p.code===3||p.code===4||p.code===6||p.code===7}).map(function(p){return '<tr><td>'+esc(String(p.code).padStart(2,'0'))+'</td><td>'+esc(p.label)+'</td></tr>'}).join('')+'</tbody></table><p>IVA 10%, 5% e operazioni escluse: reparto ancora da assegnare in Optyker. La presenza dell’aliquota nella cassa non assegna un reparto.</p>';
  }else profileBox.textContent='Modulo di verifica non caricato. Ricarica Optyker.';
  E('optykerCashRchPreflight').disabled=!preflight;
  E('optykerCashRchPreflight').onclick=function(){
    // This check is local only: no customer details, network calls or fiscal commands.
    var report=preflight.validate({paymentMethod:S.payment,stage:S.stage,invoice:!!S.invoice,tsRequested:!!S.tsRequested,talkingReceipt:!!S.tsRequested,
      lines:payableCartRows().map(function(x){return {description:x.item.title,quantity:x.qty,unitPriceCents:preflight.toCents(x.unitPrice==null?x.item.price:x.unitPrice),vatCode:x.item.fiscal_vat_code||'',saleType:x.item.fiscal_item_type}})});
    var result=E('optykerCashRchPreflightResult');
    result.innerHTML='<p><b>Controllo preliminare: nessun documento emesso.</b></p>'+(report.payment?'<p>Pagamento: '+esc(report.payment.label)+' · codice '+esc(String(report.payment.code).padStart(2,'0'))+'</p>':'')+
      (report.issues.length?'<ul>'+report.issues.map(function(i){return '<li>'+esc((i.line!==undefined?'Riga '+(i.line+1)+': ':'')+i.message)+'</li>'}).join('')+'</ul>':'<p>Dati del carrello compatibili con il profilo acquisito.</p>')+
      '<p>Emissione ancora bloccata:</p><ul>'+report.blockers.map(function(i){return '<li>'+esc(i.message)+'</li>'}).join('')+'</ul><p>La verifica non salva IVA o altre modifiche sui prodotti.</p>';
  };
  m.querySelector('.optykerCashModalClose').onclick=function(){m.classList.remove('open')};
  m.onclick=function(ev){if(ev.target===m)m.classList.remove('open')};
  E('optykerCashRchDiagnostics').onclick=downloadRchDiagnostics;
  E('optykerCashRchTest').onclick=function(){
    var r=E('optykerCashRchResult');r.textContent='Collegamento in corso…';r.className='optykerCashRchResult';
    testRch(true).then(function(x){var reg=!!preflight&&preflight.registrationMode(x);r.textContent='RCH risponde'+(x.mode?' · modalità '+x.mode:' · modalità non disponibile')+(reg?'':' · prima dell’uso verificare il ritorno a REG')+'. Per emettere apri Emissione / esito RCH dalla vendita.';r.className='optykerCashRchResult'+(reg?' ok':' error')})
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
  var name=E('clientWorkspaceName');if(!name)return;
  if(!E('optykerClientCashBtn')){
    var b=document.createElement('button');b.id='optykerClientCashBtn';b.type='button';b.textContent='🛒 Cassa cliente';
    b.onclick=function(){var id=String(window.clientCurrentId||'');if(id)openCash(id);else toast('Apri prima la scheda di un cliente.','error')};
    name.insertAdjacentElement('afterend',b)
  }
  if(!E('optykerClientReceiptsBtn')){
    var h=document.createElement('button');h.id='optykerClientReceiptsBtn';h.type='button';h.textContent='Scontrini';
    h.onclick=function(){var id=String(window.clientCurrentId||'');if(id)recentSales(id);else toast('Apri prima la scheda di un cliente.','error')};
    E('optykerClientCashBtn').insertAdjacentElement('afterend',h)
  }
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
    '<div class="optykerCashFocusedHint">Vendita in corso · carrello</div>'+
    '<div class="optykerCashHeaderRight"><button id="optykerCashDrawer" class="optykerCashDrawerBtn" type="button" title="Apri solo il cassetto dei contanti"><span aria-hidden="true">▱</span> Apri cassetto</button><button id="optykerCashRch" class="optykerCashRchBadge" type="button">○ RCH</button><div id="optykerCashOperator" class="optykerCashHeaderBadge"></div><button id="optykerCashClose" type="button">×</button></div></div>'+
    '<div class="optykerCashMain">'+
    '<aside class="optykerCashCart"><div class="optykerCashCartHead"><div class="optykerCashCartTitle">Carrello</div><div id="optykerCashCartCount" class="optykerCashCartCount">0 articoli</div><div class="optykerCashClientBox"><label>Cerca cliente</label><input id="optykerCashClientSearch" type="search" autocomplete="off" placeholder="Nome, cognome, telefono, email, riferimento…"><label class="optykerCashClientSelectLabel">Cliente</label><select id="optykerCashClient"></select></div></div><div id="optykerCashCartItems" class="optykerCashCartItems"></div><div class="optykerCashAddRow"><button id="optykerCashFindProducts" type="button" aria-haspopup="dialog" aria-controls="optykerCashProductPicker"><span aria-hidden="true">＋</span> Cerca e aggiungi prodotti</button><small>Ricerca per nome, marca, SKU o codice a barre</small></div>'+
    '<div class="optykerCashCheckout">'+
      '<div class="optykerCashTotalRow"><div class="optykerCashTotalLabel">Totale vendita</div><div id="optykerCashTotal">€ 0,00</div></div>'+
      '<div class="optykerCashPayLabel">Operazione</div><div class="optykerCashStages">'+
        '<button class="optykerCashStage" data-stage="deposit" type="button">Acconto</button>'+
        '<button class="optykerCashStage active" data-stage="balance" type="button">Saldo</button>'+
        '<button class="optykerCashStage" data-stage="delivery_balance" type="button">Saldo consegna</button>'+
      '</div>'+
      '<div id="optykerCashDepositWrap" class="optykerCashDepositWrap" style="display:none"><div><label>Importo acconto</label><input id="optykerCashDeposit" type="number" min="0.01" step="0.01" inputmode="decimal" placeholder="0,00"></div><div class="optykerCashDuePreview"><span>Resterà da saldare</span><b id="optykerCashDue">€ 0,00</b></div></div>'+
      '<div class="optykerCashPayLabel optykerCashPayLabelSpaced">Metodo di pagamento</div><div class="optykerCashPayModes">'+
        '<button class="optykerCashPayMode" data-pay="cash" type="button">Contanti</button><button class="optykerCashPayMode active" data-pay="card" type="button">Carta</button><button class="optykerCashPayMode" data-pay="mixed" type="button">Contanti + carta</button><button class="optykerCashPayMode" data-pay="bank" type="button">Bonifico</button><button class="optykerCashPayMode" data-pay="alma" type="button" title="Alma · pagamento rateale (scontrino: pagamento elettronico)" aria-label="Alma">Alma</button><button class="optykerCashPayMode" data-pay="pagodil" type="button" title="PagoDil · pagamento dilazionato (scontrino: pagamento elettronico)" aria-label="PagoDil">PagoDil</button><button class="optykerCashPayMode" data-pay="pagolight" type="button" title="PagoLight · pagamento dilazionato (scontrino: pagamento elettronico)" aria-label="PagoLight">PagoLight</button>'+
      '</div>'+
      '<div id="optykerCashMixed" class="optykerCashMixed" hidden><label for="optykerCashMixedCash">Contanti <input id="optykerCashMixedCash" type="number" min="0.01" step="0.01" inputmode="decimal"></label><div>Carta <b id="optykerCashMixedCard">€ 0,00</b></div><small>La carta copre il resto. Verrà stampato un solo scontrino.</small><a href="/rch-connector/Aggiorna-RCH-POS.bat?v=20260926-mixed3" download>Aggiorna connettore RCH per pagamento misto</a></div>'+
      '<label id="optykerCashTsBox" class="optykerCashTsBox"><input id="optykerCashTs" type="checkbox"><span class="optykerCashTsCheck">✓</span><span><b>Scontrino parlante · detrazione</b><small id="optykerCashTsHint">Inserisci il codice fiscale anche per un cliente occasionale.</small></span></label>'+
      '<div id="optykerCashTsOptions" class="optykerCashTsOptions" style="display:none"><div><label for="optykerCashFiscalCode">Codice fiscale per questa vendita</label><input id="optykerCashFiscalCode" maxlength="16" autocomplete="off" spellcheck="false" autocapitalize="characters" placeholder="Codice fiscale del cliente"></div><div><label for="optykerCashTsCode">Codice spesa</label><select id="optykerCashTsCode"><option value="AD">AD · Dispositivo medico</option><option value="AA">AA · Prestazione sanitaria</option></select></div><label class="optykerCashTsOpposition"><input id="optykerCashTsOpposition" type="checkbox"> Opposizione del cliente all\'uso dei dati nella precompilata</label></div>'+
      '<label id="optykerCashInvoiceBox" class="optykerCashInvoiceBox"><input id="optykerCashInvoice" type="checkbox"><span class="optykerCashInvoiceCheck">✓</span><span><b>Prepara fattura Fatture in Cloud</b><small id="optykerCashInvoiceHint">La fattura verrà preparata con i dati del cliente.</small></span></label>'+
      '<textarea id="optykerCashNote" placeholder="Nota vendita (facoltativa)"></textarea>'+
      '<div class="optykerCashRchHelp">Controlla articoli, IVA e pagamento, poi premi Incassa e stampa. Lo scontrino e il suo riferimento vengono registrati nella vendita.</div>'+
      '<button id="optykerCashCheckoutBtn" type="button" disabled>Conferma vendita</button>'+
      '<button id="optykerCashRecover" type="button" hidden>Recupera ultimo incasso / scontrino</button>'+
      '<div class="optykerCashSecondaryActions"><button id="optykerCashDepositsBtn" type="button">Acconti aperti</button><button id="optykerCashRecentBtn" type="button">Ultime vendite</button><button id="optykerCashGiftBtn" class="optykerCashGiftBtn" type="button" title="Stampa l’ultimo scontrino fiscale senza prezzi">Scontrino cortesia</button><button id="optykerCashTsDocsBtn" type="button">Sistema TS</button></div>'+
    '</div></aside></div>'+
    "<dialog id=\"optykerCashProductPicker\" aria-labelledby=\"optykerCashProductPickerTitle\"><div class=\"optykerCashPickerLayout\"><header class=\"optykerCashPickerHead\"><div><h2 id=\"optykerCashProductPickerTitle\">Cerca prodotti</h2><p>Aggiungi gli articoli, poi torna al carrello.</p></div><button id=\"optykerCashPickerClose\" type=\"button\" aria-label=\"Chiudi ricerca prodotti\">×</button></header><div class=\"optykerCashSearchWrap\"><input id=\"optykerCashSearch\" type=\"search\" autocomplete=\"off\" placeholder=\"Cerca prodotto, marca, SKU o codice…\"></div><section class=\"optykerCashCatalog\"><div class=\"optykerCashCatalogTop\"><div id=\"optykerCashTypes\"></div><button id=\"optykerCashRefresh\" type=\"button\">Aggiorna catalogo</button></div><div id=\"optykerCashProducts\" class=\"optykerCashProducts\"></div></section><footer class=\"optykerCashPickerFoot\"><div id=\"optykerCashPickerStatus\" role=\"status\" aria-live=\"polite\"></div><button id=\"optykerCashPickerDone\" type=\"button\">Torna al carrello</button></footer></div></dialog>";
  document.body.appendChild(d);
  E('optykerCashFindProducts').onclick=openProductPicker;
  E('optykerCashPickerClose').onclick=closeProductPicker;
  E('optykerCashPickerDone').onclick=closeProductPicker;
  E('optykerCashProductPicker').addEventListener('close',function(){clearTimeout(S.searchTimer);S.productRequest=(S.productRequest||0)+1;E('optykerCashFindProducts').focus()});
  E('optykerCashClose').onclick=function(ev){return closeCash(ev)};E('optykerCashRch').onclick=openRch;E('optykerCashDrawer').onclick=openCashDrawer;E('optykerCashRefresh').onclick=function(){loadProducts(true)};
  E('optykerCashSearch').oninput=function(){clearTimeout(S.searchTimer);S.searchTimer=setTimeout(function(){loadProducts(false)},280)};
  E('optykerCashClient').onchange=function(){if(S.busy)return;S.clientId=this.value||'';updateInvoiceAvailability();updateTsAvailability();ovcInvalidate()};E('optykerCashClientSearch').oninput=function(){var q=this.value||'';clearTimeout(S.clientSearchTimer);S.clientSearchTimer=setTimeout(function(){searchCashClients(q)},220)};
  var ps=d.querySelectorAll('[data-pay]');for(var i=0;i<ps.length;i++)ps[i].onclick=function(){S.payment=this.getAttribute('data-pay')||'card';renderPay();renderCart();updateTsAvailability()};
  E('optykerCashMixedCash').oninput=function(){this.dataset.edited='1';renderCart()};
  var ss=d.querySelectorAll('[data-stage]');for(i=0;i<ss.length;i++)ss[i].onclick=function(){S.stage=this.getAttribute('data-stage')||'balance';renderStage();renderCart()};
  E('optykerCashDeposit').oninput=renderCart;
  E('optykerCashTs').onchange=function(){
    S.tsRequested=!!this.checked;
    var o=E('optykerCashTsOptions');if(o)o.style.display=S.tsRequested?'grid':'none';
    if(S.tsRequested&&E('optykerCashInvoice')){E('optykerCashInvoice').checked=false;S.invoice=false}
    if(S.tsRequested&&currentCashClient()&&!cashFiscalCode())E('optykerCashFiscalCode').value=cleanFiscal(currentCashClient().fiscal);
    updateTsAvailability();renderCart()
  };
  E('optykerCashTsCode').onchange=function(){S.tsCode=this.value==='AA'?'AA':'AD';updateTsAvailability()};
  E('optykerCashTsOpposition').onchange=function(){S.tsOpposition=!!this.checked;updateTsAvailability()};
  E('optykerCashInvoice').onchange=function(){
    S.invoice=!!this.checked;
    if(S.invoice&&E('optykerCashTs')&&E('optykerCashTs').checked){
      E('optykerCashTs').checked=false;S.tsRequested=false;
      var o=E('optykerCashTsOptions');if(o)o.style.display='none'
    }
    renderCart();
  };
  E('optykerCashRecover').onclick=recoverCashCheckout;
  E('optykerCashCheckoutBtn').onclick=checkout;E('optykerCashRecentBtn').onclick=recentSales;E('optykerCashDepositsBtn').onclick=openDeposits;E('optykerCashGiftBtn').onclick=printGiftReceipt;E('optykerCashTsDocsBtn').onclick=openTsDocuments;
}

function openProductPicker(){
  var d=E('optykerCashProductPicker');if(!d||!S.cashOpen)return;
  if(!d.open)d.showModal();
  E('optykerCashPickerStatus').textContent=E('optykerCashCartCount').textContent+' nel carrello';
  loadProducts(false);E('optykerCashSearch').focus();
}
function closeProductPicker(){var d=E('optykerCashProductPicker');if(d&&d.open)d.close()}

function fillClients(id,rows){
  var s=E('optykerCashClient');if(!s)return;
  var a=(Array.isArray(rows)?rows:(S.clients.length?S.clients:clientsLocal())).slice();
  if(id&&!a.some(function(c){return String(c.id)===String(id)})){var selected=currentCashClient();a.unshift(selected&&String(selected.id)===String(id)?selected:{id:id,name:'Cliente selezionato'})}
  var h='<option value="">Cliente occasionale</option>';
  for(var i=0;i<a.length;i++)h+='<option value="'+esc(a[i].id)+'">'+esc(clientLabel(a[i]))+'</option>';
  s.innerHTML=h;
  if(id&&Array.prototype.some.call(s.options,function(o){return o.value===id}))s.value=id;else if(!id)s.value='';
  S.clientId=s.value||''
}
function searchCashClients(q,keepId){
  var clean=String(q||'').trim(),request=S.clientSearchRequest=(S.clientSearchRequest||0)+1;
  return api('clients',{search:clean,selected_id:keepId||S.clientId||''}).then(function(x){
    if(request!==S.clientSearchRequest)return;
    var selected=currentCashClient(),rows=Array.isArray(x.data)?x.data:[];
    if(selected&&!rows.some(function(c){return String(c.id)===String(S.clientId)}))rows.unshift(selected);
    S.clients=rows;
    fillClients(S.clientId,S.clients);
    updateInvoiceAvailability();updateTsAvailability()
  }).catch(function(){
    if(request!==S.clientSearchRequest)return;
    var selected=currentCashClient(),all=clientsLocal(),k=clean.toLowerCase();
    S.clients=k?all.filter(function(c){return [c.name,c.surname,c.email,c.phone,c.fiscal,c.vat,c.reference_no].join(' ').toLowerCase().indexOf(k)>=0}):all;
    if(selected&&!S.clients.some(function(c){return String(c.id)===String(S.clientId)}))S.clients.unshift(selected);
    fillClients(S.clientId,S.clients);updateInvoiceAvailability();updateTsAvailability()
  })
}
function openCash(clientId){
  S.cashOpen=true;ensureUI();var overlay=E('optykerCashOverlay');if(overlay){overlay.style.removeProperty('display');overlay.removeAttribute('aria-hidden')};S.stage='balance';S.payment='card';S.invoice=false;S.tsRequested=false;S.tsCode='AD';S.tsOpposition=false;S.clients=clientsLocal();fillClients(clientId||'',S.clients);S.clientId=clientId||'';if(E('optykerCashClientSearch'))E('optykerCashClientSearch').value='';searchCashClients('',clientId||'');
  var o=E('optykerCashOperator'),c=creds();if(o)o.textContent=c.username?'Operatore · '+c.username:'Operatore';
  E('optykerCashOverlay').classList.add('open');document.body.style.overflow='hidden';testRch(true).catch(function(){});
  var cf=E('optykerCashFiscalCode');if(cf){cf.value='';delete cf.dataset.client}
  var inv=E('optykerCashInvoice');if(inv)inv.checked=false;
  var ts=E('optykerCashTs');if(ts)ts.checked=false;var tso=E('optykerCashTsOptions');if(tso)tso.style.display='none';
  if(E('optykerCashTsCode'))E('optykerCashTsCode').value='AD';if(E('optykerCashTsOpposition'))E('optykerCashTsOpposition').checked=false;
  renderPay();renderStage();updateInvoiceAvailability();updateTsAvailability();renderCart();setTimeout(function(){try{E('optykerCashFindProducts').focus()}catch(e){}},60)
}
function closeCash(ev){
  if(S.busy){toast('Attendi l’esito dell’incasso in corso.','');return false}
  if(E('optykerCashFiscalCode'))E('optykerCashFiscalCode').value='';
  if(ev){try{ev.preventDefault()}catch(e){}try{ev.stopPropagation()}catch(e){}}
  closeProductPicker();clearTimeout(S.searchTimer);S.productRequest=(S.productRequest||0)+1;
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
  var request=S.productRequest=(S.productRequest||0)+1;
  box.innerHTML='<div class="optykerCashLoading">Caricamento catalogo…</div>';
  var q=String(E('optykerCashSearch')&&E('optykerCashSearch').value||'').trim();
  api('products',{search:q,first:70,force:!!force,client_id:S.clientId||''}).then(function(x){if(request!==S.productRequest)return;S.products=Array.isArray(x.data)?x.data:[];S.type='';renderTypes();renderProducts()}).catch(function(e){if(request!==S.productRequest)return;box.innerHTML='<div class="optykerCashEmpty">Errore catalogo: '+esc(e.message)+'</div>'})
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
    h+='<div class="optykerCashProduct" role="button" tabindex="0" data-variant="'+esc(p.variant_id)+'"><div class="optykerCashProductImage">'+(p.image?'<img src="'+esc(p.image)+'" alt="">':'<div class="optykerCashProductPlaceholder">◉</div>')+'</div><div class="optykerCashProductBody"><div class="optykerCashProductTitle">'+esc(p.title)+'</div><div class="optykerCashProductVariant">'+esc([v,p.sku,discountLabel(p,1)].filter(Boolean).join(' · '))+'</div><div class="optykerCashProductFoot"><div class="optykerCashProductPrice">'+esc(euro(p.price))+'</div><div class="optykerCashProductStock">'+(p.inventory_quantity==null?'':('Disp. '+esc(p.inventory_quantity)))+'</div></div></div></div>'
  });
  box.innerHTML=h;var cards=box.querySelectorAll('[data-variant]');for(var i=0;i<cards.length;i++){cards[i].onclick=function(){add(this.getAttribute('data-variant'))};cards[i].onkeydown=function(ev){if(ev.key==='Enter'||ev.key===' '){ev.preventDefault();add(this.getAttribute('data-variant'))}}}
}
function add(id){
  if(S.busy)return;
  var p=null;for(var i=0;i<S.products.length;i++)if(String(S.products[i].variant_id)===String(id)){p=S.products[i];break}if(!p)return;
  if(!S.cart[id])S.cart[id]={item:p,qty:0,unitPrice:Number(p.price||0)};S.cart[id].qty=Math.min(99,S.cart[id].qty+1);renderCart();var status=E('optykerCashPickerStatus');if(status)status.textContent=p.title+' aggiunto · '+E('optykerCashCartCount').textContent;toast(p.title+' aggiunto','ok')
}
function qty(id,d){if(S.busy||!S.cart[id])return;S.cart[id].qty=Math.min(99,S.cart[id].qty+d);if(S.cart[id].qty<=0)delete S.cart[id];renderCart()}
function removeLine(id){if(S.busy)return;delete S.cart[id];renderCart()}
function setManualPrice(id,value){var row=S.cart[id];if(!row)return;var s=String(value==null?'':value).replace(',','.').trim(),n=Number(s);if(s===''||!isFinite(n)||n<0||n>1000000){toast('Inserisci un prezzo valido da 0,00 € in su.','error');renderCart();return}row.unitPrice=Math.round(n*100)/100;renderCart()}
function cartRows(){return Object.keys(S.cart).map(function(k){return S.cart[k]}).filter(function(x){return x&&x.qty>0})}
function discountLabel(p,quantity){
  if(!p.discount_percent)return '';
  return 'Listino '+euro(Number(p.list_price)*quantity)+' · sconto '+p.discount_percent+'%: −'+euro(Number(p.discount_amount)*quantity);
}
function cartTotal(){
  var total=0;cartRows().forEach(function(x){var u=x.unitPrice==null?Number(x.item.price||0):Number(x.unitPrice||0);total+=u*x.qty});return Math.round(total*100)/100
}
function depositAmount(){
  var x=E('optykerCashDeposit'),n=Number(x&&x.value||0);return isFinite(n)?Math.round(n*100)/100:0
}
function stageLabel(s){return s==='deposit'?'Acconto':(s==='delivery_balance'?'Saldo consegna':'Saldo')}
function mixedAmounts(amount){
  var total=Math.round(amount*100),field=E('optykerCashMixedCash');
  if(!field)return null;
  if(field.dataset.edited!=='1'){field.value=(Math.floor(total/2)/100).toFixed(2)}
  var raw=String(field.value).replace(',','.');
  var cash=/^\d+(?:\.\d{1,2})?$/.test(raw)?Math.round(Number(raw)*100):NaN;
  var card=total-cash,cardLabel=E('optykerCashMixedCard');
  if(cardLabel)cardLabel.textContent=Number.isInteger(card)?euro(card/100):'—';
  return Number.isInteger(cash)&&cash>0&&card>0?{cash:cash/100,card:card/100}:null
}
function renderCart(){
  var box=E('optykerCashCartItems');if(!box)return;var rows=cartRows(),total=cartTotal(),count=0;rows.forEach(function(x){count+=x.qty});
  E('optykerCashCartCount').textContent=count+' articol'+(count===1?'o':'i');E('optykerCashTotal').textContent=euro(total);
  var dep=depositAmount(),validDep=total===0||S.stage!=='deposit'||(dep>0&&dep<total);
  var due=S.stage==='deposit'?Math.max(0,total-dep):0;if(E('optykerCashDue'))E('optykerCashDue').textContent=euro(due);
  document.querySelectorAll('#optykerCashOverlay [data-pay],#optykerCashOverlay [data-stage],#optykerCashTs,#optykerCashTsCode,#optykerCashTsOpposition,#optykerCashFiscalCode,#optykerCashDeposit,#optykerCashMixedCash,#optykerCashNote').forEach(function(control){control.disabled=S.busy});
  var mixedBox=E('optykerCashMixed');if(mixedBox)mixedBox.hidden=S.payment!=='mixed';
  var payAmount=S.stage==='deposit'?dep:total,mixed=S.payment==='mixed'?mixedAmounts(payAmount):null;
  var invoice=E('optykerCashInvoice');if(invoice)invoice.disabled=S.busy||!S.clientId;
  var recover=E('optykerCashRecover');if(recover){var pending=false;try{pending=!!sessionStorage.getItem('optykerCashPendingRequest')}catch(ignore){}recover.hidden=!pending;recover.disabled=S.busy}
  var cb=E('optykerCashCheckoutBtn');cb.disabled=!rows.length||S.busy||!validDep||(S.payment==='mixed'&&!mixed);
  var payNow=total===0?0:(S.payment==='pending'?0:(S.stage==='deposit'?dep:total));
  var actionLabel=total===0?'Scarica magazzino':(S.invoice?'Prepara fattura':S.payment==='pending'?'Registra da pagare':'Incassa e stampa');
  cb.textContent=S.busy?'Operazione in corso…':rows.length?(actionLabel+' · '+euro(payNow)):'Incassa e stampa';
  if(!rows.length){box.innerHTML='<div class="optykerCashCartEmpty">Il carrello è vuoto.<br>Premi «Cerca e aggiungi prodotti» qui sotto per iniziare.</div>';return}
  var h='';rows.forEach(function(x){var p=x.item,v=String(p.variant_title||'');if(v==='Default Title')v='';
    var unit=x.unitPrice==null?Number(p.price||0):Number(x.unitPrice||0),list=Number(p.price||0),changed=Math.abs(unit-list)>0.001;h+='<div class="optykerCashCartItem"><div><div class="optykerCashCartItemTitle">'+esc(p.title)+'</div><div class="optykerCashCartItemMeta">'+esc([v,p.sku,discountLabel(p,x.qty)].filter(Boolean).join(' · '))+'</div><label class="optykerCashVat">IVA <select aria-label="IVA articolo" data-vat="'+esc(p.variant_id)+'">'+cashVatOptions(x.department||({'04':1,'22':2,'ART10':3}[p.fiscal_vat_code||p.vat_code]))+'</select></label><div class="optykerCashQty"><button type="button" data-minus="'+esc(p.variant_id)+'">−</button><span>'+x.qty+'</span><button type="button" data-plus="'+esc(p.variant_id)+'">+</button></div><button type="button" class="optykerCashRemove" data-remove="'+esc(p.variant_id)+'">Rimuovi</button></div><div class="optykerCashCartItemPrice"><label class="optykerCashManualPriceLabel">Prezzo unitario<input class="optykerCashManualPrice" type="number" inputmode="decimal" min="0" max="1000000" step="0.01" data-price="'+esc(p.variant_id)+'" value="'+esc(unit.toFixed(2))+'"></label><span class="optykerCashLineTotal">Totale riga <b>'+esc(euro(unit*x.qty))+'</b></span>'+(changed?'<small class="optykerCashOriginalPrice">Prezzo precedente '+esc(euro(list))+'</small>':'')+'</div></div>'
  });box.innerHTML=h;
  box.querySelectorAll('[data-vat]').forEach(function(v){v.disabled=S.busy;v.onchange=function(){if(S.busy)return;S.cart[this.dataset.vat].department=Number(this.value);renderCart()}});
  box.querySelectorAll('[data-price]').forEach(function(v){v.disabled=S.busy;v.onchange=function(){if(S.busy)return;setManualPrice(this.dataset.price,this.value)}});
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
  var pools=[clientsLocal(),S.clients],client=null;
  for(var p=0;p<pools.length;p++){var a=Array.isArray(pools[p])?pools[p]:[];for(var i=0;i<a.length;i++)if(String(a[i]&&a[i].id||'')===id)client=Object.assign(client||{},a[i])}
  return client
}
function cashVatOptions(selected){return '<option value="">Seleziona IVA</option>'+[[1,'4% · bene'],[2,'22% · bene'],[3,'Esente Art.10 · servizio']].map(function(x){return '<option value="'+x[0]+'"'+(Number(selected)===x[0]?' selected':'')+'>'+x[1]+'</option>'}).join('')}
function cashFiscalCode(){return cleanFiscal(E('optykerCashFiscalCode')&&E('optykerCashFiscalCode').value)}
function cleanFiscal(v){return String(v||'').toUpperCase().replace(/\s+/g,'')}
function updateTsAvailability(){
  var box=E('optykerCashTsBox'),ck=E('optykerCashTs'),hint=E('optykerCashTsHint'),opts=E('optykerCashTsOptions');
  if(!box||!ck)return;
  var field=E('optykerCashFiscalCode'),cl=currentCashClient(),key=S.clientId||'';
  ck.disabled=false;box.classList.remove('disabled');
  if(field&&field.dataset.client!==key){field.dataset.client=key;field.dataset.edited='';field.value=cleanFiscal(cl&&cl.fiscal)}
  if(field){
    if(!field.dataset.edited&&cl)field.value=cleanFiscal(cl.fiscal);
    field.disabled=S.busy;field.required=!!ck.checked;field.oninput=function(){this.dataset.edited='1';this.value=cleanFiscal(this.value)}
  }
  S.tsRequested=!!ck.checked;
  if(opts)opts.style.display=S.tsRequested?'grid':'none';
  var code=E('optykerCashTsCode');S.tsCode=code&&code.value==='AA'?'AA':'AD';
  var opp=E('optykerCashTsOpposition');S.tsOpposition=!!(opp&&opp.checked);
  if(hint){
    if(S.tsOpposition)hint.textContent='Opposizione registrata per questa spesa.';
    else if(S.tsCode==='AA'&&S.payment==='cash')hint.textContent='AA richiede un pagamento tracciabile per essere detraibile.';
    else hint.textContent='Codice fiscale sullo scontrino; righe sanitarie nella coda Sistema TS.'
  }
}
function updateInvoiceAvailability(){
  var box=E('optykerCashInvoiceBox'),inv=E('optykerCashInvoice'),hint=E('optykerCashInvoiceHint');if(!box||!inv)return;
  var ok=!!S.clientId;inv.disabled=!ok;box.classList.toggle('disabled',!ok);
  if(!ok){inv.checked=false;S.invoice=false;if(hint)hint.textContent='Per la fattura seleziona prima un cliente.'}
  else if(hint)hint.textContent='Richiesta Fatture in Cloud del solo importo pagato; revisione e conferma in Fatturazione cliente.';
}
async function recoverCashCheckout(){
 if(S.busy)return;var pending;try{pending=JSON.parse(sessionStorage.getItem('optykerCashPendingRequest')||'null')}catch(ignore){}
 if(!pending)return;S.busy=true;renderCart();
 try{
  clearTimeout(clientCartSaveTimer);await clientCartQueue.catch(function(){});var r=await api('checkout_status',{request_id:pending.id}),sale=r.data.sale,payment=r.data.payment;
  if(sale&&!['completed','open_balance'].includes(sale.status))throw new Error('Incasso da riconciliare in Ultime vendite'+(sale.shopify_order_name?' · '+sale.shopify_order_name:'')+'. Non creare un nuovo ordine.');
  if(sale&&Number(sale.paid_amount)>0&&!payment)throw new Error('Il pagamento della vendita deve essere riconciliato in Ultime vendite.');
  if(!sale){S.checkoutRequestId='';sessionStorage.removeItem('optykerCashPendingRequest');}
  if(!sale){toast('Nessuna vendita registrata per quel tentativo: puoi riprovare.','');return}
  applyCheckoutCart(Object.assign({},sale,{client_cart:r.data.client_cart}),null);S.checkoutRequestId='';sessionStorage.removeItem('optykerCashPendingRequest');if(E('optykerCashFiscalCode'))E('optykerCashFiscalCode').value='';
  if(!sale.invoice_requested&&payment){if(payment.automatic_receipt){await window.OPTYKER_FISCAL.checkReady();await window.OPTYKER_FISCAL.issuePayment(sale.id,payment.id)}else await window.OPTYKER_FISCAL.openSale(sale.id)}
  else toast('Vendita recuperata'+(sale.shopify_order_name?' · '+sale.shopify_order_name:''),'ok');
 }catch(e){toast(e.message,'error')}finally{S.busy=false;renderCart()}
}
function checkout(){
  var rows=payableCartRows();if(!rows.length||S.busy)return;var total=cartTotal(),dep=depositAmount();
  if(total===0){S.stage='balance';dep=0;if(E('optykerCashInvoice'))E('optykerCashInvoice').checked=false;if(E('optykerCashTs'))E('optykerCashTs').checked=false;S.invoice=false;S.tsRequested=false}
  if(S.stage==='deposit'&&!(dep>0&&dep<total)){toast("Inserisci un acconto maggiore di 0 e inferiore al totale.",'error');return}
  var inv=!!(E('optykerCashInvoice')&&E('optykerCashInvoice').checked);
  var ts=!!(E('optykerCashTs')&&E('optykerCashTs').checked);
  var tsCode=E('optykerCashTsCode')&&E('optykerCashTsCode').value==='AA'?'AA':'AD';
  var tsOpp=!!(E('optykerCashTsOpposition')&&E('optykerCashTsOpposition').checked);
  if(inv&&!S.clientId){toast('Per creare la fattura seleziona un cliente.','error');return}
  if(ts&&!/^[A-Z0-9]{16}$/.test(cashFiscalCode())){toast('Inserisci il codice fiscale di 16 caratteri per questa vendita.','error');E('optykerCashFiscalCode').focus();return}
  if(ts&&inv){toast('Per una spesa Sistema TS non usare la fattura elettronica.','error');return}
  if(ts&&S.payment==='pending'){toast('Per preparare il Sistema TS registra prima un pagamento.','error');return}
  if(ts&&S.payment==='mixed'){toast('Per la detrazione con pagamento misto serve una ripartizione sanitaria separata. Disattiva lo scontrino parlante per questo incasso.','error');return}
  if(inv&&S.payment==='mixed'){toast('Per la fattura usa il pagamento singolo.','error');return}
  if(ts&&tsCode==='AA'&&S.payment==='cash'){toast('Le spese AA richiedono un pagamento tracciabile.','error');return}
  var autoReceipt=!inv&&S.payment!=='pending'&&total>0;
  var lines=rows.map(function(x){return {variant_id:x.item.variant_id,quantity:x.qty,unit_price_override:Number(x.unitPrice==null?x.item.price:x.unitPrice),department:Number(x.department||({'04':1,'22':2,'ART10':3}[x.item.fiscal_vat_code||x.item.vat_code])||0)}});
  if(autoReceipt&&lines.some(function(l){return !l.department})){toast('Seleziona l’IVA degli articoli nel carrello.','error');return}
  if(autoReceipt&&!['cash','card','mixed','bank','alma','pagodil','pagolight'].includes(S.payment)){toast('Il pagamento selezionato non è configurato sulla RCH. Seleziona il metodo effettivamente usato oppure prepara la fattura.','error');return}
  var split=S.payment==='mixed'?mixedAmounts(S.stage==='deposit'?dep:total):null;
  if(S.payment==='mixed'&&!split){toast('Inserisci una quota contanti maggiore di zero e inferiore all’importo da incassare.','error');return}
  var payload={client_cart_selection:true,client_id:S.clientId,payment_method:S.payment,payment_stage:S.stage,deposit_amount:dep,expected_total:total,
    ...(split?{payment_breakdown:split}:{}),
    invoice_requested:inv,ts_requested:ts,ts_expense_code:tsCode,ts_opposition:tsOpp,fiscal_code:ts?cashFiscalCode():'',auto_receipt:autoReceipt,
    note:String(E('optykerCashNote').value||''),lines:lines};
  S.busy=true;renderCart();var saleSent=false;
  return Promise.resolve().then(clientCartBeforeCheckout).then(function(){
    if(autoReceipt){if(!window.OPTYKER_FISCAL)throw new Error('Modulo stampa in caricamento: riprova tra pochi istanti.');return window.OPTYKER_FISCAL.checkReady().then(function(){if(S.payment==='mixed')return rchRequest('/health').then(function(h){if(h.capabilities&&h.capabilities.mixedReceipt===true&&h.actualVersion==='2.0-mixed')return;throw new Error('Aggiorna il connettore RCH dal collegamento sotto Contanti + carta, poi riprova.')})})}
  }).then(function(){
    var stored;try{stored=JSON.parse(sessionStorage.getItem('optykerCashPendingRequest')||'null')}catch(ignore){}
    // Only the request identifier is persisted. The fingerprint stays in memory (contains CF).
    if(!S.checkoutRequestId)S.checkoutRequestId=stored&&stored.id||crypto.randomUUID();
    payload.request_id=S.checkoutRequestId;saleSent=true;
    try{sessionStorage.setItem('optykerCashPendingRequest',JSON.stringify({id:S.checkoutRequestId}))}catch(ignore){}
    return api('checkout',payload);
  }).then(function(x){
    var sale=x.data||{};applyCheckoutCart(sale,rows);S.checkoutRequestId='';try{sessionStorage.removeItem('optykerCashPendingRequest')}catch(ignore){};E('optykerCashNote').value='';
    if(E('optykerCashDeposit'))E('optykerCashDeposit').value='';
    if(E('optykerCashInvoice'))E('optykerCashInvoice').checked=false;S.invoice=false;
    if(E('optykerCashTs'))E('optykerCashTs').checked=false;S.tsRequested=false;
    if(E('optykerCashTsOptions'))E('optykerCashTsOptions').style.display='none';
    if(E('optykerCashFiscalCode'))E('optykerCashFiscalCode').value='';
    if(E('optykerCashTsOpposition'))E('optykerCashTsOpposition').checked=false;S.tsOpposition=false;
    renderCart();updateTsAvailability();
    var text=sale.stock_only?'Scarico magazzino registrato':('Vendita registrata'+(sale.shopify_order_name?' · '+sale.shopify_order_name:''));if(Number(sale.inventory_adjusted||0)>0)text+=' · magazzino aggiornato';if(sale.inventory_warning)text+=' · '+sale.inventory_warning;if(sale.invoice_warning)text+=' · '+sale.invoice_warning;
    if(Number(sale.due_amount||0)>0)text+=' · da saldare '+euro(sale.due_amount);
    if(sale.billing_invoice&&sale.billing_invoice.id)text+=' · richiesta Fatture in Cloud preparata';
    if(sale.ts_document&&sale.ts_document.id)text+=sale.ts_document.opposition?' · opposizione TS registrata':' · spesa TS collegata al documento';
    toast(text,'ok');
    if(autoReceipt&&sale.payment&&sale.payment.id)return window.OPTYKER_FISCAL.issuePayment(sale.id,sale.payment.id)
  }).catch(function(e){toast((saleSent?'Esito vendita da verificare in Ultime vendite: ':'')+e.message,'error')}).finally(function(){S.busy=false;renderCart()})
}
function openDeposits(){
  var m=E('optykerCashDepositsModal');if(!m){m=document.createElement('div');m.id='optykerCashDepositsModal';m.className='optykerCashModal';document.body.appendChild(m)}
  m.innerHTML='<div class="optykerCashModalCard optykerCashDepositsCard"><div class="optykerCashModalTitle">Acconti aperti</div><div class="optykerCashModalSub">Seleziona un acconto per registrare il saldo oppure il saldo alla consegna.</div><div id="optykerCashDepositsList"><div class="optykerCashLoading">Caricamento…</div></div><button class="optykerCashModalClose" type="button">Chiudi</button></div>';
  m.classList.add('open');m.querySelector('.optykerCashModalClose').onclick=function(){m.classList.remove('open')};m.onclick=function(ev){if(ev.target===m)m.classList.remove('open')};
  api('open_deposits',{client_id:S.clientId}).then(function(x){
    var box=E('optykerCashDepositsList'),a=Array.isArray(x.data)?x.data:[];if(!a.length){box.innerHTML='<div class="optykerCashEmpty">Nessun acconto da saldare.</div>';return}
    box.innerHTML=a.map(function(r){
      var cl=r.client?(((r.client.surname||'')+' '+(r.client.name||'')).trim()||'Cliente'):'Cliente occasionale',dt='';try{dt=new Date(r.created_at).toLocaleDateString('it-IT')}catch(e){}
      return '<div class="optykerCashDepositRow"><div class="optykerCashDepositInfo"><b>'+esc(r.shopify_order_name||'Vendita')+' · '+esc(cl)+'</b><span>'+esc(dt)+' · Totale '+esc(euro(r.total))+' · Pagato '+esc(euro(r.paid_amount))+'</span></div><div class="optykerCashDepositDue"><span>Da saldare</span><b>'+esc(euro(r.due_amount))+'</b></div><div class="optykerCashDepositActions"><select data-settle-pay aria-label="Pagamento del saldo"><option value="">Pagamento del saldo…</option><option value="cash">Contanti</option><option value="card">Carta</option><option value="bank">Bonifico</option><option value="alma">Alma</option><option value="pagodil">PagoDil</option><option value="pagolight">PagoLight</option></select><button type="button" data-settle="balance" data-sale="'+esc(r.id)+'">Saldo</button><button type="button" data-settle="delivery_balance" data-sale="'+esc(r.id)+'">Saldo consegna</button></div></div>'
    }).join('');
    var bs=box.querySelectorAll('[data-settle]');for(var i=0;i<bs.length;i++)bs[i].onclick=function(){var pay=this.closest('.optykerCashDepositRow').querySelector('[data-settle-pay]').value;if(!pay){toast('Scegli il pagamento del saldo (contanti, carta, bonifico, Alma, PagoDil o PagoLight) prima di stampare lo scontrino.','error');return}var button=E('optykerCashOverlay').querySelector('[data-pay="'+pay+'"]');if(!button){toast('Metodo di pagamento non disponibile.','error');return}button.click();settleExisting(this.getAttribute('data-sale'),this.getAttribute('data-settle'),m)}
  }).catch(function(e){E('optykerCashDepositsList').innerHTML='<div class="optykerCashEmpty">Errore: '+esc(e.message)+'</div>'})
}
function settleExisting(saleId,stage,modal){
  if(S.busy)return;
  if(S.payment==='pending'||S.payment==='mixed'){toast('Per saldare questa vendita usa Contanti o Carta. La ripartizione mista è disponibile nella nuova vendita.','error');return}
  var inv=!!(E('optykerCashInvoice')&&E('optykerCashInvoice').checked);
  var ts=!!(E('optykerCashTs')&&E('optykerCashTs').checked);
  var tsCode=E('optykerCashTsCode')&&E('optykerCashTsCode').value==='AA'?'AA':'AD';
  var tsOpp=!!(E('optykerCashTsOpposition')&&E('optykerCashTsOpposition').checked);
  if(ts&&inv){toast('Per una spesa Sistema TS non usare la fattura elettronica.','error');return}
  if(ts&&tsCode==='AA'&&S.payment==='cash'){toast('Le spese AA richiedono un pagamento tracciabile.','error');return}
  var additional=stage==='deposit',amount=additional?depositAmount():null;
  if(additional&&!(amount>0&&amount<cartTotal())){toast('Importo acconto non valido.','error');return}
  if(additional&&inv){toast('Per un acconto successivo usa lo scontrino RCH.','error');return}
  var requestKey='optykerRepeatDeposit:'+saleId,requestId=additional?sessionStorage.getItem(requestKey):null;
  if(additional&&!requestId){requestId=crypto.randomUUID();sessionStorage.setItem(requestKey,requestId)}
  var label=additional?'nuovo acconto di '+euro(amount):stage==='delivery_balance'?'saldo alla consegna':'saldo';
  var extra=inv?'\nVerrà preparata anche la fattura del pagamento.':'';
  if(ts)extra+=tsOpp?'\nVerrà registrata l\'opposizione al Sistema TS.':'\nVerrà preparata la spesa '+tsCode+' per il Sistema TS.';
  if(!inv)extra+='\nLo scontrino verrà stampato con i dati fiscali salvati nella vendita.';
  if(!window.confirm('Registrare il '+label+'?'+extra))return;
  S.busy=true;renderCart();
  Promise.resolve().then(function(){if(!inv){if(!window.OPTYKER_FISCAL)throw new Error('Modulo RCH non disponibile');return window.OPTYKER_FISCAL.checkReady()}}).then(function(){return api('settle',{auto_receipt:!inv,sale_id:saleId,deposit_amount:amount,request_id:requestId,payment_stage:stage,payment_method:S.payment,invoice_requested:inv,ts_requested:ts,ts_expense_code:tsCode,ts_opposition:tsOpp,note:String(E('optykerCashNote').value||'')})})
    .then(function(x){var sale=x.data||{};applyCheckoutCart(sale,null);var t='Saldo registrato'+(sale.billing_invoice?' · richiesta Fatture in Cloud preparata':'');if(sale.ts_document)t+=sale.ts_document.opposition?' · opposizione TS registrata':' · spesa TS collegata al documento';if(additional){sessionStorage.removeItem(requestKey);t='Acconto registrato · '+euro(amount)}toast(t,'ok');if(modal)modal.classList.remove('open');if(!inv&&window.OPTYKER_FISCAL){if(sale.payment&&sale.payment.data&&sale.payment.data.fiscal_snapshot)return window.OPTYKER_FISCAL.issuePayment(sale.id,sale.payment.id);return window.OPTYKER_FISCAL.openSale(sale.id)}else openDeposits()})
    .catch(function(e){toast('Verifica esito saldo: '+e.message,'error')}).finally(function(){S.busy=false;renderCart()})
}
function openTsDocuments(){
  var m=E('optykerCashTsModal');if(!m){m=document.createElement('div');m.id='optykerCashTsModal';m.className='optykerCashModal';document.body.appendChild(m)}
  m.innerHTML='<div class="optykerCashModalCard optykerCashTsModalCard"><div class="optykerCashModalTitle">Sistema Tessera Sanitaria</div><div class="optykerCashModalSub">Invio diretto al Sistema TS non attivo. Queste registrazioni conservano i dati delle spese; servono un documento fiscale valido e il collegamento TS configurato prima della trasmissione.</div><button id="optykerCashTsRchQueue" type="button">Spese collegate ai documenti RCH</button><div id="optykerCashTsList"><div class="optykerCashLoading">Caricamento…</div></div><button class="optykerCashModalClose" type="button">Chiudi</button></div>';
  m.classList.add('open');m.querySelector('.optykerCashModalClose').onclick=function(){m.classList.remove('open')};m.onclick=function(ev){if(ev.target===m)m.classList.remove('open')};
  E('optykerCashTsRchQueue').onclick=function(){if(window.OPTYKER_FISCAL)window.OPTYKER_FISCAL.openTs()};
  api('ts_documents',{client_id:S.clientId}).then(function(x){
    var box=E('optykerCashTsList'),a=Array.isArray(x.data)?x.data:[];if(!a.length){box.innerHTML='<div class="optykerCashEmpty">Nessuna spesa TS preparata.</div>';return}
    function sl(v){if(v==='linked_fiscal_review')return 'Collegato alla revisione RCH';if(v==='opposition_recorded')return 'Opposizione';if(v==='ready_focus_ts')return 'Preparato, non trasmesso';if(v==='sent')return 'Inviato';if(v==='accepted')return 'Accettato';if(v==='rejected')return 'Scartato';if(v==='error')return 'Errore';return 'Attende documento fiscale'}
    box.innerHTML=a.map(function(r){var dt='';try{dt=new Date(r.payment_date||r.created_at).toLocaleDateString('it-IT')}catch(e){}var doc=r.document_number?(' · Doc. '+r.document_number):'';var proto=r.ts_protocol?(' · Protocollo '+r.ts_protocol):'';return '<div class="optykerCashTsRow"><div><b>'+esc(r.expense_code)+' · '+esc(euro(r.amount))+'</b><span>'+esc(dt+doc+' · '+(r.payment_method||''))+'</span></div><div class="optykerCashTsStatus '+esc(r.status||'')+'">'+esc(sl(r.status))+esc(proto)+'</div></div>'}).join('')
  }).catch(function(e){E('optykerCashTsList').innerHTML='<div class="optykerCashEmpty">Errore: '+esc(e.message)+'</div>'})
}
var H={clientId:'',offset:0,includeDeleted:false,request:0};
function recentSales(clientId){
  H.clientId=typeof clientId==='string'?clientId:S.clientId;H.offset=0;H.includeDeleted=false;
  var m=E('optykerCashRecentModal');if(!m){m=document.createElement('div');m.id='optykerCashRecentModal';m.className='optykerCashModal';document.body.appendChild(m)}
  m.innerHTML='<div class="optykerCashModalCard"><div class="optykerCashModalTitle">'+(H.clientId?'Scontrini del cliente':'Scontrini e vendite')+'</div><div class="optykerCashModalSub">Ristampa una copia della vendita o rimuovi la registrazione dalla cronologia. Le copie non hanno valore fiscale.</div><div class="optykerCashHistoryToolbar"><label><input id="optykerCashShowDeleted" type="checkbox"> Mostra anche eliminati</label><button id="optykerCashHistoryRefresh" type="button">Aggiorna</button></div><div id="optykerCashSaleList" class="optykerCashSaleList"></div><div class="optykerCashHistoryToolbar"><button id="optykerCashHistoryPrev" type="button" disabled>Precedenti</button><span id="optykerCashHistoryPage"></span><button id="optykerCashHistoryNext" type="button" disabled>Successivi</button></div><button class="optykerCashModalClose" type="button">Chiudi</button></div>';m.classList.add('open');
  function close(){H.request++;m.classList.remove('open')}
  m.querySelector('.optykerCashModalClose').onclick=close;m.onclick=function(ev){if(ev.target===m)close()};
  E('optykerCashShowDeleted').onchange=function(){H.includeDeleted=this.checked;H.offset=0;loadHistory()};
  E('optykerCashHistoryRefresh').onclick=loadHistory;
  E('optykerCashHistoryPrev').onclick=function(){H.offset=Math.max(0,H.offset-30);loadHistory()};
  E('optykerCashHistoryNext').onclick=function(){H.offset+=30;loadHistory()};
  loadHistory()
}
function receiptDate(v){try{return new Date(v).toLocaleString('it-IT')}catch(e){return ''}}
function paymentLabel(v){return {cash:'Contanti',card:'Carta',mixed:'Contanti + carta',bank:'Bonifico',alma:'Alma',pagodil:'PagoDil',pagolight:'PagoLight',pending:'Da pagare',other:'Altro'}[v]||v||''}
function loadHistory(){
  var request=++H.request,clientId=H.clientId,offset=H.offset;
  var box=E('optykerCashSaleList');if(!box)return;
  box.innerHTML='<div class="optykerCashLoading">Caricamento…</div>';
  E('optykerCashHistoryPrev').disabled=true;E('optykerCashHistoryNext').disabled=true;
  return api('recent_sales',{client_id:clientId,offset:offset,include_deleted:H.includeDeleted}).then(function(x){
    if(request!==H.request)return;
    var a=Array.isArray(x.data)?x.data:[];
    if(!a.length&&offset>0){H.offset=Math.max(0,offset-30);return loadHistory()}
    E('optykerCashHistoryPrev').disabled=offset===0;E('optykerCashHistoryNext').disabled=!x.has_more;
    E('optykerCashHistoryPage').textContent='Pagina '+(Math.floor(offset/30)+1);
    box.innerHTML=a.length?a.map(function(r){
      var extra=Number(r.due_amount||0)>0?(' · Da saldare '+euro(r.due_amount)):' · Saldato';
      if(r.status==='error')extra=' · Registrazione con errore';
      if(r.invoice_requested)extra+=' · Fattura richiesta';
      if(r.hidden_at)extra+=' · Eliminato dalla cronologia';
      return '<div class="optykerCashSaleRow'+(r.hidden_at?' deleted':'')+'"><div class="optykerCashSaleTop"><div class="optykerCashSaleName">'+esc(r.shopify_order_name||'Vendita')+'</div><div class="optykerCashSaleAmount">'+esc(euro(r.total))+'</div></div><div class="optykerCashSaleMeta">'+esc(receiptDate(r.created_at)+' · '+stageLabel(r.payment_stage||'balance')+' · '+paymentLabel(r.payment_method)+extra)+'</div><div class="optykerCashHistoryActions"><button type="button" data-fiscal-sale="'+esc(r.id)+'">Emissione / esito RCH</button><button type="button" data-receipt="'+esc(r.id)+'">Ristampa su RCH RT</button><button type="button" data-visibility="'+esc(r.id)+'" data-hidden="'+(r.hidden_at?'false':'true')+'">'+(r.hidden_at?'Ripristina':'Elimina dalla scheda')+'</button></div></div>'
    }).join(''):'<div class="optykerCashEmpty">Nessuno scontrino registrato'+(clientId?' per questo cliente':'')+'.</div>';
    box.querySelectorAll('[data-fiscal-sale]').forEach(function(b){b.onclick=function(){if(window.OPTYKER_FISCAL)window.OPTYKER_FISCAL.openSale(b.getAttribute('data-fiscal-sale'))}});
    box.querySelectorAll('[data-receipt]').forEach(function(b){b.onclick=function(){window.OPTYKER_RCH_REPRINT?window.OPTYKER_RCH_REPRINT.openSale(b.getAttribute('data-receipt')):alert('Ricarica Optyker per attivare la ristampa RCH.')}});
    box.querySelectorAll('[data-visibility]').forEach(function(b){b.onclick=function(){
      var hidden=b.getAttribute('data-hidden')==='true';
      var message=hidden?'Eliminare questa registrazione dalla scheda cliente e dalla cronologia della cassa?\n\nNon annulla lo scontrino fiscale, non effettua rimborsi e non modifica l’ordine o il magazzino. Potrai ripristinarla da “Mostra anche eliminati”.':'Ripristinare la registrazione nella cronologia?';
      if(!window.confirm(message))return;
      b.disabled=true;
      api('history_visibility',{sale_id:b.getAttribute('data-visibility'),client_id:clientId,hidden:hidden,confirm:true}).then(function(){
        toast(hidden?'Registrazione eliminata dalla scheda. Puoi ripristinarla.':'Registrazione ripristinata.','ok');
        if(request===H.request)return loadHistory()
      }).catch(function(e){toast(e.message,'error')}).finally(function(){b.disabled=false})
    }})
  }).catch(function(e){if(request===H.request)box.innerHTML='<div class="optykerCashEmpty">Errore: '+esc(e.message)+'. Premi Aggiorna per riprovare.</div>'})
}
function openReceiptCopy(id,clientId,button){
  if(button)button.disabled=true;
  return api('receipt_detail',{sale_id:id,client_id:clientId}).then(function(x){
    var r=x.data;if(!r)throw new Error('Documento non disponibile');
    var m=E('optykerReceiptCopy');if(!m){m=document.createElement('div');m.id='optykerReceiptCopy';m.className='optykerCashModal';document.body.appendChild(m)}
    m.innerHTML='<div class="optykerCashModalCard"><div class="optykerReceiptPrintActions"><button id="optykerReceiptPrint" type="button">Stampa / Salva PDF</button><button id="optykerReceiptClose" type="button">Chiudi</button></div><article class="optykerReceiptPaper"><h1>Ottica Visual Care</h1><p>MOLOGNI COMPANY S.R.L. · P.IVA 04679780165</p><h2>COPIA NON FISCALE</h2><p>Riepilogo della vendita registrata in Optyker.<br>Non sostituisce il documento commerciale del registratore fiscale.</p>'+
      '<p><b>'+esc(r.shopify_order_name||'Vendita')+'</b> · '+esc(receiptDate(r.created_at))+'<br>Cliente: '+esc(r.client_name)+'<br>Operatore: '+esc(r.operator_username)+'</p>'+
      (r.hidden_at?'<p><b>Registrazione eliminata dalla cronologia</b></p>':'')+
      (r.status==='error'?'<p><b>Registrazione con errore: verificare l’esito della vendita.</b></p>':'')+
      '<table><thead><tr><th>Articolo</th><th>Qtà</th><th>Prezzo</th><th>Sconto</th><th>Totale</th></tr></thead><tbody>'+r.items.map(function(l){return '<tr><td>'+esc(l.title)+(l.variant_title&&l.variant_title!=='Default Title'?'<br><small>'+esc(l.variant_title)+'</small>':'')+'</td><td>'+esc(l.quantity)+'</td><td>'+esc(euro(l.data&&l.data.list_price!=null?l.data.list_price:l.unit_price))+'</td><td>'+esc(l.data&&l.data.discount_percent?l.data.discount_percent+'% (−'+euro(l.data.discount_total)+')':'—')+'</td><td>'+esc(euro(l.total))+'</td></tr>'}).join('')+'</tbody></table><p class="optykerReceiptTotal">Totale vendita: <b>'+esc(euro(r.total))+'</b></p><p>Pagato: '+esc(euro(r.paid_amount))+'<br>Da saldare: '+esc(euro(r.due_amount))+'</p>'+
      (r.payments.length?'<h3>Pagamenti registrati</h3>'+r.payments.map(function(p){return '<p>'+esc(receiptDate(p.created_at)+' · '+stageLabel(p.payment_stage)+' · '+paymentLabel(p.payment_method)+' · '+euro(p.amount))+'</p>'}).join(''):'<p>Nessun movimento di pagamento registrato.</p>')+
      '<small>Riferimento Optyker: '+esc(r.id)+'</small></article></div>';
    m.classList.add('open');
    function close(){m.classList.remove('open')}
    E('optykerReceiptClose').onclick=close;m.onclick=function(ev){if(ev.target===m)close()};
    E('optykerReceiptPrint').onclick=function(){
      var w=window.open('','_blank');
      if(!w){toast('Consenti le finestre di stampa per Optyker e riprova.','error');return}
      w.opener=null;
      w.document.open();
      w.document.write('<!doctype html><html lang="it"><head><meta charset="utf-8"><title>Copia vendita Optyker</title><style>@page{size:A4;margin:16mm}body{font:13px/1.5 Arial,sans-serif;color:#172b40}h1{font-size:22px}h2{font-size:16px;border-block:1px solid #ccd6df;padding:10px 0}table{width:100%;border-collapse:collapse;margin-top:18px}th,td{text-align:right;padding:8px 5px;border-bottom:1px solid #dde3e8}th:first-child,td:first-child{text-align:left}tr{break-inside:avoid}.optykerReceiptTotal{text-align:right;font-size:16px}</style></head><body>'+m.querySelector('.optykerReceiptPaper').outerHTML+'</body></html>');
      w.document.close();w.focus();w.print()
    }
  }).catch(function(e){toast('Copia non disponibile: '+e.message,'error')}).finally(function(){if(button)button.disabled=false})
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
/* Injected in POS closure. Quote every cart/customer change, server authoritative. */
window.OPTYKER_CASH_QUOTE_VERSION='20260919-quote1';
S.ovcPriceKey='';S.ovcQuoteKey='';S.ovcPriceEpoch=0;S.ovcPriceSeq=0;S.ovcPricePending=false;S.ovcPriceError='';S.ovcCard=null;S.ovcPricingScope='';
var ovcQuoteController=null;
function ovcCartKey(){return JSON.stringify([S.clientId||'',S.ovcPriceEpoch,payableCartRows().map(function(x){return [String(x.item.variant_id),x.qty,Number(x.department||0),x.unitPrice==null?null:Number(x.unitPrice)]}).sort(function(a,b){return a[0].localeCompare(b[0])})]);}
function ovcPayRows(){return typeof payableCartRows==='function'?payableCartRows():cartRows()}
function ovcMissingVat(){
  if(S.invoice||S.payment==='pending'||cartTotal()<=0)return [];
  return ovcPayRows().filter(function(x){return !Number(x.department||({'04':1,'22':2,'ART10':3}[x.item.fiscal_vat_code||x.item.vat_code])||0)});
}
function ovcStatus(){
  var el=E('optykerCashOvcStatus');
  if(!el){var head=document.querySelector('#optykerCashOverlay .optykerCashCartHead');if(!head)return;el=document.createElement('div');el.id='optykerCashOvcStatus';el.setAttribute('role','status');head.appendChild(el);}
  var missing=ovcMissingVat(),unverified=S.ovcQuoteKey!==ovcCartKey();
  var text=S.ovcPricePending?'Verifica tariffe del cliente…':S.ovcPriceError||(unverified?'Tariffe da verificare. Premi Riprova ricalcolo.':missing.length?'Seleziona l’IVA nella riga del carrello prima di stampare.':S.ovcPricingScope==='stored_orders'?'Importi Buste verificati · prezzi salvati dell’ordine':!S.clientId?'Cliente occasionale · tariffa standard':S.ovcCard&&S.ovcCard.active?'OVC CARD attiva · prezzi riservati applicati ai servizi configurati':'OVC CARD non attiva · tariffa standard');
  var isError=!!S.ovcPriceError||(!S.ovcPricePending&&(unverified||missing.length>0));
  if(el.dataset.active!==(S.ovcCard&&S.ovcCard.active?'true':'false'))el.dataset.active=S.ovcCard&&S.ovcCard.active?'true':'false';
  if(el.dataset.error!==(isError?'true':'false'))el.dataset.error=isError?'true':'false';
  if(el.dataset.message!==text){
    el.dataset.message=text;el.textContent=text;
    if(S.ovcPriceError||(!S.ovcPricePending&&unverified)){
      var b=document.createElement('button');b.id='optykerCashQuoteRetry';b.type='button';b.textContent='Riprova ricalcolo';b.onclick=function(){if(!S.busy)ovcInvalidate()};el.appendChild(b);
    }
  }
  var cb=E('optykerCashCheckoutBtn');if(cb&&(S.ovcPricePending||S.ovcPriceError||unverified||missing.length))cb.disabled=true;
  var total=E('optykerCashTotal');if(total&&(S.ovcPricePending||S.ovcPriceError||unverified))total.textContent=S.ovcPricePending?'Verifica…':'Da verificare';
  var retry=E('optykerCashQuoteRetry');if(retry)retry.disabled=!!S.busy;
  var client=E('optykerCashClient');if(client)client.disabled=!!S.busy;
}
/* A read-only request with a deadline, never a payment retry or price fallback. */
function ovcQuoteRequest(payload){
  var c=creds();if(!c.username||!c.password)return Promise.reject(new Error('Sessione operatore non disponibile. Esci e accedi nuovamente.'));
  if(ovcQuoteController)ovcQuoteController.abort();
  var ctl=new AbortController();ovcQuoteController=ctl;
  var timer,deadline=new Promise(function(resolve,reject){timer=setTimeout(function(){ctl.abort();reject(new Error('Il controllo tariffe non ha risposto entro 15 secondi. Riprova il ricalcolo; nessun incasso è stato eseguito da questa verifica.'));},15000)});
  var request=fetch('https://whgziwaegjzqsgcntesr.supabase.co/functions/v1/optyker-cash-register-api-v2',{
    method:'POST',headers:{'Content-Type':'application/json'},cache:'no-store',signal:ctl.signal,
    body:JSON.stringify({action:'quote_lines',username:c.username,password:c.password,payload:payload})
  }).then(function(r){return r.json().catch(function(){return null}).then(function(x){if(!r.ok||!x||x.ok!==true)throw new Error(x&&x.error||'Risposta del controllo tariffe non valida.');return x})});
  return Promise.race([request,deadline]).catch(function(e){if(e&&e.name==='AbortError')throw new Error('Controllo tariffe interrotto. Premi Riprova ricalcolo.');throw e}).finally(function(){clearTimeout(timer);if(ovcQuoteController===ctl)ovcQuoteController=null;});
}
function ovcValidateQuote(q,lines){
  if(!q||q.ovc_version!=='20260910-ovc2')throw new Error('Modulo tariffe in aggiornamento. Premi Riprova ricalcolo.');
  var quoted=q.lines;if(!Array.isArray(quoted)||quoted.length!==lines.length)throw new Error('Ricalcolo del carrello incompleto.');
  var ids=new Set();
  quoted.forEach(function(l){
    var id=String(l&&l.variant_id||''),want=lines.find(function(x){return String(x.variant_id)===id});
    if(!want||ids.has(id)||Number(l.quantity)!==Number(want.quantity)||l.price==null||!Number.isFinite(Number(l.price))||Number(l.price)<0)throw new Error('Risposta tariffe non coerente con il carrello.');
    ids.add(id);
  });return quoted;
}
var ovcOriginalRenderCart=renderCart;
renderCart=function(){
  if(S.cashOpen){var key=ovcCartKey();if(key!==S.ovcPriceKey){
    S.ovcPriceKey=key;S.ovcPricePending=true;S.ovcPriceError='';var seq=++S.ovcPriceSeq;
    if(ovcQuoteController)ovcQuoteController.abort();
    clearTimeout(S.ovcPriceTimer);S.ovcPriceTimer=setTimeout(function(){
      if(seq!==S.ovcPriceSeq)return;
      if(!S.cashOpen){S.ovcPricePending=false;S.ovcPriceKey='';return;}
      if(key!==ovcCartKey()){renderCart();return;}
      var lines=payableCartRows().map(function(x){return {variant_id:x.item.variant_id,quantity:x.qty,department:Number(x.department||0)||null}}),clientId=S.clientId||'';
      ovcQuoteRequest({client_id:clientId,lines:lines}).then(function(x){
        if(seq!==S.ovcPriceSeq)return;
        if(key!==ovcCartKey()){renderCart();return;}
        var q=x.data,quoted=ovcValidateQuote(q,lines);
        quoted.forEach(function(l){if(S.cart[l.variant_id])S.cart[l.variant_id].item=Object.assign({},S.cart[l.variant_id].item,l);});
        S.ovcCard=q.card||null;S.ovcPricingScope=q.pricing_scope||'';S.ovcQuoteKey=key;S.ovcPricePending=false;S.ovcPriceError='';renderCart();
      }).catch(function(e){
        if(seq!==S.ovcPriceSeq)return;
        S.ovcPricePending=false;S.ovcPriceError='Tariffe non verificate: '+String(e&&e.message||e);renderCart();
      });
    },170);
  }}
  ovcOriginalRenderCart();ovcStatus();
};
function ovcInvalidate(){if(S.busy)return;S.ovcPriceEpoch++;if(S.cashOpen){renderCart();if(E('optykerCashProductPicker')&&E('optykerCashProductPicker').open)loadProducts(false);}}
var ovcOriginalCheckout=checkout;
checkout=function(){
  if(S.ovcPricePending||S.ovcPriceError||S.ovcQuoteKey!==ovcCartKey()){toast('Attendi il ricalcolo delle tariffe oppure premi Riprova ricalcolo.','error');return;}
  return ovcOriginalCheckout.apply(this,arguments);
};
var ovcOldDiscountLabel=discountLabel;
discountLabel=function(p,qty){return p.is_service?(p.ovc_card_applied?'Tariffa OVC CARD · standard '+euro(Number(p.standard_price)*qty):'Servizio · tariffa standard'):ovcOldDiscountLabel(p,qty);};
window.addEventListener('optyker:ovc-updated',ovcInvalidate);
window.addEventListener('focus',function(){if(S.cashOpen&&!S.busy&&!S.ovcPricePending)ovcInvalidate();});
setInterval(function(){if(!document.hidden&&S.cashOpen&&!S.busy&&!S.ovcPricePending&&!S.ovcPriceError)ovcInvalidate();},60000);


/* __OPTYKER_CLIENT_CART_PERSISTENCE_V1__ — serialized saves and partial checkout */
var clientCartSaveTimer=0,clientCartSeq=0,clientCartMutation=0,clientCartLastId='';
var clientCartQueue=Promise.resolve(),clientCartVersions={};
function clientCartHasPending(){try{return !!sessionStorage.getItem('optykerCashPendingRequest')}catch(e){return false}}
function clientCartSnapshot(){return cartRows().map(function(x){var p=x.item||{};return {variant_id:String(p.variant_id||''),title:String(p.title||''),variant_title:String(p.variant_title||''),sku:String(p.sku||''),barcode:String(p.barcode||''),image:String(p.image||''),price:Number(p.price||0),list_price:Number(p.list_price==null?p.price:p.list_price||0),fiscal_vat_code:String(p.fiscal_vat_code||p.vat_code||''),fiscal_item_type:String(p.fiscal_item_type||''),quantity:Number(x.qty||1),department:Number(x.department||0)||null,selected:x.selected!==false,unit_price_override:x.unitPrice==null?null:Number(x.unitPrice),locked_price:!!p.locked_price,source_work_order_id:p.source_work_order_id||null,source_sheet_id:p.source_sheet_id||null,source_type:p.source_type||''}})}
function clientCartApply(items,id){if(String(S.clientId||'')!==String(id||''))return;S.cart={};(Array.isArray(items)?items:[]).forEach(function(p){var k=String(p&&p.variant_id||'');if(!k)return;S.cart[k]={item:p,qty:Math.max(1,Math.min(99,Number(p.quantity||1))),department:Number(p.department||0)||null,selected:p.selected!==false,unitPrice:p.unit_price_override==null?null:Number(p.unit_price_override)}});clientCartLastId=id||'';renderCart()}
function clientCartFailure(e,id){if(String(S.clientId||'')===id){S.clientCartError='Carrello non sincronizzato: '+e.message+' Chiudi e riapri la Cassa.';toast(S.clientCartError,'error');renderCart()}}
function clientCartLoad(id){
  id=String(id||'');if(S.busy)return Promise.resolve();
  var seq=++clientCartSeq;clearTimeout(clientCartSaveTimer);S.cart={};S.clientCartError='';S.clientCartLoading=!!id;renderCart();
  if(!id){clientCartLastId='';return Promise.resolve()}
  return clientCartQueue.catch(function(){}).then(function(){return api('client_cart_get',{client_id:id})}).then(function(x){
    if(seq!==clientCartSeq||String(S.clientId||'')!==id)return;
    clientCartVersions[id]=x.data.updated_at||null;S.clientCartLoading=false;clientCartApply(x.data.items||[],id);
  }).catch(function(e){if(seq===clientCartSeq){S.clientCartLoading=false;clientCartFailure(e,id)}});
}
function clientCartSaveNow(id,snapshot,mutation){
  id=String(id||'');if(!id)return Promise.resolve();
  snapshot=Array.isArray(snapshot)?snapshot:clientCartSnapshot();mutation=mutation==null?clientCartMutation:mutation;
  var seq=clientCartSeq;
  var task=clientCartQueue.then(function(){return api('client_cart_save',{client_id:id,items:snapshot,expected_updated_at:clientCartVersions[id]||null})}).then(function(x){
    clientCartVersions[id]=x.data.updated_at||null;
    if(!S.busy&&seq===clientCartSeq&&String(S.clientId||'')===id&&mutation===clientCartMutation)clientCartApply(x.data.items||[],id);
    return x;
  });
  clientCartQueue=task;return task;
}
function clientCartSchedule(){
  if(!S.clientId||S.busy||S.clientCartLoading||S.clientCartError||clientCartHasPending())return;
  var id=String(S.clientId),snapshot=clientCartSnapshot(),m=++clientCartMutation;
  clearTimeout(clientCartSaveTimer);clientCartSaveTimer=setTimeout(function(){clientCartSaveNow(id,snapshot,m).catch(function(e){clientCartFailure(e,id)})},140);
}
function clientCartBeforeCheckout(){
  clearTimeout(clientCartSaveTimer);if(!S.clientId)return Promise.resolve();
  var id=String(S.clientId);return clientCartSaveNow(id,clientCartSnapshot(),++clientCartMutation).catch(function(e){clientCartFailure(e,id);throw e});
}
function clientCartLockUi(){
  var box=E('optykerCashCartItems');if(!box)return;
  box.querySelectorAll('[data-minus^="client_cart:"],[data-plus^="client_cart:"]').forEach(function(b){b.disabled=true;b.title='Voce generata da una Busta ordinata. Togli la spunta per pagarla in seguito.'});
  box.querySelectorAll('[data-remove^="client_cart:"]').forEach(function(b){b.disabled=!!S.busy;b.textContent='Elimina scheda e annulla ordine';b.title='Annulla l’ordine in Laboratorio e archivia la scheda collegata. Pagamenti e scontrini restano invariati.'});
  box.querySelectorAll('[data-minus^="client_cart:"]').forEach(function(b){var row=b.closest('.optykerCashCartItem');if(!row||row.querySelector('.optykerClientCartOrderBadge'))return;var title=row.querySelector('.optykerCashCartItemTitle');if(title){var n=document.createElement('div');n.className='optykerClientCartOrderBadge';n.textContent='Ordine Laboratorio · importo della Busta';title.insertAdjacentElement('afterend',n)}});
}
var clientCartNativeRender=renderCart;
renderCart=function(){var r=clientCartNativeRender.apply(this,arguments);clientCartLockUi();var box=E('optykerCashCartItems');if(box)box.querySelectorAll('[data-vat],[data-price]').forEach(function(v){var old=v.onchange;v.onchange=function(){if(S.busy)return;if(old)old.apply(this,arguments);clientCartSchedule()}});return r};
var clientCartNativeAdd=add;add=function(id){if(S.busy||S.clientCartLoading||S.clientCartError||clientCartHasPending())return;var r=clientCartNativeAdd.apply(this,arguments);clientCartSchedule();return r};
var clientCartNativeQty=qty;qty=function(id,d){if(S.busy||S.clientCartLoading||S.clientCartError||clientCartHasPending()||String(id||'').indexOf('client_cart:')===0)return;var r=clientCartNativeQty.apply(this,arguments);clientCartSchedule();return r};
async function cancelCartOrder(id){
  var row=S.cart[id];if(!row||!S.clientId)return;
  if(!window.confirm('Eliminare '+String(row.item.title||'questa scheda')+'?\n\nAnnulla anche l’ordine di Laboratorio e archivia gli eventuali Preventivo/Busta collegati allo stesso ordine. La voce sarà rimossa dal carrello.\nPagamenti, acconti e scontrini già registrati NON vengono annullati né rimborsati. Una copia delle schede resta conservata.'))return;
  var cid=String(S.clientId);S.busy=true;renderCart();
  try{
    await clientCartBeforeCheckout();
    var x=await api('cancel_order_sheet',{client_id:cid,work_order_id:String(id).slice('client_cart:'.length),expected_cart_updated_at:clientCartVersions[cid],confirm:true});
    clientCartMutation++;clientCartSeq++;clientCartVersions[cid]=x.data.client_cart.updated_at||null;clientCartApply(x.data.client_cart.items||[],cid);
    window.dispatchEvent(new CustomEvent('optyker:sheet-removed',{detail:{client_id:cid,sheet_id:x.data.sheet_id,archived_sheet_ids:x.data.archived_sheet_ids||[x.data.sheet_id]}}));
    toast('Scheda eliminata e ordine annullato. Pagamenti e scontrini invariati.','ok');
  }catch(e){toast('Annullamento da verificare: '+e.message,'error')}finally{S.busy=false;renderCart()}
}
var clientCartNativeRemove=removeLine;removeLine=function(id){if(S.busy||S.clientCartLoading||S.clientCartError||clientCartHasPending())return;if(String(id||'').indexOf('client_cart:')===0)return cancelCartOrder(id);var r=clientCartNativeRemove.apply(this,arguments);clientCartSchedule();return r};
var clientCartNativeEnsure=ensureUI;ensureUI=function(){var r=clientCartNativeEnsure.apply(this,arguments),sel=E('optykerCashClient');if(sel&&!sel.__clientCartPersist){sel.__clientCartPersist=true;var old=sel.onchange;sel.onchange=function(){if(S.busy)return;var previous=String(S.clientId||'');clearTimeout(clientCartSaveTimer);if(previous&&!S.clientCartLoading&&!S.clientCartError&&!clientCartHasPending())clientCartSaveNow(previous,clientCartSnapshot(),++clientCartMutation).catch(function(e){clientCartFailure(e,previous)});if(old)old.apply(this,arguments);clientCartLoad(String(S.clientId||''))}}return r};
var clientCartNativeOpen=openCash;openCash=function(clientId){if(S.busy)return;var r=clientCartNativeOpen.apply(this,arguments);clientCartQueue=clientCartQueue.catch(function(){});clientCartLoad(String(S.clientId||''));return r};
var clientCartNativeClose=closeCash;closeCash=function(ev){if(S.busy)return clientCartNativeClose.apply(this,arguments);clearTimeout(clientCartSaveTimer);if(S.clientId&&!S.clientCartLoading&&!S.clientCartError&&!clientCartHasPending()){var id=String(S.clientId);clientCartSaveNow(id,clientCartSnapshot(),++clientCartMutation).catch(function(e){clientCartFailure(e,id)})}return clientCartNativeClose.apply(this,arguments)};
window.optykerCashReloadClientCart=function(clientId){var id=String(clientId||S.clientId||'');if(id&&String(S.clientId||'')===id)return clientCartLoad(id);return Promise.resolve()};
window.addEventListener('optyker:client-cart-updated',function(ev){var id=String(ev&&ev.detail&&ev.detail.client_id||'');if(id&&String(S.clientId||'')===id)clientCartLoad(id)});


/* Injected last in the cash closure: OPTYKER_CART_SELECTION_20260916 */
window.OPTYKER_CART_SELECTION='20260916-selection3';
function payableCartRows(){return cartRows().filter(function(x){return x.selected!==false})}
function cartManualPrice(v){var s=String(v==null?'':v).trim().replace(',','.');if(!s)return null;var n=Number(s);return isFinite(n)&&n>=0&&n<=1000000?Math.round(n*100)/100:null}
cartTotal=function(){return Math.round(payableCartRows().reduce(function(n,x){return n+Number(x.unitPrice==null?x.item.price:x.unitPrice)*x.qty},0)*100)/100};

function installOrderPriceEditor(row,x,id,locked){
  if(String(id||'').indexOf('client_cart:')!==0)return;
  var holder=row.querySelector('.optykerCashCartItemPrice');if(!holder)return;
  var base=Math.round(Number(x.item&&x.item.price||0)*100)/100,unit=x.unitPrice==null?base:Number(x.unitPrice||0);
  holder.classList.add('optykerCashOrderPriceEditor');
  holder.innerHTML='<label>Prezzo finale</label><div><span>€</span><input type="text" inputmode="decimal" data-price="'+esc(id)+'" value="'+esc(unit.toFixed(2))+'" aria-label="Prezzo finale '+esc(x.item&&x.item.title||'ordine')+'"><button type="button" data-price-reset="'+esc(id)+'" title="Ripristina il prezzo della Busta">↺</button></div><small>Prezzo Busta: '+esc(euro(base))+(x.unitPrice!=null&&Math.abs(unit-base)>.004?' · manuale':'')+'</small>';
  var input=holder.querySelector('[data-price]'),reset=holder.querySelector('[data-price-reset]');
  input.disabled=locked;reset.disabled=locked||x.unitPrice==null;
  input.oninput=function(){var n=cartManualPrice(this.value);if(n!=null){x.unitPrice=n;var total=E('optykerCashTotal');if(total)total.textContent=euro(cartTotal())}};
  input.onchange=function(){if(locked)return;var raw=String(this.value||'').trim(),n=cartManualPrice(raw);if(!raw){x.unitPrice=null}else if(n==null){toast('Prezzo finale non valido.','error');this.value=Number(x.unitPrice==null?base:x.unitPrice).toFixed(2);return}else{x.unitPrice=n;this.value=n.toFixed(2)}renderCart();clientCartSchedule()};
  reset.onclick=function(){if(locked)return;x.unitPrice=null;renderCart();clientCartSchedule()};
}

var selectionNativeRender=renderCart;
renderCart=function(){
  var result=selectionNativeRender.apply(this,arguments),box=E('optykerCashCartItems');if(!box)return result;
  var selected=payableCartRows(),all=cartRows(),locked=S.busy||S.clientCartLoading||!!S.clientCartError||clientCartHasPending();
  box.querySelectorAll('[data-vat]').forEach(function(vat){
    var id=vat.dataset.vat,x=S.cart[id],row=vat.closest('.optykerCashCartItem');if(!x||!row)return;
    row.classList.toggle('optykerCashExcluded',x.selected===false);
    var label=document.createElement('label');label.className='optykerCashSelectLine';
    var input=document.createElement('input');input.type='checkbox';input.checked=x.selected!==false;
    input.dataset.payLine=id;input.disabled=locked;input.setAttribute('aria-label','Da pagare: '+String(x.item.title||'Articolo'));
    var text=document.createElement('span');text.textContent=x.selected===false?'Da pagare in seguito':'Da pagare ora';
    label.append(input,text);row.firstElementChild.prepend(label);
    input.onchange=function(){if(S.busy||S.clientCartLoading||S.clientCartError)return;x.selected=this.checked;renderCart();clientCartSchedule()};
    installOrderPriceEditor(row,x,id,locked);
  });
  if(locked)box.querySelectorAll('button,input,select').forEach(function(b){b.disabled=true});
  var count=E('optykerCashCartCount');if(count&&all.length)count.textContent=selected.length+' voc'+(selected.length===1?'e':'i')+' da pagare · '+all.length+' nel carrello';
  var totalLabel=document.querySelector('#optykerCashOverlay .optykerCashTotalLabel');if(totalLabel)totalLabel.textContent='Totale da pagare';
  var button=E('optykerCashCheckoutBtn');if(button&&(locked||!selected.length))button.disabled=true;
  if(button&&!selected.length&&all.length&&!S.busy)button.textContent='Seleziona le voci da pagare';
  var client=E('optykerCashClient');if(client&&locked)client.disabled=true;
  var search=E('optykerCashClientSearch');if(search)search.disabled=!!locked;
  return result;
};

function localDeliveredRows(sale,rows){
  if(Array.isArray(rows)&&rows.length)return rows;
  var lines=sale&&sale.data&&Array.isArray(sale.data.lines)?sale.data.lines:[];
  return lines.map(function(x){return {item:{variant_id:String(x.variant_id||x.catalog_id||'')},qty:Math.max(0,Number(x.quantity||0))}});
}
function applyCheckoutCart(sale,rows){
  var current=String(S.clientId||''),client=String(sale&&sale.client_id||'');
  if(current!==client)return;
  if(current){
    if(!sale.client_cart||String(sale.client_cart.client_id)!==current)throw new Error('Carrello da sincronizzare: usa Recupera incasso prima di continuare.');
    clientCartMutation++;clientCartSeq++;clearTimeout(clientCartSaveTimer);
    clientCartVersions[current]=sale.client_cart.updated_at||null;
    clientCartApply(sale.client_cart.items||[],current);return;
  }
  // An occasional/local cart follows the same rule: only physical delivery consumes lines.
  if(!sale||!sale.delivered_at)return;
  localDeliveredRows(sale,rows).forEach(function(x){var id=String(x.item.variant_id),now=S.cart[id];if(!now)return;now.qty-=x.qty;if(now.qty<=0)delete S.cart[id]});
}

var selectionNativeCheckout=checkout;
checkout=function(){
  if(S.busy||!payableCartRows().length)return;
  if(S.clientCartLoading||S.clientCartError){toast(S.clientCartError||'Attendi il caricamento del carrello.','error');return}
  if(sessionStorage.getItem('optykerCashPendingRequest')){toast('Usa Recupera incasso per verificare il tentativo precedente.','error');return}
  return selectionNativeCheckout.apply(this,arguments);
};


/* OPTYKER_CASH_CLIENT_SEARCH_20260919: read-only lookup, native customer selection.
   Included inside the existing POS closure. No receipts, checkout or fiscal writes. */
window.OPTYKER_CASH_CLIENT_SEARCH_VERSION='20260919-clientsearch1';
var cashLookup={seq:0,timer:0,controller:null,query:'',rows:[],open:false,pending:false,error:'',limited:false};
function cashLookupNorm(v){return String(v==null?'':v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim()}
function cashLookupMatches(c,q){
  var text=cashLookupNorm([c.surname,c.name,c.phone,c.email,c.reference_no,c.reference_code,c.fiscal,c.vat].join(' '));
  return cashLookupNorm(q).split(' ').filter(Boolean).every(function(t){return text.indexOf(t)>=0});
}
function cashLookupMerge(){
  var byId=new Map();
  for(var i=0;i<arguments.length;i++)(arguments[i]||[]).forEach(function(c){if(c&&typeof c.id==='string'&&c.id)byId.set(c.id,Object.assign({},byId.get(c.id)||{},c))});
  return Array.from(byId.values()).sort(function(a,b){return clientLabel(a).localeCompare(clientLabel(b),'it')});
}
function cashLookupBlock(){
  if(S.busy)return 'Incasso o operazione in corso: attendi l’esito prima di cambiare cliente.';
  if(clientCartHasPending())return 'Incasso precedente da verificare: usa Recupera incasso prima di cambiare cliente.';
  if(S.clientCartLoading)return 'Carrello in caricamento. Puoi cercare; attendi prima di selezionare un altro cliente.';
  if(S.clientCartError)return String(S.clientCartError);
  return '';
}
function cashLookupUi(){
  var input=E('optykerCashClientSearch'),parent=input&&input.closest('.optykerCashClientBox');if(!parent)return;
  var label=parent.querySelector('label');if(label)label.htmlFor=input.id;
  input.setAttribute('aria-controls','optykerCashClientResults');input.setAttribute('aria-describedby','optykerCashClientSearchStatus');
  var select=E('optykerCashClient'),sl=parent.querySelector('.optykerCashClientSelectLabel');if(sl&&select)sl.htmlFor=select.id;
  var box=E('optykerCashClientResults');
  if(!box){
    box=document.createElement('section');box.id='optykerCashClientResults';box.setAttribute('aria-label','Risultati ricerca clienti');
    var status=document.createElement('div');status.id='optykerCashClientSearchStatus';status.setAttribute('role','status');status.setAttribute('aria-live','polite');
    var rows=document.createElement('div');rows.className='cashClientSearchRows';
    var actions=document.createElement('div');actions.className='cashClientSearchActions';
    box.append(status,rows,actions);parent.appendChild(box);
  }
  return box;
}
function cashLookupPick(id){
  var blocked=cashLookupBlock();if(blocked){toast(blocked,'error');cashLookupRender();return;}
  if(String(S.clientId||'')===String(id||'')){cashLookup.open=false;cashLookupRender();return;}
  var c=cashLookup.rows.find(function(x){return x.id===id}),sel=E('optykerCashClient');if(!c||!sel)return;
  var current=currentCashClient();S.clients=cashLookupMerge(S.clients,[c],current?[current]:[]);
  fillClients(S.clientId,S.clients);
  sel.value=id;
  // Run the native persistence and customer handlers exactly once, never checkout.
  sel.dispatchEvent(new Event('change',{bubbles:true}));
  cashLookup.open=false;cashLookupRender();
}
function cashLookupRender(){
  var box=cashLookupUi();if(!box)return;
  var input=E('optykerCashClientSearch'),blocked=cashLookupBlock();
  // Searching is read-only. Cart loading/errors must not disable typing.
  input.disabled=!!S.busy;input.setAttribute('aria-expanded',cashLookup.open?'true':'false');
  box.hidden=!cashLookup.open;if(box.hidden)return;
  var matches=cashLookup.rows.filter(function(c){return cashLookupMatches(c,cashLookup.query)}),shown=matches.slice(0,60);
  var text=cashLookup.pending?'Ricerca in corso…':cashLookup.error?'Ricerca online non completata. '+cashLookup.error:matches.length?matches.length+' clienti trovati. Seleziona il cliente nei risultati.':'Nessun cliente trovato. Prova cognome, telefono, email o ID.';
  if(cashLookup.pending&&matches.length)text+=' Risultati già disponibili qui sotto.';
  if(cashLookup.error&&matches.length)text+=' Sono mostrati solo i clienti già caricati.';
  if(matches.length>60||cashLookup.limited)text+=' Affina la ricerca per vedere tutti i risultati pertinenti.';
  if(blocked)text+=' '+blocked;
  var status=E('optykerCashClientSearchStatus');if(status.textContent!==text)status.textContent=text;
  var rows=box.querySelector('.cashClientSearchRows');
  // Avoid replacing focused result buttons when unrelated POS renders run.
  var key=JSON.stringify([shown.map(function(c){return [c.id,clientLabel(c),c.phone,c.email]}),!!blocked]);
  if(rows.dataset.key!==key){
    rows.dataset.key=key;rows.replaceChildren();
    shown.forEach(function(c){
      var b=document.createElement('button');b.type='button';b.dataset.cashClientId=c.id;b.className='cashClientSearchResult';b.disabled=!!blocked;
      var name=document.createElement('strong');name.textContent=clientLabel(c);
      var meta=document.createElement('span');meta.textContent=[c.phone,c.email].filter(Boolean).join(' · ');
      b.append(name,meta);b.onclick=function(){cashLookupPick(c.id)};
      b.onkeydown=function(e){if(e.key==='Escape'){cashLookup.open=false;cashLookupRender();input.focus()}};
      rows.appendChild(b);
    });
  }
  var actions=box.querySelector('.cashClientSearchActions'),actionKey=JSON.stringify([!!cashLookup.error,!!S.clientCartReadFailed,!!S.busy]);
  if(actions.dataset.key!==actionKey){
    actions.dataset.key=actionKey;actions.replaceChildren();
    if(cashLookup.error){var retry=document.createElement('button');retry.type='button';retry.id='optykerCashClientSearchRetry';retry.textContent='Riprova ricerca';retry.disabled=!!S.busy;retry.onclick=function(){searchCashClients(input.value)};actions.appendChild(retry)}
    if(S.clientCartReadFailed&&!S.busy&&!clientCartHasPending()){
      var reload=document.createElement('button');reload.type='button';reload.id='optykerCashClientCartRetry';reload.textContent='Riprova caricamento carrello';
      reload.onclick=function(){if(!S.busy&&!clientCartHasPending()&&S.clientCartReadFailed)clientCartLoad(String(S.clientId||''))};actions.appendChild(reload);
    }
  }
}
function cashLookupCancel(){
  ++cashLookup.seq;clearTimeout(cashLookup.timer);clearTimeout(S.clientSearchTimer);
  if(cashLookup.controller)cashLookup.controller.abort();cashLookup.controller=null;
}
function cashLookupRead(action,payload,control){
  if(action!=='clients'&&action!=='client_cart_get')return Promise.reject(new Error('Ricerca non consentita.'));
  var c=creds();if(!c.username||!c.password)return Promise.reject(new Error('Sessione operatore scaduta: accedi nuovamente.'));
  return fetch('https://whgziwaegjzqsgcntesr.supabase.co/functions/v1/optyker-cash-register-api-v2',{
    method:'POST',headers:{'Content-Type':'application/json'},cache:'no-store',signal:control.signal,
    body:JSON.stringify({action:action,username:c.username,password:c.password,payload:payload})
  }).then(function(r){return r.json().catch(function(){return null}).then(function(x){if(!r.ok||!x||x.ok!==true)throw new Error(r.status===401?'Sessione operatore scaduta: accedi nuovamente.':x&&x.error||'Risposta del server non valida.');return x})});
}
function cashLookupDeadline(task,ctl,message){
  var timer,deadline=new Promise(function(resolve,reject){timer=setTimeout(function(){ctl.abort();reject(new Error(message));},12000)});
  return Promise.race([task,deadline]).finally(function(){clearTimeout(timer)});
}
searchCashClients=function(q,keepId){
  cashLookupCancel();var seq=cashLookup.seq,clean=String(q||'').trim().slice(0,80),ctl=new AbortController();cashLookup.controller=ctl;
  cashLookup.query=clean;cashLookup.open=!!clean;cashLookup.pending=true;cashLookup.error='';cashLookup.limited=false;
  cashLookup.rows=cashLookupMerge(clientsLocal(),S.clients);cashLookupRender();
  // The existing server matches one field at a time. Query a meaningful token,
  // then match every token across name/surname/contact fields, in either order.
  var terms=clean.split(/\s+/).filter(Boolean),term=terms.length>1?terms.slice().sort(function(a,b){return b.length-a.length})[0]:clean;
  return cashLookupDeadline(cashLookupRead('clients',{search:term,selected_id:S.clientId||keepId||''},ctl),ctl,'Nessuna risposta entro 12 secondi. Riprova ricerca.').then(function(x){
    if(seq!==cashLookup.seq||!S.cashOpen)return;
    if(!Array.isArray(x.data)||x.data.some(function(c){return !c||typeof c.id!=='string'||!c.id}))throw new Error('Elenco clienti non valido.');
    var current=currentCashClient();cashLookup.pending=false;cashLookup.limited=x.data.length>=300;
    cashLookup.rows=cashLookupMerge(clientsLocal(),x.data).filter(function(c){return cashLookupMatches(c,clean)});
    S.clients=cashLookupMerge(cashLookup.rows,current?[current]:[]);
    fillClients(S.clientId,S.clients);updateInvoiceAvailability();updateTsAvailability();cashLookupRender();
  }).catch(function(e){
    if(seq!==cashLookup.seq||!S.cashOpen)return;
    cashLookup.pending=false;cashLookup.error=String(e&&e.message||e);cashLookupRender();
  }).finally(function(){if(cashLookup.controller===ctl)cashLookup.controller=null});
};
// Bound read-only cart loading: a failed lookup must not freeze the client field.
// Queued writes are still awaited and never cancelled, retried or forgotten.
clientCartLoad=function(id){
  id=String(id||'');if(S.busy)return Promise.resolve();
  var seq=++clientCartSeq;clearTimeout(clientCartSaveTimer);S.cart={};S.clientCartError='';S.clientCartReadFailed=false;S.clientCartLoading=!!id;renderCart();
  if(!id){clientCartLastId='';return Promise.resolve()}
  var ctl=new AbortController();
  var task=clientCartQueue.catch(function(){}).then(function(){
    if(ctl.signal.aborted||seq!==clientCartSeq||String(S.clientId||'')!==id)throw new Error('Caricamento superato.');
    return cashLookupRead('client_cart_get',{client_id:id},ctl);
  });
  return cashLookupDeadline(task,ctl,'Il caricamento del carrello non ha risposto entro 12 secondi.').then(function(x){
    if(seq!==clientCartSeq||String(S.clientId||'')!==id)return;
    if(!x.data||String(x.data.client_id)!==id||!Array.isArray(x.data.items))throw new Error('Risposta del carrello non coerente con il cliente.');
    clientCartVersions[id]=x.data.updated_at||null;S.clientCartLoading=false;clientCartApply(x.data.items,id);
  }).catch(function(e){
    if(seq!==clientCartSeq||String(S.clientId||'')!==id)return;
    S.clientCartLoading=false;S.clientCartReadFailed=true;S.clientCartError='Carrello non caricato: '+String(e&&e.message||e)+' Premi Riprova caricamento carrello.';toast(S.clientCartError,'error');renderCart();
  });
};
var cashLookupEnsureNative=ensureUI;
ensureUI=function(){
  var r=cashLookupEnsureNative.apply(this,arguments),input=E('optykerCashClientSearch');if(!input)return r;
  cashLookupUi();
  if(!input.dataset.clientSearchReady){
    input.dataset.clientSearchReady='1';
    input.oninput=function(){
      cashLookupCancel();cashLookup.query=this.value.trim().slice(0,80);cashLookup.open=!!cashLookup.query;cashLookup.pending=!!cashLookup.query;cashLookup.error='';
      cashLookup.rows=cashLookupMerge(clientsLocal(),S.clients);cashLookupRender();
      cashLookup.timer=setTimeout(function(){searchCashClients(input.value)},180);
    };
    input.onfocus=function(){if(this.value.trim()){cashLookup.open=true;cashLookupRender()}};
    input.onkeydown=function(e){
      if(e.key==='Escape'){cashLookup.open=false;cashLookupRender();e.preventDefault();e.stopPropagation()}
      if(e.key==='ArrowDown'){var b=E('optykerCashClientResults').querySelector('.cashClientSearchResult:not(:disabled)');if(b){b.focus();e.preventDefault()}}
      if(e.key==='Enter'){e.preventDefault();searchCashClients(input.value)}
    };
  }
  return r;
};
var cashLookupRenderNative=renderCart;renderCart=function(){var r=cashLookupRenderNative.apply(this,arguments);cashLookupRender();return r};
var cashLookupCloseNative=closeCash;closeCash=function(){var r=cashLookupCloseNative.apply(this,arguments);if(!S.cashOpen){cashLookupCancel();cashLookup.open=false;cashLookup.rows=[];cashLookupRender()}return r};


/* OPTYKER_CASH_FISCAL_PREFLIGHT_20260919: validate before checkout, never print. */
window.OPTYKER_CASH_FISCAL_PREFLIGHT_VERSION='20260919-preflight1';
// Matches the already configured and verified RCH mapping, not new tax rules.
var cashFiscalDepartments={1:{vat:'04',type:'goods',label:'4% · bene'},2:{vat:'22',type:'goods',label:'22% · bene'},3:{vat:'ART10',type:'services',label:'Esente Art.10 · servizio'}};
function cashFiscalMismatch(row){
 var p=row.item||{},dep=Number(row.department||({'04':1,'22':2,'ART10':3}[p.fiscal_vat_code||p.vat_code])||0),map=cashFiscalDepartments[dep];
 return !!(map&&p.fiscal_item_type&&p.fiscal_item_type!==map.type);
}
function cashCatalogDepartment(row){
 var p=row.item||{};
 return Object.keys(cashFiscalDepartments).map(Number).find(function(k){var d=cashFiscalDepartments[k];return d.vat===(p.fiscal_vat_code||p.vat_code)&&d.type===p.fiscal_item_type})||0;
}
function cashFiscalPreflightUi(){
 var box=E('optykerCashCartItems');if(!box)return;
 box.querySelectorAll('[data-vat]').forEach(function(sel){
  var row=S.cart[sel.dataset.vat];if(!row||!cashFiscalMismatch(row))return;
  var note=document.createElement('div');note.className='cashFiscalMismatch';note.setAttribute('role','alert');
  note.textContent='IVA / tipologia non compatibile con questo articolo. ';sel.setAttribute('aria-invalid','true');
  var suggested=cashCatalogDepartment(row);
  if(suggested){
   var b=document.createElement('button');b.type='button';b.textContent='Usa IVA da magazzino: '+cashFiscalDepartments[suggested].label;b.dataset.cashCatalogVat=sel.dataset.vat;
   b.disabled=!!(S.busy||S.clientCartLoading||S.clientCartError||clientCartHasPending()||S.ovcPricePending||S.ovcPriceError||S.ovcQuoteKey!==ovcCartKey());
   b.onclick=function(){
    if(S.busy||S.clientCartLoading||S.clientCartError||clientCartHasPending()||S.ovcPricePending||S.ovcPriceError||S.ovcQuoteKey!==ovcCartKey())return;
    // Explicit click only: reuse the native VAT change and serialized cart save.
    sel.value=String(suggested);sel.dispatchEvent(new Event('change',{bubbles:true}));
   };note.appendChild(b);
  }else note.appendChild(document.createTextNode('Verifica la configurazione IVA in magazzino.'));
  sel.parentElement.after(note);
 });
 if(!S.invoice&&S.payment!=='pending'&&cartTotal()>0&&payableCartRows().some(cashFiscalMismatch)){
  var b=E('optykerCashCheckoutBtn');if(b)b.disabled=true;
 }
}
var cashPreflightNativeRender=renderCart;
renderCart=function(){var r=cashPreflightNativeRender.apply(this,arguments);cashFiscalPreflightUi();return r};
var cashPreflightNativeCheckout=checkout;
checkout=function(){
 if(!S.invoice&&S.payment!=='pending'&&cartTotal()>0&&payableCartRows().some(cashFiscalMismatch)){
  toast('Controlla IVA e tipologia nelle righe evidenziate. Nessun incasso è stato inviato.','error');renderCart();return;
 }
 return cashPreflightNativeCheckout.apply(this,arguments);
};
(function(){var s=document.createElement('style');s.id='optykerCashFiscalPreflightCss';s.textContent='.cashFiscalMismatch{max-width:600px;margin:8px 0;padding:10px;border:1px solid #d8968e;background:#fff5f2;color:#8b2720;border-radius:8px;font-size:12px;line-height:1.5}.cashFiscalMismatch button{display:block;margin-top:8px;padding:9px;border:1px solid #bca7a2;border-radius:6px;background:#fff;color:#702820;cursor:pointer}.cashFiscalMismatch button:disabled{opacity:.55;cursor:default}';document.head.appendChild(s)})();


/* OPTYKER_RECORDED_BALANCES_20260921: server-recorded deposits, no price/payment rewrites. */
window.OPTYKER_RECORDED_BALANCES_VERSION='20261113-repeat1';
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
function balanceBlock(){var d=balanceData();return d&&d.blockers&&d.blockers[0]}
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
  if(blocked)html+='<div class="balanceFiscalAlert" role="alert"><b>Stampa sospesa: esito RCH da verificare'+(blocked.amount_cents!=null?' · '+esc(euro(blocked.amount_cents/100)):'')+'</b><p>La modalità REG non risolve un’emissione con esito incerto. Verifica il documento già registrato prima di un nuovo incasso.</p><button type="button" data-balance-receipt="'+esc(blocked.sale_id)+'">Apri esito scontrino</button> <button type="button" data-balance-refresh>Aggiorna esito</button></div>';
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
  b.disabled=!!(S.busy||S.clientCartLoading||S.clientCartError||clientCartHasPending()||!whole||g.due_cents===0||(S.stage==='deposit'&&!(depositAmount()>0&&Math.round(depositAmount()*100)<g.due_cents))||S.payment==='mixed'||S.payment==='pending');
  if(total)total.textContent=euro(cartTotal());
  var hint=E('optykerCashBalanceHint');if(!hint){hint=document.createElement('p');hint.id='optykerCashBalanceHint';box.appendChild(hint)}
  hint.textContent=!whole?'Salda una vendita già registrata alla volta, selezionando tutte le sue righe e togliendo la spunta agli altri articoli.':g.due_cents===0?'Già saldato: usa Consegna, non Incassa.':S.stage==='deposit'?'Acconto successivo sulla stessa vendita: inserisci un importo inferiore al residuo e scegli il pagamento.':'Con Saldo incassi '+euro(g.due_cents/100)+' sulla vendita esistente, non il prezzo originario.';
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
  if(!whole||!g.due_cents||(S.stage==='deposit'&&!(depositAmount()>0&&Math.round(depositAmount()*100)<g.due_cents))){balancePaint();return}
  return settleExisting(g.sale_id,S.stage==='deposit'?'deposit':S.stage==='delivery_balance'?'delivery_balance':'balance',null);
 }
 return balanceNativeCheckout.apply(this,arguments);
};
var balanceNativeSettle=settleExisting;
settleExisting=function(){var args=arguments;if(S.busy||recordedBalance.checking)return;recordedBalance.checking=true;balancePaint();return balanceLoad().then(function(d){recordedBalance.checking=false;if(!d)return;if(d.blockers.length&&!S.invoice){toast('Verifica prima lo scontrino con esito incerto. Nessun saldo registrato.','error');balancePaint();return}return balanceNativeSettle.apply(null,args)})};
var balanceNativeOpen=openCash;
openCash=function(){recordedBalance.requested='';recordedBalance.key='';recordedBalance.data=null;recordedBalance.error='';var r=balanceNativeOpen.apply(this,arguments);balanceQueue();return r};
var balanceNativeClose=closeCash;
closeCash=function(){var r=balanceNativeClose.apply(this,arguments);if(!S.cashOpen){++recordedBalance.seq;clearTimeout(recordedBalance.timer);if(recordedBalance.controller)recordedBalance.controller.abort();recordedBalance.key='';recordedBalance.requested='';recordedBalance.data=null;recordedBalance.loading=false;recordedBalance.checking=false}return r};
window.addEventListener('focus',function(){if(S.cashOpen&&!S.busy&&!recordedBalance.loading)balanceLoad()});
(function(){var s=document.createElement('style');s.id='optykerRecordedBalanceCss';s.textContent='#optykerCashRecordedBalance{font-size:13px;line-height:1.5;margin-top:12px}#optykerCashRecordedBalance button{padding:8px 11px;border:1px solid #c9d3df;border-radius:7px;background:white;color:#183652;cursor:pointer}#optykerCashRecordedBalance button:disabled{opacity:.55}.recordedBalanceGroup{display:flex;gap:12px;flex-wrap:wrap;align-items:center;padding:12px;margin:7px 0;background:#f2f6fb;border:1px solid #d9e2ed;border-radius:9px}.recordedBalanceGroup strong{font-size:18px}.balanceFiscalAlert{padding:12px;border:1px solid #db9893;background:#fff3f1;border-radius:9px;color:#86291f}.recordedLineBalance{display:grid;gap:5px;min-width:130px;text-align:right}.recordedLineBalance span{font-size:12px;color:#536170}.recordedLineBalance strong{font-size:25px;color:#183652}.recordedLineBalance small{font-size:12px}#optykerFiscalModal.open{z-index:2147483601!important;pointer-events:auto!important}';document.head.appendChild(s)})();


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
async function receiptReissueReady(){var end=Date.now()+15000;do{var connection=await receiptReissueCall(receiptReissueBase+'optyker-rch-relay-api','status',{}),st=connection.status||{};if(connection.online&&st.ok===true&&/^REG(?:\s*\(OP\s*\d+\))?$/.test(String(st.mode||''))&&String(st.idleState)==='0'&&['busy','errorCode','printerError','paperEnd','coverOpen'].every(function(k){return Number(st[k])===0}))return;if(Date.now()>=end)break;await new Promise(function(resolve){setTimeout(resolve,1000)})}while(true);throw new Error('La RCH non è pronta in REG. Nessun comando fiscale inviato.')}
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
   await receiptReissueReady();
   for(var p of todo){
    receiptReissueMessage('Riemissione di '+euro(p.amount_cents/100)+' sul pagamento originale…');
    var job;
    for(var attempt=0;attempt<2;attempt++){
     await receiptReissueReady();
     var prepared=await receiptReissueApi('prepare',{client_id:cid,sale_id:saleId,payment_id:p.payment_id,original_job_id:p.original_job_id,void_job_id:p.void_job_id,confirm_not_already_reissued:true});job=prepared.job;
     if(prepared.claim_token){var q=await receiptReissueCall(receiptReissueBase+'optyker-rch-relay-api','queue_fiscal',{job_id:job.id,token:prepared.claim_token,operation:'sale'});job=await receiptReissueWait(job.id,q.id)}
     if(job.state!=='not_started')break;
     if(attempt===0)receiptReissueMessage('La RCH non era pronta; attendo REG e riprovo una sola volta senza nuovo incasso…');
    }
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

})();


(function(){
  if(window.__optykerBillingAdminLoaded)return;
  window.__optykerBillingAdminLoaded=true;

  var API='https://whgziwaegjzqsgcntesr.supabase.co/functions/v1/optyker-billing-admin';
  var TOKEN_KEY='optyker_billing_admin_token';
  var state={token:'',mode:'outgoing',rows:[],provider:null,restoring:false};
  var months=['','Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];

  function E(id){return document.getElementById(id)}
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
  function call(action,payload,token){
    var body=payload||{};body.action=action;
    var headers={'Content-Type':'application/json'};
    var t=token||state.token;
    if(t)headers.Authorization='Bearer '+t;
    return fetch(API,{method:'POST',headers:headers,body:JSON.stringify(body)}).then(function(r){
      return r.json().catch(function(){return {}}).then(function(x){
        if(!r.ok||x&&x.ok===false){var er=new Error((x&&x.error)||('HTTP '+r.status));er.code=x&&x.code;er.status=r.status;er.payload=x;throw er}
        return x
      })
    })
  }
  function toast(msg,type){
    var t=E('optykerBillingToast');
    if(!t){t=document.createElement('div');t.id='optykerBillingToast';document.body.appendChild(t)}
    t.className=type||'';t.textContent=msg;t.style.display='block';
    clearTimeout(t.__hide);t.__hide=setTimeout(function(){t.style.display='none'},4200)
  }
  function removeNormalVisualCareOption(){
    var s=E('optykerUserSelect');if(!s)return;
    for(var i=s.options.length-1;i>=0;i--){
      if(String(s.options[i].value||'').trim().toLowerCase()==='ottica visual care')s.remove(i)
    }
  }
  function ensureAdminAccess(){
    removeNormalVisualCareOption();
    var card=document.querySelector('.optykerUserLoginCard');
    if(!card||E('optykerAdminAccessBox'))return;
    var box=document.createElement('div');box.id='optykerAdminAccessBox';box.className='optykerAdminAccessBox';
    box.innerHTML='<div class="optykerAdminAccessLabel">Amministrazione</div><button id="optykerAdminAccessBtn" type="button">OTTICA VISUAL CARE · ACCESSO AMMINISTRATIVO</button>';
    card.appendChild(box);
    E('optykerAdminAccessBtn').onclick=showAdminLogin
  }
  function ensureAdminSidebarButton(){
    var nav=E('moduleNav');
    if(!nav||window.OPTYKER_BILLING_ADMIN)return;
    var b=E('navAdministration');
    if(!b){
      b=document.createElement('button');
      b.id='navAdministration';b.className='moduleBtn';b.type='button';
      b.setAttribute('data-short','Amministrazione');
      b.textContent='Amministrazione';
      b.style.order='80';
      b.onclick=function(){showAdminLogin(true)};
      nav.appendChild(b)
    }
  }
  function showAdminLogin(fromSidebar){
    var screen=E('optykerLoginScreen'),shell=document.querySelector('#optykerLoginScreen .optykerLoginShell');if(!shell)return;
    var appMain=E('mainApp');
    if(fromSidebar&&screen){
      screen.__optykerAdminFromSidebar=true;
      screen.style.setProperty('display','flex','important');
      screen.setAttribute('aria-hidden','false');
      if(appMain)appMain.style.setProperty('display','none','important')
    }
    var normal=document.querySelector('.optykerUserLoginCard');if(normal)normal.style.display='none';
    var old=E('optykerAdminLoginCard');if(old)old.remove();
    var card=document.createElement('div');card.id='optykerAdminLoginCard';card.className='optykerAdminLoginCard';
    card.innerHTML='<div class="optykerAdminLoginHead"><div class="optykerAdminLoginEyebrow">Optyker · Amministrazione</div><div class="optykerAdminLoginTitle">Ottica Visual Care</div><div class="optykerAdminLoginSub">Accesso riservato alla fatturazione.</div></div><div id="optykerAdminLoginBody"><div class="optykerBillingLoading">Verifica account…</div></div><button id="optykerAdminLoginBack" type="button">← Torna agli operatori</button>';
    shell.appendChild(card);
    E('optykerAdminLoginBack').onclick=function(){
      card.remove();if(normal)normal.style.display='block';
      if(screen&&screen.__optykerAdminFromSidebar){
        screen.__optykerAdminFromSidebar=false;
        screen.style.setProperty('display','none','important');
        screen.setAttribute('aria-hidden','true');
        if(appMain)appMain.style.setProperty('display','grid','important')
      }
    };
    call('auth_status',{},'').then(function(x){renderAdminAuthForm(!!x.needs_password)}).catch(function(err){
      E('optykerAdminLoginBody').innerHTML='<div id="optykerAdminLoginError">'+esc(err.message)+'</div>'
    })
  }
  function renderAdminAuthForm(needs){
    var body=E('optykerAdminLoginBody');if(!body)return;
    if(needs){
      body.innerHTML='<label class="optykerAdminLoginLabel">Crea password</label><input id="optykerAdminPassword" class="optykerAdminLoginInput" type="password" autocomplete="new-password" placeholder="Almeno 8 caratteri"><label class="optykerAdminLoginLabel">Conferma password</label><input id="optykerAdminPassword2" class="optykerAdminLoginInput" type="password" autocomplete="new-password" placeholder="Ripeti la password"><div class="optykerAdminPasswordHint">La password viene salvata in forma protetta e non viene inserita nel codice del sito.</div><button id="optykerAdminLoginSubmit" type="button">CREA PASSWORD ED ENTRA</button><div id="optykerAdminLoginError"></div>';
    }else{
      body.innerHTML='<label class="optykerAdminLoginLabel">Utente</label><input class="optykerAdminLoginInput" value="Ottica Visual Care" readonly><label class="optykerAdminLoginLabel">Password</label><input id="optykerAdminPassword" class="optykerAdminLoginInput" type="password" autocomplete="current-password" placeholder="Password"><button id="optykerAdminLoginSubmit" type="button">ENTRA IN AMMINISTRAZIONE</button><div id="optykerAdminLoginError"></div>';
    }
    var btn=E('optykerAdminLoginSubmit'),pw=E('optykerAdminPassword'),pw2=E('optykerAdminPassword2');
    btn.onclick=function(){
      var err=E('optykerAdminLoginError');if(err)err.textContent='';
      var password=pw?pw.value:'';
      if(password.length<8){if(err)err.textContent='La password deve avere almeno 8 caratteri.';return}
      if(needs&&pw2&&password!==pw2.value){if(err)err.textContent='Le password non coincidono.';return}
      btn.disabled=true;btn.textContent=needs?'CREAZIONE…':'ACCESSO…';
      var action=needs?'set_initial_password':'login';
      var payload=needs?{password:password,confirm_password:pw2.value}:{username:'Ottica Visual Care',password:password};
      call(action,payload,'').then(function(x){
        if(!x.token)throw new Error('Token amministrativo non disponibile');
        try{sessionStorage.setItem(TOKEN_KEY,x.token)}catch(z){}
        startAdmin(x.token)
      }).catch(function(e){if(err)err.textContent=e.message;btn.disabled=false;btn.textContent=needs?'CREA PASSWORD ED ENTRA':'ENTRA IN AMMINISTRAZIONE'})
    };
    [pw,pw2].forEach(function(x){if(x)x.onkeydown=function(ev){if(ev.key==='Enter'){ev.preventDefault();btn.click()}}});
    setTimeout(function(){try{pw.focus()}catch(z){}},0)
  }

  function ensureHeaderTools(){
    var right=document.querySelector('.topbarRight');if(!right||E('optykerBillingHeaderTools'))return;
    var d=document.createElement('div');d.id='optykerBillingHeaderTools';d.className='optykerBillingHeaderTools';
    d.innerHTML='<div class="optykerBillingHeaderBadge">Amministrazione · Ottica Visual Care</div><button id="optykerBillingLogout" class="optykerBillingBtn" type="button">Esci</button>';
    right.appendChild(d);
    E('optykerBillingLogout').onclick=function(){
      try{sessionStorage.removeItem(TOKEN_KEY)}catch(z){}
      state.token='';document.body.classList.remove('optykerBillingMode');window.OPTYKER_BILLING_ADMIN=false;window.optykerAuthenticated=false;window.OPTYKER_ACTIVE_USER='';
      location.reload()
    }
  }
  function ensureSidebar(){
    var nav=E('moduleNav');if(!nav)return;
    nav.style.display='flex';
    var group=E('optykerBillingNavGroup');
    if(!group){
      var children=Array.prototype.slice.call(nav.children);
      children.forEach(function(ch){ch.setAttribute('data-billing-hidden','1');ch.style.setProperty('display','none','important')});
      group=document.createElement('div');group.id='optykerBillingNavGroup';group.className='optykerBillingNavGroup';
      group.innerHTML='<button id="optykerBillingMainNav" type="button">Fatturazione</button><div class="optykerBillingSubnav"><button data-billing-mode="outgoing" type="button">Fatture emesse</button><button data-billing-mode="incoming" type="button">Fatture in entrata</button><button data-billing-mode="errors" type="button">Errori</button></div>';
      nav.appendChild(group);
      E('optykerBillingMainNav').onclick=function(){showSection(state.mode||'outgoing')};
      var bs=group.querySelectorAll('[data-billing-mode]');
      for(var i=0;i<bs.length;i++)bs[i].onclick=function(){showSection(this.getAttribute('data-billing-mode'))}
    }
    Array.prototype.slice.call(nav.children).forEach(function(ch){if(ch!==group)ch.style.setProperty('display','none','important')})
  }
  function hideRegularPanels(){
    var panels=document.querySelectorAll('.panel');
    for(var i=0;i<panels.length;i++)if(panels[i].id!=='optykerBillingPanel')panels[i].style.setProperty('display','none','important');
    var ids=['dashboardPanel','analysisPanel','prescriptionPanel','visualExamPanel','indicationsPanel','hearingPanel','clientsPanel','onlineOrdersPanel','lacPanel','analysisTabs','optykerLaboratoryPanel'];
    for(i=0;i<ids.length;i++){var x=E(ids[i]);if(x)x.style.setProperty('display','none','important')}
    var report=E('reportSectionTop');if(report)report.style.setProperty('display','none','important')
  }
  function yearsOptions(){
    var y=(new Date()).getFullYear(),h='<option value="">Tutti gli anni</option>';
    for(var n=y+1;n>=2018;n--)h+='<option value="'+n+'">'+n+'</option>';
    return h
  }
  function monthsOptions(){
    var h='<option value="">Tutti i mesi</option>';for(var i=1;i<=12;i++)h+='<option value="'+i+'">'+months[i]+'</option>';return h
  }
  function daysOptions(){
    var h='<option value="">Tutti i giorni</option>';for(var i=1;i<=31;i++)h+='<option value="'+i+'">'+i+'</option>';return h
  }
  function ensurePanel(){
    var p=E('optykerBillingPanel');if(p)return p;
    p=document.createElement('div');p.id='optykerBillingPanel';p.className='panel';
    p.innerHTML='<div class="optykerBillingTop"><div><div class="optykerBillingEyebrow">OPTYKER · AMMINISTRAZIONE</div><div id="optykerBillingTitle" class="optykerBillingTitle">Fatturazione</div><div id="optykerBillingSub" class="optykerBillingSub"></div></div><div class="optykerBillingTopActions"><span id="optykerBillingProviderStatus" class="optykerBillingStatus">Verifica collegamento…</span><button id="optykerBillingSync" class="optykerBillingBtn primary" type="button">Aggiorna fatture</button></div></div>'+
    '<div class="optykerBillingToolbar"><div class="optykerBillingField"><label>Ricerca</label><input id="billQ" type="search" placeholder="Numero, intestazione, fornitore/cliente, P.IVA…"></div><div class="optykerBillingField"><label>Anno</label><select id="billYear">'+yearsOptions()+'</select></div><div class="optykerBillingField"><label>Mese</label><select id="billMonth">'+monthsOptions()+'</select></div><div class="optykerBillingField"><label>Giorno</label><select id="billDay">'+daysOptions()+'</select></div><div class="optykerBillingField"><label>Fornitore / Cliente</label><select id="billCounterparty"><option value="">Tutti</option></select></div></div>'+
    '<div class="optykerBillingToolbar2"><div class="optykerBillingField"><label>Data dal</label><input id="billFrom" type="date"></div><div class="optykerBillingField"><label>Data al</label><input id="billTo" type="date"></div><div class="optykerBillingField"><label>Tipo fornitore</label><select id="billSupplierType"><option value="">Tutti i tipi</option></select></div><div class="optykerBillingField"><label>Stato SDI</label><select id="billSdi"><option value="">Tutti gli stati</option><option value="delivered">Consegnata</option><option value="accepted">Accettata</option><option value="processing">In elaborazione</option><option value="rejected">Scartata</option><option value="error">Errore</option></select></div><div class="optykerBillingActionField"><button id="billApply" class="optykerBillingBtn primary" type="button">Applica filtri</button></div><div class="optykerBillingActionField"><button id="billReset" class="optykerBillingBtn" type="button">Azzera</button></div></div>'+
    '<div id="optykerBillingSummary" class="optykerBillingSummary"></div><div id="optykerBillingTableWrap" class="optykerBillingTableWrap"><div class="optykerBillingLoading">Caricamento fatture…</div></div>';
    var anchor=E('onlineOrdersPanel')||E('clientsPanel')||E('lacPanel')||document.querySelector('.panel');
    if(anchor&&anchor.parentNode)anchor.parentNode.insertBefore(p,anchor.nextSibling);else (E('mainApp')||document.body).appendChild(p);
    E('billApply').onclick=loadRows;
    E('billReset').onclick=resetFilters;
    E('billQ').onkeydown=function(ev){if(ev.key==='Enter'){ev.preventDefault();loadRows()}};
    E('optykerBillingSync').onclick=syncInvoices;
    return p
  }
  function resetFilters(){
    ['billQ','billYear','billMonth','billDay','billCounterparty','billFrom','billTo','billSupplierType','billSdi'].forEach(function(id){var x=E(id);if(x)x.value=''});
    loadRows()
  }
  function filters(){
    return {
      q:E('billQ')?E('billQ').value:'',
      year:E('billYear')?E('billYear').value:'',
      month:E('billMonth')?E('billMonth').value:'',
      day:E('billDay')?E('billDay').value:'',
      counterparty:E('billCounterparty')?E('billCounterparty').value:'',
      date_from:E('billFrom')?E('billFrom').value:'',
      date_to:E('billTo')?E('billTo').value:'',
      supplier_type:E('billSupplierType')?E('billSupplierType').value:'',
      sdi_status:E('billSdi')?E('billSdi').value:'',
      limit:500
    }
  }
  function sectionTitle(){
    if(state.mode==='incoming')return ['Fatture in entrata','Fatture ricevute dai fornitori, separate dalle fatture emesse.'];
    if(state.mode==='errors')return ['Errori SDI','Fatture con scarti o errori di trasmissione e relativo motivo.'];
    return ['Fatture emesse','Fatture emesse da Ottica Visual Care e relativo stato nel Sistema di Interscambio.']
  }
  function showSection(mode){
    state.mode=mode||'outgoing';
    hideRegularPanels();var p=ensurePanel();p.style.setProperty('display','block','important');
    var st=sectionTitle();E('optykerBillingTitle').textContent=st[0];E('optykerBillingSub').textContent=st[1];
    var bs=document.querySelectorAll('[data-billing-mode]');for(var i=0;i<bs.length;i++)bs[i].classList.toggle('active',bs[i].getAttribute('data-billing-mode')===state.mode);
    loadCounterparties();loadRows();try{window.scrollTo(0,0)}catch(z){}
  }
  function loadCounterparties(){
    var payload={direction:state.mode==='errors'?'':state.mode};
    call('counterparties',payload).then(function(x){
      var cp=E('billCounterparty'),ty=E('billSupplierType');if(!cp||!ty)return;
      var oldCp=cp.value,oldTy=ty.value;
      var names=[],types={};
      (x.data||[]).forEach(function(r){if(r.name)names.push(r.name);if(r.supplier_type)types[r.supplier_type]=1});
      names.sort(function(a,b){return a.localeCompare(b,'it')});
      cp.innerHTML='<option value="">Tutti</option>'+names.map(function(n){return '<option value="'+esc(n)+'">'+esc(n)+'</option>'}).join('');
      ty.innerHTML='<option value="">Tutti i tipi</option>'+Object.keys(types).sort().map(function(n){return '<option value="'+esc(n)+'">'+esc(n)+'</option>'}).join('');
      cp.value=oldCp;ty.value=oldTy
    }).catch(function(){})
  }
  function statusClass(v){
    v=String(v||'').toLowerCase();
    if(/error|reject|scart/.test(v))return 'error';
    if(/deliver|accept|success|ok|consegn|accett/.test(v))return 'ok';
    return ''
  }
  function fmtDate(v){
    if(!v)return '—';var d=new Date(String(v).length===10?v+'T12:00:00':v);if(isNaN(d.getTime()))return String(v);
    return d.toLocaleDateString('it-IT')
  }
  function fmtMoney(v,c){
    if(v==null||v==='')return '—';
    try{return new Intl.NumberFormat('it-IT',{style:'currency',currency:c||'EUR'}).format(Number(v))}catch(z){return String(v)+' '+(c||'EUR')}
  }
  function loadRows(){
    var wrap=E('optykerBillingTableWrap');if(!wrap)return;
    wrap.innerHTML='<div class="optykerBillingLoading">Aggiornamento fatture…</div>';
    var p=filters();if(state.mode!=='errors')p.direction=state.mode;
    call(state.mode==='errors'?'errors':'list',p).then(function(x){
      state.rows=Array.isArray(x.data)?x.data:[];renderSummary();renderTable()
    }).catch(function(err){
      if(err.status===401){try{sessionStorage.removeItem(TOKEN_KEY)}catch(z){};toast('Sessione scaduta. Accedi di nuovo.','error');setTimeout(function(){location.reload()},900);return}
      wrap.innerHTML='<div class="optykerBillingEmpty">Errore: '+esc(err.message)+'</div>'
    })
  }
  function renderSummary(){
    var s=E('optykerBillingSummary');if(!s)return;
    var total=0,errs=0;
    state.rows.forEach(function(r){if(r.total!=null&&!isNaN(Number(r.total)))total+=Number(r.total);if(r.sdi_error_code||/error|reject|scart/i.test(r.sdi_status||''))errs++});
    var h='<div class="optykerBillingMetric"><div class="optykerBillingMetricLabel">Documenti</div><div class="optykerBillingMetricValue">'+state.rows.length+'</div></div>';
    h+='<div class="optykerBillingMetric"><div class="optykerBillingMetricLabel">Totale</div><div class="optykerBillingMetricValue">'+esc(fmtMoney(total,'EUR'))+'</div></div>';
    if(state.mode==='errors')h+='<div class="optykerBillingMetric"><div class="optykerBillingMetricLabel">Errori trovati</div><div class="optykerBillingMetricValue">'+errs+'</div></div>';
    s.innerHTML=h
  }
  function renderTable(){
    var w=E('optykerBillingTableWrap');if(!w)return;
    if(!state.rows.length){w.innerHTML='<div class="optykerBillingEmpty">Nessuna fattura trovata con i filtri selezionati.</div>';return}
    var h='<table class="optykerBillingTable"><thead><tr>';
    if(state.mode==='errors'){
      h+='<th>Data</th><th>Fattura</th><th>Intestatario</th><th>Codice errore</th><th>Motivo</th><th>Stato SDI</th>';
    }else{
      h+='<th>Data</th><th>Numero</th><th>'+(state.mode==='incoming'?'Fornitore':'Cliente / Intestatario')+'</th><th>Intestazione</th><th>Totale</th><th>Stato SDI</th>';
    }
    h+='</tr></thead><tbody>';
    state.rows.forEach(function(r){
      h+='<tr data-invoice-id="'+esc(r.id)+'">';
      if(state.mode==='errors'){
        h+='<td>'+esc(fmtDate(r.issue_date||r.received_at))+'</td><td><div class="optykerInvoiceMain">'+esc(r.invoice_number||'—')+'</div><div class="optykerInvoiceMeta">'+esc(r.direction==='incoming'?'Entrata':'Emessa')+'</div></td><td><div class="optykerInvoiceMain">'+esc(r.counterparty_name||'—')+'</div><div class="optykerInvoiceMeta">'+esc(r.counterparty_vat||'')+'</div></td><td><span class="optykerBillingErrorCode">'+esc(r.sdi_error_code||'—')+'</span></td><td>'+esc(r.sdi_error_message||'Motivo non restituito dal provider')+'</td><td><span class="optykerStatusChip '+statusClass(r.sdi_status)+'">'+esc(r.sdi_status||'—')+'</span></td>';
      }else{
        h+='<td>'+esc(fmtDate(r.issue_date||r.received_at))+'</td><td><div class="optykerInvoiceMain">'+esc(r.invoice_number||'—')+'</div><div class="optykerInvoiceMeta">'+esc(r.sdi_protocol||'')+'</div></td><td><div class="optykerInvoiceMain">'+esc(r.counterparty_name||'—')+'</div><div class="optykerInvoiceMeta">'+esc(r.counterparty_vat||r.counterparty_fiscal_code||'')+'</div></td><td>'+esc(r.header||'—')+'</td><td class="optykerMoney">'+esc(fmtMoney(r.total,r.currency))+'</td><td><span class="optykerStatusChip '+statusClass(r.sdi_status)+'">'+esc(r.sdi_status||'—')+'</span></td>';
      }
      h+='</tr>'
    });
    h+='</tbody></table>';w.innerHTML=h;
    var trs=w.querySelectorAll('[data-invoice-id]');for(var i=0;i<trs.length;i++)trs[i].onclick=function(){openDetail(this.getAttribute('data-invoice-id'))}
  }
  function openDetail(id){
    var r=null;for(var i=0;i<state.rows.length;i++)if(state.rows[i].id===id){r=state.rows[i];break}if(!r)return;
    var m=E('optykerBillingModal');if(!m){m=document.createElement('div');m.id='optykerBillingModal';m.className='optykerBillingModal';document.body.appendChild(m)}
    m.innerHTML='<div class="optykerBillingModalCard"><div class="optykerBillingModalHead"><div><div class="optykerBillingEyebrow">DETTAGLIO FATTURA</div><div class="optykerBillingModalTitle">'+esc(r.invoice_number||'Fattura')+'</div></div><button id="optykerBillingModalClose" class="optykerBillingBtn" type="button">Chiudi</button></div><div class="optykerBillingDetailGrid">'+
      detail('Data',fmtDate(r.issue_date||r.received_at))+detail('Direzione',r.direction==='incoming'?'Fattura in entrata':'Fattura emessa')+
      detail('Intestatario',r.counterparty_name||'—')+detail('P.IVA / C.F.',r.counterparty_vat||r.counterparty_fiscal_code||'—')+
      detail('Totale',fmtMoney(r.total,r.currency))+detail('Stato SDI',r.sdi_status||'—')+
      detail('Protocollo SDI',r.sdi_protocol||'—')+detail('Stato provider',r.provider_status||'—')+
      detail('Intestazione',r.header||'—',true)+detail('Codice errore',r.sdi_error_code||'—')+
      detail('Motivo errore',r.sdi_error_message||'—',true)+'</div></div>';
    m.style.display='flex';E('optykerBillingModalClose').onclick=function(){m.style.display='none'};m.onclick=function(ev){if(ev.target===m)m.style.display='none'}
  }
  function detail(k,v,full){return '<div class="optykerBillingDetail'+(full?' full':'')+'"><b>'+esc(k)+'</b><span>'+esc(v)+'</span></div>'}
  function loadProvider(){
    call('provider_status',{}).then(function(x){
      state.provider=x.data||{};var s=E('optykerBillingProviderStatus');if(!s)return;
      if(state.provider.enabled&&state.provider.provider_name){
        s.className='optykerBillingStatus ok';s.textContent='Collegato · '+state.provider.provider_name+(state.provider.last_sync_at?' · '+fmtDate(state.provider.last_sync_at):'')
      }else{
        s.className='optykerBillingStatus warn';s.textContent='Collegamento fatturazione da completare'
      }
    }).catch(function(){var s=E('optykerBillingProviderStatus');if(s){s.className='optykerBillingStatus warn';s.textContent='Stato collegamento non disponibile'}})
  }
  function syncInvoices(){
    var b=E('optykerBillingSync');if(b){b.disabled=true;b.textContent='Aggiornamento…'}
    call('sync',{direction:'all'}).then(function(){toast('Fatture aggiornate.');loadProvider();loadRows()}).catch(function(err){
      toast(err.message,err.code==='PROVIDER_NOT_CONFIGURED'?'warn':'error')
    }).finally(function(){if(b){b.disabled=false;b.textContent='Aggiorna fatture'}})
  }
  function startAdmin(token){
    state.token=token;window.OPTYKER_BILLING_ADMIN=true;window.OPTYKER_ACTIVE_USER='Ottica Visual Care';window.optykerAuthenticated=true;
    document.body.classList.add('optykerBillingMode');
    var screen=E('optykerLoginScreen');if(screen){screen.style.setProperty('display','none','important');screen.setAttribute('aria-hidden','true')}
    var app=E('mainApp');if(app)app.style.display='grid';
    ensureHeaderTools();ensureSidebar();ensurePanel();hideRegularPanels();showSection('outgoing');loadProvider()
  }
  function restoreSession(){
    if(state.restoring||state.token||window.OPTYKER_BILLING_ADMIN)return;state.restoring=true;
    var t='';try{t=sessionStorage.getItem(TOKEN_KEY)||''}catch(z){}
    if(!t){state.restoring=false;return}
    call('provider_status',{},t).then(function(){startAdmin(t)}).catch(function(){try{sessionStorage.removeItem(TOKEN_KEY)}catch(z){}}).finally(function(){state.restoring=false})
  }
  function maintenance(){
    ensureAdminAccess();
    ensureAdminSidebarButton();
    if(window.OPTYKER_BILLING_ADMIN){
      document.body.classList.add('optykerBillingMode');ensureHeaderTools();ensureSidebar();ensurePanel();hideRegularPanels();
      var p=E('optykerBillingPanel');if(p)p.style.setProperty('display','block','important')
    }else restoreSession()
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',maintenance);else maintenance();
  setInterval(maintenance,700)
})();
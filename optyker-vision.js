/* OPTYKER VISION 20260910. Presentation only; all patient/order writes remain in the existing app. */
(function () {
  'use strict';
  if (window.__optykerVision) return;
  const $ = id => document.getElementById(id);
  const root = document.documentElement;
  const state = {user:'', lab:null, labError:false, lastLab:0, loading:false, clientsReady:false, selected:'', signature:'', pending:false};
  const icons = {
    client:'<circle cx="12" cy="7" r="4"/><path d="M4 22v-3a8 8 0 0 1 16 0v3"/>',
    plus:'<path d="M12 4v16M4 12h16"/>',
    cash:'<rect x="4" y="5" width="16" height="17" rx="3"/><path d="M8 2v6m8-6v6M8 13h8m-8 4h5"/>',
    glasses:'<circle cx="6" cy="13" r="5"/><circle cx="18" cy="13" r="5"/><path d="M11 12h2M1 12V8m22 4V8"/>',
    eye:'<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
    lens:'<ellipse cx="12" cy="12" rx="7" ry="10"/><path d="M12 2c-6 6-6 14 0 20"/>',
    calendar:'<rect x="3" y="5" width="18" height="17" rx="2"/><path d="M7 2v6m10-6v6M3 11h18m-14 4h2m4 0h2m-8 4h2m4 0h2"/>',
    lab:'<path d="M8 2h8M9 2v8L3 20a1 1 0 0 0 1 2h16a1 1 0 0 0 1-2l-6-10V2M7 16h10"/>',
    cart:'<path d="M1 3h3l3 13h13l3-10H5"/><circle cx="9" cy="21" r="1"/><circle cx="19" cy="21" r="1"/>',
    arrow:'<path d="M4 12h16m-6-6 6 6-6 6"/>',
    phone:'<path d="M8 3 5 2 2 5c1 9 8 16 17 17l3-3-1-3-5-2-2 3a15 15 0 0 1-7-7l3-2Z"/>',
    mail:'<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m2 5 10 8L22 5"/>',
    pin:'<path d="M19 9c0 6-7 13-7 13S5 15 5 9a7 7 0 0 1 14 0Z"/><circle cx="12" cy="9" r="2"/>'
  };
  const svg = name => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(icons[name]||icons.client)+'</svg>';
  const esc = value => String(value==null?'':value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const text = (id,value) => { const el=$(id); if(el && el.textContent!==String(value)) el.textContent=String(value); };
  function session(){ const c=window.OPTYKER_CLOUD; return !!(window.optykerAuthenticated && c && c.username && c.password && !window.OPTYKER_BILLING_ADMIN); }
  function visible(){return session() && $('mainApp').getClientRects().length>0 && $('dashboardPanel').getClientRects().length>0;}
  function clients(){const c=window.OPTYKER_CLOUD;return c&&Array.isArray(c.clients)?c.clients:[];}
  function invoke(name,...args){if(typeof window[name]==='function')return window[name](...args);}
  function cash(){const b=document.querySelector('[data-optyker-cash-managed="1"]'); if(b)b.click(); else invoke('optykerOpenCash');}
  function action(name){
    if(!session())return;
    switch(name){
      case 'new':invoke('dashboardNewClient');break;
      case 'cash':cash();break;
      case 'clients':invoke('showModule','clients');break;
      case 'analysis':invoke('dashboardOpenUnlinked','analysis');break;
      case 'glasses':invoke('openEyewearSheet','quote',window.clientCurrentId||'');break;
      case 'lens':invoke('openLacDevice');break;
      case 'lab':invoke('openLaboratory');break;
      case 'orders':invoke('openOnlineOrders');break;
      case 'agenda':invoke('optykerOpenAppointments');break;
      case 'client':if(state.selected)invoke('dashboardOpenClient',state.selected);break;
      case 'refresh':state.lastLab=0;refreshLab();break;
    }
  }
  function card(label,id,hint,icon,actionName){return '<button type="button" class="visionKpi" data-vision-action="'+actionName+'"><span class="visionKpiIcon">'+svg(icon)+'</span><span class="visionKpiBody"><span class="visionKpiLabel">'+label+'</span><strong id="'+id+'">—</strong><span class="visionKpiHint">'+hint+'</span></span><span class="visionKpiArrow">'+svg('arrow')+'</span></button>';}
  function tile(title,hint,icon,key,extra){return '<button type="button" class="visionAction '+(extra||'')+'" data-vision-action="'+key+'"><span class="visionActionIcon">'+svg(icon)+'</span><span><strong>'+title+'</strong><small>'+hint+'</small></span></button>';}
  function mount(){
    const dash=$('dashboardPanel'),nav=$('moduleNav'),top=document.querySelector('#mainApp .topbar');
    if(!dash||!nav||!top||$('optykerVisionDashboard'))return;
    const today=dash.querySelector('.dashboardTodayAppointmentsCard'),orders=dash.querySelector('.dashboardShopifyCard');
    if(!today||!orders)return; // fail back to the original dashboard if its contract changes
    const shell=document.createElement('div');shell.id='optykerVisionDashboard';
    shell.innerHTML='<div class="visionKpis">'+
      card('Clienti in archivio','visionClientsCount','Anagrafiche sincronizzate','client','clients')+
      card('Ordini online','visionOrdersCount','Da gestire · Shopify','cart','orders')+
      card('Ordini laboratorio','visionLabCount','LAC in lavorazione','lab','lab')+
      card('Appuntamenti oggi','visionTodayCount','Agenda della giornata','calendar','agenda')+
      '</div><div class="visionActions">'+tile('+ Cliente','Nuova anagrafica','plus','new','visionTeal')+tile('Cassa','Nuova vendita','cash','cash','visionBlue')+tile('Anagrafica','Archivio clienti','client','clients')+tile('Analisi Visiva','Nuova scheda','eye','analysis')+tile('Occhiali','Configura ordine','glasses','glasses')+tile('LAC','Gestione lenti','lens','lens')+
      '</div><div class="visionWorkspace"><div class="visionOperations" id="visionOperations"></div><aside class="visionClient visionPanel"><div class="visionPanelHead"><h2>Cliente in evidenza</h2><button type="button" class="visionLink" data-vision-action="clients">Vedi tutti</button></div><div id="visionClientBody"></div></aside><section class="visionBanner" aria-label="Optyker, una visione più avanti"><div><h2>Una visione<br>più avanti.</h2><p>Persone. Tecnologia. Cura.</p></div><span>OTTICA<br>VISUAL CARE<span class="visionBannerRule"></span></span></section></div>';
    const lab=document.createElement('section');lab.className='visionPanel visionLab';lab.innerHTML='<div class="visionPanelHead"><h2>'+svg('lab')+'Ordini laboratorio</h2><button type="button" class="visionLink" data-vision-action="lab">Vedi tutti</button></div><div id="visionLabList" class="visionLabList"><div class="visionEmpty">Accedi per visualizzare gli ordini.</div></div><div class="visionPanelFoot">LAC specialistiche<button type="button" class="visionLink" data-vision-action="refresh">Aggiorna</button></div>';
    const operations=shell.querySelector('#visionOperations');operations.append(today,lab,orders);
    [today,orders].forEach((el,index)=>{
      el.classList.add('visionPanel','visionExisting');
      const heading=el.querySelector('.dashboardCardTitle');if(heading){heading.textContent=index?'Ordini online':'Appuntamenti di oggi';heading.insertAdjacentHTML('afterbegin',svg(index?'cart':'calendar'));}
      const open=el.querySelector('button.dashboardTodayOpenAgenda,button.dashboardShopifyOpen');
      if(open){open.classList.add('visionPanelOpen');open.textContent='Vedi tutti';el.insertBefore(open,el.firstChild);}
    });
    const hero=dash.querySelector('.dashboardHero');if(hero)hero.classList.add('visionReplaced');
    const legacy=document.createElement('details');legacy.className='visionMore';legacy.innerHTML='<summary>Altri strumenti e schede <span>Ricerca cliente, prescrizioni, esame visivo, manutenzione LAC e udito</span></summary>';
    Array.from(dash.children).filter(x=>x!==hero).forEach(el=>legacy.appendChild(el));
    dash.append(shell,legacy);
    const brand=document.createElement('div');brand.className='visionBrand';
    const original=top.querySelector('.topbarLeft img');if(original){const logo=original.cloneNode();logo.className='visionOriginalLogo';brand.append(logo);}
    brand.insertAdjacentHTML('beforeend','<div><span>OPTYKER</span><small>OTTICA VISUAL CARE</small></div>');nav.prepend(brand);
    const right=top.querySelector('.topbarRight');if(right){const business=document.createElement('div');business.className='visionBusinessBadge';business.innerHTML=svg('pin')+'<span><strong>Ottica Visual Care</strong><small>Gestionale ottico</small></span>';right.append(business);}
    const footer=document.querySelector('#mainApp>.footer');if(footer)footer.textContent='Optyker · Ottica Visual Care';
    const toggle=document.createElement('button');toggle.type='button';toggle.className='visionMenuToggle';toggle.id='visionMenuToggle';toggle.setAttribute('aria-label','Apri menu di navigazione');toggle.setAttribute('aria-controls','moduleNav');toggle.setAttribute('aria-expanded','false');toggle.textContent='☰';top.prepend(toggle);
    toggle.onclick=()=>{const open=root.classList.toggle('visionMenuOpen');toggle.setAttribute('aria-expanded',String(open));};
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&root.classList.contains('visionMenuOpen')){root.classList.remove('visionMenuOpen');toggle.setAttribute('aria-expanded','false');toggle.focus();}});
    nav.addEventListener('click',e=>{const b=e.target.closest('button');if(b&&!b.getAttribute('aria-expanded')&&!/navSheets|navWarehouse|navDocuments|navChat/.test(b.id)){root.classList.remove('visionMenuOpen');toggle.setAttribute('aria-expanded','false');}});
    const cashNav=document.createElement('button');cashNav.type='button';cashNav.className='moduleBtn';cashNav.id='visionNavCash';cashNav.textContent='Cassa';cashNav.onclick=()=>action('cash');nav.append(cashNav);
    shell.addEventListener('click',e=>{const b=e.target.closest('[data-vision-action]');if(b)action(b.dataset.visionAction);const order=e.target.closest('[data-vision-lab]');if(order){action('lab');setTimeout(()=>{const search=$('labSearch');if(search){search.value=order.dataset.visionLab;search.dispatchEvent(new Event('input',{bubbles:true}));}},50);}});
    root.setAttribute('data-optyker-layout','vision');
    const observer=new MutationObserver(schedule);
    [$('dashboardTodayAppointments'),$('dashboardTodayCount'),$('dashboardShopifyOrders'),$('dashboardShopifyCount'),$('dashboardClientResults')].filter(Boolean).forEach(el=>observer.observe(el,{childList:true,subtree:true,characterData:true}));
    new MutationObserver(schedule).observe(dash,{attributes:true,attributeFilter:['style']});
    new MutationObserver(update).observe($('mainApp'),{attributes:true,attributeFilter:['style']});
    const old=window.cloudLoadClients;
    if(typeof old==='function'&&!old.__vision){const wrapped=function(){const user=String((window.OPTYKER_CLOUD||{}).username||'');return Promise.resolve(old.apply(this,arguments)).then(result=>{if(user===String((window.OPTYKER_CLOUD||{}).username||'')){state.clientsReady=true;schedule();}return result;});};wrapped.__vision=true;window.cloudLoadClients=wrapped;}
    window.__optykerVision={version:'20260910-vision1',refresh:()=>{state.lastLab=0;schedule();}};
    schedule();
  }
  function resetSession(){state.lab=null;state.labError=false;state.lastLab=0;state.loading=false;state.clientsReady=false;state.selected='';state.signature='';['visionClientsCount','visionOrdersCount','visionLabCount','visionTodayCount'].forEach(id=>text(id,'—'));if($('visionClientBody'))$('visionClientBody').replaceChildren();if($('visionLabList'))$('visionLabList').innerHTML='<div class="visionEmpty">Accedi per visualizzare gli ordini.</div>';}
  function schedule(){if(state.pending)return;state.pending=true;setTimeout(()=>{state.pending=false;update();},100);}
  function update(){
    if(!$('optykerVisionDashboard'))return;
    const user=session()?String(OPTYKER_CLOUD.username):'';
    if(state.user!==user){resetSession();state.user=user;}
    root.setAttribute('data-vision-dashboard',String(visible()));
    const left=document.querySelector('#mainApp .topbarTitleBlock');
    if(left){const head=left.querySelector('h1'),sub=left.querySelector('.sub');const greeting=(new Date().getHours()<13?'Buongiorno, ':'Buonasera, ')+(user.split(' ')[0]||'');const title=visible()?greeting:'Optyker';if(head&&head.textContent!==title)head.textContent=title;const caption=visible()?new Date().toLocaleDateString('it-IT',{weekday:'long',day:'numeric',month:'long',year:'numeric'}):'Ottica Visual Care · Gestionale';if(sub&&sub.textContent!==caption)sub.textContent=caption;}
    if(!visible())return;
    const n=clients().length;text('visionClientsCount',state.clientsReady||n?n.toLocaleString('it-IT'):'—');
    [['visionTodayCount','dashboardTodayCount','dashboardTodayAppointments'],['visionOrdersCount','dashboardShopifyCount','dashboardShopifyOrders']].forEach(([target,source,list])=>{const el=$(source),body=$(list);const hasResult=body&&body.querySelector('button');const empty=body&&/Nessun (appuntamento|ordine)/i.test(body.textContent);text(target,el&&(hasResult||empty)?el.textContent.trim():'—');});
    decorateAppointments();renderClient();refreshLab();
  }
  function decorateAppointments(){
    const list=$('dashboardTodayAppointments');if(!list)return;
    list.querySelectorAll('.dashboardTodayItem').forEach(item=>{if(item.querySelector('.visionAvatar'))return;const name=item.querySelector('.dashboardTodayName');if(!name)return;const avatar=document.createElement('span');avatar.className='visionAvatar';avatar.setAttribute('aria-hidden','true');avatar.textContent=initials(name.textContent);item.insertBefore(avatar,item.querySelector('.dashboardTodayInfo'));});
  }
  function initials(name){return String(name||'').trim().split(/\s+/).filter(Boolean).slice(0,2).map(x=>x.charAt(0)).join('').toUpperCase();}
  function renderClient(){
    const rows=clients(),current=rows.find(c=>String(c.id)===String(window.clientCurrentId||''));
    const c=current||rows.slice().sort((a,b)=>String(b.updatedAt||b.createdAt||'').localeCompare(String(a.updatedAt||a.createdAt||'')))[0];
    const box=$('visionClientBody');if(!box)return;
    const sig=JSON.stringify(c?[c.id,c.name,c.surname,c.phone,c.email,c.city,c.createdAt,c.photo_data,!!current]:[state.clientsReady]);if(sig===state.signature)return;state.signature=sig;
    if(!c){state.selected='';box.innerHTML='<div class="visionClientPlaceholder">'+svg('client')+'</div><h3>Il prossimo incontro<br>inizia da qui.</h3><p class="visionClientDescription">'+(state.clientsReady?'Crea una nuova anagrafica o cerca un cliente.':'Le anagrafiche saranno mostrate dopo la sincronizzazione.')+'</p><button type="button" class="visionClientOpen" data-vision-action="new">+ Nuovo cliente</button>';return;}
    state.selected=String(c.id);const name=[c.name,c.surname].filter(Boolean).join(' ');const photo=/^data:image\/(png|jpeg|webp);base64,/i.test(c.photo_data||'')?'<img src="'+esc(c.photo_data)+'" alt="">':esc(initials(name));
    const year=new Date(c.createdAt||'').getFullYear();
    const detail=(icon,value)=>value?'<div class="visionContact">'+svg(icon)+'<span>'+esc(value)+'</span></div>':'';
    box.innerHTML='<div class="visionClientPortrait">'+photo+'</div><div class="visionClientName"><h3>'+esc(name||'Cliente')+'</h3><span class="visionTag">'+(current?'Selezionato':'In archivio')+'</span></div><p class="visionClientSince">'+(Number.isFinite(year)?'Cliente dal '+year:'Anagrafica Optyker')+'</p>'+detail('phone',c.phone)+detail('mail',c.email)+detail('pin',c.city)+'<div class="visionClientNote"><strong>'+svg('client')+'Scheda cliente</strong><span>Anagrafica, dispositivi e documenti sempre a portata di mano.</span></div><button type="button" class="visionClientOpen" data-vision-action="client">Apri scheda completa '+svg('arrow')+'</button>';
  }
  function refreshLab(){
    if(!visible()||state.loading||Date.now()-state.lastLab<60000||typeof window.cloudApi!=='function')return;
    const user=state.user;state.loading=true;state.lastLab=Date.now();
    if(state.lab===null)$('visionLabList').innerHTML='<div class="visionEmpty">Caricamento laboratorio…</div>';
    // Authenticated existing API, read action only. Never use the passwordless legacy endpoint here.
    Promise.resolve().then(()=>window.cloudApi('list_work_orders',{})).then(result=>{
      if(user!==state.user||!session())return;
      if(!result||result.ok===false||!Array.isArray(result.data))throw new Error('Unavailable');
      state.lab=result.data.filter(o=>!['completato','annullato','completed','cancelled'].includes(String(o.status)));state.labError=false;renderLab();
    }).catch(()=>{if(user!==state.user||!session())return;state.labError=true;text('visionLabCount','—');$('visionLabList').innerHTML='<div class="visionEmpty">Dati non disponibili in questo momento.<br><button type="button" class="visionLink" data-vision-action="lab">Apri il laboratorio</button></div>';}).finally(()=>{if(user===state.user)state.loading=false;});
  }
  function renderLab(){
    const rows=state.lab||[];text('visionLabCount',rows.length.toLocaleString('it-IT'));
    if(!rows.length){$('visionLabList').innerHTML='<div class="visionEmpty">Nessun ordine di laboratorio in lavorazione.</div>';return;}
    const labels={da_fare:'Da fare',in_preparazione:'In preparazione',costruzione:'In costruzione',in_costruzione:'In costruzione',in_spedizione:'In spedizione'};
    $('visionLabList').innerHTML=rows.slice().sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||''))).slice(0,6).map(o=>{const p=o.payload&&o.payload.snapshot&&o.payload.snapshot.lacState||{};const product=[p.odProductName,p.osProductName].filter(Boolean).filter((v,i,a)=>a.indexOf(v)===i).join(' / ')||'LAC specialistiche';const status=String(o.status||'da_fare');return '<button type="button" class="visionLabRow" data-vision-lab="'+esc(o.reference_code||'')+'"><span class="visionLabRef">'+esc(o.reference_code||'LAC')+'</span><span class="visionLabInfo"><strong>'+esc(o.client_name||'Cliente')+'</strong><small>'+esc(product)+'</small></span><span class="visionStatus '+(status==='da_fare'?'visionAmber':status==='in_spedizione'?'visionGreen':'')+'">'+esc(labels[status]||status)+'</span></button>';}).join('');
  }
  function boot(){try{mount();}catch(error){console.warn('Optyker Vision: interfaccia originale mantenuta.',error);}}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,400),{once:true});else setTimeout(boot,400);
  // Existing app has no global session event. A lightweight timer only reads state/DOM;
  // the dashboard's additional network read is throttled to one per minute while visible.
  setInterval(()=>{if(!$('optykerVisionDashboard'))boot();else update();},5000);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')schedule();});
})();

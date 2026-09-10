/* OPTYKER_IPHONE_PREMIUM_UI_V1 */
(function(){
  const LOGO='https://cdn.shopify.com/s/files/1/0917/4289/6503/files/visual-care-logo-app-original.png?v=1787903859';
  let eyeMode='current';

  function icon(name){
    const common='viewBox="0 0 24 24" aria-hidden="true"';
    const map={
      home:`<svg ${common}><path d="M3.5 10.5 12 3l8.5 7.5v9a1.5 1.5 0 0 1-1.5 1.5H5a1.5 1.5 0 0 1-1.5-1.5z"/><path d="M9 21v-7h6v7"/></svg>`,
      user:`<svg ${common}><circle cx="12" cy="8" r="4"/><path d="M4.5 21c.7-4.1 3.2-6 7.5-6s6.8 1.9 7.5 6"/></svg>`,
      calendar:`<svg ${common}><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4M17 3v4M3 10h18"/></svg>`,
      file:`<svg ${common}><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v5h5M9 13h6M9 17h6"/></svg>`,
      glasses:`<svg ${common}><path d="M2.5 11.5h3l1.1 5a3.2 3.2 0 0 0 6.2-.3l.2-.7h-2l.2.7a3.2 3.2 0 0 0 6.2.3l1.1-5h3"/><path d="M6 11.5h5M13 11.5h5"/></svg>`,
      box:`<svg ${common}><path d="m4 7 8-4 8 4-8 4zM4 7v10l8 4 8-4V7M12 11v10"/></svg>`,
      chat:`<svg ${common}><path d="M4 4h16v12H9l-5 4z"/><path d="M8 9h.01M12 9h.01M16 9h.01"/></svg>`,
      menu:`<svg ${common}><path d="M4 7h16M4 12h16M4 17h16"/></svg>`,
      bell:`<svg ${common}><path d="M6 17h12l-1.5-2V10a4.5 4.5 0 1 0-9 0v5zM10 20h4"/></svg>`,
      lens:`<svg ${common}><path d="M12 3c4.6 4.8 6.5 8 6.5 11a6.5 6.5 0 0 1-13 0c0-3 1.9-6.2 6.5-11z"/></svg>`,
      chevron:`<svg ${common}><path d="m9 5 7 7-7 7"/></svg>`
    };
    return map[name]||map.file;
  }

  function quick(action,label,sub,ic,badge){
    return `<button class="premiumQuick ${badge?'hasBadge':''}" onclick="${action}"><span class="premiumQuickIcon">${icon(ic)}</span><span><b>${esc(label)}</b><small>${esc(sub)}</small></span>${badge?`<span class="premiumQuickBadge">${Number(badge)}</span>`:''}</button>`;
  }

  function monthShort(d){return new Intl.DateTimeFormat('it-IT',{month:'short'}).format(d).replace('.','').toUpperCase()}
  function weekdayShort(d){return new Intl.DateTimeFormat('it-IT',{weekday:'short'}).format(d).replace('.','').toUpperCase()}

  dashboardMarkup=function(){
    const c=state.home?.customer||state.me?.customer||{};
    const first=String(c.name||'').trim().split(/\s+/)[0]||'Cliente';
    const appts=futureAppointments();
    const a=appts[0]||null;
    let appt='';
    if(a){
      const d=new Date(a.starts_at);
      const meta=[fmtTime(a.starts_at)+(a.ends_at?' – '+fmtTime(a.ends_at):''),a.operator_username,a.studio_name].filter(Boolean);
      appt=`<div class="premiumAppt"><div class="premiumApptHead"><span>Prossimo appuntamento</span><button onclick="goTab('agenda')">Vedi tutti ›</button></div><div class="premiumApptBody"><div class="premiumApptDate"><span>${esc(monthShort(d))}</span><b>${d.getDate()}</b><small>${esc(weekdayShort(d))}</small></div><div class="premiumApptInfo"><strong>${esc(a.service_name||'Appuntamento')}</strong><div class="premiumApptMeta">${meta.map(x=>`<span>${esc(x)}</span>`).join('')}</div></div></div></div>`;
    }
    const eye=Array.isArray(state.eyewear)&&state.eyewear.length?quick("goTab('eyewear')",'I miei occhiali','Montature, lenti e garanzie','glasses'):'';
    const unread=Number(state.home?.unread_chat||0);
    return `<div class="dashboard premiumDashboard"><section class="premiumHomeHero"><div class="premiumBrandRow"><div class="premiumBrand"><img src="${LOGO}" alt="Ottica Visual Care"><div class="premiumBrandText"><b>OTTICA VISUAL CARE</b><small>LA TUA VISIONE. SEMPRE CON TE.</small></div></div><button class="premiumBell" onclick="goTab('chat')" aria-label="Messaggi">${icon('bell')}${unread?'<span class="premiumBellDot"></span>':''}</button></div><div class="premiumGreeting"><h1>Benvenuto,<br>${esc(first)}</h1><p>La tua visione, sempre con te.</p></div>${appt}</section><div class="premiumSectionTitle"><h2>I tuoi servizi</h2><small>Accesso rapido</small></div><div class="premiumQuickGrid">${quick("goTab('agenda')",'Prenota','Prenota un appuntamento','calendar')}${quick("goTab('rx')",'Prescrizione','La tua graduazione','file')}${eye}${quick("goTab('orders')",'Ordini','Stato, acquisti e spedizioni','box')}${quick("goTab('chat')",'Chat','Assistenza dedicata','chat',unread)}${quick("goTab('documents')",'Documenti','Scontrini, fatture e altro','file')}</div>${laboratoryDashboardMarkup()}</div>`;
  };

  function profileRow(tab,label,sub,ic,hidden=false){
    if(hidden)return '';
    return `<button class="premiumProfileRow" onclick="goTab('${tab}')"><span class="premiumProfileRowIcon">${icon(ic)}</span><span class="premiumProfileRowText"><b>${esc(label)}</b><small>${esc(sub)}</small></span><span class="premiumChevron">›</span></button>`;
  }

  customerProfileMarkup=function(){
    const c=state.home?.customer||state.me?.customer||{},full=[c.name,c.surname].filter(Boolean).join(' ').trim()||'Cliente';
    const initial=(String(c.name||'C').trim().charAt(0)||'C').toUpperCase();
    const avatar=c.photo_data?`<img src="${esc(c.photo_data)}" alt="Foto profilo">`:esc(initial);
    return `<div class="page"><div class="header"><div class="eyebrow">AREA CLIENTE</div><h1>Profilo cliente</h1><div class="sub">I tuoi dati e i servizi collegati a Optyker</div></div><div class="premiumProfileHero"><div class="premiumAvatar">${avatar}</div><div class="premiumProfileName"><h1>${esc(full)}</h1><p>${esc(c.email||state.me?.email||'')}</p><span class="premiumMember">Cliente Ottica Visual Care</span></div></div><div class="card"><div class="profileSectionTitle">Foto profilo</div><div class="chatProfile"><div class="chatProfileText">La tua foto viene mostrata anche nella chat con Ottica Visual Care.</div><button class="chatPhotoBtn" onclick="chooseChatProfilePhoto()">${c.photo_data?'Cambia foto':'Carica foto'}</button></div></div><div class="card"><div class="profileSectionTitle">Dati personali</div><div class="profileEditGrid">${profileEditField('cp_name','Nome',c.name)}${profileEditField('cp_surname','Cognome',c.surname)}${profileEditField('cp_birth','Data di nascita',c.birth,'date')}${profileEditField('cp_phone','Cellulare',c.phone,'tel')}${profileEditField('cp_home_phone','Telefono fisso',c.home_phone,'tel')}${profileEditField('cp_email','Email',c.email||state.me?.email,'email')}</div><div class="profileSyncNote">Indirizzo e dati di fatturazione restano protetti e vengono aggiornati da Ottica Visual Care.</div><button id="customerProfileSave" class="profileSaveBtn" onclick="saveCustomerProfile()">SALVA MODIFICHE</button></div><div class="card premiumProfileMenu"><div class="profileSectionTitle" style="padding:12px 3px 4px">I tuoi servizi</div>${profileRow('rx','Prescrizione','La tua graduazione visiva','file')}${profileRow('eyewear','I miei occhiali','Montature, lenti e garanzie','glasses',!state.eyewear?.length)}${profileRow('lac','LAC','Le tue lenti a contatto','lens')}${profileRow('orders','Ordini','Stato, spedizioni e storico','box')}${profileRow('documents','Documenti','Scontrini, fatture e altro','file')}${profileRow('chat','Chat','Assistenza personalizzata','chat')}</div><button class="action secondary" onclick="logout()">Esci dall’app</button></div>`;
  };

  function lensText(eye,fallback={}){return [eye?.brand||fallback.brand,eye?.name||fallback.name,eye?.type,eye?.design||fallback.design,eye?.material||fallback.material].filter(Boolean).join(' · ')}
  function spec(label,text,ic){if(!text)return '';return `<div class="premiumSpec"><span class="premiumSpecIcon">${icon(ic)}</span><span class="premiumSpecText"><b>${esc(label)}</b><span>${esc(text)}</span></span><span class="premiumSpecArrow">›</span></div>`}
  function eyewearCard(x,current){
    const f=x?.frame||{},l=x?.lenses||{},w=x?.warranty||{},t=Array.isArray(l.treatments)?l.treatments.filter(Boolean):[];
    const title=[f.brand,f.model].filter(Boolean).join(' ')||x?.reference||'Il tuo occhiale';
    const frame=[f.brand,f.model,f.type,f.color].filter(Boolean).join(' · ')||f.description||'Montatura registrata';
    const optics=[l.refractive_index?('Indice '+l.refractive_index):'',l.geometry,l.mounting].filter(Boolean).join(' · ');
    const tech=[l.color_mode,l.color,l.photochromic?'Fotocromatico':'',l.polarized?'Polarizzato':''].filter(Boolean).join(' · ');
    return `<div class="premiumGlassesCard ${current?'':'premiumPreviousItem'}">${current?`<div class="premiumEyewearTop"><span class="premiumEyeLabel">OCCHIALE ATTUALE</span><span class="premiumWarranty">Garanzia ${esc(w.name||'Base')}</span></div><div class="premiumGlassesVisual">${icon('glasses')}</div><div class="premiumFrameTitle">${esc(title)}</div><div class="premiumFrameSub">${esc(x?.reference||'')} ${x?.registered_at?'· '+esc(fmtDate(x.registered_at)):''}</div><div class="premiumSpecList">${spec('Montatura',frame,'glasses')}${spec('Lente OD',lensText(l.od,l),'file')}${spec('Lente OS',lensText(l.os,l),'file')}${spec('Caratteristiche',optics,'file')}${spec('Trattamenti',t.join(' · '),'file')}${spec('Colore / tecnologia',tech,'file')}${spec('Garanzia','Garanzia '+(w.name||'Base')+(w.eligibility?' · '+w.eligibility:''),'file')}</div>`:`<div><b>${esc(title)}</b><div class="tiny">${esc(x?.reference||'Occhiale precedente')}${x?.registered_at?' · '+esc(fmtDate(x.registered_at)):''}</div></div><span class="premiumWarranty">${esc(w.name||'Base')}</span>`}</div>`;
  }

  window.premiumEyewearMode=function(mode){eyeMode=mode;render()};
  eyewearMarkup=function(){
    const rows=Array.isArray(state.eyewear)?state.eyewear:[];
    let body='';
    if(!rows.length)body='<div class="card"><div class="empty">Non risultano ancora occhiali collegati alla tua anagrafica.</div></div>';
    else if(eyeMode==='history')body=`<div class="premiumPrevious"><h2>Storico occhiali</h2>${rows.map(x=>eyewearCard(x,false)).join('')}</div>`;
    else if(eyeMode==='favorites')body='<div class="card"><div class="empty">I preferiti compariranno qui quando saranno disponibili.</div></div>';
    else body=eyewearCard(rows[0],true)+(rows.length>1?`<div class="premiumPrevious"><h2>I tuoi occhiali precedenti</h2>${rows.slice(1,4).map(x=>eyewearCard(x,false)).join('')}</div>`:'');
    return `<div class="page"><div class="header"><div class="eyebrow">OTTICA VISUAL CARE</div><h1>I miei occhiali</h1><div class="sub">Montatura, lenti, trattamenti e garanzia collegati alla tua scheda</div></div><div class="premiumEyewearTabs"><button class="premiumEyewearTab ${eyeMode==='current'?'active':''}" onclick="premiumEyewearMode('current')">Attuali</button><button class="premiumEyewearTab ${eyeMode==='history'?'active':''}" onclick="premiumEyewearMode('history')">Storico</button><button class="premiumEyewearTab ${eyeMode==='favorites'?'active':''}" onclick="premiumEyewearMode('favorites')">Preferiti</button></div>${body}</div>`;
  };

  function premiumOrdersMarkup(){
    const rows=Array.isArray(state.home?.orders)?state.home.orders:[];
    const cards=rows.map(o=>{
      const items=Array.isArray(o?.data?.lineItems)?o.data.lineItems:[];
      const itemText=items.slice(0,3).map(x=>`${x.title||'Articolo'}${Number(x.quantity||1)>1?' ×'+Number(x.quantity||1):''}`).join(' · ');
      const total=Number(o.total||o?.data?.totalPrice||0);
      return `<div class="card"><div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start"><div><h2 style="margin-bottom:3px">${esc(o.order_name||'Ordine')}</h2><div class="tiny">${esc(o.order_date?fmtDateTime(o.order_date):'')}</div></div>${total?`<b style="color:#0b2f55">${esc(money(total,o.currency||'EUR'))}</b>`:''}</div>${itemText?`<div class="sub" style="margin-top:11px">${esc(itemText)}</div>`:''}<div style="display:flex;gap:7px;flex-wrap:wrap;margin-top:12px"><span class="premiumEyeLabel">${esc(o.financial_status||'Pagamento')}</span><span class="premiumEyeLabel">${esc(o.fulfillment_status||'Ordine ricevuto')}</span></div></div>`;
    }).join('');
    return `<div class="page"><div class="header"><div class="eyebrow">OTTICA VISUAL CARE</div><h1>Ordini</h1><div class="sub">I tuoi acquisti collegati allo stesso account Optyker</div></div>${cards||'<div class="card"><div class="empty">Non risultano ancora ordini collegati a questo account.</div></div>'}</div>`;
  }

  function premiumAgendaMarkup(){
    const n=futureAppointments().length;
    return `<div class="page"><div class="header"><div class="eyebrow">AGENDA OVC</div><h1>Prenota un appuntamento</h1><div class="sub">Scegli il servizio e trova la disponibilità migliore</div></div><div class="premiumAgendaLead"><div><b>Nuovo appuntamento</b><span>Servizio · dati · disponibilità · conferma</span></div><button onclick="openBooking()">Prenota ›</button></div><div class="card"><h2>Prossimi appuntamenti${n?' · '+n:''}</h2>${appointments()}</div></div>`;
  }

  const basePage=page;
  page=function(tab){
    if(tab==='orders')return premiumOrdersMarkup();
    if(tab==='agenda')return premiumAgendaMarkup();
    return basePage(tab);
  };

  function navBtn(tab,label,ic,extra=''){
    const active=state.tab===tab?' active':'';
    return `<button class="premiumNavBtn${active}" onclick="goTab('${tab}')">${icon(ic)}<span>${esc(label)}</span>${extra}</button>`;
  }
  function mountNav(){
    const sh=document.querySelector('.shell');
    if(!sh||state.me?.role!=='customer')return;
    let nav=document.getElementById('premiumBottomNav');
    if(!nav){nav=document.createElement('nav');nav.id='premiumBottomNav';nav.className='premiumBottomNav';sh.appendChild(nav)}
    const unread=Number(state.home?.unread_chat||0);
    nav.innerHTML=`${navBtn('home','Home','home')}${navBtn('profile','Profilo','user')}<button class="premiumNavBtn premiumNavCenter ${state.tab==='agenda'?'active':''}" onclick="goTab('agenda')" aria-label="Prenota"><span class="premiumNavOrb"></span><span>Prenota</span></button>${navBtn('chat','Chat','chat',unread?'<span class="premiumNavAlert"></span>':'')}<button class="premiumNavBtn" onclick="toggleDrawer(true)">${icon('menu')}<span>Altro</span></button>`;
    const drawer=document.querySelector('.drawerNav');
    if(drawer&&!drawer.querySelector('[data-nav="orders"]')){
      const docs=drawer.querySelector('[data-nav="documents"]');
      const b=document.createElement('button');b.className='drawerBtn';b.dataset.nav='orders';b.setAttribute('onclick',"goTab('orders')");b.textContent='Ordini';
      if(docs)drawer.insertBefore(b,docs);else drawer.appendChild(b);
    }
  }

  const baseRender=render;
  render=function(){baseRender();mountNav()};
  const baseShell=shell;
  shell=function(){baseShell();mountNav()};

  function applyAfterBoot(){
    try{if(state?.me?.role==='customer'&&document.getElementById('content'))render()}catch(e){}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(applyAfterBoot,0));else setTimeout(applyAfterBoot,0);
  setTimeout(applyAfterBoot,700);
})();

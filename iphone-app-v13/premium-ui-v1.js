/* OPTYKER_IPHONE_REFERENCE_UI_V2 */
(function(){
  const LOGO='https://cdn.shopify.com/s/files/1/0917/4289/6503/files/visual-care-logo-app-original.png?v=1787903859';
  let eyeMode='current';

  function icon(name){
    const common='viewBox="0 0 24 24" aria-hidden="true"';
    const map={
      home:`<svg ${common}><path d="M3.5 10.5 12 3l8.5 7.5v9A1.5 1.5 0 0 1 19 21H5a1.5 1.5 0 0 1-1.5-1.5z"/><path d="M9 21v-7h6v7"/></svg>`,
      user:`<svg ${common}><circle cx="12" cy="8" r="4"/><path d="M4.5 21c.7-4.1 3.2-6 7.5-6s6.8 1.9 7.5 6"/></svg>`,
      calendar:`<svg ${common}><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4M17 3v4M3 10h18"/></svg>`,
      file:`<svg ${common}><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v5h5M9 13h6M9 17h6"/></svg>`,
      glasses:`<svg ${common}><circle cx="7" cy="13" r="4"/><circle cx="17" cy="13" r="4"/><path d="M11 13h2M2 10l2 1M22 10l-2 1"/></svg>`,
      box:`<svg ${common}><path d="m4 7 8-4 8 4-8 4zM4 7v10l8 4 8-4V7M12 11v10"/></svg>`,
      chat:`<svg ${common}><path d="M4 4h16v12H9l-5 4z"/><path d="M8 9h.01M12 9h.01M16 9h.01"/></svg>`,
      menu:`<svg ${common}><path d="M4 7h16M4 12h16M4 17h16"/></svg>`,
      bell:`<svg ${common}><path d="M6 17h12l-1.5-2V10a4.5 4.5 0 1 0-9 0v5zM10 20h4"/></svg>`,
      lens:`<svg ${common}><path d="M12 3c4.6 4.8 6.5 8 6.5 11a6.5 6.5 0 0 1-13 0c0-3 1.9-6.2 6.5-11z"/></svg>`,
      chevron:`<svg ${common}><path d="m9 5 7 7-7 7"/></svg>`,
      gear:`<svg ${common}><circle cx="12" cy="12" r="3"/><path d="M19 13.5v-3l-2-.7a7 7 0 0 0-.8-1.8l.9-1.9L15 4l-1.9.9a7 7 0 0 0-1.8-.8L10.5 2h-3l-.7 2.1a7 7 0 0 0-1.8.8L3.1 4 1 6.1 1.9 8a7 7 0 0 0-.8 1.8L-1 10.5v3l2.1.7a7 7 0 0 0 .8 1.8L1 17.9 3.1 20l1.9-.9a7 7 0 0 0 1.8.8l.7 2.1h3l.7-2.1a7 7 0 0 0 1.8-.8l1.9.9 2.1-2.1-.9-1.9a7 7 0 0 0 .8-1.8z" transform="translate(2.5 0) scale(.8)"/></svg>`,
      mail:`<svg ${common}><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/></svg>`,
      phone:`<svg ${common}><path d="M7 3H4.5A1.5 1.5 0 0 0 3 4.5C3 13.6 10.4 21 19.5 21A1.5 1.5 0 0 0 21 19.5V17l-4-1.5-1.5 2.2a14 14 0 0 1-9.2-9.2L8.5 7z"/></svg>`,
      pin:`<svg ${common}><path d="M12 21s6-5.6 6-11a6 6 0 1 0-12 0c0 5.4 6 11 6 11z"/><circle cx="12" cy="10" r="2"/></svg>`,
      eye:`<svg ${common}><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z"/><circle cx="12" cy="12" r="2.5"/></svg>`,
      shield:`<svg ${common}><path d="M12 3 5 6v5c0 5 3 8 7 10 4-2 7-5 7-10V6z"/><path d="m9 12 2 2 4-4"/></svg>`,
      diamond:`<svg ${common}><path d="m3 8 4-4h10l4 4-9 12zM3 8h18M8 4l4 16 4-16"/></svg>`,
      crown:`<svg ${common}><path d="M4 18h16l1-10-5 4-4-7-4 7-5-4z"/><path d="M5 21h14"/></svg>`,
      headset:`<svg ${common}><path d="M4 13v-2a8 8 0 0 1 16 0v2M4 13v5h4v-6H5M20 13v5h-4v-6h3M16 20h-4"/></svg>`,
      plus:`<svg ${common}><path d="M12 5v14M5 12h14"/></svg>`,
      back:`<svg ${common}><path d="m15 5-7 7 7 7"/></svg>`
    };
    return map[name]||map.file;
  }

  function quick(action,label,sub,ic,badge){
    return `<button class="refQuick ${badge?'hasBadge':''}" onclick="${action}"><span class="refQuickIcon">${icon(ic)}</span><span class="refQuickCopy"><b>${esc(label)}</b><small>${esc(sub)}</small></span>${badge?`<span class="refQuickBadge">${Number(badge)}</span>`:''}</button>`;
  }
  function monthShort(d){return new Intl.DateTimeFormat('it-IT',{month:'short'}).format(d).replace('.','').toUpperCase()}
  function weekdayShort(d){return new Intl.DateTimeFormat('it-IT',{weekday:'short'}).format(d).replace('.','').toUpperCase()}
  function safeDate(v){try{return v?new Date(v):null}catch{return null}}
  function textAddress(c){return c.address||c.address1||c.street||c.shipping_address||c.billing_address||''}
  function customerSince(c){
    const d=safeDate(c.created_at||c.createdAt||c.registered_at);
    return d&&!isNaN(d)?`Cliente dal ${d.getFullYear()}`:'Cliente Ottica Visual Care';
  }

  dashboardMarkup=function(){
    const c=state.home?.customer||state.me?.customer||{};
    const first=String(c.name||'').trim().split(/\s+/)[0]||'Cliente';
    const appts=futureAppointments();
    const a=appts[0]||null;
    const unread=Number(state.home?.unread_chat||0);
    let appt='';
    if(a){
      const d=new Date(a.starts_at);
      const meta=[fmtTime(a.starts_at)+(a.ends_at?' – '+fmtTime(a.ends_at):''),a.studio_name||'Ottica Visual Care',a.operator_username].filter(Boolean);
      appt=`<section class="refAppt"><div class="refApptHead"><b>Prossimo appuntamento</b><button onclick="goTab('agenda')">Vedi tutti</button></div><div class="refApptBody"><div class="refApptDate"><span>${esc(monthShort(d))}</span><strong>${d.getDate()}</strong><small>${esc(weekdayShort(d))}</small></div><div class="refApptInfo"><b>${esc(a.service_name||'Appuntamento')}</b>${meta.map((x,i)=>`<span class="refApptMeta refApptMeta${i}">${esc(x)}</span>`).join('')}</div></div></section>`;
    }
    return `<div class="dashboard refDashboard"><section class="refHomeTop"><div class="refBrandBar"><div class="refBrand"><img src="${LOGO}" alt="Ottica Visual Care"><div><b>OTTICA<br>VISUAL CARE</b><small>PIÙ VISIONE · PIÙ VITA</small></div></div><button class="refBell" onclick="goTab('chat')" aria-label="Notifiche">${icon('bell')}${unread?'<i></i>':''}</button></div><div class="refHero"><div class="refHeroCopy"><h1>Benvenuto,<br>${esc(first)}</h1><p>La tua visione, sempre con te.</p></div><div class="refHeroScene"><span class="refWall"></span><span class="refPlant"><i></i><i></i><i></i><i></i></span><b>VEDERE<br>MEGLIO<br>VIVERE<br>PIÙ FORTE</b></div></div>${appt}</section><div class="refQuickGrid">${quick("goTab('agenda')",'Prenota','un appuntamento','calendar')}${quick("goTab('rx')",'Prescrizione','La tua graduazione','file')}${quick("goTab('eyewear')",'I miei occhiali','Storico e dettagli','glasses')}${quick("goTab('orders')",'Ordini','Stato e spedizioni','box')}${quick("goTab('chat')",'Chat','Assistenza dedicata','chat',unread)}${quick("goTab('documents')",'Documenti','Ricette, fatture, altro','file')}</div>${laboratoryDashboardMarkup()}</div>`;
  };

  window.referenceToggleProfileEdit=function(){
    const box=document.getElementById('refProfileEdit');
    if(box)box.classList.toggle('open');
  };

  function profileRow(tab,label,sub,ic,hidden=false){
    if(hidden)return '';
    return `<button class="refProfileRow" onclick="goTab('${tab}')"><span class="refProfileRowIcon">${icon(ic)}</span><span class="refProfileRowText"><b>${esc(label)}</b><small>${esc(sub)}</small></span><span class="refChevron">${icon('chevron')}</span></button>`;
  }
  function infoRow(ic,text){return text?`<div class="refInfoRow"><span>${icon(ic)}</span><b>${esc(text)}</b></div>`:''}

  customerProfileMarkup=function(){
    const c=state.home?.customer||state.me?.customer||{};
    const full=[c.name,c.surname].filter(Boolean).join(' ').trim()||'Cliente';
    const initial=(String(c.name||'C').trim().charAt(0)||'C').toUpperCase();
    const avatar=c.photo_data?`<img src="${esc(c.photo_data)}" alt="Foto profilo">`:`<span>${esc(initial)}</span>`;
    const address=textAddress(c);
    const birth=c.birth?fmtDate(c.birth):'';
    return `<div class="page refPage refProfilePage"><header class="refPageTitle"><span></span><h1>Profilo cliente</h1><button onclick="toggleDrawer(true)" aria-label="Impostazioni">${icon('gear')}</button></header><section class="refProfileHero"><div class="refAvatar">${avatar}<button onclick="chooseChatProfilePhoto()" aria-label="Cambia foto">${icon('camera')}</button></div><div class="refProfileIdentity"><h2>${esc(full)}</h2><p>${esc(customerSince(c))}</p><span class="refPremiumBadge">${icon('crown')} Cliente Premium</span></div></section><section class="refDataCard"><div class="refDataHead"><h2>Dati personali</h2><button onclick="referenceToggleProfileEdit()">Modifica</button></div>${infoRow('user',full)}${infoRow('mail',c.email||state.me?.email||'')}${infoRow('phone',c.phone||c.home_phone||'')}${infoRow('pin',address)}${infoRow('calendar',birth)}<div id="refProfileEdit" class="refProfileEdit"><div class="profileEditGrid">${profileEditField('cp_name','Nome',c.name)}${profileEditField('cp_surname','Cognome',c.surname)}${profileEditField('cp_birth','Data di nascita',c.birth,'date')}${profileEditField('cp_phone','Cellulare',c.phone,'tel')}${profileEditField('cp_home_phone','Telefono fisso',c.home_phone,'tel')}${profileEditField('cp_email','Email',c.email||state.me?.email,'email')}</div><div class="profileSyncNote">Indirizzo e dati di fatturazione restano protetti e vengono aggiornati da Ottica Visual Care.</div><button id="customerProfileSave" class="profileSaveBtn" onclick="saveCustomerProfile()">SALVA MODIFICHE</button></div></section><section class="refProfileMenu">${profileRow('rx','Prescrizione','La tua graduazione visiva','file')}${profileRow('eyewear','I miei occhiali','Modelli, lenti e dettagli','glasses')}${profileRow('lac','LAC','Le tue lenti a contatto','lens')}${profileRow('orders','Ordini','Stato, spedizioni e storico','box')}${profileRow('documents','Documenti','Ricette, fatture e altro','file')}${profileRow('chat','Chat','Assistenza personalizzata','chat')}</section><button class="refLogout" onclick="logout()">Esci dall’app</button></div>`;
  };

  function lensText(eye,fallback={}){return [eye?.brand||fallback.brand,eye?.name||fallback.name,eye?.type,eye?.design||fallback.design,eye?.material||fallback.material].filter(Boolean).join(' · ')}
  function spec(label,text,ic){if(!text)return '';return `<div class="refSpec"><span class="refSpecIcon">${icon(ic)}</span><span class="refSpecText"><b>${esc(label)}</b><small>${esc(text)}</small></span><span class="refSpecArrow">${icon('chevron')}</span></div>`}
  function frameImage(f){return f.image||f.image_url||f.photo||f.photo_url||f.product_image||f.featured_image||''}
  function eyewearCard(x,current){
    const f=x?.frame||{},l=x?.lenses||{},w=x?.warranty||{},t=Array.isArray(l.treatments)?l.treatments.filter(Boolean):[];
    const title=[f.brand,f.model].filter(Boolean).join(' ')||x?.reference||'Il tuo occhiale';
    const frame=[f.brand,f.model,f.type,f.color].filter(Boolean).join(' · ')||f.description||'Montatura registrata';
    const optics=[l.refractive_index?('Indice '+l.refractive_index):'',l.geometry,l.mounting].filter(Boolean).join(' · ');
    const tech=[l.color_mode,l.color,l.photochromic?'Fotocromatico':'',l.polarized?'Polarizzato':''].filter(Boolean).join(' · ');
    const img=frameImage(f);
    if(!current)return `<div class="refPreviousCard"><div class="refPreviousVisual">${img?`<img src="${esc(img)}" alt="${esc(title)}">`:icon('glasses')}</div><div><b>${esc(title)}</b><small>${x?.registered_at?'Acquistato il '+esc(fmtDate(x.registered_at)):esc(x?.reference||'Occhiale precedente')}</small><span>Garanzia ${esc(w.name||'Base')}</span></div><span class="refSpecArrow">${icon('chevron')}</span></div>`;
    return `<section class="refGlassesCard"><div class="refEyewearTop"><span>OCCHIALE ATTUALE</span><b class="refWarrantyGold">${icon('crown')} Garanzia ${esc(w.name||'Base')}</b></div><div class="refGlassesVisual">${img?`<img src="${esc(img)}" alt="${esc(title)}">`:`<div class="refFallbackGlasses">${icon('glasses')}</div>`}</div><h2>${esc(title)}</h2><p>${esc(x?.reference||'')}${x?.registered_at?' · '+esc(fmtDate(x.registered_at)):''}</p><div class="refSpecList">${spec('Montatura',frame,'glasses')}${spec('Lente OD',lensText(l.od,l),'eye')}${spec('Lente OS',lensText(l.os,l),'eye')}${spec('Trattamenti',t.join(' · ')||optics,'diamond')}${spec('Garanzia','Garanzia '+(w.name||'Base')+(w.eligibility?' · '+w.eligibility:''),'shield')}</div><div class="refEyewearActions"><button onclick="goTab('documents')">${icon('file')} Vedi certificato</button><button class="primary" onclick="goTab('chat')">${icon('headset')} Assistenza</button></div></section>${tech?`<div class="refTechNote">${esc(tech)}</div>`:''}`;
  }

  window.premiumEyewearMode=function(mode){eyeMode=mode;render()};
  eyewearMarkup=function(){
    const rows=Array.isArray(state.eyewear)?state.eyewear:[];
    let body='';
    if(!rows.length)body='<div class="refEmptyCard">Non risultano ancora occhiali collegati alla tua anagrafica.</div>';
    else if(eyeMode==='history')body=`<div class="refPrevious"><h2>Storico occhiali</h2>${rows.map(x=>eyewearCard(x,false)).join('')}</div>`;
    else if(eyeMode==='favorites')body='<div class="refEmptyCard">I preferiti compariranno qui quando saranno disponibili.</div>';
    else body=eyewearCard(rows[0],true)+(rows.length>1?`<div class="refPrevious"><h2>I tuoi occhiali precedenti</h2>${rows.slice(1,4).map(x=>eyewearCard(x,false)).join('')}</div>`:'');
    return `<div class="page refPage refEyewearPage"><header class="refPageTitle"><button onclick="goTab('home')" aria-label="Indietro">${icon('back')}</button><h1>I miei occhiali</h1><button onclick="goTab('chat')" aria-label="Assistenza">${icon('plus')}</button></header><div class="refTabs"><button class="${eyeMode==='current'?'active':''}" onclick="premiumEyewearMode('current')">Attuali</button><button class="${eyeMode==='history'?'active':''}" onclick="premiumEyewearMode('history')">Storico</button><button class="${eyeMode==='favorites'?'active':''}" onclick="premiumEyewearMode('favorites')">Preferiti</button></div>${body}</div>`;
  };

  function premiumOrdersMarkup(){
    const rows=Array.isArray(state.home?.orders)?state.home.orders:[];
    const cards=rows.map(o=>{
      const items=Array.isArray(o?.data?.lineItems)?o.data.lineItems:[];
      const itemText=items.slice(0,3).map(x=>`${x.title||'Articolo'}${Number(x.quantity||1)>1?' ×'+Number(x.quantity||1):''}`).join(' · ');
      const total=Number(o.total||o?.data?.totalPrice||0);
      return `<section class="refOrderCard"><div><h2>${esc(o.order_name||'Ordine')}</h2><small>${esc(o.order_date?fmtDateTime(o.order_date):'')}</small></div>${total?`<b>${esc(money(total,o.currency||'EUR'))}</b>`:''}${itemText?`<p>${esc(itemText)}</p>`:''}<div class="refOrderBadges"><span>${esc(o.financial_status||'Pagamento')}</span><span>${esc(o.fulfillment_status||'Ordine ricevuto')}</span></div></section>`;
    }).join('');
    return `<div class="page refPage"><header class="refPageTitle"><button onclick="goTab('home')">${icon('back')}</button><h1>Ordini</h1><span></span></header>${cards||'<div class="refEmptyCard">Non risultano ancora ordini collegati a questo account.</div>'}</div>`;
  }

  function premiumAgendaMarkup(){
    const n=futureAppointments().length;
    return `<div class="page refPage refAgendaPage"><header class="refPageTitle"><button onclick="goTab('home')">${icon('back')}</button><h1>Prenota un appuntamento</h1><span></span></header><div class="refStepper"><div class="active"><b>1</b><span>Servizio</span></div><div><b>2</b><span>Dati</span></div><div><b>3</b><span>Disponibilità</span></div><div><b>4</b><span>Conferma</span></div></div><section class="refAgendaIntro"><h2>1. Seleziona il servizio</h2><p>Scegli il tipo di appuntamento</p><button class="refOpenBooking" onclick="openBooking()">Scegli il servizio e continua ${icon('chevron')}</button></section><section class="refUpcoming"><h2>Prossimi appuntamenti${n?' · '+n:''}</h2>${appointments()}</section></div>`;
  }

  const basePage=page;
  page=function(tab){
    if(tab==='orders')return premiumOrdersMarkup();
    if(tab==='agenda')return premiumAgendaMarkup();
    return basePage(tab);
  };

  function navBtn(tab,label,ic,extra=''){
    const active=state.tab===tab?' active':'';
    return `<button class="refNavBtn${active}" onclick="goTab('${tab}')">${icon(ic)}<span>${esc(label)}</span>${extra}</button>`;
  }
  function mountNav(){
    const sh=document.querySelector('.shell');
    if(!sh||state.me?.role!=='customer')return;
    sh.classList.add('referenceCustomerShell');
    let nav=document.getElementById('premiumBottomNav');
    if(!nav){nav=document.createElement('nav');nav.id='premiumBottomNav';sh.appendChild(nav)}
    nav.className='refBottomNav';
    const unread=Number(state.home?.unread_chat||0);
    nav.innerHTML=`${navBtn('home','Home','home')}${navBtn('profile','Profilo','user')}<button class="refNavBtn refNavCenter ${state.tab==='agenda'?'active':''}" onclick="goTab('agenda')" aria-label="Prenota"><span class="refNavOrb"></span></button>${navBtn('chat','Notifiche','bell',unread?'<i class="refNavDot"></i>':'')}<button class="refNavBtn" onclick="toggleDrawer(true)">${icon('menu')}<span>Altro</span></button>`;
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
  setTimeout(applyAfterBoot,500);
})();

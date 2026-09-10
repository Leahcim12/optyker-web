/* OPTYKER_IPHONE_REFERENCE_INTERACTIONS_V1 */
(function(){
  const READ_KEY='optyker_news_read_v1';

  function svg(name){
    const common='viewBox="0 0 24 24" aria-hidden="true"';
    const map={
      chat:`<svg ${common}><path d="M4 4h16v12H9l-5 4z"/><path d="M8 9h.01M12 9h.01M16 9h.01"/></svg>`,
      calendar:`<svg ${common}><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4M17 3v4M3 10h18"/></svg>`,
      glasses:`<svg ${common}><circle cx="7" cy="13" r="4"/><circle cx="17" cy="13" r="4"/><path d="M11 13h2M2 10l2 1M22 10l-2 1"/></svg>`,
      box:`<svg ${common}><path d="m4 7 8-4 8 4-8 4zM4 7v10l8 4 8-4V7M12 11v10"/></svg>`,
      check:`<svg ${common}><circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16 9"/></svg>`
    };
    return map[name]||map.box;
  }

  function ts(v){
    const d=v?new Date(v):null;
    return d&&!isNaN(d)?d.getTime():0;
  }
  function when(v){
    if(!v)return '';
    try{return fmtDateTime(v)}catch{
      try{return new Intl.DateTimeFormat('it-IT',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}).format(new Date(v))}catch{return ''}
    }
  }
  function labKind(o){
    const hay=[o?.order_type,o?.document_type,o?.reference,...(Array.isArray(o?.products)?o.products:[])].filter(Boolean).join(' ').toLowerCase();
    return /occh|montatur|oftalm|eyewear/.test(hay)?'eyewear':(/lac|lenti a contatto|contatto/.test(hay)?'lac':'order');
  }
  function labNews(o){
    const st=String(o?.status||'da_fare');
    const kind=labKind(o);
    const isEye=kind==='eyewear';
    const ref=o?.reference||'Ordine laboratorio';
    const products=Array.isArray(o?.products)&&o.products.length?o.products.slice(0,2).join(' · '):ref;
    let title='Ordine aggiornato',detail=products,icon='box';
    if(isEye){
      icon='glasses';
      if(st==='completato'){title='Occhiale pronto';detail='Il tuo occhiale ha terminato la lavorazione ed è pronto.'}
      else if(st==='in_preparazione'||st==='costruzione'){title='Occhiale in lavorazione';detail=st==='costruzione'?'Il tuo occhiale è in fase di costruzione.':'Il laboratorio sta preparando il tuo occhiale.'}
      else if(st==='in_spedizione'){title='Occhiale in arrivo';detail='Il tuo occhiale è in spedizione verso Ottica Visual Care.'}
      else if(st==='da_fare'){title='Occhiale preso in carico';detail='Il laboratorio ha ricevuto il tuo ordine.'}
      else if(st==='annullato'){title='Aggiornamento occhiale';detail='La lavorazione risulta annullata.'}
    } else if(kind==='lac'){
      if(st==='completato'){title='Lenti a contatto pronte';detail='La lavorazione delle tue lenti è completata.'}
      else if(st==='in_preparazione'||st==='costruzione'){title='Lenti a contatto in lavorazione';detail='Il laboratorio sta lavorando il tuo ordine.'}
      else if(st==='in_spedizione'){title='Lenti a contatto in arrivo';detail='Il tuo ordine è in spedizione verso Ottica Visual Care.'}
      else if(st==='da_fare'){title='Ordine LAC preso in carico';detail='Il laboratorio ha ricevuto il tuo ordine.'}
    } else {
      if(st==='completato'){title='Ordine pronto';detail='La lavorazione del tuo ordine è completata.'}
      else if(st==='in_preparazione'||st==='costruzione'){title='Ordine in lavorazione';detail='Il laboratorio sta lavorando il tuo ordine.'}
      else if(st==='in_spedizione'){title='Ordine in arrivo';detail='Il tuo ordine è in spedizione verso Ottica Visual Care.'}
    }
    const date=o?.updated_at||o?.status_since||o?.created_at||'';
    return {type:icon,title,detail,date,stamp:ts(date),tab:'home'};
  }

  function collectNews(){
    const items=[];
    const unread=Number(state?.home?.unread_chat||0);
    if(unread>0){
      items.push({type:'chat',title:'Messaggio arrivato',detail:unread===1?'Hai un nuovo messaggio da Ottica Visual Care.':`Hai ${unread} nuovi messaggi da Ottica Visual Care.`,date:'',stamp:Date.now()+1000,tab:'chat',unread:true});
    }

    const labs=Array.isArray(state?.home?.laboratory_orders)?state.home.laboratory_orders:[];
    labs.map(labNews).sort((a,b)=>b.stamp-a.stamp).slice(0,5).forEach(x=>items.push(x));

    let appts=[];
    try{appts=futureAppointments()}catch{}
    const a=appts&&appts[0];
    if(a){
      const detail=[a.service_name||'Appuntamento',when(a.starts_at),a.studio_name||'Ottica Visual Care'].filter(Boolean).join(' · ');
      items.push({type:'calendar',title:'Promemoria appuntamento',detail,date:a.starts_at,stamp:ts(a.starts_at),tab:'agenda'});
    }

    return items.slice(0,8);
  }

  function itemMarkup(x){
    const meta=x.unread?'Nuovo':when(x.date);
    return `<button class="refNewsItem ${x.unread?'unread':''}" onclick="openNewsItem('${x.tab}')"><span class="refNewsIcon refNewsIcon-${x.type}">${svg(x.type)}</span><span class="refNewsCopy"><b>${esc(x.title)}</b><span>${esc(x.detail)}</span>${meta?`<small>${esc(meta)}</small>`:''}</span><span class="refNewsChevron">›</span></button>`;
  }

  function ensureDrawer(){
    if(state?.me?.role!=='customer')return null;
    let back=document.getElementById('refNewsBackdrop');
    let drawer=document.getElementById('refNewsDrawer');
    if(!back){
      back=document.createElement('div');
      back.id='refNewsBackdrop';
      back.className='refNewsBackdrop';
      back.setAttribute('onclick','toggleNewsDrawer(false)');
      document.body.appendChild(back);
    }
    if(!drawer){
      drawer=document.createElement('aside');
      drawer.id='refNewsDrawer';
      drawer.className='refNewsDrawer';
      document.body.appendChild(drawer);
    }
    const news=collectNews();
    drawer.innerHTML=`<div class="refNewsHead"><div><span>OTTICA VISUAL CARE</span><h2>Novità</h2><p>Gli ultimi aggiornamenti per te</p></div><button onclick="toggleNewsDrawer(false)" aria-label="Chiudi">×</button></div><div class="refNewsList">${news.length?news.map(itemMarkup).join(''):`<div class="refNewsEmpty"><span>${svg('check')}</span><b>Tutto aggiornato</b><p>Al momento non ci sono nuove comunicazioni.</p></div>`}</div><div class="refNewsFoot">Aggiornamenti sincronizzati con Optyker</div>`;
    return drawer;
  }

  window.toggleNewsDrawer=function(open){
    const drawer=ensureDrawer();
    const back=document.getElementById('refNewsBackdrop');
    if(!drawer||!back)return;
    const on=open!==false;
    drawer.classList.toggle('open',on);
    back.classList.toggle('open',on);
    document.body.classList.toggle('refNewsOpen',on);
    if(on){
      try{localStorage.setItem(READ_KEY,String(Date.now()))}catch{}
      const first=drawer.querySelector('.refNewsHead button');
      if(first)setTimeout(()=>first.focus({preventScroll:true}),120);
    }
  };

  window.openNewsItem=function(tab){
    toggleNewsDrawer(false);
    if(tab==='home')goTab('home');
    else if(tab)goTab(tab);
  };

  function wireBell(btn){
    if(!btn)return;
    btn.setAttribute('onclick','toggleNewsDrawer(true)');
    btn.setAttribute('aria-label','Apri novità');
  }

  function enhance(){
    if(state?.me?.role!=='customer')return;
    const center=document.querySelector('.refBottomNav .refNavCenter');
    if(center){
      center.setAttribute('onclick',"goTab('home')");
      center.setAttribute('aria-label','Dashboard');
      center.classList.toggle('active',state.tab==='home');
    }
    wireBell(document.querySelector('.refBell'));
    const navBell=Array.from(document.querySelectorAll('.refBottomNav .refNavBtn')).find(b=>/Notifiche/i.test(b.textContent||''));
    wireBell(navBell);
    ensureDrawer();
  }

  const newsBaseRender=render;
  render=function(){newsBaseRender();setTimeout(enhance,0)};
  const newsBaseShell=shell;
  shell=function(){newsBaseShell();setTimeout(enhance,0)};

  document.addEventListener('keydown',e=>{if(e.key==='Escape')toggleNewsDrawer(false)});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(enhance,0));else setTimeout(enhance,0);
  setTimeout(enhance,700);
})();

/* OVC customer dashboard. Presentation + read-only summaries; existing authenticated
   Optyker renderers continue to own orders, chat, purchases and warranties. */
(function(){
'use strict';
const VERSION='20260912-account-design1';
const PROFILE='https://shopify.com/91742896503/account/profile';
const ORDERS='https://shopify.com/91742896503/account/orders';
const LOGO='https://www.optyker.it/visualcare-logo.svg';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const titles={dashboard:['Il tuo spazio OVC','La tua visione, sempre con te.'],orders:['I tuoi ordini','Il tuo storico, tra sito e app.'],rx:['Prescrizione','La scheda visiva condivisa dal tuo centro ottico.'],eyewear:['Occhiali e garanzie','Materiali, coperture e assistenza in un unico posto.'],lac:['LAC specialistiche','Le lenti associate alla tua anagrafica.'],appointment:['Appuntamenti','Scegli il servizio e la disponibilità del centro.'],hours:['Orari del centro','Gli orari aggiornati di Ottica Visual Care.'],recent:['Acquistati di recente','Ritrova i prodotti dei tuoi ultimi acquisti.'],chat:['Chat con il centro','Un filo diretto con Ottica Visual Care.']};
const icons={orders:'<path d="M6 7h12l1 14H5L6 7Z"/><path d="M9 8V5a3 3 0 0 1 6 0v3"/>',eyewear:'<circle cx="6" cy="13" r="4"/><circle cx="18" cy="13" r="4"/><path d="M10 13h4M2 13V8M22 13V8"/>',lac:'<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',appointment:'<rect x="4" y="5" width="16" height="16" rx="3"/><path d="M8 2v6m8-6v6M4 11h16m-11 5h6"/>',rx:'<path d="M7 3h7l5 5v13H5V3h2Zm7 0v6h5M9 13h6m-6 4h6"/>',chat:'<path d="M21 11a9 9 0 0 1-9 9H4l-2 2 1-6a9 9 0 1 1 18-5Z"/><path d="M8 11h8m-8 4h5"/>',shield:'<path d="m12 2 8 4v6c0 5-8 10-8 10S4 17 4 12V6l8-4Z"/><path d="m8 12 3 3 5-6"/>'};
const icon=k=>'<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">'+(icons[k]||icons.rx)+'</svg>';
let seq=0,scope=null;
function initialView(){const v=new URLSearchParams(location.search).get('ovc_view');return Object.hasOwn(titles,v)?v:'dashboard';}
function mount(root,select){
 if(root.dataset.ovcDesign)return;root.dataset.ovcDesign=VERSION;scope=root;
 const nav=root.querySelector('.ovcANav'),panel=root.querySelector('.ovcAPanel');
 nav.setAttribute('aria-label','Navigazione area cliente');nav.id='ovcCustomerMenu';
 const dash=document.createElement('button');dash.type='button';dash.dataset.view='dashboard';dash.textContent='Dashboard';nav.prepend(dash);
 ['dashboard','orders','eyewear','rx','lac','appointment','recent','hours','chat'].forEach(v=>{const b=nav.querySelector('[data-view="'+v+'"]');if(b)nav.append(b);});
 nav.querySelector('[data-view=appointment]').textContent='Appuntamenti';
 const aside=document.createElement('aside');aside.className='ovcDSidebar';aside.innerHTML='<a class="ovcDLogo" href="/" aria-label="Ottica Visual Care, torna al negozio"><img src="'+LOGO+'" alt="Ottica Visual Care"><b>OTTICA VISUAL CARE</b><small>Il tuo centro, sempre vicino.</small></a><span class="ovcDKicker">IL TUO ACCOUNT</span>';
 aside.append(nav);aside.insertAdjacentHTML('beforeend','<div class="ovcDSideBottom"><a href="'+PROFILE+'">Profilo Shopify <span aria-hidden="true">↗</span></a><a href="/">Torna al negozio <span aria-hidden="true">↗</span></a><small>OPTYKER / VISUAL CARE</small></div>');
 const main=document.createElement('div');main.className='ovcDMain';main.innerHTML='<header class="ovcDTopbar"><button type="button" class="ovcDMenuToggle" aria-controls="ovcCustomerMenu" aria-expanded="false" aria-label="Apri menu cliente">☰ <span>Menu</span></button><div class="ovcDHeading"><span class="ovcDKicker">OTTICA VISUAL CARE</span><h1 id="ovcDViewTitle"></h1><p id="ovcDViewSubtitle"></p></div><a class="ovcDProfile" href="'+PROFILE+'" aria-label="Apri il tuo profilo Shopify"><span class="ovcDAvatar" aria-hidden="true">OVC</span><span class="ovcDProfileName">Il tuo profilo</span><span aria-hidden="true">↗</span></a></header>';
 panel.setAttribute('role','region');panel.setAttribute('aria-labelledby','ovcDViewTitle');main.append(panel);
 const foot=document.createElement('footer');foot.className='ovcDHelp';foot.innerHTML='<span class="ovcDIcon">'+icon('chat')+'</span><div><b>Hai bisogno di aiuto?</b><span>Parliamone con il tuo centro ottico.</span></div><button type="button" data-ovc-go="chat">Apri la chat <span aria-hidden="true">→</span></button>';
 main.append(foot);root.append(aside,main);
 root.addEventListener('click',e=>{const b=e.target.closest('[data-ovc-go]');if(b&&root.contains(b)&&titles[b.dataset.ovcGo])select(b.dataset.ovcGo);});
 root.querySelector('.ovcDMenuToggle').onclick=()=>{const expanded=root.classList.toggle('ovcDMenuOpen');root.querySelector('.ovcDMenuToggle').setAttribute('aria-expanded',String(expanded));};
 root.addEventListener('keydown',e=>{if(e.key==='Escape'){root.classList.remove('ovcDMenuOpen');root.querySelector('.ovcDMenuToggle').setAttribute('aria-expanded','false');}});
 // Widen only the specific OVC section. Cookie consent, store header, checkout and native accounts stay unchanged.
 const section=root.closest('.shopify-section--optyker-customer-account');
 if(section){section.classList.add('ovcDHost');const box=root.closest('.container');if(box)box.classList.add('ovcDHostContainer');
  let p=root.parentElement;while(p&&p!==section){p.classList.add('ovcDAncestor');p=p.parentElement;}}
 document.querySelector('#ovc-design-welcome')?.remove();
}
function onView(root,v){
 if(!root?.dataset.ovcDesign)return;seq++;const t=titles[v]||titles.dashboard;
 root.dataset.ovcView=v;root.classList.remove('ovcDMenuOpen');root.querySelector('.ovcDMenuToggle').setAttribute('aria-expanded','false');
 root.querySelector('#ovcDViewTitle').textContent=t[0];root.querySelector('#ovcDViewSubtitle').textContent=t[1];
 root.querySelectorAll('.ovcANav button').forEach(b=>{if(b.dataset.view===v)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});
}
function setName(x){if(!scope)return;const n=String(x?.customer_name||'').trim();scope.querySelector('.ovcDProfileName').textContent=n||'Il tuo profilo';scope.querySelector('.ovcDAvatar').textContent=n?n.split(/\s+/).slice(0,2).map(z=>z[0]).join('').toUpperCase():'OVC';}
function metric(key,title,number,note,go){return '<button type="button" class="ovcDMetric" data-ovc-go="'+go+'"><span class="ovcDIcon">'+icon(key)+'</span><span class="ovcDMetricBody"><span>'+title+'</span><strong>'+esc(number)+'</strong><small>'+esc(note)+'</small></span><span class="ovcDArrow" aria-hidden="true">↗</span></button>';}
const button=(label,to,kind='')=>'<button type="button" class="ovcDBtn '+kind+'" data-ovc-go="'+to+'">'+label+' <span aria-hidden="true">→</span></button>';
function day(v){if(!v)return '';const d=new Date(v);return isNaN(d)?'':d.toLocaleDateString('it-IT',{day:'2-digit',month:'short',year:'numeric'});}
function price(v,c){const n=Number(v);if(v==null||!Number.isFinite(n))return 'Importo non disponibile';try{return n.toLocaleString('it-IT',{style:'currency',currency:c||'EUR'});}catch{return n.toFixed(2)+' '+esc(c||'EUR');}}
function skeleton(){return '<div class="ovcDLoading" role="status">Caricamento del tuo spazio…</div><div class="ovcDMetrics" aria-hidden="true">'+Array.from({length:4},()=>'<div class="ovcDSkeleton"></div>').join('')+'</div>';}
function dashboard(panel,api){
 const ticket=seq;const valid=()=>api.valid()&&ticket===seq;panel.innerHTML=skeleton();
 Promise.allSettled([api.profile(),api.eyewear()]).then(results=>{
  if(!valid())return;
  const a=results[0],b=results[1],x=a.status==='fulfilled'?a.value:null,ew=b.status==='fulfilled'&&Array.isArray(b.value?.data)?b.value.data:null;
  const orders=x&&Array.isArray(x.orders)?x.orders:null,lenses=x&&Array.isArray(x.lenses)?x.lenses:null;setName(x);
  const name=String(x?.customer_name||'').trim().split(/\s+/)[0];
  const hero='<section class="ovcDHero"><div><span class="ovcDKicker">IL TUO CENTRO OTTICO, ONLINE</span><h2>'+esc(name?'Ciao, '+name+'.':'Benvenuto nel tuo spazio.')+'<br><span>La tua visione, al centro.</span></h2><p>Ordini, scheda visiva e assistenza.<br>Tutto ciò che ti serve, in un unico posto.</p>'+button('Prenota un appuntamento','appointment','ovcDBtnPrimary')+'</div><div class="ovcDHeroMark" aria-hidden="true">'+icon('eyewear')+'<span>VISUAL CARE</span></div></section>';
  const metrics='<div class="ovcDMetrics">'+metric('orders','Ordini registrati',orders?orders.length:'—',orders?'Nello storico condiviso':'Dati da ricaricare','orders')+metric('eyewear','I tuoi occhiali',ew?ew.length:'—',ew?'Buste collegate alla tua scheda':'Dati da ricaricare','eyewear')+metric('lac','LAC specialistiche',lenses?lenses.length:'—',lenses?'Lenti disponibili nella tua scheda':'Dati da ricaricare','lac')+metric('shield','Garanzie occhiali','Consulta','Coperture, scadenze e ricambi','eyewear')+'</div>';
  const sorted=orders?[...orders].sort((a,b)=>(Date.parse(b.order_date)||0)-(Date.parse(a.order_date)||0)):[];
  const list=orders?(sorted.length?'<div class="ovcDOrderRows">'+sorted.slice(0,4).map(o=>'<button type="button" class="ovcDOrderRow" data-ovc-go="orders"><span class="ovcDOrderIcon">'+icon('orders')+'</span><span><b>'+esc(o.order_name||'Ordine')+'</b><small>'+esc([day(o.order_date),o.channel==='app'?'App OVC':'Sito OVC'].filter(Boolean).join(' · '))+'</small></span><strong>'+price(o.total,o.currency)+'</strong><span aria-hidden="true">›</span></button>').join('')+'</div>':'<div class="ovcDEmpty">'+icon('orders')+'<h3>Qui ritrovi i tuoi acquisti</h3><p>Non risultano ordini associati alla tua scheda OVC.<br>Puoi consultare anche il tuo account Shopify.</p><a class="ovcDBtn" href="'+ORDERS+'">Ordini Shopify <span aria-hidden="true">↗</span></a></div>'):'<div class="ovcDEmpty"><h3>Lo storico non è disponibile</h3><p>Non viene mostrato un totale finché i dati non sono caricati.</p><button type="button" class="ovcDBtn" data-ovc-retry>Riprova</button></div>';
  const cards='<div class="ovcDGrid"><section class="ovcDCard"><div class="ovcDCardHead"><h2>I tuoi ultimi ordini</h2>'+button('Tutti gli ordini','orders','ovcDBtnLink')+'</div>'+list+'</section><div class="ovcDQuickCards"><section class="ovcDCard ovcDQuick ovcDSheetQuick"><span class="ovcDIcon">'+icon('rx')+'</span><div><span class="ovcDKicker">LA TUA SCHEDA OVC</span><h2>I tuoi dati visivi,<br>sempre con te.</h2><p>Consulta la prescrizione condivisa dal centro.</p>'+button('Apri prescrizione','rx','ovcDBtnLink')+'</div></section><section class="ovcDCard ovcDQuick"><span class="ovcDIcon ovcDGreen">'+icon('shield')+'</span><div><span class="ovcDKicker">OCCHIALI E GARANZIE</span><h2>Prendiamoci cura<br>dei tuoi occhiali.</h2><p>Apri le coperture, i certificati e le richieste di assistenza.</p>'+button('Gestisci i tuoi occhiali','eyewear','ovcDBtnLink')+'</div></section></div></div>';
  const service='<section class="ovcDAppointment"><span class="ovcDIcon">'+icon('appointment')+'</span><div><h2>Il prossimo passo, insieme.</h2><p>Scegli il servizio, l’operatore e l’orario disponibile.</p></div>'+button('Prenota una visita','appointment')+'</section>';
  panel.innerHTML=hero+metrics+(x&&ew?'':'<div class="ovcDNotice" role="status">Alcuni dati non sono stati caricati. <button type="button" data-ovc-retry>Riprova</button></div>')+cards+service;
  panel.querySelectorAll('[data-ovc-retry]').forEach(n=>n.onclick=api.retry);
 });
}
window.OPTYKER_ACCOUNT_DESIGN=Object.freeze({version:VERSION,mount,onView,dashboard,initialView});
})();

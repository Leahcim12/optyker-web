/* OPTYKER_IPHONE_STAFF_REFERENCE_V1
 * Presentation only: staff routes, authentication and business handlers stay intact.
 * Loaded AFTER the customer reference theme. Both roles use the same UI classes.
 */
(function () {
  'use strict';
  if (window.__optykerStaffReferenceV1) return;
  window.__optykerStaffReferenceV1 = true;
  const LOGO = 'https://cdn.shopify.com/s/files/1/0917/4289/6503/files/visual-care-logo-app-original.png?v=1787903859';
  const routes = [
    ['staff_agenda', 'Agenda negozio', 'Appuntamenti e prenotazioni', 'calendar'],
    ['staff_clients', 'Clienti', 'Anagrafiche, prescrizioni e LAC', 'users'],
    ['staff_orders', 'Ordini', 'Ordini online e app', 'box'],
    ['staff_chat', 'Chat', 'Conversazioni con i clienti', 'chat'],
    ['staff_shifts', 'Turni di lavoro', 'Orari di tutto il personale', 'clock'],
    ['staff_profile', 'Profilo', 'I tuoi dati operatore', 'user']
  ];
  let profileEditing = false, newsOpen = false, newsLoading = false, newsError = '';
  let owner = '', generation = 0, upcoming = [], upcomingLoaded = false, upcomingLoading = false;
  let newsReturnFocus = null;
  const isStaff = () => state?.me?.role === 'staff';
  const identity = () => isStaff() ? String(state.me.operator?.id || state.me.operator?.username || state.me.email || 'staff') : '';
  const number = v => Math.max(0, Number(v) || 0);
  const rows = v => Array.isArray(v) ? v : [];
  function icon(name) {
    const paths = {
      home: '<path d="m3 10 9-7 9 7v10H3zM9 20v-7h6v7"/>',
      user: '<circle cx="12" cy="8" r="4"/><path d="M5 21c0-8 14-8 14 0"/>',
      users: '<circle cx="9" cy="8" r="3.5"/><path d="M3 21c0-8 12-8 12 0M16 5a3.5 3.5 0 0 1 0 7M17 15c3 0 4 3 4 6"/>',
      calendar: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4M17 3v4M3 10h18"/>',
      clock: '<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',
      box: '<path d="m4 7 8-4 8 4-8 4zM4 7v10l8 4 8-4V7M12 11v10"/>',
      chat: '<path d="M4 4h16v12H9l-5 4z"/><path d="M8 9h.01M12 9h.01M16 9h.01"/>',
      bell: '<path d="M6 17h12l-1.5-2V10a4.5 4.5 0 1 0-9 0v5zM10 20h4"/>',
      menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
      back: '<path d="m15 5-7 7 7 7"/>',
      chevron: '<path d="m9 5 7 7-7 7"/>',
      mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/>',
      phone: '<path d="M7 3H4.5A1.5 1.5 0 0 0 3 4.5C3 13.6 10.4 21 19.5 21A1.5 1.5 0 0 0 21 19.5V17l-4-1.5-1.5 2.2a14 14 0 0 1-9.2-9.2L8.5 7z"/>',
      camera: '<path d="M3 7h4l2-3h6l2 3h4v13H3z"/><circle cx="12" cy="13" r="4"/>',
      check: '<circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16 9"/>'
    };
    return '<svg viewBox="0 0 24 24" aria-hidden="true">' + (paths[name] || paths.user) + '</svg>';
  }
  function bell() {
    const unread = number(state.staffHome?.stats?.unread_chats);
    return '<button type="button" class="refBell" data-staff-news aria-label="Apri notifiche" aria-controls="staffRefNewsDrawer" aria-expanded="' + newsOpen + '" onclick="optykerStaffNews(true)">' + icon('bell') + (unread ? '<i></i>' : '') + '</button>';
  }
  function brand() {
    return '<div class="refBrandBar"><div class="refBrand"><img src="' + LOGO + '" alt="Ottica Visual Care"><div><b>OTTICA<br>VISUAL CARE</b><small>PIÙ VISIONE · PIÙ VITA</small></div></div>' + bell() + '</div>';
  }
  function appointment() {
    return rows(upcomingLoaded ? upcoming : state.staffAgenda).filter(a => a && !['cancelled','completed','no_show','annullato'].includes(a.status) && new Date(a.starts_at).getTime() >= Date.now()).sort((a,b) => new Date(a.starts_at) - new Date(b.starts_at))[0];
  }
  function appointmentCard() {
    const a = appointment();
    if (!a) return '';
    const d = new Date(a.starts_at), short = opt => new Intl.DateTimeFormat('it-IT', opt).format(d).replace('.', '').toUpperCase();
    const client = [a.first_name, a.last_name].filter(Boolean).join(' ');
    const meta = [fmtTime(a.starts_at) + (a.ends_at ? ' – ' + fmtTime(a.ends_at) : ''), [client, a.studio_name].filter(Boolean).join(' · '), a.operator_username].filter(Boolean);
    return '<section class="refAppt"><div class="refApptHead"><b>Prossimo appuntamento</b><button onclick="optykerStaffGo(\'staff_agenda\')">Vedi tutti</button></div><div class="refApptBody"><div class="refApptDate"><span>' + esc(short({month:'short'})) + '</span><strong>' + d.getDate() + '</strong><small>' + esc(short({weekday:'short'})) + '</small></div><div class="refApptInfo"><b>' + esc(a.service_name || 'Appuntamento') + '</b>' + meta.map((x,i) => '<span class="refApptMeta refApptMeta' + i + '">' + esc(x) + '</span>').join('') + '</div></div></section>';
  }
  // Same hero and six-card grid as the customer Home; only destinations differ.
  const originalStats = staffStatsMarkup;
  staffStatsMarkup = function () {
    if (!isStaff()) return originalStats.apply(this, arguments);
    const op = state.me.operator || {}, first = String(op.display_name || op.username || 'Operatore').trim().split(/\s+/)[0];
    const stats = state.staffHome?.stats || {};
    return '<div class="dashboard refDashboard refStaffDashboard"><section class="refHomeTop">' + brand() + '<div class="refHero"><div class="refHeroCopy"><h1>Benvenuto,<br>' + esc(first) + '</h1><p>La tua visione, sempre con te.</p></div><div class="refHeroScene" aria-hidden="true"><span class="refWall"></span><span class="refPlant"><i></i><i></i><i></i><i></i></span><b>VEDERE<br>MEGLIO<br>VIVERE<br>PIÙ FORTE</b></div></div>' + appointmentCard() + '</section><div class="refQuickGrid">' + routes.map(r => '<button class="refQuick" onclick="optykerStaffGo(\'' + r[0] + '\')"><span class="refQuickIcon">' + icon(r[3]) + '</span><span class="refQuickCopy"><b>' + r[1] + '</b><small>' + r[2] + '</small></span>' + (r[0] === 'staff_chat' && number(stats.unread_chats) ? '<span class="refQuickBadge">' + number(stats.unread_chats) + '</span>' : '') + '</button>').join('') + '</div><section class="refStaffOverview"><h2>Il negozio, a colpo d’occhio</h2><div class="staffStats">' + [['clients','Clienti'],['orders','Ordini online'],['pending_reorders','Ordini app LAC'],['unread_chats','Chat non lette']].map(x => '<div class="staffStat"><b>' + number(stats[x[0]]) + '</b><span>' + x[1] + '</span></div>').join('') + '</div></section></div>';
  };
  function info(ic, value) {
    return value ? '<div class="refInfoRow"><span>' + icon(ic) + '</span><b>' + esc(value) + '</b></div>' : '';
  }
  const originalProfile = staffProfileMarkup;
  staffProfileMarkup = function () {
    if (!isStaff()) return originalProfile.apply(this, arguments);
    const o = state.me.operator || {}, full = o.display_name || o.username || 'Operatore', photo = state.staffProfileDraftPhoto || o.photo_data;
    return '<div class="page refPage refProfilePage refStaffProfile"><header class="refPageTitle"><button onclick="optykerStaffGo(\'staff_home\')" aria-label="Torna alla Home">' + icon('back') + '</button><h1>Profilo operatore</h1>' + bell() + '</header><section class="refProfileHero"><div class="refAvatar">' + (photo ? '<img src="' + esc(photo) + '" alt="Foto profilo">' : '<span>' + esc(String(full).charAt(0).toUpperCase()) + '</span>') + '<button onclick="chooseStaffProfilePhoto()" aria-label="Cambia foto">' + icon('camera') + '</button></div><div class="refProfileIdentity"><h2>' + esc(full) + '</h2><p>Ottica Visual Care</p><span class="refPremiumBadge">' + icon('user') + ' Operatore Optyker</span></div></section><input id="staffProfileFile" type="file" accept="image/*" class="hidden"><section class="refDataCard"><div class="refDataHead"><h2>Dati personali</h2><button onclick="optykerStaffEditProfile()" aria-controls="staffRefProfileEdit" aria-expanded="' + profileEditing + '">Modifica</button></div>' + info('user', full) + info('mail', o.email || state.me.email) + info('phone', o.phone) + '<div id="staffRefProfileEdit" class="refProfileEdit ' + (profileEditing ? 'open' : '') + '"><div class="staffProfileForm"><label>Nome visualizzato<input id="staffDisplayName" class="staffProfileInput" value="' + esc(o.display_name || o.username || '') + '"></label><label>Telefono<input id="staffPhone" class="staffProfileInput" type="tel" value="' + esc(o.phone || '') + '"></label><label>Email di accesso<input class="staffProfileInput staffProfileRead" value="' + esc(o.email || state.me.email || '') + '" readonly></label><label>Username Optyker<input class="staffProfileInput staffProfileRead" value="' + esc(o.username || '') + '" readonly></label><button class="staffProfileSave" onclick="saveStaffProfile()">Salva profilo</button><div class="tiny">Email e username restano fissi perché collegano login, agenda e turni.</div></div></div></section><section class="refProfileMenu">' + routes.filter(r => r[0] !== 'staff_profile').map(r => '<button class="refProfileRow" onclick="optykerStaffGo(\'' + r[0] + '\')"><span class="refProfileRowIcon">' + icon(r[3]) + '</span><span class="refProfileRowText"><b>' + r[1] + '</b><small>' + r[2] + '</small></span><span class="refChevron">' + icon('chevron') + '</span></button>').join('') + '</section><button class="refLogout" onclick="logout()">Esci dall’app</button></div>';
  };
  window.optykerStaffEditProfile = function () {
    if (!isStaff()) return;
    profileEditing = !profileEditing;
    document.getElementById('staffRefProfileEdit')?.classList.toggle('open', profileEditing);
    document.querySelector('[aria-controls="staffRefProfileEdit"]')?.setAttribute('aria-expanded', String(profileEditing));
  };
  window.optykerStaffGo = function (tab) {
    if (!isStaff() || !['staff_home', ...routes.map(r => r[0])].includes(tab)) return;
    closeNews(false);
    return staffGo(tab); // original loading, controls and privileges
  };
  function decoratePage() {
    const p = document.querySelector('#content > .page');
    if (!p) return;
    p.classList.add('refStaffPage');
    const header = p.querySelector(':scope > .header');
    if (header && !p.querySelector(':scope > .refPageTitle')) {
      const h1 = header.querySelector('h1');
      if (h1) {
        const title = document.createElement('header'); title.className = 'refPageTitle';
        let back = p.querySelector(':scope > .staffBack');
        if (back) { back.setAttribute('aria-label', back.textContent.trim()); }
        else { back = document.createElement('button'); back.setAttribute('onclick', "optykerStaffGo('staff_home')"); back.setAttribute('aria-label', 'Torna alla Home'); }
        back.innerHTML = icon('back'); back.className = 'refStaffBack';
        title.append(back, h1); title.insertAdjacentHTML('beforeend', bell());
        p.insertBefore(title, header); header.classList.add('refStaffPageIntro');
      }
    }
  }
  function mount() {
    if (!isStaff()) { reset(); return; }
    if (owner !== identity()) { reset(); owner = identity(); }
    const sh = document.querySelector('#app > .shell');
    if (!sh) return;
    sh.classList.add('referenceCustomerShell', 'referenceStaffShell');
    document.body.classList.add('referenceStaffActive');
    decoratePage();
    let nav = document.getElementById('staffReferenceBottomNav');
    if (!nav) { nav = document.createElement('nav'); nav.id = 'staffReferenceBottomNav'; sh.appendChild(nav); }
    nav.className = 'refBottomNav'; nav.setAttribute('aria-label', 'Navigazione principale operatore');
    function item(tab, label, ic) { return '<button class="refNavBtn ' + (state.tab === tab ? 'active' : '') + '" ' + (state.tab === tab ? 'aria-current="page" ' : '') + 'onclick="optykerStaffGo(\'' + tab + '\')">' + icon(ic) + '<span>' + label + '</span></button>'; }
    nav.innerHTML = item('staff_home','Home','home') + item('staff_profile','Profilo','user') + '<button class="refNavBtn refNavCenter refStaffNavCenter ' + (state.tab === 'staff_agenda' ? 'active' : '') + '" onclick="optykerStaffGo(\'staff_agenda\')" aria-label="Agenda negozio"><span class="refNavOrb">' + icon('calendar') + '</span></button><button class="refNavBtn" data-staff-news aria-controls="staffRefNewsDrawer" aria-expanded="' + newsOpen + '" onclick="optykerStaffNews(true)">' + icon('bell') + '<span>Notifiche</span>' + (number(state.staffHome?.stats?.unread_chats) ? '<i class="refNavDot"></i>' : '') + '</button><button class="refNavBtn" onclick="optykerStaffMenu()" aria-label="Apri tutti i servizi">' + icon('menu') + '<span>Altro</span></button>';
    if (state.staffError && !document.getElementById('staffRefError')) {
      const error = document.createElement('div'); error.id = 'staffRefError'; error.className = 'refStaffError'; error.setAttribute('role','status'); error.textContent = state.staffError;
      document.getElementById('content')?.prepend(error);
    }
    if (newsOpen) sh.inert = true;
    if (state.tab === 'staff_home' && !upcomingLoaded && !upcomingLoading) loadUpcoming();
  }
  window.optykerStaffMenu = function () { if (isStaff()) { closeNews(false); toggleDrawer(true); } };
  async function loadUpcoming() {
    if (!isStaff() || upcomingLoading) return;
    upcomingLoading = true;
    const ticket = generation, who = identity(), from = new Date(), to = new Date(from.getTime() + 7*86400000);
    try {
      const result = await call(API, 'staff_agenda', {from:from.toISOString(), to:to.toISOString()});
      if (ticket !== generation || who !== identity()) return;
      upcoming = rows(result.data); upcomingLoaded = true;
    } catch (_) { if (ticket === generation) upcomingLoaded = true; }
    finally { if (ticket === generation) { upcomingLoading = false; if (isStaff() && state.tab === 'staff_home') staffRender(); } }
  }
  function newsItems() {
    const items = [], stats = state.staffHome?.stats || {}, chats = rows(state.staffThreads).filter(x => number(x.unread_count));
    chats.slice(0,5).forEach(x => items.push(['chat', 'Messaggio arrivato', (x.client_name || 'Cliente') + ' · ' + number(x.unread_count) + ' non letti', 'staff_chat']));
    if (!chats.length && number(stats.unread_chats)) items.push(['chat','Nuovi messaggi',number(stats.unread_chats) + ' conversazioni non lette','staff_chat']);
    if (number(stats.pending_reorders)) items.push(['box','Ordini app da gestire',number(stats.pending_reorders) + ' richieste LAC in attesa','staff_orders']);
    const a = appointment();
    if (a) items.push(['calendar','Prossimo appuntamento',[a.service_name || 'Appuntamento',fmtDateTime(a.starts_at),a.operator_username].filter(Boolean).join(' · '),'staff_agenda']);
    return items;
  }
  function paintNews() {
    const drawer = document.getElementById('staffRefNewsDrawer'); if (!drawer) return;
    const list = drawer.querySelector('.refNewsList'), items = newsItems();
    list.innerHTML = (newsLoading ? '<p class="refStaffNewsStatus" role="status">Aggiornamento…</p>' : '') + (newsError ? '<p class="refStaffError" role="status">' + esc(newsError) + '</p>' : '') + (items.length ? items.map(x => '<button class="refNewsItem" onclick="optykerStaffGo(\'' + x[3] + '\')"><span class="refNewsIcon">' + icon(x[0]) + '</span><span class="refNewsCopy"><b>' + esc(x[1]) + '</b><span>' + esc(x[2]) + '</span></span><span class="refNewsChevron">›</span></button>').join('') : (!newsLoading && !newsError ? '<div class="refNewsEmpty"><span>' + icon('check') + '</span><b>Tutto aggiornato</b><p>Nessuna nuova comunicazione da gestire.</p></div>' : ''));
  }
  function closeNews(restore = true) {
    newsOpen = false;
    document.getElementById('staffRefNewsDrawer')?.remove(); document.getElementById('staffRefNewsBackdrop')?.remove();
    document.body.classList.remove('refNewsOpen');
    const sh = document.querySelector('.referenceStaffShell'); if (sh) sh.inert = false;
    document.querySelectorAll('[data-staff-news]').forEach(b => b.setAttribute('aria-expanded','false'));
    if (restore && newsReturnFocus?.isConnected) newsReturnFocus.focus({preventScroll:true});
  }
  window.optykerStaffNews = async function (open) {
    if (!isStaff()) return;
    if (open === false) { closeNews(); return; }
    if (newsOpen) return;
    toggleDrawer(false); newsReturnFocus = document.activeElement; newsOpen = true;
    const back = document.createElement('div'); back.id = 'staffRefNewsBackdrop'; back.className = 'refNewsBackdrop'; back.setAttribute('onclick','optykerStaffNews(false)');
    const drawer = document.createElement('aside'); drawer.id = 'staffRefNewsDrawer'; drawer.className = 'refNewsDrawer'; drawer.setAttribute('role','dialog'); drawer.setAttribute('aria-modal','true'); drawer.setAttribute('aria-labelledby','staffRefNewsTitle');
    drawer.innerHTML = '<div class="refNewsHead"><div><span>OTTICA VISUAL CARE</span><h2 id="staffRefNewsTitle">Novità</h2><p>Gli ultimi aggiornamenti per te</p></div><button onclick="optykerStaffNews(false)" aria-label="Chiudi notifiche">×</button></div><div class="refNewsList"></div><div class="refNewsFoot">Area operatore · Optyker</div>';
    document.body.append(back, drawer);
    document.body.classList.add('refNewsOpen');
    const sh = document.querySelector('.referenceStaffShell'); if (sh) sh.inert = true;
    document.querySelectorAll('[data-staff-news]').forEach(b => b.setAttribute('aria-expanded','true'));
    requestAnimationFrame(() => { back.classList.add('open'); drawer.classList.add('open'); drawer.querySelector('.refNewsHead button')?.focus({preventScroll:true}); });
    newsLoading = true; newsError = ''; paintNews();
    const ticket = generation, who = identity();
    const result = await Promise.allSettled([call(API,'staff_home'),call(API,'threads')]);
    if (ticket !== generation || who !== identity()) return;
    if (result[0].status === 'fulfilled') state.staffHome = result[0].value.data || state.staffHome;
    if (result[1].status === 'fulfilled') state.staffThreads = rows(result[1].value.data);
    newsLoading = false; newsError = result.some(x => x.status === 'rejected') ? 'Non riesco ad aggiornare tutte le novità. Chiudi e riapri per riprovare.' : '';
    if (newsOpen) paintNews();
  };
  function reset() {
    closeNews(false); document.body.classList.remove('referenceStaffActive');
    owner = ''; generation++; upcoming = []; upcomingLoaded = false; upcomingLoading = false; profileEditing = false; newsLoading = false; newsError = ''; newsReturnFocus = null;
  }
  const baseStaffRender = staffRender;
  staffRender = function () { const result = baseStaffRender.apply(this, arguments); mount(); return result; };
  const baseStaffShell = staffShell;
  staffShell = function () { const result = baseStaffShell.apply(this, arguments); mount(); return result; };
  const baseLogin = login;
  login = function () { reset(); return baseLogin.apply(this, arguments); };
  const baseCustomerShell = shell;
  shell = function () { if (!isStaff()) reset(); return baseCustomerShell.apply(this, arguments); };
  document.addEventListener('keydown', function (e) {
    if (!newsOpen) return;
    if (e.key === 'Escape') { e.preventDefault(); closeNews(); }
    if (e.key === 'Tab') {
      const targets = Array.from(document.querySelectorAll('#staffRefNewsDrawer button')), first = targets[0], last = targets[targets.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
    }
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => { if (isStaff()) staffRender(); }, {once:true});
  else if (isStaff()) staffRender();
})();

from pathlib import Path
import re

p=Path('_site/index.html')
s=p.read_text(encoding='utf-8')

# Remove obsolete duplicate header implementation.
s=re.sub(r'<style id=["\']optykerHeaderSearchFixCss["\'][^>]*>[\s\S]*?</style>','',s,count=1,flags=re.I)
s=re.sub(r'<script id=["\']optykerHeaderSearchFixJs["\'][^>]*>[\s\S]*?</script>','',s,count=1,flags=re.I)
if 'optykerGlobalSearchInput' not in s or 'optykerTopNewClientBtn' not in s:
    raise SystemExit('Topbar principale non trovata')

def add_head(block):
    global s
    h=s.find('</head>'); b=s.find('<body')
    if h<0 or (b>=0 and h>b): raise SystemExit('Chiusura head non trovata')
    s=s[:h]+block+s[h:]

def add_body_end(block):
    global s
    b=s.rfind('</body>')
    if b<0: raise SystemExit('Chiusura body non trovata')
    s=s[:b]+block+s[b:]

# Dashboard beside + Nuovo cliente.
DASH='OPTYKER_TOP_DASHBOARD_NEXT_TO_NEW_CLIENT_V3'
if DASH not in s:
    add_head('''\n<style id="optykerTopDashboardCss">/* OPTYKER_TOP_DASHBOARD_NEXT_TO_NEW_CLIENT_V3 */
#optykerTopDashboardBtn{height:42px!important;border:1px solid #cdd9e4!important;border-radius:11px!important;background:#fff!important;color:#17324a!important;padding:0 15px!important;font-size:12px!important;font-weight:800!important;white-space:nowrap!important;cursor:pointer!important}
#optykerTopDashboardBtn:hover{background:#f4f8fb!important}
#optykerCashBtn{height:42px!important;min-width:88px!important;flex:0 0 auto!important;border:1px solid #1769aa!important;border-radius:11px!important;background:#fff!important;color:#1769aa!important;padding:0 14px!important;font-size:12px!important;font-weight:900!important;white-space:nowrap!important;cursor:pointer!important}
#optykerCashBtn:hover{background:#eef7fd!important}
</style>\n''')
    add_body_end('''\n<script id="optykerTopDashboardJs">
(function(){function fix(){var r=document.querySelector('.topbarRight'),n=document.getElementById('optykerTopNewClientBtn');if(!r||!n)return;var d=document.getElementById('optykerTopDashboardBtn');if(!d){d=document.createElement('button');d.id='optykerTopDashboardBtn';d.type='button';d.textContent='Dashboard';d.onclick=function(){if(window.showDashboard)showDashboard()};}var c=document.getElementById('optykerCashBtn');if(!c){c=document.createElement('button');c.id='optykerCashBtn';c.type='button';c.innerHTML='<span aria-hidden="true">€</span> Cassa';c.title='Cassa per vendite occasionali';c.onclick=function(){if(window.openOptykerCash)window.openOptykerCash('')};}if(d.parentNode!==r)r.insertBefore(d,n);if(c.parentNode!==r||c.nextElementSibling!==n)r.insertBefore(c,n);if(d.nextElementSibling!==c)r.insertBefore(d,c)}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',fix);else fix();setInterval(fix,700)})();
</script>\n''')


TODAY='OPTYKER_DASHBOARD_TODAY_APPOINTMENTS_V1'
if TODAY not in s:
    old='''      <div class="dashboardCard dashboardCreateCard">
        <div>
          <button class="dashboardBigPlus" type="button" onclick="dashboardNewClient()" title="Crea nuovo cliente">+</button>
          <div class="dashboardCardTitle">Crea un nuovo cliente</div>
          <div class="dashboardCardText">Apri una nuova scheda anagrafica e salva il cliente nell'archivio condiviso.</div>
        </div>
        <button class="dashboardCreateButton" type="button" onclick="dashboardNewClient()">Crea cliente</button>
      </div>'''
    new='''      <div class="dashboardCard dashboardCreateCard dashboardTodayAppointmentsCard">
        <div class="dashboardTodayHead">
          <div>
            <div class="dashboardCardTitle">Appuntamenti di oggi</div>
            <div id="dashboardTodayDate" class="dashboardCardText">Caricamento giornata…</div>
          </div>
          <div id="dashboardTodayCount" class="dashboardTodayCount">—</div>
        </div>
        <div id="dashboardTodayAppointments" class="dashboardTodayAppointments">
          <div class="dashboardTodayEmpty">Caricamento appuntamenti…</div>
        </div>
        <button class="dashboardTodayOpenAgenda" type="button" onclick="optykerOpenAppointments()">Apri agenda</button>
      </div>'''
    if old not in s:
        raise SystemExit('Scheda Crea un nuovo cliente non trovata nella dashboard')
    s=s.replace(old,new,1)

    add_head('''\n<style id="optykerDashboardTodayAppointmentsCss">/* OPTYKER_DASHBOARD_TODAY_APPOINTMENTS_V1 */
.dashboardCreateCard.dashboardTodayAppointmentsCard{min-width:320px!important;display:flex!important;flex-direction:column!important;justify-content:flex-start!important;background:#f8fbff!important;border-color:#cfe0ef!important}
.dashboardTodayHead{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:12px}
.dashboardTodayCount{flex:0 0 auto;min-width:38px;height:38px;padding:0 10px;border-radius:12px;background:#e8f3ff;color:#1769aa;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:900;box-sizing:border-box}
.dashboardTodayAppointments{border:1px solid #dce5ee;border-radius:11px;background:#fff;max-height:248px;overflow:auto;min-height:124px}
.dashboardTodayEmpty{min-height:122px;padding:18px;display:flex;align-items:center;justify-content:center;text-align:center;color:#748293;font-size:12px;line-height:1.45;box-sizing:border-box}
.dashboardTodayItem{width:100%;display:grid;grid-template-columns:54px minmax(0,1fr) auto;gap:10px;align-items:center;border:0;border-bottom:1px solid #edf1f5;background:#fff;padding:11px 10px;text-align:left;color:#172b4d;cursor:pointer;font:inherit}
.dashboardTodayItem:last-child{border-bottom:0}.dashboardTodayItem:hover{background:#f3f8fd}
.dashboardTodayItem.cancelled{opacity:.58}.dashboardTodayItem.cancelled .dashboardTodayName{text-decoration:line-through}
.dashboardTodayTime{font-size:13px;font-weight:900;color:#1769aa}
.dashboardTodayInfo{min-width:0}.dashboardTodayName{display:block;font-size:12px;font-weight:900;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dashboardTodayMeta{display:block;margin-top:3px;font-size:9px;color:#6f7f8d;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dashboardTodayStatus{font-size:8px;font-weight:900;color:#5e7180;background:#eef3f7;border-radius:999px;padding:5px 7px;white-space:nowrap}.dashboardTodayItem.cancelled .dashboardTodayStatus{color:#9c4040;background:#faecec}.dashboardTodayItem.completed .dashboardTodayStatus{color:#2f6e46;background:#edf8f0}
.dashboardTodayOpenAgenda{width:100%;border:0;border-radius:9px;background:#1769aa;color:#fff;padding:12px 15px;font-weight:850;cursor:pointer;margin-top:12px}.dashboardTodayOpenAgenda:hover{background:#12598f}
@media(max-width:850px){.dashboardCreateCard.dashboardTodayAppointmentsCard{min-width:0!important}.dashboardTodayAppointments{max-height:280px}}
</style>\n''')

    add_body_end('''\n<script id="optykerDashboardTodayAppointmentsJs">
(function(){/* OPTYKER_DASHBOARD_TODAY_APPOINTMENTS_V1 */
var T={busy:false,last:0};
function E(i){return document.getElementById(i)}
function X(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function tm(v){try{return new Date(v).toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'})}catch(e){return''}}
function st(v){return v==='cancelled'?'Annullato':v==='completed'?'Completato':v==='no_show'?'Assente':'Confermato'}
function api(action,payload){
  if(!window.OPTYKER_CLOUD||!OPTYKER_CLOUD.username||!OPTYKER_CLOUD.password)return Promise.reject(Error('Sessione non autenticata'));
  return fetch(OPTYKER_CLOUD.root+'/rest/v1/rpc/optyker_appointments_api',{method:'POST',headers:{'Content-Type':'application/json','apikey':OPTYKER_CLOUD.key,'Authorization':'Bearer '+OPTYKER_CLOUD.key},body:JSON.stringify({p_username:OPTYKER_CLOUD.username,p_password:OPTYKER_CLOUD.password,p_action:action,p_payload:payload||{}})}).then(function(r){if(!r.ok)throw Error('Server '+r.status);return r.json()}).then(function(x){if(!x||x.ok===false)throw Error(x&&x.error||'Errore agenda');return x})
}
function isOpen(){var p=E('dashboardPanel');return !!(p&&getComputedStyle(p).display!=='none')}
function dateLabel(){
  var e=E('dashboardTodayDate'),d=new Date();if(e)e.textContent=d.toLocaleDateString('it-IT',{weekday:'long',day:'2-digit',month:'long'});
}
function render(items){
  items=(Array.isArray(items)?items:[]).slice().sort(function(a,b){return new Date(a.starts_at)-new Date(b.starts_at)});
  var box=E('dashboardTodayAppointments'),count=E('dashboardTodayCount');if(!box)return;
  if(count)count.textContent=String(items.length);
  if(!items.length){box.innerHTML='<div class="dashboardTodayEmpty">Nessun appuntamento previsto per oggi.</div>';return}
  box.innerHTML=items.map(function(a){
    var name=((a.last_name||'')+' '+(a.first_name||'')).trim()||'Cliente';
    var meta=[a.service_name,a.operator_username,a.studio_name].filter(Boolean).join(' · ');
    var cls=a.status==='cancelled'?' cancelled':a.status==='completed'?' completed':'';
    return '<button type="button" class="dashboardTodayItem'+cls+'" data-dashboard-appt="'+X(a.id||'')+'"><span class="dashboardTodayTime">'+X(tm(a.starts_at))+'</span><span class="dashboardTodayInfo"><span class="dashboardTodayName">'+X(name)+'</span><span class="dashboardTodayMeta">'+X(meta)+'</span></span><span class="dashboardTodayStatus">'+X(st(a.status))+'</span></button>'
  }).join('');
  box.querySelectorAll('[data-dashboard-appt]').forEach(function(b){b.onclick=function(){if(window.optykerOpenAppointments)window.optykerOpenAppointments()}})
}
function load(force){
  dateLabel();var box=E('dashboardTodayAppointments');if(!box)return Promise.resolve();
  if(T.busy)return Promise.resolve();
  if(!window.OPTYKER_CLOUD||!OPTYKER_CLOUD.username||!OPTYKER_CLOUD.password){box.innerHTML='<div class="dashboardTodayEmpty">Accedi per visualizzare gli appuntamenti della giornata.</div>';var c=E('dashboardTodayCount');if(c)c.textContent='—';return Promise.resolve()}
  if(!force&&Date.now()-T.last<30000)return Promise.resolve();
  var n=new Date(),from=new Date(n.getFullYear(),n.getMonth(),n.getDate()),to=new Date(n.getFullYear(),n.getMonth(),n.getDate()+1);
  T.busy=true;box.innerHTML='<div class="dashboardTodayEmpty">Caricamento appuntamenti…</div>';
  return api('list',{from:from.toISOString(),to:to.toISOString()}).then(function(x){T.last=Date.now();render(x.data||[])}).catch(function(e){box.innerHTML='<div class="dashboardTodayEmpty">'+X(e.message||'Impossibile caricare gli appuntamenti.')+'</div>'}).finally(function(){T.busy=false})
}
window.optykerDashboardLoadToday=function(force){return load(!!force)};
function wrapDashboard(){
  var old=window.showDashboard;if(typeof old!=='function'||old.__todayAppointments)return;
  var w=function(){var r=old.apply(this,arguments);setTimeout(function(){load(true)},20);return r};
  w.__todayAppointments=true;window.showDashboard=w
}
function boot(){dateLabel();wrapDashboard();if(isOpen())setTimeout(function(){load(true)},250)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
window.addEventListener('pageshow',function(){setTimeout(boot,100)});
document.addEventListener('click',function(ev){var b=ev.target&&ev.target.closest?ev.target.closest('#navDashboard,#optykerTopDashboardBtn'):null;if(b)setTimeout(function(){load(true)},80)},true);
document.addEventListener('visibilitychange',function(){if(document.visibilityState==='visible'&&isOpen())load(true)});
setInterval(function(){wrapDashboard();if(isOpen())load(false)},60000);
})();
</script>\n''')


SHOPDASH='OPTYKER_DASHBOARD_SHOPIFY_ORDERS_V1'
if SHOPDASH not in s:
    target='''        <button class="dashboardTodayOpenAgenda" type="button" onclick="optykerOpenAppointments()">Apri agenda</button>
      </div>
    </div>'''
    replacement='''        <button class="dashboardTodayOpenAgenda" type="button" onclick="optykerOpenAppointments()">Apri agenda</button>
      </div>

      <div class="dashboardCard dashboardShopifyCard">
        <div class="dashboardShopifyHead">
          <div>
            <div class="dashboardCardTitle">Ordini Shopify</div>
            <div class="dashboardCardText">Ordini online ancora da gestire.</div>
          </div>
          <div id="dashboardShopifyCount" class="dashboardShopifyCount">—</div>
        </div>
        <div id="dashboardShopifyOrders" class="dashboardShopifyOrders">
          <div class="dashboardShopifyEmpty">Caricamento ordini Shopify…</div>
        </div>
        <button class="dashboardShopifyOpen" type="button" onclick="openOnlineOrders()">Apri ordini</button>
      </div>
    </div>'''
    if target not in s:
        raise SystemExit('Scheda appuntamenti dashboard non trovata')
    s=s.replace(target,replacement,1)

    add_head('''\n<style id="optykerDashboardShopifyOrdersCss">/* OPTYKER_DASHBOARD_SHOPIFY_ORDERS_V1 */
.dashboardMainRow{flex-wrap:wrap!important}
.dashboardSearchCard{flex:1.45 1 430px!important}
.dashboardTodayAppointmentsCard,.dashboardShopifyCard{flex:.8 1 320px!important;min-width:320px!important}
.dashboardShopifyCard{display:flex!important;flex-direction:column!important;justify-content:flex-start!important;background:#fbfcff!important;border-color:#d9e2ec!important}
.dashboardShopifyHead{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:12px}
.dashboardShopifyCount{flex:0 0 auto;min-width:38px;height:38px;padding:0 10px;border-radius:12px;background:#eef4f8;color:#244c67;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:900;box-sizing:border-box}
.dashboardShopifyOrders{border:1px solid #dce5ee;border-radius:11px;background:#fff;max-height:248px;overflow:auto;min-height:124px}
.dashboardShopifyEmpty{min-height:122px;padding:18px;display:flex;align-items:center;justify-content:center;text-align:center;color:#748293;font-size:12px;line-height:1.45;box-sizing:border-box}
.dashboardShopifyItem{width:100%;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:center;border:0;border-bottom:1px solid #edf1f5;background:#fff;padding:11px 10px;text-align:left;color:#172b4d;cursor:pointer;font:inherit}
.dashboardShopifyItem:last-child{border-bottom:0}.dashboardShopifyItem:hover{background:#f5f9fc}
.dashboardShopifyInfo{min-width:0}.dashboardShopifyName{display:block;font-size:12px;font-weight:900;color:#17324a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dashboardShopifyMeta{display:block;margin-top:3px;font-size:9px;color:#6f7f8d;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dashboardShopifyDate{display:block;margin-top:3px;font-size:8px;color:#8a98a5}
.dashboardShopifyAmount{text-align:right;font-size:12px;font-weight:900;color:#1769aa;white-space:nowrap}.dashboardShopifyStatus{display:block;margin-top:5px;font-size:8px;font-weight:900;color:#9b6820;background:#fff6e8;border:1px solid #f0dfbd;border-radius:999px;padding:4px 6px}
.dashboardShopifyOpen{width:100%;border:0;border-radius:9px;background:#1769aa;color:#fff;padding:12px 15px;font-weight:850;cursor:pointer;margin-top:12px}.dashboardShopifyOpen:hover{background:#12598f}
@media(max-width:850px){.dashboardShopifyCard,.dashboardTodayAppointmentsCard{min-width:0!important}.dashboardShopifyOrders{max-height:280px}}
</style>\n''')

    add_body_end('''\n<script id="optykerDashboardShopifyOrdersJs">
(function(){/* OPTYKER_DASHBOARD_SHOPIFY_ORDERS_V1 */
var S={busy:false,last:0};
function E(i){return document.getElementById(i)}
function X(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function money(v,c){var n=parseFloat(v||0);if(isNaN(n))n=0;try{return new Intl.NumberFormat('it-IT',{style:'currency',currency:c||'EUR'}).format(n)}catch(e){return '€ '+n.toFixed(2).replace('.',',')}}
function dt(v){if(!v)return'';try{return new Date(v).toLocaleString('it-IT',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}catch(e){return String(v)}}
function customer(o){var d=o&&o.data||{};if(typeof d==='string'){try{d=JSON.parse(d)}catch(e){d={}}}var c=d.customer||{};return o.client_name||d.customerName||[c.firstName||c.first_name,c.lastName||c.last_name].filter(Boolean).join(' ')||d.email||'Cliente online'}
function isOpen(){var p=E('dashboardPanel');return !!(p&&getComputedStyle(p).display!=='none')}
function render(rows){
  rows=Array.isArray(rows)?rows:[];
  var pending=rows.filter(function(o){return String(o.management_status||'new')==='new'}).sort(function(a,b){return new Date(b.order_date||0)-new Date(a.order_date||0)});
  var box=E('dashboardShopifyOrders'),count=E('dashboardShopifyCount');if(!box)return;
  if(count)count.textContent=String(pending.length);
  if(!pending.length){box.innerHTML='<div class="dashboardShopifyEmpty">Nessun ordine Shopify da gestire.</div>';return}
  box.innerHTML=pending.slice(0,6).map(function(o){
    var fin=String(o.financial_status||'').toUpperCase(),ful=String(o.fulfillment_status||'').toUpperCase();
    var state=fin==='PAID'?(ful==='FULFILLED'?'Pagato · evaso':'Pagato · da evadere'):(fin||'Da verificare');
    return '<button type="button" class="dashboardShopifyItem" data-dashboard-shopify="'+X(o.order_name||o.shopify_order_id||'')+'"><span class="dashboardShopifyInfo"><span class="dashboardShopifyName">'+X(o.order_name||'Ordine Shopify')+' · '+X(customer(o))+'</span><span class="dashboardShopifyMeta">'+X(state)+'</span><span class="dashboardShopifyDate">'+X(dt(o.order_date))+'</span></span><span class="dashboardShopifyAmount">'+X(money(o.total,o.currency))+'<span class="dashboardShopifyStatus">DA FARE</span></span></button>'
  }).join('');
  box.querySelectorAll('[data-dashboard-shopify]').forEach(function(b){b.onclick=function(){openOrder(b.getAttribute('data-dashboard-shopify'))}})
}
function openOrder(key){
  try{if(window.openOnlineOrders)window.openOnlineOrders()}catch(e){}
  setTimeout(function(){
    try{
      if(window.onlineSwitchTab)window.onlineSwitchTab('new');
      var q=E('onlineSearch');if(q)q.value=key||'';
      if(window.onlineRenderCurrent)window.onlineRenderCurrent();
    }catch(e){}
  },120)
}
window.optykerDashboardOpenShopifyOrder=openOrder;
function load(force){
  var box=E('dashboardShopifyOrders');if(!box)return Promise.resolve();
  if(S.busy)return Promise.resolve();
  if(!window.OPTYKER_CLOUD||!OPTYKER_CLOUD.username||!OPTYKER_CLOUD.password){box.innerHTML='<div class="dashboardShopifyEmpty">Accedi per visualizzare gli ordini Shopify.</div>';var c=E('dashboardShopifyCount');if(c)c.textContent='—';return Promise.resolve()}
  if(typeof window.optykerShopifyApi!=='function'){box.innerHTML='<div class="dashboardShopifyEmpty">Collegamento Shopify in caricamento…</div>';return Promise.resolve()}
  if(!force&&Date.now()-S.last<30000)return Promise.resolve();
  S.busy=true;box.innerHTML='<div class="dashboardShopifyEmpty">Caricamento ordini Shopify…</div>';
  return window.optykerShopifyApi('list_orders',{}).then(function(x){S.last=Date.now();render(x&&x.data||[])}).catch(function(e){box.innerHTML='<div class="dashboardShopifyEmpty">'+X(e.message||'Impossibile caricare gli ordini Shopify.')+'</div>'}).finally(function(){S.busy=false})
}
window.optykerDashboardLoadShopify=function(force){return load(!!force)};
function wrapDashboard(){
  var old=window.showDashboard;if(typeof old!=='function'||old.__dashboardShopify)return;
  var w=function(){var r=old.apply(this,arguments);setTimeout(function(){load(true)},40);return r};
  w.__dashboardShopify=true;window.showDashboard=w
}
function wrapOrders(){
  var old=window.onlineReload;if(typeof old!=='function'||old.__dashboardShopify)return;
  var w=function(){var r=old.apply(this,arguments);setTimeout(function(){if(isOpen())load(true)},1400);return r};
  w.__dashboardShopify=true;window.onlineReload=w
}
function boot(){wrapDashboard();wrapOrders();if(isOpen()){setTimeout(function(){load(true)},350);setTimeout(function(){load(true)},2800)}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
window.addEventListener('pageshow',function(){setTimeout(boot,100)});
document.addEventListener('click',function(ev){var b=ev.target&&ev.target.closest?ev.target.closest('#navDashboard,#optykerTopDashboardBtn'):null;if(b)setTimeout(function(){load(true)},120)},true);
document.addEventListener('visibilitychange',function(){if(document.visibilityState==='visible'&&isOpen())load(true)});
setInterval(function(){wrapDashboard();wrapOrders();if(isOpen())load(false)},60000);
})();
</script>\n''')

CHAT='OPTYKER_CUSTOMER_CHAT_UI_V3'
if CHAT not in s:
    anchor='<button id="navClients" class="moduleBtn" type="button" onclick="showModule(\'clients\')">Clienti</button>'
    if anchor not in s: raise SystemExit('Pulsante Clienti non trovato')
    chat_nav='<button id="navChat" class="moduleBtn" data-short="Chat" type="button" onclick="optykerOpenChat()"><span class="winNavIcon" aria-hidden="true">✉</span><span>Chat</span><span id="optykerChatBadge" class="optykerChatBadge" style="display:none">0</span></button>'
    s=s.replace(anchor,anchor+'\n    '+chat_nav,1)

    panel='''\n  <div id="optykerChatPanel" class="panel optykerChatPanel" style="display:none">
    <div class="optykerChatHead"><div><div class="optykerChatKicker">Optyker · Clienti</div><div class="optykerChatTitle">Chat</div><div class="optykerChatSub">Il messaggio mostra automaticamente il nome dell'operatore scelto al login.</div></div><button class="secondary" type="button" onclick="showDashboard()">Dashboard</button></div>
    <div class="optykerChatStart"><select id="optykerChatClientSelect"><option value="">Avvia una chat con un cliente…</option></select><button class="secondary" type="button" onclick="optykerChatStartSelected()">Apri cliente</button></div>
    <div class="optykerChatGrid">
      <div class="optykerChatLeft"><input id="optykerChatSearch" type="search" placeholder="Cerca nelle chat…" oninput="optykerChatRenderThreads()"><div id="optykerChatThreads" class="optykerChatThreads"><div class="optykerChatEmpty">Caricamento chat…</div></div></div>
      <div class="optykerChatRight"><div id="optykerChatBlank" class="optykerChatBlank">Seleziona una conversazione.</div><div id="optykerChatConversation" style="display:none"><div class="optykerChatConvHead"><div><b id="optykerChatClientName"></b><div id="optykerChatOperator"></div></div><button class="secondary" type="button" onclick="optykerChatCopyLink()">Copia link cliente</button></div><div id="optykerChatMessages" class="optykerChatMessages"></div><div class="optykerChatComposer"><textarea id="optykerChatText" maxlength="4000" placeholder="Scrivi un messaggio…"></textarea><button id="optykerChatSend" class="primary" type="button" onclick="optykerChatSend()">Invia</button></div><div id="optykerChatStatus" class="optykerChatStatus">Aggiornamento automatico attivo.</div></div></div>
    </div>
  </div>\n'''
    orders='  <div id="onlineOrdersPanel" class="panel">'
    if orders not in s: raise SystemExit('Pannello Ordini non trovato')
    s=s.replace(orders,panel+'\n'+orders,1)

    add_head('''\n<style id="optykerChatCss">/* OPTYKER_CUSTOMER_CHAT_UI_V3 */
#optykerChatPanel{grid-column:2!important;min-width:0}.optykerChatHead{display:flex;justify-content:space-between;gap:14px;align-items:flex-start;border-bottom:1px solid rgba(0,0,0,.09);padding-bottom:13px}.optykerChatKicker{font-size:10px;font-weight:800;color:#1769aa;text-transform:uppercase;letter-spacing:.5px}.optykerChatTitle{font-size:24px;font-weight:650;margin-top:2px}.optykerChatSub{font-size:11px;color:#6d7f8f;margin-top:4px}.optykerChatStart{display:flex;gap:8px;margin:14px 0}.optykerChatStart select{flex:1}.optykerChatGrid{display:grid;grid-template-columns:320px minmax(0,1fr);min-height:590px;border:1px solid rgba(0,0,0,.11);border-radius:9px;overflow:hidden;background:#fff}.optykerChatLeft{border-right:1px solid rgba(0,0,0,.09);background:#f8fafc;padding:10px;min-width:0}.optykerChatThreads{margin-top:8px;max-height:520px;overflow:auto;border:1px solid #dfe6ec;border-radius:7px;background:#fff}.optykerChatThread{width:100%;border:0;border-bottom:1px solid #edf1f4;background:#fff;padding:10px;text-align:left;cursor:pointer}.optykerChatThread:last-child{border-bottom:0}.optykerChatThread:hover,.optykerChatThread.active{background:#eaf4fc}.optykerChatThreadTop{display:flex;justify-content:space-between;gap:8px}.optykerChatThreadName{font-size:12px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.optykerChatThreadTime{font-size:9px;color:#8493a0;white-space:nowrap}.optykerChatThreadLast{font-size:10px;color:#657788;margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.optykerChatUnread{display:inline-flex;min-width:18px;height:18px;align-items:center;justify-content:center;border-radius:999px;background:#1769aa;color:#fff;font-size:9px;font-weight:800;margin-left:5px}.optykerChatBadge{margin-left:auto;min-width:20px;height:20px;padding:0 5px;align-items:center;justify-content:center;border-radius:999px;background:#c42b1c;color:#fff;font-size:9px;font-weight:800}.optykerChatRight{min-width:0}.optykerChatBlank{min-height:590px;display:flex;align-items:center;justify-content:center;color:#798b9b;font-size:12px}.optykerChatConvHead{min-height:60px;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 13px;border-bottom:1px solid #e4e9ee;background:#fbfcfd}.optykerChatConvHead b{font-size:14px}.optykerChatConvHead #optykerChatOperator{font-size:10px;color:#718294;margin-top:2px}.optykerChatMessages{height:435px;overflow:auto;padding:14px;background:linear-gradient(#f8fafc,#f4f7fa)}.optykerChatMsg{display:flex;margin:7px 0}.optykerChatMsg.staff{justify-content:flex-end}.optykerChatBubble{max-width:78%;padding:9px 11px;border:1px solid #dce5ed;border-radius:12px;background:#fff}.optykerChatMsg.staff .optykerChatBubble{background:#1769aa;border-color:#1769aa;color:#fff}.optykerChatSender{font-size:9px;font-weight:800;color:#587187;margin-bottom:3px}.optykerChatMsg.staff .optykerChatSender{color:#d7eafb}.optykerChatText{font-size:12px;line-height:1.4;white-space:pre-wrap;word-break:break-word}.optykerChatTime{font-size:8px;color:#8b99a6;margin-top:4px}.optykerChatMsg.staff .optykerChatTime{color:#d5e6f4}.optykerChatComposer{display:flex;gap:8px;padding:10px;border-top:1px solid #e3e9ee}.optykerChatComposer textarea{flex:1;min-height:44px!important;max-height:100px!important;resize:vertical}.optykerChatComposer button{min-width:78px}.optykerChatStatus{font-size:9px;color:#718294;padding:0 11px 8px}.optykerChatStatus.bad{color:#b42323}.optykerChatEmpty{padding:22px 12px;text-align:center;color:#788a99;font-size:11px}
@media(max-width:900px){#optykerChatPanel{grid-column:1!important}.optykerChatGrid{grid-template-columns:1fr}.optykerChatLeft{border-right:0;border-bottom:1px solid #e2e8ed}.optykerChatThreads{max-height:220px}.optykerChatBlank{min-height:340px}.optykerChatMessages{height:390px}}
</style>\n''')

    add_body_end('''\n<script id="optykerChatJs">
(function(){
var S={threads:[],selected:'',messages:[],url:'',busy:false};
function E(i){return document.getElementById(i)}function X(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}function L(v){return String(v||'').toLowerCase()}function D(v){if(!v)return'';try{return new Date(v).toLocaleString('it-IT',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}catch(e){return String(v)}}
function api(a,p){if(!window.OPTYKER_CLOUD||!OPTYKER_CLOUD.username)return Promise.reject(new Error('Sessione non autenticata'));return fetch(OPTYKER_CLOUD.root+'/rest/v1/rpc/optyker_chat_api',{method:'POST',headers:{'Content-Type':'application/json','apikey':OPTYKER_CLOUD.key,'Authorization':'Bearer '+OPTYKER_CLOUD.key},body:JSON.stringify({p_username:OPTYKER_CLOUD.username,p_password:OPTYKER_CLOUD.password||'',p_action:a,p_payload:p||{}})}).then(function(r){if(!r.ok)throw new Error('Server '+r.status);return r.json()}).then(function(x){if(x&&x.ok===false)throw new Error(x.error||'Errore chat');return x})}
function status(t,b){var e=E('optykerChatStatus');if(e){e.textContent=t;e.className='optykerChatStatus'+(b?' bad':'')}}function badge(n){n=parseInt(n||0,10)||0;var b=E('optykerChatBadge');if(b){b.textContent=n>99?'99+':n;b.style.display=n?'inline-flex':'none'}}function unread(){var n=0;S.threads.forEach(function(t){n+=parseInt(t.unread_count||0,10)||0});return n}
function clients(){var sel=E('optykerChatClientSelect');if(!sel)return;var a=window.OPTYKER_CLOUD&&Array.isArray(OPTYKER_CLOUD.clients)?OPTYKER_CLOUD.clients:[];var old=sel.value;sel.innerHTML='<option value="">Avvia una chat con un cliente…</option>'+a.map(function(c){var n=((c.surname||'')+' '+(c.name||'')).trim()||'Cliente';return '<option value="'+X(c.id)+'">'+X(n)+'</option>'}).join('');sel.value=old}
function loadThreads(){if(S.busy)return Promise.resolve();S.busy=true;return api('list_threads',{}).then(function(x){S.threads=Array.isArray(x.data)?x.data:[];badge(unread());window.optykerChatRenderThreads()}).catch(function(e){var b=E('optykerChatThreads');if(b)b.innerHTML='<div class="optykerChatEmpty">'+X(e.message)+'</div>'}).finally(function(){S.busy=false})}
window.optykerChatRenderThreads=function(){var b=E('optykerChatThreads');if(!b)return;var q=L(E('optykerChatSearch')&&E('optykerChatSearch').value).trim();var a=S.threads.filter(function(t){return !q||L([t.client_name,t.email,t.phone,t.last_message].join(' ')).indexOf(q)>=0});if(!a.length){b.innerHTML='<div class="optykerChatEmpty">'+(q?'Nessun risultato.':'Nessuna conversazione.')+'</div>';return}b.innerHTML=a.map(function(t){var u=parseInt(t.unread_count||0,10)||0;return '<button class="optykerChatThread'+(String(t.client_id)===String(S.selected)?' active':'')+'" type="button" data-c="'+X(t.client_id)+'"><div class="optykerChatThreadTop"><span class="optykerChatThreadName">'+X(t.client_name||'Cliente')+(u?'<span class="optykerChatUnread">'+u+'</span>':'')+'</span><span class="optykerChatThreadTime">'+X(D(t.last_at))+'</span></div><div class="optykerChatThreadLast">'+X(t.last_message||'')+'</div></button>'}).join('');b.querySelectorAll('[data-c]').forEach(function(x){x.onclick=function(){window.optykerChatOpenThread(x.getAttribute('data-c'))}})};
function msgs(){var b=E('optykerChatMessages');if(!b)return;if(!S.messages.length){b.innerHTML='<div class="optykerChatEmpty">Nessun messaggio. Scrivi il primo messaggio.</div>';return}b.innerHTML=S.messages.map(function(m){var st=m.sender_type==='staff';return '<div class="optykerChatMsg '+(st?'staff':'customer')+'"><div class="optykerChatBubble"><div class="optykerChatSender">'+X(m.sender_name||(st?'Operatore':'Cliente'))+'</div><div class="optykerChatText">'+X(m.message||'')+'</div><div class="optykerChatTime">'+X(D(m.created_at))+'</div></div></div>'}).join('');b.scrollTop=b.scrollHeight}
window.optykerChatOpenThread=function(id){if(!id)return;S.selected=id;S.url='';window.optykerChatRenderThreads();E('optykerChatBlank').style.display='none';E('optykerChatConversation').style.display='block';E('optykerChatOperator').textContent='Operatore: '+((OPTYKER_CLOUD&&OPTYKER_CLOUD.username)||window.OPTYKER_ACTIVE_OPERATOR||'');status('Caricamento…');return api('get_thread',{client_id:id}).then(function(x){S.messages=Array.isArray(x.data)?x.data:[];S.url=x.chat_url||'';E('optykerChatClientName').textContent=x.client_name||'Cliente';msgs();status('Chat aggiornata automaticamente.');return loadThreads()}).catch(function(e){status(e.message,true)})};
window.optykerChatSend=function(){var t=E('optykerChatText'),m=String(t&&t.value||'').trim(),b=E('optykerChatSend');if(!S.selected){alert('Seleziona un cliente.');return}if(!m)return;b.disabled=true;api('send',{client_id:S.selected,message:m}).then(function(){t.value='';return window.optykerChatOpenThread(S.selected)}).catch(function(e){status(e.message,true)}).finally(function(){b.disabled=false;t.focus()})};
window.optykerChatCopyLink=function(){if(!S.selected)return;function cp(u){if(!u)return;if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(u).then(function(){status('Link cliente copiato.')}).catch(function(){prompt('Copia il link:',u)});else prompt('Copia il link:',u)}if(S.url){cp(S.url);return}api('get_link',{client_id:S.selected}).then(function(x){S.url=x.chat_url||'';cp(S.url)}).catch(function(e){alert(e.message)})};
window.optykerChatStartSelected=function(){var id=E('optykerChatClientSelect').value;if(id)window.optykerChatOpenThread(id)};
function hide(){['dashboardPanel','analysisPanel','prescriptionPanel','visualExamPanel','indicationsPanel','hearingPanel','clientsPanel','onlineOrdersPanel'].forEach(function(i){var e=E(i);if(e)e.style.display='none'});var r=E('reportSectionTop');if(r)r.style.display='none';var c=E('currentClientBanner');if(c)c.style.display='none';try{if(window.hideLac)hideLac()}catch(e){}}
window.optykerOpenChat=function(){hide();var p=E('optykerChatPanel');if(p)p.style.display='block';document.querySelectorAll('#moduleNav .moduleBtn').forEach(function(b){b.classList.remove('active')});if(E('navChat'))E('navChat').classList.add('active');clients();if((!OPTYKER_CLOUD.clients||!OPTYKER_CLOUD.clients.length)&&window.cloudLoadClients)cloudLoadClients().then(clients).catch(function(){});loadThreads()};
function poll(){if(!window.OPTYKER_CLOUD||!OPTYKER_CLOUD.username)return;api('unread_count',{}).then(function(x){badge(x&&x.data&&x.data.count||0)}).catch(function(){});var p=E('optykerChatPanel');if(p&&p.style.display!=='none'){loadThreads();if(S.selected)api('get_thread',{client_id:S.selected}).then(function(x){var a=Array.isArray(x.data)?x.data:[],n=a.map(function(m){return m.id}).join('|'),o=S.messages.map(function(m){return m.id}).join('|');if(n!==o){S.messages=a;S.url=x.chat_url||S.url;msgs()}}).catch(function(){})}}
function boot(){var t=E('optykerChatText');if(t)t.addEventListener('keydown',function(e){if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();window.optykerChatSend()}});setTimeout(poll,800);setInterval(poll,5000)}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot()
})();
</script>\n''')

for m in [DASH,TODAY,SHOPDASH,CHAT,'id="navChat"','id="optykerChatPanel"','optyker_chat_api','id="dashboardTodayAppointments"','id="dashboardShopifyOrders"']:
    if m not in s: raise SystemExit('Patch incompleta: '+m)
p.write_text(s,encoding='utf-8')
print('Patch Optyker applicata:',len(s),'bytes')

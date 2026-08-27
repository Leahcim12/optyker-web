from pathlib import Path

p=Path('_site/index.html')
s=p.read_text(encoding='utf-8')
MARK='OPTYKER_SIDEBAR_POINTER_NAV_V1'
if MARK in s:
    raise SystemExit(0)
if 'id="moduleNav"' not in s or 'id="navAppointments"' not in s or 'id="navClients"' not in s:
    raise SystemExit('Sidebar non disponibile')

style=r'''<style id="optykerSidebarPointerNavCss">/* OPTYKER_SIDEBAR_POINTER_NAV_V1 */
#moduleNav,#moduleNav *{pointer-events:auto!important}
#moduleNav button{cursor:pointer!important;touch-action:manipulation!important;user-select:none!important;-webkit-user-select:none!important}
#moduleNav button:active{transform:translateY(1px)!important}
</style>'''

script=r'''<script id="optykerSidebarPointerNavJs">(function(){/* OPTYKER_SIDEBAR_POINTER_NAV_V1 */
var ROOTS=['dashboardPanel','analysisPanel','prescriptionPanel','visualExamPanel','indicationsPanel','hearingPanel','clientsPanel','onlineOrdersPanel','lacPanel','optykerChatPanel','optykerSettingsPanel','optykerAppointmentsPanel'];
var IDS=['navDashboard','navAppointments','navClients','navChat','navSheets','navAnalysis','navPrescription','navVisualExam','navIndications','navHearing','navOrders','navSettings'];
var lastId='',lastAt=0;
function E(i){return document.getElementById(i)}
function active(id){IDS.forEach(function(x){var b=E(x);if(b&&x!=='navSheets')b.classList.toggle('active',x===id)})}
function show(target,nav,work){
  ROOTS.forEach(function(id){var x=E(id);if(x)x.style.setProperty('display',id===target?'block':'none','important')});
  var tabs=E('analysisTabs');if(tabs)tabs.style.setProperty('display',target==='analysisPanel'?'flex':'none','important');
  var report=E('reportSectionTop');if(report)report.style.setProperty('display',work?'block':'none','important');
  var banner=E('currentClientBanner');if(banner&&['clientsPanel','analysisPanel','prescriptionPanel','visualExamPanel','indicationsPanel','hearingPanel'].indexOf(target)<0)banner.style.setProperty('display','none','important');
  active(nav);try{window.scrollTo(0,0)}catch(e){}
}
function sheets(on){var n=E('moduleNav'),a=E('sheetsSubmenu'),b=E('navSheets');if(!n||!a)return;n.classList.toggle('sheetsOpen',!!on);a.setAttribute('aria-hidden',on?'false':'true');if(b)b.classList.toggle('active',!!on)}
function after(fn){try{if(typeof fn==='function')setTimeout(fn,0)}catch(e){console.error(e)}}
function route(id){
  if(id==='navSheets'){var n=E('moduleNav');sheets(!(n&&n.classList.contains('sheetsOpen')));return false}
  if(id==='navDashboard'){sheets(false);show('dashboardPanel','navDashboard',false);after(function(){if(window.dashboardRenderClients)window.dashboardRenderClients()});return false}
  if(id==='navAppointments'){sheets(false);show('optykerAppointmentsPanel','navAppointments',false);after(function(){if(window.optykerAgendaBoot)Promise.resolve(window.optykerAgendaBoot(false)).catch(console.error)});return false}
  if(id==='navClients'){sheets(false);show('clientsPanel','navClients',true);after(function(){try{if(window.clientShowView)window.clientShowView('archive');if(window.clientRefreshList)window.clientRefreshList();if(window.clientRenderVisits)window.clientRenderVisits()}catch(e){console.error(e)}});return false}
  if(id==='navChat'){sheets(false);show('optykerChatPanel','navChat',false);after(function(){try{if(window.optykerOpenChat)window.optykerOpenChat()}catch(e){console.error(e)}finally{show('optykerChatPanel','navChat',false)}});return false}
  if(id==='navSettings'){sheets(false);show('optykerSettingsPanel','navSettings',false);after(function(){try{if(window.optykerOpenSettings)window.optykerOpenSettings()}catch(e){console.error(e)}finally{show('optykerSettingsPanel','navSettings',false)}});return false}
  if(id==='navOrders'){sheets(false);show('onlineOrdersPanel','navOrders',false);after(function(){try{if(window.onlineReload)window.onlineReload()}catch(e){console.error(e)}});return false}
  var map={navAnalysis:['analysisPanel','analysis'],navPrescription:['prescriptionPanel','prescription'],navVisualExam:['visualExamPanel','visualexam'],navIndications:['indicationsPanel','indications'],navHearing:['hearingPanel','hearing']};
  if(map[id]){var m=map[id];sheets(true);show(m[0],id,true);after(function(){try{if(window.showModule)window.showModule(m[1])}catch(e){console.error(e)}finally{show(m[0],id,true);sheets(true)}});return false}
  return false
}
function fire(ev,b){
  if(!b||IDS.indexOf(b.id)<0)return;
  var now=Date.now();if(ev.type==='click'&&lastId===b.id&&now-lastAt<700){ev.preventDefault();ev.stopPropagation();return}
  if(ev.type==='pointerdown'){lastId=b.id;lastAt=now}
  ev.preventDefault();ev.stopPropagation();if(ev.stopImmediatePropagation)ev.stopImmediatePropagation();route(b.id)
}
function bind(){
  IDS.forEach(function(id){var b=E(id);if(!b)return;b.removeAttribute('disabled');b.style.setProperty('pointer-events','auto','important');b.onpointerdown=null;b.onclick=null;});
  var n=E('moduleNav');if(n){n.style.setProperty('pointer-events','auto','important');n.style.setProperty('z-index','2147483000','important')}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind);else bind();
window.addEventListener('pageshow',bind);setTimeout(bind,100);setTimeout(bind,700);
})();</script>'''

h=s.find('</head>')
if h<0: raise SystemExit('head non trovato')
s=s[:h]+style+s[h:]
b=s.rfind('</body>')
if b<0: raise SystemExit('body non trovato')
s=s[:b]+script+s[b:]
p.write_text(s,encoding='utf-8')
if MARK not in s or 'optykerSidebarPointerNavJs' not in s:
    raise SystemExit('Pointer navigation non inserita')
print('Sidebar pointer navigation V1 OK')

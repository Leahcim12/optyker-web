from pathlib import Path

p=Path('_site/index.html')
s=p.read_text(encoding='utf-8')
MARK='OPTYKER_EXCLUSIVE_NAV_V1'
if MARK in s:
    raise SystemExit(0)
if 'id="navAppointments"' not in s or 'id="optykerAppointmentsPanel"' not in s:
    raise SystemExit('Agenda non disponibile')
if 'id="navClients"' not in s or 'id="clientsPanel"' not in s:
    raise SystemExit('Navigazione clienti non disponibile')

style=r'''<style id="optykerExclusiveNavStyle">/* OPTYKER_EXCLUSIVE_NAV_V1 */
#optykerAppointmentsPanel,#optykerChatPanel,#optykerSettingsPanel,#dashboardPanel,#onlineOrdersPanel,#lacPanel,#analysisPanel,#prescriptionPanel,#visualExamPanel,#indicationsPanel,#hearingPanel,#clientsPanel{min-width:0}
</style>'''

script=r'''<script id="optykerExclusiveNavJs">(function(){/* OPTYKER_EXCLUSIVE_NAV_V1 */
var ROOTS=['dashboardPanel','analysisPanel','prescriptionPanel','visualExamPanel','indicationsPanel','hearingPanel','clientsPanel','onlineOrdersPanel','lacPanel','optykerChatPanel','optykerSettingsPanel','optykerAppointmentsPanel'];
var NAVS=['navDashboard','navAnalysis','navPrescription','navVisualExam','navIndications','navHearing','navClients','navChat','navAppointments','navOrders','navWhatsAppConnect','navSettings'];
function E(id){return document.getElementById(id)}
function only(target,nav){
  ROOTS.forEach(function(id){var x=E(id);if(x)x.style.setProperty('display',id===target?'block':'none','important')});
  NAVS.forEach(function(id){var b=E(id);if(b)b.classList.toggle('active',id===nav)});
  var tabs=E('analysisTabs');if(tabs&&target!=='analysisPanel')tabs.style.setProperty('display','none','important');
  if(target==='analysisPanel'&&tabs)tabs.style.setProperty('display','flex','important');
  if(['dashboardPanel','onlineOrdersPanel','lacPanel','optykerChatPanel','optykerSettingsPanel','optykerAppointmentsPanel'].indexOf(target)>=0){
    var r=E('reportSectionTop');if(r)r.style.setProperty('display','none','important');
    var c=E('currentClientBanner');if(c)c.style.setProperty('display','none','important');
  }
  try{window.scrollTo(0,0)}catch(e){}
}
function safeCall(fn,ctx,args){try{return fn&&fn.apply(ctx,args||[])}catch(e){console.error(e);return false}}
function wrap(name,targetFor,navFor){
  var old=window[name];if(typeof old!=='function'||old.__exclusiveNav)return;
  var w=function(){
    var target=typeof targetFor==='function'?targetFor.apply(this,arguments):targetFor;
    var nav=typeof navFor==='function'?navFor.apply(this,arguments):navFor;
    var r=safeCall(old,this,arguments);
    if(target)only(target,nav);
    return r;
  };
  w.__exclusiveNav=true;w.__exclusiveOriginal=old;window[name]=w;
}
function mapModule(which){
  if(which==='prescription')return['prescriptionPanel','navPrescription'];
  if(which==='visualexam')return['visualExamPanel','navVisualExam'];
  if(which==='indications')return['indicationsPanel','navIndications'];
  if(which==='hearing')return['hearingPanel','navHearing'];
  if(which==='clients')return['clientsPanel','navClients'];
  return['analysisPanel','navAnalysis'];
}
function installWrappers(){
  wrap('showDashboard','dashboardPanel','navDashboard');
  wrap('showModule',function(which){return mapModule(which)[0]},function(which){return mapModule(which)[1]});
  wrap('openOnlineOrders','onlineOrdersPanel','navOrders');
  wrap('openLacDevice','lacPanel','');
  wrap('optykerOpenChat','optykerChatPanel','navChat');
  wrap('optykerOpenSettings','optykerSettingsPanel','navSettings');
  wrap('optykerOpenAppointments','optykerAppointmentsPanel','navAppointments');
}
function directAgenda(){
  installWrappers();
  if(typeof window.optykerOpenAppointments==='function')return window.optykerOpenAppointments();
  only('optykerAppointmentsPanel','navAppointments');
  try{if(window.optykerAgendaBoot)Promise.resolve(window.optykerAgendaBoot(false)).then(function(){var b=E('oaReload');if(b)b.click()})}catch(e){console.error(e)}
  return false;
}
function defer(fn){setTimeout(function(){try{fn()}catch(e){console.error(e)}},0);return false}
function route(id){
  installWrappers();
  if(id==='navDashboard'){only('dashboardPanel','navDashboard');if(window.showDashboard)defer(function(){window.showDashboard()});return false}
  if(id==='navAnalysis'){only('analysisPanel','navAnalysis');if(window.showModule)defer(function(){window.showModule('analysis')});return false}
  if(id==='navPrescription'){only('prescriptionPanel','navPrescription');if(window.showModule)defer(function(){window.showModule('prescription')});return false}
  if(id==='navVisualExam'){only('visualExamPanel','navVisualExam');if(window.showModule)defer(function(){window.showModule('visualexam')});return false}
  if(id==='navIndications'){only('indicationsPanel','navIndications');if(window.showModule)defer(function(){window.showModule('indications')});return false}
  if(id==='navHearing'){only('hearingPanel','navHearing');if(window.showModule)defer(function(){window.showModule('hearing')});return false}
  if(id==='navClients'){only('clientsPanel','navClients');if(window.showModule)defer(function(){window.showModule('clients')});return false}
  if(id==='navChat'){only('optykerChatPanel','navChat');if(window.optykerOpenChat)defer(function(){window.optykerOpenChat()});return false}
  if(id==='navAppointments'){only('optykerAppointmentsPanel','navAppointments');defer(directAgenda);return false}
  if(id==='navOrders'){only('onlineOrdersPanel','navOrders');if(window.openOnlineOrders)defer(function(){window.openOnlineOrders()});return false}
  if(id==='navSettings'){only('optykerSettingsPanel','navSettings');if(window.optykerOpenSettings)defer(function(){window.optykerOpenSettings()});return false}
  return false;
}
function bindCapture(){
  var nav=E('moduleNav');if(!nav||nav.__exclusiveNavBound)return;nav.__exclusiveNavBound=true;
  nav.addEventListener('click',function(ev){
    var b=ev.target&&ev.target.closest?ev.target.closest('button'):null;
    if(!b||NAVS.indexOf(b.id)<0)return;
    ev.preventDefault();ev.stopPropagation();if(ev.stopImmediatePropagation)ev.stopImmediatePropagation();route(b.id);
  },true);
}
function boot(){installWrappers();bindCapture();var a=E('navAppointments');if(a){a.style.setProperty('pointer-events','auto','important');a.removeAttribute('disabled')}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
setTimeout(boot,60);setTimeout(boot,700);
})();</script>'''

h=s.find('</head>')
if h<0: raise SystemExit('head non trovato')
s=s[:h]+style+s[h:]
b=s.rfind('</body>')
if b<0: raise SystemExit('body non trovato')
s=s[:b]+script+s[b:]
p.write_text(s,encoding='utf-8')
if MARK not in s: raise SystemExit('Fix navigazione non inserito')
print('Exclusive navigation OK')

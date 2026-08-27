from pathlib import Path

p=Path('_site/index.html')
s=p.read_text(encoding='utf-8')
MARK='OPTYKER_SINGLE_ACTIVE_NAV_V18'
if MARK in s:
    raise SystemExit(0)
if 'id="moduleNav"' not in s:
    raise SystemExit('Sidebar non disponibile')

style=r'''<style id="optykerSingleActiveNavV18Css">/* OPTYKER_SINGLE_ACTIVE_NAV_V18 */
#moduleNav .moduleBtn.active{
  background:#e8f3fb!important;
  color:#174d75!important;
  font-weight:900!important;
}
</style>'''

script=r'''<script id="optykerSingleActiveNavV18Js">(function(){/* OPTYKER_SINGLE_ACTIVE_NAV_V18 */
var IDS=['navDashboard','navAppointments','navClients','navChat','navSheets','navAnalysis','navPrescription','navVisualExam','navIndications','navHearing','navOrders','navSettings'];
var current='',guard=false;
function E(i){return document.getElementById(i)}
function enforce(id){
  if(id)current=id;
  if(!current)return;
  guard=true;
  try{
    IDS.forEach(function(x){var b=E(x);if(b)b.classList.toggle('active',x===current)})
  }finally{guard=false}
}
function cleanupFor(id){
  var report=E('reportSectionTop');
  if(report){
    var keep=id==='navClients'||id==='navAnalysis'||id==='navPrescription'||id==='navVisualExam'||id==='navIndications'||id==='navHearing';
    report.style.display=keep?'':'none'
  }
}
function selectId(id){
  if(!id||IDS.indexOf(id)<0)return;
  current=id;enforce(current);cleanupFor(current);
  setTimeout(function(){enforce(current);cleanupFor(current)},0);
  setTimeout(function(){enforce(current);cleanupFor(current)},80);
  setTimeout(function(){enforce(current);cleanupFor(current)},250)
}
function clicked(ev){
  var t=ev.target&&ev.target.closest?ev.target.closest('#moduleNav .moduleBtn'):null;
  if(t&&IDS.indexOf(t.id)>=0){selectId(t.id);return}
  var x=ev.target&&ev.target.closest?ev.target.closest('button,a,[role="button"]'):null;
  if(!x)return;
  var oc=String(x.getAttribute&&x.getAttribute('onclick')||'');
  if(x.matches('.topHomeBtn')||/showDashboard\s*\(/.test(oc)){selectId('navDashboard');return}
  if(/optykerOpenAppointments\s*\(|optykerAgendaDirectOpen\s*\(/.test(oc)){selectId('navAppointments');return}
  if(/openOnlineOrders\s*\(/.test(oc)){selectId('navOrders');return}
  if(/optykerOpenChat\s*\(/.test(oc)){selectId('navChat');return}
  if(/optykerOpenSettings\s*\(/.test(oc)){selectId('navSettings');return}
  if(/showModule\s*\(\s*['"]clients['"]\s*\)|dashboardNewClient\s*\(/.test(oc)){selectId('navClients');return}
  if(/showModule\s*\(\s*['"]analysis['"]\s*\)/.test(oc)){selectId('navAnalysis');return}
  if(/showModule\s*\(\s*['"]prescription['"]\s*\)/.test(oc)){selectId('navPrescription');return}
  if(/showModule\s*\(\s*['"]visualexam['"]\s*\)/.test(oc)){selectId('navVisualExam');return}
  if(/showModule\s*\(\s*['"]indications['"]\s*\)/.test(oc)){selectId('navIndications');return}
  if(/showModule\s*\(\s*['"]hearing['"]\s*\)/.test(oc)){selectId('navHearing');return}
}
document.addEventListener('pointerdown',clicked,true);
document.addEventListener('click',clicked,true);

function wrapNav(name,id,resolver){
  var old=window[name];
  if(typeof old!=='function'||old.__singleActiveNav)return;
  var w=function(){
    var r=old.apply(this,arguments);
    var dest=resolver?resolver.apply(this,arguments):id;
    if(dest)selectId(dest);
    return r
  };
  w.__singleActiveNav=true;w.__singleActiveOriginal=old;window[name]=w
}
function moduleNavId(which){
  if(which==='clients')return'navClients';
  if(which==='analysis')return'navAnalysis';
  if(which==='prescription')return'navPrescription';
  if(which==='visualexam')return'navVisualExam';
  if(which==='indications')return'navIndications';
  if(which==='hearing')return'navHearing';
  return''
}
function installFunctionSync(){
  wrapNav('showDashboard','navDashboard');
  wrapNav('optykerOpenAppointments','navAppointments');
  wrapNav('optykerAgendaDirectOpen','navAppointments');
  wrapNav('openOnlineOrders','navOrders');
  wrapNav('optykerOpenChat','navChat');
  wrapNav('optykerOpenSettings','navSettings');
  wrapNav('showModule','',function(which){return moduleNavId(which)})
}
function visibleNav(){
  var map=[
    ['optykerAppointmentsPanel','navAppointments'],
    ['onlineOrdersPanel','navOrders'],
    ['clientsPanel','navClients'],
    ['optykerChatPanel','navChat'],
    ['optykerSettingsPanel','navSettings'],
    ['analysisPanel','navAnalysis'],
    ['prescriptionPanel','navPrescription'],
    ['visualExamPanel','navVisualExam'],
    ['indicationsPanel','navIndications'],
    ['hearingPanel','navHearing'],
    ['dashboardPanel','navDashboard']
  ];
  for(var i=0;i<map.length;i++){
    var p=E(map[i][0]);
    if(!p)continue;
    var cs=window.getComputedStyle?getComputedStyle(p):null;
    if(p.style.display!=='none'&&(!cs||cs.display!=='none')&&!p.hidden)return map[i][1]
  }
  return''
}
function syncVisible(){
  var id=visibleNav();
  if(id&&id!==current)selectId(id)
}
function boot(){
  var nav=E('moduleNav');if(!nav)return;
  installFunctionSync();
  var act=IDS.filter(function(x){var b=E(x);return b&&b.classList.contains('active')});
  current=act.length?act[act.length-1]:(visibleNav()||(E('navDashboard')?'navDashboard':''));
  enforce(current);
  new MutationObserver(function(){
    if(guard||!current)return;
    var wrong=IDS.some(function(x){var b=E(x);return b&&b.classList.contains('active')!==(x===current)});
    if(wrong)setTimeout(function(){syncVisible();enforce(current)},0)
  }).observe(nav,{subtree:true,attributes:true,attributeFilter:['class']});
  ['dashboardPanel','optykerAppointmentsPanel','onlineOrdersPanel','clientsPanel','optykerChatPanel','optykerSettingsPanel','analysisPanel','prescriptionPanel','visualExamPanel','indicationsPanel','hearingPanel'].forEach(function(id){
    var p=E(id);if(p&&!p.__singleActivePanelWatch){p.__singleActivePanelWatch=true;new MutationObserver(function(){setTimeout(syncVisible,0)}).observe(p,{attributes:true,attributeFilter:['style','class','hidden']})}
  });
  window.optykerSelectSidebarNav=selectId;
  setTimeout(syncVisible,20)
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setTimeout(boot,120)});else setTimeout(boot,120);
window.addEventListener('pageshow',function(){setTimeout(function(){if(current)enforce(current)},100)});
})();</script>'''

h=s.find('</head>')
if h<0: raise SystemExit('head non trovato')
s=s[:h]+style+s[h:]
b=s.rfind('</body>')
if b<0: raise SystemExit('body non trovato')
s=s[:b]+script+s[b:]
p.write_text(s,encoding='utf-8')
for req in [MARK,'navAppointments','navClients','MutationObserver','classList.toggle']:
    if req not in s: raise SystemExit('Nav V18 incompleta: '+req)
print('Single active sidebar V18 OK')

from pathlib import Path

p=Path('_site/index.html')
s=p.read_text(encoding='utf-8')
MARK='OPTYKER_SIDEBAR_ORDER_V2'
if MARK in s:
    raise SystemExit(0)
if 'OPTYKER_SIDEBAR_ORDER_V1' not in s or 'id="moduleNav"' not in s:
    raise SystemExit('Sidebar V1 non disponibile')

style=r'''<style id="optykerSidebarOrderV2Css">/* OPTYKER_SIDEBAR_ORDER_V2 */
#moduleSheetGroup,#moduleSheetChildren{display:none!important}
#moduleNav{align-content:flex-start!important;justify-content:flex-start!important;overflow-y:auto!important;overflow-x:hidden!important}
#moduleNav>#navDashboard{order:10!important}
#moduleNav>#navAppointments{order:20!important}
#moduleNav>#navClients{order:30!important}
#moduleNav>#clientSidebarSubmenu{order:31!important}
#moduleNav>#navChat{order:40!important}
#moduleNav>#navSheets{order:50!important}
#moduleNav>#sheetsSubmenu{order:51!important}
#moduleNav>#navOrders{order:60!important}
#moduleNav>#navSettings{order:70!important}
#moduleNav>.moduleBtn,#moduleNav>#navSheets{flex:0 0 auto!important;flex-shrink:0!important;min-height:46px!important;height:auto!important;padding-top:10px!important;padding-bottom:10px!important}
#moduleNav>#sheetsSubmenu,#moduleNav>#clientSidebarSubmenu{flex:0 0 auto!important;flex-shrink:0!important}
#moduleNav #sheetsSubmenu .moduleBtn,#moduleNav #clientSidebarSubmenu .moduleBtn{flex:0 0 auto!important;flex-shrink:0!important;min-height:42px!important;height:auto!important;padding-top:8px!important;padding-bottom:8px!important}
</style>'''

script=r'''<script id="optykerSidebarOrderV2Js">(function(){/* OPTYKER_SIDEBAR_ORDER_V2 */
var working=false;
function E(i){return document.getElementById(i)}
var SHEETS=['navAnalysis','navPrescription','navVisualExam','navIndications','navHearing'];
function makeSheetsButton(){
  var b=E('navSheets');
  if(b)return b;
  b=document.createElement('button');b.id='navSheets';b.className='moduleBtn';b.type='button';b.setAttribute('data-short','Schede');
  b.innerHTML='<span class="winNavIcon" aria-hidden="true">▤</span><span>Schede</span><span id="navSheetsArrow" class="navSheetsArrow" aria-hidden="true">›</span>';
  b.onclick=function(){if(window.optykerToggleSheets)window.optykerToggleSheets()};
  return b
}
function makeSub(){var a=E('sheetsSubmenu');if(a)return a;a=document.createElement('div');a.id='sheetsSubmenu';a.className='sheetsSubmenu';a.setAttribute('aria-hidden','true');return a}
function move(nav,node){if(node&&node.parentNode!==nav)nav.appendChild(node);else if(node)nav.appendChild(node)}
function enforce(){
  if(working)return;working=true;
  try{
    var nav=E('moduleNav');if(!nav)return;
    var sheets=makeSheetsButton(),sub=makeSub();
    SHEETS.forEach(function(id){var b=E(id);if(b&&b.parentNode!==sub)sub.appendChild(b)});
    var oldChildren=E('moduleSheetChildren');if(oldChildren)SHEETS.forEach(function(id){var b=E(id);if(b&&b.parentNode!==sub)sub.appendChild(b)});
    move(nav,E('navDashboard'));
    move(nav,E('navAppointments'));
    move(nav,E('navClients'));
    move(nav,E('clientSidebarSubmenu'));
    move(nav,E('navChat'));
    move(nav,sheets);
    move(nav,sub);
    move(nav,E('navOrders'));
    move(nav,E('navSettings'));
    var old=E('moduleSheetGroup');if(old&&old.parentNode)old.parentNode.removeChild(old);
  }finally{working=false}
}
var oldInit=window.clientSidebarInit;
if(typeof oldInit==='function'&&!oldInit.__optykerSidebarV2){
  var wrapped=function(){var r=oldInit.apply(this,arguments);setTimeout(enforce,0);setTimeout(enforce,60);return r};
  wrapped.__optykerSidebarV2=true;wrapped.__original=oldInit;window.clientSidebarInit=wrapped;
}
function boot(){enforce();setTimeout(enforce,80);setTimeout(enforce,450);setTimeout(enforce,1200)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
window.addEventListener('pageshow',boot);
new MutationObserver(function(){setTimeout(enforce,0)}).observe(document.documentElement,{childList:true,subtree:true});
setInterval(enforce,1200);
})();</script>'''

h=s.find('</head>')
if h<0: raise SystemExit('head non trovato')
s=s[:h]+style+s[h:]
b=s.rfind('</body>')
if b<0: raise SystemExit('body non trovato')
s=s[:b]+script+s[b:]
p.write_text(s,encoding='utf-8')
if MARK not in s or 'optykerSidebarOrderV2Js' not in s:
    raise SystemExit('Sidebar V2 non inserita')
print('Sidebar runtime order V2 OK')

from pathlib import Path

p=Path('_site/index.html')
s=p.read_text(encoding='utf-8')
MARK='OPTYKER_SIDEBAR_CLICKS_V1'
if MARK in s:
    raise SystemExit(0)
if 'id="moduleNav"' not in s or 'id="navDashboard"' not in s or 'id="navAppointments"' not in s:
    raise SystemExit('Sidebar non disponibile')

style=r'''<style id="optykerSidebarClicksCss">/* OPTYKER_SIDEBAR_CLICKS_V1 */
#moduleNav{pointer-events:auto!important;position:sticky!important;z-index:30000!important}
#moduleNav button,#moduleNav .moduleBtn,#moduleNav #navSheets{pointer-events:auto!important;cursor:pointer!important;position:relative!important;z-index:3!important}
#moduleNav button:disabled{pointer-events:auto!important;opacity:1!important}
</style>'''

script=r'''<script id="optykerSidebarClicksJs">(function(){/* OPTYKER_SIDEBAR_CLICKS_V1 */
function E(i){return document.getElementById(i)}
var IDS=['navDashboard','navAppointments','navClients','navChat','navSheets','navAnalysis','navPrescription','navVisualExam','navIndications','navHearing','navOrders','navSettings'];
function sheets(on){var n=E('moduleNav'),a=E('sheetsSubmenu');if(!n||!a)return;n.classList.toggle('sheetsOpen',!!on);a.setAttribute('aria-hidden',on?'false':'true');var b=E('navSheets');if(b)b.classList.toggle('active',!!on)}
function route(id){
  try{
    if(id==='navSheets'){var n=E('moduleNav');sheets(!(n&&n.classList.contains('sheetsOpen')));return}
    if(id==='navDashboard'&&typeof window.showDashboard==='function')window.showDashboard();
    else if(id==='navAppointments'&&typeof window.optykerOpenAppointments==='function')window.optykerOpenAppointments();
    else if(id==='navClients'&&typeof window.showModule==='function')window.showModule('clients');
    else if(id==='navChat'&&typeof window.optykerOpenChat==='function')window.optykerOpenChat();
    else if(id==='navAnalysis'&&typeof window.showModule==='function')window.showModule('analysis');
    else if(id==='navPrescription'&&typeof window.showModule==='function')window.showModule('prescription');
    else if(id==='navVisualExam'&&typeof window.showModule==='function')window.showModule('visualexam');
    else if(id==='navIndications'&&typeof window.showModule==='function')window.showModule('indications');
    else if(id==='navHearing'&&typeof window.showModule==='function')window.showModule('hearing');
    else if(id==='navOrders'&&typeof window.openOnlineOrders==='function')window.openOnlineOrders();
    else if(id==='navSettings'&&typeof window.optykerOpenSettings==='function')window.optykerOpenSettings();
    if(['navAnalysis','navPrescription','navVisualExam','navIndications','navHearing'].indexOf(id)>=0)sheets(true);else sheets(false)
  }catch(e){console.error('Sidebar route',id,e)}
}
function unlock(){IDS.forEach(function(id){var b=E(id);if(!b)return;b.removeAttribute('disabled');b.style.setProperty('pointer-events','auto','important');b.style.setProperty('cursor','pointer','important')});var n=E('moduleNav');if(n){n.style.setProperty('pointer-events','auto','important');n.style.setProperty('z-index','30000','important')}}
document.addEventListener('click',function(ev){var b=ev.target&&ev.target.closest?ev.target.closest('#moduleNav button'):null;if(!b||IDS.indexOf(b.id)<0)return;ev.preventDefault();ev.stopPropagation();if(ev.stopImmediatePropagation)ev.stopImmediatePropagation();route(b.id)},true);
document.addEventListener('keydown',function(ev){if(ev.key!=='Enter'&&ev.key!==' ')return;var b=ev.target;if(!b||!b.id||IDS.indexOf(b.id)<0||!b.closest('#moduleNav'))return;ev.preventDefault();route(b.id)},true);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',unlock);else unlock();
window.addEventListener('pageshow',unlock);setTimeout(unlock,100);setTimeout(unlock,700);setInterval(unlock,2000);
})();</script>'''

h=s.find('</head>')
if h<0: raise SystemExit('head non trovato')
s=s[:h]+style+s[h:]
b=s.rfind('</body>')
if b<0: raise SystemExit('body non trovato')
s=s[:b]+script+s[b:]
p.write_text(s,encoding='utf-8')
if MARK not in s or 'optykerSidebarClicksJs' not in s:
    raise SystemExit('Fix click sidebar non inserito')
print('Sidebar clicks V1 OK')

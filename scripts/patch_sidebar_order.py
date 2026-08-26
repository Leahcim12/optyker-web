from pathlib import Path
import re

p=Path('_site/index.html')
s=p.read_text(encoding='utf-8')
MARK='OPTYKER_SIDEBAR_ORDER_V1'
if MARK in s:
    raise SystemExit(0)

m=re.search(r'(<div\s+id="moduleNav"\s+class="moduleNav">)([\s\S]*?)(</div>\s*<div\s+id="currentClientBanner")',s,re.I)
if not m:
    raise SystemExit('Barra laterale non trovata')
body=m.group(2)
ids=['navDashboard','navAppointments','navClients','navChat','navAnalysis','navPrescription','navVisualExam','navIndications','navHearing','navOrders','navSettings']
buttons={}
for bid in ids:
    q=re.search(r'<button\b[^>]*\bid="'+re.escape(bid)+r'"[^>]*>[\s\S]*?</button>',body,re.I)
    if not q:
        raise SystemExit('Pulsante non trovato: '+bid)
    buttons[bid]=q.group(0)

sheet_ids=['navAnalysis','navPrescription','navVisualExam','navIndications','navHearing']
sub='\n'.join('      '+buttons[x] for x in sheet_ids)
nav='''
    {dashboard}
    {agenda}
    {clients}
    {chat}
    <button id="navSheets" class="moduleBtn" data-short="Schede" type="button" onclick="optykerToggleSheets()"><span class="winNavIcon" aria-hidden="true">▤</span><span>Schede</span><span id="navSheetsArrow" class="navSheetsArrow" aria-hidden="true">›</span></button>
    <div id="sheetsSubmenu" class="sheetsSubmenu" aria-hidden="true">
{sub}
    </div>
    {orders}
    {settings}
  '''.format(
    dashboard=buttons['navDashboard'],agenda=buttons['navAppointments'],clients=buttons['navClients'],chat=buttons['navChat'],
    sub=sub,orders=buttons['navOrders'],settings=buttons['navSettings']
)
s=s[:m.start(2)]+nav+s[m.end(2):]

style=r'''<style id="optykerSidebarOrderCss">/* OPTYKER_SIDEBAR_ORDER_V1 */
#moduleNav .sheetsSubmenu{display:none;flex-direction:column;gap:5px;width:100%;padding:3px 0 3px 12px;box-sizing:border-box}
#moduleNav.sheetsOpen .sheetsSubmenu{display:flex}
#moduleNav .sheetsSubmenu .moduleBtn{width:100%;font-size:11px;min-height:38px}
#navSheets{position:relative}
#navSheets .navSheetsArrow{margin-left:auto;font-size:18px;line-height:1;transition:transform .18s ease}
#moduleNav.sheetsOpen #navSheets .navSheetsArrow{transform:rotate(90deg)}
#moduleNav.sheetsOpen #navSheets{background:#edf5fb}
</style>'''
h=s.find('</head>')
if h<0:
    raise SystemExit('head non trovato')
s=s[:h]+style+s[h:]

script=r'''<script id="optykerSidebarOrderJs">(function(){/* OPTYKER_SIDEBAR_ORDER_V1 */
function E(i){return document.getElementById(i)}
function setSheets(on){var n=E('moduleNav'),a=E('sheetsSubmenu');if(!n||!a)return;n.classList.toggle('sheetsOpen',!!on);a.setAttribute('aria-hidden',on?'false':'true');var b=E('navSheets');if(b)b.classList.toggle('active',!!on)}
window.optykerToggleSheets=function(){var n=E('moduleNav');setSheets(!(n&&n.classList.contains('sheetsOpen')))};
document.addEventListener('click',function(ev){var b=ev.target&&ev.target.closest?ev.target.closest('#moduleNav button'):null;if(!b)return;if(b.id==='navSheets')return;if(['navAnalysis','navPrescription','navVisualExam','navIndications','navHearing'].indexOf(b.id)>=0){setSheets(true);return}setSheets(false)},true);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setSheets(false)});else setSheets(false);
})();</script>'''
b=s.rfind('</body>')
if b<0:
    raise SystemExit('body non trovato')
s=s[:b]+script+s[b:]

p.write_text(s,encoding='utf-8')
if MARK not in s or 'id="navSheets"' not in s or 'id="sheetsSubmenu"' not in s:
    raise SystemExit('Riordino barra laterale non inserito')
print('Sidebar order OK')

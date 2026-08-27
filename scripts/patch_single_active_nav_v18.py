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
    if(!keep)report.style.display='none'
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
  var d=ev.target&&ev.target.closest?ev.target.closest('.topHomeBtn,[onclick*="showDashboard()"]'):null;
  if(d){selectId('navDashboard');return}
}
document.addEventListener('pointerdown',clicked,true);
document.addEventListener('click',clicked,true);
function boot(){
  var nav=E('moduleNav');if(!nav)return;
  var act=IDS.filter(function(x){var b=E(x);return b&&b.classList.contains('active')});
  current=act.length?act[act.length-1]:(E('navDashboard')?'navDashboard':'');
  enforce(current);
  new MutationObserver(function(){
    if(guard||!current)return;
    var wrong=IDS.some(function(x){var b=E(x);return b&&b.classList.contains('active')!==(x===current)});
    if(wrong)setTimeout(function(){enforce(current)},0)
  }).observe(nav,{subtree:true,attributes:true,attributeFilter:['class']})
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

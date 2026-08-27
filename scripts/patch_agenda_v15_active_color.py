from pathlib import Path

p=Path('_site/index.html')
s=p.read_text(encoding='utf-8')
MARK='OPTYKER_AGENDA_V15_ACTIVE_COLOR'
if MARK in s:
    raise SystemExit(0)
if 'id="navAppointments"' not in s or 'id="optykerAppointmentsPanel"' not in s:
    raise SystemExit('Agenda non disponibile')

style=r'''<style id="optykerAgendaV15ActiveCss">/* OPTYKER_AGENDA_V15_ACTIVE_COLOR */
#navAppointments.active{background:#e8f3fb!important;color:#174d75!important;font-weight:900!important}
#oaCalendar.oaCalendarMonth .oaMonthEvent{
  background:color-mix(in srgb,var(--c,#1769aa) 28%,white)!important;
  border-left-color:var(--c,#1769aa)!important;
}
</style>'''

script=r'''<script id="optykerAgendaV15ActiveJs">(function(){/* OPTYKER_AGENDA_V15_ACTIVE_COLOR */
function E(i){return document.getElementById(i)}
function visible(){
  var p=E('optykerAppointmentsPanel');if(!p)return false;
  try{return getComputedStyle(p).display!=='none'}catch(e){return p.style.display!=='none'}
}
function sync(){
  var b=E('navAppointments');if(!b)return;
  b.classList.toggle('active',visible())
}
function keep(){
  var b=E('navAppointments');if(b)b.classList.add('active')
}
document.addEventListener('click',function(ev){
  var b=ev.target&&ev.target.closest?ev.target.closest('#navAppointments'):null;
  if(b){setTimeout(keep,0);setTimeout(keep,80);setTimeout(sync,300);return}
  var other=ev.target&&ev.target.closest?ev.target.closest('#moduleNav .moduleBtn'):null;
  if(other)setTimeout(sync,80)
},true);
var tries=0;(function boot(){
  tries++;
  var p=E('optykerAppointmentsPanel'),b=E('navAppointments');
  if(p&&b){
    new MutationObserver(sync).observe(p,{attributes:true,attributeFilter:['style','class']});
    new MutationObserver(sync).observe(b,{attributes:true,attributeFilter:['class']});
    sync();return
  }
  if(tries<30)setTimeout(boot,100)
})();
window.addEventListener('pageshow',function(){setTimeout(sync,80)});
})();</script>'''

h=s.find('</head>')
if h<0: raise SystemExit('head non trovato')
s=s[:h]+style+s[h:]
b=s.rfind('</body>')
if b<0: raise SystemExit('body non trovato')
s=s[:b]+script+s[b:]
p.write_text(s,encoding='utf-8')
for req in [MARK,'#navAppointments.active','oaCalendarMonth','MutationObserver(sync)']:
    if req not in s: raise SystemExit('Agenda V15 active incompleta: '+req)
print('Agenda V15 active/color OK')

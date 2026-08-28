from pathlib import Path

p=Path('_site/index.html')
s=p.read_text(encoding='utf-8')
MARK='OPTYKER_APPOINTMENTS_UI_V8'
if MARK in s:
    raise SystemExit(0)
if 'OPTYKER_APPOINTMENTS_UI_V7' not in s or 'id="optykerAppointmentsPanel"' not in s:
    raise SystemExit('Agenda V7 non disponibile')

style=r'''<style id="optykerAppointmentsV8Css">/* OPTYKER_APPOINTMENTS_UI_V8 */
#oaStudioFilter{display:none!important}
.oaUnifiedStudioHidden{display:none!important}
#oaRules .oaUnifiedRuleStudioHidden{display:none!important}
.oaUnifiedAgendaNoteV8{font-size:10px;color:#60788c;background:#f4f9fc;border:1px solid #d8e6ef;border-radius:9px;padding:8px 10px;margin:6px 0 10px}
</style>'''

script=r'''<script id="optykerAppointmentsV8Js">(function(){/* OPTYKER_APPOINTMENTS_UI_V8 */
function E(i){return document.getElementById(i)}
function apply(){
  var filter=E('oaStudioFilter');if(filter){filter.value='';filter.style.setProperty('display','none','important')}
  var studio=E('oaStudio');if(studio){studio.value='';var f=studio.closest('.oaF');if(f)f.classList.add('oaUnifiedStudioHidden')}
  document.querySelectorAll('#oaRules .avStudio').forEach(function(sel){sel.value='';var f=sel.closest('.oaAvailField');if(f)f.classList.add('oaUnifiedRuleStudioHidden')});
  var panel=E('optykerAppointmentsPanel');if(panel&&!E('oaUnifiedAgendaNoteV8')){var mode=E('oaCalendarModeV7')||panel.querySelector('.oaToolbar');if(mode){var n=document.createElement('div');n.id='oaUnifiedAgendaNoteV8';n.className='oaUnifiedAgendaNoteV8';n.textContent='Agenda unica: per i servizi che richiedono uno studio, Optyker assegna automaticamente Studio 1 o Studio 2. Quando entrambi sono occupati, quella fascia non accetta altri appuntamenti.';mode.insertAdjacentElement('afterend',n)}}
  var rules=E('oaRules');if(rules){var h=rules.previousElementSibling,txt='Scegli servizio, uno o più giorni della settimana, orario e intervallo. L’agenda è unica e usa automaticamente il primo studio libero tra Studio 1 e Studio 2.';if(h&&h.classList.contains('oaHelp')&&h.textContent!==txt)h.textContent=txt}
}
function boot(){apply();setTimeout(apply,80);setTimeout(apply,350);setTimeout(apply,1000)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
window.addEventListener('pageshow',boot);
new MutationObserver(function(){setTimeout(apply,20)}).observe(document.documentElement,{subtree:true,childList:true});
setInterval(apply,1800);
})();</script>'''

h=s.find('</head>')
if h<0: raise SystemExit('head non trovato')
s=s[:h]+style+s[h:]
b=s.rfind('</body>')
if b<0: raise SystemExit('body non trovato')
s=s[:b]+script+s[b:]
p.write_text(s,encoding='utf-8')
if MARK not in s or 'Agenda unica' not in s or 'oaUnifiedRuleStudioHidden' not in s:
    raise SystemExit('Agenda V8 non inserita')
print('Appointments V8 unified two-studio agenda OK')

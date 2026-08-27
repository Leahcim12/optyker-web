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
  /* La selezione della sidebar è gestita esclusivamente dalla patch V18. */
})();</script>'''

h=s.find('</head>')
if h<0: raise SystemExit('head non trovato')
s=s[:h]+style+s[h:]
b=s.rfind('</body>')
if b<0: raise SystemExit('body non trovato')
s=s[:b]+script+s[b:]
p.write_text(s,encoding='utf-8')
for req in [MARK,'#navAppointments.active','oaCalendarMonth','OPTYKER_AGENDA_V15_ACTIVE_COLOR']:
    if req not in s: raise SystemExit('Agenda V15 active incompleta: '+req)
print('Agenda V15 active/color OK')

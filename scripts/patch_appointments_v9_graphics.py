from pathlib import Path

p=Path('_site/index.html')
s=p.read_text(encoding='utf-8')
MARK='OPTYKER_APPOINTMENTS_UI_V9_GRAPHICS'
if MARK in s:
    raise SystemExit(0)
if 'OPTYKER_APPOINTMENTS_UI_V8' not in s or 'id="oaRules"' not in s or 'id="oaServices"' not in s:
    raise SystemExit('Agenda V8 non disponibile')

style=r'''<style id="optykerAppointmentsV9GraphicsCss">/* OPTYKER_APPOINTMENTS_UI_V9_GRAPHICS */
#optykerSettingsHub{max-width:none!important;width:100%!important;min-width:0!important}
#optykerSettingsAgendaPane,#optykerSettingsAgendaPane .oaSettingsEmbedded{width:100%!important;max-width:none!important;min-width:0!important;overflow:visible!important;box-sizing:border-box!important}
.oaSets{display:grid!important;grid-template-columns:minmax(0,1fr)!important;gap:16px!important;width:100%!important;max-width:100%!important;min-width:0!important}
.oaSet,.oaSet.full,#oaStoreSetV7{grid-column:1/-1!important;width:100%!important;max-width:100%!important;min-width:0!important;box-sizing:border-box!important;padding:14px!important}
.oaSetTitle{gap:10px!important;flex-wrap:wrap!important}.oaSetTitle>span{font-size:15px!important}.oaHelp,.oaStoreHoursHelpV7{font-size:10px!important;line-height:1.5!important}
#oaServices,#oaStudios,#oaStoreHoursV7,#oaRules{width:100%!important;max-width:100%!important;min-width:0!important;box-sizing:border-box!important}

/* Servizi: campi leggibili, senza colonne schiacciate */
#oaServices .oaService{display:grid!important;grid-template-columns:minmax(250px,2.4fr) 92px 72px 118px 88px auto!important;grid-template-areas:'name duration color studio active delete' 'operators operators operators operators operators operators'!important;gap:9px!important;align-items:end!important;width:100%!important;min-width:0!important;box-sizing:border-box!important;padding:13px!important}
#oaServices .oaSvcNameField{grid-area:name!important}#oaServices .oaSvcDurationField{grid-area:duration!important}#oaServices .oaSvcColorField{grid-area:color!important}#oaServices .oaSvcStudioField{grid-area:studio!important}#oaServices .oaSvcActiveField{grid-area:active!important}#oaServices .oaEntityDelete{grid-area:delete!important}#oaServices .oaSvcOperators{grid-area:operators!important;grid-column:auto!important}
#oaServices .oaSvcOperatorList{row-gap:7px!important}.oaSvcOperator{min-height:34px!important}

/* Studi su tutta la larghezza */
#oaStudios{display:grid!important;grid-template-columns:repeat(2,minmax(260px,1fr))!important;gap:9px!important}
#oaStudios .oaStudio{display:grid!important;grid-template-columns:minmax(0,1fr) 92px auto!important;gap:8px!important;margin:0!important;align-items:center!important;padding:10px!important;border:1px solid #dbe4ea!important;border-radius:10px!important;background:#fff!important;min-width:0!important}
#oaStudios .oaStudio input,#oaStudios .oaStudio select{width:100%!important;min-width:0!important}

/* Negozio: orari ordinati e contenuti nel pannello */
.oaStoreHourV7{display:grid!important;grid-template-columns:110px 90px repeat(4,minmax(95px,1fr))!important;gap:8px!important;width:100%!important;min-width:0!important;box-sizing:border-box!important}
.oaStoreHourV7>*{min-width:0!important}.oaStoreHourV7 input,.oaStoreHourV7 select{width:100%!important;box-sizing:border-box!important}

/* Disponibilità: eliminata la colonna studio dall'impaginazione dell'agenda unica */
#oaRules .oaAvailRow{display:grid!important;grid-template-columns:minmax(180px,1.25fr) minmax(330px,2.6fr) 96px 96px 88px auto!important;grid-template-areas:'service days start end interval actions' 'hint hint hint hint hint hint'!important;gap:9px!important;align-items:end!important;width:100%!important;max-width:100%!important;min-width:0!important;box-sizing:border-box!important;overflow:hidden!important;padding:13px!important}
#oaRules .oaV9Service{grid-area:service!important}#oaRules .oaAvailDays{grid-area:days!important;min-width:0!important}#oaRules .oaV9Start{grid-area:start!important}#oaRules .oaV9End{grid-area:end!important}#oaRules .oaV9Interval{grid-area:interval!important}#oaRules .oaAvailActions{grid-area:actions!important;display:flex!important;justify-content:flex-end!important;align-items:end!important;gap:6px!important;min-width:0!important}#oaRules .oaAvailOperatorsHint{grid-area:hint!important;grid-column:auto!important;margin:0!important;padding-top:2px!important}
#oaRules .oaUnifiedRuleStudioHidden,#oaRules .oaV9Studio{display:none!important}
#oaRules .oaAvailDaysList{display:flex!important;flex-wrap:wrap!important;gap:6px!important;min-width:0!important}.oaAvailDay{white-space:nowrap!important}
#oaRules .oaAvailField input,#oaRules .oaAvailField select{width:100%!important;min-width:0!important;box-sizing:border-box!important}

@media(max-width:1080px){
  #oaServices .oaService{grid-template-columns:minmax(220px,2fr) 86px 68px 108px 82px auto!important}
  #oaRules .oaAvailRow{grid-template-columns:1fr 1fr 1fr!important;grid-template-areas:'service service service' 'days days days' 'start end interval' 'actions actions actions' 'hint hint hint'!important}
  #oaRules .oaAvailActions{justify-content:flex-end!important}
  .oaStoreHourV7{grid-template-columns:105px 86px 1fr 1fr!important}.oaStoreHourV7 .v7second{grid-column:auto!important}
}
@media(max-width:850px){
  #oaServices .oaService{grid-template-columns:1fr 1fr 1fr!important;grid-template-areas:'name name name' 'duration color studio' 'active delete delete' 'operators operators operators'!important;align-items:end!important}
  #oaServices .oaEntityDelete{justify-self:end!important;min-width:92px!important}
  #oaStudios{grid-template-columns:1fr!important}
  .oaStoreHourV7{grid-template-columns:95px 82px 1fr 1fr!important}
}
@media(max-width:620px){
  .oaSet,.oaSet.full,#oaStoreSetV7{padding:11px!important}
  #oaServices .oaService{grid-template-columns:1fr 1fr!important;grid-template-areas:'name name' 'duration color' 'studio active' 'delete delete' 'operators operators'!important}
  #oaServices .oaEntityDelete{justify-self:stretch!important;width:100%!important}
  #oaRules .oaAvailRow{grid-template-columns:1fr 1fr!important;grid-template-areas:'service service' 'days days' 'start end' 'interval interval' 'actions actions' 'hint hint'!important}
  #oaRules .oaAvailActions{justify-content:stretch!important}#oaRules .oaAvailActions button{flex:1!important}
  .oaStoreHourV7{grid-template-columns:1fr 1fr!important}.oaStoreHourV7 b{grid-column:1!important}.oaStoreHourV7 .v7active{grid-column:2!important}
}
</style>'''

script=r'''<script id="optykerAppointmentsV9GraphicsJs">(function(){/* OPTYKER_APPOINTMENTS_UI_V9_GRAPHICS */
function markAvailability(){
  document.querySelectorAll('#oaRules .oaAvailRow').forEach(function(row){
    row.querySelectorAll('.oaAvailField').forEach(function(f){
      var t=(f.querySelector(':scope > span')&&f.querySelector(':scope > span').textContent||'').trim().toLowerCase();
      f.classList.remove('oaV9Service','oaV9Studio','oaV9Start','oaV9End','oaV9Interval');
      if(t==='servizio')f.classList.add('oaV9Service');
      else if(t==='studio')f.classList.add('oaV9Studio');
      else if(t==='dalle')f.classList.add('oaV9Start');
      else if(t==='alle')f.classList.add('oaV9End');
      else if(t.indexOf('intervallo')===0)f.classList.add('oaV9Interval');
    });
  });
}
function fix(){
  markAvailability();
  var sets=document.querySelector('.oaSets');if(sets){sets.style.setProperty('grid-template-columns','minmax(0,1fr)','important');sets.style.setProperty('width','100%','important')}
  document.querySelectorAll('.oaSet,#oaStoreSetV7').forEach(function(x){x.style.setProperty('width','100%','important');x.style.setProperty('max-width','100%','important');x.style.setProperty('min-width','0','important')});
}
function boot(){fix();setTimeout(fix,80);setTimeout(fix,350);setTimeout(fix,1000)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
window.addEventListener('resize',fix);window.addEventListener('pageshow',boot);
new MutationObserver(function(){setTimeout(fix,25)}).observe(document.documentElement,{subtree:true,childList:true});
setInterval(fix,2000);
})();</script>'''

h=s.find('</head>')
if h<0: raise SystemExit('head non trovato')
s=s[:h]+style+s[h:]
b=s.rfind('</body>')
if b<0: raise SystemExit('body non trovato')
s=s[:b]+script+s[b:]
p.write_text(s,encoding='utf-8')
if MARK not in s or 'oaV9Service' not in s or 'grid-template-areas' not in s:
    raise SystemExit('Agenda V9 grafica non inserita')
print('Appointments V9 responsive graphics OK')

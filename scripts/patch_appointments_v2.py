from pathlib import Path

p=Path('_site/index.html')
s=p.read_text(encoding='utf-8')
MARK='OPTYKER_APPOINTMENTS_UI_V2'
if MARK in s:
    raise SystemExit(0)
if 'OPTYKER_APPOINTMENTS_UI_V1' not in s or 'id="optykerSettingsPanel"' not in s:
    raise SystemExit('Agenda V1 / Impostazioni non disponibili')

def once(old,new,label):
    global s
    c=s.count(old)
    if c != 1:
        raise SystemExit(f'{label}: occorrenze {c}')
    s=s.replace(old,new,1)

def add_head(block):
    global s
    i=s.find('</head>'); b=s.find('<body')
    if i<0 or (b>=0 and i>b):
        raise SystemExit('head non trovato')
    s=s[:i]+block+s[i:]

def add_body(block):
    global s
    i=s.rfind('</body>')
    if i<0:
        raise SystemExit('body non trovato')
    s=s[:i]+block+s[i:]

once(
    '<div class="oaToolbar"><button id="oaPrev" class="secondary">‹</button>',
    '<div class="oaToolbar"><div class="oaViewSwitch"><button id="oaViewWeek" class="secondary active" type="button">Settimana</button><button id="oaViewMonth" class="secondary" type="button">Mese</button></div><button id="oaPrev" class="secondary">‹</button>',
    'Selettore vista agenda'
)

once(
    "var S={boot:null,week:null,items:[],slot:null};",
    "var S={boot:null,week:null,anchor:new Date(),view:'week',items:[],slot:null};",
    'Stato agenda V2'
)

start=s.find("function load(){")
end=s.find("\nfunction open(){", start)
if start < 0 or end < 0:
    raise SystemExit('Funzioni load/render agenda non trovate')

new_render = r'''window.optykerAgendaBoot=function(force){return boot(!!force)};
function monthStart(d){var x=new Date(d||new Date());x.setHours(0,0,0,0);x.setDate(1);return x}
function rangeStart(){if(S.view==='month')return mon(monthStart(S.anchor));if(!S.week)S.week=mon(S.anchor||new Date());return S.week}
function rangeDays(){return S.view==='month'?42:7}
function load(){var a=rangeStart(),n=rangeDays();status('oaStatus','Caricamento…');return api('list',{from:a.toISOString(),to:plus(a,n).toISOString()}).then(function(x){S.items=x.data||[];render();status('oaStatus','')}).catch(function(e){status('oaStatus',e.message,true)})}
function filtered(){var op=E('oaOpFilter').value,st=E('oaStudioFilter').value;return S.items.filter(function(x){return(!op||String(x.operator_username).toUpperCase()===op.toUpperCase())&&(!st||x.studio_id===st)})}
function setViewButtons(){var w=E('oaViewWeek'),m=E('oaViewMonth');if(w)w.classList.toggle('active',S.view==='week');if(m)m.classList.toggle('active',S.view==='month')}
function dayBounds(items){var lo=9,hi=19,seen=false;(S.boot&&S.boot.rules||[]).forEach(function(r){if(r.active===false)return;var a=parseInt(String(r.start_time||'09:00').slice(0,2),10),b=parseInt(String(r.end_time||'19:00').slice(0,2),10)+(String(r.end_time||'').slice(3,5)!=='00'?1:0);if(!isNaN(a)){lo=seen?Math.min(lo,a):a;seen=true}if(!isNaN(b))hi=Math.max(hi,b)});items.forEach(function(x){var a=new Date(x.starts_at),b=new Date(x.ends_at);lo=Math.min(lo,a.getHours());hi=Math.max(hi,b.getHours()+(b.getMinutes()?1:0))});lo=Math.max(0,Math.min(23,lo));hi=Math.min(24,Math.max(lo+1,hi));return[lo,hi]}
function eventHtml(x,compact){return'<button class="oaEvent '+(compact?'oaEventCompact ':'')+(x.status==='cancelled'?'oaCancelled':'')+'" style="--c:'+X(x.service_color||'#1769aa')+'" data-id="'+X(x.id)+'"><div class="oaEventTime">'+X(tm(x.starts_at))+'–'+X(tm(x.ends_at))+'</div><div class="oaEventClient">'+X((x.last_name||'')+' '+(x.first_name||''))+'</div><div class="oaEventMeta">'+X(x.service_name)+' · '+X(x.operator_username)+' · '+X(x.studio_name)+'</div></button>'}
function bindEvents(){E('oaCalendar').querySelectorAll('[data-id]').forEach(function(b){b.onclick=function(){var a=S.items.find(function(x){return x.id===b.dataset.id});if(!a)return;var v=prompt('Stato appuntamento: confermato / completato / annullato / assente',a.status||'confirmed');if(v===null)return;var q=v.toLowerCase(),st=q.indexOf('complet')===0?'completed':q.indexOf('annull')===0?'cancelled':q.indexOf('ass')===0?'no_show':'confirmed';api('appointment_status',{id:a.id,status:st}).then(load).catch(function(e){alert(e.message)})}})}
function renderWeek(a){var items=filtered(),today=ds(new Date()),b=dayBounds(items),lo=b[0],hi=b[1],scale=58,height=(hi-lo)*scale,h='<div class="oaWeekGrid"><div class="oaWeekCorner"></div>';E('oaRange').textContent=a.toLocaleDateString('it-IT',{day:'2-digit',month:'short'})+' – '+plus(a,6).toLocaleDateString('it-IT',{day:'2-digit',month:'short',year:'numeric'});for(var i=0;i<7;i++){var d=plus(a,i),k=ds(d);h+='<div class="oaWeekHead '+(k===today?'oaToday':'')+'"><div class="oaDn">'+X(d.toLocaleDateString('it-IT',{weekday:'short'}))+'</div><div class="oaDd">'+d.getDate()+'</div></div>'}h+='<div class="oaTimes" style="height:'+height+'px">';for(var hr=lo;hr<=hi;hr++)h+='<div class="oaTimeLabel" style="top:'+((hr-lo)*scale)+'px">'+z(hr)+':00</div>';h+='</div>';for(var j=0;j<7;j++){var day=plus(a,j),key=ds(day),ev=items.filter(function(x){return ds(new Date(x.starts_at))===key});h+='<div class="oaTimelineDay" style="height:'+height+'px;--oa-hour:'+scale+'px">';ev.forEach(function(x){var st=new Date(x.starts_at),en=new Date(x.ends_at),sm=st.getHours()*60+st.getMinutes(),em=en.getHours()*60+en.getMinutes(),top=((sm-lo*60)/60)*scale,eh=Math.max(30,((em-sm)/60)*scale-3);h+='<div class="oaTimedEvent" style="top:'+Math.max(0,top)+'px;height:'+eh+'px">'+eventHtml(x,true)+'</div>'});h+='</div>'}h+='</div>';E('oaCalendar').className='oaCalendar oaCalendarWeek';E('oaCalendar').innerHTML=h;bindEvents()}
function renderMonth(a){var items=filtered(),first=monthStart(S.anchor),start=mon(first),today=ds(new Date()),h='<div class="oaMonthWeekdays">';['Lun','Mar','Mer','Gio','Ven','Sab','Dom'].forEach(function(x){h+='<div>'+x+'</div>'});h+='</div><div class="oaMonthGrid">';E('oaRange').textContent=first.toLocaleDateString('it-IT',{month:'long',year:'numeric'});for(var i=0;i<42;i++){var d=plus(start,i),key=ds(d),inside=d.getMonth()===first.getMonth(),ev=items.filter(function(x){return ds(new Date(x.starts_at))===key});h+='<div class="oaMonthDay '+(inside?'':'oaMonthOutside')+' '+(key===today?'oaToday':'')+'"><div class="oaMonthDate">'+d.getDate()+'</div><div class="oaMonthEvents">'+(ev.length?ev.map(function(x){return'<button class="oaMonthEvent" data-id="'+X(x.id)+'" style="--c:'+X(x.service_color||'#1769aa')+'"><span>'+X(tm(x.starts_at))+'</span> '+X((x.last_name||'')+' '+(x.first_name||''))+'</button>'}).join(''):'')+'</div></div>'}h+='</div>';E('oaCalendar').className='oaCalendar oaCalendarMonth';E('oaCalendar').innerHTML=h;bindEvents()}
function render(){setViewButtons();var a=rangeStart();if(S.view==='month')renderMonth(a);else renderWeek(a)}'''
s=s[:start]+new_render+s[end:]

old_nav = "E('oaPrev').onclick=function(){S.week=plus(S.week,-7);load()};E('oaNext').onclick=function(){S.week=plus(S.week,7);load()};E('oaToday').onclick=function(){S.week=mon(new Date());load()};E('oaReload').onclick=function(){boot(true).then(load)};"
new_nav = "E('oaViewWeek').onclick=function(){S.view='week';S.week=mon(S.anchor||new Date());load()};E('oaViewMonth').onclick=function(){S.view='month';S.anchor=monthStart(S.anchor||new Date());load()};E('oaPrev').onclick=function(){if(S.view==='month'){S.anchor=new Date(S.anchor.getFullYear(),S.anchor.getMonth()-1,1)}else{S.week=plus(rangeStart(),-7);S.anchor=new Date(S.week)}load()};E('oaNext').onclick=function(){if(S.view==='month'){S.anchor=new Date(S.anchor.getFullYear(),S.anchor.getMonth()+1,1)}else{S.week=plus(rangeStart(),7);S.anchor=new Date(S.week)}load()};E('oaToday').onclick=function(){S.anchor=new Date();S.week=mon(new Date());load()};E('oaReload').onclick=function(){boot(true).then(load)};"
once(old_nav,new_nav,'Navigazione agenda V2')

add_head(r'''
<style id="optykerAppointmentsV2Css">/* OPTYKER_APPOINTMENTS_UI_V2 */
#oaSettings{display:none!important}.oaViewSwitch{display:flex;gap:4px;padding:3px;border:1px solid #d6e1e9;border-radius:9px;background:#f6f9fb}.oaViewSwitch .secondary{min-height:32px}.oaViewSwitch .active{background:#1769aa!important;color:#fff!important;border-color:#1769aa!important}
.oaCalendarWeek{display:block!important;overflow:auto;border:1px solid #dce5ec;border-radius:12px;background:#fff}.oaWeekGrid{display:grid;grid-template-columns:64px repeat(7,minmax(150px,1fr));min-width:1114px}.oaWeekCorner,.oaWeekHead{position:sticky;top:0;z-index:5;background:#fff;border-bottom:1px solid #dce5ec}.oaWeekCorner{left:0;z-index:7;border-right:1px solid #dce5ec}.oaWeekHead{padding:9px;text-align:center;border-right:1px solid #e5ebef}.oaWeekHead.oaToday{background:#eaf5fd}.oaTimes{position:relative;border-right:1px solid #dce5ec;background:#fbfcfd}.oaTimeLabel{position:absolute;right:8px;transform:translateY(-50%);font-size:9px;font-weight:800;color:#6c8192}.oaTimelineDay{position:relative;border-right:1px solid #e5ebef;background-image:repeating-linear-gradient(to bottom,transparent 0,transparent calc(var(--oa-hour) - 1px),#e8edf1 calc(var(--oa-hour) - 1px),#e8edf1 var(--oa-hour));background-color:#fff}.oaTimelineDay:after{content:'';position:absolute;left:0;right:0;top:calc(var(--oa-hour)/2);height:1px;background:#f0f3f5;pointer-events:none}.oaTimedEvent{position:absolute;left:4px;right:4px;z-index:2}.oaTimedEvent .oaEvent{height:100%;overflow:hidden;margin:0;padding:6px}.oaEventCompact .oaEventTime,.oaEventCompact .oaEventClient{font-size:10px}.oaEventCompact .oaEventMeta{font-size:8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.oaCalendarMonth{display:block!important;overflow:auto}.oaMonthWeekdays,.oaMonthGrid{display:grid;grid-template-columns:repeat(7,minmax(120px,1fr));min-width:840px}.oaMonthWeekdays{border:1px solid #dce5ec;border-bottom:0;border-radius:11px 11px 0 0;overflow:hidden}.oaMonthWeekdays div{padding:8px;text-align:center;background:#f7fafc;border-right:1px solid #e3e9ee;font-size:9px;font-weight:900;color:#60788c;text-transform:uppercase}.oaMonthGrid{border-left:1px solid #dce5ec;border-top:1px solid #dce5ec}.oaMonthDay{min-height:126px;padding:7px;border-right:1px solid #dce5ec;border-bottom:1px solid #dce5ec;background:#fff}.oaMonthDay.oaToday{background:#f0f8fe}.oaMonthOutside{background:#f8fafb;color:#aab5bd}.oaMonthDate{font-size:13px;font-weight:900;color:#274961;margin-bottom:5px}.oaMonthOutside .oaMonthDate{color:#aab5bd}.oaMonthEvents{display:flex;flex-direction:column;gap:4px}.oaMonthEvent{border:0;border-left:4px solid var(--c,#1769aa);border-radius:6px;background:#f7fafc;padding:5px;text-align:left;font-size:9px;font-weight:800;color:#29495f;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.oaMonthEvent span{font-weight:900;color:#17324a}
.optykerSettingsHub{max-width:920px;margin-top:16px}.optykerSettingsChooser{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px}.optykerSettingsChoice{flex:1;min-width:220px;border:1px solid #d7e2e9;border-radius:12px;background:#fff;padding:16px;text-align:left;cursor:pointer}.optykerSettingsChoice.active{border-color:#1769aa;background:#eef7fd}.optykerSettingsChoice b{display:block;font-size:15px;color:#17324a}.optykerSettingsChoice span{display:block;font-size:10px;color:#6d8191;margin-top:4px}.optykerSettingsPane{display:none}.optykerSettingsPane.open{display:block}.optykerSettingsPane .optykerSettingsCard{max-width:none;margin-top:0}.oaSettingsEmbedded{border:1px solid #dce5ec;border-radius:12px;background:#fff;padding:17px}.oaSettingsEmbeddedHead{display:flex;justify-content:space-between;gap:12px;align-items:center;padding-bottom:12px;border-bottom:1px solid #e6ebef;margin-bottom:12px}.oaSettingsEmbeddedTitle{font-size:16px;font-weight:900;color:#17324a}.oaSettingsEmbeddedSub{font-size:10px;color:#6d8191;margin-top:3px}
@media(max-width:900px){.oaWeekGrid{min-width:1000px}.oaMonthWeekdays,.oaMonthGrid{min-width:760px}}@media(max-width:650px){.optykerSettingsChoice{min-width:100%}.oaToolbar .oaViewSwitch{width:100%}.oaViewSwitch button{flex:1}}
</style>''')

add_body(r'''
<script id="optykerAppointmentsV2Js">
(function(){/* OPTYKER_APPOINTMENTS_UI_V2 */
function E(i){return document.getElementById(i)}
function buildSettingsHub(){
  var panel=E('optykerSettingsPanel');if(!panel||E('optykerSettingsHub'))return;
  var card=panel.querySelector('.optykerSettingsCard'),modal=E('oaSettingsModal'),sets=modal&&modal.querySelector('.oaSets'),status=E('oaSettingsStatus');
  if(!card||!modal||!sets||!status)return;
  var old=E('oaShortcut');if(old)old.remove();
  var sentinel=document.createElement('div');sentinel.id='oaShortcut';sentinel.style.display='none';panel.appendChild(sentinel);
  var hub=document.createElement('div');hub.id='optykerSettingsHub';hub.className='optykerSettingsHub';
  hub.innerHTML='<div id="optykerSettingsChooser" class="optykerSettingsChooser"><button id="optykerSettingsWhatsApp" class="optykerSettingsChoice" type="button"><b>WhatsApp Business</b><span>Collegamento Meta, numero, webhook e messaggistica.</span></button><button id="optykerSettingsAgenda" class="optykerSettingsChoice" type="button"><b>Agenda e prenotazioni</b><span>Servizi, durate, colori, studi e fasce di disponibilità.</span></button></div><div id="optykerSettingsWhatsAppPane" class="optykerSettingsPane"></div><div id="optykerSettingsAgendaPane" class="optykerSettingsPane"><div class="oaSettingsEmbedded"><div class="oaSettingsEmbeddedHead"><div><div class="oaSettingsEmbeddedTitle">Impostazioni agenda</div><div class="oaSettingsEmbeddedSub">Configura servizi, studi e disponibilità.</div></div></div></div></div>';
  card.parentNode.insertBefore(hub,card);E('optykerSettingsWhatsAppPane').appendChild(card);
  var agendaBox=E('optykerSettingsAgendaPane').querySelector('.oaSettingsEmbedded');agendaBox.appendChild(sets);agendaBox.appendChild(status);
  function show(which){
    E('optykerSettingsWhatsAppPane').classList.toggle('open',which==='wa');
    E('optykerSettingsAgendaPane').classList.toggle('open',which==='agenda');
    E('optykerSettingsWhatsApp').classList.toggle('active',which==='wa');
    E('optykerSettingsAgenda').classList.toggle('active',which==='agenda');
    if(which==='agenda'&&window.optykerAgendaBoot)window.optykerAgendaBoot(true).catch(function(){});
  }
  E('optykerSettingsWhatsApp').onclick=function(){show('wa')};
  E('optykerSettingsAgenda').onclick=function(){show('agenda')};
  window.optykerSettingsChoose=function(){show('')};
}
function wrapOpenSettings(){
  if(typeof window.optykerOpenSettings!=='function'||window.optykerOpenSettings.__oaV2)return;
  var old=window.optykerOpenSettings;
  var w=function(){var r=old.apply(this,arguments);setTimeout(function(){buildSettingsHub();if(window.optykerSettingsChoose)window.optykerSettingsChoose();var sub=document.querySelector('#optykerSettingsPanel .optykerSettingsSub');if(sub)sub.textContent='Scegli quale gruppo di impostazioni vuoi aprire.'},0);return r};
  w.__oaV2=true;window.optykerOpenSettings=w;
}
function boot(){buildSettingsHub();wrapOpenSettings();var sub=document.querySelector('#optykerSettingsPanel .optykerSettingsSub');if(sub)sub.textContent='Scegli quale gruppo di impostazioni vuoi aprire.'}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();setTimeout(boot,300);setTimeout(boot,1200);
})();
</script>''')

p.write_text(s,encoding='utf-8')
if MARK not in s or 'oaViewMonth' not in s or 'optykerSettingsChooser' not in s or 'oaTimelineDay' not in s:
    raise SystemExit('Agenda V2 non inserita')
print('Appointments UI V2 OK')

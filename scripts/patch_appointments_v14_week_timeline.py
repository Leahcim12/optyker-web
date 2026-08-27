from pathlib import Path

p=Path('_site/index.html')
s=p.read_text(encoding='utf-8')
MARK='OPTYKER_APPOINTMENTS_UI_V14_WEEK_TIMELINE'
if MARK in s:
    raise SystemExit(0)
if 'OPTYKER_APPOINTMENTS_UI_V13_SINGLE_SETTINGS' not in s or 'id="oaCalendar"' not in s or 'id="oaManageModal"' not in s:
    raise SystemExit('Agenda V13 / gestione appuntamenti non disponibili')

style=r'''<style id="optykerAppointmentsV14Css">/* OPTYKER_APPOINTMENTS_UI_V14_WEEK_TIMELINE */
#optykerAppointmentsPanel{background:#fff!important}
#optykerAppointmentsPanel .oaHead{align-items:center!important;padding:6px 0 10px!important;border-bottom:1px solid #d7dde2!important}
#optykerAppointmentsPanel .oaK{display:none!important}
#optykerAppointmentsPanel .oaTitle{font-size:18px!important;font-weight:800!important;color:#1f2d38!important}
#optykerAppointmentsPanel #oaRange{font-size:10px!important;color:#65727e!important;margin-top:2px!important}
#optykerAppointmentsPanel .oaActions{gap:6px!important}
#optykerAppointmentsPanel .oaActions button{min-height:36px!important;border-radius:5px!important;font-size:10px!important}
#optykerAppointmentsPanel .oaToolbar{padding:7px 0!important;gap:5px!important;border-bottom:1px solid #e1e5e8!important}
#optykerAppointmentsPanel .oaToolbar button,#optykerAppointmentsPanel .oaToolbar select{height:34px!important;min-height:34px!important;border-radius:4px!important;font-size:9px!important}
#optykerAppointmentsPanel .oaToolbar select{min-width:145px!important}
#oaCalendarModeV7{margin:7px 0 3px!important;padding:2px!important;border-radius:5px!important;background:#f7f7f7!important;border-color:#d9dde0!important}
#oaCalendarModeV7 button{padding:6px 10px!important;border-radius:3px!important;font-size:9px!important}
#oaUnifiedAgendaNoteV8{display:none!important}
#oaStoreCalendarV7>#oaCalendar{display:none!important}

.oaV14Wrap{width:100%;min-width:0;margin-top:6px;border:1px solid #cfd5da;background:#fff;box-sizing:border-box}
.oaV14Scroller{width:100%;overflow:auto;max-height:calc(100vh - 235px);min-height:560px;background:#fff}
.oaV14Head,.oaV14Body{display:grid;grid-template-columns:58px repeat(7,minmax(145px,1fr));min-width:1080px}
.oaV14Head{position:sticky;top:0;z-index:20;background:#fff;border-bottom:1px solid #cfd5da}
.oaV14Corner{height:42px;border-right:1px solid #d8dde1;background:#fafafa}
.oaV14DayHead{height:42px;box-sizing:border-box;border-right:1px solid #d8dde1;display:flex;align-items:center;justify-content:center;gap:6px;background:#fff;color:#33434f;font-size:10px;font-weight:700;text-transform:capitalize}
.oaV14DayHead.today{background:#eef5fb;color:#174d75}.oaV14DayHead .n{font-size:15px;font-weight:900}.oaV14DayHead .w{font-size:9px;font-weight:700;text-transform:uppercase;color:#6e7981}
.oaV14TimeCol,.oaV14DayBody{position:relative;height:768px;box-sizing:border-box;background-size:100% 32px;background-image:repeating-linear-gradient(to bottom,transparent 0,transparent 31px,#e3e7ea 31px,#e3e7ea 32px)}
.oaV14TimeCol{border-right:1px solid #cfd5da;background-color:#fafafa}
.oaV14DayBody{border-right:1px solid #d8dde1;background-color:#fff;cursor:crosshair}
.oaV14TimeLabel{position:absolute;right:7px;transform:translateY(-50%);font-size:8px;color:#66747f;background:#fafafa;padding:0 2px;z-index:2}
.oaV14Closed{position:absolute;left:0;right:0;background:rgba(216,219,222,.62);z-index:1;pointer-events:none}
.oaV14Closed:after{content:'';position:absolute;inset:0;background-image:repeating-linear-gradient(135deg,transparent 0,transparent 11px,rgba(120,128,135,.035) 11px,rgba(120,128,135,.035) 12px)}
.oaV14Event{position:absolute!important;z-index:5!important;box-sizing:border-box!important;margin:0!important;width:auto!important;min-width:0!important;border:1px solid color-mix(in srgb,var(--c,#7fa34b) 72%,#6f7b82)!important;border-left:4px solid var(--c,#7fa34b)!important;border-radius:1px!important;background:color-mix(in srgb,var(--c,#91b85e) 58%,white)!important;padding:4px 5px!important;box-shadow:none!important;overflow:hidden!important;text-align:left!important;color:#17220f!important}
.oaV14Event:hover{filter:brightness(.97);z-index:8!important;outline:1px solid rgba(0,0,0,.16)}
.oaV14Event:after{display:none!important}.oaV14Event .oaEventTime{font-size:8px!important;line-height:1.1!important;color:#182315!important;font-weight:800!important}.oaV14Event .oaEventClient{font-size:9px!important;line-height:1.15!important;color:#182315!important;font-weight:900!important;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.oaV14Event .oaEventMeta{font-size:7.5px!important;line-height:1.18!important;color:#263422!important;margin-top:1px!important;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.oaV14Event.oaCancelled{opacity:.42!important;text-decoration:line-through}
.oaV14Now{position:absolute;left:0;right:0;height:1px;background:#d34136;z-index:9;pointer-events:none}.oaV14Now:before{content:'';position:absolute;left:-4px;top:-3px;width:7px;height:7px;border-radius:50%;background:#d34136}
.oaV14Hint{padding:5px 8px;border-top:1px solid #e3e7ea;background:#fafafa;color:#7a858d;font-size:8px;text-align:right}

/* Finestra appuntamento più compatta, simile al riferimento */
#oaManageModal,#oaNewModal{background:rgba(0,0,0,.34)!important;padding:34px 12px!important}
#oaManageModal .oaV10Card,#oaNewModal .oaCard{width:min(760px,96vw)!important;border-radius:3px!important;border:1px solid #aeb8c2!important;padding:0!important;overflow:hidden!important;box-shadow:0 15px 38px rgba(0,0,0,.28)!important}
#oaManageModal .oaMh,#oaNewModal .oaMh{background:#2f4ca8!important;color:#fff!important;padding:8px 11px!important;margin:0 0 11px!important;min-height:32px!important}
#oaManageModal .oaMt,#oaNewModal .oaMt{color:#fff!important;font-size:12px!important;font-weight:800!important}
#oaManageModal .oaSub,#oaNewModal .oaSub{color:#e9edff!important;font-size:8px!important}
#oaManageModal .oaClose,#oaNewModal .oaClose{background:transparent!important;color:#fff!important;width:27px!important;height:27px!important;font-size:18px!important;border-radius:2px!important}
#oaManageModal #oaV10Details{display:none!important}
#oaManageModal .oaV10EditGrid,#oaNewModal .oaGrid{padding:0 13px!important;gap:7px!important}
#oaManageModal .oaV10F label,#oaNewModal .oaF label{font-size:8px!important;margin-bottom:2px!important;color:#4d5963!important}
#oaManageModal .oaV10F input,#oaManageModal .oaV10F select,#oaManageModal .oaV10F textarea,#oaNewModal .oaF input,#oaNewModal .oaF select,#oaNewModal .oaF textarea{min-height:34px!important;height:34px!important;border-radius:2px!important;border-color:#bfc7cd!important;padding:5px 6px!important;font-size:10px!important}
#oaManageModal .oaV10F textarea,#oaNewModal .oaF textarea{height:58px!important;min-height:58px!important}
#oaManageModal .oaV10Availability{margin-top:2px!important;padding-top:8px!important}
#oaManageModal .oaV10Label{font-size:9px!important;margin-bottom:4px!important}.oaV10Help{font-size:8px!important}
#oaManageModal .oaV10Time,#oaManageModal .oaV10Studio,#oaNewModal .oaSlot{border-radius:3px!important;padding:6px 8px!important;font-size:8px!important}
#oaManageModal .oaV10Status,#oaNewModal .oaStatus{padding:0 13px!important;font-size:8px!important}
#oaManageModal .oaV10Bottom,#oaNewModal .oaBottom{padding:10px 13px 12px!important;margin:0!important}
#oaManageModal .oaV10Bottom button,#oaNewModal .oaBottom button{min-height:32px!important;border-radius:3px!important;font-size:9px!important;padding:0 12px!important}

@media(max-width:900px){.oaV14Scroller{max-height:none}.oaV14Head,.oaV14Body{min-width:1020px}}
</style>'''

script=r'''<script id="optykerAppointmentsV14Js">(function(){/* OPTYKER_APPOINTMENTS_UI_V14_WEEK_TIMELINE */
var START=8*60,END=20*60,PPM=768/(12*60),hours=null,busy=false,timer=0;
var MONTHS={gen:0,feb:1,mar:2,apr:3,mag:4,giu:5,lug:6,ago:7,set:8,ott:9,nov:10,dic:11};
function E(i){return document.getElementById(i)}
function mins(t){var m=String(t||'').match(/(\d{1,2}):(\d{2})/);return m?(+m[1])*60+(+m[2]):null}
function clamp(n,a,b){return Math.max(a,Math.min(b,n))}
function px(m){return (m-START)*PPM}
function getColor(el){return el.style.getPropertyValue('--c')||'#91b85e'}
function sourceDays(){var c=E('oaCalendar');return c?Array.from(c.children).filter(function(x){return x.classList&&x.classList.contains('oaDay')}):[]}
function parseRange(){
  var t=String(E('oaRange')&&E('oaRange').textContent||'').toLowerCase().replace(/\./g,'').trim();
  var m=t.match(/(\d{1,2})\s+([a-zà]+)\s+(\d{4})\s*$/i);if(!m)return null;
  var mon=MONTHS[m[2].slice(0,3)];if(mon==null)return null;
  var end=new Date(+m[3],mon,+m[1],12,0,0,0);var start=new Date(end);start.setDate(end.getDate()-6);return start
}
function iso(d){var z=function(n){return String(n).padStart(2,'0')};return d.getFullYear()+'-'+z(d.getMonth()+1)+'-'+z(d.getDate())}
function defaultHours(day){return day===7?{weekday:7,active:false,start_time:'',end_time:'',start_time_2:'',end_time_2:''}:{weekday:day,active:true,start_time:'09:00',end_time:'13:00',start_time_2:'15:00',end_time_2:'19:00'}}
function loadHours(){
  if(!window.OPTYKER_CLOUD||!OPTYKER_CLOUD.username||!OPTYKER_CLOUD.password)return Promise.resolve();
  var c=OPTYKER_CLOUD;
  return fetch(c.root+'/rest/v1/rpc/optyker_agenda_v6_api',{method:'POST',headers:{'Content-Type':'application/json','apikey':c.key,'Authorization':'Bearer '+c.key},body:JSON.stringify({p_username:c.username,p_password:c.password,p_action:'store_hours_list',p_payload:{}})}).then(function(r){if(!r.ok)throw Error('Server '+r.status);return r.json()}).then(function(x){if(x&&x.ok!==false)hours=x.data||[]}).catch(function(){})
}
function dayHours(day){var h=(hours||[]).find(function(x){return +x.weekday===day});return h||defaultHours(day)}
function closedSegments(day){
  var h=dayHours(day),opens=[];
  if(h.active!==false){
    var a=mins(h.start_time),b=mins(h.end_time),c=mins(h.start_time_2),d=mins(h.end_time_2);
    if(a!=null&&b!=null&&b>a)opens.push([a,b]);if(c!=null&&d!=null&&d>c)opens.push([c,d])
  }
  opens=opens.map(function(x){return[clamp(x[0],START,END),clamp(x[1],START,END)]}).filter(function(x){return x[1]>x[0]}).sort(function(a,b){return a[0]-b[0]});
  var seg=[],cur=START;opens.forEach(function(x){if(x[0]>cur)seg.push([cur,x[0]]);cur=Math.max(cur,x[1])});if(cur<END)seg.push([cur,END]);if(!opens.length)seg=[[START,END]];return seg
}
function eventData(src){
  var tt=src.querySelector('.oaEventTime'),m=String(tt&&tt.textContent||'').match(/(\d{1,2}:\d{2}).*?(\d{1,2}:\d{2})/);
  var a=m?mins(m[1]):START,b=m?mins(m[2]):a+30;if(b<=a)b=a+30;
  return{src:src,start:a,end:b,col:0,cols:1}
}
function layout(items){
  items.sort(function(a,b){return a.start-b.start||a.end-b.end});
  var active=[],cluster=[],clusterMax=1;
  function finish(){cluster.forEach(function(x){x.cols=clusterMax});cluster=[];clusterMax=1}
  items.forEach(function(it){
    active=active.filter(function(x){return x.end>it.start});
    if(!active.length&&cluster.length)finish();
    var used={};active.forEach(function(x){used[x.col]=1});var col=0;while(used[col])col++;
    it.col=col;active.push(it);cluster.push(it);clusterMax=Math.max(clusterMax,active.length,col+1)
  });if(cluster.length)finish();return items
}
function timeColumn(){
  var h='<div class="oaV14TimeCol">';for(var m=START;m<=END;m+=60){var hr=Math.floor(m/60);h+='<div class="oaV14TimeLabel" style="top:'+((m-START)*PPM)+'px">'+String(hr).padStart(2,'0')+':00</div>'}return h+'</div>'
}
function header(days){
  var h='<div class="oaV14Head"><div class="oaV14Corner"></div>';
  days.forEach(function(d){var dn=d.querySelector('.oaDn'),dd=d.querySelector('.oaDd');h+='<div class="oaV14DayHead '+(d.classList.contains('oaToday')?'today':'')+'"><span class="w">'+String(dn&&dn.textContent||'')+'</span><span class="n">'+String(dd&&dd.textContent||'')+'</span></div>'});
  return h+'</div>'
}
function makeDay(day,idx,date){
  var out=document.createElement('div');out.className='oaV14DayBody';out.dataset.day=String(idx+1);if(date)out.dataset.date=date;
  closedSegments(idx+1).forEach(function(s){var x=document.createElement('div');x.className='oaV14Closed';x.style.top=px(s[0])+'px';x.style.height=Math.max(0,(s[1]-s[0])*PPM)+'px';out.appendChild(x)});
  var items=layout(Array.from(day.querySelectorAll('.oaEvent')).map(eventData));
  items.forEach(function(it){
    var c=it.src.cloneNode(true);c.classList.add('oaV14Event');c.style.setProperty('--c',getColor(it.src));
    var gap=3,left=(it.col/it.cols)*100,right=((it.cols-it.col-1)/it.cols)*100;
    c.style.left='calc('+left+'% + '+gap+'px)';c.style.right='calc('+right+'% + '+gap+'px)';
    c.style.top=clamp(px(it.start),0,768)+'px';c.style.height=Math.max(24,(clamp(it.end,START,END)-clamp(it.start,START,END))*PPM-2)+'px';
    c.onclick=function(ev){ev.preventDefault();ev.stopPropagation();it.src.click()};out.appendChild(c)
  });
  if(day.classList.contains('oaToday')){var now=new Date(),m=now.getHours()*60+now.getMinutes();if(m>=START&&m<=END){var n=document.createElement('div');n.className='oaV14Now';n.style.top=px(m)+'px';out.appendChild(n)}}
  out.ondblclick=function(ev){if(ev.target.closest&&ev.target.closest('.oaV14Event'))return;var b=E('oaNew');if(!b)return;b.click();var dt=out.dataset.date;if(dt)setTimeout(function(){var x=E('oaDate');if(x){x.value=dt;x.dispatchEvent(new Event('change',{bubbles:true}))}},80)};
  return out
}
function build(){
  if(busy)return;var src=E('oaCalendar'),store=E('oaStoreCalendarV7');if(!src||!store)return;var days=sourceDays();if(days.length!==7)return;
  busy=true;
  try{
    var wrap=E('oaWeekGridV14');if(!wrap){wrap=document.createElement('div');wrap.id='oaWeekGridV14';wrap.className='oaV14Wrap';src.insertAdjacentElement('afterend',wrap)}
    var start=parseRange(),dates=[];for(var i=0;i<7;i++){if(start){var d=new Date(start);d.setDate(start.getDate()+i);dates.push(iso(d))}else dates.push('')}
    wrap.innerHTML='<div class="oaV14Scroller">'+header(days)+'<div class="oaV14Body">'+timeColumn()+'</div><div class="oaV14Hint">Doppio clic su uno spazio libero per creare un appuntamento</div></div>';
    var body=wrap.querySelector('.oaV14Body');days.forEach(function(day,i){body.appendChild(makeDay(day,i,dates[i]))})
  }finally{busy=false}
}
function schedule(){clearTimeout(timer);timer=setTimeout(build,45)}
function boot(){
  var src=E('oaCalendar');if(!src)return;
  if(!src.__v14Obs){src.__v14Obs=true;new MutationObserver(schedule).observe(src,{subtree:true,childList:true,characterData:true})}
  loadHours().then(build);schedule()
}
document.addEventListener('click',function(ev){var b=ev.target&&ev.target.closest?ev.target.closest('#navAppointments,#oaPrev,#oaNext,#oaToday,#oaReload'):null;if(b)setTimeout(function(){loadHours().then(build)},180)},true);
document.addEventListener('change',function(ev){if(ev.target&&ev.target.closest&&ev.target.closest('#oaOpFilter'))setTimeout(build,70)},true);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setTimeout(boot,300)});else setTimeout(boot,300);
window.addEventListener('pageshow',function(){setTimeout(boot,350)});
setInterval(function(){var p=E('optykerAppointmentsPanel');if(p&&getComputedStyle(p).display!=='none')build()},60000);
})();</script>'''

h=s.find('</head>')
if h<0: raise SystemExit('head non trovato')
s=s[:h]+style+s[h:]
b=s.rfind('</body>')
if b<0: raise SystemExit('body non trovato')
s=s[:b]+script+s[b:]
p.write_text(s,encoding='utf-8')
for req in [MARK,'oaWeekGridV14','oaV14Closed','oaV14Event','Doppio clic']:
    if req not in s: raise SystemExit('Agenda V14 incompleta: '+req)
print('Appointments V14 weekly timeline OK')

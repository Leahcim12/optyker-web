from pathlib import Path

p=Path('_site/index.html')
s=p.read_text(encoding='utf-8')
MARK='OPTYKER_APPOINTMENT_SEARCH_V17'
if MARK in s:
    raise SystemExit(0)
if 'OPTYKER_APPOINTMENTS_UI_V10_MANAGE' not in s or 'id="optykerAppointmentsPanel"' not in s:
    raise SystemExit('Agenda gestione appuntamenti non disponibile')

style=r'''<style id="optykerAppointmentSearchV17Css">/* OPTYKER_APPOINTMENT_SEARCH_V17 */
.oa17SearchWrap{position:relative;display:flex;align-items:center;gap:8px;margin:7px 0 5px;max-width:520px}
.oa17Search{width:100%;height:38px;border:1px solid #cbd7df;border-radius:9px;background:#fff;padding:0 38px 0 12px;font-size:10px;color:#17324a;box-sizing:border-box}
.oa17Search:focus{outline:none;border-color:#6f9dcc;box-shadow:0 0 0 3px rgba(23,105,170,.09)}
.oa17SearchIcon{position:absolute;right:12px;color:#718493;font-size:14px;pointer-events:none}
.oa17Results{position:absolute;left:0;right:0;top:43px;z-index:129000;display:none;max-height:330px;overflow:auto;border:1px solid #cfdbe3;border-radius:10px;background:#fff;box-shadow:0 12px 30px rgba(25,50,68,.18)}
.oa17Results.open{display:block}
.oa17Result{display:block;width:100%;border:0;border-bottom:1px solid #e7ecef;background:#fff;text-align:left;padding:10px 11px;cursor:pointer}
.oa17Result:last-child{border-bottom:0}.oa17Result:hover{background:#f3f8fc}
.oa17ResultName{font-size:10px;font-weight:900;color:#17324a}.oa17ResultMeta{font-size:8px;color:#687d8c;margin-top:3px;display:flex;gap:7px;flex-wrap:wrap}
.oa17Empty{padding:14px;text-align:center;font-size:9px;color:#81909a}
</style>'''

script=r'''<script id="optykerAppointmentSearchV17Js">(function(){/* OPTYKER_APPOINTMENT_SEARCH_V17 */
var API='https://whgziwaegjzqsgcntesr.supabase.co/functions/v1/optyker-appointments-staff',timer=0,last='';
function E(i){return document.getElementById(i)}
function X(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function dt(v){try{return new Intl.DateTimeFormat('it-IT',{timeZone:'Europe/Rome',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(v))}catch(e){return String(v||'')}}
function auth(){if(!window.OPTYKER_CLOUD||!OPTYKER_CLOUD.username||!OPTYKER_CLOUD.password)throw Error('Sessione non autenticata');return OPTYKER_CLOUD}
function call(q){var c=auth();return fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:c.username,password:c.password,action:'search',payload:{query:q,limit:30}})}).then(function(r){return r.json().then(function(x){if(!r.ok||!x||x.ok===false)throw Error(x&&x.error||('Server '+r.status));return x})})}
function close(){var r=E('oa17Results');if(r)r.classList.remove('open')}
function render(a){var box=E('oa17Results');if(!box)return;box.innerHTML=(a||[]).length?(a||[]).map(function(x){return '<button class="oa17Result" type="button" data-id="'+X(x.id)+'"><div class="oa17ResultName">'+X((x.first_name||'')+' '+(x.last_name||''))+'</div><div class="oa17ResultMeta"><span>'+X(x.service_name||'Appuntamento')+'</span><span>'+X(dt(x.starts_at))+'</span><span>'+X(x.studio_name||'')+'</span></div></button>'}).join(''):'<div class="oa17Empty">Nessun appuntamento trovato.</div>';box.classList.add('open');box.querySelectorAll('.oa17Result').forEach(function(b){b.onclick=function(){close();var id=b.dataset.id;if(window.optykerOpenAppointmentById)window.optykerOpenAppointmentById(id)}})}
function search(){var q=String(E('oa17Search')&&E('oa17Search').value||'').trim();if(q.length<2){close();return}if(q===last)return;last=q;call(q).then(function(x){render(x.data||[])}).catch(function(e){var box=E('oa17Results');if(box){box.innerHTML='<div class="oa17Empty">'+X(e.message)+'</div>';box.classList.add('open')}})}
function mount(){
  var panel=E('optykerAppointmentsPanel');if(!panel||E('oa17SearchWrap'))return;
  var anchor=E('oaCalendarModeV7')||panel.querySelector('.oaToolbar')||panel.querySelector('.oaHead');if(!anchor)return;
  var w=document.createElement('div');w.id='oa17SearchWrap';w.className='oa17SearchWrap';w.innerHTML='<input id="oa17Search" class="oa17Search" type="search" autocomplete="off" placeholder="Cerca appuntamento per nome o cognome cliente"><span class="oa17SearchIcon">⌕</span><div id="oa17Results" class="oa17Results"></div>';
  anchor.insertAdjacentElement('afterend',w);
  E('oa17Search').addEventListener('input',function(){clearTimeout(timer);last='';timer=setTimeout(search,280)});
  E('oa17Search').addEventListener('focus',function(){if(this.value.trim().length>=2)search()});
  document.addEventListener('click',function(ev){if(!w.contains(ev.target))close()})
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setTimeout(mount,300)});else setTimeout(mount,300);
window.addEventListener('pageshow',function(){setTimeout(mount,200)});
new MutationObserver(function(){if(!E('oa17SearchWrap'))setTimeout(mount,50)}).observe(document.documentElement,{subtree:true,childList:true});
})();</script>'''

h=s.find('</head>')
if h<0: raise SystemExit('head non trovato')
s=s[:h]+style+s[h:]
b=s.rfind('</body>')
if b<0: raise SystemExit('body non trovato')
s=s[:b]+script+s[b:]
p.write_text(s,encoding='utf-8')
for req in [MARK,'Cerca appuntamento per nome o cognome cliente','action:\'search\'','optykerOpenAppointmentById']:
    if req not in s: raise SystemExit('Ricerca appuntamenti V17 incompleta: '+req)
print('Appointment search V17 OK')

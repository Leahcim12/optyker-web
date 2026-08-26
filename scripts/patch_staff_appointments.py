from pathlib import Path
import re

p=Path('_site/staff-embed/index.html')
s=p.read_text(encoding='utf-8')
MARK='OPTYKER_STAFF_APPOINTMENTS_V1'
if MARK in s:
    raise SystemExit(0)
if 'optyker-shopify-staff-embed' not in s or 'id="tabClients"' not in s:
    raise SystemExit('Area operatore Shopify non trovata')

s=s.replace('<button id="tabClients" type="button">Clienti</button>','<button id="tabClients" type="button">Clienti</button><button id="tabAgenda" type="button">Agenda</button>',1)

panel='''<section id="panelAgenda" class="panel"><div class="saHead"><div><h1 class="title">Agenda appuntamenti</h1><div id="saRange" class="sub">Calendario condiviso con Optyker e app.</div></div><div class="saActions"><button id="saPrev" class="secondary" type="button">‹</button><button id="saToday" class="secondary" type="button">Oggi</button><button id="saNext" class="secondary" type="button">›</button><button id="saNew" class="primary" type="button">+ Nuovo appuntamento</button></div></div><div id="saStatus" class="sub"></div><div id="saCalendar" class="saCalendar"><div class="empty">Caricamento agenda…</div></div><div id="saBookWrap" class="saBookWrap"><div class="saBookHead"><b>Nuovo appuntamento</b><button id="saBookClose" class="secondary" type="button">Chiudi</button></div><iframe id="saBookFrame" title="Prenota appuntamento"></iframe></div></section>'''
s=s.replace('</main></div>',panel+'</main></div>',1)

css='''<style id="staffAppointmentsCss">/* OPTYKER_STAFF_APPOINTMENTS_V1 */
.saHead{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.saActions{display:flex;gap:7px;flex-wrap:wrap}.saCalendar{display:grid;grid-template-columns:repeat(7,minmax(150px,1fr));gap:7px;overflow-x:auto}.saDay{min-height:430px;border:1px solid var(--l);border-radius:11px;background:#f8fafc;overflow:hidden}.saDayHead{padding:9px;background:#fff;border-bottom:1px solid var(--l)}.saToday .saDayHead{background:#eaf5fd}.saDn{font-size:9px;color:#718494;font-weight:900;text-transform:uppercase}.saDd{font-size:19px;font-weight:900}.saEvents{padding:6px}.saEvent{width:100%;border:0;border-left:5px solid var(--c,#1769aa);background:#fff;border-radius:8px;padding:8px;margin-bottom:6px;text-align:left;box-shadow:0 1px 4px #17324a14;cursor:pointer}.saEventTime,.saEventClient{font-size:11px;font-weight:900;color:#17324a}.saEventMeta{font-size:9px;color:#6d8291;line-height:1.4;margin-top:2px}.saCancelled{opacity:.45}.saBookWrap{display:none;margin-top:15px;border:1px solid var(--l);border-radius:13px;overflow:hidden;background:#fff}.saBookWrap.open{display:block}.saBookHead{display:flex;justify-content:space-between;align-items:center;padding:10px 12px;border-bottom:1px solid var(--l);background:#fbfcfd}.saBookWrap iframe{display:block;width:100%;height:760px;border:0;background:#fff}@media(max-width:820px){.saHead{flex-direction:column}.saCalendar{grid-template-columns:repeat(7,180px)}.saBookWrap iframe{height:680px}}
</style>'''
h=s.find('</head>')
if h<0: raise SystemExit('head non trovato')
s=s[:h]+css+s[h:]

js=r'''<script id="staffAppointmentsJs">(function(){/* OPTYKER_STAFF_APPOINTMENTS_V1 */
const APPT_API='https://whgziwaegjzqsgcntesr.supabase.co/functions/v1/optyker-shopify-staff-appointments';
const BOOK_URL='https://whgziwaegjzqsgcntesr.supabase.co/functions/v1/optyker-appointments-booking?source=shopify';
let saWeek=null,saRows=[],saLoaded=false;
const oldShowTab=window.showTab;
function mon(d){const x=new Date(d||new Date()),q=(x.getDay()+6)%7;x.setHours(0,0,0,0);x.setDate(x.getDate()-q);return x}
function plus(d,n){const x=new Date(d);x.setDate(x.getDate()+n);return x}
function key(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
function tm(v){return new Date(v).toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'})}
async function apptApi(action,payload={}){const r=await fetch(APPT_API+'?t='+encodeURIComponent(TOKEN),{method:'POST',headers:{'content-type':'application/json'},cache:'no-store',body:JSON.stringify({action,payload})});const x=await r.json().catch(()=>({ok:false,error:'Risposta non valida'}));if(!r.ok||x?.ok===false)throw Error(x?.error||'Errore agenda');return x}
function saStatus(t,b=false){const e=$('saStatus');if(e){e.textContent=t||'';e.style.color=b?'#b42323':''}}
function renderAgenda(){if(!saWeek)saWeek=mon(new Date());const today=key(new Date());$('saRange').textContent=saWeek.toLocaleDateString('it-IT',{day:'2-digit',month:'short'})+' – '+plus(saWeek,6).toLocaleDateString('it-IT',{day:'2-digit',month:'short',year:'numeric'})+' · calendario condiviso';let h='';for(let i=0;i<7;i++){const d=plus(saWeek,i),k=key(d),a=saRows.filter(x=>key(new Date(x.starts_at))===k);h+='<div class="saDay '+(k===today?'saToday':'')+'"><div class="saDayHead"><div class="saDn">'+esc(d.toLocaleDateString('it-IT',{weekday:'short'}))+'</div><div class="saDd">'+d.getDate()+'</div></div><div class="saEvents">'+(a.length?a.map(x=>'<button class="saEvent '+(x.status==='cancelled'?'saCancelled':'')+'" style="--c:'+esc(x.service_color||'#1769aa')+'" data-a="'+esc(x.id)+'"><div class="saEventTime">'+esc(tm(x.starts_at))+'–'+esc(tm(x.ends_at))+'</div><div class="saEventClient">'+esc(((x.last_name||'')+' '+(x.first_name||'')).trim())+'</div><div class="saEventMeta">'+esc(x.service_name)+' · '+esc(x.operator_username)+' · '+esc(x.studio_name)+'<br>'+esc(x.phone||'')+'</div></button>').join(''):'<div class="empty">Nessun appuntamento</div>')+'</div></div>'}$('saCalendar').innerHTML=h;$('saCalendar').querySelectorAll('[data-a]').forEach(b=>b.onclick=async()=>{const a=saRows.find(x=>x.id===b.dataset.a);const v=prompt('Stato: confermato / completato / annullato / assente',a?.status||'confirmed');if(v===null)return;const q=v.toLowerCase(),st=q.startsWith('complet')?'completed':q.startsWith('annull')?'cancelled':q.startsWith('ass')?'no_show':'confirmed';try{await apptApi('status',{id:a.id,status:st});await loadAgenda()}catch(e){alert(e.message)}})}
async function loadAgenda(){if(!saWeek)saWeek=mon(new Date());saStatus('Caricamento…');try{const x=await apptApi('list',{from:saWeek.toISOString(),to:plus(saWeek,7).toISOString()});saRows=x.data||[];renderAgenda();saStatus('')}catch(e){saStatus(e.message,true)}}
window.showTab=function(t){if(t==='agenda'){document.querySelectorAll('.panel').forEach(x=>x.classList.remove('active'));document.querySelectorAll('.nav button').forEach(x=>x.classList.remove('active'));$('panelAgenda').classList.add('active');$('tabAgenda').classList.add('active');if(!saLoaded){saLoaded=true;loadAgenda()}return}if(oldShowTab)oldShowTab(t);$('panelAgenda').classList.remove('active');$('tabAgenda').classList.remove('active')};
$('tabAgenda').onclick=()=>window.showTab('agenda');$('saPrev').onclick=()=>{saWeek=plus(saWeek,-7);loadAgenda()};$('saNext').onclick=()=>{saWeek=plus(saWeek,7);loadAgenda()};$('saToday').onclick=()=>{saWeek=mon(new Date());loadAgenda()};$('saNew').onclick=()=>{$('saBookFrame').src=BOOK_URL+'&_='+Date.now();$('saBookWrap').classList.add('open')};$('saBookClose').onclick=()=>{$('saBookWrap').classList.remove('open');$('saBookFrame').src='';loadAgenda()};
})();</script>'''
b=s.rfind('</body>')
if b<0: raise SystemExit('body non trovato')
s=s[:b]+js+s[b:]
p.write_text(s,encoding='utf-8')
print('Shopify staff agenda OK')

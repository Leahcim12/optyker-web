from pathlib import Path

p=Path('_site/index.html')
s=p.read_text(encoding='utf-8')
MARK='OPTYKER_SHIFTS_MONTHLY_V16'
if MARK in s:
    raise SystemExit(0)
if 'OPTYKER_APPOINTMENTS_UI_V7' not in s or 'id="optykerAppointmentsPanel"' not in s:
    raise SystemExit('Turni Agenda V7 non disponibili')

style=r'''<style id="optykerShiftsMonthlyV16Css">/* OPTYKER_SHIFTS_MONTHLY_V16 */
#oaShiftCalendarV7.open{display:block!important}
#oaShiftCalendarV7>.oaShiftToolbarV7,
#oaShiftCalendarV7>.oaShiftDayTitleV7,
#oaShiftCalendarV7>.oaLegendV7,
#oaShiftCalendarV7>#oaShiftGridV7,
#oaShiftCalendarV7>#oaShiftStatusV7{display:none!important}

.oa16{margin-top:8px}
.oa16Top{display:flex;align-items:flex-end;gap:10px;flex-wrap:wrap;padding:11px 0 14px;border-bottom:1px solid #e3e9ee}
.oa16Field{display:flex;flex-direction:column;gap:4px}.oa16Field>span{font-size:8px;font-weight:900;text-transform:uppercase;color:#72808a;letter-spacing:.03em}
.oa16Field select,.oa16Field input{height:38px;border:1px solid #ccd6dd;border-radius:8px;background:#fff;color:#203746;padding:0 10px;box-sizing:border-box;font-size:10px;font-weight:750}
.oa16View{width:150px}.oa16Month{width:180px}.oa16StoreSel{width:190px}
.oa16MonthWrap{display:flex;align-items:center;gap:5px}.oa16Nav,.oa16IconBtn,.oa16Export{height:38px;border:1px solid #cbd6de;border-radius:8px;background:#fff;color:#294a61;font-size:10px;font-weight:900;cursor:pointer;padding:0 12px}
.oa16Nav{width:38px;padding:0;font-size:17px}.oa16IconBtn{margin-left:auto}.oa16Export{color:#174f9b;border-color:#b8cbed}
.oa16IconBtn:hover,.oa16Nav:hover,.oa16Export:hover{background:#f3f7fa}

.oa16Section{margin-top:22px}
.oa16SectionHead{display:flex;justify-content:space-between;align-items:flex-end;gap:12px;margin-bottom:8px}
.oa16SectionTitle{font-size:16px;font-weight:900;color:#204a91}.oa16SectionSub{font-size:9px;color:#77858e;margin-top:2px}
.oa16Legend{display:flex;gap:10px;flex-wrap:wrap;justify-content:flex-end;font-size:8px;color:#566873}
.oa16Legend span{display:inline-flex;align-items:center;gap:5px;white-space:nowrap}.oa16Sw{width:18px;height:18px;border:1px solid #bcc8cf;border-radius:5px;background:#fff;box-sizing:border-box}
.oa16Sw.closed{background:#f0f1f2;color:#8c959b}.oa16Sw.extra{background:#edf5ff;border-color:#4a8fe7}.oa16Sw.vacation{background:#fff8d9;border-color:#f0c638}.oa16Sw.permission{background:#fff0df;border-color:#f0a04b}.oa16Sw.sick{background:#ffe3e3;border-color:#e86868}.oa16Sw.other{background:#e8f1ff;border-color:#5c8fd8}.oa16Sw.rest{background:#eef1f4;border-color:#98a5af}

.oa16GridWrap{border:1px solid #d9e0e5;border-radius:12px;overflow:auto;background:#fff;box-shadow:0 2px 10px rgba(26,52,69,.035);max-width:100%}
.oa16Grid{display:grid;min-width:max-content}
.oa16StoreGrid{--oa16-rowh:68px}.oa16UsersGrid{--oa16-rowh:70px}
.oa16Corner,.oa16DayHead,.oa16RowHead,.oa16Cell{box-sizing:border-box;border-right:1px solid #e1e6ea;border-bottom:1px solid #e1e6ea}
.oa16Corner{position:sticky;left:0;top:0;z-index:8;width:210px;height:42px;background:#f7f9fa}
.oa16DayHead{position:sticky;top:0;z-index:7;width:104px;height:42px;display:flex;align-items:center;justify-content:center;gap:4px;background:#f7f9fa;color:#263944;font-size:9px;font-weight:900}
.oa16DayHead.today{background:#eaf3ff;color:#174f9b}.oa16DayHead.sun{background:#f3f3f3;color:#8a9298}.oa16DayHead .d{font-size:13px;font-weight:900}.oa16DayHead .w{font-size:8px;text-transform:lowercase;color:#6e7b84}
.oa16RowHead{position:sticky;left:0;z-index:6;width:210px;min-height:var(--oa16-rowh);display:flex;align-items:center;padding:10px;background:#fff;color:#172d3b;font-size:10px;font-weight:900}
.oa16Cell{position:relative;width:104px;min-height:var(--oa16-rowh);display:flex;align-items:center;justify-content:center;text-align:center;padding:6px;background:#fff;color:#263944;font-size:9px;line-height:1.45;white-space:normal}
.oa16Cell.clickable{cursor:pointer}.oa16Cell.clickable:hover{outline:2px solid #83aee0;outline-offset:-2px;z-index:3}
.oa16Cell.closed{background:#f2f3f4;color:#9ba3a8;font-size:16px}.oa16Cell.default{background:#fff}.oa16Cell.extra{background:#edf5ff;box-shadow:inset 0 0 0 1px #4a8fe7}.oa16Cell.vacation{background:#fff8d9;box-shadow:inset 0 0 0 1px #efc83e}.oa16Cell.permission{background:#fff0df;box-shadow:inset 0 0 0 1px #ef9e49}.oa16Cell.sick{background:#ffe3e3;box-shadow:inset 0 0 0 1px #e66a6a}.oa16Cell.other{background:#e8f1ff;box-shadow:inset 0 0 0 1px #5c8fd8}.oa16Cell.rest{background:#eef1f4;color:#64717a}
.oa16Cell .status{font-size:8px;font-weight:900;text-transform:uppercase;letter-spacing:.02em}.oa16Cell .times{font-size:9px;font-weight:800}.oa16Cell .note{font-size:7px;color:#6f7b84;margin-top:2px;overflow:hidden;text-overflow:ellipsis;max-width:90px}
.oa16TodayCol{box-shadow:inset 2px 0 0 rgba(34,108,196,.22),inset -2px 0 0 rgba(34,108,196,.22)}
.oa16Loading{padding:28px;text-align:center;color:#75858f;font-size:10px}.oa16Status{font-size:9px;min-height:16px;margin-top:7px;color:#647783}.oa16Status.bad{color:#b42323}

#oa16Edit{z-index:127500}
#oa16Edit .oa16EditCard{width:min(620px,96vw);background:#fff;border:1px solid #cfd9e0;border-radius:14px;box-shadow:0 20px 60px rgba(19,45,63,.25);overflow:hidden}
.oa16EditHead{display:flex;justify-content:space-between;align-items:center;padding:13px 15px;background:#204a91;color:#fff}.oa16EditTitle{font-size:14px;font-weight:900}.oa16EditSub{font-size:9px;color:#dce8f9;margin-top:2px}.oa16EditClose{width:31px;height:31px;border:0;border-radius:7px;background:#ffffff1c;color:#fff;font-size:20px;cursor:pointer}
.oa16EditBody{padding:14px}.oa16EditGrid{display:grid;grid-template-columns:1fr 1fr;gap:9px}.oa16EditF{display:flex;flex-direction:column;gap:4px}.oa16EditF.full{grid-column:1/-1}.oa16EditF span{font-size:8px;font-weight:900;text-transform:uppercase;color:#617380}.oa16EditF input,.oa16EditF select,.oa16EditF textarea{width:100%;box-sizing:border-box;border:1px solid #cbd6de;border-radius:8px;background:#fff;min-height:39px;padding:7px 9px;font-size:10px;color:#213845}.oa16EditF textarea{min-height:72px;resize:vertical}
.oa16EditTimes{grid-column:1/-1;display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:7px}
.oa16EditActions{display:flex;justify-content:space-between;gap:8px;padding:12px 14px;border-top:1px solid #e1e7eb;background:#fafcfd}.oa16EditActions .left,.oa16EditActions .right{display:flex;gap:7px}.oa16EditActions button{height:38px;border-radius:8px;padding:0 13px;font-size:9px;font-weight:900;cursor:pointer}.oa16Clear{border:1px solid #cbd6de;background:#fff;color:#536a79}.oa16Cancel{border:1px solid #cbd6de;background:#fff;color:#536a79}.oa16Save{border:0;background:#204a91;color:#fff}
.oa16EditMsg{padding:0 14px 10px;font-size:9px;color:#657985}.oa16EditMsg.bad{color:#b42323}

@media(max-width:780px){.oa16Top{align-items:stretch}.oa16Field,.oa16Field select,.oa16Field input,.oa16View,.oa16Month,.oa16StoreSel{width:100%}.oa16MonthWrap{width:100%}.oa16MonthWrap input{flex:1}.oa16IconBtn{margin-left:0}.oa16SectionHead{align-items:flex-start;flex-direction:column}.oa16Legend{justify-content:flex-start}.oa16EditGrid{grid-template-columns:1fr}.oa16EditF.full,.oa16EditTimes{grid-column:auto}.oa16EditTimes{grid-template-columns:1fr 1fr}.oa16EditActions{flex-direction:column}.oa16EditActions .left,.oa16EditActions .right{width:100%}.oa16EditActions button{flex:1}}
</style>'''

html=r'''<div id="oa16Edit" class="oaModal"><div class="oa16EditCard"><div class="oa16EditHead"><div><div class="oa16EditTitle">Modifica turno</div><div id="oa16EditSub" class="oa16EditSub"></div></div><button id="oa16EditClose" class="oa16EditClose" type="button">×</button></div><div class="oa16EditBody"><div class="oa16EditGrid"><label class="oa16EditF full"><span>Stato</span><select id="oa16Status"><option value="work">Turno di lavoro</option><option value="vacation">Ferie</option><option value="permission">Permesso</option><option value="sick">Malattia</option><option value="rest">Giorno di riposo</option><option value="other">Altro</option></select></label><div id="oa16Times" class="oa16EditTimes"><label class="oa16EditF"><span>Inizio 1</span><input id="oa16S1" type="time"></label><label class="oa16EditF"><span>Fine 1</span><input id="oa16E1" type="time"></label><label class="oa16EditF"><span>Inizio 2</span><input id="oa16S2" type="time"></label><label class="oa16EditF"><span>Fine 2</span><input id="oa16E2" type="time"></label></div><label class="oa16EditF full"><span>Note</span><textarea id="oa16Notes" placeholder="Nota facoltativa"></textarea></label></div></div><div id="oa16EditMsg" class="oa16EditMsg"></div><div class="oa16EditActions"><div class="left"><button id="oa16Clear" class="oa16Clear" type="button">Ripristina predefinito</button></div><div class="right"><button id="oa16Cancel" class="oa16Cancel" type="button">Annulla</button><button id="oa16Save" class="oa16Save" type="button">Salva</button></div></div></div></div><div id="oa16StoreEdit" class="oaModal"><div class="oa16EditCard"><div class="oa16EditHead"><div><div class="oa16EditTitle">Orari punto vendita</div><div id="oa16StoreSub" class="oa16EditSub"></div></div><button id="oa16StoreClose" class="oa16EditClose" type="button">×</button></div><div class="oa16EditBody"><div class="oa16EditGrid"><label class="oa16EditF full"><span>Stato</span><select id="oa16StoreActive"><option value="true">Aperto</option><option value="false">Chiuso</option></select></label><div id="oa16StoreTimes" class="oa16EditTimes"><label class="oa16EditF"><span>Inizio 1</span><input id="oa16StoreS1" type="time"></label><label class="oa16EditF"><span>Fine 1</span><input id="oa16StoreE1" type="time"></label><label class="oa16EditF"><span>Inizio 2</span><input id="oa16StoreS2" type="time"></label><label class="oa16EditF"><span>Fine 2</span><input id="oa16StoreE2" type="time"></label></div><label class="oa16EditF full"><span>Note</span><textarea id="oa16StoreNotes" placeholder="Nota facoltativa"></textarea></label></div></div><div id="oa16StoreMsg" class="oa16EditMsg"></div><div class="oa16EditActions"><div class="left"><button id="oa16StoreClear" class="oa16Clear" type="button">Ripristina orario predefinito</button></div><div class="right"><button id="oa16StoreCancel" class="oa16Cancel" type="button">Annulla</button><button id="oa16StoreSave" class="oa16Save" type="button">Salva</button></div></div></div></div>'''

script=r'''<script id="optykerShiftsMonthlyV16Js">(function(){/* OPTYKER_SHIFTS_MONTHLY_V16 */
var S={month:'',data:null,editing:null,busy:false};
var API='optyker_staff_schedule_api';
var MONTHS=['gennaio','febbraio','marzo','aprile','maggio','giugno','luglio','agosto','settembre','ottobre','novembre','dicembre'];
var WD=['dom','lun','mar','mer','gio','ven','sab'];
function E(i){return document.getElementById(i)}
function X(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function z(n){return String(n).padStart(2,'0')}
function ymd(d){return d.getFullYear()+'-'+z(d.getMonth()+1)+'-'+z(d.getDate())}
function monthKey(d){return d.getFullYear()+'-'+z(d.getMonth()+1)}
function parseMonth(v){var a=String(v||'').split('-');return new Date(+a[0],Math.max(0,(+a[1]||1)-1),1,12)}
function addMonth(v,n){var d=parseMonth(v);d.setMonth(d.getMonth()+n);return monthKey(d)}
function daysInMonth(v){var d=parseMonth(v);return new Date(d.getFullYear(),d.getMonth()+1,0).getDate()}
function cloud(){if(!window.OPTYKER_CLOUD||!OPTYKER_CLOUD.username||!OPTYKER_CLOUD.password)throw Error('Sessione non autenticata');return OPTYKER_CLOUD}
function api(action,payload){var c=cloud();return fetch(c.root+'/rest/v1/rpc/'+API,{method:'POST',headers:{'Content-Type':'application/json','apikey':c.key,'Authorization':'Bearer '+c.key},body:JSON.stringify({p_username:c.username,p_password:c.password,p_action:action,p_payload:payload||{}})}).then(function(r){if(!r.ok)throw Error('Server '+r.status);return r.json()}).then(function(x){if(!x||x.ok===false)throw Error(x&&x.error||'Errore turni');return x})}
function stat(t,b){var e=E('oa16StatusText');if(e){e.textContent=t||'';e.className='oa16Status'+(b?' bad':'')}}
function editMsg(t,b){var e=E('oa16EditMsg');if(e){e.textContent=t||'';e.className='oa16EditMsg'+(b?' bad':'')}}
function storeOverride(date){return (S.data.store_overrides||[]).find(function(x){return String(x.schedule_date)===String(date)})||null}
function storeForDate(d){var date=ymd(d),ov=storeOverride(date);if(ov)return Object.assign({_override:true},ov);var wd=((d.getDay()+6)%7)+1,h=(S.data.store_hours||[]).find(function(x){return +x.weekday===wd})||{weekday:wd,active:false};return Object.assign({_override:false},h)}
function fmtStore(h){if(!h||h.active===false)return '×';var a=[];if(h.start_time&&h.end_time)a.push(h.start_time+' - '+h.end_time);if(h.start_time_2&&h.end_time_2)a.push(h.start_time_2+' - '+h.end_time_2);return a.length?a.join('<br>'):'×'}
function schedule(op,date){return (S.data.schedules||[]).find(function(x){return String(x.operator_username).toUpperCase()===String(op).toUpperCase()&&String(x.schedule_date)===String(date)})||null}
function defaultTimes(d){var h=storeForDate(d);return h&&h.active!==false?{s1:h.start_time||'',e1:h.end_time||'',s2:h.start_time_2||'',e2:h.end_time_2||''}:{s1:'',e1:'',s2:'',e2:''}}
function cellClass(sc,h){if(!sc)return h&&h.active!==false?'default':'closed';if(sc.status==='work')return 'extra';return sc.status||'other'}
function statusName(s){return s==='vacation'?'Ferie':s==='permission'?'Permesso':s==='sick'?'Malattia':s==='rest'?'Riposo':s==='other'?'Altro':'Turno'}
function cellHtml(sc,h){if(!sc)return h&&h.active!==false?'<div class="times">'+fmtStore(h)+'</div>':'×';if(sc.status!=='work')return '<div><div class="status">'+X(statusName(sc.status))+'</div>'+(sc.notes?'<div class="note">'+X(sc.notes)+'</div>':'')+'</div>';var a=[];if(sc.start_time&&sc.end_time)a.push(sc.start_time+' - '+sc.end_time);if(sc.start_time_2&&sc.end_time_2)a.push(sc.start_time_2+' - '+sc.end_time_2);return '<div><div class="times">'+(a.length?X(a.join(' | ')).replace(' | ','<br>'):fmtStore(h))+'</div>'+(sc.notes?'<div class="note">'+X(sc.notes)+'</div>':'')+'</div>'}
function headRow(days){var h='<div class="oa16Corner"></div>',today=ymd(new Date());for(var i=1;i<=days;i++){var d=parseMonth(S.month);d.setDate(i);var k=ymd(d),sun=d.getDay()===0;h+='<div class="oa16DayHead '+(k===today?'today ':'')+(sun?'sun':'')+'"><span class="d">'+i+'</span><span class="w">'+WD[d.getDay()]+'</span></div>'}return h}
function gridCols(days){return '210px repeat('+days+',104px)'}
function storeGrid(){var days=daysInMonth(S.month),h='<div class="oa16Grid oa16StoreGrid" style="grid-template-columns:'+gridCols(days)+'">'+headRow(days)+'<div class="oa16RowHead">Turni</div>';for(var i=1;i<=days;i++){var d=parseMonth(S.month);d.setDate(i);var date=ymd(d),sh=storeForDate(d),today=date===ymd(new Date()),cl=sh.active===false?'closed':(sh._override?'extra':'default');h+='<div class="oa16Cell storeClickable '+cl+' '+(today?'oa16TodayCol':'')+'" data-store-date="'+date+'">'+(sh.active===false?'×':'<div class="times">'+fmtStore(sh)+'</div>')+'</div>'}return h+'</div>'}
function userGrid(){var days=daysInMonth(S.month),ops=(S.data.operators||[]),h='<div class="oa16Grid oa16UsersGrid" style="grid-template-columns:'+gridCols(days)+'">'+headRow(days);ops.forEach(function(o){var op=o.username;h+='<div class="oa16RowHead">'+X(op)+'</div>';for(var i=1;i<=days;i++){var d=parseMonth(S.month);d.setDate(i);var date=ymd(d),sh=storeForDate(d),sc=schedule(op,date),cl=cellClass(sc,sh),today=date===ymd(new Date());h+='<div class="oa16Cell clickable '+cl+' '+(today?'oa16TodayCol':'')+'" data-op="'+X(op)+'" data-date="'+date+'">'+cellHtml(sc,sh)+'</div>'}});return h+'</div>'}
function mount(){
  var host=E('oaShiftCalendarV7');if(!host)return false;
  if(E('oaShiftMonthlyV16'))return true;
  var d=document.createElement('div');d.id='oaShiftMonthlyV16';d.className='oa16';
  d.innerHTML='<div class="oa16Top"><label class="oa16Field"><span>Tipo di visualizzazione</span><select class="oa16View"><option>Mensile</option></select></label><label class="oa16Field"><span>Mese e anno</span><div class="oa16MonthWrap"><button id="oa16Prev" class="oa16Nav" type="button">‹</button><input id="oa16Month" class="oa16Month" type="month"><button id="oa16Next" class="oa16Nav" type="button">›</button></div></label><label class="oa16Field"><span>Punto vendita</span><select class="oa16StoreSel"><option>Principale</option></select></label><button id="oa16Refresh" class="oa16IconBtn" type="button">↻ Aggiorna</button><button id="oa16Pdf" class="oa16Export oa16Pdf" type="button">↓ Scarica PDF</button><button id="oa16Excel" class="oa16Export oa16Excel" type="button">↓ Scarica Excel</button></div><section class="oa16Section"><div class="oa16SectionHead"><div><div class="oa16SectionTitle">Orari punto vendita</div><div class="oa16SectionSub">Orari generali del negozio per il mese selezionato.</div></div><div class="oa16Legend"><span><i class="oa16Sw"></i>Orario predefinito</span><span><i class="oa16Sw extra"></i>Orario straordinario</span><span><i class="oa16Sw closed"></i>Giorno di chiusura</span></div></div><div id="oa16StoreWrap" class="oa16GridWrap"><div class="oa16Loading">Caricamento…</div></div></section><section class="oa16Section"><div class="oa16SectionHead"><div><div class="oa16SectionTitle">Orari utenti</div><div class="oa16SectionSub">Clicca una cella per modificare il turno o impostare un’assenza.</div></div><div class="oa16Legend"><span><i class="oa16Sw"></i>Predefinito</span><span><i class="oa16Sw extra"></i>Turno modificato</span><span><i class="oa16Sw vacation"></i>Ferie</span><span><i class="oa16Sw permission"></i>Permesso</span><span><i class="oa16Sw sick"></i>Malattia</span><span><i class="oa16Sw rest"></i>Riposo</span><span><i class="oa16Sw other"></i>Altro</span></div></div><div id="oa16UsersWrap" class="oa16GridWrap"><div class="oa16Loading">Caricamento…</div></div><div id="oa16StatusText" class="oa16Status"></div></section>';
  host.appendChild(d);
  E('oa16Month').value=S.month||monthKey(new Date());
  E('oa16Month').onchange=function(){S.month=this.value;load()};
  E('oa16Prev').onclick=function(){S.month=addMonth(S.month,-1);E('oa16Month').value=S.month;load()};
  E('oa16Next').onclick=function(){S.month=addMonth(S.month,1);E('oa16Month').value=S.month;load()};
  E('oa16Refresh').onclick=function(){load()};
  E('oa16Pdf').onclick=exportPdf;
  E('oa16Excel').onclick=exportExcel;
  return true
}
function render(){if(!S.data)return;E('oa16StoreWrap').innerHTML=storeGrid();E('oa16UsersWrap').innerHTML=userGrid();E('oa16StoreWrap').querySelectorAll('.oa16Cell[data-store-date]').forEach(function(c){c.onclick=function(){openStoreEdit(c.dataset.storeDate)}});E('oa16UsersWrap').querySelectorAll('.oa16Cell[data-op]').forEach(function(c){c.onclick=function(){openEdit(c.dataset.op,c.dataset.date)}})}
function load(){
  if(S.busy)return;S.busy=true;stat('Caricamento…');if(!S.month)S.month=monthKey(new Date());if(E('oa16Month'))E('oa16Month').value=S.month;
  api('month_get',{month:S.month+'-01'}).then(function(x){S.data=x;render();stat('')}).catch(function(e){stat(e.message,true);if(E('oa16StoreWrap'))E('oa16StoreWrap').innerHTML='<div class="oa16Loading">Impossibile caricare gli orari.</div>';if(E('oa16UsersWrap'))E('oa16UsersWrap').innerHTML='<div class="oa16Loading">Impossibile caricare i turni.</div>'}).finally(function(){S.busy=false})
}
function openEdit(op,date){
  if(!S.data)return;var d=new Date(date+'T12:00:00'),sc=schedule(op,date),def=defaultTimes(d);
  S.editing={op:op,date:date};
  E('oa16EditSub').textContent=op+' · '+d.toLocaleDateString('it-IT',{weekday:'long',day:'2-digit',month:'long',year:'numeric'});
  E('oa16Status').value=sc&&sc.status||'work';
  E('oa16S1').value=sc&&sc.status==='work'?(sc.start_time||def.s1):def.s1;
  E('oa16E1').value=sc&&sc.status==='work'?(sc.end_time||def.e1):def.e1;
  E('oa16S2').value=sc&&sc.status==='work'?(sc.start_time_2||def.s2):def.s2;
  E('oa16E2').value=sc&&sc.status==='work'?(sc.end_time_2||def.e2):def.e2;
  E('oa16Notes').value=sc&&sc.notes||'';
  toggleTimes();editMsg('');E('oa16Edit').classList.add('open')
}
function toggleTimes(){E('oa16Times').style.display=E('oa16Status').value==='work'?'grid':'none'}
function closeEdit(){E('oa16Edit').classList.remove('open');S.editing=null}
function saveEdit(){
  if(!S.editing||S.busy)return;var status=E('oa16Status').value,p={date:S.editing.date,operator_username:S.editing.op,status:status,start_time:E('oa16S1').value,end_time:E('oa16E1').value,start_time_2:E('oa16S2').value,end_time_2:E('oa16E2').value,notes:E('oa16Notes').value};
  if(status==='work'&&((p.start_time&&!p.end_time)||(!p.start_time&&p.end_time)||((p.start_time_2&&!p.end_time_2)||(!p.start_time_2&&p.end_time_2)))){editMsg('Completa inizio e fine di ogni fascia.',true);return}
  S.busy=true;E('oa16Save').disabled=true;editMsg('Salvataggio…');
  api('day_save',p).then(function(){closeEdit();return load()}).catch(function(e){editMsg(e.message,true)}).finally(function(){S.busy=false;E('oa16Save').disabled=false})
}
function clearEdit(){
  if(!S.editing||S.busy)return;S.busy=true;E('oa16Clear').disabled=true;editMsg('Ripristino…');
  api('day_clear',{date:S.editing.date,operator_username:S.editing.op}).then(function(){closeEdit();return load()}).catch(function(e){editMsg(e.message,true)}).finally(function(){S.busy=false;E('oa16Clear').disabled=false})
}
function exportRows(){
  if(!S.data)return[];var days=daysInMonth(S.month),rows=[['Utente']];for(var i=1;i<=days;i++)rows[0].push(i+' '+WD[new Date(parseMonth(S.month).getFullYear(),parseMonth(S.month).getMonth(),i).getDay()]);
  rows.push(['Punto vendita']);for(var d=1;d<=days;d++){var dt=parseMonth(S.month);dt.setDate(d);rows[1].push(fmtStore(storeForDate(dt)).replace(/<br>/g,' / '))}
  (S.data.operators||[]).forEach(function(o){var r=[o.username];for(var i=1;i<=days;i++){var dt=parseMonth(S.month);dt.setDate(i);var sc=schedule(o.username,ymd(dt)),sh=storeForDate(dt);if(!sc)r.push(sh.active===false?'Chiuso':fmtStore(sh).replace(/<br>/g,' / '));else if(sc.status==='work'){var a=[];if(sc.start_time&&sc.end_time)a.push(sc.start_time+'-'+sc.end_time);if(sc.start_time_2&&sc.end_time_2)a.push(sc.start_time_2+'-'+sc.end_time_2);r.push(a.join(' / ')||'Turno')}else r.push(statusName(sc.status))}rows.push(r)});
  return rows
}
function lib(url,test){return new Promise(function(resolve,reject){if(test())return resolve();var s=document.createElement('script');s.src=url;s.onload=function(){test()?resolve():reject(Error('Libreria non disponibile'))};s.onerror=function(){reject(Error('Impossibile caricare la libreria di esportazione'))};document.head.appendChild(s)})}
function exportExcel(){
  stat('Creazione file Excel…');lib('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',function(){return !!window.XLSX}).then(function(){var rows=exportRows(),ws=XLSX.utils.aoa_to_sheet(rows),wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'Turni '+S.month);XLSX.writeFile(wb,'turni-'+S.month+'.xlsx');stat('Excel scaricato.')}).catch(function(e){stat(e.message,true)})
}
function exportPdf(){
  stat('Creazione PDF…');lib('https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js',function(){return !!(window.jspdf&&window.jspdf.jsPDF)}).then(function(){return lib('https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.4/dist/jspdf.plugin.autotable.min.js',function(){return !!(window.jspdf&&window.jspdf.jsPDF&&window.jspdf.jsPDF.API.autoTable)})}).then(function(){var rows=exportRows(),doc=new window.jspdf.jsPDF({orientation:'landscape',unit:'mm',format:'a3'});doc.setFontSize(13);doc.text('Turni e orari - '+S.month,10,10);doc.autoTable({head:[rows[0]],body:rows.slice(1),startY:15,theme:'grid',styles:{fontSize:5,cellPadding:1.2,overflow:'linebreak',valign:'middle'},headStyles:{fontSize:5.5},margin:{left:7,right:7}});doc.save('turni-'+S.month+'.pdf');stat('PDF scaricato.')}).catch(function(e){stat(e.message,true)})
}
function storeEditMsg(t,b){var e=E('oa16StoreMsg');if(e){e.textContent=t||'';e.className='oa16EditMsg'+(b?' bad':'')}}
function openStoreEdit(date){
  if(!S.data)return;var d=new Date(date+'T12:00:00'),h=storeForDate(d);S.storeEditing={date:date};
  E('oa16StoreSub').textContent=d.toLocaleDateString('it-IT',{weekday:'long',day:'2-digit',month:'long',year:'numeric'});
  E('oa16StoreActive').value=h.active===false?'false':'true';E('oa16StoreS1').value=h.start_time||'';E('oa16StoreE1').value=h.end_time||'';E('oa16StoreS2').value=h.start_time_2||'';E('oa16StoreE2').value=h.end_time_2||'';E('oa16StoreNotes').value=h.notes||'';toggleStoreTimes();storeEditMsg('');E('oa16StoreEdit').classList.add('open')
}
function toggleStoreTimes(){E('oa16StoreTimes').style.display=E('oa16StoreActive').value==='true'?'grid':'none'}
function closeStoreEdit(){E('oa16StoreEdit').classList.remove('open');S.storeEditing=null}
function saveStoreEdit(){
  if(!S.storeEditing||S.busy)return;var p={date:S.storeEditing.date,active:E('oa16StoreActive').value==='true',start_time:E('oa16StoreS1').value,end_time:E('oa16StoreE1').value,start_time_2:E('oa16StoreS2').value,end_time_2:E('oa16StoreE2').value,notes:E('oa16StoreNotes').value};
  if(p.active&&((p.start_time&&!p.end_time)||(!p.start_time&&p.end_time)||((p.start_time_2&&!p.end_time_2)||(!p.start_time_2&&p.end_time_2)))){storeEditMsg('Completa inizio e fine di ogni fascia.',true);return}
  S.busy=true;E('oa16StoreSave').disabled=true;storeEditMsg('Salvataggio…');api('store_day_save',p).then(function(){closeStoreEdit();return load()}).catch(function(e){storeEditMsg(e.message,true)}).finally(function(){S.busy=false;E('oa16StoreSave').disabled=false})
}
function clearStoreEdit(){
  if(!S.storeEditing||S.busy)return;S.busy=true;E('oa16StoreClear').disabled=true;storeEditMsg('Ripristino…');api('store_day_clear',{date:S.storeEditing.date}).then(function(){closeStoreEdit();return load()}).catch(function(e){storeEditMsg(e.message,true)}).finally(function(){S.busy=false;E('oa16StoreClear').disabled=false})
}
function bindEditor(){
  E('oa16Status').onchange=toggleTimes;E('oa16Save').onclick=saveEdit;E('oa16Clear').onclick=clearEdit;E('oa16Cancel').onclick=closeEdit;E('oa16EditClose').onclick=closeEdit;E('oa16Edit').addEventListener('click',function(ev){if(ev.target===E('oa16Edit'))closeEdit()});
  E('oa16StoreActive').onchange=toggleStoreTimes;E('oa16StoreSave').onclick=saveStoreEdit;E('oa16StoreClear').onclick=clearStoreEdit;E('oa16StoreCancel').onclick=closeStoreEdit;E('oa16StoreClose').onclick=closeStoreEdit;E('oa16StoreEdit').addEventListener('click',function(ev){if(ev.target===E('oa16StoreEdit'))closeStoreEdit()})
}
function start(){
  if(!S.month)S.month=monthKey(new Date());
  var tries=0;(function wait(){tries++;if(mount()){bindEditor();var b=E('oaModeShiftV7');if(b&&!b.__v16){b.__v16=true;b.addEventListener('click',function(){setTimeout(load,60)})}if(E('oaShiftCalendarV7').classList.contains('open'))load();return}if(tries<40)setTimeout(wait,100)})()
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
window.addEventListener('pageshow',function(){setTimeout(start,100)});
})();</script>'''

h=s.find('</head>')
if h<0: raise SystemExit('head non trovato')
s=s[:h]+style+s[h:]
b=s.rfind('</body>')
if b<0: raise SystemExit('body non trovato')
s=s[:b]+html+script+s[b:]
p.write_text(s,encoding='utf-8')
for req in [MARK,'Orari punto vendita','Orari utenti','Permesso','Malattia','Scarica PDF','Scarica Excel','store_day_save','optyker_staff_schedule_api']:
    if req not in s: raise SystemExit('Turni V16 incompleti: '+req)
print('Shifts monthly V16 OK')

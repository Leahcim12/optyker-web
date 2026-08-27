from pathlib import Path

p=Path('_site/index.html')
s=p.read_text(encoding='utf-8')
MARK='OPTYKER_SHIFTS_STORE_STYLE_V19'
if MARK in s:
    raise SystemExit(0)
if 'OPTYKER_SHIFTS_MONTHLY_V16' not in s:
    raise SystemExit('Turni mensili V16 non disponibili')

style=r'''<style id="optykerShiftsStoreStyleV19Css">/* OPTYKER_SHIFTS_STORE_STYLE_V19 */
/* Orari utenti = stessa grafica di Orari punto vendita */
#oa16UsersWrap,
#oa16StoreWrap{
  border:1px solid #d9e0e5!important;
  border-radius:12px!important;
  background:#fff!important;
  box-shadow:none!important;
}
#oa16UsersWrap .oa16Grid,
#oa16StoreWrap .oa16Grid{
  --oa16-rowh:68px!important;
}
#oa16UsersWrap .oa16Corner,
#oa16UsersWrap .oa16DayHead,
#oa16StoreWrap .oa16Corner,
#oa16StoreWrap .oa16DayHead{
  height:42px!important;
  background:#f7f9fa!important;
  border-color:#dde3e7!important;
}
#oa16UsersWrap .oa16DayHead.today,
#oa16StoreWrap .oa16DayHead.today{
  background:#edf5ff!important;
  color:#174f9b!important;
}
#oa16UsersWrap .oa16DayHead.sun,
#oa16StoreWrap .oa16DayHead.sun{
  background:#f1f2f3!important;
  color:#8a9298!important;
}
#oa16UsersWrap .oa16RowHead,
#oa16StoreWrap .oa16RowHead{
  min-height:68px!important;
  padding:10px 12px!important;
  background:#fff!important;
  color:#172d3b!important;
  font-size:10px!important;
  font-weight:900!important;
  border-color:#dde3e7!important;
}
#oa16UsersWrap .oa16Cell,
#oa16StoreWrap .oa16Cell{
  min-height:68px!important;
  padding:7px 6px!important;
  background:#fff;
  color:#263944!important;
  border-color:#dde3e7!important;
  font-size:9px!important;
  line-height:1.45!important;
  border-radius:0!important;
}
#oa16UsersWrap .oa16Cell .times,
#oa16StoreWrap .oa16Cell .times{
  font-size:9px!important;
  font-weight:800!important;
  line-height:1.5!important;
  color:#263944!important;
}
#oa16UsersWrap .oa16Cell.closed,
#oa16StoreWrap .oa16Cell.closed{
  background:#f2f3f4!important;
  color:#9ba3a8!important;
  font-size:16px!important;
  box-shadow:none!important;
}
#oa16UsersWrap .oa16Cell.default{
  background:#fff!important;
  box-shadow:none!important;
}
#oa16UsersWrap .oa16Cell.extra{
  background:#edf5ff!important;
  box-shadow:inset 0 0 0 1px #4a8fe7!important;
}
#oa16UsersWrap .oa16Cell.vacation{
  background:#fff9df!important;
  box-shadow:inset 0 0 0 1px #e9bd35!important;
}
#oa16UsersWrap .oa16Cell.permission{
  background:#fff1e4!important;
  box-shadow:inset 0 0 0 1px #ee9a49!important;
}
#oa16UsersWrap .oa16Cell.sick{
  background:#ffe9e9!important;
  box-shadow:inset 0 0 0 1px #e46b6b!important;
}
#oa16UsersWrap .oa16Cell.rest{
  background:#f0f2f4!important;
  box-shadow:inset 0 0 0 1px #aeb8bf!important;
}
#oa16UsersWrap .oa16Cell.other{
  background:#edf4ff!important;
  box-shadow:inset 0 0 0 1px #668fd0!important;
}
#oa16UsersWrap .oa16Cell .status{
  font-size:9px!important;
  font-weight:900!important;
  text-transform:none!important;
  letter-spacing:0!important;
}
#oa16UsersWrap .oa16Cell.vacation .status{color:#a97800!important}
#oa16UsersWrap .oa16Cell.permission .status{color:#b55d11!important}
#oa16UsersWrap .oa16Cell.sick .status{color:#b43838!important}
#oa16UsersWrap .oa16Cell.rest .status{color:#66727a!important}
#oa16UsersWrap .oa16Cell.other .status{color:#355f9d!important}
#oa16UsersWrap .oa16Cell .note{
  max-width:92px!important;
  font-size:7px!important;
  color:#6f7b84!important;
  margin-top:3px!important;
}

/* hover identico ma discreto */
#oa16UsersWrap .oa16Cell.clickable:hover,
#oa16StoreWrap .oa16Cell.storeClickable:hover{
  outline:2px solid #79a7d8!important;
  outline-offset:-2px!important;
  z-index:3!important;
}

/* Le due finestre di modifica usano la stessa grafica */
#oa16Edit .oa16EditCard,
#oa16StoreEdit .oa16EditCard{
  width:min(760px,96vw)!important;
  border-radius:12px!important;
  border:1px solid #cfd9e0!important;
  background:#fff!important;
}
#oa16Edit .oa16EditHead,
#oa16StoreEdit .oa16EditHead{
  background:#fff!important;
  color:#17324a!important;
  border-bottom:1px solid #e1e7eb!important;
  padding:14px 16px!important;
}
#oa16Edit .oa16EditTitle,
#oa16StoreEdit .oa16EditTitle{
  color:#17324a!important;
  font-size:15px!important;
}
#oa16Edit .oa16EditSub,
#oa16StoreEdit .oa16EditSub{
  color:#71828e!important;
}
#oa16Edit .oa16EditClose,
#oa16StoreEdit .oa16EditClose{
  background:#f4f7f9!important;
  color:#526b7b!important;
  border:1px solid #d8e0e5!important;
}
#oa16Edit .oa16EditBody,
#oa16StoreEdit .oa16EditBody{
  padding:16px!important;
}
#oa16Edit .oa16EditF input,
#oa16Edit .oa16EditF select,
#oa16Edit .oa16EditF textarea,
#oa16StoreEdit .oa16EditF input,
#oa16StoreEdit .oa16EditF select,
#oa16StoreEdit .oa16EditF textarea{
  border-radius:9px!important;
  border-color:#cbd6de!important;
  background:#fff!important;
}
#oa16Edit .oa16EditActions,
#oa16StoreEdit .oa16EditActions{
  background:#fafcfd!important;
  border-top:1px solid #e1e7eb!important;
}
#oa16Edit .oa16Save,
#oa16StoreEdit .oa16Save{
  background:#204a91!important;
  color:#fff!important;
}
</style>'''

script=r'''<script id="optykerShiftsStoreStyleV19Js">(function(){/* OPTYKER_SHIFTS_STORE_STYLE_V19 */
function enhance(){
  var users=document.querySelector('#oa16UsersWrap .oa16UsersGrid');
  var store=document.querySelector('#oa16StoreWrap .oa16StoreGrid');
  if(users)users.classList.add('oa16StoreVisualBase');
  if(store)store.classList.add('oa16StoreVisualBase');
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setTimeout(enhance,120)});else setTimeout(enhance,120);
window.addEventListener('pageshow',function(){setTimeout(enhance,80)});
document.addEventListener('click',function(ev){var b=ev.target&&ev.target.closest?ev.target.closest('#oaModeShiftV7,#oa16Prev,#oa16Next,#oa16Refresh'):null;if(b)setTimeout(enhance,80)},true);
})();</script>'''

h=s.find('</head>')
if h<0: raise SystemExit('head non trovato')
s=s[:h]+style+s[h:]
b=s.rfind('</body>')
if b<0: raise SystemExit('body non trovato')
s=s[:b]+script+s[b:]
p.write_text(s,encoding='utf-8')
for req in [MARK,'#oa16UsersWrap','#oa16StoreWrap','oa16Cell.vacation','oa16StoreEdit']:
    if req not in s:
        raise SystemExit('Turni V19 incompleti: '+req)
print('Turni utenti uniformati agli orari negozio')

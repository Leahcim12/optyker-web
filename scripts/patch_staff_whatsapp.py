from pathlib import Path

p=Path('_site/staff-embed/index.html')
s=p.read_text(encoding='utf-8')
MARK='OPTYKER_STAFF_WHATSAPP_V1'
if MARK in s:
    raise SystemExit(0)
if ('OPTYKER_STAFF_STATIC_UI_V2' not in s and 'OPTYKER_STAFF_STATIC_UI_V3' not in s) or 'optyker-shopify-staff-embed' not in s:
    raise SystemExit('Renderer staff Shopify non pronto')

def once(old,new,label):
    global s
    c=s.count(old)
    if c!=1:
        raise SystemExit(f'{label}: occorrenze {c}')
    s=s.replace(old,new,1)

css='''\n/* OPTYKER_STAFF_WHATSAPP_V1 */
.chatChannels{display:flex;align-items:center;gap:7px;margin:-4px 0 14px;flex-wrap:wrap}.chatChannelBtn{border:1px solid #cfdbe5;background:#fff;border-radius:9px;padding:7px 12px;font-size:10px;font-weight:850;cursor:pointer;color:#36556d}.chatChannelBtn.active{background:#eaf4fc;border-color:#1769aa;color:#1769aa}.chatChannelBtn.whatsapp.active{background:#eefaf3;border-color:#1f8b4c;color:#18733f}.chatChannelMeta{font-size:9px;color:#6d7f8f;margin-left:3px}.chatChannelBtn[hidden]{display:none!important}@media(max-width:560px){.chatChannels{align-items:stretch}.chatChannelBtn{flex:1}.chatChannelMeta{width:100%;margin:0}}
'''
once('</style>',css+'</style>','CSS WhatsApp staff')

old_panel='<section id="panelChat" class="panel active"><h1 class="title">Chat clienti</h1><div class="sub">Tutte le conversazioni con i clienti.</div><div class="grid">'
new_panel='<section id="panelChat" class="panel active"><h1 class="title">Chat clienti</h1><div class="sub">Tutte le conversazioni con i clienti.</div><div class="chatChannels"><button id="channelWeb" class="chatChannelBtn active" type="button">Chat Optyker</button><button id="channelWa" class="chatChannelBtn whatsapp" type="button" hidden>WhatsApp</button><span id="channelWaMeta" class="chatChannelMeta"></span></div><div class="grid">'
once(old_panel,new_panel,'Barra canali chat')

old_head="""const API='https://whgziwaegjzqsgcntesr.supabase.co/functions/v1/optyker-shopify-staff-embed';
const TOKEN=new URLSearchParams(location.search).get('t')||'';
let operator='Operatore',threads=[],selectedThread='',messages=[],clients=[],shiftLoadedMonth='';"""
new_head="""const API='https://whgziwaegjzqsgcntesr.supabase.co/functions/v1/optyker-shopify-staff-embed';
const WA_API='https://whgziwaegjzqsgcntesr.supabase.co/functions/v1/optyker-shopify-staff-whatsapp';
const TOKEN=new URLSearchParams(location.search).get('t')||'';
let operator='Operatore',threads=[],selectedThread='',messages=[],clients=[],shiftLoadedMonth='',chatMode='web',waAvailable=false;"""
once(old_head,new_head,'Endpoint WhatsApp')

old_api="async function api(action,payload={}){const r=await fetch(API+'?api=1&t='+encodeURIComponent(TOKEN),{method:'POST',headers:{'content-type':'application/json'},cache:'no-store',body:JSON.stringify({action,payload})});const x=await r.json().catch(()=>({ok:false,error:'Risposta server non valida'}));if(!r.ok||x?.ok===false)throw new Error(x?.error||'Errore');return x}"
new_api=old_api+"\nasync function waApi(action,payload={}){const r=await fetch(WA_API+'?t='+encodeURIComponent(TOKEN),{method:'POST',headers:{'content-type':'application/json'},cache:'no-store',body:JSON.stringify({action,payload})});const x=await r.json().catch(()=>({ok:false,error:'Risposta WhatsApp non valida'}));if(!r.ok||x?.ok===false)throw new Error(x?.error||'Errore WhatsApp');return x}\nfunction normalizeWaMessage(m){return {sender_type:m.direction==='outbound'?'staff':'customer',sender_name:m.sender_name||(m.direction==='outbound'?operator:'Cliente'),sender_photo:'',message:m.message||'',created_at:m.created_at||'',status:m.status||''}}"
once(old_api,new_api,'API WhatsApp')

old_load="async function loadThreads(){try{const x=await api('list_threads');threads=x.data||[];renderThreads()}catch(e){$('threads').innerHTML='<div class=\"empty\">'+esc(e.message)+'</div>'}}"
new_load="async function loadThreads(){try{const x=chatMode==='whatsapp'?await waApi('list_threads'):await api('list_threads');threads=x.data||[];renderThreads()}catch(e){$('threads').innerHTML='<div class=\"empty\">'+esc(e.message)+'</div>'}}"
once(old_load,new_load,'Caricamento thread')

old_open="async function openThread(id){selectedThread=id;renderThreads();$('chatBlank').style.display='none';$('conversation').style.display='block';try{const x=await api('get_thread',{client_id:id});$('chatName').textContent=x.client_name||'Cliente';messages=x.data||[];renderMessages();loadThreads()}catch(e){$('messages').innerHTML='<div class=\"empty\">'+esc(e.message)+'</div>'}}"
new_open="async function openThread(id){selectedThread=id;renderThreads();$('chatBlank').style.display='none';$('conversation').style.display='block';try{const x=chatMode==='whatsapp'?await waApi('get_thread',{client_id:id}):await api('get_thread',{client_id:id});const c=x.client||{};$('chatName').textContent=chatMode==='whatsapp'?((((c.surname||'')+' '+(c.name||'')).trim())||'Cliente'):(x.client_name||'Cliente');messages=chatMode==='whatsapp'?(x.data||[]).map(normalizeWaMessage):(x.data||[]);renderMessages();loadThreads()}catch(e){$('messages').innerHTML='<div class=\"empty\">'+esc(e.message)+'</div>'}}"
once(old_open,new_open,'Apertura thread')

old_send="async function sendMsg(){const t=$('msgText'),b=$('sendBtn'),m=t.value.trim(),a=chatAttachment;if((!m&&!a)||!selectedThread)return;b.disabled=true;try{await api('send',{client_id:selectedThread,message:m,attachment_data:a?.data||'',attachment_name:a?.name||'',attachment_type:a?.type||''});t.value='';clearChatAttachment();await openThread(selectedThread);t.focus()}catch(e){alert(e.message||'Invio non riuscito')}finally{b.disabled=false}}"
new_send="async function sendMsg(){const t=$('msgText'),b=$('sendBtn'),m=t.value.trim(),a=chatAttachment;if((!m&&!a)||!selectedThread)return;b.disabled=true;try{if(chatMode==='whatsapp'){if(a)throw Error('Gli allegati sono disponibili nella Chat Optyker.');if(!m)return;await waApi('send',{client_id:selectedThread,message:m})}else await api('send',{client_id:selectedThread,message:m,attachment_data:a?.data||'',attachment_name:a?.name||'',attachment_type:a?.type||''});t.value='';clearChatAttachment();await openThread(selectedThread);t.focus()}catch(e){alert(e.message||'Invio non riuscito')}finally{b.disabled=false}}"
once(old_send,new_send,'Invio messaggi')

old_start="async function startClientChat(id){showTab('chat');selectedThread=id;$('chatBlank').style.display='none';$('conversation').style.display='block';try{const x=await api('get_thread',{client_id:id});$('chatName').textContent=x.client_name||'Cliente';messages=x.data||[];renderMessages();renderThreads()}catch(e){$('messages').innerHTML='<div class=\"empty\">'+esc(e.message)+'</div>'}}"
new_start="async function startClientChat(id){showTab('chat');await openThread(id)}"
once(old_start,new_start,'Chat da scheda cliente')

old_boot="async function boot(){if(!TOKEN){showFatal('Collegamento non valido.');return}try{const me=await api('me');operator=me?.data?.username||'Operatore';const photo=me?.data?.photo_data||'';$('operatorName').textContent=operator;$('replyAs').textContent='Risposta come '+operator;$('avatar').innerHTML=photo?'<img src=\"'+esc(photo)+'\" alt=\"\">':'<span>'+esc((operator.trim().charAt(0)||'O').toUpperCase())+'</span>';$('boot').classList.add('hidden');$('app').classList.remove('hidden');await loadThreads()}catch(e){showFatal(e.message)}}"
new_boot="""function setChatMode(mode){if(mode==='whatsapp'&&!waAvailable)return;chatMode=mode;selectedThread='';messages=[];$('channelWeb').classList.toggle('active',mode==='web');$('channelWa').classList.toggle('active',mode==='whatsapp');$('replyAs').textContent=(mode==='whatsapp'?'WhatsApp · ':'Risposta come ')+operator;$('sendBtn').textContent=mode==='whatsapp'?'Invia WhatsApp':'Invia';$('msgText').placeholder=mode==='whatsapp'?'Scrivi su WhatsApp…':'Scrivi un messaggio…';$('conversation').style.display='none';$('chatBlank').style.display='flex';$('chatBlank').textContent=mode==='whatsapp'?'Seleziona una conversazione WhatsApp.':'Seleziona una conversazione.';$('threads').innerHTML='<div class=\"empty\">Caricamento…</div>';loadThreads()}
async function initWhatsApp(){try{const x=await waApi('status'),d=x.data||{};waAvailable=!!(d.enabled||d.configured||d.has_messages);$('channelWa').hidden=!waAvailable;$('channelWaMeta').textContent=waAvailable?[d.verified_name,d.display_phone_number].filter(Boolean).join(' · '):''}catch(e){waAvailable=false;$('channelWa').hidden=true;$('channelWaMeta').textContent=''}}
async function boot(){if(!TOKEN){showFatal('Collegamento non valido.');return}try{const me=await api('me');operator=me?.data?.username||'Operatore';const photo=me?.data?.photo_data||'';$('operatorName').textContent=operator;$('replyAs').textContent='Risposta come '+operator;$('avatar').innerHTML=photo?'<img src=\"'+esc(photo)+'\" alt=\"\">':'<span>'+esc((operator.trim().charAt(0)||'O').toUpperCase())+'</span>';$('boot').classList.add('hidden');$('app').classList.remove('hidden');await initWhatsApp();await loadThreads()}catch(e){showFatal(e.message)}}"""
once(old_boot,new_boot,'Bootstrap WhatsApp')

old_events="$('tabChat').onclick=()=>showTab('chat');$('tabClients').onclick=()=>showTab('clients');$('tabShifts').onclick=()=>showTab('shifts');$('shiftMonth').value=monthKey(new Date());$('shiftPrev').onclick=()=>{$('shiftMonth').value=monthAdd($('shiftMonth').value,-1);loadShifts(true)};$('shiftNext').onclick=()=>{$('shiftMonth').value=monthAdd($('shiftMonth').value,1);loadShifts(true)};$('shiftRefresh').onclick=()=>loadShifts(true);$('shiftMonth').onchange=()=>loadShifts(true);$('chatSearch').addEventListener('input',renderThreads);$('clientSearch').addEventListener('input',renderClients);$('sendBtn').onclick=sendMsg;$('msgText').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendMsg()}});setInterval(()=>{if(document.visibilityState==='visible'&&!$('app').classList.contains('hidden')){loadThreads();if(selectedThread)api('get_thread',{client_id:selectedThread}).then(x=>{messages=x.data||[];renderMessages()}).catch(()=>{})}},5000);boot();"
new_events="$('tabChat').onclick=()=>showTab('chat');$('tabClients').onclick=()=>showTab('clients');$('tabShifts').onclick=()=>showTab('shifts');$('shiftMonth').value=monthKey(new Date());$('shiftPrev').onclick=()=>{$('shiftMonth').value=monthAdd($('shiftMonth').value,-1);loadShifts(true)};$('shiftNext').onclick=()=>{$('shiftMonth').value=monthAdd($('shiftMonth').value,1);loadShifts(true)};$('shiftRefresh').onclick=()=>loadShifts(true);$('shiftMonth').onchange=()=>loadShifts(true);$('channelWeb').onclick=()=>setChatMode('web');$('channelWa').onclick=()=>setChatMode('whatsapp');$('chatSearch').addEventListener('input',renderThreads);$('clientSearch').addEventListener('input',renderClients);$('sendBtn').onclick=sendMsg;$('msgText').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendMsg()}});setInterval(()=>{if(document.visibilityState==='visible'&&!$('app').classList.contains('hidden')){loadThreads();if(selectedThread){const q=chatMode==='whatsapp'?waApi('get_thread',{client_id:selectedThread}):api('get_thread',{client_id:selectedThread});q.then(x=>{messages=chatMode==='whatsapp'?(x.data||[]).map(normalizeWaMessage):(x.data||[]);renderMessages()}).catch(()=>{})}}},5000);boot();"
once(old_events,new_events,'Eventi WhatsApp')

p.write_text(s,encoding='utf-8')
print('WhatsApp Shopify staff aggiunto, bytes:',len(s))

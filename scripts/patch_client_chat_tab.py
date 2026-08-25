from pathlib import Path

p=Path('_site/index.html')
s=p.read_text(encoding='utf-8')
MARK='OPTYKER_CLIENT_CHAT_TAB_V1'
if MARK in s:
    raise SystemExit(0)
if 'OPTYKER_CUSTOMER_CHAT_UI_V3' not in s or 'OPTYKER_OPERATOR_PROFILE_V1' not in s:
    raise SystemExit('Chat/profilo operatore non presenti prima della patch cliente')

def once(old,new,label):
    global s
    c=s.count(old)
    if c!=1: raise SystemExit(f'{label}: occorrenze {c}')
    s=s.replace(old,new,1)

def add_head(block):
    global s
    i=s.find('</head>')
    b=s.find('<body')
    if i<0 or (b>=0 and i>b): raise SystemExit('Chiusura head non trovata')
    s=s[:i]+block+s[i:]

def add_body_end(block):
    global s
    i=s.rfind('</body>')
    if i<0: raise SystemExit('Chiusura body finale non trovata')
    s=s[:i]+block+s[i:]

old="var types=order.concat(extras),h='<button class=\"clientRecordTab'+(clientWorkspaceSection==='anagrafica'?' active':'')+'\" type=\"button\" onclick=\"clientSelectWorkspaceSection(\\'anagrafica\\')\">Anagrafica</button>';"
new="var types=order.concat(extras),h='<button class=\"clientRecordTab'+(clientWorkspaceSection==='anagrafica'?' active':'')+'\" type=\"button\" onclick=\"clientSelectWorkspaceSection(\\'anagrafica\\')\">Anagrafica</button><button class=\"clientRecordTab'+(clientWorkspaceSection==='chat'?' active':'')+'\" type=\"button\" onclick=\"clientSelectWorkspaceSection(\\'chat\\')\">Chat</button>';"
once(old,new,'Tab Chat cliente')
once("if(clientWorkspaceSection==='anagrafica'||clientWorkspaceSection==='onlineorders'){dates.className='clientRecordDates';dates.innerHTML='';return;}","if(clientWorkspaceSection==='anagrafica'||clientWorkspaceSection==='onlineorders'||clientWorkspaceSection==='chat'){dates.className='clientRecordDates';dates.innerHTML='';return;}",'Date Chat')
once("var ana=g('clientAnagraficaSection'),sheets=g('clientSheetsSection'),info=g('clientInformativeSection'),orders=g('clientOnlineOrdersSection');\n  var isAna=clientWorkspaceSection==='anagrafica',isOrders=clientWorkspaceSection==='onlineorders';\n  if(ana)ana.style.display=isAna?'block':'none';\n  if(info)info.style.display=isAna?'block':'none';\n  if(orders)orders.style.display=isOrders?'block':'none';\n  if(sheets)sheets.style.display=(!isAna&&!isOrders)?'block':'none';","var ana=g('clientAnagraficaSection'),sheets=g('clientSheetsSection'),info=g('clientInformativeSection'),orders=g('clientOnlineOrdersSection'),chat=g('clientChatSection');\n  var isAna=clientWorkspaceSection==='anagrafica',isOrders=clientWorkspaceSection==='onlineorders',isChat=clientWorkspaceSection==='chat';\n  if(ana)ana.style.display=isAna?'block':'none';\n  if(info)info.style.display=isAna?'block':'none';\n  if(orders)orders.style.display=isOrders?'block':'none';\n  if(chat)chat.style.display=isChat?'block':'none';\n  if(sheets)sheets.style.display=(!isAna&&!isOrders&&!isChat)?'block':'none';",'Visibilita Chat')
once("if(clientWorkspaceSection==='onlineorders'){if(typeof window.clientRefreshCommerce==='function')window.clientRefreshCommerce();return;}\n  clientRenderVisits(true);","if(clientWorkspaceSection==='onlineorders'){if(typeof window.clientRefreshCommerce==='function')window.clientRefreshCommerce();return;}\n  if(clientWorkspaceSection==='chat'){if(typeof window.clientClientChatOpen==='function')window.clientClientChatOpen();return;}\n  clientRenderVisits(true);",'Apertura Chat')
once("clientApplyWorkspaceVisibility();clientRenderWorkspaceTabs();if(clientWorkspaceSection!=='anagrafica'&&clientWorkspaceSection!=='onlineorders')clientRenderFocusedSheet();","clientApplyWorkspaceVisibility();clientRenderWorkspaceTabs();if(clientWorkspaceSection==='chat'){if(typeof window.clientClientChatOpen==='function')window.clientClientChatOpen();return;}if(clientWorkspaceSection!=='anagrafica'&&clientWorkspaceSection!=='onlineorders')clientRenderFocusedSheet();",'Render Chat')

anchor='        <div id="clientSheetsSection" class="clientSheetSection clientSheetFocused" style="display:none">'
section='''        <div id="clientChatSection" class="clientBox clientChatSection" style="display:none">
          <div class="clientChatSectionHead">
            <div><div class="clientBoxTitle">Chat cliente</div><div id="clientChatSectionSub" class="clientVisitHint">Conversazione collegata direttamente a questo cliente.</div></div>
            <div class="clientChatSectionActions"><button class="secondary" type="button" onclick="clientClientChatCopyLink()">Copia link cliente</button><button class="secondary" type="button" onclick="clientClientChatOpenMain()">Apri nella Chat</button></div>
          </div>
          <div id="clientChatMessages" class="clientChatMessages"><div class="clientChatEmpty">Apri la scheda Chat per caricare la conversazione.</div></div>
          <div class="clientChatComposer"><textarea id="clientChatText" maxlength="4000" placeholder="Scrivi un messaggio al cliente…"></textarea><button id="clientChatSend" class="primary" type="button" onclick="clientClientChatSend()">Invia</button></div>
          <div id="clientChatStatus" class="clientChatStatus">La conversazione viene aggiornata automaticamente.</div>
        </div>

'''
once(anchor,section+anchor,'Sezione Chat cliente')

add_head('''
<style id="optykerClientChatTabCss">/* OPTYKER_CLIENT_CHAT_TAB_V1 */
.clientChatSection{grid-column:1/-1!important;padding:18px!important}.clientChatSectionHead{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;padding-bottom:12px;border-bottom:1px solid #e1e8ee}.clientChatSectionActions{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}.clientChatMessages{height:min(56vh,520px);min-height:330px;overflow:auto;margin-top:13px;padding:14px;border:1px solid #d9e3eb;border-radius:11px;background:linear-gradient(#f8fafc,#f4f7fa)}.clientChatMsg{display:flex;align-items:flex-end;gap:7px;margin:8px 0}.clientChatMsg.staff{justify-content:flex-end}.clientChatMsg.customer{justify-content:flex-start}.clientChatAvatar{width:32px;height:32px;flex:0 0 32px;border-radius:50%;overflow:hidden;background:#dcebf6;color:#1769aa;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:900;border:1px solid #c7dae8}.clientChatAvatar img{width:100%;height:100%;object-fit:cover;display:block}.clientChatMsg.staff .clientChatAvatar{order:2}.clientChatMsg.staff .clientChatBubble{order:1;background:#1769aa;border-color:#1769aa;color:#fff}.clientChatBubble{max-width:76%;padding:10px 12px;border:1px solid #dce5ed;border-radius:13px;background:#fff;box-shadow:0 1px 2px rgba(20,48,74,.04)}.clientChatSender{font-size:9px;font-weight:800;color:#587187;margin-bottom:3px}.clientChatMsg.staff .clientChatSender{color:#d7eafb}.clientChatText{font-size:12px;line-height:1.42;white-space:pre-wrap;word-break:break-word}.clientChatTime{font-size:8px;color:#8b99a6;margin-top:4px}.clientChatMsg.staff .clientChatTime{color:#d5e6f4}.clientChatComposer{display:flex;gap:8px;margin-top:10px}.clientChatComposer textarea{flex:1;min-height:48px!important;max-height:120px!important;resize:vertical}.clientChatComposer button{min-width:84px}.clientChatStatus{font-size:10px;color:#718294;padding:7px 2px 0}.clientChatStatus.bad{color:#b42323}.clientChatEmpty{padding:38px 14px;text-align:center;color:#788a99;font-size:12px}@media(max-width:700px){.clientChatSectionHead{flex-direction:column}.clientChatSectionActions{width:100%;justify-content:flex-start}.clientChatSectionActions button{flex:1}.clientChatMessages{height:54vh}.clientChatBubble{max-width:88%}.clientChatComposer{align-items:stretch}.clientChatComposer button{min-width:70px}}
</style>
''')

add_body_end('''
<script id="optykerClientChatTabJs">
(function(){
var S={clientId:'',messages:[],url:'',loading:false};
function E(i){return document.getElementById(i)}function X(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}function D(v){if(!v)return'';try{return new Date(v).toLocaleString('it-IT',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}catch(e){return String(v)}}
function api(a,p){if(!window.OPTYKER_CLOUD||!OPTYKER_CLOUD.username)return Promise.reject(new Error('Sessione non autenticata'));return fetch(OPTYKER_CLOUD.root+'/rest/v1/rpc/optyker_chat_api',{method:'POST',headers:{'Content-Type':'application/json','apikey':OPTYKER_CLOUD.key,'Authorization':'Bearer '+OPTYKER_CLOUD.key},body:JSON.stringify({p_username:OPTYKER_CLOUD.username,p_password:OPTYKER_CLOUD.password||'',p_action:a,p_payload:p||{}})}).then(function(r){if(!r.ok)throw new Error('Server '+r.status);return r.json()}).then(function(x){if(x&&x.ok===false)throw new Error(x.error||'Errore chat');return x})}
function st(t,b){var e=E('clientChatStatus');if(e){e.textContent=t;e.className='clientChatStatus'+(b?' bad':'')}}function clientName(){var c=(window.OPTYKER_CLOUD&&OPTYKER_CLOUD.clients||[]).filter(function(x){return String(x.id)===String(window.clientCurrentId||'')})[0]||{};return ((c.surname||'')+' '+(c.name||'')).trim()||'Cliente'}
function render(){var b=E('clientChatMessages');if(!b)return;if(!S.messages.length){b.innerHTML='<div class="clientChatEmpty">Nessun messaggio. Scrivi il primo messaggio al cliente.</div>';return}b.innerHTML=S.messages.map(function(m){var staff=m.sender_type==='staff',nm=m.sender_name||(staff?'Operatore':'Cliente'),ph=m.sender_photo||'',av='';if(staff){av='<div class="clientChatAvatar">'+(ph?'<img src="'+X(ph)+'" alt="">':X((String(nm).trim().charAt(0)||'O').toUpperCase()))+'</div>'}return '<div class="clientChatMsg '+(staff?'staff':'customer')+'">'+av+'<div class="clientChatBubble"><div class="clientChatSender">'+X(nm)+'</div><div class="clientChatText">'+X(m.message||'')+'</div><div class="clientChatTime">'+X(D(m.created_at))+'</div></div></div>'}).join('');b.scrollTop=b.scrollHeight}
window.clientClientChatOpen=function(){var id=window.clientCurrentId||'',box=E('clientChatMessages'),sub=E('clientChatSectionSub');if(!id){S.clientId='';S.messages=[];S.url='';if(box)box.innerHTML='<div class="clientChatEmpty">Salva prima il cliente per utilizzare la chat.</div>';st('Il cliente deve essere salvato prima di aprire la chat.',true);return Promise.resolve()}S.clientId=id;if(sub)sub.textContent='Conversazione con '+clientName()+' · operatore: '+((OPTYKER_CLOUD&&OPTYKER_CLOUD.username)||window.OPTYKER_ACTIVE_OPERATOR||'');if(S.loading)return Promise.resolve();S.loading=true;st('Caricamento conversazione…');return api('get_thread',{client_id:id}).then(function(x){S.messages=Array.isArray(x.data)?x.data:[];S.url=x.chat_url||'';render();st('Chat aggiornata automaticamente.')}).catch(function(e){if(box)box.innerHTML='<div class="clientChatEmpty">'+X(e.message)+'</div>';st(e.message,true)}).finally(function(){S.loading=false})};
window.clientClientChatSend=function(){var t=E('clientChatText'),b=E('clientChatSend'),m=String(t&&t.value||'').trim();if(!S.clientId||String(S.clientId)!==String(window.clientCurrentId||'')){window.clientClientChatOpen().then(function(){if(m)window.clientClientChatSend()});return}if(!m)return;b.disabled=true;api('send',{client_id:S.clientId,message:m}).then(function(){t.value='';return window.clientClientChatOpen()}).catch(function(e){st(e.message,true)}).finally(function(){b.disabled=false;t.focus()})};
window.clientClientChatCopyLink=function(){var id=window.clientCurrentId||S.clientId;if(!id){alert('Salva prima il cliente.');return}function cp(u){if(!u)return;if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(u).then(function(){st('Link cliente copiato.')}).catch(function(){prompt('Copia il link:',u)});else prompt('Copia il link:',u)}if(S.url&&String(S.clientId)===String(id)){cp(S.url);return}api('get_link',{client_id:id}).then(function(x){S.clientId=id;S.url=x.chat_url||'';cp(S.url)}).catch(function(e){alert(e.message)})};
window.clientClientChatOpenMain=function(){var id=window.clientCurrentId||'';if(!id){alert('Salva prima il cliente.');return}if(window.optykerOpenChat)window.optykerOpenChat();setTimeout(function(){if(window.optykerChatOpenThread)window.optykerChatOpenThread(id)},120)};
function poll(){var sec=E('clientChatSection');if(!sec||sec.style.display==='none'||window.clientWorkspaceSection!=='chat'||!window.clientCurrentId)return;var id=window.clientCurrentId;if(String(S.clientId)!==String(id)){window.clientClientChatOpen();return}api('get_thread',{client_id:id}).then(function(x){var a=Array.isArray(x.data)?x.data:[],n=a.map(function(m){return m.id+'|'+(m.sender_photo||'')}).join('|'),o=S.messages.map(function(m){return m.id+'|'+(m.sender_photo||'')}).join('|');if(n!==o){S.messages=a;S.url=x.chat_url||S.url;render()}}).catch(function(){})}
function boot(){var t=E('clientChatText');if(t)t.addEventListener('keydown',function(e){if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();window.clientClientChatSend()}});setInterval(poll,5000)}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
</script>
''')

p.write_text(s,encoding='utf-8')
print('Patch Chat nella scheda cliente applicata:',len(s))

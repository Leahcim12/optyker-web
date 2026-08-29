from pathlib import Path
import re

p=Path('_site/index.html')
s=p.read_text(encoding='utf-8')
MARK='OPTYKER_CHAT_IMAGES_CUSTOMER_AVATAR_V2'
if MARK in s:
    raise SystemExit(0)
if 'OPTYKER_CLIENT_CHAT_TAB_V1' not in s:
    raise SystemExit('Chat cliente non trovata')

# CSS per foto e visualizzatore.
head='''<style id="optykerChatImagesV2Css">/* OPTYKER_CHAT_IMAGES_CUSTOMER_AVATAR_V2 */
.clientChatPhoto{display:block;max-width:min(360px,72vw);max-height:420px;object-fit:cover;border-radius:10px;margin-top:7px;cursor:zoom-in;border:1px solid rgba(120,145,165,.28);background:#fff}
.clientChatMsg.staff .clientChatPhoto{border-color:rgba(255,255,255,.35)}
#optykerChatImageViewer{position:fixed;inset:0;z-index:250000;background:rgba(5,18,29,.93);display:none;align-items:center;justify-content:center;padding:20px}
#optykerChatImageViewer.open{display:flex}#optykerChatImageViewer img{max-width:96vw;max-height:92vh;object-fit:contain;cursor:zoom-out}
#optykerChatImageViewer button{position:absolute;right:18px;top:18px;width:44px;height:44px;border:0;border-radius:50%;background:#fff;color:#17324a;font-size:25px;box-shadow:0 5px 18px #0005}
</style>'''
i=s.find('</head>')
if i<0: raise SystemExit('head non trovato')
s=s[:i]+head+s[i:]

pat=r"function render\(\)\{var b=E\('clientChatMessages'\);[\s\S]*?\}\nwindow\.clientClientChatOpen=function"
m=re.search(pat,s)
if not m:
    raise SystemExit('Render chat cliente non trovato')

new=r'''function render(){var b=E('clientChatMessages');if(!b)return;if(!S.messages.length){b.innerHTML='<div class="clientChatEmpty">Nessun messaggio. Scrivi il primo messaggio al cliente.</div>';return}b.innerHTML=S.messages.map(function(m){var staff=m.sender_type==='staff',nm=m.sender_name||(staff?'Operatore':'Cliente'),ph=m.sender_photo||'',av='<div class="clientChatAvatar">'+(ph?'<img src="'+X(ph)+'" alt="">':X((String(nm).trim().charAt(0)||(staff?'O':'C')).toUpperCase()))+'</div>',photo=m.attachment_data?'<img class="clientChatPhoto" src="'+X(m.attachment_data)+'" alt="'+X(m.attachment_name||'Foto cliente')+'" title="Clicca per ingrandire">':'',txt=m.message?'<div class="clientChatText">'+X(m.message)+'</div>':'';return '<div class="clientChatMsg '+(staff?'staff':'customer')+'">'+av+'<div class="clientChatBubble"><div class="clientChatSender">'+X(nm)+'</div>'+txt+photo+'<div class="clientChatTime">'+X(D(m.created_at))+'</div></div></div>'}).join('');b.querySelectorAll('.clientChatPhoto').forEach(function(img){img.onclick=function(){window.optykerChatImageOpen(img.src)}});b.scrollTop=b.scrollHeight}
window.clientClientChatOpen=function'''
s=s[:m.start()]+new+s[m.end():]

# Viewer globale.
b=s.rfind('</body>')
if b<0: raise SystemExit('body non trovato')
viewer='''<div id="optykerChatImageViewer" aria-hidden="true"><button type="button" onclick="optykerChatImageClose()">×</button><img id="optykerChatImageViewerImg" alt="Foto chat ingrandita"></div>
<script id="optykerChatImageViewerJs">
(function(){
window.optykerChatImageOpen=function(src){var v=document.getElementById('optykerChatImageViewer'),i=document.getElementById('optykerChatImageViewerImg');if(!v||!i||!src)return;i.src=src;v.classList.add('open');v.setAttribute('aria-hidden','false')};
window.optykerChatImageClose=function(){var v=document.getElementById('optykerChatImageViewer'),i=document.getElementById('optykerChatImageViewerImg');if(v){v.classList.remove('open');v.setAttribute('aria-hidden','true')}if(i)i.src=''};
document.addEventListener('click',function(e){var v=document.getElementById('optykerChatImageViewer');if(v&&e.target===v)window.optykerChatImageClose();var img=e.target&&e.target.closest?e.target.closest('.chatMessagePhoto,.optykerChatPhoto,[data-optyker-chat-photo]'):null;if(img&&img.src)window.optykerChatImageOpen(img.src)});
document.addEventListener('keydown',function(e){if(e.key==='Escape')window.optykerChatImageClose()});
})();
</script>
<!-- OPTYKER_CHAT_IMAGES_CUSTOMER_AVATAR_V2 -->'''
s=s[:b]+viewer+s[b:]

for req in [MARK,'clientChatPhoto','optykerChatImageViewer','attachment_data']:
    if req not in s: raise SystemExit('Patch foto chat incompleta: '+req)

p.write_text(s,encoding='utf-8')
print('Chat Optyker: foto cliente, avatar cliente e ingrandimento attivi')

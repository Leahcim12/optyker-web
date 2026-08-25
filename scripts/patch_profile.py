from pathlib import Path
import re

p=Path('_site/index.html')
s=p.read_text(encoding='utf-8')
MARK='OPTYKER_OPERATOR_PROFILE_V1'

# Let the global topbar manager preserve the existing Dashboard and the new profile button.
old="if(!ch.classList.contains('optykerGlobalSearchWrap')&&ch.id!=='optykerTopNewClientBtn')ch.remove();"
new="if(!ch.classList.contains('optykerGlobalSearchWrap')&&ch.id!=='optykerTopNewClientBtn'&&ch.id!=='optykerTopDashboardBtn'&&ch.id!=='optykerTopProfileBtn')ch.remove();"
if old in s:
    s=s.replace(old,new,1)
elif new not in s:
    raise SystemExit('Gestore topbar globale non trovato')

# Upgrade staff chat bubbles so the saved operator photo is visible beside staff messages.
old_msgs="""function msgs(){var b=E('optykerChatMessages');if(!b)return;if(!S.messages.length){b.innerHTML='<div class=\"optykerChatEmpty\">Nessun messaggio. Scrivi il primo messaggio.</div>';return}b.innerHTML=S.messages.map(function(m){var st=m.sender_type==='staff';return '<div class=\"optykerChatMsg '+(st?'staff':'customer')+'\"><div class=\"optykerChatBubble\"><div class=\"optykerChatSender\">'+X(m.sender_name||(st?'Operatore':'Cliente'))+'</div><div class=\"optykerChatText\">'+X(m.message||'')+'</div><div class=\"optykerChatTime\">'+X(D(m.created_at))+'</div></div></div>'}).join('');b.scrollTop=b.scrollHeight}"""
new_msgs="""function msgs(){var b=E('optykerChatMessages');if(!b)return;if(!S.messages.length){b.innerHTML='<div class=\"optykerChatEmpty\">Nessun messaggio. Scrivi il primo messaggio.</div>';return}b.innerHTML=S.messages.map(function(m){var st=m.sender_type==='staff',nm=m.sender_name||(st?'Operatore':'Cliente'),ph=m.sender_photo||'',av='';if(st){av='<div class=\"optykerChatAvatar\">'+(ph?'<img src=\"'+X(ph)+'\" alt=\"\">':X((String(nm).trim().charAt(0)||'O').toUpperCase()))+'</div>';}return '<div class=\"optykerChatMsg '+(st?'staff':'customer')+'\">'+av+'<div class=\"optykerChatBubble\"><div class=\"optykerChatSender\">'+X(nm)+'</div><div class=\"optykerChatText\">'+X(m.message||'')+'</div><div class=\"optykerChatTime\">'+X(D(m.created_at))+'</div></div></div>'}).join('');b.scrollTop=b.scrollHeight}"""
if old_msgs in s:
    s=s.replace(old_msgs,new_msgs,1)
elif 'optykerChatAvatar' not in s:
    raise SystemExit('Renderer messaggi chat non trovato')

if MARK not in s:
    head=s.find('</head>')
    body=s.rfind('</body>')
    if head < 0 or body < 0:
        raise SystemExit('HTML non valido')
    css=r'''
<style id="optykerOperatorProfileCss">/* OPTYKER_OPERATOR_PROFILE_V1 */
#optykerTopProfileBtn{width:42px!important;height:42px!important;flex:0 0 42px!important;border:1px solid #cdd9e4!important;border-radius:50%!important;background:#fff!important;color:#17324a!important;padding:0!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;overflow:hidden!important;cursor:pointer!important;font-size:17px!important;font-weight:900!important;box-shadow:0 3px 10px rgba(20,48,74,.08)!important}
#optykerTopProfileBtn:hover{background:#f4f8fb!important}#optykerTopProfileBtn img{width:100%!important;height:100%!important;object-fit:cover!important;display:block!important}
.optykerProfileModal{position:fixed;inset:0;z-index:120000;background:rgba(19,39,57,.34);display:none;align-items:flex-start;justify-content:flex-end;padding:72px 22px 22px}.optykerProfileModal.open{display:flex}.optykerProfileCard{width:min(380px,calc(100vw - 28px));background:#fff;border:1px solid #d9e3eb;border-radius:16px;box-shadow:0 20px 55px rgba(21,44,66,.24);padding:18px}.optykerProfileTop{display:flex;align-items:center;justify-content:space-between;gap:12px}.optykerProfileTitle{font-size:18px;font-weight:900;color:#17324a}.optykerProfileClose{width:34px;height:34px;border:0;border-radius:9px;background:#eef3f7;color:#324b60;font-size:20px;cursor:pointer}.optykerProfilePhotoRow{display:flex;align-items:center;gap:14px;margin:18px 0}.optykerProfilePreview{width:78px;height:78px;border-radius:50%;border:2px solid #d5e1ea;background:#f4f7fa;display:flex;align-items:center;justify-content:center;overflow:hidden;color:#1769aa;font-size:26px;font-weight:900;cursor:pointer}.optykerProfilePreview img{width:100%;height:100%;object-fit:cover}.optykerProfilePhotoText{font-size:12px;color:#687b8c;line-height:1.4}.optykerProfilePhotoText b{display:block;color:#17324a;margin-bottom:3px}.optykerProfileField label{display:block;font-size:11px;font-weight:800;color:#4c6173;margin:0 0 5px}.optykerProfileField input{width:100%;height:42px;border:1px solid #ccd8e2;border-radius:9px;padding:0 11px;box-sizing:border-box}.optykerProfileUser{font-size:11px;color:#728697;margin-top:6px}.optykerProfileActions{display:flex;justify-content:flex-end;gap:8px;margin-top:16px}.optykerProfileActions button{height:40px;border:0;border-radius:9px;padding:0 15px;font-weight:800;cursor:pointer}.optykerProfileRemove{background:#eef2f6;color:#44596b}.optykerProfileSave{background:#1769aa;color:#fff}.optykerProfileStatus{min-height:16px;font-size:10px;color:#6f8291;margin-top:8px}.optykerProfileStatus.bad{color:#b42323}
.optykerChatAvatar{width:32px;height:32px;flex:0 0 32px;border-radius:50%;overflow:hidden;background:#dcebf6;color:#1769aa;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:900;border:1px solid #c7dae8;align-self:flex-end}.optykerChatAvatar img{width:100%;height:100%;object-fit:cover;display:block}.optykerChatMsg.staff{gap:7px;align-items:flex-end}.optykerChatMsg.staff .optykerChatAvatar{order:2}.optykerChatMsg.staff .optykerChatBubble{order:1}
@media(max-width:760px){.optykerProfileModal{padding:62px 10px 10px;align-items:flex-start}.optykerProfileCard{width:100%}#optykerTopProfileBtn{width:38px!important;height:38px!important;flex-basis:38px!important}}
</style>
'''
    s=s[:head]+css+s[head:]
    body=s.rfind('</body>')
    html=r'''
<div id="optykerProfileModal" class="optykerProfileModal" aria-hidden="true">
  <div class="optykerProfileCard" role="dialog" aria-modal="true" aria-labelledby="optykerProfileTitle">
    <div class="optykerProfileTop"><div id="optykerProfileTitle" class="optykerProfileTitle">Profilo operatore</div><button id="optykerProfileClose" class="optykerProfileClose" type="button" aria-label="Chiudi">×</button></div>
    <div class="optykerProfilePhotoRow"><div id="optykerProfilePreview" class="optykerProfilePreview" title="Cambia foto">👤</div><div class="optykerProfilePhotoText"><b>Foto profilo</b>Clicca sulla foto per sceglierne una. Verrà visualizzata nelle chat.</div></div>
    <input id="optykerProfileFile" type="file" accept="image/jpeg,image/png,image/webp" hidden>
    <div class="optykerProfileField"><label for="optykerProfileEmail">Email</label><input id="optykerProfileEmail" type="email" autocomplete="email" placeholder="nome@esempio.it"></div>
    <div id="optykerProfileUser" class="optykerProfileUser"></div>
    <div class="optykerProfileActions"><button id="optykerProfileRemove" class="optykerProfileRemove" type="button">Rimuovi foto</button><button id="optykerProfileSave" class="optykerProfileSave" type="button">Salva profilo</button></div>
    <div id="optykerProfileStatus" class="optykerProfileStatus"></div>
  </div>
</div>
<script id="optykerOperatorProfileJs">
(function(){
var P={user:'',email:'',photo:'',loaded:false,busy:false};
function E(i){return document.getElementById(i)}
function user(){return window.OPTYKER_CLOUD&&OPTYKER_CLOUD.username?String(OPTYKER_CLOUD.username).trim():''}
function initials(n){var a=String(n||'').trim().split(/\s+/).filter(Boolean);return ((a[0]||'O').charAt(0)+(a.length>1?a[a.length-1].charAt(0):'')).toUpperCase()}
function api(action,payload){if(!user()||!window.OPTYKER_CLOUD)return Promise.reject(new Error('Sessione non autenticata'));return fetch(OPTYKER_CLOUD.root+'/rest/v1/rpc/optyker_chat_api',{method:'POST',headers:{'Content-Type':'application/json','apikey':OPTYKER_CLOUD.key,'Authorization':'Bearer '+OPTYKER_CLOUD.key},body:JSON.stringify({p_username:OPTYKER_CLOUD.username,p_password:OPTYKER_CLOUD.password||'',p_action:action,p_payload:payload||{}})}).then(function(r){if(!r.ok)throw new Error('Server '+r.status);return r.json()}).then(function(x){if(!x||x.ok===false)throw new Error(x&&x.error||'Errore profilo');return x})}
function paint(){var b=E('optykerTopProfileBtn'),v=E('optykerProfilePreview'),u=user(),content=P.photo?'<img src="'+P.photo+'" alt="">':initials(u);if(b)b.innerHTML=content;if(v)v.innerHTML=content;var em=E('optykerProfileEmail');if(em&&document.activeElement!==em)em.value=P.email||'';var us=E('optykerProfileUser');if(us)us.textContent=u?'Operatore: '+u:''}
function topbar(){var r=document.querySelector('.topbarRight'),n=E('optykerTopNewClientBtn');if(!r||!n||!user())return;var b=E('optykerTopProfileBtn');if(!b){b=document.createElement('button');b.id='optykerTopProfileBtn';b.type='button';b.title='Profilo operatore';b.setAttribute('aria-label','Profilo operatore');b.onclick=open;}var d=E('optykerTopDashboardBtn');if(b.parentNode!==r||b.nextElementSibling!==(d||n))r.insertBefore(b,d||n);paint()}
function setStatus(t,bad){var e=E('optykerProfileStatus');if(e){e.textContent=t||'';e.className='optykerProfileStatus'+(bad?' bad':'')}}
function load(force){var u=user();if(!u)return Promise.resolve();if(P.loaded&&P.user===u&&!force){topbar();return Promise.resolve()}P.user=u;P.loaded=false;return api('profile_get',{}).then(function(x){var d=x.data||{};P.email=d.email||'';P.photo=d.photo_data||'';P.loaded=true;paint();topbar()}).catch(function(){P.email='';P.photo='';P.loaded=true;paint();topbar()})}
function open(){load(false).then(function(){var m=E('optykerProfileModal');if(m){m.classList.add('open');m.setAttribute('aria-hidden','false');paint();setStatus('')}})}
function close(){var m=E('optykerProfileModal');if(m){m.classList.remove('open');m.setAttribute('aria-hidden','true')}}
function resize(file){return new Promise(function(resolve,reject){if(!file||!/^image\/(jpeg|png|webp)$/.test(file.type)){reject(new Error('Scegli una foto JPG, PNG o WEBP'));return}var rd=new FileReader();rd.onerror=function(){reject(new Error('Impossibile leggere la foto'))};rd.onload=function(){var im=new Image();im.onerror=function(){reject(new Error('Foto non valida'))};im.onload=function(){var max=320,w=im.naturalWidth,h=im.naturalHeight,scale=Math.min(1,max/Math.max(w,h));w=Math.max(1,Math.round(w*scale));h=Math.max(1,Math.round(h*scale));var c=document.createElement('canvas');c.width=w;c.height=h;var x=c.getContext('2d');x.drawImage(im,0,0,w,h);resolve(c.toDataURL('image/jpeg',.82))};im.src=String(rd.result)};rd.readAsDataURL(file)})}
function save(){if(P.busy)return;var em=String(E('optykerProfileEmail').value||'').trim();if(em&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)){setStatus('Inserisci un’email valida.',true);return}P.busy=true;E('optykerProfileSave').disabled=true;setStatus('Salvataggio…');api('profile_save',{email:em,photo_data:P.photo||''}).then(function(x){P.email=(x.data&&x.data.email)||em;P.photo=(x.data&&x.data.photo_data)||P.photo;P.loaded=true;paint();setStatus('Profilo salvato. La foto è attiva nelle chat.');setTimeout(close,700)}).catch(function(e){setStatus(e.message||'Errore salvataggio',true)}).finally(function(){P.busy=false;E('optykerProfileSave').disabled=false})}
E('optykerProfilePreview').onclick=function(){E('optykerProfileFile').click()};E('optykerProfileFile').onchange=function(){var f=this.files&&this.files[0];if(!f)return;setStatus('Preparazione foto…');resize(f).then(function(d){P.photo=d;paint();setStatus('Foto pronta. Premi Salva profilo.')}).catch(function(e){setStatus(e.message,true)});this.value=''};E('optykerProfileRemove').onclick=function(){P.photo='';paint();setStatus('Foto rimossa. Premi Salva profilo.')};E('optykerProfileSave').onclick=save;E('optykerProfileClose').onclick=close;E('optykerProfileModal').onclick=function(ev){if(ev.target===this)close()};document.addEventListener('keydown',function(ev){if(ev.key==='Escape')close()});
var last='';setInterval(function(){var u=user();if(u&&u!==last){last=u;P.loaded=false;load(true)}else if(u){topbar()}},900);if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){load(false);topbar()});else{load(false);topbar()}
})();
</script>
'''
    s=s[:body]+html+s[body:]

p.write_text(s,encoding='utf-8')
if MARK not in s or 'optykerTopProfileBtn' not in s:
    raise SystemExit('Profilo operatore non inserito')
print('Operator profile patch OK')

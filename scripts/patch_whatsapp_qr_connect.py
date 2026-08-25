from pathlib import Path

p=Path('_site/index.html')
s=p.read_text(encoding='utf-8')
MARK='OPTYKER_WHATSAPP_QR_CONNECT_V1'
if MARK in s:
    raise SystemExit(0)
if 'OPTYKER_WHATSAPP_CHANNEL_V2' not in s or 'id="optykerSettingsPanel"' not in s:
    raise SystemExit('Impostazioni WhatsApp non presenti prima della patch QR')

def add_head(block):
    global s
    i=s.find('</head>'); b=s.find('<body')
    if i<0 or (b>=0 and i>b): raise SystemExit('Chiusura head non trovata')
    s=s[:i]+block+s[i:]

def add_body_end(block):
    global s
    i=s.rfind('</body>')
    if i<0: raise SystemExit('Chiusura body finale non trovata')
    s=s[:i]+block+s[i:]

add_head('''
<style id="optykerWhatsappQrConnectCss">/* OPTYKER_WHATSAPP_QR_CONNECT_V1 */
.optykerWaQrCard{margin:14px 0 4px;padding:15px;border:1px solid #cfe7d8;border-radius:12px;background:linear-gradient(180deg,#f7fffa,#f3fbf6)}.optykerWaQrTop{display:flex;align-items:center;gap:13px}.optykerWaQrIcon{width:46px;height:46px;flex:0 0 46px;border-radius:11px;background:#1f9f55;color:#fff;display:flex;align-items:center;justify-content:center;font-size:23px;font-weight:900;box-shadow:0 4px 12px rgba(31,159,85,.18)}.optykerWaQrTitle{font-size:14px;font-weight:850;color:#173c28}.optykerWaQrText{font-size:10px;line-height:1.45;color:#60766a;margin-top:3px}.optykerWaQrActions{margin-left:auto;display:flex;gap:7px;flex-wrap:wrap}.optykerWaQrBtn{background:#1f9f55!important;border-color:#1f9f55!important;color:#fff!important;font-weight:850!important}.optykerWaQrAdvanced{display:none;margin-top:12px;padding-top:12px;border-top:1px solid #dcebe1}.optykerWaQrAdvanced.open{display:block}.optykerWaQrGrid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.optykerWaQrHint{font-size:9px;color:#728379;margin-top:7px;line-height:1.45}.optykerWaQrStatus{margin-top:9px;min-height:14px;font-size:10px;font-weight:700;color:#2c6844}.optykerWaQrStatus.bad{color:#b42323}.optykerWaQrStatus.wait{color:#8a5a00}.optykerWaQrBadge{display:inline-flex;align-items:center;gap:5px;padding:3px 7px;border-radius:999px;background:#e7f7ed;color:#18733f;font-size:9px;font-weight:850;margin-left:6px}@media(max-width:760px){.optykerWaQrTop{align-items:flex-start;flex-wrap:wrap}.optykerWaQrActions{width:100%;margin-left:59px}.optykerWaQrActions button{flex:1}.optykerWaQrGrid{grid-template-columns:1fr}}
</style>
''')

add_body_end(r'''
<script id="optykerWhatsappQrConnectJs">
(function(){
var API='https://whgziwaegjzqsgcntesr.supabase.co/functions/v1/optyker-whatsapp-api';
var KAPP='optyker_meta_app_id_v1',KCFG='optyker_meta_embedded_config_id_v1';
var state={finish:null,auth:null,busy:false,mounted:false};
function E(i){return document.getElementById(i)}
function creds(){return {username:window.OPTYKER_CLOUD&&OPTYKER_CLOUD.username||window.OPTYKER_ACTIVE_OPERATOR||'',password:window.OPTYKER_CLOUD&&OPTYKER_CLOUD.password||''}}
function api(action,payload){var c=creds();return fetch(API,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({username:c.username,password:c.password,action:action,payload:payload||{}})}).then(function(r){return r.json().then(function(x){if(!r.ok||x.ok===false)throw new Error(x.error||'Errore WhatsApp');return x})})}
function stat(t,kind){var e=E('optykerWaQrStatus');if(!e)return;e.textContent=t||'';e.className='optykerWaQrStatus'+(kind?' '+kind:'')}
function saveMeta(){try{localStorage.setItem(KAPP,String(E('optykerWaMetaAppId')&&E('optykerWaMetaAppId').value||'').trim());localStorage.setItem(KCFG,String(E('optykerWaMetaConfigId')&&E('optykerWaMetaConfigId').value||'').trim())}catch(e){}}
function loadMeta(){try{if(E('optykerWaMetaAppId'))E('optykerWaMetaAppId').value=localStorage.getItem(KAPP)||'';if(E('optykerWaMetaConfigId'))E('optykerWaMetaConfigId').value=localStorage.getItem(KCFG)||''}catch(e){}}
function toggleAdvanced(force){var a=E('optykerWaQrAdvanced');if(!a)return;var open=typeof force==='boolean'?force:!a.classList.contains('open');a.classList.toggle('open',open)}
function mount(){if(state.mounted||E('optykerWaQrConnect')){state.mounted=true;return true}var card=document.querySelector('#optykerSettingsPanel .optykerSettingsCard');if(!card)return false;var d=document.createElement('div');d.id='optykerWaQrConnect';d.className='optykerWaQrCard';d.innerHTML='<div class="optykerWaQrTop"><div class="optykerWaQrIcon">▦</div><div style="min-width:180px;flex:1"><div class="optykerWaQrTitle">Collega WhatsApp con QR <span class="optykerWaQrBadge">Meta ufficiale</span></div><div class="optykerWaQrText">Per un numero già attivo nell’app WhatsApp Business. Meta apre il flusso di Coexistence e mostra il QR da scansionare direttamente dall’app.</div></div><div class="optykerWaQrActions"><button id="optykerWaQrStart" class="primary optykerWaQrBtn" type="button">Collega con QR</button><button id="optykerWaQrAdvancedBtn" class="secondary" type="button">Configurazione Meta</button></div></div><div id="optykerWaQrAdvanced" class="optykerWaQrAdvanced"><div class="optykerWaQrGrid"><div class="field"><label for="optykerWaMetaAppId">Meta App ID</label><input id="optykerWaMetaAppId" type="text" inputmode="numeric" placeholder="App ID della tua app Meta"></div><div class="field"><label for="optykerWaMetaConfigId">Embedded Signup Configuration ID</label><input id="optykerWaMetaConfigId" type="text" inputmode="numeric" placeholder="Configuration ID Meta"></div></div><div class="optykerWaQrHint">Questi due ID non sono password e vengono salvati solo in questo browser. L’Access Token permanente resta nella configurazione avanzata WhatsApp già presente sotto.</div></div><div id="optykerWaQrStatus" class="optykerWaQrStatus"></div>';
var head=card.querySelector('.optykerSettingsCardHead');if(head&&head.nextSibling)card.insertBefore(d,head.nextSibling);else card.insertBefore(d,card.firstChild);state.mounted=true;loadMeta();E('optykerWaQrAdvancedBtn').addEventListener('click',function(){toggleAdvanced()});E('optykerWaQrStart').addEventListener('click',start);E('optykerWaMetaAppId').addEventListener('change',saveMeta);E('optykerWaMetaConfigId').addEventListener('change',saveMeta);return true}
function ensureFB(appId){return new Promise(function(resolve,reject){function init(){try{window.FB.init({appId:appId,cookie:true,xfbml:false,version:'v23.0'});resolve(window.FB)}catch(e){reject(e)}}if(window.FB){init();return}var old=window.fbAsyncInit;window.fbAsyncInit=function(){try{if(typeof old==='function')old()}catch(e){}init()};var ex=document.getElementById('facebook-jssdk');if(ex)return;var js=document.createElement('script');js.id='facebook-jssdk';js.async=true;js.defer=true;js.crossOrigin='anonymous';js.src='https://connect.facebook.net/it_IT/sdk.js';js.onerror=function(){reject(new Error('Impossibile caricare il collegamento Meta'))};document.head.appendChild(js)})}
function dataIds(d){d=d||{};var p=d.data&&typeof d.data==='object'?d.data:d;return {waba:String(p.waba_id||p.business_account_id||p.wabaId||''),phone:String(p.phone_number_id||p.phoneNumberId||'')}}
function finishIfReady(){if(state.busy||!state.finish)return;var ids=dataIds(state.finish);if(!ids.waba){stat('QR completato ma Meta non ha restituito i dati del Business Account. Riprova il collegamento.', 'bad');return}state.busy=true;stat('QR acquisito. Sto completando il collegamento dentro Optyker…','wait');var token=state.auth&&state.auth.accessToken||'';api('embedded_finish',{business_account_id:ids.waba,phone_number_id:ids.phone,access_token:token}).then(function(x){var d=x.data||{};if(E('optykerWaEnabled'))E('optykerWaEnabled').checked=true;if(E('optykerWaPhoneNumberId'))E('optykerWaPhoneNumberId').value=d.phone_number_id||ids.phone;if(E('optykerWaBusinessId'))E('optykerWaBusinessId').value=d.business_account_id||ids.waba;var t=E('optykerWaConnectionTitle'),m=E('optykerWaConnectionMeta');if(t)t.textContent='WhatsApp collegato ✓';if(m)m.textContent=(d.verified_name||'Account Meta')+(d.display_phone_number?' · '+d.display_phone_number:'');stat('WhatsApp Business collegato correttamente con QR.','');}).catch(function(e){stat(e.message,'bad');toggleAdvanced(false)}).finally(function(){state.busy=false})}
function start(){mount();saveMeta();var app=String(E('optykerWaMetaAppId')&&E('optykerWaMetaAppId').value||'').trim(),cfg=String(E('optykerWaMetaConfigId')&&E('optykerWaMetaConfigId').value||'').trim();if(!app||!cfg){toggleAdvanced(true);stat('Inserisci una sola volta Meta App ID e Configuration ID, poi premi di nuovo “Collega con QR”.','bad');return}state.finish=null;state.auth=null;stat('Apertura del collegamento ufficiale Meta…','wait');ensureFB(app).then(function(FB){FB.login(function(r){state.auth=r&&r.authResponse||null;if(!r||!r.authResponse){stat('Collegamento annullato o non completato.','bad');return}if(state.finish)finishIfReady();else stat('Completa il flusso Meta e scansiona il QR con WhatsApp Business.','wait')},{config_id:cfg,response_type:'code',override_default_response_type:true,extras:{version:'v4',featureType:'whatsapp_business_app_onboarding'}})}).catch(function(e){stat(e.message||String(e),'bad')})}
window.addEventListener('message',function(ev){try{var host=new URL(ev.origin).hostname;if(!(host==='facebook.com'||host.endsWith('.facebook.com')))return}catch(e){return}var d=ev.data;try{if(typeof d==='string')d=JSON.parse(d)}catch(e){}if(!d||d.type!=='WA_EMBEDDED_SIGNUP')return;var evt=String(d.event||'');if(evt==='FINISH'||evt==='FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING'){state.finish=d;stat('QR confermato da Meta. Finalizzazione in corso…','wait');finishIfReady()}else if(evt==='CANCEL'){stat('Collegamento QR annullato.','bad')}else if(evt==='ERROR'){stat('Meta ha segnalato un errore nel collegamento QR.','bad')}});
function boot(){var tries=0;(function t(){if(mount())return;if(++tries<40)setTimeout(t,250)})();var mo=new MutationObserver(function(){mount()});mo.observe(document.documentElement,{childList:true,subtree:true})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
</script>
''')

p.write_text(s,encoding='utf-8')
print('Patch WhatsApp QR Meta applicata:',len(s))

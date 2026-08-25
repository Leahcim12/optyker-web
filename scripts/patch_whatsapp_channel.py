from pathlib import Path

p=Path('_site/index.html')
s=p.read_text(encoding='utf-8')
MARK='OPTYKER_WHATSAPP_CHANNEL_V1'
if MARK in s:
    raise SystemExit(0)
if 'OPTYKER_CLIENT_CHAT_TAB_V1' not in s or 'OPTYKER_CUSTOMER_CHAT_UI_V3' not in s:
    raise SystemExit('Chat Optyker non pronta per WhatsApp')

def once(old,new,label):
    global s
    c=s.count(old)
    if c!=1: raise SystemExit(f'{label}: occorrenze {c}')
    s=s.replace(old,new,1)

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

anchor='    <button id="navOrders" class="moduleBtn" type="button" onclick="openOnlineOrders()">Ordini</button>'
settings_btn='    <button id="navSettings" class="moduleBtn" data-short="Impostazioni" type="button" onclick="optykerOpenSettings()"><span class="winNavIcon" aria-hidden="true">⚙</span><span>Impostazioni</span></button>'
once(anchor,anchor+'\n'+settings_btn,'Pulsante Impostazioni')

orders='  <div id="onlineOrdersPanel" class="panel">'
panel='''  <div id="optykerSettingsPanel" class="panel optykerSettingsPanel" style="display:none">
    <div class="optykerSettingsHead"><div><div class="optykerSettingsKicker">Optyker</div><div class="optykerSettingsTitle">Impostazioni</div><div class="optykerSettingsSub">Configura i canali usati per contattare i clienti.</div></div><button class="secondary" type="button" onclick="showDashboard()">Dashboard</button></div>
    <div class="optykerSettingsCard">
      <div class="optykerSettingsCardHead"><div><div class="optykerSettingsCardTitle">WhatsApp</div><div class="optykerSettingsCardText">Abilita WhatsApp come alternativa alla chat della web app.</div></div><label class="optykerWaSwitch"><input id="optykerWaEnabled" type="checkbox"><span></span></label></div>
      <div class="optykerSettingsGrid">
        <div class="field"><label for="optykerWaBusinessNumber">Numero WhatsApp aziendale</label><input id="optykerWaBusinessNumber" type="tel" placeholder="+39 333 1234567"></div>
        <div class="field"><label for="optykerWaCountryCode">Prefisso paese predefinito</label><input id="optykerWaCountryCode" type="text" inputmode="numeric" maxlength="4" value="39" placeholder="39"></div>
      </div>
      <div class="optykerSettingsNote">Il collegamento al tuo account viene completato direttamente in WhatsApp Web. Optyker usa il numero del cliente salvato in anagrafica e apre la conversazione con il testo già compilato. I messaggi WhatsApp restano su WhatsApp e non vengono duplicati nella chat Optyker.</div>
      <div class="optykerSettingsActions"><button id="optykerWaOpenWeb" class="secondary" type="button">Apri / collega WhatsApp Web</button><button id="optykerWaSave" class="primary" type="button">Salva impostazioni</button></div>
      <div id="optykerWaSettingsStatus" class="optykerSettingsStatus"></div>
    </div>
  </div>

'''
once(orders,panel+orders,'Pannello Impostazioni')

add_head('''
<style id="optykerWhatsappChannelCss">/* OPTYKER_WHATSAPP_CHANNEL_V1 */
#optykerSettingsPanel{grid-column:2!important;min-width:0}.optykerSettingsHead{display:flex;justify-content:space-between;align-items:flex-start;gap:14px;border-bottom:1px solid rgba(0,0,0,.09);padding-bottom:13px}.optykerSettingsKicker{font-size:10px;font-weight:800;color:#1769aa;text-transform:uppercase;letter-spacing:.5px}.optykerSettingsTitle{font-size:24px;font-weight:650;margin-top:2px}.optykerSettingsSub{font-size:11px;color:#6d7f8f;margin-top:4px}.optykerSettingsCard{max-width:780px;margin-top:16px;border:1px solid #dce5ed;border-radius:12px;background:#fff;padding:17px}.optykerSettingsCardHead{display:flex;justify-content:space-between;align-items:center;gap:14px;padding-bottom:13px;border-bottom:1px solid #e6ebef}.optykerSettingsCardTitle{font-size:16px;font-weight:800;color:#17324a}.optykerSettingsCardText{font-size:11px;color:#718294;margin-top:3px}.optykerSettingsGrid{display:grid;grid-template-columns:2fr 1fr;gap:12px;margin-top:14px}.optykerSettingsNote{margin-top:12px;padding:11px 12px;border:1px solid #d9e8f2;border-radius:9px;background:#f5faff;color:#587187;font-size:10px;line-height:1.45}.optykerSettingsActions{display:flex;justify-content:flex-end;gap:8px;margin-top:13px;flex-wrap:wrap}.optykerSettingsStatus{font-size:10px;color:#4b6b82;margin-top:8px;min-height:14px}.optykerSettingsStatus.bad{color:#b42323}.optykerWaSwitch{position:relative;width:46px;height:26px;flex:0 0 46px}.optykerWaSwitch input{opacity:0;width:0;height:0}.optykerWaSwitch span{position:absolute;inset:0;border-radius:999px;background:#c9d4dc;cursor:pointer;transition:.18s}.optykerWaSwitch span:before{content:'';position:absolute;width:20px;height:20px;left:3px;top:3px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.2);transition:.18s}.optykerWaSwitch input:checked+span{background:#1769aa}.optykerWaSwitch input:checked+span:before{transform:translateX(20px)}.optykerChatChannelBar,.clientChatChannelBar{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:9px 11px;border-bottom:1px solid #e2e8ed;background:#fbfcfd}.clientChatChannelBar{margin-top:12px;border:1px solid #dce5ed;border-radius:10px}.optykerChatChannelLabel{font-size:10px;font-weight:800;color:#526b80}.optykerChatChannelBtns{display:flex;gap:6px}.optykerChatChannelBtn{min-height:34px!important;padding:0 11px!important;border:1px solid #cad7e1!important;border-radius:8px!important;background:#fff!important;color:#25455f!important;font-size:10px!important;font-weight:800!important;cursor:pointer!important}.optykerChatChannelBtn.active{border-color:#1769aa!important;background:#eaf5fd!important;color:#1769aa!important}.optykerChatChannelBtn[data-channel="whatsapp"].active{border-color:#1f8b4c!important;background:#eefaf3!important;color:#18733f!important}.optykerWaMissing{font-size:9px;color:#a55a00;margin-left:auto}@media(max-width:900px){#optykerSettingsPanel{grid-column:1!important}}@media(max-width:700px){.optykerSettingsGrid{grid-template-columns:1fr}.optykerSettingsActions button{flex:1}.optykerChatChannelBar,.clientChatChannelBar{align-items:flex-start;flex-direction:column}.optykerChatChannelBtns{width:100%}.optykerChatChannelBtn{flex:1}}
</style>
''')

add_body_end(r'''
<script id="optykerWhatsappChannelJs">
(function(){
var KEY='optyker_whatsapp_settings_v1';var mode={client:'web',main:'web'};var wrapping=false;
function E(i){return document.getElementById(i)}function user(){return window.OPTYKER_CLOUD&&OPTYKER_CLOUD.username?String(OPTYKER_CLOUD.username).trim():(window.OPTYKER_ACTIVE_OPERATOR||'')}
function key(){return KEY+':'+(user()||'default').toLowerCase()}function settings(){var d={enabled:false,businessNumber:'',countryCode:'39'};try{var x=JSON.parse(localStorage.getItem(key())||'{}');if(x&&typeof x==='object'){d.enabled=!!x.enabled;d.businessNumber=String(x.businessNumber||'');d.countryCode=String(x.countryCode||'39').replace(/\D/g,'')||'39'}}catch(e){}return d}
function save(v){localStorage.setItem(key(),JSON.stringify(v))}function status(t,b){var e=E('optykerWaSettingsStatus');if(e){e.textContent=t;e.className='optykerSettingsStatus'+(b?' bad':'')}}
function fill(){var s=settings(),en=E('optykerWaEnabled'),bn=E('optykerWaBusinessNumber'),cc=E('optykerWaCountryCode');if(en)en.checked=s.enabled;if(bn)bn.value=s.businessNumber;if(cc)cc.value=s.countryCode||'39';refreshBars()}
function persist(){var en=!!(E('optykerWaEnabled')&&E('optykerWaEnabled').checked),bn=String(E('optykerWaBusinessNumber')&&E('optykerWaBusinessNumber').value||'').trim(),cc=String(E('optykerWaCountryCode')&&E('optykerWaCountryCode').value||'39').replace(/\D/g,'')||'39';save({enabled:en,businessNumber:bn,countryCode:cc});status(en?'WhatsApp abilitato per questo operatore.':'Impostazioni salvate. WhatsApp è disattivato.');refreshBars()}
function clients(){return window.OPTYKER_CLOUD&&Array.isArray(OPTYKER_CLOUD.clients)?OPTYKER_CLOUD.clients:[]}function client(id){id=String(id||'');return clients().filter(function(c){return String(c.id)===id})[0]||null}function clientIdMain(){var a=document.querySelector('#optykerChatThreads .optykerChatThread.active[data-c]');return a?a.getAttribute('data-c')||'':''}
function normalizePhone(v){var raw=String(v||'').trim();if(!raw)return'';var plus=raw.charAt(0)==='+';var d=raw.replace(/\D/g,'');if(d.indexOf('00')===0)d=d.slice(2);if(plus)return d;var cc=settings().countryCode||'39';if(d.indexOf(cc)===0&&d.length>9)return d;return cc+d}
function getPhone(id){var c=client(id);return c?normalizePhone(c.phone||c.mobile||c.cellphone||''):''}
function openSettingsForWa(){if(window.optykerOpenSettings)window.optykerOpenSettings();setTimeout(function(){var e=E('optykerWaEnabled');if(e)e.focus()},100)}
function sendWa(id,textId){var s=settings();if(!s.enabled){alert('WhatsApp non è ancora abilitato. Apri Impostazioni → WhatsApp.');openSettingsForWa();return}var phone=getPhone(id);if(!phone){alert('Nel cliente selezionato non è presente un numero di telefono utilizzabile con WhatsApp.');return}var t=E(textId),msg=String(t&&t.value||'').trim();var u='https://wa.me/'+encodeURIComponent(phone)+(msg?'?text='+encodeURIComponent(msg):'');window.open(u,'_blank','noopener');if(t)t.focus()}
function setMode(where,ch){mode[where]=ch;refreshBars()}
function bar(where){var id=where==='client'?'clientChatChannelBar':'optykerChatChannelBar';var b=E(id);if(b)return b;b=document.createElement('div');b.id=id;b.className=where==='client'?'clientChatChannelBar':'optykerChatChannelBar';b.innerHTML='<span class="optykerChatChannelLabel">Scrivi tramite</span><div class="optykerChatChannelBtns"><button type="button" class="optykerChatChannelBtn" data-channel="web">Chat web app</button><button type="button" class="optykerChatChannelBtn" data-channel="whatsapp">WhatsApp</button></div><span class="optykerWaMissing" style="display:none">Configura WhatsApp nelle Impostazioni</span>';b.querySelectorAll('[data-channel]').forEach(function(x){x.onclick=function(){var ch=x.getAttribute('data-channel');if(ch==='whatsapp'&&!settings().enabled){openSettingsForWa();return}setMode(where,ch)}});if(where==='client'){var m=E('clientChatMessages');if(m&&m.parentNode)m.parentNode.insertBefore(b,m)}else{var m2=E('optykerChatMessages');if(m2&&m2.parentNode)m2.parentNode.insertBefore(b,m2)}return b}
function refreshBar(where){var b=bar(where);if(!b)return;var s=settings();b.querySelectorAll('[data-channel]').forEach(function(x){x.classList.toggle('active',x.getAttribute('data-channel')===mode[where])});var miss=b.querySelector('.optykerWaMissing');if(miss)miss.style.display=s.enabled?'none':'inline';var send=E(where==='client'?'clientChatSend':'optykerChatSend');if(send)send.textContent=mode[where]==='whatsapp'?'Apri WhatsApp':'Invia'}function refreshBars(){refreshBar('client');refreshBar('main')}
function hideSettings(){var p=E('optykerSettingsPanel');if(p)p.style.display='none'}
window.optykerOpenSettings=function(){['dashboardPanel','analysisPanel','prescriptionPanel','visualExamPanel','indicationsPanel','hearingPanel','clientsPanel','onlineOrdersPanel','optykerChatPanel'].forEach(function(i){var e=E(i);if(e)e.style.display='none'});var r=E('reportSectionTop');if(r)r.style.display='none';var c=E('currentClientBanner');if(c)c.style.display='none';try{if(window.hideLac)hideLac()}catch(e){}var p=E('optykerSettingsPanel');if(p)p.style.display='block';document.querySelectorAll('#moduleNav .moduleBtn').forEach(function(b){b.classList.remove('active')});if(E('navSettings'))E('navSettings').classList.add('active');fill()};
function wrap(name){var f=window[name];if(typeof f!=='function'||f.__waSettingsWrapped)return;var w=function(){hideSettings();return f.apply(this,arguments)};w.__waSettingsWrapped=true;window[name]=w}
function wrapSend(){if(wrapping)return;wrapping=true;try{var a=window.clientClientChatSend;if(typeof a==='function'&&!a.__waWrapped){var aw=function(){if(mode.client==='whatsapp')return sendWa(window.clientCurrentId||'','clientChatText');return a.apply(this,arguments)};aw.__waWrapped=true;window.clientClientChatSend=aw}var b=window.optykerChatSend;if(typeof b==='function'&&!b.__waWrapped){var bw=function(){if(mode.main==='whatsapp')return sendWa(clientIdMain(),'optykerChatText');return b.apply(this,arguments)};bw.__waWrapped=true;window.optykerChatSend=bw}}finally{wrapping=false}}
function boot(){var sv=E('optykerWaSave'),ow=E('optykerWaOpenWeb');if(sv&&!sv.__wa){sv.__wa=true;sv.onclick=persist}if(ow&&!ow.__wa){ow.__wa=true;ow.onclick=function(){window.open('https://web.whatsapp.com/','_blank','noopener')}}wrap('showDashboard');wrap('showModule');wrap('openOnlineOrders');wrap('optykerOpenChat');wrapSend();refreshBars()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();setTimeout(boot,300);setTimeout(boot,1200);setInterval(function(){wrapSend();refreshBars()},2500)
})();
</script>
''')

p.write_text(s,encoding='utf-8')
print('Canale WhatsApp e Impostazioni applicati:',len(s))

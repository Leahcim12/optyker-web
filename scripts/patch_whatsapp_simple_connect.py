from pathlib import Path

p=Path('_site/index.html')
s=p.read_text(encoding='utf-8')
MARK='OPTYKER_WHATSAPP_SIMPLE_CONNECT_V1'
if MARK in s:
    raise SystemExit(0)
if 'OPTYKER_WHATSAPP_QR_META_FIX_V2' not in s or 'id="navSettings"' not in s or 'id="optykerWaQrStart"' not in s:
    raise SystemExit('WhatsApp QR / Impostazioni non pronti')

nav='    <button id="navSettings" class="moduleBtn" data-short="Impostazioni" type="button" onclick="optykerOpenSettings()"><span class="winNavIcon" aria-hidden="true">⚙</span><span>Impostazioni</span></button>'
wa_nav=nav+'\n    <button id="navWhatsAppConnect" class="moduleBtn" data-short="WhatsApp" type="button" onclick="optykerOpenWhatsAppSimple()"><span class="winNavIcon" aria-hidden="true">◉</span><span>WhatsApp</span></button>'
if s.count(nav)!=1:
    raise SystemExit('Pulsante Impostazioni non trovato una volta')
s=s.replace(nav,wa_nav,1)

css=r'''
<style id="optykerWhatsappSimpleCss">/* OPTYKER_WHATSAPP_SIMPLE_CONNECT_V1 */
#optykerWaSimple{margin:0 0 14px;border:1px solid #cfe2d5;border-radius:14px;background:linear-gradient(180deg,#fbfffc,#f5fbf7);padding:16px}
.optykerWaSimpleTop{display:flex;align-items:center;gap:13px}.optykerWaSimpleIcon{width:46px;height:46px;border-radius:13px;background:#25d366;color:#fff;display:flex;align-items:center;justify-content:center;font-size:23px;font-weight:900;flex:0 0 46px;box-shadow:0 5px 14px rgba(37,211,102,.18)}
.optykerWaSimpleInfo{flex:1;min-width:0}.optykerWaSimpleTitle{font-size:17px;font-weight:900;color:#17324a}.optykerWaSimpleText{font-size:10px;color:#678071;margin-top:3px;line-height:1.45}.optykerWaSimpleState{display:inline-flex;align-items:center;gap:6px;margin-top:7px;padding:5px 8px;border-radius:999px;background:#fff3dc;color:#8a5d00;font-size:9px;font-weight:900;border:1px solid #ead7a7}.optykerWaSimpleState.ok{background:#e9f8ef;color:#176d3d;border-color:#bfe3cc}.optykerWaSimpleState.bad{background:#fff1f0;color:#a42f26;border-color:#efc9c5}
.optykerWaSimpleActions{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}.optykerWaSimpleMain{height:42px;border:0;border-radius:9px;background:#25a65a;color:#fff;font-size:11px;font-weight:900;padding:0 18px;cursor:pointer}.optykerWaSimpleMain:disabled{opacity:.55;cursor:wait}.optykerWaSimpleSecondary{height:42px;border:1px solid #ccd9d1;border-radius:9px;background:#fff;color:#355c47;font-size:10px;font-weight:850;padding:0 14px;cursor:pointer}
#optykerWaSimpleSetup{display:none;margin-top:13px;padding:13px;border:1px solid #dbe6df;border-radius:10px;background:#fff}#optykerWaSimpleSetup.open{display:block}.optykerWaSimpleSetupTitle{font-size:11px;font-weight:900;color:#17324a}.optykerWaSimpleSetupHelp{font-size:9px;color:#6c7e72;margin:3px 0 10px;line-height:1.45}.optykerWaSimpleGrid{display:grid;grid-template-columns:1fr 1fr;gap:9px}.optykerWaSimpleGrid label{font-size:8px;font-weight:900;color:#61756a;text-transform:uppercase}.optykerWaSimpleGrid input{height:38px;margin-top:4px}
#optykerWaSimpleStatus{font-size:10px;color:#567060;min-height:15px;margin-top:9px}#optykerWaSimpleStatus.bad{color:#aa3027}
#optykerSettingsWhatsAppPane:not(.waSimpleAdvanced) .optykerSettingsCard>.optykerSettingsCardHead,
#optykerSettingsWhatsAppPane:not(.waSimpleAdvanced) .optykerSettingsCard>.optykerSettingsGrid,
#optykerSettingsWhatsAppPane:not(.waSimpleAdvanced) .optykerSettingsCard>.optykerWaConnection,
#optykerSettingsWhatsAppPane:not(.waSimpleAdvanced) .optykerSettingsCard>.optykerSettingsNote,
#optykerSettingsWhatsAppPane:not(.waSimpleAdvanced) .optykerSettingsCard>.optykerWaWebhookGrid,
#optykerSettingsWhatsAppPane:not(.waSimpleAdvanced) .optykerSettingsCard>.optykerSettingsActions,
#optykerSettingsWhatsAppPane:not(.waSimpleAdvanced) #optykerWaQrConnect{display:none!important}
#optykerSettingsWhatsAppPane.waSimpleAdvanced #optykerWaQrConnect{display:block!important}
@media(max-width:650px){.optykerWaSimpleTop{align-items:flex-start}.optykerWaSimpleGrid{grid-template-columns:1fr}.optykerWaSimpleActions button{width:100%}}
</style>
'''

js=r'''
<script id="optykerWhatsappSimpleJs">(function(){/* OPTYKER_WHATSAPP_SIMPLE_CONNECT_V1 */
var API='https://whgziwaegjzqsgcntesr.supabase.co/functions/v1/optyker-whatsapp-api';
var KAPP='optyker_meta_app_id_v1',KCFG='optyker_meta_embedded_config_id_v1';
var S={cfg:null,busy:false,mounted:false};
function E(i){return document.getElementById(i)}
function creds(){return {username:window.OPTYKER_CLOUD&&OPTYKER_CLOUD.username||window.OPTYKER_ACTIVE_OPERATOR||'',password:window.OPTYKER_CLOUD&&OPTYKER_CLOUD.password||''}}
function api(action,payload){var c=creds();return fetch(API,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({username:c.username,password:c.password,action:action,payload:payload||{}})}).then(function(r){return r.json().then(function(x){if(!r.ok||x.ok===false)throw new Error(x.error||'Errore WhatsApp');return x})})}
function status(t,bad){var e=E('optykerWaSimpleStatus');if(e){e.textContent=t||'';e.className=bad?'bad':''}}
function setState(cfg){
  S.cfg=cfg||{};var connected=!!S.cfg.connected;
  var st=E('optykerWaSimpleState'),title=E('optykerWaSimpleTitle'),text=E('optykerWaSimpleText'),btn=E('optykerWaSimpleConnect');
  if(st){st.textContent=connected?'COLLEGATO':'NON COLLEGATO';st.className='optykerWaSimpleState'+(connected?' ok':'')}
  if(title)title.textContent=connected?'WhatsApp collegato':'Collega WhatsApp';
  if(text){if(connected)text.textContent=([S.cfg.verified_name,S.cfg.display_phone_number].filter(Boolean).join(' · ')||'Il collegamento WhatsApp Business è attivo in Optyker.');else if(S.cfg.meta_app_id&&S.cfg.meta_config_id&&!S.cfg.oauth_exchange_ready&&!S.cfg.token_configured)text.textContent='L’app Meta è configurata, ma manca ancora l’autorizzazione server. Apri Avanzate e inserisci un Access Token permanente Meta, oppure configura META_APP_SECRET in Supabase.';else text.textContent='Accedi a Meta e completa il collegamento guidato.'}
  if(btn)btn.textContent=connected?'RICOLLEGA WHATSAPP':'COLLEGA WHATSAPP';
  if(E('optykerWaEnabled'))E('optykerWaEnabled').checked=connected;
  syncMeta(S.cfg)
}
function syncMeta(cfg){
  var a=String(cfg&&cfg.meta_app_id||''),c=String(cfg&&cfg.meta_config_id||'');
  try{if(a)localStorage.setItem(KAPP,a);if(c)localStorage.setItem(KCFG,c)}catch(e){}
  if(E('optykerWaMetaAppId')&&a)E('optykerWaMetaAppId').value=a;
  if(E('optykerWaMetaConfigId')&&c)E('optykerWaMetaConfigId').value=c;
  if(E('optykerWaSimpleAppId'))E('optykerWaSimpleAppId').value=a;
  if(E('optykerWaSimpleConfigId'))E('optykerWaSimpleConfigId').value=c
}
function load(){
  status('Controllo collegamento…');
  return api('settings_get',{}).then(function(x){setState(x.data||{});status('')}).catch(function(e){status(e.message,true)})
}
function mount(){
  if(E('optykerWaSimple')){S.mounted=true;return true}
  var pane=E('optykerSettingsWhatsAppPane')||E('optykerSettingsPanel'),card=pane&&pane.querySelector('.optykerSettingsCard');if(!card)return false;
  var d=document.createElement('div');d.id='optykerWaSimple';d.innerHTML='<div class="optykerWaSimpleTop"><div class="optykerWaSimpleIcon">W</div><div class="optykerWaSimpleInfo"><div id="optykerWaSimpleTitle" class="optykerWaSimpleTitle">Collega WhatsApp</div><div id="optykerWaSimpleText" class="optykerWaSimpleText">Collegamento guidato con Meta.</div><span id="optykerWaSimpleState" class="optykerWaSimpleState">NON COLLEGATO</span></div></div><div class="optykerWaSimpleActions"><button id="optykerWaSimpleConnect" class="optykerWaSimpleMain" type="button">COLLEGA WHATSAPP</button><button id="optykerWaSimpleSetupBtn" class="optykerWaSimpleSecondary" type="button">Configurazione iniziale</button><button id="optykerWaSimpleAdvancedBtn" class="optykerWaSimpleSecondary" type="button">Avanzate</button></div><div id="optykerWaSimpleSetup"><div class="optykerWaSimpleSetupTitle">Configurazione iniziale Meta</div><div class="optykerWaSimpleSetupHelp">Questi due codici si inseriscono una sola volta e poi Optyker li ricorda su tutti i dispositivi.</div><div class="optykerWaSimpleGrid"><label>Meta App ID<input id="optykerWaSimpleAppId" type="text" inputmode="numeric" placeholder="App ID"></label><label>Configuration ID<input id="optykerWaSimpleConfigId" type="text" inputmode="numeric" placeholder="Embedded Signup Configuration ID"></label></div><div class="optykerWaSimpleActions"><button id="optykerWaSimpleSaveSetup" class="optykerWaSimpleMain" type="button">SALVA E COLLEGA</button></div></div><div id="optykerWaSimpleStatus"></div>';
  card.insertBefore(d,card.firstChild);S.mounted=true;
  E('optykerWaSimpleConnect').onclick=connect;
  E('optykerWaSimpleSetupBtn').onclick=function(){E('optykerWaSimpleSetup').classList.toggle('open')};
  E('optykerWaSimpleAdvancedBtn').onclick=function(){var p=E('optykerSettingsWhatsAppPane')||E('optykerSettingsPanel');p.classList.toggle('waSimpleAdvanced');this.textContent=p.classList.contains('waSimpleAdvanced')?'Nascondi avanzate':'Avanzate'};
  E('optykerWaSimpleSaveSetup').onclick=saveAndConnect;
  watchQr();load();return true
}
function hasMeta(){return !!(S.cfg&&S.cfg.meta_app_id&&S.cfg.meta_config_id)}
function saveMeta(){
  var app=String(E('optykerWaSimpleAppId')&&E('optykerWaSimpleAppId').value||'').trim(),cfg=String(E('optykerWaSimpleConfigId')&&E('optykerWaSimpleConfigId').value||'').trim();
  if(!app||!cfg)return Promise.reject(new Error('Inserisci Meta App ID e Configuration ID.'));
  status('Salvataggio configurazione iniziale…');
  return api('settings_save',{enabled:false,meta_app_id:app,meta_config_id:cfg}).then(function(){S.cfg=S.cfg||{};S.cfg.meta_app_id=app;S.cfg.meta_config_id=cfg;syncMeta(S.cfg);E('optykerWaSimpleSetup').classList.remove('open')})
}
function triggerQr(){
  syncMeta(S.cfg||{});var b=E('optykerWaQrStart');if(!b)throw new Error('Collegamento Meta non disponibile. Ricarica Optyker.');
  status('Apertura accesso Meta…');b.click()
}
function connect(){
  if(S.busy)return;
  if(!hasMeta()){E('optykerWaSimpleSetup').classList.add('open');status('Inserisci i due codici Meta una sola volta, poi premi Salva e collega.',true);return}
  if(S.cfg&&!S.cfg.oauth_exchange_ready&&!S.cfg.token_configured){
    var p=E('optykerSettingsWhatsAppPane')||E('optykerSettingsPanel');if(p)p.classList.add('waSimpleAdvanced');
    status('Manca l’autorizzazione server Meta: inserisci un Access Token permanente nel campo Access Token oppure configura META_APP_SECRET in Supabase, poi riprova.',true);
    return;
  }
  try{triggerQr()}catch(e){status(e.message,true)}
}
function saveAndConnect(){
  if(S.busy)return;S.busy=true;var b=E('optykerWaSimpleSaveSetup');if(b){b.disabled=true;b.textContent='SALVATAGGIO…'}
  saveMeta().then(function(){triggerQr()}).catch(function(e){status(e.message,true)}).finally(function(){S.busy=false;if(b){b.disabled=false;b.textContent='SALVA E COLLEGA'}})
}
function watchQr(){
  var q=E('optykerWaQrStatus');if(!q||q.__simpleWatch)return;q.__simpleWatch=true;
  new MutationObserver(function(){var t=String(q.textContent||'').trim();if(!t)return;status(t,/errore|annull|manca|non ha|impossibile/i.test(t));if(/collegato correttamente/i.test(t))setTimeout(load,300)}).observe(q,{subtree:true,childList:true,characterData:true})
}
function showPane(){
  var wa=E('optykerSettingsWhatsAppPane'),ag=E('optykerSettingsAgendaPane'),bw=E('optykerSettingsWhatsApp'),ba=E('optykerSettingsAgenda');
  if(ag)ag.classList.remove('open');if(wa)wa.classList.add('open');if(bw)bw.classList.add('active');if(ba)ba.classList.remove('active')
}
window.optykerOpenWhatsAppSimple=function(){
  try{if(window.optykerOpenSettings)window.optykerOpenSettings()}catch(e){}
  var n=0;(function ready(){n++;if(mount()){showPane();document.querySelectorAll('#moduleNav .moduleBtn').forEach(function(x){x.classList.remove('active')});if(E('navWhatsAppConnect'))E('navWhatsAppConnect').classList.add('active');load();setTimeout(function(){try{E('optykerWaSimple').scrollIntoView({behavior:'smooth',block:'start'})}catch(e){}},80);return}if(n<30)setTimeout(ready,60)})()
};
function boot(){var n=0;(function t(){n++;if(mount())return;if(n<40)setTimeout(t,150)})()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
window.addEventListener('pageshow',boot);
})();</script>
'''

h=s.find('</head>')
if h<0: raise SystemExit('head non trovato')
s=s[:h]+css+s[h:]
b=s.rfind('</body>')
if b<0: raise SystemExit('body non trovato')
s=s[:b]+js+s[b:]

p.write_text(s,encoding='utf-8')
for req in [MARK,'navWhatsAppConnect','optykerOpenWhatsAppSimple','COLLEGA WHATSAPP','SALVA E COLLEGA']:
    if req not in s: raise SystemExit('Patch WhatsApp semplice incompleta: '+req)
print('WhatsApp simple connect OK')

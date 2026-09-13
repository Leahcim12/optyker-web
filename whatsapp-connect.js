/* Optyker: guided official WhatsApp connection. Chats stay inside Optyker. */
(function(){
'use strict';
if(window.OPTYKER_WHATSAPP_GUIDED_V2)return;window.OPTYKER_WHATSAPP_GUIDED_V2='20260913-internal-guided2';
const $=id=>document.getElementById(id),endpoint='https://whgziwaegjzqsgcntesr.supabase.co/functions/v1/optyker-whatsapp-connect';
let cfg=null,loadSeq=0,readyApp='',sdkPending=null,attempt=null,nonce='',nonceAt=0,preparing=false;
const session=()=>{const c=window.OPTYKER_CLOUD||{};return [c.username||'',c.password||''].join('\n')};
let owner='';
function status(t,bad=false){const e=$('waConnectStatus');if(e){e.textContent=t;e.classList.toggle('bad',bad)}}
async function api(action,payload={}){
 const c=window.OPTYKER_CLOUD||{},who=session();if(!c.username||!c.password)throw Error('Accedi a Optyker per collegare WhatsApp.');
 const ac=new AbortController(),timer=setTimeout(()=>ac.abort(),action==='finish'?90000:25000);
 try{const r=await fetch(endpoint,{method:'POST',cache:'no-store',signal:ac.signal,headers:{'Content-Type':'application/json'},body:JSON.stringify({username:c.username,password:c.password,action,payload})});const x=await r.json();
  if(who!==session())throw Error('Sessione cambiata: riapri WhatsApp.');if(!r.ok||x?.ok===false){const e=Error(x?.error||'Collegamento non disponibile. Premi Riprova.');e.code=x?.code;throw e}return x.data||{};
 }catch(e){if(e.name==='AbortError')throw Error('Il server non ha risposto. Premi Verifica collegamento prima di riprovare.');throw e}finally{clearTimeout(timer)}
}
function publish(){window.dispatchEvent(new CustomEvent('optyker:whatsapp-settings',{detail:cfg||{}}))}
function render(){
 const b=$('waBusinessConnect');if(!b)return;
 const connected=!!cfg?.connected,st=cfg?.connection_state;
 $('waBusinessState').textContent=connected?'Collegamento salvato':st==='ready'?'Pronto per l’autorizzazione':cfg?'Attivazione da completare':'Verifica in corso…';
 $('waBusinessState').classList.toggle('ok',connected);
 $('waBusinessNumber').textContent=[cfg?.verified_name,cfg?.display_phone_number].filter(Boolean).join(' · ')||'Il numero sarà confermato nella finestra Meta.';
 $('waBusinessHint').textContent=connected?'La chat WhatsApp resta nella scheda cliente di Optyker. Verifica il collegamento per controllare l’accesso a Meta.':
  st==='server_key_required'?'I codici dell’app sono già salvati. Manca soltanto una chiave server da configurare una volta: non dovrai reinserire ID, token o indirizzi.':
  st==='app_setup_required'?'La configurazione iniziale dell’app Meta non è completa. Deve intervenire l’amministrazione; non serve inserire dati del cliente.':
  cfg&&!cfg.can_manage?'Il primo collegamento deve essere confermato da Michael o dall’amministrazione.':
  'Premi Collega WhatsApp, autorizza il numero nella finestra Meta e conferma sul telefono quando richiesto. Il QR, quando previsto, viene mostrato da Meta.';
 b.textContent=attempt?'Collegamento in corso…':preparing?'Preparazione…':connected?'Ricollega WhatsApp':'Collega WhatsApp';
 b.disabled=!cfg||!cfg.can_manage||!cfg.oauth_exchange_ready||!cfg.meta_app_id||!cfg.meta_config_id||!!attempt||preparing;
 $('waSetup').hidden=!(cfg?.can_manage&&st==='server_key_required');
 const link=$('waMetaApp');link.href=cfg?.meta_app_id?'https://developers.facebook.com/apps/'+encodeURIComponent(cfg.meta_app_id)+'/settings/basic/':'https://developers.facebook.com/apps/';
 $('waConfigStatus').textContent=cfg?.meta_app_id&&cfg?.meta_config_id?'Configurazione app: già salvata':'Configurazione app: da completare';
 $('waKeyStatus').textContent=cfg?.oauth_exchange_ready?'Chiave server: presente':'Chiave server: da configurare una sola volta';
 $('waReceiveStatus').textContent=cfg?.webhook_last_received_at?'Ultimo evento ricevuto: '+new Date(cfg.webhook_last_received_at).toLocaleString('it-IT'):cfg?.webhook_verified_at?'Ricezione configurata; nessun messaggio reale ancora verificato.':'Ricezione: da verificare dopo l’autorizzazione.';
 $('waVerifiedStatus').textContent=cfg?.last_verified_at?'Ultima verifica account: '+new Date(cfg.last_verified_at).toLocaleString('it-IT'):'Account non ancora verificato.';
}
function prepareSDK(){
 const app=cfg?.meta_app_id;if(!app)return Promise.reject(Error('Configurazione Meta da completare.'));
 if(readyApp===app&&window.FB)return Promise.resolve();if(sdkPending)return sdkPending;
 sdkPending=new Promise((resolve,reject)=>{
  let done=false;const finish=e=>{if(done)return;done=true;clearTimeout(timer);e?reject(e):resolve()};
  const timer=setTimeout(()=>finish(Error('Meta non risponde. Controlla la connessione e premi Riprova.')),15000);
  const init=()=>{if(done)return;try{window.FB.init({appId:app,cookie:true,xfbml:false,version:cfg?.graph_version||'v25.0'});readyApp=app;finish()}catch(e){finish(e)}};
  if(window.FB){init();return}window.fbAsyncInit=init;let s=$('facebook-jssdk');if(s)s.remove();s=document.createElement('script');s.id='facebook-jssdk';s.async=true;s.src='https://connect.facebook.net/it_IT/sdk.js';s.onerror=()=>{s.remove();finish(Error('Impossibile caricare Meta. Premi Riprova.'))};document.head.appendChild(s);
 }).finally(()=>{sdkPending=null});return sdkPending;
}
async function prepare(){
 if(preparing||!cfg?.can_manage||!cfg.oauth_exchange_ready||!cfg.meta_app_id||!cfg.meta_config_id)return;
 preparing=true;render();try{await prepareSDK();const x=await api('begin');nonce=x.nonce;nonceAt=Date.now();}catch(e){nonce='';status(e.message,true)}finally{preparing=false;render()}
}
async function load(verify=false){
 const seq=++loadSeq;const who=session();if(owner!==who){owner=who;cfg=null;nonce='';if(attempt)stop(attempt,'Sessione cambiata.');publish()}
 status('Controllo del collegamento…');
 try{const data=await api('settings_get');if(seq!==loadSeq)return;cfg=data;publish();render();
  if(verify&&cfg.connected){cfg=await api('test_connection');if(seq!==loadSeq)return;publish();status('Accesso a Meta e sottoscrizione messaggi verificati. Nessun messaggio di prova è stato inviato.');}
  else status('');render();await prepare();
 }catch(e){if(seq!==loadSeq)return;status(e.message,true);if(e.code==='META_REAUTHORIZE'&&cfg){cfg.connected=false;cfg.enabled=false;publish()}render()}
}
function stop(a,text,bad=false){if(attempt!==a)return;clearTimeout(a.timer);clearTimeout(a.fallback);attempt=null;status(text,bad);render()}
async function finish(a,allowDiscovery=false){
 if(attempt!==a||a.sending||!a.code||(!a.ids&&!allowDiscovery))return;
 a.sending=true;clearTimeout(a.fallback);status('Autorizzazione ricevuta. Salvataggio e verifica della ricezione…');
 try{if(a.owner!==session())throw Error('Sessione cambiata: riapri WhatsApp.');
  const data=await api('finish',{nonce:a.nonce,code:a.code,waba_id:a.ids?.waba_id||a.ids?.business_account_id||'',phone_number_id:a.ids?.phone_number_id||''});
  if(attempt!==a)return;cfg=data;publish();if(!cfg.connected)throw Error('Collegamento non confermato. Premi Verifica collegamento.');
  nonce='';stop(a,'WhatsApp collegato. Apri il cliente → Chat → WhatsApp. Per verificare lo scambio reale serve un messaggio dal telefono.');
 }catch(e){nonce='';stop(a,e.message,true)}
}
function connect(){
 if(attempt||preparing)return;
 if(!cfg?.can_manage||!cfg?.oauth_exchange_ready){render();return}
 if(readyApp!==cfg.meta_app_id||!window.FB||!nonce||Date.now()-nonceAt>540000){prepare().then(()=>{if(nonce)status('Pronto: premi Collega WhatsApp.');});return}
 const a={owner:session(),nonce,code:'',ids:null,sending:false};attempt=a;
 a.timer=setTimeout(()=>stop(a,'Procedura non conclusa. Premi Verifica collegamento; se necessario, ricollega il numero.',true),240000);
 status('Completa l’autorizzazione nella finestra Meta. Se non appare, consenti i popup per Optyker.');render();
 try{window.FB.login(r=>{if(attempt!==a)return;if(!r?.authResponse?.code){stop(a,'Autorizzazione non completata. Puoi riprovare.',true);return}a.code=r.authResponse.code;finish(a);a.fallback=setTimeout(()=>finish(a,true),2500);},
 {config_id:cfg.meta_config_id,response_type:'code',override_default_response_type:true,extras:{setup:{},version:'v4',featureType:'whatsapp_business_app_onboarding',sessionInfoVersion:'3'}});}catch(e){stop(a,'La finestra Meta non si è aperta. Consenti i popup e riprova.',true)}
}
window.addEventListener('message',ev=>{
 if(!['https://www.facebook.com','https://web.facebook.com','https://facebook.com'].includes(ev.origin)||!attempt)return;
 let d=ev.data;try{if(typeof d==='string')d=JSON.parse(d)}catch{return}if(d?.type!=='WA_EMBEDDED_SIGNUP')return;
 const a=attempt;if(d.event==='FINISH'||d.event==='FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING'){a.ids=d.data||{};finish(a)}
 else if(d.event==='CANCEL')stop(a,'Collegamento annullato. I dati precedenti sono conservati.');
 else if(d.event==='ERROR')stop(a,'Meta non ha completato l’autorizzazione. Verifica l’abilitazione WhatsApp dell’app Meta e riprova.',true);
});
function mount(){
 const pane=$('optykerSettingsWhatsAppPane'),card=pane?.querySelector('.optykerSettingsCard');if(!card)return false;if($('waQuickConnect'))return true;
 const d=document.createElement('section');d.id='waQuickConnect';d.innerHTML=`
 <h2>WhatsApp dentro Optyker</h2><p>Un collegamento per tutto il negozio. I dati già salvati vengono recuperati automaticamente.</p>
 <div class="waQuickCard"><b id="waBusinessState"></b><p id="waBusinessNumber"></p><p id="waBusinessHint"></p>
 <button type="button" id="waBusinessConnect" class="waQuickPrimary" disabled>Collega WhatsApp</button><button type="button" id="waBusinessVerify">Verifica collegamento / Riprova</button>
 <p class="waQuickNote">L’autorizzazione si apre nella finestra sicura Meta. Le conversazioni restano in Optyker, nella scheda cliente → Chat → WhatsApp.</p></div>
 <div id="waSetup" class="waQuickCard" hidden><h3>Attivazione iniziale · una sola volta</h3><p>I due codici dell’app sono già presenti. Manca solo la chiave segreta dell’app Meta per completare automaticamente l’autorizzazione.</p>
 <a id="waMetaApp" target="_blank" rel="noopener noreferrer">Apri le impostazioni della tua app Meta</a>
 <label for="waServerKey">Chiave segreta dell’app (App secret)</label><input id="waServerKey" type="password" autocomplete="new-password" spellcheck="false" autocapitalize="off" maxlength="64" placeholder="Incolla qui la chiave, non in chat">
 <button type="button" id="waSaveKey">Salva chiave sul server</button><p class="waQuickNote">La chiave viene verificata e salvata in archivio cifrato sul server. Non viene salvata nel browser né mostrata agli operatori.</p></div>
 <p id="waConnectStatus" role="status" aria-live="polite"></p>
 <details><summary>Stato del collegamento</summary><p id="waConfigStatus"></p><p id="waKeyStatus"></p><p id="waReceiveStatus"></p><p id="waVerifiedStatus"></p><p class="waQuickNote">Una verifica dell’account non equivale alla consegna di un messaggio. Nessun invio di prova parte automaticamente.</p></details>`;
 card.prepend(d);pane.classList.add('waGuided');pane.classList.remove('waTechnical');
 $('waBusinessConnect').onclick=connect;$('waBusinessVerify').onclick=()=>load(true);
 $('waSaveKey').onclick=async()=>{const b=$('waSaveKey'),input=$('waServerKey'),s=input.value.trim();if(!/^[a-fA-F0-9]{32}$/.test(s)){status('La chiave segreta Meta deve avere 32 caratteri. Non inserire la password di Facebook.',true);return}
  b.disabled=true;status('Verifica e salvataggio della chiave server…');try{cfg=await api('save_server_key',{app_secret:s});input.value='';publish();render();status('Chiave salvata. Preparazione del collegamento…');await prepare();if(nonce)status('Pronto: premi Collega WhatsApp.');}catch(e){input.value='';status(e.message,true)}finally{b.disabled=false}
 };$('waClientWeb')?.remove();$('waClientWebHint')?.remove();render();return true;
}
function show(){if(!mount())return;$('optykerSettingsWhatsAppPane').classList.add('open');$('optykerSettingsAgendaPane')?.classList.remove('open');$('optykerSettingsWhatsApp')?.classList.add('active');$('optykerSettingsAgenda')?.classList.remove('active')}
window.optykerOpenWhatsAppSimple=function(){window.optykerOpenSettings?.();window.optykerShowOnlyRootPanel?.('optykerSettingsPanel');show();setTimeout(show,0);setTimeout(show,100);load(true)};
document.addEventListener('click',ev=>{if(ev.target.closest?.('#optykerSettingsWhatsApp')){show();load(true)}},true);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();setTimeout(mount,500);
})();

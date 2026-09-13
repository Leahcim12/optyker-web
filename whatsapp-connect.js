/* Simple WhatsApp access and the official Business signup; no credentials in storage. */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const endpoint='https://whgziwaegjzqsgcntesr.supabase.co/functions/v1/optyker-whatsapp-api';
let cfg=null,loadSeq=0,readyApp='',sdkPending=null,attempt=null,attemptId=0;
const session=()=>{const c=window.OPTYKER_CLOUD||{};return [c.username||'',c.password||''].join('\n')};
function status(text,bad=false){const e=$('waConnectStatus');if(e){e.textContent=text;e.classList.toggle('bad',bad)}}
async function api(action,payload={}){
 const c=window.OPTYKER_CLOUD||{},user=session();
 if(!c.username||!c.password)throw Error('Accedi a Optyker con il tuo utente per verificare il collegamento automatico.');
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
 try{
  const r=await fetch(endpoint,{method:'POST',cache:'no-store',signal:controller.signal,headers:{'Content-Type':'application/json'},body:JSON.stringify({username:c.username,password:c.password,action,payload})});
  const x=await r.json();if(!r.ok||!x||x.ok===false)throw Error(x?.error||'Collegamento non disponibile. Riprova.');
  if(user!==session())throw Error('Sessione cambiata: riapri WhatsApp.');return x;
 }catch(e){if(e.name==='AbortError')throw Error('Il server non ha risposto. Premi Verifica collegamento.');throw e}finally{clearTimeout(timer)}
}
function publishConfig(){window.dispatchEvent(new CustomEvent('optyker:whatsapp-settings',{detail:cfg||{}}))}
function render(){
 const b=$('waBusinessConnect'),s=$('waBusinessState'),hint=$('waBusinessHint');if(!b)return;
 const connected=!!cfg?.connected,configured=!!(cfg?.meta_app_id&&cfg?.meta_config_id),authorized=!!(cfg?.oauth_exchange_ready||cfg?.token_configured);
 s.textContent=connected?'Collegamento automatico attivo':'Collegamento automatico non attivo';
 s.classList.toggle('ok',connected);
 hint.textContent=connected?[cfg.verified_name,cfg.display_phone_number].filter(Boolean).join(' · '):
  configured&&authorized?'La configurazione è già salvata. Premi Collega con Meta e autorizza il tuo numero WhatsApp Business.':
  'Per gli invii automatici serve completare l’attivazione Business. Intanto puoi usare WhatsApp Web con il QR qui sopra.';
 b.textContent=connected?'Ricollega con Meta':readyApp===cfg?.meta_app_id?'Collega con Meta':'Prepara collegamento Meta';
 b.hidden=!configured||!authorized;b.disabled=!!sdkPending||!!attempt;
 if($('waTechnicalApp'))$('waTechnicalApp').value=cfg?.meta_app_id||'';
 if($('waTechnicalSignup'))$('waTechnicalSignup').value=cfg?.meta_config_id||'';
}
function prepareSDK(){
 const app=cfg?.meta_app_id;if(!app)return Promise.reject(Error('Configurazione Meta non disponibile.'));
 if(readyApp===app&&window.FB)return Promise.resolve();
 if(sdkPending)return sdkPending;
 sdkPending=new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>reject(Error('Meta non risponde. Puoi riprovare o aprire WhatsApp Web.')),15000);
  function init(){try{window.FB.init({appId:app,cookie:true,xfbml:false,version:cfg.graph_version||'v25.0'});readyApp=app;clearTimeout(timer);resolve()}catch(e){clearTimeout(timer);reject(e)}}
  if(window.FB){init();return}
  window.fbAsyncInit=init;
  let script=$('facebook-jssdk');if(script)script.remove();
  script=document.createElement('script');script.id='facebook-jssdk';script.async=true;script.src='https://connect.facebook.net/it_IT/sdk.js';
  script.onerror=()=>{clearTimeout(timer);script.remove();reject(Error('Impossibile aprire Meta. Verifica la connessione e riprova.'))};document.head.appendChild(script);
 }).finally(()=>{sdkPending=null;render()});render();return sdkPending;
}
async function load(){
 const seq=++loadSeq;status('Verifica del collegamento automatico…');
 try{const x=await api('settings_get');if(seq!==loadSeq)return;cfg=x.data||{};publishConfig();render();status('');
  if(cfg.meta_app_id&&cfg.meta_config_id&&(cfg.oauth_exchange_ready||cfg.token_configured))prepareSDK().catch(e=>status(e.message,true));
 }catch(e){if(seq===loadSeq){cfg=null;publishConfig();render();status(e.message,true)}}
}
function stopAttempt(a,text,bad=false){if(attempt!==a)return;clearTimeout(a.timer);attempt=null;status(text,bad);render()}
async function finish(a){
 // FINISH and the OAuth callback can arrive in either order. Wait for both.
 if(attempt!==a||a.sending||!a.auth||!a.ids)return;
 a.sending=true;status('Autorizzazione ricevuta. Verifica del numero…');
 try{
  if(a.session!==session())throw Error('Sessione cambiata: riapri WhatsApp.');
  await api('embedded_finish',{business_account_id:a.ids.waba_id||a.ids.business_account_id||'',phone_number_id:a.ids.phone_number_id||'',code:a.auth.code||'',access_token:a.auth.accessToken||''});
  if(attempt!==a)return;
  // Persisted settings and an actual Meta read must confirm the result.
  await api('test_connection');const x=await api('settings_get');if(attempt!==a)return;
  cfg=x.data||{};publishConfig();
  if(!cfg.connected)throw Error('Autorizzazione ricevuta, ma il collegamento non risulta ancora attivo. Premi Verifica collegamento.');
  stopAttempt(a,'WhatsApp Business collegato.');
 }catch(e){stopAttempt(a,e.message,true)}
}
function connect(){
 if(attempt)return;
 if(!cfg?.meta_app_id||!cfg?.meta_config_id||!(cfg.oauth_exchange_ready||cfg.token_configured)){status('Attivazione Business da completare. Puoi usare subito WhatsApp Web.',true);return}
 if(readyApp!==cfg.meta_app_id||!window.FB){prepareSDK().then(()=>status('Pronto: premi Collega con Meta.')).catch(e=>status(e.message,true));return}
 const a={id:++attemptId,session:session(),auth:null,ids:null,sending:false};attempt=a;
 a.timer=setTimeout(()=>stopAttempt(a,'Collegamento non concluso. Puoi riprovare; se la finestra non si apre, consenti i popup di Optyker.',true),180000);
 status('Nella finestra Meta scegli il tuo numero e completa l’autorizzazione.');render();
 // Keep FB.login synchronous with the user's click, otherwise browsers block the popup.
 try{window.FB.login(r=>{
  if(attempt!==a)return;
  if(!r?.authResponse){stopAttempt(a,'Collegamento annullato. Puoi riprovare.');return}
  a.auth=r.authResponse;finish(a);
 },{config_id:cfg.meta_config_id,response_type:'code',override_default_response_type:true,extras:{setup:{},version:'v4',featureType:'whatsapp_business_app_onboarding',sessionInfoVersion:'3'}})}catch(e){stopAttempt(a,e.message,true)}
}
window.addEventListener('message',ev=>{
 if(!['https://www.facebook.com','https://web.facebook.com','https://facebook.com'].includes(ev.origin)||!attempt)return;
 let d=ev.data;try{if(typeof d==='string')d=JSON.parse(d)}catch{return}
 if(d?.type!=='WA_EMBEDDED_SIGNUP')return;
 const a=attempt;
 if(d.event==='FINISH'||d.event==='FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING'){
  if(!d.data||!(d.data.waba_id||d.data.business_account_id)){stopAttempt(a,'Meta non ha restituito il numero autorizzato. Riprova.',true);return}
  a.ids=d.data;finish(a);
 }else if(d.event==='CANCEL')stopAttempt(a,'Collegamento annullato. Puoi riprovare.');
 else if(d.event==='ERROR')stopAttempt(a,'Meta non ha completato il collegamento. Verifica l’abilitazione della tua app Meta e riprova.',true);
});
function mount(){
 const pane=$('optykerSettingsWhatsAppPane'),card=pane?.querySelector('.optykerSettingsCard');if(!card)return false;
 if($('waQuickConnect'))return true;
 const d=document.createElement('section');d.id='waQuickConnect';d.innerHTML=`
  <h2>WhatsApp, in pochi passaggi</h2>
  <div class="waQuickCard"><h3>Usa WhatsApp Web</h3><p>Collega il telefono al PC con il QR. Non servono codici tecnici.</p>
  <ol><li>Premi <b>Apri WhatsApp Web</b>.</li><li>Sul telefono apri WhatsApp → <b>Dispositivi collegati → Collega un dispositivo</b>.</li><li>Scansiona il QR che compare su WhatsApp Web.</li></ol>
  <a class="waQuickPrimary" href="https://web.whatsapp.com/" target="_blank" rel="noopener noreferrer">Apri WhatsApp Web</a>
  <p class="waQuickNote">Invii e risposte si gestiscono nella finestra WhatsApp. Questo accesso non attiva gli invii automatici di Optyker.</p></div>
  <details id="waBusinessDetails"><summary>Invii automatici da Optyker · WhatsApp Business</summary><div class="waQuickCard">
  <b id="waBusinessState"></b><p id="waBusinessHint"></p><button type="button" id="waBusinessConnect" class="waQuickPrimary" hidden>Collega con Meta</button>
  <button type="button" id="waBusinessVerify">Verifica collegamento</button>
  <details id="waTechnicalDetails"><summary>Configurazione tecnica</summary><p>I dati già salvati vengono recuperati automaticamente.</p>
  <label>Meta App ID<input id="waTechnicalApp" inputmode="numeric"></label><label>Configuration ID<input id="waTechnicalSignup" inputmode="numeric"></label>
  <button type="button" id="waTechnicalSave">Salva configurazione</button><p>Se manca l’autorizzazione server, il tecnico deve configurare il segreto dell’app sul server oppure il token tramite i campi protetti sotto.</p>
  </details></div></details><p id="waConnectStatus" role="status" aria-live="polite"></p>`;
 card.prepend(d);render();
 $('waBusinessConnect').onclick=connect;
 $('waBusinessVerify').onclick=async()=>{try{if(cfg?.connected)await api('test_connection');await load()}catch(e){status(e.message,true)}};
 const technicalVisibility=()=>pane.classList.toggle('waTechnical',$('waBusinessDetails').open&&$('waTechnicalDetails').open);
 $('waTechnicalDetails').ontoggle=technicalVisibility;$('waBusinessDetails').ontoggle=technicalVisibility;
 $('waTechnicalSave').onclick=async()=>{
  const b=$('waTechnicalSave'),app=$('waTechnicalApp').value.trim(),id=$('waTechnicalSignup').value.trim();
  if(!/^\d+$/.test(app)||!/^\d+$/.test(id)){status('Inserisci i due codici numerici forniti da Meta.',true);return}
  b.disabled=true;try{await api('settings_save',{meta_app_id:app,meta_config_id:id,enabled:!!cfg?.connected});await load()}catch(e){status(e.message,true)}finally{b.disabled=false}
 };
 return true;
}
function show(){
 if(!mount())return;
 $('optykerSettingsWhatsAppPane').classList.add('open');$('optykerSettingsAgendaPane')?.classList.remove('open');
 $('optykerSettingsWhatsApp')?.classList.add('active');$('optykerSettingsAgenda')?.classList.remove('active');
}
window.optykerOpenWhatsAppSimple=function(){
 window.optykerOpenSettings?.();window.optykerShowOnlyRootPanel?.('optykerSettingsPanel');
 show();setTimeout(show,0);setTimeout(show,100);load();
};
document.addEventListener('click',ev=>{if(ev.target.closest?.('#optykerSettingsWhatsApp')){show();load()}},true);
function clientShortcut(){
 const send=$('clientChatSend');if(!send||$('waClientWeb'))return;
 const a=document.createElement('a');a.id='waClientWeb';a.className='waClientWeb';a.textContent='Apri chat su WhatsApp';a.href='https://web.whatsapp.com/';a.target='_blank';a.rel='noopener noreferrer';
 const hint=document.createElement('span');hint.id='waClientWebHint';hint.setAttribute('role','status');
 a.onclick=ev=>{
  const c=(window.OPTYKER_CLOUD?.clients||[]).find(x=>String(x.id)===String(window.clientCurrentId));
  const raw=String(c?.phone||'').trim();let n=raw.replace(/[^\d]/g,'');
  if(n.startsWith('00'))n=n.slice(2);else if(!raw.startsWith('+')&&!(n.startsWith('39')&&n.length>10))n='39'+n;
  if(!raw||n.length<8||n.length>15){ev.preventDefault();hint.textContent='Inserisci il numero di telefono nell’anagrafica e salva.';return}
  a.href='https://wa.me/'+n;hint.textContent='La chat si apre in WhatsApp. Scrivi e invia da lì.';
 };
 send.parentNode.append(a,hint);
}
function boot(){mount();clientShortcut()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
setTimeout(boot,500);
})();

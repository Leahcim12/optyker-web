/* OPTYKER_RCH_AUTO_REG_20261011: before a receipt, a RCH left idle in Z (after a closure,
   from the keyboard or by another program) goes back to REG through the PC cassa.
   It uses the existing Cloud Relay restore_reg command: only =C1, never a closure,
   a receipt or a repeated sale. If anything is uncertain the normal checks decide. */
(function(){
'use strict';
if(window.OPTYKER_RCH_AUTO_REG)return;
var RELAY='https://whgziwaegjzqsgcntesr.supabase.co/functions/v1/optyker-rch-relay-api',LOCAL='http://127.0.0.1:8765',VERSION='20261013-update1',running=null;
function credentials(){var c=window.OPTYKER_CLOUD||{};return {username:c.username||window.OPTYKER_ACTIVE_USER||'',password:c.password||''}}
function zero(v){return v===0||v==='0'}
function readyFlags(s){return !!(s&&s.ok===true&&zero(s.idleState)&&['busy','errorCode','printerError','paperEnd','coverOpen'].every(function(k){return zero(s[k])}))}
function isReg(s){return /^REG(?:\s*\(OP\s*\d+\))?$/.test(String(s&&s.mode||''))}
function zIdle(s){return readyFlags(s)&&String(s.mode||'')==='Z'}
function delay(ms){return new Promise(function(resolve){setTimeout(resolve,ms)})}
function timeout(ms){try{return AbortSignal.timeout(ms)}catch(e){return undefined}}
async function relay(action,payload){
 var c=credentials();if(!c.username||!c.password)throw new Error('Accedi a Optyker');
 var r=await fetch(RELAY,{method:'POST',headers:{'Content-Type':'application/json'},cache:'no-store',signal:timeout(20000),
  body:JSON.stringify({action:action,username:c.username,password:c.password,payload:payload||{}})});
 var x=await r.json().catch(function(){return {}});
 if(!r.ok||!x||x.ok!==true)throw new Error((x&&x.error)||'Cloud Relay non disponibile');
 return x.data;
}
async function localStatus(){
 try{var r=await fetch(LOCAL+'/status',{cache:'no-store',signal:timeout(5000)});if(!r.ok)return null;return await r.json()}catch(e){return null}
}
async function relayStatus(){try{var d=await relay('status',{});return d&&d.online?d:null}catch(e){return null}}
async function currentStatus(){var s=await localStatus();if(s)return s;var d=await relayStatus();return d?d.status:null}
async function restore(){
 var s=await currentStatus();
 if(!s||isReg(s)||!zIdle(s))return {changed:false,status:s};
 // The PC cassa publishes its status every few seconds: wait until it also sees Z idle.
 var d=null;
 for(var i=0;i<6;i++){d=await relayStatus();if(d&&zIdle(d.status))break;if(d&&d.status&&isReg(d.status))return {changed:false,status:d.status};await delay(2000)}
 if(!d||!zIdle(d.status))return {changed:false,status:s,reason:'relay'};
 var q=await relay('queue_aux',{kind:'restore_reg'}),id=q&&q.id;
 if(!id)return {changed:false,status:s,reason:'queue'};
 var end=Date.now()+35000,done=null;
 while(Date.now()<end){
  var c=await relay('command_status',{command_id:id});
  if(c&&['completed','failed','expired'].indexOf(c.state)>=0){done=c;break}
  await delay(900);
 }
 if(!done||done.state!=='completed'||!done.result||done.result.ok!==true)return {changed:false,status:s,reason:(done&&(done.error||(done.result&&done.result.error)))||'pending'};
 for(var n=0;n<12;n++){var after=await currentStatus();if(readyFlags(after)&&isReg(after))return {changed:true,status:after};await delay(800)}
 return {changed:true,status:null};
}
function ensureReg(){
 if(!running)running=restore().catch(function(e){return {changed:false,error:String(e&&e.message||e)}}).then(function(r){running=null;return r},function(e){running=null;throw e});
 return running;
}
function wrap(){
 var f=window.OPTYKER_FISCAL;if(!f||f.__autoReg||typeof f.checkReady!=='function')return;
 var inner=f,check=f.checkReady;
 var next=Object.assign({},inner,{
  checkReady:function(){var args=arguments;return ensureReg().then(function(){return check.apply(inner,args)})},
  __autoReg:true,__cloudRelay:inner.__cloudRelay
 });
 try{window.OPTYKER_FISCAL=Object.freeze(next)}catch(e){}
}
/* OPTYKER_RCH_RELAY_UPDATE_20261013: the PC cassa reports its Cloud Relay revision. While it is
   older than 2.3 a visible "Aggiorna connettore RCH" button downloads the one-time updater.
   The button disappears by itself once the PC cassa reports the new revision. */
var CURRENT_REVISION='2.3-reg-auto',UPDATE_URL='/rch-connector/Aggiorna-Relay-REG.bat?v=20261013-update1',worker=null,workerAt=0,workerRun=null;
function windowsPc(){return /Windows/i.test(String(navigator.userAgent||''))}
function workerInfo(force){
 if(!force&&worker&&Date.now()-workerAt<60000)return Promise.resolve(worker);
 if(workerRun)return workerRun;
 workerRun=relayStatus().then(function(d){
  var rev=d&&d.status?String(d.status.workerRevision||''):'';
  return {online:!!d,revision:rev,updated:d?rev===CURRENT_REVISION:null,windows:windowsPc(),url:UPDATE_URL};
 },function(){return {online:false,revision:'',updated:null,windows:windowsPc(),url:UPDATE_URL}}).then(function(r){worker=r;workerAt=Date.now();workerRun=null;return r});
 return workerRun;
}
function updateHelp(){
 alert('Aggiornamento del connettore RCH (una volta sola, sul PC cassa):\n\n1. Apri il file scaricato "Aggiorna-Relay-REG.bat" (in basso nel browser o nella cartella Download). Se il browser avvisa, scegli "Conserva".\n2. Se Windows chiede conferma: "Ulteriori informazioni" e poi "Esegui comunque".\n3. Attendi la scritta AGGIORNAMENTO COMPLETATO.\n\nNon vengono stampati scontrini e non viene fatta nessuna chiusura.');
}
function showUpdateButton(){
 var badge=document.getElementById('optykerCashRch');if(!badge||!badge.parentNode)return;
 workerInfo().then(function(info){
  var old=document.getElementById('optykerRchRelayUpdate');
  if(!(info&&info.online&&info.updated===false)){if(old)old.remove();return}
  if(old)return;
  var a=document.createElement('a');a.id='optykerRchRelayUpdate';a.className='optykerRchRelayUpdate';a.textContent='Aggiorna connettore RCH';
  if(info.windows){a.href=UPDATE_URL;a.setAttribute('download','Aggiorna-Relay-REG.bat');a.title='Scarica e avvia l\'aggiornamento sul PC cassa';a.addEventListener('click',function(){setTimeout(updateHelp,400)})}
  else{a.href='#';a.title='Da fare sul PC della cassa';a.addEventListener('click',function(ev){ev.preventDefault();alert('Apri Optyker sul PC della cassa, entra in Cassa e premi "Aggiorna connettore RCH": scarica un file da aprire una volta sola.')})}
  var after=document.getElementById('optykerRchRegBtn')||badge;if(after.parentNode)after.parentNode.insertBefore(a,after.nextSibling);
 });
}
function updateStyle(){
 if(document.getElementById('optykerRchRelayUpdateCss'))return;
 var s=document.createElement('style');s.id='optykerRchRelayUpdateCss';
 s.textContent='.optykerRchRelayUpdate{margin-left:8px;display:inline-flex;align-items:center;min-height:30px;padding:5px 11px;border-radius:9px;background:#b45309;border:1px solid #b45309;color:#fff!important;font:700 12px/1.2 system-ui,sans-serif;text-decoration:none!important;cursor:pointer;white-space:nowrap}.optykerRchRelayUpdate:hover{background:#92400e}';
 (document.head||document.documentElement).appendChild(s);
}
window.OPTYKER_RCH_AUTO_REG=Object.freeze({version:VERSION,ensureReg:ensureReg,wrap:wrap,workerInfo:workerInfo,updateUrl:UPDATE_URL});
wrap();setInterval(wrap,1000);
updateStyle();setInterval(showUpdateButton,5000);setTimeout(showUpdateButton,1500);
})();

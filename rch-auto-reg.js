/* OPTYKER_RCH_AUTO_REG_20261011: before a receipt, a RCH left idle in Z (after a closure,
   from the keyboard or by another program) goes back to REG through the PC cassa.
   It uses the existing Cloud Relay restore_reg command: only =C1, never a closure,
   a receipt or a repeated sale. If anything is uncertain the normal checks decide. */
(function(){
'use strict';
if(window.OPTYKER_RCH_AUTO_REG)return;
var RELAY='https://whgziwaegjzqsgcntesr.supabase.co/functions/v1/optyker-rch-relay-api',LOCAL='http://127.0.0.1:8765',VERSION='20261011-autoreg1',running=null;
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
window.OPTYKER_RCH_AUTO_REG=Object.freeze({version:VERSION,ensureReg:ensureReg,wrap:wrap});
wrap();setInterval(wrap,1000);
})();

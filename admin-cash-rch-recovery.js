/* OPTYKER_ADMIN_CASH_RCH_RECOVERY_20260916 */
(function(){
'use strict';
if(window.__OPTYKER_ADMIN_CASH_RCH_RECOVERY__)return;
window.__OPTYKER_ADMIN_CASH_RCH_RECOVERY__='20260916-rchrecovery1';
var API='https://whgziwaegjzqsgcntesr.supabase.co/functions/v1/optyker-admin-cash-api';
var TOKEN_KEY='optyker_billing_admin_token';
var busy=false;
function token(){try{return sessionStorage.getItem(TOKEN_KEY)||''}catch(e){return ''}}
function todayRome(){var p=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()),o={};p.forEach(function(x){o[x.type]=x.value});return o.year+'-'+o.month+'-'+o.day}
function toast(msg,type){var t=document.getElementById('optykerAdminCashToast');if(!t){t=document.createElement('div');t.id='optykerAdminCashToast';document.body.appendChild(t)}t.className=type||'';t.textContent=msg;t.style.display='block';clearTimeout(t.__h);t.__h=setTimeout(function(){t.style.display='none'},6000)}
function call(date){var ctl=new AbortController(),timer=setTimeout(function(){ctl.abort()},95000);return fetch(API,{method:'POST',cache:'no-store',signal:ctl.signal,headers:{'Content-Type':'application/json','Authorization':'Bearer '+token()},body:JSON.stringify({action:'complete_rch_closure',business_date:date})}).then(function(r){return r.json().catch(function(){return {}}).then(function(x){if(!r.ok||x.ok===false)throw new Error(x.error||('HTTP '+r.status));return x})}).finally(function(){clearTimeout(timer)})}
function run(date,btn){if(busy)return;if(!confirm('Completare adesso SOLO la chiusura giornaliera sulla RCH? La chiusura contabile di Optyker è già registrata e non verrà modificata.'))return;busy=true;var old=btn.textContent;btn.disabled=true;btn.textContent='Chiusura RCH…';toast('Invio chiusura giornaliera alla RCH…','');call(date).then(function(){btn.textContent='RCH chiusa';btn.disabled=true;btn.dataset.done='1';toast('Chiusura RCH completata e confermata.','ok')}).catch(function(e){btn.disabled=false;btn.textContent=old;toast(e&&e.message?e.message:String(e),'error')}).finally(function(){busy=false})}
function install(){var body=document.getElementById('optykerAdminCashDays');if(!body)return;var d=todayRome();body.querySelectorAll('[data-view]').forEach(function(view){if(view.getAttribute('data-view')!==d)return;var cell=view.parentElement;if(!cell||cell.querySelector('[data-rch-recovery]'))return;var b=document.createElement('button');b.type='button';b.className='optykerAdminCashMini primary';b.setAttribute('data-rch-recovery',d);b.textContent='Completa RCH';b.style.marginLeft='6px';b.onclick=function(){run(d,b)};cell.appendChild(b)})}
function boot(){install();setInterval(install,2000)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();

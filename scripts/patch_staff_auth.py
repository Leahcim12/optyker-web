from pathlib import Path

p=Path('_site/index.html')
s=p.read_text(encoding='utf-8')
MARK='OPTYKER_STAFF_AUTH_V1'
if MARK in s:
    raise SystemExit(0)
if 'id="optykerLoginOperator"' not in s or 'optykerLoginCard' not in s:
    raise SystemExit('Login Optyker non trovato')

css=r'''<style id="optykerStaffAuthCss">/* OPTYKER_STAFF_AUTH_V1 */
.optykerAuthFields{display:none;margin-top:12px}.optykerAuthFields.show{display:block}
.optykerAuthField{margin-top:10px}.optykerAuthField label{display:block;font-size:12px;font-weight:800;color:#40566a;margin-bottom:5px}
.optykerAuthField input{width:100%;height:43px;border:1px solid #cbd8e2;border-radius:9px;padding:0 11px;box-sizing:border-box;background:#fff;color:#17324a;font-size:13px}
.optykerAuthHint{font-size:10px;color:#6f8292;line-height:1.45;margin-top:7px}
.optykerAuthMode{font-size:11px;font-weight:900;color:#1769aa;margin-top:10px}
.optykerForgot{display:none;width:100%;border:0;background:transparent;color:#1769aa;font-size:11px;font-weight:800;text-decoration:underline;cursor:pointer;padding:10px 0 0}
.optykerForgot.show{display:block}.optykerLoginButton:disabled{opacity:.55;cursor:wait}
.optykerAuthSuccess{color:#2f6e33!important}.optykerAuthWarn{color:#a15c00!important}
</style>'''

js=r'''<script id="optykerStaffAuthJs">(function(){/* OPTYKER_STAFF_AUTH_V1 */
var AUTH='https://whgziwaegjzqsgcntesr.supabase.co/functions/v1/optyker-staff-auth';
var S={mode:'idle',status:null,busy:false,recoveryToken:'',recovery:false};
function E(i){return document.getElementById(i)}
function T(v){return String(v==null?'':v).trim()}
function err(t,ok){var e=E('optykerLoginError');if(!e)return;e.textContent=t||'';e.classList.toggle('optykerAuthSuccess',!!ok)}
function api(action,data,token){data=data||{};data.action=action;var h={'Content-Type':'application/json'};if(token)h.Authorization='Bearer '+token;return fetch(AUTH,{method:'POST',headers:h,cache:'no-store',body:JSON.stringify(data)}).then(function(r){return r.json().catch(function(){return{ok:false,error:'Risposta non valida'}}).then(function(x){if(!r.ok||!x||x.ok===false)throw Error(x&&x.error||'Operazione non riuscita');return x})})}
function build(){
  var form=document.querySelector('.optykerLoginCard'),sel=E('optykerLoginOperator');if(!form||!sel||E('optykerAuthFields'))return;
  var submit=form.querySelector('.optykerLoginButton');if(!submit)return;
  var box=document.createElement('div');box.id='optykerAuthFields';box.className='optykerAuthFields';box.innerHTML=
    '<div id="optykerAuthMode" class="optykerAuthMode"></div>'+
    '<div id="optykerAuthEmailWrap" class="optykerAuthField" style="display:none"><label for="optykerAuthEmail">Email associata</label><input id="optykerAuthEmail" type="email" autocomplete="email" spellcheck="false"><div id="optykerAuthEmailHint" class="optykerAuthHint"></div></div>'+
    '<div id="optykerAuthPasswordWrap" class="optykerAuthField"><label for="optykerAuthPassword">Password</label><input id="optykerAuthPassword" type="password" minlength="8" maxlength="128" autocomplete="current-password"></div>'+
    '<div id="optykerAuthConfirmWrap" class="optykerAuthField" style="display:none"><label for="optykerAuthPassword2">Conferma password</label><input id="optykerAuthPassword2" type="password" minlength="8" maxlength="128" autocomplete="new-password"></div>'+
    '<div id="optykerAuthHint" class="optykerAuthHint"></div>';
  form.insertBefore(box,submit);
  var forgot=document.createElement('button');forgot.id='optykerForgot';forgot.className='optykerForgot';forgot.type='button';forgot.textContent='Password dimenticata?';submit.insertAdjacentElement('afterend',forgot);
  sel.addEventListener('change',checkUser);
  forgot.onclick=forgotPassword;
  E('optykerAuthPassword').addEventListener('keydown',function(ev){if(ev.key==='Enter'){ev.preventDefault();window.optykerLogin()}});
  E('optykerAuthPassword2').addEventListener('keydown',function(ev){if(ev.key==='Enter'){ev.preventDefault();window.optykerLogin()}});
  detectRecovery();
}
function setBusy(on){S.busy=!!on;var b=document.querySelector('.optykerLoginButton'),sel=E('optykerLoginOperator');if(b)b.disabled=!!on;if(sel)sel.disabled=!!on}
function clearPw(){if(E('optykerAuthPassword'))E('optykerAuthPassword').value='';if(E('optykerAuthPassword2'))E('optykerAuthPassword2').value=''}
function applyStatus(x){
  S.status=x||null;S.mode=x&&x.needs_password?'initial':'login';
  var box=E('optykerAuthFields'),mode=E('optykerAuthMode'),emailWrap=E('optykerAuthEmailWrap'),passWrap=E('optykerAuthPasswordWrap'),confirm=E('optykerAuthConfirmWrap'),hint=E('optykerAuthHint'),forgot=E('optykerForgot'),pass=E('optykerAuthPassword'),btn=document.querySelector('.optykerLoginButton');
  if(box)box.classList.add('show');clearPw();
  if(S.mode==='initial'){
    if(mode)mode.textContent='Primo accesso · crea la password';
    if(passWrap)passWrap.style.display='block';
    if(confirm)confirm.style.display='block';
    if(emailWrap)emailWrap.style.display='none';
    if(pass)pass.autocomplete='new-password';
    if(E('optykerAuthEmail'))E('optykerAuthEmail').value='';
    if(E('optykerAuthEmailHint'))E('optykerAuthEmailHint').textContent='';
    if(hint)hint.textContent='Scegli almeno 8 caratteri. La password verrà richiesta a ogni nuovo accesso.';
    if(forgot)forgot.classList.remove('show');
    if(btn)btn.textContent='CREA PASSWORD E ACCEDI';
  }else{
    if(mode)mode.textContent='Inserisci la password';
    if(passWrap)passWrap.style.display='block';
    if(confirm)confirm.style.display='none';
    if(emailWrap)emailWrap.style.display='none';
    if(pass)pass.autocomplete='current-password';
    if(hint)hint.textContent='Inserisci username e password per accedere.';
    if(forgot)forgot.classList.toggle('show',!!x.has_email);
    if(btn)btn.textContent='ENTRA IN OPTYKER';
    setTimeout(function(){try{if(pass)pass.focus()}catch(e){}},50);
  }
}
function checkUser(){
  if(S.recovery)return;
  var u=T(E('optykerLoginOperator')&&E('optykerLoginOperator').value),box=E('optykerAuthFields'),forgot=E('optykerForgot');
  err('');S.status=null;S.mode='idle';clearPw();
  if(!u){if(box)box.classList.remove('show');if(forgot)forgot.classList.remove('show');return}
  setBusy(true);api('status',{username:u}).then(applyStatus).catch(function(e){err(e.message)}).finally(function(){setBusy(false)});
}
function enterApp(username,password){
  try{if(window.optykerSetActiveOperator)optykerSetActiveOperator(username)}catch(e){}
  try{if(window.OPTYKER_CLOUD){OPTYKER_CLOUD.username=username;OPTYKER_CLOUD.password=password;OPTYKER_CLOUD.clients=[];OPTYKER_CLOUD.sheets={};OPTYKER_CLOUD.consents={}}}catch(e){}
  window.optykerAuthenticated=true;err('');
  if(E('optykerLoginScreen'))E('optykerLoginScreen').style.display='none';
  if(E('mainApp'))E('mainApp').style.display='grid';
  try{if(window.optykerCollapseSheetsSidebar)optykerCollapseSheetsSidebar()}catch(e){}
  try{if(window.showDashboard)showDashboard()}catch(e){}
  try{if(window.cloudApi)cloudApi('ping',{}).then(function(){return window.cloudLoadClients&&cloudLoadClients()}).catch(function(e){if(window.cloudSetStatus)cloudSetStatus('Gestionale aperto · cloud da sincronizzare: '+(e.message||e),false)})}catch(e){}
}
function doLogin(){
  if(S.busy)return false;
  var u=T(E('optykerLoginOperator')&&E('optykerLoginOperator').value);
  if(!u){err('Seleziona un utente.');return false}
  if(!S.status){checkUser();return false}
  var p=String(E('optykerAuthPassword')&&E('optykerAuthPassword').value||'');
  if(S.mode==='initial'){
    var p2=String(E('optykerAuthPassword2')&&E('optykerAuthPassword2').value||'');
    if(p.length<8){err('La password deve avere almeno 8 caratteri.');return false}
    if(p!==p2){err('Le due password non coincidono.');return false}
    setBusy(true);err('');
    api('initial',{username:u,email:'',password:p}).then(function(x){enterApp(x.username||u,p)}).catch(function(e){err(e.message);clearPw()}).finally(function(){setBusy(false)});
    return false;
  }
  if(p.length<8){err('Inserisci una password di almeno 8 caratteri.');return false}
  setBusy(true);err('');
  api('login',{username:u,password:p}).then(function(x){enterApp(x.username||u,p)}).catch(function(e){err(e.message);clearPw();try{E('optykerAuthPassword').focus()}catch(z){}}).finally(function(){setBusy(false)});
  return false;
}
function forgotPassword(){
  if(S.busy||S.recovery)return;
  var u=T(E('optykerLoginOperator')&&E('optykerLoginOperator').value);if(!u){err('Seleziona prima lo username.');return}
  setBusy(true);err('Invio email di recupero…');
  api('forgot',{username:u}).then(function(x){err('Email di recupero inviata a '+(x.email_masked||'all’indirizzo associato')+'.',true)}).catch(function(e){err(e.message||'Invio email non riuscito')}).finally(function(){setBusy(false)});
}
function detectRecovery(){
  var h=new URLSearchParams(String(location.hash||'').replace(/^#/,''));
  var token=h.get('access_token')||'',type=h.get('type')||'';
  if(!token||type!=='recovery')return;
  S.recovery=true;S.recoveryToken=token;S.mode='reset';
  var sel=E('optykerLoginOperator'),box=E('optykerAuthFields'),mode=E('optykerAuthMode'),emailWrap=E('optykerAuthEmailWrap'),passWrap=E('optykerAuthPasswordWrap'),confirm=E('optykerAuthConfirmWrap'),forgot=E('optykerForgot'),btn=document.querySelector('.optykerLoginButton'),hint=E('optykerAuthHint');
  if(sel)sel.parentElement.style.display='none';if(box)box.classList.add('show');if(mode)mode.textContent='Recupero password · scegli una nuova password';if(emailWrap)emailWrap.style.display='none';if(passWrap)passWrap.style.display='block';if(confirm)confirm.style.display='block';if(forgot)forgot.classList.remove('show');if(btn)btn.textContent='SALVA NUOVA PASSWORD';if(hint)hint.textContent='La nuova password deve avere almeno 8 caratteri.';if(E('optykerAuthPassword'))E('optykerAuthPassword').autocomplete='new-password';
  setTimeout(function(){try{E('optykerAuthPassword').focus()}catch(e){}},100);
}
function doReset(){
  if(S.busy)return false;
  var p=String(E('optykerAuthPassword')&&E('optykerAuthPassword').value||''),p2=String(E('optykerAuthPassword2')&&E('optykerAuthPassword2').value||'');
  if(p.length<8){err('Inserisci una password di almeno 8 caratteri.');return false}
  if(p!==p2){err('Le due password non coincidono.');return false}
  setBusy(true);api('reset',{password:p},S.recoveryToken).then(function(){
    try{history.replaceState(null,'',location.pathname+location.search)}catch(e){}
    S.recovery=false;S.recoveryToken='';S.mode='idle';S.status=null;clearPw();
    var sel=E('optykerLoginOperator'),box=E('optykerAuthFields'),forgot=E('optykerForgot'),btn=document.querySelector('.optykerLoginButton');
    if(sel&&sel.parentElement)sel.parentElement.style.display='';if(sel){sel.disabled=false;sel.value=''}if(box)box.classList.remove('show');if(forgot)forgot.classList.remove('show');if(btn)btn.textContent='ENTRA IN OPTYKER';
    err('Password aggiornata. Ora seleziona lo username e accedi con la nuova password.',true);
  }).catch(function(e){err(e.message)}).finally(function(){setBusy(false)});
  return false;
}
window.optykerLogin=function(){return S.recovery?doReset():doLogin()};
var oldShow=window.optykerShowLogin;
window.optykerShowLogin=function(){
  try{if(window.OPTYKER_CLOUD){OPTYKER_CLOUD.username='';OPTYKER_CLOUD.password='';OPTYKER_CLOUD.clients=[]}}catch(e){}
  S.status=null;S.mode='idle';S.recovery=false;S.recoveryToken='';clearPw();
  var r=oldShow?oldShow.apply(this,arguments):false;setTimeout(function(){var b=E('optykerAuthFields'),f=E('optykerForgot');if(b)b.classList.remove('show');if(f)f.classList.remove('show')},0);return r
};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',build,{once:true});else build();
})();</script>'''

h=s.find('</head>')
if h<0: raise SystemExit('head non trovato')
s=s[:h]+css+s[h:]
b=s.rfind('</body>')
if b<0: raise SystemExit('body non trovato')
s=s[:b]+js+s[b:]
p.write_text(s,encoding='utf-8')
if MARK not in s or 'optyker-staff-auth' not in s or 'Password dimenticata?' not in s:
    raise SystemExit('Patch autenticazione incompleta')
print('Optyker staff auth V1 OK')

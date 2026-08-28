from pathlib import Path

p=Path('_site/index.html')
s=p.read_text(encoding='utf-8')
MARK='OPTYKER_LOGIN_CLICK_FIX_V2'
if MARK in s:
    raise SystemExit(0)

css=r'''<style id="optykerLoginClickFixV2Css">/* OPTYKER_LOGIN_CLICK_FIX_V2 */
#optykerLoginClickV2{position:fixed!important;inset:0!important;z-index:2147483647!important;background:radial-gradient(circle at 25% 10%,#dceefc 0,transparent 35%),radial-gradient(circle at 82% 80%,#e5eafb 0,transparent 38%),#f3f3f3!important;display:flex!important;align-items:center!important;justify-content:center!important;padding:24px!important;box-sizing:border-box!important;pointer-events:auto!important}
#optykerLoginClickV2 *{pointer-events:auto!important}
#optykerLoginClickV2 .v2card{width:430px;max-width:96%;background:rgba(250,250,250,.96);border:1px solid rgba(0,0,0,.12);border-radius:14px;box-shadow:0 24px 70px rgba(0,0,0,.13);padding:30px 34px 26px;box-sizing:border-box;text-align:center}
#optykerLoginClickV2 .v2logo{width:96px;height:96px;object-fit:contain;border-radius:16px;border:1px solid rgba(0,0,0,.12);background:#fff;display:block;margin:0 auto 16px}
#optykerLoginClickV2 .v2brand{font-size:29px;font-weight:900;color:#202020}
#optykerLoginClickV2 .v2prop{font-size:10px;font-weight:800;letter-spacing:.8px;color:#666;margin:8px 0 22px}
#optykerLoginClickV2 .v2login{border-top:1px solid #e0e7ef;padding-top:20px;text-align:left}
#optykerLoginClickV2 .v2title{text-align:center;font-size:17px;font-weight:900;color:#1d3550;margin-bottom:17px}
#optykerLoginClickV2 label{display:block;font-size:12px;color:#40556d;font-weight:800;margin:0 0 6px}
#optykerLoginClickV2 select,#optykerLoginClickV2 input{display:block!important;width:100%!important;height:44px!important;border:1px solid #c7d4e1!important;border-radius:7px!important;padding:9px 12px!important;background:#fff!important;color:#17324a!important;font-size:14px!important;box-sizing:border-box!important;position:relative!important;z-index:2147483647!important;cursor:pointer!important}
#optykerLoginClickV2 .v2pw{margin-top:12px;display:none}
#optykerLoginClickV2 .v2pw.show{display:block}
#optykerLoginClickV2 .v2btn{display:block!important;width:100%!important;border:0!important;border-radius:7px!important;background:#1769aa!important;color:#fff!important;padding:13px 18px!important;font-size:14px!important;font-weight:900!important;cursor:pointer!important;margin-top:14px!important;position:relative!important;z-index:2147483647!important}
#optykerLoginClickV2 .v2btn:disabled{opacity:.55!important;cursor:wait!important}
#optykerLoginClickV2 .v2forgot{display:none;width:100%;border:0;background:transparent;color:#1769aa;font-size:11px;font-weight:800;text-decoration:underline;cursor:pointer;padding:10px 0 0}
#optykerLoginClickV2 .v2forgot.show{display:block}
#optykerLoginClickV2 .v2msg{min-height:18px;text-align:center;font-size:12px;font-weight:800;margin-top:10px;color:#b33d3d}
#optykerLoginClickV2 .v2msg.ok{color:#2f6e33}
#optykerLoginClickV2 .v2foot{text-align:center;color:#8694a4;font-size:10px;margin-top:17px}
body.optykerV2Logged #optykerLoginClickV2{display:none!important}
</style>'''

js=r'''<script id="optykerLoginClickFixV2Js">(function(){/* OPTYKER_LOGIN_CLICK_FIX_V2 */
var AUTH='https://whgziwaegjzqsgcntesr.supabase.co/functions/v1/optyker-staff-auth';
var busy=false,status=null;
function E(i){return document.getElementById(i)}
function api(action,data){data=data||{};data.action=action;return fetch(AUTH,{method:'POST',headers:{'Content-Type':'application/json'},cache:'no-store',body:JSON.stringify(data)}).then(function(r){return r.json().catch(function(){return{ok:false,error:'Risposta non valida'}}).then(function(x){if(!r.ok||!x||x.ok===false)throw Error(x&&x.error||'Operazione non riuscita');return x})})}
function message(t,ok){var e=E('optykerV2Msg');if(e){e.textContent=t||'';e.className='v2msg'+(ok?' ok':'')}}
function setBusy(v){busy=!!v;var b=E('optykerV2Enter'),s=E('optykerV2User'),p=E('optykerV2Password');if(b)b.disabled=busy;if(s)s.disabled=busy;if(p)p.disabled=busy}
function options(){
  var old=E('optykerLoginOperator'),a=[];
  if(old){for(var i=0;i<old.options.length;i++){var o=old.options[i];if(o.value)a.push({v:o.value,t:o.textContent||o.value})}}
  if(!a.length)a=[{v:'Michael Mologni',t:'Michael Mologni'},{v:'Giorgia Bono',t:'Giorgia Bono'},{v:'Diego Panseri',t:'Diego Panseri'}];
  return a
}
function syncOptions(){
  var s=E('optykerV2User');if(!s)return;
  var val=s.value,ops=options();
  s.innerHTML='<option value="">Seleziona utente</option>'+ops.map(function(o){return'<option value="'+String(o.v).replace(/"/g,'&quot;')+'">'+String(o.t)+'</option>'}).join('');
  if(ops.some(function(o){return o.v===val}))s.value=val
}
function showPassword(x){
  status=x||null;var w=E('optykerV2Pw'),f=E('optykerV2Forgot'),p=E('optykerV2Password');
  if(w)w.classList.add('show');if(f)f.classList.toggle('show',!!(x&&x.has_email));
  if(p){p.value='';setTimeout(function(){try{p.focus()}catch(e){}},30)}
}
function check(){
  if(busy)return;var u=E('optykerV2User')&&E('optykerV2User').value||'';
  status=null;message('');var w=E('optykerV2Pw'),f=E('optykerV2Forgot');if(w)w.classList.remove('show');if(f)f.classList.remove('show');
  if(!u)return;
  setBusy(true);api('status',{username:u}).then(showPassword).catch(function(e){message(e.message)}).finally(function(){setBusy(false)})
}
function enter(){
  if(busy)return;var u=E('optykerV2User')&&E('optykerV2User').value||'',p=E('optykerV2Password')&&E('optykerV2Password').value||'';
  if(!u){message('Seleziona un utente.');return}
  if(!status){check();return}
  if(p.length<8){message('Inserisci una password di almeno 8 caratteri.');return}
  setBusy(true);message('');
  api('login',{username:u,password:p}).then(function(x){
    var user=x.username||u;
    try{localStorage.setItem('optyker_staff_saved_user_v1',user)}catch(e){}
    try{if(window.optykerSetActiveOperator)window.optykerSetActiveOperator(user)}catch(e){}
    try{if(window.OPTYKER_CLOUD){OPTYKER_CLOUD.username=user;OPTYKER_CLOUD.password=p;OPTYKER_CLOUD.clients=[];OPTYKER_CLOUD.sheets={};OPTYKER_CLOUD.consents={}}}catch(e){}
    window.optykerAuthenticated=true;
    document.body.classList.add('optykerV2Logged');
    var old=E('optykerLoginScreen');if(old){old.style.setProperty('display','none','important');old.style.setProperty('pointer-events','none','important')}
    var app=E('mainApp');if(app){app.style.setProperty('display','grid','important');app.style.setProperty('pointer-events','auto','important')}
    try{if(window.optykerCollapseSheetsSidebar)window.optykerCollapseSheetsSidebar()}catch(e){}
    try{if(window.showDashboard)window.showDashboard()}catch(e){}
    try{if(window.cloudApi)window.cloudApi('ping',{}).then(function(){return window.cloudLoadClients&&window.cloudLoadClients()}).catch(function(){})}catch(e){}
  }).catch(function(e){message(e.message||'Password errata');var p=E('optykerV2Password');if(p){p.value='';try{p.focus()}catch(z){}}}).finally(function(){setBusy(false)})
}
function forgot(){
  if(busy)return;var u=E('optykerV2User')&&E('optykerV2User').value||'';if(!u){message('Seleziona prima lo username.');return}
  setBusy(true);message('Invio email di recupero…');api('forgot',{username:u}).then(function(x){message('Email di recupero inviata.',true)}).catch(function(e){message(e.message)}).finally(function(){setBusy(false)})
}
function build(){
  if(E('optykerLoginClickV2'))return;
  var old=E('optykerLoginScreen'),logo=old&&old.querySelector('.optykerLoginLogo'),src=logo&&logo.src||'';
  var d=document.createElement('div');d.id='optykerLoginClickV2';
  d.innerHTML='<div class="v2card">'+(src?'<img class="v2logo" src="'+src+'" alt="Optyker">':'')+'<div class="v2brand">Optyker</div><div class="v2prop">PROPRIETÀ INTELLETTUALE DELLA MOLOGNI COMPANY S.R.L.</div><div class="v2login"><div class="v2title">Accesso al gestionale</div><label for="optykerV2User">Utente</label><select id="optykerV2User"></select><div id="optykerV2Pw" class="v2pw"><label for="optykerV2Password">Password</label><input id="optykerV2Password" type="password" autocomplete="current-password"></div><button id="optykerV2Enter" class="v2btn" type="button">ENTRA IN OPTYKER</button><button id="optykerV2Forgot" class="v2forgot" type="button">Password dimenticata?</button><div id="optykerV2Msg" class="v2msg"></div><div class="v2foot">Accesso riservato · Mologni Company S.R.L. · Cloud Supabase</div></div></div>';
  document.body.appendChild(d);
  if(old){old.style.setProperty('visibility','hidden','important');old.style.setProperty('pointer-events','none','important')}
  syncOptions();
  E('optykerV2User').addEventListener('change',check);
  E('optykerV2Enter').addEventListener('click',enter);
  E('optykerV2Password').addEventListener('keydown',function(ev){if(ev.key==='Enter'){ev.preventDefault();enter()}});
  E('optykerV2Forgot').addEventListener('click',forgot);
  var oldShow=window.optykerShowLogin;
  window.optykerShowLogin=function(){
    document.body.classList.remove('optykerV2Logged');status=null;message('');syncOptions();
    var w=E('optykerV2Pw');if(w)w.classList.remove('show');
    var f=E('optykerV2Forgot');if(f)f.classList.remove('show');
    var u=E('optykerV2User');if(u)u.value='';
    var p=E('optykerV2Password');if(p)p.value='';
    try{if(oldShow)oldShow.apply(this,arguments)}catch(e){}
    var o=E('optykerLoginScreen');if(o){o.style.setProperty('visibility','hidden','important');o.style.setProperty('pointer-events','none','important')}
    return false
  };
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',build,{once:true});else build();
setTimeout(build,100);
})();</script>'''

i=s.find('</head>')
if i<0: raise SystemExit('head non trovato')
s=s[:i]+css+s[i:]
j=s.rfind('</body>')
if j<0: raise SystemExit('body non trovato')
s=s[:j]+js+s[j:]
p.write_text(s,encoding='utf-8')
print('Login cliccabile V2 applicato')

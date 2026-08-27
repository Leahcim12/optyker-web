from pathlib import Path
p=Path('_site/index.html')
s=p.read_text(encoding='utf-8')
MARK='OPTYKER_APPOINTMENTS_UI_V11_SECURE'
if MARK in s: raise SystemExit(0)
if 'OPTYKER_APPOINTMENTS_UI_V10_MANAGE' not in s: raise SystemExit('Agenda V10 non disponibile')
old="function staffApi(action,payload){return rpc('optyker_appointments_api',{p_username:OPTYKER_CLOUD.username,p_password:OPTYKER_CLOUD.password||'',p_action:action,p_payload:payload||{}})}"
new="function oaV11Auth(){if(!OPTYKER_CLOUD||!OPTYKER_CLOUD.username||!OPTYKER_CLOUD.password){return false}return true}function staffApi(action,payload){if(!oaV11Auth())return Promise.reject(new Error('Sessione scaduta: accedi di nuovo con la password'));return rpc('optyker_appointments_api',{p_username:OPTYKER_CLOUD.username,p_password:OPTYKER_CLOUD.password,p_action:action,p_payload:payload||{}}).catch(function(e){if(/non autorizzato/i.test(String(e&&e.message||e))){try{if(window.optykerShowLogin)window.optykerShowLogin()}catch(z){}}throw e})}function staffManage(action,payload){if(!oaV11Auth())return Promise.reject(new Error('Sessione scaduta: accedi di nuovo con la password'));return fetch('https://whgziwaegjzqsgcntesr.supabase.co/functions/v1/optyker-appointments-staff',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:OPTYKER_CLOUD.username,password:OPTYKER_CLOUD.password,action:action,payload:payload||{}})}).then(function(r){return r.json().then(function(x){if(!r.ok||!x||x.ok===false){if(r.status===403||/non autorizzato/i.test(String(x&&x.error||''))){try{if(window.optykerShowLogin)window.optykerShowLogin()}catch(z){}}throw Error(x&&x.error||('Server '+r.status))}return x})})}"
if old not in s: raise SystemExit('staffApi V10 non trovato')
s=s.replace(old,new,1)
old2="rpc('optyker_appointment_staff_reschedule',{p_username:OPTYKER_CLOUD.username,p_appointment_id:M.item.id,p_payload:p}).then(function(){"
new2="staffManage('reschedule',Object.assign({id:M.item.id},p)).then(function(){"
if old2 not in s: raise SystemExit('salvataggio V10 non trovato')
s=s.replace(old2,new2,1)
i=s.find('</head>')
s=s[:i]+"<meta name=\"optyker-appointments-v11\" content=\"OPTYKER_APPOINTMENTS_UI_V11_SECURE\">"+s[i:]
p.write_text(s,encoding='utf-8')
print('Appointments V11 secure staff save OK')

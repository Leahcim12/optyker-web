/* OPTYKER_VERIFIED_EMAIL_RECOVERY_V1
 * Public Auth endpoints only. No admin password writes, client identifiers,
 * biographical identity checks, automatic login or pre-existing session reuse.
 */
function optykerRecoveryUrl(){
  return 'https://leahcim12.github.io/optyker-web/reset-password/';
}
async function optykerPublicAuth(path, payload){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),20000);
  try{
    const response=await fetch(U+'/auth/v1/'+path,{
      method:'POST',credentials:'omit',cache:'no-store',signal:controller.signal,
      headers:{'Content-Type':'application/json','apikey':K},
      body:JSON.stringify(payload)
    });
    const result=await response.json().catch(()=>({}));
    if(!response.ok){
      const code=String(result.code||result.error_code||'');
      const error=new Error(response.status===429
        ? 'Troppe richieste. Attendi qualche minuto prima di riprovare.'
        : /email_address_not_authorized|unexpected_failure/.test(code)
          ? 'Invio email temporaneamente non disponibile. Contatta Ottica Visual Care. La password non è stata modificata.'
          : /weak_password/.test(code)
            ? 'Scegli una password più lunga e difficile da indovinare.'
            : 'Richiesta non riuscita. Riprova più tardi oppure contatta Ottica Visual Care.');
      error.code=code;throw error;
    }
    // Never persist or accept a session from a registration/recovery request.
    if(result.access_token||result.session?.access_token){
      throw new Error('È necessaria la conferma email. Contatta Ottica Visual Care prima di accedere.');
    }
    return result;
  }catch(error){
    if(error?.name==='AbortError')throw new Error('Il server non ha risposto in tempo. Riprova tra qualche minuto.');
    throw error;
  }finally{clearTimeout(timer)}
}
function forgotScreen(presetEmail=''){
  app.innerHTML=`<div class="loginPage"><div class="loginShell">
    <div class="brandLogo"><img src="https://cdn.shopify.com/s/files/1/0917/4289/6503/files/visual-care-logo-app-original.png?v=1787903859" alt="Ottica Visual Care"></div>
    <div class="brandTitle">Optyker</div><div class="brandSub">OTTICA VISUAL CARE · ACCESSO OPTYKER</div>
    <div class="loginCard"><h2>Recupera la password</h2>
      <p class="authNotice">Inserisci l’email del tuo account. Riceverai un link personale per scegliere una nuova password.</p>
      <form id="recoveryRequestForm">
        <label class="label" for="forgotEmail">Email dell’account</label>
        <input id="forgotEmail" class="input" type="email" autocomplete="email" autocapitalize="none" spellcheck="false" maxlength="254" required placeholder="nome@email.it" value="${esc(presetEmail)}">
        <button id="forgotGo" type="submit" class="primary">INVIA LINK DI RECUPERO</button>
      </form>
      <button id="forgotBack" type="button" class="linkBtn authBack">‹ Torna all’accesso</button>
      <div id="forgotErr" class="error" role="status" aria-live="polite"></div>
      <div class="loginFoot">La password si cambia soltanto dopo aver aperto il link ricevuto via email.</div>
    </div></div></div>`;
  const form=document.getElementById('recoveryRequestForm');
  const emailField=document.getElementById('forgotEmail');
  const btn=document.getElementById('forgotGo');
  const err=document.getElementById('forgotErr');
  document.getElementById('forgotBack').onclick=()=>login('',emailField.value);
  form.onsubmit=async(event)=>{
    event.preventDefault();
    if(btn.disabled||!form.reportValidity())return;
    const email=emailField.value.trim().toLowerCase();
    btn.disabled=true;btn.textContent='INVIO IN CORSO…';err.textContent='';
    try{
      await optykerPublicAuth('recover?redirect_to='+encodeURIComponent(optykerRecoveryUrl()),{email});
      if(!form.isConnected)return;
      authSuccess('Controlla la tua email','Se esiste un account associato a questo indirizzo, riceverai un link per reimpostare la password. Controlla anche la posta indesiderata. La richiesta non modifica la password e non effettua l’accesso.',email);
    }catch(error){
      err.textContent=error?.message||'Invio non riuscito. Riprova più tardi.';
      btn.disabled=false;btn.textContent='INVIA LINK DI RECUPERO';
    }
  };
}
function registerScreen(presetEmail=''){
  app.innerHTML=`<div class="loginPage"><div class="loginShell">
    <div class="brandLogo"><img src="https://cdn.shopify.com/s/files/1/0917/4289/6503/files/visual-care-logo-app-original.png?v=1787903859" alt="Ottica Visual Care"></div>
    <div class="brandTitle">Optyker</div><div class="brandSub">OTTICA VISUAL CARE · ACCESSO OPTYKER</div>
    <div class="loginCard"><h2>Crea il tuo account</h2>
      <p class="authNotice">Usa l’email presente nella tua scheda cliente. Prima di accedere dovrai confermarla attraverso il link ricevuto.</p>
      <form id="secureRegistrationForm">
        <label class="label" for="regEmail">Email</label><input id="regEmail" class="input" type="email" autocomplete="email" autocapitalize="none" spellcheck="false" maxlength="254" required value="${esc(presetEmail)}">
        <label class="label" for="regName">Nome</label><input id="regName" class="input" autocomplete="given-name" maxlength="100" required>
        <label class="label" for="regSurname">Cognome</label><input id="regSurname" class="input" autocomplete="family-name" maxlength="100" required>
        <label class="label" for="regPhone">Telefono</label><input id="regPhone" class="input" type="tel" autocomplete="tel" maxlength="40" required>
        <label class="label" for="regPassword">Crea password</label><input id="regPassword" class="input" type="password" autocomplete="new-password" minlength="8" maxlength="128" required placeholder="Almeno 8 caratteri">
        <label class="label" for="regPassword2">Ripeti password</label><input id="regPassword2" class="input" type="password" autocomplete="new-password" minlength="8" maxlength="128" required>
        <button id="regGo" type="submit" class="primary">REGISTRATI E CONFERMA L’EMAIL</button>
      </form>
      <button id="regBack" type="button" class="linkBtn authBack">‹ Torna all’accesso</button>
      <div id="regErr" class="error" role="status" aria-live="polite"></div>
      <div class="loginFoot">Hai già un account? Usa “Password dimenticata”. La registrazione non cambia le password degli account esistenti.</div>
    </div></div></div>`;
  const form=document.getElementById('secureRegistrationForm');
  const emailField=document.getElementById('regEmail');
  const btn=document.getElementById('regGo');
  const err=document.getElementById('regErr');
  document.getElementById('regBack').onclick=()=>login('',emailField.value);
  form.onsubmit=async(event)=>{
    event.preventDefault();
    if(btn.disabled||!form.reportValidity())return;
    const email=emailField.value.trim().toLowerCase();
    const password=document.getElementById('regPassword').value;
    if(password!==document.getElementById('regPassword2').value){err.textContent='Le due password non coincidono.';return}
    btn.disabled=true;btn.textContent='INVIO IN CORSO…';err.textContent='';
    try{
      await optykerPublicAuth('signup?redirect_to='+encodeURIComponent(optykerRecoveryUrl()),{
        email,password,data:{
          name:document.getElementById('regName').value.trim(),
          surname:document.getElementById('regSurname').value.trim(),
          phone:document.getElementById('regPhone').value.trim()
        }
      });
      if(!form.isConnected)return;
      authSuccess('Conferma la tua email','Se la registrazione è disponibile, riceverai un’email di conferma. Se hai già un account, torna all’accesso e usa “Password dimenticata”.',email);
    }catch(error){err.textContent=error?.message||'Registrazione non riuscita.';btn.disabled=false;btn.textContent='REGISTRATI E CONFERMA L’EMAIL'}
  };
}
function newPasswordScreen(){
  // Never use whatever account happens to be stored in this browser.
  // Email recovery is handled by the isolated /reset-password page.
  forgotScreen('');
  const err=document.getElementById('forgotErr');
  if(err)err.textContent='Apri il link ricevuto via email per impostare la nuova password.';
}

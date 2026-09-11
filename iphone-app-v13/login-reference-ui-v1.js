/* OPTYKER_IPHONE_LOGIN_REFERENCE_V1 — presentation only.
 * Existing inputs and buttons are moved, never recreated. Authentication,
 * email verification, recovery isolation and API handlers remain untouched.
 */
(function () {
  'use strict';
  if (window.__ovcLoginReferenceV1) return;
  window.__ovcLoginReferenceV1 = true;

  function icon(kind) {
    const paths = {
      lock: '<rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/>',
      email: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="m4 7 8 6 8-6"/>',
      user: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
      phone: '<path d="m6 3 4 4-2 3a16 16 0 0 0 6 6l3-2 4 4-2 3C11 21 3 13 3 5z"/>',
      eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
      hidden: '<path d="m3 3 18 18M9.8 5.3A11 11 0 0 1 12 5c6 0 10 7 10 7a21 21 0 0 1-3.2 4M6.2 6.2A22 22 0 0 0 2 12s4 7 10 7a11 11 0 0 0 5.3-1.5M10 10a3 3 0 0 0 4 4"/>'
    };
    return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + (paths[kind] || paths.user) + '</svg>';
  }

  function decorate() {
    const page = document.querySelector('#app > .loginPage');
    if (!page || page.classList.contains('ovcAuthPage')) return;
    const shell = page.querySelector('.loginShell');
    const card = shell && shell.querySelector('.loginCard');
    const logo = shell && shell.querySelector('.brandLogo img');
    if (!shell || !card || !logo) return;
    const mode = card.querySelector('#email') ? 'login' :
      card.querySelector('#recoveryRequestForm') ? 'recovery' :
      card.querySelector('#secureRegistrationForm') ? 'registration' : 'message';
    page.classList.add('ovcAuthPage');
    page.dataset.authView = mode;
    shell.classList.add('ovcAuthShell');
    card.classList.add('ovcAuthCard');

    const top = document.createElement('header');
    top.className = 'refHomeTop ovcAuthHeader';
    top.innerHTML = '<div class="refBrandBar ovcAuthBrandBar"><div class="refBrand ovcAuthBrand"><div><b>OTTICA<br>VISUAL CARE</b><small>PIÙ VISIONE · PIÙ VITA</small></div></div><span class="ovcAuthMark" aria-hidden="true">' + icon('lock') + '</span></div>' +
      '<div class="refHero ovcAuthHero"><div class="refHeroCopy"><h1>Benvenuto.</h1><p>La tua visione, sempre con te.</p></div><div class="refHeroScene" aria-hidden="true"><span class="refWall"></span><span class="refPlant"><i></i><i></i><i></i><i></i></span><b>VEDERE<br>MEGLIO<br>VIVERE<br>PIÙ FORTE</b></div></div>';
    top.querySelector('.ovcAuthBrand').prepend(logo);
    shell.querySelector('.brandLogo')?.remove();
    shell.querySelector(':scope > .brandTitle')?.remove();
    shell.querySelector(':scope > .brandSub')?.remove();
    shell.prepend(top);

    if (mode === 'login') {
      const title = card.querySelector('h2');
      if (title) {
        title.textContent = 'Accedi al tuo account';
        const intro = document.createElement('p');
        intro.className = 'ovcAuthIntro';
        intro.textContent = 'Ritrova il tuo profilo e tutti i tuoi servizi.';
        title.after(intro);
      }
      const enter = card.querySelector('#enter');
      const forgot = card.querySelector('#forgot');
      if (enter) enter.textContent = 'Accedi';
      if (enter && forgot) card.insertBefore(forgot, enter);
      const register = card.querySelector('#register');
      if (register) {
        const separator = document.createElement('div');
        separator.className = 'ovcAuthDivider';
        separator.textContent = 'È il tuo primo accesso?';
        register.before(separator);
        register.textContent = 'Crea il tuo account';
      }
      const foot = card.querySelector('.loginFoot');
      if (foot) foot.textContent = 'Usa le credenziali del tuo account Optyker.';
    }

    card.querySelectorAll('input.input').forEach(input => {
      const label = input.previousElementSibling;
      if (label && label.tagName === 'LABEL' && input.id) label.htmlFor = input.id;
      const field = document.createElement('div');
      field.className = 'ovcAuthField';
      const password = input.type === 'password';
      const glyph = document.createElement('span');
      glyph.className = 'ovcAuthFieldIcon';
      glyph.innerHTML = icon(password ? 'lock' : input.type === 'email' ? 'email' : input.type === 'tel' ? 'phone' : 'user');
      input.before(field);
      field.append(glyph, input);
      if (input.type === 'email') {
        input.setAttribute('autocapitalize', 'none');
        input.setAttribute('spellcheck', 'false');
        input.setAttribute('inputmode', 'email');
      }
      if (password && input.id) {
        field.classList.add('ovcAuthPassword');
        const reveal = document.createElement('button');
        reveal.type = 'button';
        reveal.className = 'ovcAuthReveal';
        reveal.setAttribute('aria-controls', input.id);
        reveal.setAttribute('aria-pressed', 'false');
        reveal.setAttribute('aria-label', 'Mostra password');
        reveal.innerHTML = icon('eye');
        reveal.addEventListener('click', function () {
          const showing = input.type === 'password';
          input.type = showing ? 'text' : 'password';
          reveal.setAttribute('aria-pressed', String(showing));
          reveal.setAttribute('aria-label', showing ? 'Nascondi password' : 'Mostra password');
          reveal.innerHTML = icon(showing ? 'hidden' : 'eye');
        });
        field.append(reveal);
      }
    });
    card.querySelectorAll('.error').forEach(message => {
      message.setAttribute('role', 'status');
      message.setAttribute('aria-live', 'polite');
      message.setAttribute('aria-atomic', 'true');
    });
    const signature = document.createElement('p');
    signature.className = 'ovcAuthSignature';
    signature.textContent = 'OTTICA VISUAL CARE · OPTYKER';
    shell.append(signature);
  }

  // Wrap rendering only. The original functions still own every action.
  const originalLogin = login;
  login = function (...args) { const result = originalLogin.apply(this, args); decorate(); return result; };
  const originalForgot = forgotScreen;
  forgotScreen = function (...args) { const result = originalForgot.apply(this, args); decorate(); return result; };
  const originalRegister = registerScreen;
  registerScreen = function (...args) { const result = originalRegister.apply(this, args); decorate(); return result; };
  const originalSuccess = authSuccess;
  authSuccess = function (...args) { const result = originalSuccess.apply(this, args); decorate(); return result; };
  decorate();
})();

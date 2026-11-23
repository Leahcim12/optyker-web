/* Read-only presentation of existing cashier errors. No requests, retries or fiscal writes. */
(function () {
  'use strict';
  if (window.OPTYKER_CASH_ERROR_DETAILS_VERSION) return;
  window.OPTYKER_CASH_ERROR_DETAILS_VERSION = '20260923-printdiag1';
  var last = '', queued = false;
  function show(text) {
    var old = document.getElementById('optykerCashErrorDetails');
    if (old) old.remove();
    var box = document.createElement('section');
    box.id = 'optykerCashErrorDetails';
    box.setAttribute('role', 'alert');
    box.setAttribute('aria-label', 'Dettaglio errore cassa');
    box.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:2147483647;width:540px;max-width:calc(100vw - 32px);max-height:75vh;overflow:auto;box-sizing:border-box;padding:20px;background:#fff;color:#231f20;border:2px solid #a12d3a;border-radius:12px;box-shadow:0 12px 40px #0004;font:15px/1.5 system-ui';
    var title = document.createElement('strong');
    title.textContent = 'Operazione non completata: dettaglio del blocco';
    var detail = document.createElement('pre');
    detail.style.cssText = 'white-space:pre-wrap;overflow-wrap:anywhere;font:inherit;padding:12px;background:#fff2f3;border-radius:8px';
    detail.textContent = text;
    var help = document.createElement('p');
    help.textContent = 'Questo è il messaggio completo restituito da Optyker. Il solo avviso “esito da verificare” non conferma né una stampa né un nuovo incasso. Nessuna operazione viene ripetuta da questa finestra.';
    var copy = document.createElement('button');
    copy.type = 'button'; copy.textContent = 'Copia errore';
    var close = document.createElement('button');
    close.type = 'button'; close.textContent = 'Chiudi dettaglio';
    [copy, close].forEach(function (b) { b.style.cssText = 'font:inherit;padding:10px 14px;margin-right:8px;border:1px solid #b8aeb0;border-radius:7px;background:white;cursor:pointer'; });
    copy.onclick = function () {
      if (!navigator.clipboard || !navigator.clipboard.writeText) { copy.textContent = 'Seleziona e copia il testo sopra'; return; }
      navigator.clipboard.writeText('Optyker ' + window.OPTYKER_CASH_ERROR_DETAILS_VERSION + '\n' + text).then(function () {
        copy.textContent = 'Errore copiato';
      }, function () { copy.textContent = 'Seleziona e copia il testo sopra'; });
    };
    close.onclick = function () { box.remove(); };
    box.append(title, detail, help, copy, close);
    document.body.appendChild(box);
  }
  function inspect() {
    queued = false;
    var toast = document.getElementById('optykerCashToast');
    if (!toast || !toast.classList.contains('error') || getComputedStyle(toast).display === 'none') { last = ''; return; }
    var text = String(toast.textContent || '').trim().slice(0, 4000);
    if (!text || !/RCH|stamp|scontrin|esito|incass|vendita|saldo/i.test(text)) return;
    if (text === last) return;
    last = text; show(text);
  }
  function schedule() { if (!queued) { queued = true; requestAnimationFrame(inspect); } }
  function boot() {
    new MutationObserver(schedule).observe(document.body, {childList:true, subtree:true, characterData:true, attributes:true, attributeFilter:['class','style']});
    schedule();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once:true});
  else boot();
})();

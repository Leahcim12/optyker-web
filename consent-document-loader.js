function loadConsentDocuments() {
  if (window.OPTYKER_CONSENT_DOCUMENTS) return Promise.resolve(window.OPTYKER_CONSENT_DOCUMENTS);
  if (!window.__optykerConsentDocumentsLoading) window.__optykerConsentDocumentsLoading = new Promise(function(resolve,reject) {
    var script=document.createElement('script');
    script.src='https://optyker.it/consent-documents.js?v=20261010-original-pages1';
    script.onload=function(){if(window.OPTYKER_CONSENT_DOCUMENTS)resolve(window.OPTYKER_CONSENT_DOCUMENTS);else reject(new Error('Documento completo non disponibile. Riprova.'));};
    script.onerror=function(){reject(new Error('Impossibile caricare il documento completo. Riprova.'));};
    document.head.appendChild(script);
  }).catch(function(error){window.__optykerConsentDocumentsLoading=null;throw error;});
  return window.__optykerConsentDocumentsLoading;
}

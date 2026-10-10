// Shared by Optyker, the customer website and the mobile app.
// Only original blank templates are bundled; customer records come from the existing authenticated APIs.
(function () {
  'use strict';
  const current = document.currentScript;
  const base = new URL('.', current && current.src || location.href);
  let library;
  function pdfLibrary() {
    if (window.PDFLib) return Promise.resolve(window.PDFLib);
    if (!library) library = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = new URL('vendor/pdf-lib-1.17.1.min.js', base).href;
      script.onload = () => window.PDFLib ? resolve(window.PDFLib) : reject(Error('PDF non disponibile.'));
      script.onerror = () => reject(Error('Impossibile caricare il generatore PDF. Riprova.'));
      document.head.appendChild(script);
    }).catch(error => { library = null; throw error; });
    return library;
  }
  function record(r) {
    const kind = r && (r.kind || r.consent_type);
    if (!['ortho', 'lac'].includes(kind)) throw Error('Tipo di informativa non valido.');
    const form = r.data && r.data.form;
    if (!form || typeof form !== 'object') throw Error('Dati del documento non disponibili. Contatta il negozio.');
    const signature = r.signature_data_url || '';
    if (signature && !/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(signature)) throw Error('Formato della firma non valido.');
    return {kind, form, signature, title:r.file_name || CONSENT_TEMPLATES[kind].label};
  }
  function html(r) {
    const v = record(r);
    return cloudConsentBuildFromData(v.kind, v.form, v.signature, v.title);
  }
  async function pdf(r) {
    const v = record(r);
    const {PDFDocument, StandardFonts, rgb} = await pdfLibrary();
    const doc = await PDFDocument.load(OPTYKER_CONSENT_PDF_DATA[v.kind]);
    // The LAC source also has a completely blank trailing page.
    while (doc.getPageCount() > CONSENT_TEMPLATES[v.kind].pages) doc.removePage(doc.getPageCount() - 1);
    const font = await doc.embedFont(StandardFonts.TimesRoman);
    const sign = v.signature ? await doc.embedPng(v.signature) : null;
    for (const [index, page] of doc.getPages().entries()) {
      const root = document.createElement('div');
      root.innerHTML = cloudConsentOverlay(v.kind, index + 1, v.form, v.signature);
      const {width, height} = page.getSize();
      for (const element of root.children) {
        const style = element.style;
        const x = parseFloat(style.left) / 100 * width;
        const top = parseFloat(style.top) / 100 * height;
        const w = parseFloat(style.width) / 100 * width;
        if (element.classList.contains('sig')) {
          if (!sign) continue;
          const h = parseFloat(style.height) / 100 * height;
          const scale = Math.min(w / sign.width, h / sign.height);
          const sw = sign.width * scale, sh = sign.height * scale;
          page.drawImage(sign, {x:x+(w-sw)/2, y:height-top-(h+sh)/2, width:sw, height:sh});
        } else {
          const text = element.textContent;
          let size = 11;
          const available = Math.max(1, w - 4.5);
          const natural = font.widthOfTextAtSize(text, size);
          if (natural > available) size *= available / natural;
          const h = 13.6;
          page.drawRectangle({x, y:height-top-h, width:w, height:h, color:rgb(1,1,1)});
          const tw = font.widthOfTextAtSize(text, size);
          page.drawText(text, {x:style.textAlign==='center'?x+(w-tw)/2:x+2.25, y:height-top-10.5, size, font, color:rgb(0,0,0)});
        }
      }
    }
    doc.setTitle(v.title);
    return new Blob([await doc.save()], {type:'application/pdf'});
  }
  window.OPTYKER_CONSENT_DOCUMENTS = Object.freeze({html, pdf, version:'20261010-original-pages1'});
})();

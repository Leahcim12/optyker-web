/* Optyker · Stampa da iPad e iPhone · 20261126-ios-print1
 * Sui computer le stampe di Optyker (indicazioni d'uso, prescrizione, esame visivo, udito, referti) passano da un
 * iframe nascosto: su iPad e iPhone Safari stampa quell'iframe come pagina bianca (limite di WebKit su iOS).
 * Qui, solo su iPad/iPhone, printHtmlDocument mette il documento nella pagina stessa, in un contenitore isolato
 * (Shadow DOM, con i suoi stili e le regole @page), e stampa la pagina con window.print(): in stampa si vede solo
 * il documento, sullo schermo non cambia nulla. Sui computer la stampa resta quella di sempre.
 * Inoltre «Stampa documento» delle indicazioni d'uso (pulizia lenti) apre il PDF pubblicato in /istruzioni-lac/
 * quando il vecchio programma Windows (ActiveX, immagini locali) non c'è. */
(function(){
  'use strict';
  if(window.__OPTYKER_IOS_PRINT_20261126__)return;
  window.__OPTYKER_IOS_PRINT_20261126__=true;
  var VERSION='20261126-ios-print1';
  var HOST_ID='optykerIosPrintHost',STYLE_ID='optykerIosPrintCss';
  var LAC_DOCS={
    'Pulizia Ortok.pdf':'/istruzioni-lac/pulizia-ortok.pdf',
    'Pulizia RGP.pdf':'/istruzioni-lac/pulizia-rgp.pdf',
    'Pulizia Sclerali.pdf':'/istruzioni-lac/pulizia-sclerali.pdf',
    'Pulizia Morbide.pdf':'/istruzioni-lac/pulizia-morbide.pdf',
    'Pulizia Perossido.pdf':'/istruzioni-lac/pulizia-perossido.pdf'
  };
  var state={cleanupArmed:false,printing:false};

  function isIOS(){
    if(window.OPTYKER_FORCE_IOS_PRINT===true)return true;
    var ua=String(navigator.userAgent||''),p=String(navigator.platform||'');
    if(/iPad|iPhone|iPod/.test(ua)||/iPad|iPhone|iPod/.test(p))return true;
    // iPadOS 13+ si presenta come Mac: lo distingue il touch.
    return /Mac/.test(p+' '+ua)&&Number(navigator.maxTouchPoints||0)>1
  }
  function hasActiveX(){try{return typeof window.ActiveXObject!=='undefined'||'ActiveXObject' in window}catch(e){return false}}

  /* ---------- CSS del documento, limitato al contenitore ---------- */
  function splitTop(text,sep){
    var out=[],depth=0,q=null,start=0;
    for(var i=0;i<text.length;i++){
      var c=text.charAt(i);
      if(q){if(c==='\\'){i++;continue}if(c===q)q=null;continue}
      if(c==='"'||c==="'"){q=c;continue}
      if(c==='('||c==='[')depth++;else if(c===')'||c===']')depth--;
      else if(c===sep&&depth===0){out.push(text.slice(start,i));start=i+1}
    }
    out.push(text.slice(start));return out
  }
  function scopeSelector(sel){
    return sel
      .replace(/(^|[\s>+~(,])html(?=$|[\s>+~.#:\[,)])/g,'$1.optykerPrintHtml')
      .replace(/(^|[\s>+~(,])body(?=$|[\s>+~.#:\[,)])/g,'$1.optykerPrintBody')
      .replace(/:root(?![\w-])/g,'.optykerPrintHtml')
  }
  function scopeRules(css,acc){
    var out='',i=0,n=css.length;
    while(i<n){
      var open=css.indexOf('{',i);if(open<0)break;
      var prelude=css.slice(i,open),depth=1,j=open+1,q=null;
      while(j<n&&depth>0){
        var c=css.charAt(j);
        if(q){if(c==='\\')j++;else if(c===q)q=null}
        else if(c==='"'||c==="'")q=c;else if(c==='{')depth++;else if(c==='}')depth--;
        j++
      }
      var body=css.slice(open+1,depth===0?j-1:j);i=j;
      var semi=prelude.lastIndexOf(';');if(semi>=0)prelude=prelude.slice(semi+1);
      prelude=prelude.trim();var low=prelude.toLowerCase();
      if(!prelude)continue;
      if(low.indexOf('@page')===0){acc.page+=prelude+'{'+body+'}';continue}
      if(low.indexOf('@font-face')===0){acc.fonts+=prelude+'{'+body+'}';continue}
      if(low.indexOf('@media')===0||low.indexOf('@supports')===0||low.indexOf('@layer')===0){out+=prelude+'{'+scopeRules(body,acc)+'}';continue}
      if(low.charAt(0)==='@'){out+=prelude+'{'+body+'}';continue}
      out+=splitTop(prelude,',').map(function(s){return scopeSelector(s.trim())}).join(',')+'{'+body+'}'
    }
    return out
  }

  /* ---------- Stampa nella pagina (iPad, iPhone) ---------- */
  function cleanup(){
    state.cleanupArmed=false;state.printing=false;
    var h=document.getElementById(HOST_ID);if(h&&h.parentNode)h.parentNode.removeChild(h);
    var s=document.getElementById(STYLE_ID);if(s&&s.parentNode)s.parentNode.removeChild(s)
  }
  function armCleanup(){
    // Dopo la stampa (o alla prima azione sulla pagina, se Safari non segnala la fine) il documento si toglie.
    if(state.cleanupArmed)return;state.cleanupArmed=true;
    var since=Date.now();
    function onAction(){if(Date.now()-since<800)return;off();cleanup()}
    function onAfter(){off();setTimeout(cleanup,0)}
    function off(){
      window.removeEventListener('afterprint',onAfter);
      ['pointerdown','touchstart','keydown'].forEach(function(t){document.removeEventListener(t,onAction,true)})
    }
    window.addEventListener('afterprint',onAfter);
    ['pointerdown','touchstart','keydown'].forEach(function(t){document.addEventListener(t,onAction,true)})
  }
  function waitImages(root,cb){
    var imgs=Array.prototype.slice.call(root.querySelectorAll('img')),pending=imgs.length,done=false;
    function finish(){if(done)return;done=true;cb()}
    if(!pending){finish();return}
    imgs.forEach(function(im){
      if(im.complete&&im.naturalWidth>0){if(--pending<=0)finish();return}
      function one(){im.removeEventListener('load',one);im.removeEventListener('error',one);if(--pending<=0)finish()}
      im.addEventListener('load',one);im.addEventListener('error',one)
    });
    setTimeout(finish,2500)
  }
  function printInPage(html,delayMs){
    cleanup();
    var doc=new DOMParser().parseFromString(String(html||''),'text/html');
    var acc={page:'',fonts:''},css='';
    Array.prototype.forEach.call(doc.querySelectorAll('style'),function(s){css+=s.textContent+'\n';if(s.parentNode)s.parentNode.removeChild(s)});
    Array.prototype.forEach.call(doc.querySelectorAll('script'),function(s){if(s.parentNode)s.parentNode.removeChild(s)});
    var links=Array.prototype.map.call(doc.querySelectorAll('link[rel~="stylesheet"][href]'),function(l){return '<link rel="stylesheet" href="'+String(l.getAttribute('href')).replace(/"/g,'&quot;')+'">'}).join('');
    var scoped=scopeRules(css.replace(/\/\*[\s\S]*?\*\//g,''),acc);
    var host=document.createElement('div');host.id=HOST_ID;host.setAttribute('aria-hidden','true');
    var root=host.attachShadow?host.attachShadow({mode:'open'}):host;
    var bodyClass=doc.body&&doc.body.className?' '+doc.body.className:'';
    root.innerHTML='<style>:host{all:initial;display:block;background:#fff;color:#000;visibility:visible}.optykerPrintHtml{display:block}.optykerPrintBody{display:block;margin:8px}</style>'+
      (scoped?'<style>'+scoped+'</style>':'')+links+
      '<div class="optykerPrintHtml"><div class="optykerPrintBody'+bodyClass.replace(/"/g,'')+'">'+(doc.body?doc.body.innerHTML:'')+'</div></div>';
    var style=document.createElement('style');style.id=STYLE_ID;
    style.textContent='@media screen{#'+HOST_ID+'{display:none!important}}'+
      '@media print{html,body{height:auto!important;min-height:0!important;max-height:none!important;overflow:visible!important;background:#fff!important;margin:0!important;padding:0!important;zoom:1!important;transform:none!important}'+
      'body>*:not(#'+HOST_ID+'){display:none!important}'+
      '#'+HOST_ID+'{display:block!important;position:static!important;visibility:visible!important;opacity:1!important;transform:none!important;filter:none!important;margin:0!important;padding:0!important;width:auto!important;height:auto!important;overflow:visible!important}}'+
      acc.fonts+acc.page;
    document.head.appendChild(style);
    document.body.appendChild(host);
    var delay=parseInt(delayMs,10);if(isNaN(delay)||delay<100)delay=350;
    waitImages(root,function(){
      setTimeout(function(){
        state.printing=true;
        try{window.focus()}catch(e){}
        try{window.print()}catch(err){cleanup();alert('Errore di stampa: '+err.message);return}
        armCleanup()
      },delay)
    })
  }
  function wrapPrint(){
    var base=window.printHtmlDocument;
    if(typeof base!=='function'||base.__optykerIosPrint)return;
    var wrapped=function(html,delayMs){
      if(!isIOS())return base.apply(this,arguments);
      try{printInPage(html,delayMs)}catch(e){if(window.console)console.error('Optyker stampa iPad',e);cleanup();return base.apply(this,arguments)}
    };
    wrapped.__optykerIosPrint=true;wrapped.__optykerBase=base;
    window.printHtmlDocument=wrapped
  }

  /* ---------- Documenti di pulizia LAC (Indicazioni d'uso › Documenti da stampare) ---------- */
  function lacDocUrl(name){var u=LAC_DOCS[name];if(!u)return '';try{return new URL(u,window.location.href).href}catch(e){return u}}
  function ensurePeroxideOption(){
    var sel=document.getElementById('iuDocumentSelect');if(!sel||sel.__optykerIosPrint)return;
    sel.__optykerIosPrint=true;
    if(!Array.prototype.some.call(sel.options,function(o){return o.value==='Pulizia Perossido.pdf'})){
      var o=document.createElement('option');o.value='Pulizia Perossido.pdf';o.textContent='Pulizia con perossido';sel.appendChild(o)
    }
  }
  function wrapLacDocuments(){
    var base=window.printIndicationsDocument;
    if(typeof base!=='function'||base.__optykerIosPrint)return;
    var wrapped=function(){
      if(hasActiveX())return base.apply(this,arguments);
      var sel=document.getElementById('iuDocumentSelect'),name=sel?sel.value:'';
      var url=lacDocUrl(name);
      if(!url)return base.apply(this,arguments);
      var w=window.open(url,'_blank');
      if(!w){alert('Il browser ha bloccato l’apertura del PDF. Consenti i popup per Optyker e riprova.');return}
      try{w.focus()}catch(e){}
    };
    wrapped.__optykerIosPrint=true;wrapped.__optykerBase=base;
    window.printIndicationsDocument=wrapped
  }

  function tick(){try{wrapPrint();wrapLacDocuments();ensurePeroxideOption()}catch(e){if(window.console)console.error('Optyker stampa iPad',e)}}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',tick);else tick();
  setInterval(tick,1500);
  window.OPTYKER_IOS_PRINT={version:VERSION,isIOS:isIOS,printInPage:printInPage,cleanup:cleanup,scopeCss:function(css){var a={page:'',fonts:''};return {css:scopeRules(css,a),page:a.page,fonts:a.fonts}}};
})();

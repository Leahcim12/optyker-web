/* Optyker · cliente collegato alle schede · 20261013-sheetclient1
 * In ogni scheda (Anomalie visive, Prescrizione, Esame visivo, Indicazioni d'uso, Udito, LAC) mostra il
 * cliente collegato e permette di sceglierlo o cambiarlo senza uscire dalla scheda: nome e cognome si
 * compilano e "Salva sul cliente" propone subito quel cliente. Nella scheda Occhiali aggiunge la ricerca
 * accanto al menu "Cliente collegato". Usa le funzioni esistenti (clientSelect, clientSaveSheetToClient). */
(function(){
  'use strict';
  if(window.__OPTYKER_SHEET_CLIENT_PICKER__)return;
  window.__OPTYKER_SHEET_CLIENT_PICKER__=true;
  var VERSION='20261013-sheetclient1';
  var MAX_RESULTS=60;
  var P={target:'',sig:'',loading:false};

  function E(id){return document.getElementById(id)}
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
  function txt(v){return String(v==null?'':v).replace(/\s+/g,' ').trim()}
  function clients(){var c=window.OPTYKER_CLOUD;return c&&Array.isArray(c.clients)?c.clients:[]}
  function find(id){if(!id)return null;try{if(typeof window.cloudFindClient==='function'){var x=window.cloudFindClient(id);if(x)return x}}catch(e){}var a=clients();for(var i=0;i<a.length;i++)if(String(a[i].id)===String(id))return a[i];return null}
  function current(){return find(window.clientCurrentId||'')}
  function fullName(m){return txt((m&&m.surname||'')+' '+(m&&m.name||''))||'Cliente'}
  function personName(m){return txt((m&&m.name||'')+' '+(m&&m.surname||''))}
  function initials(m){var a=txt(m&&m.name).charAt(0),b=txt(m&&m.surname).charAt(0);return (b+a).toUpperCase()||'?'}
  function birth(v){var s=txt(v),x=s.match(/^(\d{4})-(\d{2})-(\d{2})/);return x?x[3]+'/'+x[2]+'/'+x[1]:s}
  function meta(m){var a=[];if(!m)return '';if(m.birth)a.push('Nato/a '+birth(m.birth));if(m.phone||m.phoneHome)a.push(m.phone||m.phoneHome);if(m.email)a.push(m.email);var ref=m.reference_code||m.referenceCode||m.reference_no||m.referenceNo;if(ref)a.push('Rif. '+ref);if(m.city)a.push(m.city);return a.join(' · ')}
  function visible(el){if(!el)return false;try{var s=getComputedStyle(el);return s.display!=='none'&&s.visibility!=='hidden'&&el.getClientRects().length>0}catch(e){return false}}
  function matches(m,q){
    if(typeof window.optykerClientMatches==='function')return window.optykerClientMatches(m,q);
    q=txt(q).toLowerCase();if(!q)return true;
    var hay=[m.surname,m.name,m.phone,m.phoneHome,m.email,m.fiscal,m.city,m.reference_code,m.reference_no].join(' ').toLowerCase();
    return q.split(' ').every(function(t){return hay.indexOf(t)>=0})
  }
  function toast(msg){var t=E('oscToast');if(!t){t=document.createElement('div');t.id='oscToast';t.className='oscToast';t.setAttribute('role','status');document.body.appendChild(t)}t.textContent=msg;t.style.display='block';clearTimeout(t.__h);t.__h=setTimeout(function(){t.style.display='none'},3200)}

  /* ---------- Barra "Cliente della scheda" ---------- */
  function ensureBar(){
    var host=E('reportSectionTop');if(!host)return null;
    var bar=E('optykerSheetClientBar');
    if(!bar){
      bar=document.createElement('div');bar.id='optykerSheetClientBar';bar.className='oscBar';
      bar.addEventListener('click',function(ev){
        var b=ev.target&&ev.target.closest?ev.target.closest('[data-osc]'):null;if(!b)return;
        ev.preventDefault();
        if(b.getAttribute('data-osc')==='pick')openPicker('sheet');
        else if(b.getAttribute('data-osc')==='clear')unlink();
      });
    }
    var head=host.querySelector('.reportHead');
    if(bar.parentNode!==host){if(head&&head.parentNode===host)host.insertBefore(bar,head.nextSibling);else host.insertBefore(bar,host.firstChild)}
    return bar
  }
  var SHEETS=['analysisPanel','prescriptionPanel','visualExamPanel','indicationsPanel','hearingPanel','lacPanel'];
  function sheetOpen(){for(var i=0;i<SHEETS.length;i++)if(visible(E(SHEETS[i])))return true;return false}
  function renderBar(force){
    var host=E('reportSectionTop');if(!host)return;
    var bar=ensureBar();if(!bar)return;
    var show=sheetOpen();
    if(bar.__shown!==show){bar.__shown=show;bar.style.display=show?'':'none'}
    if(!show)return;
    var m=current(),sig=(m?m.id+'|'+fullName(m)+'|'+meta(m):'none')+'|'+clients().length;
    if(!force&&bar.__sig===sig)return;bar.__sig=sig;
    bar.classList.toggle('linked',!!m);
    bar.innerHTML=m?
      '<div class="oscInfo"><div class="oscDot" aria-hidden="true">'+esc(initials(m))+'</div><div class="oscText"><span class="oscLabel">Cliente della scheda</span><span class="oscName">'+esc(fullName(m))+'</span><span class="oscMeta">'+esc(meta(m)||'Nome e cognome compilati dalla scheda cliente')+'</span></div></div>'+
      '<div class="oscActions"><button type="button" class="oscBtn" data-osc="pick">Cambia cliente</button><button type="button" class="oscBtn" data-osc="clear">Scollega</button></div>'
      :
      '<div class="oscInfo"><div class="oscDot" aria-hidden="true">?</div><div class="oscText"><span class="oscLabel">Cliente della scheda</span><span class="oscName">Nessun cliente selezionato</span><span class="oscMeta">Selezionalo qui: nome e cognome si compilano e “Salva sul cliente” lo propone subito.</span></div></div>'+
      '<div class="oscActions"><button type="button" class="oscBtn primary" data-osc="pick">Seleziona cliente</button></div>'
  }
  function unlink(){
    var m=current();if(!m)return;
    if(!window.confirm('Scollegare la scheda da '+fullName(m)+'?\n\nI dati già inseriti nella scheda restano; nome e cognome vengono svuotati.'))return;
    try{if(typeof window.clientClearForm==='function')window.clientClearForm(false);else window.clientCurrentId=''}catch(e){window.clientCurrentId=''}
    ['clientName','clientSurname'].forEach(function(id){var x=E(id);if(x)x.value=''});
    try{if(typeof window.updatePrescriptionLinkedData==='function')window.updatePrescriptionLinkedData()}catch(e){}
    try{if(typeof window.updateVisualExamPatient==='function')window.updateVisualExamPatient()}catch(e){}
    renderBar(true);toast('Scheda scollegata dal cliente.')
  }

  /* ---------- Ricerca cliente ---------- */
  function ensureModal(){
    var m=E('optykerSheetClientPicker');if(m)return m;
    m=document.createElement('div');m.id='optykerSheetClientPicker';m.className='oscModal';
    m.innerHTML='<div class="oscCard" role="dialog" aria-modal="true" aria-labelledby="oscTitle"><div class="oscHead"><div><b id="oscTitle">Seleziona il cliente</b><small>Cerca per cognome, nome, telefono, email, codice fiscale o riferimento</small></div><button type="button" class="oscClose" data-osc-close aria-label="Chiudi">×</button></div>'+
      '<input id="oscSearch" class="oscSearch" type="search" placeholder="Cerca cliente…" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="Cerca cliente">'+
      '<div id="oscList" class="oscList" role="listbox"></div><div id="oscFoot" class="oscFoot"></div></div>';
    document.body.appendChild(m);
    m.addEventListener('click',function(ev){
      if(ev.target===m||(ev.target.closest&&ev.target.closest('[data-osc-close]'))){closePicker();return}
      var it=ev.target.closest?ev.target.closest('[data-osc-id]'):null;if(it)choose(it.getAttribute('data-osc-id'))
    });
    E('oscSearch').addEventListener('input',renderList);
    E('oscSearch').addEventListener('keydown',function(ev){if(ev.key==='Enter'){ev.preventDefault();var first=E('oscList').querySelector('[data-osc-id]');if(first)choose(first.getAttribute('data-osc-id'))}else if(ev.key==='Escape'){closePicker()}});
    document.addEventListener('keydown',function(ev){if(ev.key==='Escape'&&m.classList.contains('open'))closePicker()});
    return m
  }
  function openPicker(target){
    P.target=target;var m=ensureModal();
    var linked=target==='eyewear'?find(E('eyClient')&&E('eyClient').value):current();
    E('oscTitle').textContent=linked?'Cambia il cliente della scheda':'Seleziona il cliente';
    E('oscSearch').value='';m.classList.add('open');renderList();
    if(!clients().length&&!P.loading&&typeof window.cloudLoadClients==='function'){
      P.loading=true;renderList();
      Promise.resolve().then(function(){return window.cloudLoadClients()}).catch(function(){}).then(function(){P.loading=false;renderList()})
    }
    setTimeout(function(){try{E('oscSearch').focus()}catch(e){}},30)
  }
  function closePicker(){var m=E('optykerSheetClientPicker');if(m)m.classList.remove('open')}
  function renderList(){
    var list=E('oscList'),foot=E('oscFoot');if(!list)return;
    var q=E('oscSearch').value||'',all=clients();
    if(!all.length){list.innerHTML='<div class="oscEmpty">'+(P.loading?'Caricamento archivio clienti…':'Archivio clienti non disponibile. Riprova tra qualche secondo.')+'</div>';foot.textContent='';return}
    var sorted=typeof window.clientEnumerate==='function'?window.clientEnumerate():all.slice();
    var linkedId=P.target==='eyewear'?(E('eyClient')&&E('eyClient').value):(window.clientCurrentId||'');
    var hits=[],total=0;
    for(var i=0;i<sorted.length;i++){if(!matches(sorted[i],q))continue;total++;if(hits.length<MAX_RESULTS)hits.push(sorted[i])}
    if(!txt(q)&&linkedId){var cur=find(linkedId);if(cur){hits=hits.filter(function(x){return String(x.id)!==String(linkedId)});hits.unshift(cur)}}
    list.innerHTML=hits.length?hits.map(function(m){var isCur=String(m.id)===String(linkedId);return '<button type="button" class="oscItem'+(isCur?' current':'')+'" role="option" data-osc-id="'+esc(m.id)+'"><span><b>'+esc(fullName(m))+'</b><small>'+esc(meta(m)||'—')+'</small></span><em>'+(isCur?'Collegato':'Seleziona')+'</em></button>'}).join(''):'<div class="oscEmpty">Nessun cliente trovato. Se è un nuovo cliente, crealo da Clienti → Nuovo cliente.</div>';
    foot.textContent=txt(q)?(total+' clienti trovati'+(total>MAX_RESULTS?' · mostro i primi '+MAX_RESULTS+': affina la ricerca':'')):(all.length+' clienti in archivio · digita per cercare')
  }
  function choose(id){
    var m=find(id);if(!m){toast('Cliente non disponibile: riprova la ricerca.');return}
    closePicker();
    if(P.target==='eyewear'){setEyewearClient(m);return}
    try{
      if(typeof window.clientSelect==='function')window.clientSelect(m.id);
      else{window.clientFillForm(m);window.clientApplyToCurrentPatient()}
    }catch(e){if(window.console)console.error(e)}
    var lac=E('lacPatientName');if(lac&&visible(E('lacPanel'))){lac.value=personName(m);try{lac.dispatchEvent(new Event('input',{bubbles:true}));lac.dispatchEvent(new Event('change',{bubbles:true}))}catch(e){}}
    renderBar(true);setTimeout(function(){renderBar(true)},400);
    toast('Scheda collegata a '+fullName(m)+'.')
  }

  /* ---------- Scheda Occhiali: ricerca accanto al menu "Cliente collegato" ---------- */
  function ensureEyewearButton(){
    var sel=E('eyClient');if(!sel||E('oscEyewearSearch'))return;
    var b=document.createElement('button');b.type='button';b.id='oscEyewearSearch';b.className='oscBtn oscEyBtn';b.textContent='Cerca cliente';
    b.onclick=function(ev){ev.preventDefault();openPicker('eyewear')};
    sel.parentNode.insertBefore(b,sel.nextSibling)
  }
  function setEyewearClient(m){
    var sel=E('eyClient');if(!sel)return;
    var has=Array.prototype.some.call(sel.options,function(o){return String(o.value)===String(m.id)});
    if(!has){var o=document.createElement('option');o.value=m.id;o.textContent=fullName(m);sel.appendChild(o)}
    sel.value=m.id;
    try{sel.dispatchEvent(new Event('input',{bubbles:true}));sel.dispatchEvent(new Event('change',{bubbles:true}))}catch(e){}
    toast('Scheda occhiali collegata a '+fullName(m)+'.')
  }

  /* ---------- "Salva sul cliente": propone il cliente già collegato ---------- */
  function hookSave(){
    var old=window.clientOpenSavePicker;if(typeof old!=='function'||old.__oscHook)return;
    var w=function(type){
      var r=old.apply(this,arguments);
      try{
        var picker=E('clientSavePicker'),m=current();
        if(m&&picker&&visible(picker)&&window.clientPendingSheetType&&typeof window.clientSaveSheetToClient==='function'){
          var label=typeof window.clientSheetLabel==='function'?window.clientSheetLabel(window.clientPendingSheetType):'scheda';
          if(window.confirm('Salvare '+label+' sul cliente '+fullName(m)+'?\n\nPer sceglierne un altro premi Annulla e cercalo nell’elenco.'))window.clientSaveSheetToClient(m.id)
        }
      }catch(e){if(window.console)console.error(e)}
      return r
    };
    w.__oscHook=true;w.__original=old;window.clientOpenSavePicker=w
  }

  function tick(){
    try{hookSave();if(E('reportSectionTop'))renderBar(false);ensureEyewearButton()}catch(e){if(window.console)console.error('Optyker cliente scheda',e)}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',tick);else tick();
  setInterval(tick,700);
  window.OPTYKER_SHEET_CLIENT_PICKER={version:VERSION,open:openPicker,refresh:function(){renderBar(true)}};
})();

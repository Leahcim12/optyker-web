(function(){
  if(window.__optykerQuotesPatch)return;window.__optykerQuotesPatch=true;
  var API='https://whgziwaegjzqsgcntesr.supabase.co/functions/v1/optyker-quotes-api';
  var state={clientId:'',rows:[],loading:false,lastLoad:0,lacSavedKey:''};
  function E(id){return document.getElementById(id)}
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(ch){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]})}
  function op(){return String(window.OPTYKER_ACTIVE_USER||(window.OPTYKER_CLOUD&&OPTYKER_CLOUD.username)||'').trim()}
  function call(action,payload){
    var body=payload||{};body.action=action;body.operator=op();
    return fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}).then(function(r){
      return r.json().catch(function(){return {}}).then(function(x){if(!r.ok||x&&x.ok===false)throw new Error((x&&x.error)||('HTTP '+r.status));return x});
    });
  }
  function euro(v){var n=Number(v);if(!isFinite(n)||!n)return '';try{return new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR'}).format(n)}catch(z){return n.toFixed(2)+' €'}}
  function date(v){if(!v)return '';try{return new Date(v).toLocaleDateString('it-IT',{day:'2-digit',month:'2-digit',year:'numeric'})}catch(z){return String(v)}}
  function kind(q){var s=String(q&&q.sheet_type||''),d=q&&q.data||{};return s==='eyewear_quote'||String(d.sheetType||'').indexOf('eyewear_')===0?'Occhiali':'LAC'}
  function amount(q){var d=q&&q.data||{};if(kind(q)==='Occhiali')return Number(d.pricing&&d.pricing.total||0);var st=d.lacState||{};return Number(st.odCost||0)+Number(st.osCost||0)}
  function description(q){
    var d=q&&q.data||{};
    if(kind(q)==='Occhiali'){
      var f=d.frame||{},l=d.lens||{},a=[];
      if(f.brand||f.model)a.push('Montatura: '+[f.brand,f.model,f.color].filter(Boolean).join(' · '));
      if(l.lens_name||l.lens_type)a.push('Lenti: '+[l.brand,l.lens_name,l.lens_type].filter(Boolean).join(' · '));
      if(Array.isArray(l.treatments)&&l.treatments.length)a.push('Trattamenti: '+l.treatments.join(', '));
      return a.join('\n')||'Preventivo occhiali';
    }
    var st=d.lacState||{},a=[];
    if(st.brand)a.push('Marca: '+st.brand);
    if(st.odProductName)a.push('OD: '+st.odProductName);
    if(st.osProductName)a.push('OS: '+st.osProductName);
    return a.join('\n')||'Preventivo LAC';
  }
  function ref(q){return String(q&&q.reference_no||q&&q.reference_code||q&&q.data&&q.data.documentReference||'').trim()}
  function ensureSection(){
    var cid=String(window.clientCurrentId||''),name=E('clientWorkspaceName');
    if(!cid||!name){var old=E('optykerClientQuotesSection');if(old)old.remove();state.clientId='';return null}
    var p=E('optykerClientQuotesSection');
    if(!p){
      p=document.createElement('section');p.id='optykerClientQuotesSection';p.className='optykerClientQuotesSection';
      var anchor=name.parentNode||name;
      if(anchor.parentNode)anchor.parentNode.insertBefore(p,anchor.nextSibling);else name.insertAdjacentElement('afterend',p);
    }
    return p;
  }
  function render(){
    var p=ensureSection();if(!p)return;
    var rows=state.rows||[];
    var cards=rows.map(function(q){
      var a=euro(amount(q));
      return '<div class="optykerQuoteCard"><div class="optykerQuoteCardMain"><span class="optykerQuoteBadge">PREVENTIVO '+esc(kind(q).toUpperCase())+'</span><div class="optykerQuoteTitle">'+esc(ref(q)||q.title||'Preventivo')+'</div><div class="optykerQuoteMeta">'+esc(date(q.created_at))+(q.operator?' · '+esc(q.operator):'')+'</div>'+(a?'<div class="optykerQuoteAmount">'+esc(a)+'</div>':'')+'</div><button class="optykerQuoteOpen" type="button" data-quote-open="'+esc(q.id)+'">Visualizza</button></div>';
    }).join('');
    p.innerHTML='<div class="optykerQuotesHead"><h3>Preventivi</h3><span class="optykerQuotesCount">'+rows.length+'</span></div>'+(state.loading&&!rows.length?'<div class="optykerQuotesEmpty">Caricamento preventivi…</div>':(cards?'<div class="optykerQuoteList">'+cards+'</div>':'<div class="optykerQuotesEmpty">Nessun preventivo aperto per questo cliente.</div>'));
    Array.prototype.forEach.call(p.querySelectorAll('[data-quote-open]'),function(b){b.onclick=function(){window.openOptykerQuote(this.getAttribute('data-quote-open'))}});
  }
  function load(force){
    var cid=String(window.clientCurrentId||'');if(!cid){ensureSection();return Promise.resolve([])}
    if(state.loading)return Promise.resolve(state.rows);
    if(!force&&cid===state.clientId&&Date.now()-state.lastLoad<15000){render();return Promise.resolve(state.rows)}
    state.clientId=cid;state.loading=true;render();
    return call('list',{client_id:cid}).then(function(x){if(cid===String(window.clientCurrentId||''))state.rows=Array.isArray(x.data)?x.data:[];return state.rows}).catch(function(){return state.rows}).finally(function(){state.loading=false;state.lastLoad=Date.now();render()});
  }
  window.refreshClientQuotes=function(){return load(true)};
  function cloudReplace(row,remove){
    var cid=String(row&&row.client_id||state.clientId||'');if(!cid||!window.OPTYKER_CLOUD||!OPTYKER_CLOUD.sheets)return;
    var arr=Array.isArray(OPTYKER_CLOUD.sheets[cid])?OPTYKER_CLOUD.sheets[cid]:[];
    var i=arr.findIndex(function(x){return String(x&&x.id||'')===String(row&&row.id||'')});
    if(remove){if(i>=0)arr.splice(i,1)}
    else if(i>=0)arr[i]=row;else arr.unshift(row);
    OPTYKER_CLOUD.sheets[cid]=arr;
  }
  function detail(label,value){if(value==null||value==='')return '';return '<div class="optykerQuoteDetail"><b>'+esc(label)+'</b><span>'+esc(value)+'</span></div>'}
  window.openOptykerQuote=function(id){
    var q=(state.rows||[]).find(function(x){return String(x.id)===String(id)});if(!q)return;
    if(E('optykerQuoteModal'))E('optykerQuoteModal').remove();
    var d=q.data||{},a=euro(amount(q)),extra='';
    if(kind(q)==='Occhiali'){
      extra+=detail('Montatura',[d.frame&&d.frame.brand,d.frame&&d.frame.model,d.frame&&d.frame.color].filter(Boolean).join(' · '));
      extra+=detail('Lenti',[d.lens&&d.lens.brand,d.lens&&d.lens.lens_name,d.lens&&d.lens.lens_type].filter(Boolean).join(' · '));
      extra+=detail('Trattamenti',Array.isArray(d.lens&&d.lens.treatments)?d.lens.treatments.join(', '):'');
      extra+=detail('Note',d.notes||'');
    }else{
      var st=d.lacState||{};
      extra+=detail('Marca',st.brand||'');
      extra+=detail('Lente OD',st.odProductName||'');
      extra+=detail('Lente OS',st.osProductName||'');
    }
    var m=document.createElement('div');m.id='optykerQuoteModal';m.className='optykerQuoteModal';
    m.onclick=function(ev){if(ev.target===m)m.remove()};
    m.innerHTML='<div class="optykerQuoteModalCard"><div class="optykerQuoteModalTop"><div><div class="optykerQuoteRef">PREVENTIVO '+esc(kind(q).toUpperCase())+' · '+esc(ref(q)||'—')+'</div><h2>Preventivo cliente</h2></div><button class="optykerQuoteClose" type="button" data-q-close>×</button></div><div class="optykerQuoteDetails">'+detail('Data',date(q.created_at))+detail('Riepilogo',description(q))+(a?detail('Totale',a):'')+extra+'</div><div class="optykerQuoteActions"><button class="optykerQuoteConvert" type="button" data-q-convert="'+esc(q.id)+'">Trasforma in vendita</button><button class="optykerQuoteDelete" type="button" data-q-delete="'+esc(q.id)+'">Elimina preventivo</button><button class="optykerQuoteCancel" type="button" data-q-close>Chiudi</button></div></div>';
    document.body.appendChild(m);
    Array.prototype.forEach.call(m.querySelectorAll('[data-q-close]'),function(b){b.onclick=function(){m.remove()}});
    var cv=m.querySelector('[data-q-convert]');if(cv)cv.onclick=function(){window.convertOptykerQuote(this.getAttribute('data-q-convert'))};
    var dl=m.querySelector('[data-q-delete]');if(dl)dl.onclick=function(){window.deleteOptykerQuote(this.getAttribute('data-q-delete'))};
  };
  window.convertOptykerQuote=function(id){
    if(!confirm('Trasformare questo preventivo in vendita?'))return;
    var btn=E('optykerQuoteModal')&&E('optykerQuoteModal').querySelector('.optykerQuoteConvert');if(btn){btn.disabled=true;btn.textContent='Conversione…'}
    call('convert',{id:id}).then(function(x){
      if(x.data)cloudReplace(x.data,false);
      if(E('optykerQuoteModal'))E('optykerQuoteModal').remove();
      state.lastLoad=0;return load(true);
    }).then(function(){
      var cid=window.clientCurrentId;if(cid&&typeof window.clientSelect==='function')setTimeout(function(){try{window.clientSelect(cid)}catch(z){}},80);
      alert('Preventivo trasformato in vendita.');
    }).catch(function(err){alert('Impossibile trasformare il preventivo: '+err.message);if(btn){btn.disabled=false;btn.textContent='Trasforma in vendita'}});
  };
  window.deleteOptykerQuote=function(id){
    if(!confirm('Eliminare definitivamente questo preventivo?'))return;
    var q=(state.rows||[]).find(function(x){return String(x.id)===String(id)});
    call('delete',{id:id}).then(function(){
      if(q)cloudReplace(q,true);
      if(E('optykerQuoteModal'))E('optykerQuoteModal').remove();
      state.rows=(state.rows||[]).filter(function(x){return String(x.id)!==String(id)});render();
    }).catch(function(err){alert('Impossibile eliminare il preventivo: '+err.message)});
  };
  function currentLacDoc(){var d=E('lacSelectedDocType');return String(d&&d.textContent||'').trim()}
  function currentLacRef(){var r=E('lacReference');return String(r&&r.value||'').trim()}
  function saveLacQuote(){
    if(currentLacDoc()!=='Preventivo')return Promise.resolve(null);
    var cid=String(window.clientCurrentId||''),refNo=currentLacRef();
    if(!cid){alert('Seleziona prima il cliente su cui salvare il preventivo.');return Promise.reject(new Error('Cliente mancante'))}
    if(!refNo)return Promise.reject(new Error('Numero preventivo non ancora disponibile'));
    var snap=typeof window.lacCaptureClientSheet==='function'?window.lacCaptureClientSheet():{};
    snap.documentReference=refNo;if(snap.lacState)snap.lacState.document='Preventivo';
    var b=E('optykerLacQuoteSave');if(b){b.disabled=true;b.textContent='Salvataggio…'}
    return call('save_lac',{client_id:cid,reference_no:refNo,quote_data:snap}).then(function(x){
      state.lacSavedKey=cid+'|'+refNo;if(x.data)cloudReplace(x.data,false);
      if(b){b.disabled=true;b.textContent='Preventivo salvato'}
      state.lastLoad=0;if(String(window.clientCurrentId||'')===cid)load(true);
      return x.data||null;
    }).catch(function(err){if(b){b.disabled=false;b.textContent='Salva preventivo'}throw err});
  }
  window.saveCurrentLacQuote=function(){return saveLacQuote().catch(function(err){if(err.message!=='Cliente mancante')alert('Impossibile salvare il preventivo: '+err.message)})};
  function configureLacQuote(attempt){
    if(currentLacDoc()!=='Preventivo')return;
    var actions=document.querySelector('.lacSummaryModalActions');
    if(!actions){if((attempt||0)<25)setTimeout(function(){configureLacQuote((attempt||0)+1)},120);return}
    var b=E('optykerLacQuoteSave');
    if(!b){b=document.createElement('button');b.id='optykerLacQuoteSave';b.type='button';b.className='optykerLacQuoteSave';b.textContent='Salva preventivo';b.onclick=function(){window.saveCurrentLacQuote()};actions.appendChild(b)}
    var cid=String(window.clientCurrentId||''),r=currentLacRef(),key=cid+'|'+r;
    if(cid&&r&&state.lacSavedKey!==key)saveLacQuote().catch(function(){});
  }
  function hookLac(){
    if(typeof window.lacOpenSummary==='function'&&!window.lacOpenSummary.__quoteHook){
      var old=window.lacOpenSummary;
      var w=function(){var r=old.apply(this,arguments);setTimeout(function(){configureLacQuote(0)},30);return r};
      w.__quoteHook=true;w.__labHook=true;window.lacOpenSummary=w;
    }
  }
  function hookClient(){
    if(typeof window.clientSelect==='function'&&!window.clientSelect.__quoteHook){
      var old=window.clientSelect;
      var w=function(){var r=old.apply(this,arguments);setTimeout(function(){load(true)},80);return r};
      w.__quoteHook=true;window.clientSelect=w;
    }
  }
  function install(){hookLac();hookClient();var cid=String(window.clientCurrentId||'');if(cid){ensureSection();if(cid!==state.clientId)load(true)}else ensureSection()}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
  setInterval(install,700);
})();
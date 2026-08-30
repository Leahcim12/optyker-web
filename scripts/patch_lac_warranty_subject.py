from pathlib import Path

p=Path("_site/index.html")
s=p.read_text(encoding="utf-8")
MARK="OPTYKER_LAC_WARRANTY_SUBJECT_V1"
if MARK in s:
    raise SystemExit(0)

css=r'''
<style id="optykerLacWarrantySubjectCss">
/* OPTYKER_LAC_WARRANTY_SUBJECT_V1 */
#lacSubjectBanner{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0 0 14px;padding:11px 13px;border:1px solid #d9e6f0;border-radius:11px;background:#f7fbfe}
.lacSubjectLeft{min-width:0}.lacSubjectKicker{font-size:8px;font-weight:900;letter-spacing:.09em;color:#1769aa;text-transform:uppercase}.lacSubjectName{font-size:13px;font-weight:900;color:#1d3850;margin-top:2px}.lacSubjectMeta{font-size:9px;color:#748797;margin-top:2px}
.lacSubjectLock{flex:0 0 auto;padding:5px 8px;border-radius:999px;background:#eaf4fb;color:#1769aa;font-size:8px;font-weight:900}
.clientLacWarrantyPanel{margin-top:14px;border:1px solid #dfe7ef;border-radius:14px;background:#fff;overflow:hidden}
.clientLacWarrantyHead{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:15px 16px;border-bottom:1px solid #e8eef3;background:linear-gradient(135deg,#fbfdff,#f5f9fc)}
.clientLacWarrantyKicker{font-size:8px;font-weight:900;letter-spacing:.08em;color:#1769aa;text-transform:uppercase}.clientLacWarrantyTitle{font-size:16px;font-weight:900;color:#1e394f;margin-top:2px}.clientLacWarrantySub{font-size:9px;color:#718493;margin-top:3px;max-width:680px}
.clientLacWarrantyBody{display:grid;gap:14px;padding:14px;background:#f8fafc}
.clientLacSectionTitle{font-size:10px;font-weight:900;color:#2c4d66;text-transform:uppercase;letter-spacing:.05em;margin-bottom:7px}
.clientLacWarrantyList,.clientLacSheetsList{display:grid;gap:9px}
.clientLacWarrantyCard,.clientLacSheetCard{border:1px solid #dce5ec;border-radius:11px;background:#fff;padding:11px 12px}
.clientLacWarrantyTop{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.clientLacWarrantyName{font-size:12px;font-weight:900;color:#203c53}.clientLacWarrantyMeta{font-size:8px;color:#758897;margin-top:3px;line-height:1.45}.clientLacWarrantyPrice{font-size:11px;font-weight:900;color:#1769aa;white-space:nowrap}
.clientLacWarrantyControls{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:9px;padding-top:9px;border-top:1px solid #edf1f4}
.clientLacWarrantyControls select{min-width:250px;flex:1}.clientLacWarrantyControls button{white-space:nowrap}
.clientLacWarrantyStatus{display:inline-flex;align-items:center;padding:4px 7px;border-radius:999px;font-size:8px;font-weight:900;background:#f0f3f6;color:#5f7180}.clientLacWarrantyStatus.active{background:#e7f7ee;color:#24754a}.clientLacWarrantyStatus.used{background:#fff4e8;color:#9b5b14}
.clientLacWarrantySaved{font-size:8px;color:#5f7484;margin-top:6px}
.clientLacEmpty{padding:14px;border:1px dashed #cbd7e0;border-radius:10px;background:#fff;text-align:center;font-size:9px;color:#748696}
.clientLacSheetTop{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}.clientLacSheetRef{font-size:11px;font-weight:900;color:#1769aa}.clientLacSheetTitle{font-size:11px;font-weight:850;color:#243f55;margin-top:2px}.clientLacSheetMeta{font-size:8px;color:#758797;margin-top:3px}.clientLacSheetProduct{font-size:9px;color:#3f5c71;margin-top:7px}
.clientLacSheetActions{margin-top:8px}
@media(max-width:700px){.lacSubjectBanner,.clientLacWarrantyHead,.clientLacWarrantyTop,.clientLacSheetTop{flex-direction:column;align-items:stretch}.clientLacWarrantyControls{align-items:stretch}.clientLacWarrantyControls select{min-width:0;width:100%}}
</style>
'''

js=r'''
<script id="optykerLacWarrantySubjectJs">
(function(){/* OPTYKER_LAC_WARRANTY_SUBJECT_V1 */
  if(window.__optykerLacWarrantySubjectV1)return;window.__optykerLacWarrantySubjectV1=true;
  var API='https://whgziwaegjzqsgcntesr.supabase.co/functions/v1/optyker-warranty-api';
  var W={clientId:'',data:null,loading:false};

  function E(id){return document.getElementById(id)}
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
  function operator(){return String(window.OPTYKER_ACTIVE_USER||(window.OPTYKER_CLOUD&&OPTYKER_CLOUD.username)||'').trim()}
  function dt(v){if(!v)return '—';try{return new Date(v).toLocaleDateString('it-IT',{day:'2-digit',month:'2-digit',year:'numeric'})}catch(z){return String(v)}}
  function eur(v,c){var n=Number(v)||0;try{return new Intl.NumberFormat('it-IT',{style:'currency',currency:c||'EUR'}).format(n)}catch(z){return '€ '+n.toFixed(2).replace('.',',')}}
  function api(action,payload){
    var b=payload||{};b.action=action;b.operator=operator();
    return fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)}).then(function(r){return r.json().catch(function(){return {}}).then(function(x){if(!r.ok||!x||x.ok===false)throw new Error((x&&x.error)||('HTTP '+r.status));return x})});
  }
  function currentClient(){
    var id=window.clientCurrentId||'';
    if(!id)return null;
    if(window.OPTYKER_CLOUD&&Array.isArray(OPTYKER_CLOUD.clients)){
      for(var i=0;i<OPTYKER_CLOUD.clients.length;i++)if(String(OPTYKER_CLOUD.clients[i].id)===String(id))return OPTYKER_CLOUD.clients[i];
    }
    return null;
  }
  function clientLabel(c){return c?String(((c.surname||'')+' '+(c.name||'')).trim()||'Cliente'):''}
  function clientRef(c){return c?String(c.reference_no||c.reference_code||''):''}

  function ensureSubjectBanner(){
    var panel=E('lacPanel');if(!panel)return;
    var banner=E('lacSubjectBanner');
    if(!banner){
      banner=document.createElement('div');banner.id='lacSubjectBanner';
      var tabs=panel.querySelector('.lacTabs'),head=panel.querySelector('.lacHead');
      if(tabs&&tabs.parentNode)tabs.parentNode.insertBefore(banner,tabs);else if(head&&head.parentNode)head.parentNode.insertBefore(banner,head.nextSibling);else panel.insertBefore(banner,panel.firstChild);
    }
    var c=currentClient(),id=window.clientCurrentId||'';
    if(!id||!c){
      banner.innerHTML='<div class="lacSubjectLeft"><div class="lacSubjectKicker">Soggetto LAC</div><div class="lacSubjectName">Nessun cliente selezionato</div><div class="lacSubjectMeta">Per creare o modificare una scheda LAC devi prima aprire la scheda di un cliente.</div></div><span class="lacSubjectLock">SELEZIONE OBBLIGATORIA</span>';
      return;
    }
    banner.innerHTML='<div class="lacSubjectLeft"><div class="lacSubjectKicker">Soggetto LAC</div><div class="lacSubjectName">'+esc(clientLabel(c))+'</div><div class="lacSubjectMeta">'+(clientRef(c)?'Rif. '+esc(clientRef(c))+' · ':'')+'Tutte le schede LAC create da qui saranno associate a questo cliente.</div></div><span class="lacSubjectLock">CLIENTE SELEZIONATO</span>';
  }

  function requireClientForLac(){
    var id=window.clientCurrentId||'';
    if(id)return true;
    alert('Prima seleziona un cliente. Non è possibile creare una scheda LAC senza associarla a un soggetto.');
    try{if(typeof window.showModule==='function')window.showModule('clients')}catch(z){}
    return false;
  }

  function hookLacAccess(){
    if(typeof window.openLacDevice==='function'&&!window.openLacDevice.__subjectRequired){
      var old=window.openLacDevice;
      var wrapped=function(){if(!requireClientForLac())return false;var r=old.apply(this,arguments);setTimeout(ensureSubjectBanner,0);return r};
      wrapped.__subjectRequired=true;wrapped.__original=old;window.openLacDevice=wrapped;
    }
    if(typeof window.lacProductCreate==='function'&&!window.lacProductCreate.__subjectRequired){
      var oldP=window.lacProductCreate;
      var wp=function(){if(!requireClientForLac())return false;return oldP.apply(this,arguments)};
      wp.__subjectRequired=true;wp.__original=oldP;window.lacProductCreate=wp;
    }
    if(typeof window.lacOpenSummary==='function'&&!window.lacOpenSummary.__subjectRequired){
      var oldS=window.lacOpenSummary;
      var ws=function(){if(!requireClientForLac())return false;return oldS.apply(this,arguments)};
      ws.__subjectRequired=true;ws.__original=oldS;window.lacOpenSummary=ws;
    }
  }

  function ensureClientPanel(){
    var list=E('clientSpecialistList');if(!list)return null;
    var panel=E('clientLacWarrantyPanel');
    if(panel)return panel;
    panel=document.createElement('section');panel.id='clientLacWarrantyPanel';panel.className='clientLacWarrantyPanel';
    panel.innerHTML='<div class="clientLacWarrantyHead"><div><div class="clientLacWarrantyKicker">LAC DEL CLIENTE</div><div class="clientLacWarrantyTitle">Lenti a contatto e garanzie</div><div class="clientLacWarrantySub">Ogni lente acquistata ha una garanzia individuale. Qui puoi attivarla e preparare la selezione del riordino. Sotto trovi tutte le schede LAC associate al cliente.</div></div><button class="secondary" type="button" id="clientLacWarrantyReload">Aggiorna</button></div><div class="clientLacWarrantyBody"><div><div class="clientLacSectionTitle">Articoli acquistati e garanzia</div><div id="clientLacWarrantyList" class="clientLacWarrantyList"><div class="clientLacEmpty">Caricamento lenti…</div></div></div><div><div class="clientLacSectionTitle">Tutte le schede LAC del cliente</div><div id="clientLacSheetsList" class="clientLacSheetsList"><div class="clientLacEmpty">Caricamento schede…</div></div></div></div>';
    if(list.parentNode)list.parentNode.insertBefore(panel,list.nextSibling);else list.appendChild(panel);
    var reload=E('clientLacWarrantyReload');if(reload)reload.onclick=function(){refresh(true)};
    return panel;
  }

  function warrantyLabel(w){
    var s=w&&w.status||'inactive';
    if(s==='active')return 'Garanzia attiva';
    if(s==='pending_reorder')return 'Riordino in garanzia';
    if(s==='used')return 'Garanzia utilizzata';
    if(s==='expired')return 'Garanzia scaduta';
    return 'Garanzia non attiva';
  }
  function productSummary(sheet){
    var d=sheet&&sheet.data||{},st=d.lacState||{},a=[];
    if(st.odProductName)a.push('OD · '+st.odProductName);
    if(st.osProductName)a.push('OS · '+st.osProductName);
    return a.join(' | ')||'Scheda tecnica LAC';
  }
  function render(){
    ensureClientPanel();
    var wl=E('clientLacWarrantyList'),sl=E('clientLacSheetsList');if(!wl||!sl)return;
    var data=W.data||{},lenses=Array.isArray(data.lenses)?data.lenses:[],sheets=Array.isArray(data.lac_sheets)?data.lac_sheets:[];
    if(!lenses.length)wl.innerHTML='<div class="clientLacEmpty">Nessuna lente acquistata registrata per questo cliente.</div>';
    else wl.innerHTML=lenses.map(function(l){
      var w=l.warranty||{status:'inactive'},active=w.status==='active'||w.status==='pending_reorder',saved=w.selected_reorder_option||{},opts=Array.isArray(l.reorder_options)?l.reorder_options:[];
      var options='<option value="">Seleziona cosa riordinare…</option>'+opts.map(function(o){return '<option value="'+esc(o.code)+'"'+(saved.code===o.code?' selected':'')+'>'+esc(o.label)+'</option>'}).join('');
      var statusClass=w.status==='active'||w.status==='pending_reorder'?' active':(w.status==='used'?' used':'');
      return '<div class="clientLacWarrantyCard"><div class="clientLacWarrantyTop"><div><div class="clientLacWarrantyName">'+esc((l.brand||'')+' · '+(l.product_name||'Lente a contatto'))+'</div><div class="clientLacWarrantyMeta">'+esc(l.eye||'')+' · acquistata '+esc(dt(l.purchased_at))+(l.in_store_order_ref?' · rif. '+esc(l.in_store_order_ref):'')+'</div></div><div class="clientLacWarrantyPrice">'+esc(eur(l.unit_price,l.currency))+'</div></div><div class="clientLacWarrantyControls"><span class="clientLacWarrantyStatus'+statusClass+'">'+esc(warrantyLabel(w))+'</span>'+(active?'<select id="warrantyReorder_'+esc(l.id)+'">'+options+'</select><button class="primary" type="button" onclick="optykerWarrantySaveSelection(\\''+esc(l.id)+'\\')">Salva selezione riordino</button>':'<button class="primary" type="button" onclick="optykerWarrantyActivate(\\''+esc(l.id)+'\\')">Attiva garanzia</button>')+'</div>'+(saved.label?'<div class="clientLacWarrantySaved">Selezione salvata: <b>'+esc(saved.label)+'</b>. Le regole definitive di garanzia verranno applicate quando saranno configurate.</div>':'')+'</div>';
    }).join('');

    if(!sheets.length)sl.innerHTML='<div class="clientLacEmpty">Nessuna scheda LAC salvata per questo cliente.</div>';
    else sl.innerHTML=sheets.map(function(row){
      var ref=row.reference_no||row.reference_code||'',d=row.data||{},date=d.examDate||d.savedAt||row.created_at,title=row.title||d.sheetLabel||'Scheda LAC';
      return '<div class="clientLacSheetCard"><div class="clientLacSheetTop"><div><div class="clientLacSheetRef">'+esc(ref||'LAC')+'</div><div class="clientLacSheetTitle">'+esc(title)+'</div><div class="clientLacSheetMeta">'+esc(dt(date))+(row.operator?' · '+esc(row.operator):'')+(row.document_type?' · '+esc(row.document_type):'')+'</div></div><span class="clientLacWarrantyStatus active">Associata al cliente</span></div><div class="clientLacSheetProduct">'+esc(productSummary(row))+'</div><div class="clientLacSheetActions"><button class="secondary" type="button" onclick="optykerOpenClientLacSheet(\\''+esc(row.id)+'\\')">Apri scheda LAC</button></div></div>';
    }).join('');
  }

  function refresh(force){
    ensureClientPanel();
    var id=window.clientCurrentId||'';
    if(!id){W.clientId='';W.data=null;render();return Promise.resolve()}
    if(W.loading)return Promise.resolve();
    if(!force&&W.clientId===id&&W.data){render();return Promise.resolve(W.data)}
    W.loading=true;W.clientId=id;
    var wl=E('clientLacWarrantyList'),sl=E('clientLacSheetsList');
    if(wl)wl.innerHTML='<div class="clientLacEmpty">Caricamento lenti e garanzie…</div>';
    if(sl)sl.innerHTML='<div class="clientLacEmpty">Caricamento schede LAC…</div>';
    return api('list',{client_id:id}).then(function(x){
      if(id!==(window.clientCurrentId||''))return;
      W.data=x;render();
    }).catch(function(err){
      if(wl)wl.innerHTML='<div class="clientLacEmpty">Errore garanzie: '+esc(err.message)+'</div>';
      if(sl)sl.innerHTML='<div class="clientLacEmpty">Errore schede LAC: '+esc(err.message)+'</div>';
    }).finally(function(){W.loading=false});
  }

  window.optykerWarrantyActivate=function(lensId){
    var id=window.clientCurrentId||'';if(!id)return;
    api('activate',{client_id:id,specialist_lens_id:lensId}).then(function(){return refresh(true)}).catch(function(err){alert('Impossibile attivare la garanzia: '+err.message)});
  };
  window.optykerWarrantySaveSelection=function(lensId){
    var id=window.clientCurrentId||'',sel=E('warrantyReorder_'+lensId);if(!id||!sel)return;
    if(!sel.value){alert('Seleziona cosa riordinare.');return}
    api('save_reorder_selection',{client_id:id,specialist_lens_id:lensId,option_code:sel.value}).then(function(){
      alert('Selezione di riordino salvata. Applicheremo le regole definitive quando saranno configurate.');
      return refresh(true);
    }).catch(function(err){alert('Impossibile salvare la selezione: '+err.message)});
  };
  window.optykerOpenClientLacSheet=function(sheetId){
    if(typeof window.clientOpenVisitInEditor==='function')window.clientOpenVisitInEditor(sheetId);
  };

  function hookClient(){
    if(typeof window.clientSelect==='function'&&!window.clientSelect.__warrantyHook){
      var old=window.clientSelect;
      var w=function(){var r=old.apply(this,arguments);W.clientId='';W.data=null;setTimeout(function(){ensureSubjectBanner();refresh(true)},80);return r};
      w.__warrantyHook=true;w.__original=old;window.clientSelect=w;
    }
    if(typeof window.clientRefreshCommerce==='function'&&!window.clientRefreshCommerce.__warrantyHook){
      var oldR=window.clientRefreshCommerce;
      var wr=function(){var r=oldR.apply(this,arguments);Promise.resolve(r).finally(function(){setTimeout(function(){ensureClientPanel();refresh(true)},50)});return r};
      wr.__warrantyHook=true;wr.__original=oldR;window.clientRefreshCommerce=wr;
    }
    if(typeof window.cloudLoadSheets==='function'&&!window.cloudLoadSheets.__warrantyHook){
      var oldS=window.cloudLoadSheets;
      var ws=function(){var r=oldS.apply(this,arguments);Promise.resolve(r).finally(function(){setTimeout(function(){if(window.clientCurrentId)refresh(true)},50)});return r};
      ws.__warrantyHook=true;ws.__original=oldS;window.cloudLoadSheets=ws;
    }
  }

  function install(){
    hookLacAccess();hookClient();ensureSubjectBanner();ensureClientPanel();
    if(window.clientCurrentId)refresh(false);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
  setInterval(install,1000);
})();
</script>
'''

pos=s.lower().rfind("</body>")
if pos<0:
    raise SystemExit("Tag </body> finale non trovato")
s=s[:pos]+css+js+s[pos:]
p.write_text(s,encoding="utf-8")

for req in [MARK,"Attiva garanzia","Salva selezione riordino","Prima seleziona un cliente","Tutte le schede LAC del cliente"]:
    if req not in s:
        raise SystemExit("Patch LAC garanzia incompleta: "+req)
print("LAC warranty + subject binding OK")

from pathlib import Path

p=Path("_site/index.html")
s=p.read_text(encoding="utf-8")
MARK="OPTYKER_LABORATORY_V1"
if MARK in s:
    raise SystemExit(0)

css=r'''
<style id="optykerLaboratoryStyles">
#labOrdersPanel{display:none;padding:18px;border:1px solid #d5e0e9;border-radius:14px;background:#f8fbfd;box-shadow:0 4px 18px rgba(23,50,74,.04)}
.labHead{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;padding-bottom:14px;border-bottom:1px solid #dce5ec;margin-bottom:14px}
.labEyebrow{font-size:10px;font-weight:900;letter-spacing:.8px;text-transform:uppercase;color:#1769aa}
.labTitle{font-size:25px;font-weight:900;color:#17324a;margin-top:3px}
.labSub{font-size:11px;color:#6b7f8e;line-height:1.45;margin-top:5px;max-width:760px}
.labHeadActions{display:flex;gap:8px;flex-wrap:wrap}
.labToolbar{display:flex;gap:9px;align-items:center;margin:0 0 13px}
.labToolbar input{flex:1;min-width:220px;background:#fff}
.labList{display:grid;gap:10px}
.labEmpty{padding:28px 16px;text-align:center;color:#728493;border:1px dashed #cbd8e2;border-radius:12px;background:#fff}
.labCard{background:#fff;border:1px solid #d5e0e9;border-radius:12px;padding:13px;display:grid;grid-template-columns:minmax(0,1.6fr) minmax(190px,.55fr);gap:12px}
.labRef{font-size:16px;font-weight:950;color:#1769aa}
.labClient{font-size:13px;font-weight:900;color:#17324a;margin-top:4px}
.labMeta{font-size:9px;color:#718493;margin-top:3px;line-height:1.5}
.labProducts{margin-top:9px;padding-top:9px;border-top:1px solid #edf1f4;display:grid;gap:4px}
.labProduct{font-size:10px;color:#314f65;font-weight:700}
.labStatusBox{border-left:1px solid #e3e9ee;padding-left:12px;display:flex;flex-direction:column;justify-content:center;gap:7px}
.labStatusBox label{font-size:9px;font-weight:900;color:#6a7f90;text-transform:uppercase;letter-spacing:.4px}
.labStatusBox select{width:100%;font-weight:850;background:#fff}
.labStatusHint{font-size:8px;color:#7a8a96;line-height:1.4}
.labPill{display:inline-flex;align-items:center;padding:4px 7px;border-radius:999px;font-size:8px;font-weight:900;background:#eaf4fb;color:#1769aa;margin-left:5px}
#optykerClientReference{display:inline-flex;margin-left:6px;padding:4px 7px;border-radius:999px;background:#eaf4fb;color:#1769aa;font-size:9px;font-weight:900}
#lacSendWorkOrderBtn{background:linear-gradient(180deg,#1d70b5,#155f9f)!important;border-color:#11558f!important;color:#fff!important}
#lacSendWorkOrderBtn[disabled]{opacity:.65;cursor:default}
@media(max-width:780px){.labHead{flex-direction:column}.labCard{grid-template-columns:1fr}.labStatusBox{border-left:0;border-top:1px solid #e3e9ee;padding-left:0;padding-top:10px}.labToolbar{flex-direction:column;align-items:stretch}}
</style>
'''

js=r'''
<script id="optykerLaboratoryScript">
(function(){
  window.OPTYKER_LABORATORY_V1=true;
  var labState={orders:[],query:''};
  function e(id){return document.getElementById(id);}
  function h(v){return String(v==null?'':v).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
  function dt(v){if(!v)return '';try{return new Date(v).toLocaleString('it-IT',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});}catch(z){return String(v);}}
  function num(v){var n=parseFloat(String(v==null?'':v).replace(',','.'));return isFinite(n)?n:0;}
  function api(action,payload){
    if(!window.OPTYKER_CLOUD||!OPTYKER_CLOUD.root||!OPTYKER_CLOUD.key)return Promise.reject(new Error('Cloud Optyker non disponibile'));
    var user=String(OPTYKER_CLOUD.username||window.OPTYKER_ACTIVE_USER||'').trim();
    if(!user)return Promise.reject(new Error('Sessione operatore non disponibile'));
    return fetch(OPTYKER_CLOUD.root+'/rest/v1/rpc/optyker_api_legacy_passwordless',{
      method:'POST',
      headers:{'Content-Type':'application/json','apikey':OPTYKER_CLOUD.key,'Authorization':'Bearer '+OPTYKER_CLOUD.key},
      body:JSON.stringify({p_username:user,p_password:'',p_action:action,p_payload:payload||{}})
    }).then(function(r){return r.json().catch(function(){return {};}).then(function(x){if(!r.ok||!x||x.ok===false)throw new Error(x&&x.error||('Server '+r.status));return x;});});
  }
  function statusLabel(s){
    return {da_fare:'Da fare',in_preparazione:'In preparazione',costruzione:'Costruzione',in_spedizione:'In spedizione',completato:'Completato',annullato:'Annullato'}[s]||s||'Da fare';
  }
  function currentDocument(){
    var d=e('lacSelectedDocType');return d?String(d.textContent||'').trim():'';
  }
  function ensurePanel(){
    if(e('labOrdersPanel'))return;
    var p=document.createElement('div');p.id='labOrdersPanel';p.className='panel';
    p.innerHTML='<div class="labHead"><div><div class="labEyebrow">Ottica Visual Care</div><div class="labTitle">Laboratorio</div><div class="labSub">Ordini LAC inviati dalle buste. Lo stato parte da Da fare; quando passa a In preparazione, dopo 24 ore diventa automaticamente Costruzione.</div></div><div class="labHeadActions"><button class="secondary" type="button" id="labOnlineOrdersBtn">Ordini online / app</button><button class="secondary" type="button" onclick="showDashboard()">Dashboard</button></div></div><div class="labToolbar"><input id="labSearch" type="search" placeholder="Cerca riferimento, cliente, prodotto..."><button class="secondary" id="labRefresh" type="button">Aggiorna</button></div><div id="labOrdersList" class="labList"><div class="labEmpty">Caricamento laboratorio…</div></div>';
    var a=e('onlineOrdersPanel')||e('lacPanel')||e('clientsPanel');
    if(a&&a.parentNode)a.parentNode.insertBefore(p,a.nextSibling);else document.body.appendChild(p);
    e('labSearch').oninput=function(){labState.query=this.value||'';render();};
    e('labRefresh').onclick=load;
    e('labOnlineOrdersBtn').onclick=function(){if(typeof window.openOnlineOrders==='function')window.openOnlineOrders();};
  }
  function hideLab(){var p=e('labOrdersPanel');if(p)p.style.display='none';}
  function hideMain(){
    ['dashboardPanel','analysisPanel','prescriptionPanel','visualExamPanel','indicationsPanel','hearingPanel','clientsPanel','lacPanel','onlineOrdersPanel'].forEach(function(id){var x=e(id);if(x)x.style.display='none';});
    var t=e('analysisTabs');if(t)t.style.display='none';
    var r=e('reportSectionTop');if(r)r.style.display='none';
  }
  window.openLaboratory=function(){
    ensurePanel();hideMain();
    if(typeof window.dashboardSetWorkAreaVisible==='function')dashboardSetWorkAreaVisible(false);
    var p=e('labOrdersPanel');if(p)p.style.display='block';
    try{if(typeof window.cloudNavActive==='function')cloudNavActive('navOrders');}catch(z){}
    load();try{window.scrollTo(0,0);}catch(z2){}
  };
  function productsFor(o){
    var p=o&&o.payload||{},snap=p.snapshot||{},st=snap.lacState||{},arr=[];
    if(st.odProductName)arr.push('OD · '+st.odProductName+(st.odCost?' · € '+String(st.odCost):''));
    if(st.osProductName)arr.push('OS · '+st.osProductName+(st.osCost?' · € '+String(st.osCost):''));
    if(!arr.length&&p.summary_text)arr.push(p.summary_text);
    return arr;
  }
  function render(){
    var box=e('labOrdersList');if(!box)return;
    var q=String(labState.query||'').trim().toLowerCase();
    var rows=(labState.orders||[]).filter(function(o){
      if(!q)return true;
      return [o.reference_code,o.client_name,o.client_reference,o.order_type].concat(productsFor(o)).join(' ').toLowerCase().indexOf(q)>=0;
    });
    if(!rows.length){box.innerHTML='<div class="labEmpty">Nessun ordine di laboratorio'+(q?' per questa ricerca':'')+'.</div>';return;}
    box.innerHTML=rows.map(function(o){
      var prods=productsFor(o),automatic=o.status==='in_preparazione'?'Dopo 24 ore passerà automaticamente a Costruzione.':'';
      return '<div class="labCard"><div><div class="labRef">'+h(o.reference_code||'Ordine')+'<span class="labPill">LAC · BUSTA</span></div><div class="labClient">'+h(o.client_name||'Cliente')+(o.client_reference?' · '+h(o.client_reference):'')+'</div><div class="labMeta">Creato '+h(dt(o.created_at))+(o.created_by?' · '+h(o.created_by):'')+'</div><div class="labProducts">'+(prods.length?prods.map(function(x){return '<div class="labProduct">'+h(x)+'</div>';}).join(''):'<div class="labProduct">Riepilogo LAC allegato all’ordine</div>')+'</div></div><div class="labStatusBox"><label>Stato ordine</label><select onchange="labUpdateStatus(\''+h(o.id)+'\',this.value)"><option value="da_fare"'+(o.status==='da_fare'?' selected':'')+'>Da fare</option><option value="in_preparazione"'+(o.status==='in_preparazione'?' selected':'')+'>In preparazione</option><option value="costruzione"'+(o.status==='costruzione'?' selected':'')+'>Costruzione</option><option value="in_spedizione"'+(o.status==='in_spedizione'?' selected':'')+'>In spedizione</option></select><div class="labStatusHint">'+h(automatic||('Stato attuale: '+statusLabel(o.status)))+'</div></div></div>';
    }).join('');
  }
  function load(){
    ensurePanel();var box=e('labOrdersList');if(box)box.innerHTML='<div class="labEmpty">Aggiornamento laboratorio…</div>';
    api('list_work_orders',{}).then(function(x){labState.orders=Array.isArray(x.data)?x.data:[];render();}).catch(function(err){if(box)box.innerHTML='<div class="labEmpty">Impossibile caricare il laboratorio: '+h(err.message)+'</div>';});
  }
  window.labUpdateStatus=function(id,status){
    api('update_work_order_status',{id:id,status:status}).then(load).catch(function(err){alert('Impossibile aggiornare lo stato: '+err.message);load();});
  };
  function findClient(){
    var id=window.clientCurrentId||'';
    if(!id||!window.OPTYKER_CLOUD||!Array.isArray(OPTYKER_CLOUD.clients))return null;
    for(var i=0;i<OPTYKER_CLOUD.clients.length;i++)if(String(OPTYKER_CLOUD.clients[i].id)===String(id))return OPTYKER_CLOUD.clients[i];
    return null;
  }
  function syncClientReference(){
    var status=document.querySelector('.clientIdentityStatus'),c=findClient();
    if(!status||!c)return;
    var x=e('optykerClientReference');
    if(!x){x=document.createElement('span');x.id='optykerClientReference';status.appendChild(x);}
    x.textContent=c.reference_code?('Rif. '+c.reference_code):'';
    x.style.display=c.reference_code?'inline-flex':'none';
  }
  function ensureSendButton(){
    var actions=document.querySelector('.lacSummaryModalActions');if(!actions)return;
    var b=e('lacSendWorkOrderBtn');
    if(!b){
      b=document.createElement('button');b.id='lacSendWorkOrderBtn';b.className='primary';b.type='button';b.textContent="Invia l'ordine";b.onclick=window.lacSendWorkOrder;
      var printBtn=null,btns=actions.querySelectorAll('button');for(var i=0;i<btns.length;i++)if((btns[i].textContent||'').toLowerCase().indexOf('stampa')>=0){printBtn=btns[i];break;}
      if(printBtn)actions.insertBefore(b,printBtn);else actions.appendChild(b);
    }
    b.style.display=currentDocument()==='Busta'?'inline-flex':'none';
  }
  window.lacSendWorkOrder=function(){
    var b=e('lacSendWorkOrderBtn');if(b&&b.disabled)return;
    if(currentDocument()!=='Busta'){alert("L'invio al Laboratorio è disponibile solo per le Buste LAC.");return;}
    var clientId=window.clientCurrentId||'';
    if(!clientId){
      alert("Prima collega la Busta a un cliente. Dopo il salvataggio riapri il riepilogo e premi Invia l'ordine.");
      if(typeof window.lacOpenClientPicker==='function')window.lacOpenClientPicker();
      return;
    }
    if(!window.lacCaptureClientSheet){alert('Impossibile acquisire la scheda LAC.');return;}
    var snap=window.lacCaptureClientSheet();
    snap.lacState=snap.lacState||{};snap.lacState.document='Busta';
    if(b){b.disabled=true;b.textContent='Invio…';}
    var user=String((window.OPTYKER_CLOUD&&OPTYKER_CLOUD.username)||window.OPTYKER_ACTIVE_USER||'');
    api('save_sheet',{client_id:clientId,sheet_type:'lac',title:'Scheda LAC',operator:user,data:snap})
      .then(function(x){
        var row=x.data||{};
        if(!row.id)throw new Error('Salvataggio Busta non riuscito');
        var saved=row.data||snap,summary=e('lacSummaryBody');
        return api('create_lac_work_order',{
          client_id:clientId,
          source_sheet_id:row.id,
          payload:{
            snapshot:saved,
            summary_html:summary?summary.innerHTML:'',
            document:'Busta',
            reference_code:row.reference_code||'',
            sent_at:new Date().toISOString()
          }
        });
      })
      .then(function(x){
        var row=x.data||{},ref=row.reference_code||'';
        var r=e('lacReference');if(r&&ref)r.value=ref;
        if(b){b.disabled=true;b.textContent='Ordine inviato'+(ref?' · '+ref:'');}
        try{if(window.OPTYKER_CLOUD&&window.clientCurrentId)cloudLoadSheets(window.clientCurrentId).catch(function(){});}catch(z){}
        alert('Ordine inviato al Laboratorio'+(ref?' · riferimento '+ref:'')+'. Stato iniziale: Da fare.');
      })
      .catch(function(err){if(b){b.disabled=false;b.textContent="Invia l'ordine";}alert("Impossibile inviare l'ordine: "+err.message);});
  };
  function resetSendButton(){
    var b=e('lacSendWorkOrderBtn');if(b){b.disabled=false;b.textContent="Invia l'ordine";delete b.dataset.sent;}
  }
  function install(){
    ensurePanel();
    var nav=e('navOrders');
    if(nav){nav.textContent='Laboratorio';nav.onclick=window.openLaboratory;nav.setAttribute('title','Laboratorio');}
    if(typeof window.lacOpenSummary==='function'&&!window.__labSummaryWrapped){
      window.__labSummaryWrapped=true;var oldSummary=window.lacOpenSummary;
      window.lacOpenSummary=function(){var r=oldSummary.apply(this,arguments);setTimeout(ensureSendButton,0);return r;};
    }
    if(typeof window.lacResetAll==='function'&&!window.__labResetWrapped){
      window.__labResetWrapped=true;var oldReset=window.lacResetAll;window.lacResetAll=function(){var r=oldReset.apply(this,arguments);resetSendButton();return r;};
    }
    if(typeof window.lacProductCreate==='function'&&!window.__labCreateWrapped){
      window.__labCreateWrapped=true;var oldCreate=window.lacProductCreate;window.lacProductCreate=function(){resetSendButton();return oldCreate.apply(this,arguments);};
    }
    if(typeof window.showDashboard==='function'&&!window.__labDashWrapped){
      window.__labDashWrapped=true;var oldDash=window.showDashboard;window.showDashboard=function(){hideLab();return oldDash.apply(this,arguments);};
    }
    if(typeof window.showModule==='function'&&!window.__labModWrapped){
      window.__labModWrapped=true;var oldMod=window.showModule;window.showModule=function(){hideLab();return oldMod.apply(this,arguments);};
    }
    if(typeof window.openLacDevice==='function'&&!window.__labLacWrapped){
      window.__labLacWrapped=true;var oldLac=window.openLacDevice;window.openLacDevice=function(){hideLab();return oldLac.apply(this,arguments);};
    }
    if(typeof window.openOnlineOrders==='function'&&!window.__labOnlineWrapped){
      window.__labOnlineWrapped=true;var oldOnline=window.openOnlineOrders;window.openOnlineOrders=function(){hideLab();return oldOnline.apply(this,arguments);};
    }
    syncClientReference();ensureSendButton();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
  setInterval(function(){install();syncClientReference();ensureSendButton();},900);
})();
</script>
'''

s=s.replace("</body>",css+js+"</body>",1)
p.write_text(s,encoding="utf-8")
print("patched", MARK)

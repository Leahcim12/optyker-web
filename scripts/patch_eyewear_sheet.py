from pathlib import Path

p=Path("_site/index.html")
s=p.read_text(encoding="utf-8")
MARK="OPTYKER_EYEWEAR_SHEET_V2"
if MARK in s:
    raise SystemExit(0)

css=r'''
<style id="optykerEyewearCss">
/* OPTYKER_EYEWEAR_SHEET_V2 */
#navEyewear{display:none!important}
#eyewearPanel{display:none;grid-column:2!important;min-width:0;padding:18px;border:1px solid #d7e3eb;border-radius:14px;background:#f8fbfd;box-shadow:0 4px 18px rgba(23,50,74,.04)}
#dashboardEyewearBtn{cursor:pointer!important}
body.optykerBillingMode #dashboardEyewearBtn{display:none!important}
.eyHead{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;margin-bottom:14px;padding-bottom:14px;border-bottom:1px solid #dce5ec}
.eyEyebrow{font-size:9px;font-weight:950;letter-spacing:.1em;text-transform:uppercase;color:#1769aa}
.eyTitle{font-size:25px;font-weight:950;color:#17324a;margin-top:3px}
.eySub{font-size:10px;color:#6d8090;margin-top:4px;line-height:1.45}
.eyModeSwitch{display:grid;grid-template-columns:1fr 1fr;gap:8px;min-width:330px}
.eyModeBtn{min-height:44px;border:1px solid #cad8e2;border-radius:10px;background:#fff;color:#496378;padding:7px 12px;text-align:left;cursor:pointer}
.eyModeBtn b{display:block;font-size:11px;color:#25465f}.eyModeBtn small{display:block;font-size:8px;color:#7b8d9b;margin-top:2px}
.eyModeBtn.active{background:#1769aa;border-color:#1769aa;color:#fff}.eyModeBtn.active b,.eyModeBtn.active small{color:#fff}
.eyTopLine{display:grid;grid-template-columns:minmax(220px,1fr) 190px;gap:10px;margin-bottom:12px}
.eyField label{display:block;font-size:8px;font-weight:950;letter-spacing:.05em;text-transform:uppercase;color:#718495;margin-bottom:5px}
.eyField input,.eyField select,.eyField textarea{width:100%;box-sizing:border-box;border:1px solid #cbd8e2;border-radius:8px;background:#fff;color:#29465e;font:750 10px/1.3 "Segoe UI",Arial,sans-serif;outline:none}
.eyField input,.eyField select{height:36px;padding:0 9px}.eyField textarea{min-height:72px;padding:9px;resize:vertical}
.eyField input:focus,.eyField select:focus,.eyField textarea:focus{border-color:#1769aa;box-shadow:0 0 0 2px rgba(23,105,170,.1)}
.eyWizard{display:grid;grid-template-columns:190px minmax(0,1fr);gap:12px}
.eySteps{display:flex;flex-direction:column;gap:6px}
.eyStepBtn{display:flex;align-items:center;gap:9px;width:100%;min-height:44px;border:1px solid #d7e2ea;border-radius:10px;background:#fff;color:#526b7e;text-align:left;padding:8px 10px;cursor:pointer}
.eyStepNo{width:25px;height:25px;border-radius:50%;display:grid;place-items:center;background:#edf3f7;color:#60778a;font-size:9px;font-weight:950;flex:0 0 25px}
.eyStepBtn b{display:block;font-size:9px}.eyStepBtn small{display:block;font-size:7px;color:#8696a2;margin-top:2px}
.eyStepBtn.active{border-color:#1769aa;background:#edf6fc;color:#1769aa}.eyStepBtn.active .eyStepNo{background:#1769aa;color:#fff}
.eyStepBtn.done .eyStepNo{background:#2e7d4b;color:#fff}
.eyStage{display:none;border:1px solid #d8e3eb;border-radius:12px;background:#fff;padding:15px;min-height:410px}.eyStage.active{display:block}
.eyStageHead{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:14px}
.eyStageTitle{font-size:17px;font-weight:950;color:#17334b}.eyStageHint{font-size:9px;color:#778a99;margin-top:3px}
.eyGrid2{display:grid;grid-template-columns:1fr 1fr;gap:10px}.eyGrid3{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.eyWide{grid-column:1/-1}
.eyRequired:after{content:" *";color:#b53b32}
.eyTreatments{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
.eyCheck{display:flex;align-items:center;gap:9px;min-height:42px;border:1px solid #d8e3eb;border-radius:9px;background:#fbfdfe;padding:8px 10px;cursor:pointer;font-size:9px;font-weight:850;color:#3d596f}
.eyCheck input{width:17px;height:17px;accent-color:#1769aa}
.eyColorModes{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px}.eyColorMode{min-height:58px;border:1px solid #d7e2ea;border-radius:10px;background:#fff;color:#536c80;padding:9px;text-align:left;cursor:pointer}
.eyColorMode b{display:block;font-size:10px;color:#29485f}.eyColorMode small{display:block;font-size:8px;color:#7b8e9d;margin-top:3px}.eyColorMode.active{background:#edf6fc;border-color:#1769aa}.eyColorMode.active b{color:#1769aa}
.eyFrameSearchBox{border:1px solid #cfe0eb;border-radius:11px;background:#f6fbfe;padding:11px;margin-bottom:13px}.eyFrameSearchTop{display:grid;grid-template-columns:minmax(180px,.65fr) auto minmax(240px,1fr) auto;gap:7px;align-items:end}.eyFrameSearchTop .eyField{min-width:0}.eyFrameSelected{margin-top:9px;border:1px solid #bcd7e9;border-radius:9px;background:#edf7fd;padding:9px 10px;font-size:9px;color:#35576e}.eyFrameSelected b{color:#1769aa}.eyFrameSearchResults{margin-top:9px;display:grid;gap:6px;max-height:220px;overflow:auto}.eyFrameResult{display:grid;grid-template-columns:52px minmax(0,1fr) auto;gap:9px;align-items:center;border:1px solid #dce5ec;border-radius:9px;background:#fff;padding:8px 9px;cursor:pointer}.eyFrameResult:hover{border-color:#9fc3dd;background:#fbfdff}.eyFrameResult img{width:52px;height:52px;object-fit:contain;border:1px solid #e1e8ed;border-radius:8px;background:#fff}.eyFrameResultNoImg{width:52px;height:52px;border:1px solid #e1e8ed;border-radius:8px;background:#f5f7f9;display:grid;place-items:center;color:#8b9aa6;font-size:7px;text-align:center}.eyFrameResultName{font-size:10px;font-weight:900;color:#26455d}.eyFrameResultMeta{font-size:8px;color:#778b9a;margin-top:3px;line-height:1.4}.eyFrameResultPrice{font-size:12px;font-weight:950;color:#1769aa;white-space:nowrap}.eyCatalogBox{border:1px solid #d7e3eb;border-radius:11px;background:#f7fafc;padding:11px;margin-top:12px}
.eyCatalogTop{display:flex;gap:7px}.eyCatalogTop input{flex:1;height:36px;border:1px solid #cbd8e2;border-radius:8px;padding:0 9px;font-size:10px;font-weight:750}
.eyBtn{min-height:36px;border:1px solid #c8d7e2;border-radius:8px;background:#fff;color:#1769aa;padding:0 11px;font-size:9px;font-weight:900;cursor:pointer}.eyBtn:hover{background:#edf7fd}.eyBtn.primary{background:#1769aa;color:#fff;border-color:#1769aa}.eyBtn.primary:hover{background:#135a92}
.eyCatalogResults{margin-top:9px;display:grid;gap:6px;max-height:250px;overflow:auto}.eyCatalogEmpty{padding:16px;text-align:center;color:#7a8c9a;font-size:9px}
.eyLensRow{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:center;border:1px solid #dce5ec;border-radius:9px;background:#fff;padding:9px 10px;cursor:pointer}.eyLensRow:hover{border-color:#9fc3dd;background:#fbfdff}
.eyLensName{font-size:10px;font-weight:900;color:#26455d}.eyLensMeta{font-size:8px;color:#778b9a;margin-top:3px;line-height:1.4}.eyLensPrice{font-size:12px;font-weight:950;color:#1769aa;white-space:nowrap}
.eySelectedLens{margin-top:9px;border:1px solid #bcd7e9;border-radius:9px;background:#edf7fd;padding:9px 10px;font-size:9px;color:#35576e}.eySelectedLens b{color:#1769aa}
.eyDiscountRow{display:grid;grid-template-columns:1fr 120px;gap:10px;align-items:end}
.eySummary{margin-top:14px;border:1px solid #d7e3eb;border-radius:11px;background:#f7fafc;padding:12px}.eySummaryRow{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:6px 0;border-bottom:1px solid #e4ebf0;font-size:9px;color:#51697c}.eySummaryRow:last-child{border-bottom:0}.eySummaryRow.total{font-size:13px;font-weight:950;color:#17334b}.eySummaryRow.discount{color:#2e7d4b}
.eyStageActions{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:16px;padding-top:12px;border-top:1px solid #e5ebf0}.eyStageActionsRight{display:flex;gap:7px}
.eyFinalActions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
.eyRecent{margin-top:14px;border-top:1px solid #dde6ed;padding-top:13px}.eyRecentTitle{font-size:11px;font-weight:950;color:#17334b;margin-bottom:8px}.eyRecentList{display:grid;gap:7px}.eyRecentRow{display:grid;grid-template-columns:110px minmax(0,1fr) auto;gap:10px;align-items:center;border:1px solid #dce5ec;border-radius:9px;background:#fff;padding:9px 10px}.eyRecentType{font-size:8px;font-weight:950;color:#1769aa}.eyRecentMain{font-size:9px;font-weight:850;color:#36546b}.eyRecentMeta{font-size:8px;color:#81919e;margin-top:2px}.eyRecentTotal{font-size:10px;font-weight:950;color:#17334b}
.eyToast{position:fixed;z-index:240000;right:20px;bottom:20px;max-width:420px;border-radius:10px;background:#17334b;color:#fff;padding:11px 13px;box-shadow:0 14px 36px rgba(18,42,63,.25);font-size:11px;font-weight:750;display:none}.eyToast.error{background:#8f2f2f}.eyToast.ok{background:#25693b}
@media(max-width:950px){.eyHead{flex-direction:column}.eyModeSwitch{width:100%;min-width:0}.eyWizard{grid-template-columns:1fr}.eySteps{display:grid;grid-template-columns:repeat(5,1fr)}.eyStepBtn{justify-content:center;text-align:center}.eyStepBtn b,.eyStepBtn small{display:none}}
@media(max-width:700px){#eyewearPanel{grid-column:1!important;padding:12px}.eyFrameSearchTop{grid-template-columns:1fr}.eyTopLine,.eyGrid2,.eyGrid3,.eyColorModes,.eyTreatments{grid-template-columns:1fr}.eySteps{grid-template-columns:repeat(5,1fr);gap:4px}.eyStepBtn{padding:5px;min-height:38px}.eyRecentRow{grid-template-columns:1fr auto}.eyRecentType{grid-column:1/-1}}
</style>
'''

js=r'''
<script id="optykerEyewearJs">
(function(){/* OPTYKER_EYEWEAR_SHEET_V2 */
  if(window.__optykerEyewearV1)return;window.__optykerEyewearV1=true;
  var API='https://whgziwaegjzqsgcntesr.supabase.co/functions/v1/optyker-eyewear-api';
  var INV_API='https://whgziwaegjzqsgcntesr.supabase.co/functions/v1/optyker-inventory-api';
  var S={mode:'quote',step:1,catalog:[],selected:null,recent:[],saving:false,frameResults:[],selectedFrame:null};

  function E(id){return document.getElementById(id)}
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
  function creds(){var c=window.OPTYKER_CLOUD||{};return {username:String(c.username||window.OPTYKER_ACTIVE_USER||'').trim(),password:String(c.password||'')}}
  function api(action,payload){var c=creds();if(!c.username||!c.password)return Promise.reject(new Error('Sessione operatore non disponibile. Esci e accedi nuovamente.'));return fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:action,username:c.username,password:c.password,payload:payload||{}})}).then(function(r){return r.json().catch(function(){return {}}).then(function(x){if(!r.ok||!x||x.ok===false)throw new Error(x&&x.error||('HTTP '+r.status));return x})})}
  function invApi(action,payload){var cc=creds();if(!cc.username||!cc.password)return Promise.reject(new Error('Sessione operatore non disponibile.'));return fetch(INV_API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:action,username:cc.username,password:cc.password,payload:payload||{}})}).then(function(r){return r.json().catch(function(){return {}}).then(function(x){if(!r.ok||!x||x.ok===false)throw new Error(x&&x.error||('HTTP '+r.status));return x})})}
  function euro(v){try{return new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR'}).format(Number(v||0))}catch(e){return Number(v||0).toFixed(2)+' €'}}
  function toast(m,t){var x=E('eyToast');if(!x){x=document.createElement('div');x.id='eyToast';x.className='eyToast';document.body.appendChild(x)}x.className='eyToast '+(t||'');x.textContent=m;x.style.display='block';clearTimeout(x.__tm);x.__tm=setTimeout(function(){x.style.display='none'},3900)}
  function clientsLocal(){var a=window.OPTYKER_CLOUD&&Array.isArray(OPTYKER_CLOUD.clients)?OPTYKER_CLOUD.clients:[];return a.slice().sort(function(a,b){return String((a.surname||'')+' '+(a.name||'')).localeCompare(String((b.surname||'')+' '+(b.name||'')),'it')})}
  function clientLabel(c){return (((c.surname||'')+' '+(c.name||'')).trim()||'Cliente')+(c.reference_no?' · '+c.reference_no:'')}

  function ensureDashboardButton(){
    if(window.OPTYKER_BILLING_ADMIN)return;
    var legacy=E('navEyewear');if(legacy&&legacy.parentNode)legacy.parentNode.removeChild(legacy);
    var dash=E('dashboardPanel');if(!dash)return;
    var existing=E('dashboardEyewearBtn');
    var all=dash.querySelectorAll('button,a,[role="button"]'),lac=null;
    for(var i=0;i<all.length;i++){
      if(all[i].id==='dashboardEyewearBtn')continue;
      var t=String(all[i].textContent||'').replace(/\s+/g,' ').trim().toLowerCase();
      if(t==='lac'||t==='l.a.c.'||t.indexOf('lenti a contatto')>=0||t.indexOf('scheda lac')>=0){lac=all[i];break}
    }
    if(!lac){
      var nodes=dash.querySelectorAll('.dashboardCard,.dashboardQuickCard,.dashboardActionCard,[class*="dashboard"][onclick]');
      for(i=0;i<nodes.length;i++){
        var tx=String(nodes[i].textContent||'').replace(/\s+/g,' ').trim().toLowerCase();
        if(tx==='lac'||tx.indexOf('lenti a contatto')>=0||tx.indexOf('scheda lac')>=0){lac=nodes[i];break}
      }
    }
    if(!lac)return;
    if(!existing){
      existing=lac.cloneNode(true);
      existing.id='dashboardEyewearBtn';
      existing.removeAttribute('onclick');
      existing.removeAttribute('href');
      existing.querySelectorAll('[id]').forEach(function(x){x.removeAttribute('id')});
      var textNodes=existing.querySelectorAll('span,b,strong,div');
      var changed=false;
      for(i=0;i<textNodes.length;i++){
        var s=String(textNodes[i].textContent||'').replace(/\s+/g,' ').trim().toLowerCase();
        if(s==='lac'||s==='l.a.c.'||s.indexOf('lenti a contatto')>=0||s.indexOf('scheda lac')>=0){
          textNodes[i].textContent='Occhiali';changed=true;break
        }
      }
      if(!changed)existing.textContent='Occhiali';
      existing.onclick=function(ev){ev.preventDefault();ev.stopPropagation();openEyewear('quote')};
    }
    if(existing.parentNode!==lac.parentNode||lac.nextElementSibling!==existing)lac.insertAdjacentElement('afterend',existing)
  }
  function ensurePanel(){
    if(E('eyewearPanel'))return;
    var p=document.createElement('div');p.id='eyewearPanel';p.className='panel';
    p.innerHTML='<div class="eyHead"><div><div class="eyEyebrow">Optyker · Scheda occhiali</div><div id="eyTitle" class="eyTitle">Preventivo occhiali</div><div id="eySub" class="eySub">Preventivo e busta sono documenti separati, ma seguono lo stesso percorso guidato.</div></div><div class="eyModeSwitch"><button id="eyModeQuote" class="eyModeBtn active" type="button"><b>Preventivo</b><small>Proposta economica al cliente</small></button><button id="eyModeJob" class="eyModeBtn" type="button"><b>Busta</b><small>Scheda definitiva di lavorazione</small></button></div></div>'+
      '<div class="eyTopLine"><div class="eyField"><label>Cliente</label><select id="eyClient"><option value="">Cliente non ancora associato</option></select></div><div class="eyField"><label>Riferimento</label><input id="eyReference" readonly placeholder="Generato al salvataggio"></div></div>'+
      '<div class="eyWizard"><div class="eySteps">'+
        '<button class="eyStepBtn active" data-ey-step="1" type="button"><span class="eyStepNo">1</span><span><b>Montatura</b><small>Sempre richiesta</small></span></button>'+
        '<button class="eyStepBtn" data-ey-step="2" type="button"><span class="eyStepNo">2</span><span><b>Tipo di lenti</b><small>Listino o manuale</small></span></button>'+
        '<button class="eyStepBtn" data-ey-step="3" type="button"><span class="eyStepNo">3</span><span><b>Trattamenti</b><small>Selezione multipla</small></span></button>'+
        '<button class="eyStepBtn" data-ey-step="4" type="button"><span class="eyStepNo">4</span><span><b>Colore</b><small>Sole / fotocromatico</small></span></button>'+
        '<button class="eyStepBtn" data-ey-step="5" type="button"><span class="eyStepNo">5</span><span><b>Prezzo e sconto</b><small>Sconto solo sulle lenti</small></span></button>'+
      '</div><div>'+
        '<section class="eyStage active" data-ey-stage="1"><div class="eyStageHead"><div><div class="eyStageTitle">Montatura</div><div class="eyStageHint">La montatura viene richiesta sempre, sia per Preventivo sia per Busta. Puoi leggerne il barcode o cercarla direttamente in Magazzino.</div></div></div><div class="eyFrameSearchBox"><div class="eyFrameSearchTop"><div class="eyField"><label>Barcode montatura</label><input id="eyFrameBarcodeSearch" placeholder="Leggi o digita barcode"></div><button id="eyFrameBarcodeGo" class="eyBtn" type="button">Cerca barcode</button><div class="eyField"><label>Cerca in magazzino</label><input id="eyFrameWarehouseSearch" placeholder="Marca, modello, SKU o barcode…"></div><button id="eyFrameWarehouseGo" class="eyBtn" type="button">Cerca montatura</button></div><div id="eyFrameSelected"></div><div id="eyFrameSearchResults" class="eyFrameSearchResults"></div></div><div class="eyGrid2">'+
          '<div class="eyField"><label class="eyRequired">Marca montatura</label><input id="eyFrameBrand" placeholder="Es. Ray-Ban"></div>'+
          '<div class="eyField"><label class="eyRequired">Modello / riferimento</label><input id="eyFrameModel" placeholder="Modello o codice"></div>'+
          '<div class="eyField"><label>Colore montatura</label><input id="eyFrameColor" placeholder="Colore"></div>'+
          '<div class="eyField"><label>Prezzo montatura</label><input id="eyFramePrice" type="number" min="0" step="0.01" inputmode="decimal" placeholder="0,00"></div>'+
          '<div class="eyField"><label>Barcode selezionato</label><input id="eyFrameBarcode" readonly placeholder="Nessun barcode"></div>'+
          '<div class="eyField"><label>SKU montatura</label><input id="eyFrameSku" readonly placeholder="Nessuno SKU"></div>'+
          '<div class="eyField eyWide"><label>Descrizione / note montatura</label><textarea id="eyFrameDescription" placeholder="Misura, calibro, ponte, aste o altre note…"></textarea></div>'+
        '</div><div class="eyStageActions"><span></span><div class="eyStageActionsRight"><button class="eyBtn primary" data-ey-next="2" type="button">Avanti · Tipo lenti →</button></div></div></section>'+
        '<section class="eyStage" data-ey-stage="2"><div class="eyStageHead"><div><div class="eyStageTitle">Tipo di lenti oftalmiche</div><div class="eyStageHint">Puoi compilare manualmente oppure cercare nel listino che verrà caricato successivamente.</div></div></div><div class="eyGrid3">'+
          '<div class="eyField"><label class="eyRequired">Tipo di lente</label><select id="eyLensType"><option value="">Seleziona…</option><option>Monofocale</option><option>Progressiva</option><option>Office / Indoor</option><option>Degradativa</option><option>Bifocale</option><option>Neutra / Sole</option><option>Altro</option></select></div>'+
          '<div class="eyField"><label>Disegno / geometria</label><input id="eyLensDesign" placeholder="Es. asferica, free-form…"></div>'+
          '<div class="eyField"><label>Indice</label><select id="eyLensIndex"><option value="">Seleziona…</option><option>1.50</option><option>1.53</option><option>1.56</option><option>1.59</option><option>1.60</option><option>1.67</option><option>1.74</option><option>Altro</option></select></div>'+
          '<div class="eyField"><label>Materiale</label><input id="eyLensMaterial" placeholder="Organico, policarbonato…"></div>'+
          '<div class="eyField"><label>Marca lente</label><input id="eyLensBrand" placeholder="Marca"></div>'+
          '<div class="eyField"><label>Nome lente / prodotto</label><input id="eyLensName" placeholder="Nome commerciale"></div>'+
        '</div>'+
        '<div class="eyCatalogBox"><div class="eyField"><label>Cerca nel listino lenti oftalmiche</label></div><div class="eyCatalogTop"><input id="eyCatalogSearch" type="search" placeholder="Cerca marca, lente, codice, materiale…"><button id="eyCatalogGo" class="eyBtn" type="button">Cerca nel listino</button></div><div id="eyCatalogSelected"></div><div id="eyCatalogResults" class="eyCatalogResults"><div class="eyCatalogEmpty">Il listino potrà essere caricato qui appena me lo fornisci.</div></div></div>'+
        '<div class="eyStageActions"><button class="eyBtn" data-ey-prev="1" type="button">← Montatura</button><div class="eyStageActionsRight"><button class="eyBtn primary" data-ey-next="3" type="button">Avanti · Trattamenti →</button></div></div></section>'+
        '<section class="eyStage" data-ey-stage="3"><div class="eyStageHead"><div><div class="eyStageTitle">Trattamenti</div><div class="eyStageHint">Seleziona uno o più trattamenti da applicare alla lente.</div></div></div><div class="eyTreatments">'+
          '<label class="eyCheck"><input type="checkbox" data-ey-treatment value="Indurente">Indurente</label>'+
          '<label class="eyCheck"><input type="checkbox" data-ey-treatment value="Antiriflesso">Antiriflesso</label>'+
          '<label class="eyCheck"><input type="checkbox" data-ey-treatment value="Antiriflesso premium">Antiriflesso premium</label>'+
          '<label class="eyCheck"><input type="checkbox" data-ey-treatment value="Filtro luce blu">Filtro luce blu</label>'+
          '<label class="eyCheck"><input type="checkbox" data-ey-treatment value="Idrofobico / oleofobico">Idrofobico / oleofobico</label>'+
          '<label class="eyCheck"><input type="checkbox" data-ey-treatment value="Antigraffio">Antigraffio</label>'+
          '<label class="eyCheck"><input type="checkbox" data-ey-treatment value="UV">Protezione UV</label>'+
          '<label class="eyCheck"><input type="checkbox" data-ey-treatment value="Polarizzato">Polarizzato</label>'+
        '</div><div class="eyStageActions"><button class="eyBtn" data-ey-prev="2" type="button">← Tipo lenti</button><div class="eyStageActionsRight"><button class="eyBtn primary" data-ey-next="4" type="button">Avanti · Colore →</button></div></div></section>'+
        '<section class="eyStage" data-ey-stage="4"><div class="eyStageHead"><div><div class="eyStageTitle">Colore e funzione</div><div class="eyStageHint">Per lenti da sole o fotocromatiche puoi specificare il colore.</div></div></div><div class="eyColorModes">'+
          '<button class="eyColorMode active" data-ey-color="clear" type="button"><b>Trasparente</b><small>Lente non colorata</small></button>'+
          '<button class="eyColorMode" data-ey-color="sun" type="button"><b>Occhiale da sole</b><small>Colore / tinta della lente</small></button>'+
          '<button class="eyColorMode" data-ey-color="photochromic" type="button"><b>Fotocromatico</b><small>Colore di attivazione</small></button>'+
        '</div><div id="eyColorDetails" class="eyGrid2" style="display:none">'+
          '<div class="eyField"><label>Colore lente</label><input id="eyLensColor" placeholder="Es. grigio, marrone, verde…"></div>'+
          '<div class="eyField"><label>Specifiche colore</label><input id="eyLensColorNotes" placeholder="Gradiente, categoria, intensità…"></div>'+
        '</div><div class="eyStageActions"><button class="eyBtn" data-ey-prev="3" type="button">← Trattamenti</button><div class="eyStageActionsRight"><button class="eyBtn primary" data-ey-next="5" type="button">Avanti · Prezzo →</button></div></div></section>'+
        '<section class="eyStage" data-ey-stage="5"><div class="eyStageHead"><div><div class="eyStageTitle">Prezzo e sconto</div><div class="eyStageHint">Lo sconto viene applicato esclusivamente al prezzo delle lenti, non alla montatura.</div></div></div><div class="eyGrid3">'+
          '<div class="eyField"><label class="eyRequired">Prezzo singola lente</label><input id="eyLensPrice" type="number" min="0" step="0.01" inputmode="decimal" placeholder="0,00"></div>'+
          '<div class="eyField"><label>Numero lenti</label><select id="eyLensQty"><option value="2" selected>2 lenti</option><option value="1">1 lente</option></select></div>'+
          '<div class="eyField"><label>Sconto sulle lenti</label><select id="eyDiscount"><option value="0">Nessuno sconto</option><option value="5">5%</option><option value="10">10%</option><option value="15">15%</option><option value="20">20%</option><option value="25">25%</option><option value="30">30%</option><option value="35">35%</option><option value="40">40%</option><option value="50">50%</option></select></div>'+
          '<div class="eyField eyWide"><label>Note documento</label><textarea id="eyNotes" placeholder="Note per preventivo o lavorazione…"></textarea></div>'+
        '</div><div id="eySummary" class="eySummary"></div><div class="eyFinalActions"><button id="eySave" class="eyBtn primary" type="button">Salva Preventivo</button><button id="eyPrint" class="eyBtn" type="button">Stampa riepilogo</button><button id="eyReset" class="eyBtn" type="button">Azzera</button></div><div class="eyStageActions"><button class="eyBtn" data-ey-prev="4" type="button">← Colore</button><span></span></div></section>'+
      '</div></div>'+
      '<div class="eyRecent"><div class="eyRecentTitle">Ultimi documenti occhiali</div><div id="eyRecentList" class="eyRecentList"><div class="eyCatalogEmpty">Nessun documento caricato.</div></div></div>';
    var a=E('lacPanel')||E('clientsPanel')||E('onlineOrdersPanel')||document.querySelector('.panel');
    if(a&&a.parentNode)a.parentNode.insertBefore(p,a.nextSibling);else (E('mainApp')||document.body).appendChild(p);
    bind()
  }

  function bind(){
    E('eyModeQuote').onclick=function(){setMode('quote')};E('eyModeJob').onclick=function(){setMode('job')};
    var steps=document.querySelectorAll('[data-ey-step]');for(var i=0;i<steps.length;i++)steps[i].onclick=function(){goStep(Number(this.getAttribute('data-ey-step')))};
    var next=document.querySelectorAll('[data-ey-next]');for(i=0;i<next.length;i++)next[i].onclick=function(){var n=Number(this.getAttribute('data-ey-next'));if(validateTo(n))goStep(n)};
    var prev=document.querySelectorAll('[data-ey-prev]');for(i=0;i<prev.length;i++)prev[i].onclick=function(){goStep(Number(this.getAttribute('data-ey-prev')))};
    var cm=document.querySelectorAll('[data-ey-color]');for(i=0;i<cm.length;i++)cm[i].onclick=function(){setColor(this.getAttribute('data-ey-color'))};
    E('eyCatalogGo').onclick=searchCatalog;E('eyCatalogSearch').onkeydown=function(ev){if(ev.key==='Enter'){ev.preventDefault();searchCatalog()}};
    E('eyFrameWarehouseGo').onclick=function(){searchFrames(E('eyFrameWarehouseSearch').value||'')};E('eyFrameWarehouseSearch').onkeydown=function(ev){if(ev.key==='Enter'){ev.preventDefault();searchFrames(this.value||'')}};
    E('eyFrameBarcodeGo').onclick=function(){searchFrames(E('eyFrameBarcodeSearch').value||'',true)};E('eyFrameBarcodeSearch').onkeydown=function(ev){if(ev.key==='Enter'){ev.preventDefault();searchFrames(this.value||'',true)}};
    ['eyFramePrice','eyLensPrice','eyLensQty','eyDiscount'].forEach(function(id){E(id).oninput=renderSummary;E(id).onchange=renderSummary});
    E('eySave').onclick=save;E('eyPrint').onclick=printSummary;E('eyReset').onclick=function(){if(confirm('Azzero la scheda occhiali corrente?'))resetForm()};
  }
  function fillClients(preselect){
    var s=E('eyClient');if(!s)return;var a=clientsLocal(),h='<option value="">Cliente non ancora associato</option>';
    a.forEach(function(c){h+='<option value="'+esc(c.id)+'">'+esc(clientLabel(c))+'</option>'});s.innerHTML=h;
    if(preselect&&Array.prototype.some.call(s.options,function(o){return o.value===preselect}))s.value=preselect
  }
  function setMode(mode){
    S.mode=mode==='job'?'job':'quote';
    E('eyModeQuote').classList.toggle('active',S.mode==='quote');E('eyModeJob').classList.toggle('active',S.mode==='job');
    E('eyTitle').textContent=S.mode==='quote'?'Preventivo occhiali':'Busta occhiali';
    E('eySub').textContent=S.mode==='quote'?'Proposta economica separata dalla Busta.':'Scheda definitiva di lavorazione separata dal Preventivo.';
    E('eySave').textContent=S.mode==='quote'?'Salva Preventivo':'Salva Busta';
    E('eyReference').value='';
  }
  function goStep(n){
    S.step=Math.max(1,Math.min(5,n));var st=document.querySelectorAll('[data-ey-stage]'),bs=document.querySelectorAll('[data-ey-step]');
    for(var i=0;i<st.length;i++)st[i].classList.toggle('active',Number(st[i].getAttribute('data-ey-stage'))===S.step);
    for(i=0;i<bs.length;i++){var k=Number(bs[i].getAttribute('data-ey-step'));bs[i].classList.toggle('active',k===S.step);bs[i].classList.toggle('done',k<S.step)}
    if(S.step===5)renderSummary()
  }
  function validateTo(n){
    if(n>=2&&!String(E('eyFrameBrand').value||'').trim()&&!String(E('eyFrameModel').value||'').trim()){toast('Inserisci la montatura prima di continuare.','error');goStep(1);return false}
    if(n>=3&&!String(E('eyLensType').value||'').trim()){toast('Seleziona il tipo di lente.','error');goStep(2);return false}
    return true
  }
  function setColor(mode){
    var bs=document.querySelectorAll('[data-ey-color]');for(var i=0;i<bs.length;i++)bs[i].classList.toggle('active',bs[i].getAttribute('data-ey-color')===mode);
    E('eyColorDetails').style.display=mode==='clear'?'none':'grid';E('eyColorDetails').setAttribute('data-color-mode',mode)
  }
  function colorMode(){var x=document.querySelector('[data-ey-color].active');return x?x.getAttribute('data-ey-color'):'clear'}
  function treatments(){return Array.prototype.slice.call(document.querySelectorAll('[data-ey-treatment]:checked')).map(function(x){return x.value})}
  function num(id){var n=Number(E(id)&&E(id).value||0);return isFinite(n)?Math.round(n*100)/100:0}
  function price(){
    var frame=num('eyFramePrice'),unit=num('eyLensPrice'),qty=Math.max(1,Number(E('eyLensQty').value||2)),discount=Math.max(0,Math.min(100,Number(E('eyDiscount').value||0)));
    var gross=Math.round(unit*qty*100)/100,disc=Math.round(gross*discount)/100,net=Math.round((gross-disc)*100)/100,total=Math.round((frame+net)*100)/100;
    return {frame:frame,unit:unit,qty:qty,gross:gross,discount:discount,disc:disc,net:net,total:total}
  }
  function renderSummary(){
    var p=price(),box=E('eySummary');if(!box)return;
    box.innerHTML='<div class="eySummaryRow"><span>Montatura</span><b>'+esc(euro(p.frame))+'</b></div>'+
      '<div class="eySummaryRow"><span>Lenti · '+p.qty+' × '+esc(euro(p.unit))+'</span><b>'+esc(euro(p.gross))+'</b></div>'+
      (p.discount?'<div class="eySummaryRow discount"><span>Sconto lenti '+p.discount+'%</span><b>− '+esc(euro(p.disc))+'</b></div>':'')+
      '<div class="eySummaryRow"><span>Totale lenti dopo sconto</span><b>'+esc(euro(p.net))+'</b></div>'+
      '<div class="eySummaryRow total"><span>Totale '+(S.mode==='quote'?'preventivo':'busta')+'</span><b>'+esc(euro(p.total))+'</b></div>'
  }
  function frameOptionText(r){var inf=r&&r.infinite_options||{},a=[];var vo=Array.isArray(inf.variant_options)?inf.variant_options:[];vo.forEach(function(x){if(x&&x.value)a.push((x.name?x.name+': ':'')+x.value)});if(!a.length&&r&&r.variant_title&&r.variant_title!=='Default Title')a.push(r.variant_title);return a.join(' · ')}
  function searchFrames(query,barcodeOnly){
    query=String(query||'').trim();var box=E('eyFrameSearchResults');if(!query){box.innerHTML='<div class="eyCatalogEmpty">Inserisci un barcode oppure cerca marca/modello.</div>';return}
    box.innerHTML='<div class="eyCatalogEmpty">Ricerca montatura in magazzino…</div>';
    Promise.all([
      invApi('list',{category:'frames',search:query,page:1,limit:120}),
      invApi('list',{category:'sunglasses',search:query,page:1,limit:120})
    ]).then(function(all){
      var rows=[];all.forEach(function(x){var d=x&&x.data||{},a=Array.isArray(d.rows)?d.rows:[];rows=rows.concat(a)});
      var seen={},uniq=[];rows.forEach(function(r){var k=String(r.id||r.barcode||r.sku||Math.random());if(!seen[k]){seen[k]=1;uniq.push(r)}});
      if(barcodeOnly)uniq=uniq.filter(function(r){return String(r.barcode||'').trim()===query});
      S.frameResults=uniq;renderFrameResults()
    }).catch(function(e){box.innerHTML='<div class="eyCatalogEmpty">Errore ricerca magazzino: '+esc(e.message)+'</div>'})
  }
  function renderFrameResults(){
    var box=E('eyFrameSearchResults');if(!box)return;
    if(!S.frameResults.length){box.innerHTML='<div class="eyCatalogEmpty">Nessuna montatura trovata in magazzino.</div>';return}
    box.innerHTML=S.frameResults.map(function(r,i){var img=r.image_url?'<img src="'+esc(r.image_url)+'" alt="">':'<div class="eyFrameResultNoImg">Nessuna<br>immagine</div>';return '<div class="eyFrameResult" data-ey-frame="'+i+'>'+img+'<div><div class="eyFrameResultName">'+esc([r.vendor,r.title].filter(Boolean).join(' · ')||'Montatura')+'</div><div class="eyFrameResultMeta">'+esc([frameOptionText(r),r.sku?('SKU '+r.sku):'',r.barcode?('Barcode '+r.barcode):'',('Giacenza '+Number(r.inventory_quantity||0))].filter(Boolean).join(' · '))+'</div></div><div class="eyFrameResultPrice">'+esc(euro(r.price))+'</div></div>'}).join('');
    var a=box.querySelectorAll('[data-ey-frame]');for(var i=0;i<a.length;i++)a[i].onclick=function(){selectFrame(Number(this.getAttribute('data-ey-frame')))}
  }
  function selectFrame(i){
    var r=S.frameResults[i];if(!r)return;S.selectedFrame=r;
    E('eyFrameBrand').value=r.vendor||'';
    E('eyFrameModel').value=r.title||'';
    E('eyFrameColor').value=frameOptionText(r)||'';
    E('eyFramePrice').value=Number(r.price||0).toFixed(2);
    E('eyFrameBarcode').value=r.barcode||'';
    E('eyFrameSku').value=r.sku||'';
    E('eyFrameBarcodeSearch').value=r.barcode||'';
    E('eyFrameSelected').innerHTML='<div class="eyFrameSelected"><b>Montatura selezionata dal magazzino:</b> '+esc([r.vendor,r.title,frameOptionText(r)].filter(Boolean).join(' · '))+' · '+esc(euro(r.price))+' · giacenza '+esc(r.inventory_quantity)+'</div>';
    renderSummary()
  }
  function searchCatalog(){
    var box=E('eyCatalogResults');box.innerHTML='<div class="eyCatalogEmpty">Ricerca nel listino…</div>';
    api('lens_catalog',{search:E('eyCatalogSearch').value||'',lens_type:E('eyLensType').value||''}).then(function(x){S.catalog=Array.isArray(x.data)?x.data:[];renderCatalog()}).catch(function(e){box.innerHTML='<div class="eyCatalogEmpty">Errore listino: '+esc(e.message)+'</div>'})
  }
  function renderCatalog(){
    var box=E('eyCatalogResults');if(!S.catalog.length){box.innerHTML='<div class="eyCatalogEmpty">Nessuna lente nel listino. Quando mi caricherai il listino, comparirà qui automaticamente.</div>';return}
    box.innerHTML=S.catalog.map(function(r,i){return '<div class="eyLensRow" data-ey-lens="'+i+'"><div><div class="eyLensName">'+esc([r.brand,r.lens_name].filter(Boolean).join(' · ')||r.code||'Lente')+'</div><div class="eyLensMeta">'+esc([r.lens_type,r.design,r.material,r.refractive_index,r.treatment,r.code].filter(Boolean).join(' · '))+'</div></div><div class="eyLensPrice">'+esc(euro(r.unit_price))+'</div></div>'}).join('');
    var rows=box.querySelectorAll('[data-ey-lens]');for(var i=0;i<rows.length;i++)rows[i].onclick=function(){selectCatalog(Number(this.getAttribute('data-ey-lens')))}
  }
  function selectCatalog(i){
    var r=S.catalog[i];if(!r)return;S.selected=r;
    if(r.lens_type)E('eyLensType').value=r.lens_type;if(r.design)E('eyLensDesign').value=r.design;if(r.material)E('eyLensMaterial').value=r.material;if(r.refractive_index)E('eyLensIndex').value=r.refractive_index;
    E('eyLensBrand').value=r.brand||'';E('eyLensName').value=r.lens_name||'';E('eyLensPrice').value=Number(r.unit_price||0).toFixed(2);
    var tr=String(r.treatment||'').toLowerCase();document.querySelectorAll('[data-ey-treatment]').forEach(function(x){if(tr&&tr.indexOf(String(x.value).toLowerCase())>=0)x.checked=true});
    if(r.photochromic)setColor('photochromic');else if(r.sun)setColor('sun');
    if(r.color_option)E('eyLensColor').value=r.color_option;
    E('eyCatalogSelected').innerHTML='<div class="eySelectedLens"><b>Lente selezionata:</b> '+esc([r.brand,r.lens_name,r.code].filter(Boolean).join(' · '))+' · '+esc(euro(r.unit_price))+'</div>';renderSummary()
  }
  function payload(){
    var p=price(),cm=colorMode();
    return {mode:S.mode,client_id:E('eyClient').value||'',frame:{brand:E('eyFrameBrand').value,model:E('eyFrameModel').value,color:E('eyFrameColor').value,description:E('eyFrameDescription').value,price:p.frame,warehouse_item_id:S.selectedFrame&&S.selectedFrame.id||'',barcode:E('eyFrameBarcode').value||'',sku:E('eyFrameSku').value||'',stock_quantity:S.selectedFrame?Number(S.selectedFrame.inventory_quantity||0):null},lens:{catalog_id:S.selected&&S.selected.id||'',code:S.selected&&S.selected.code||'',supplier:S.selected&&S.selected.supplier||'',brand:E('eyLensBrand').value,lens_name:E('eyLensName').value,lens_type:E('eyLensType').value,design:E('eyLensDesign').value,material:E('eyLensMaterial').value,refractive_index:E('eyLensIndex').value,treatments:treatments(),color_mode:cm,color:cm==='clear'?'':E('eyLensColor').value,polarized:treatments().indexOf('Polarizzato')>=0,photochromic:cm==='photochromic',quantity:p.qty,unit_price:p.unit},discount_percent:p.discount,notes:E('eyNotes').value||''}
  }
  function save(){
    if(S.saving)return;if(!validateTo(5))return;var p=payload();
    if(!(Number(p.lens.unit_price)>=0)){toast('Inserisci il prezzo della lente.','error');return}
    S.saving=true;E('eySave').disabled=true;E('eySave').textContent='Salvataggio…';
    api('save',p).then(function(x){var r=x.data||{};E('eyReference').value=r.reference_code||'';toast((S.mode==='quote'?'Preventivo':'Busta')+' salvato'+(r.reference_code?' · '+r.reference_code:''),'ok');loadRecent();try{if(window.OPTYKER_CLOUD&&E('eyClient').value&&typeof window.cloudLoadSheets==='function')cloudLoadSheets(E('eyClient').value).catch(function(){})}catch(e){}})
      .catch(function(e){toast('Salvataggio non riuscito: '+e.message,'error')}).finally(function(){S.saving=false;E('eySave').disabled=false;E('eySave').textContent=S.mode==='quote'?'Salva Preventivo':'Salva Busta'})
  }
  function resetForm(){
    ['eyFrameBrand','eyFrameModel','eyFrameColor','eyFrameDescription','eyFramePrice','eyFrameBarcode','eyFrameSku','eyFrameBarcodeSearch','eyFrameWarehouseSearch','eyLensDesign','eyLensMaterial','eyLensBrand','eyLensName','eyLensPrice','eyLensColor','eyLensColorNotes','eyNotes','eyCatalogSearch','eyReference'].forEach(function(id){if(E(id))E(id).value=''});
    E('eyLensType').value='';E('eyLensIndex').value='';E('eyLensQty').value='2';E('eyDiscount').value='0';document.querySelectorAll('[data-ey-treatment]').forEach(function(x){x.checked=false});S.selected=null;S.selectedFrame=null;S.frameResults=[];E('eyFrameSelected').innerHTML='';E('eyFrameSearchResults').innerHTML='';E('eyCatalogSelected').innerHTML='';E('eyCatalogResults').innerHTML='<div class="eyCatalogEmpty">Il listino potrà essere caricato qui appena me lo fornisci.</div>';setColor('clear');goStep(1);renderSummary()
  }
  function printSummary(){
    if(!validateTo(5))return;var p=payload(),pr=price(),client=E('eyClient').selectedOptions&&E('eyClient').selectedOptions[0]?E('eyClient').selectedOptions[0].textContent:'',ref=E('eyReference').value||'';
    var w=window.open('','_blank','width=900,height=760');if(!w){toast('Il browser ha bloccato la finestra di stampa.','error');return}
    var title=S.mode==='quote'?'PREVENTIVO OCCHIALI':'BUSTA OCCHIALI';
    var html='<!doctype html><html><head><meta charset="utf-8"><title>'+esc(title)+'</title><style>body{font-family:Arial,sans-serif;color:#17334b;padding:34px}h1{font-size:24px}h2{font-size:15px;margin-top:24px;border-bottom:1px solid #ccd8e1;padding-bottom:6px}.row{display:flex;justify-content:space-between;gap:16px;padding:6px 0;font-size:12px}.tot{font-size:17px;font-weight:bold;border-top:2px solid #17334b;margin-top:8px;padding-top:10px}.muted{color:#718493;font-size:10px}.box{border:1px solid #d7e2ea;border-radius:10px;padding:14px;margin-top:10px}@media print{button{display:none}}</style></head><body><div class="muted">OPTYKER · OTTICA VISUAL CARE</div><h1>'+title+'</h1><div class="muted">'+esc(ref)+(client?' · '+esc(client):'')+'</div><h2>Montatura</h2><div class="box"><div class="row"><span>'+esc([p.frame.brand,p.frame.model,p.frame.color,p.frame.barcode?('Barcode '+p.frame.barcode):''].filter(Boolean).join(' · '))+'</span><b>'+esc(euro(pr.frame))+'</b></div></div><h2>Lenti</h2><div class="box"><div class="row"><span>'+esc([p.lens.lens_type,p.lens.brand,p.lens.lens_name,p.lens.refractive_index].filter(Boolean).join(' · '))+'</span><b>'+esc(euro(pr.gross))+'</b></div><div class="row"><span>Trattamenti</span><span>'+esc(p.lens.treatments.join(', ')||'—')+'</span></div><div class="row"><span>Colore</span><span>'+esc(p.lens.color_mode==='clear'?'Trasparente':(p.lens.color||p.lens.color_mode))+'</span></div>'+(pr.discount?'<div class="row"><span>Sconto lenti '+pr.discount+'%</span><b>− '+esc(euro(pr.disc))+'</b></div>':'')+'</div><div class="row tot"><span>Totale</span><span>'+esc(euro(pr.total))+'</span></div>'+(p.notes?'<h2>Note</h2><div class="box">'+esc(p.notes)+'</div>':'')+'<script>window.onload=function(){window.print()}<\/script></body></html>';
    w.document.open();w.document.write(html);w.document.close()
  }
  function loadRecent(){
    api('recent',{client_id:E('eyClient')?E('eyClient').value:''}).then(function(x){S.recent=Array.isArray(x.data)?x.data:[];renderRecent()}).catch(function(){})
  }
  function renderRecent(){
    var b=E('eyRecentList');if(!b)return;if(!S.recent.length){b.innerHTML='<div class="eyCatalogEmpty">Nessun documento occhiali registrato.</div>';return}
    b.innerHTML=S.recent.slice(0,15).map(function(r){var d=r.data||{},pr=d.pricing||{},fr=d.frame||{},l=d.lens||{};return '<div class="eyRecentRow"><div class="eyRecentType">'+esc(r.document_type||'Scheda')+'</div><div><div class="eyRecentMain">'+esc(r.reference_code||r.title||'Documento')+' · '+esc([fr.brand,fr.model,l.lens_type].filter(Boolean).join(' · '))+'</div><div class="eyRecentMeta">'+esc(new Date(r.created_at).toLocaleDateString('it-IT'))+' · '+esc(r.operator||'')+'</div></div><div class="eyRecentTotal">'+esc(euro(pr.total||0))+'</div></div>'}).join('')
  }
  function hideOther(){
    var ids=['dashboardPanel','analysisPanel','prescriptionPanel','visualExamPanel','indicationsPanel','hearingPanel','clientsPanel','lacPanel','onlineOrdersPanel','labOrdersPanel','optykerDdtPanel','optykerCustomerInvoicesPanel'];
    ids.forEach(function(id){var x=E(id);if(x)x.style.display='none'});var r=E('reportSectionTop');if(r)r.style.display='none';var t=E('analysisTabs');if(t)t.style.display='none'
  }
  function openEyewear(mode,clientId){
    ensurePanel();hideOther();setMode(mode||'quote');fillClients(clientId||String(window.clientCurrentId||''));var p=E('eyewearPanel');if(p)p.style.display='block';goStep(1);renderSummary();loadRecent();
    var db=E('dashboardEyewearBtn');if(db)db.classList.add('active');try{window.scrollTo(0,0)}catch(e){}
  }
  window.openEyewearSheet=openEyewear;
  function hideEyewear(){var p=E('eyewearPanel');if(p)p.style.display='none';var n=E('dashboardEyewearBtn');if(n)n.classList.remove('active')}
  document.addEventListener('click',function(ev){var b=ev.target&&ev.target.closest?ev.target.closest('#moduleNav button'):null;if(b)hideEyewear()},true);
  function install(){ensurePanel();ensureDashboardButton()}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
  setInterval(install,900);
})();
</script>
'''

pos=s.lower().rfind("</body>")
if pos<0:
    raise SystemExit("Tag </body> non trovato")
s=s[:pos]+css+js+s[pos:]
p.write_text(s,encoding="utf-8")
for req in [MARK,'dashboardEyewearBtn','Preventivo occhiali','Busta occhiali','optyker-eyewear-api','Cerca nel listino lenti oftalmiche','Sconto sulle lenti']:
    if req not in s:
        raise SystemExit("Patch occhiali incompleta: "+req)
print("Optyker eyewear sheet OK")

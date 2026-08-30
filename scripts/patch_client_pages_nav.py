from pathlib import Path

p=Path("_site/index.html")
s=p.read_text(encoding="utf-8")
MARK="OPTYKER_CLIENT_PAGES_NAV_V1"
if MARK in s:
    raise SystemExit(0)

css=r'''
<style id="optykerClientPagesNavCss">
/* OPTYKER_CLIENT_PAGES_NAV_V1 */
.clientPageNav{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:7px;margin:14px 0 16px;padding:7px;border:1px solid #d8e2ea;border-radius:12px;background:#f4f8fb;box-shadow:0 2px 8px rgba(23,50,74,.035)}
.clientPageNavBtn{appearance:none;border:1px solid transparent;border-radius:9px;background:transparent;color:#496174;min-height:43px;padding:9px 8px;font-size:10px;font-weight:900;cursor:pointer;transition:.14s ease;text-align:center}
.clientPageNavBtn:hover{background:#fff;border-color:#dce5ec;color:#173e69}
.clientPageNavBtn.active{background:#1769aa;border-color:#1769aa;color:#fff;box-shadow:0 5px 14px rgba(23,105,170,.16)}
.clientPageNavBtn .clientPageNavCount{display:inline-flex;align-items:center;justify-content:center;min-width:18px;height:18px;margin-left:4px;padding:0 5px;border-radius:999px;background:rgba(255,255,255,.17);font-size:8px}
.clientPageIntro{display:none;align-items:flex-start;justify-content:space-between;gap:12px;padding:12px 2px 10px;border-bottom:1px solid #e2e9ef;margin-bottom:12px}
.clientPageIntro.visible{display:flex}
.clientPageIntroKicker{font-size:8px;font-weight:950;letter-spacing:.1em;color:#1769aa;text-transform:uppercase}
.clientPageIntroTitle{font-size:20px;font-weight:950;color:#17364f;margin-top:2px}
.clientPageIntroSub{font-size:10px;color:#718493;margin-top:3px;line-height:1.45}
.clientPageIntroActions{display:flex;gap:8px;flex-wrap:wrap}
.clientPageIntroActions button{white-space:nowrap}
#clientLacPageExtras{display:none;grid-column:1/-1;margin-top:12px}
#clientLacPageExtras.visible{display:block}
#clientLacMovedContent{display:grid;gap:12px}
#clientRecordNavWrap.clientSecondaryNav{margin:0 0 14px;border:0;border-radius:0;background:transparent;box-shadow:none;overflow:visible}
#clientRecordNavWrap.clientSecondaryNav .clientRecordTabs{padding:0 0 9px;background:transparent;border-bottom:1px solid #e1e8ee;gap:7px}
#clientRecordNavWrap.clientSecondaryNav .clientRecordTab{background:#fff;border:1px solid #d5e0e8;border-radius:9px;min-height:36px;padding:8px 12px;font-size:10px}
#clientRecordNavWrap.clientSecondaryNav .clientRecordTab.active{background:#eaf4fb;border-color:#a9cbe3;color:#1769aa;box-shadow:none}
#clientRecordNavWrap.clientSecondaryNav .clientRecordTab.active:after{display:none}
#clientRecordNavWrap.clientSecondaryNav .clientRecordDates{padding:9px 0;background:transparent}
#clientRecordNavWrap.clientSecondaryNav .clientRecordTab.clientMacroHidden{display:none!important}

/* Anagrafica più simile a una pagina, meno a una collezione di card. */
#clientAnagraficaSection.clientIdentityPremium{border:0!important;box-shadow:none!important;background:transparent!important;padding:0!important}
#clientAnagraficaSection .clientIdentityHeader{padding:6px 0 15px!important;border-bottom:1px solid #dfe7ed!important;margin-bottom:2px!important;background:transparent!important}
#clientAnagraficaSection .clientProfileSections{display:block!important;background:transparent!important}
#clientAnagraficaSection .clientProfileCard{border:0!important;border-bottom:1px solid #e2e9ef!important;border-radius:0!important;background:transparent!important;box-shadow:none!important;padding:18px 2px!important;margin:0!important}
#clientAnagraficaSection .clientProfileCard:last-child{border-bottom:0!important}
#clientAnagraficaSection .clientProfileCardHead{margin-bottom:12px!important}
#clientAnagraficaSection .clientProfileIcon{background:#eaf4fb!important;border-radius:7px!important;color:#1769aa!important}
#clientAnagraficaSection .clientProfileField input,
#clientAnagraficaSection .clientProfileField textarea,
#clientAnagraficaSection .clientProfileField select{background:#fff!important;border-color:#d5e0e8!important;border-radius:8px!important}
#clientInformativeSection.clientPageStandalone,
#clientOnlineOrdersSection.clientPageStandalone,
#clientChatSection.clientPageStandalone,
#clientSheetsSection.clientPageStandalone{grid-column:1/-1!important;border:0!important;box-shadow:none!important;background:transparent!important;padding:0!important}
.clientNewSheetDock.clientPageDockHidden{display:none!important}.clientMainSheetDates{display:none;margin:0 0 16px;padding:14px 15px;border:1px solid #dce5ec;border-radius:12px;background:#f8fbfd}.clientMainSheetDates.visible{display:block}.clientMainSheetDatesHead{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:11px}.clientMainSheetDatesTitle{font-size:12px;font-weight:950;color:#24465f}.clientMainSheetDatesHint{font-size:9px;color:#738594;margin-top:2px}.clientMainSheetGroups{display:grid;gap:10px}.clientMainSheetGroup{display:grid;grid-template-columns:minmax(145px,210px) 1fr;gap:12px;align-items:start;padding:10px 0;border-top:1px solid #e5ebf0}.clientMainSheetGroup:first-child{border-top:0;padding-top:0}.clientMainSheetType{font-size:10px;font-weight:950;color:#274b66;padding-top:7px}.clientMainSheetTypeCount{display:inline-flex;align-items:center;justify-content:center;min-width:19px;height:19px;margin-left:5px;padding:0 5px;border-radius:999px;background:#eaf4fb;color:#1769aa;font-size:8px}.clientMainSheetDateList{display:flex;gap:7px;flex-wrap:wrap}.clientMainSheetDateBtn{border:1px solid #cfdce6;background:#fff;color:#31516a;border-radius:8px;padding:7px 10px;min-height:32px;font-size:9px;font-weight:900;cursor:pointer}.clientMainSheetDateBtn:hover{border-color:#8fb9d8;background:#f2f8fc;color:#1769aa}.clientMainSheetDateBtn.active{background:#1769aa;border-color:#1769aa;color:#fff}.clientMainSheetEmpty{padding:12px 0;color:#7a8b98;font-size:10px}
@media(max-width:900px){.clientPageNav{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media(max-width:560px){.clientMainSheetGroup{grid-template-columns:1fr;gap:5px}.clientPageNav{grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}.clientPageNavBtn{min-height:40px}.clientPageIntro{flex-direction:column}.clientPageIntroActions{width:100%}.clientPageIntroActions button{flex:1}}
</style>
'''

js=r'''
<script id="optykerClientPagesNavJs">
(function(){/* OPTYKER_CLIENT_PAGES_NAV_V1 */
  if(window.__optykerClientPagesNavV1)return;window.__optykerClientPagesNavV1=true;
  var page='anagrafica',busy=false,lastClient='',installed=false;
  var nativeSelect=typeof window.clientSelectWorkspaceSection==='function'?window.clientSelectWorkspaceSection:null;

  function E(id){return document.getElementById(id)}
  function text(v){return String(v==null?'':v)}
  function pageForType(type){
    type=text(type);
    if(type==='anagrafica')return 'anagrafica';
    if(type==='onlineorders')return 'ordini';
    if(type==='chat')return 'chat';
    if(type==='lac')return 'lac';
    return 'schede';
  }
  function selectedClient(){return text(window.clientCurrentId||'')}
  function sheetRows(){
    try{
      var cloud=window.OPTYKER_CLOUD||{},all=cloud.sheets&&cloud.sheets[selectedClient()];
      return Array.isArray(all)?all:[];
    }catch(e){return []}
  }
  function countType(type){
    if(type==='ordini'){
      var map=window.OPTYKER_CLIENT_ONLINE_ORDER_COUNTS||{};
      return Number(map[selectedClient()]||0)||0;
    }
    if(type==='lac'){
      return sheetRows().filter(function(r){var t=(r.sheet_type||(r.data&&r.data.sheetType)||'');return t==='lac'}).length;
    }
    if(type==='schede'){
      return sheetRows().filter(function(r){var t=(r.sheet_type||(r.data&&r.data.sheetType)||'');return t&&t!=='lac'}).length;
    }
    return 0;
  }
  function firstGeneralSheetType(){
    var cur=text(window.clientWorkspaceSection||'');
    if(cur&&['anagrafica','onlineorders','chat','lac'].indexOf(cur)<0)return cur;
    var tabs=E('clientRecordTabs'),btns=tabs?tabs.querySelectorAll('.clientRecordTab'):[];
    for(var i=0;i<btns.length;i++){
      var oc=text(btns[i].getAttribute('onclick')||''),m=oc.match(/clientSelectWorkspaceSection\(['"]([^'"]+)/);
      var t=m&&m[1]||'';
      if(t&&['anagrafica','onlineorders','chat','lac'].indexOf(t)<0)return t;
    }
    var rows=sheetRows();
    for(var j=0;j<rows.length;j++){
      var rt=text(rows[j].sheet_type||(rows[j].data&&rows[j].data.sheetType)||'');
      if(rt&&rt!=='lac')return rt;
    }
    return 'prescription';
  }
  function ensureNav(){
    var wrap=E('clientRecordNavWrap');if(!wrap)return null;
    var nav=E('clientPageNav');
    if(!nav){
      nav=document.createElement('div');nav.id='clientPageNav';nav.className='clientPageNav';
      nav.innerHTML=
        '<button class="clientPageNavBtn" data-client-page="anagrafica" type="button">Anagrafica</button>'+
        '<button class="clientPageNavBtn" data-client-page="schede" type="button">Schede <span id="clientPageCountSheets" class="clientPageNavCount"></span></button>'+
        '<button class="clientPageNavBtn" data-client-page="lac" type="button">LAC <span id="clientPageCountLac" class="clientPageNavCount"></span></button>'+
        '<button class="clientPageNavBtn" data-client-page="ordini" type="button">Ordini <span id="clientPageCountOrders" class="clientPageNavCount"></span></button>'+
        '<button class="clientPageNavBtn" data-client-page="chat" type="button">Chat</button>'+
        '<button class="clientPageNavBtn" data-client-page="documenti" type="button">Documenti</button>';
      wrap.parentNode.insertBefore(nav,wrap);
      Array.prototype.forEach.call(nav.querySelectorAll('[data-client-page]'),function(b){
        b.onclick=function(){window.optykerClientOpenPage(b.getAttribute('data-client-page'))};
      });
    }
    var intro=E('clientPageIntro');
    if(!intro){
      intro=document.createElement('div');intro.id='clientPageIntro';intro.className='clientPageIntro';
      intro.innerHTML='<div><div class="clientPageIntroKicker">Scheda cliente</div><div id="clientPageIntroTitle" class="clientPageIntroTitle"></div><div id="clientPageIntroSub" class="clientPageIntroSub"></div></div><div id="clientPageIntroActions" class="clientPageIntroActions"></div>';
      nav.parentNode.insertBefore(intro,nav.nextSibling);
    }
    var dated=E('clientMainSheetDates');
    if(!dated){
      dated=document.createElement('section');dated.id='clientMainSheetDates';dated.className='clientMainSheetDates';
      dated.innerHTML='<div class="clientMainSheetDatesHead"><div><div class="clientMainSheetDatesTitle">Archivio schede per data</div><div class="clientMainSheetDatesHint">Seleziona una data per aprire direttamente la scheda corrispondente.</div></div></div><div id="clientMainSheetGroups" class="clientMainSheetGroups"></div>';
      intro.parentNode.insertBefore(dated,intro.nextSibling);
    }
    ensureLacExtras();
    return nav;
  }
  function ensureLacExtras(){
    var grid=document.querySelector('.clientWorkspaceGrid');if(!grid)return;
    var sec=E('clientLacPageExtras');
    if(!sec){
      sec=document.createElement('section');sec.id='clientLacPageExtras';
      sec.innerHTML='<div id="clientLacMovedContent"></div>';
      grid.appendChild(sec);
    }
    var holder=E('clientLacMovedContent');if(!holder)return;
    var specialist=E('clientSpecialistList'),ana=E('clientAnagraficaSection');
    if(specialist&&ana&&ana.contains(specialist)){
      var n=specialist;
      while(n&&n.parentElement&&n.parentElement!==ana)n=n.parentElement;
      if(n&&n.parentElement===ana&&n!==ana)holder.appendChild(n);
    }
    var warranty=E('clientLacWarrantyPanel');
    if(warranty&&warranty.parentElement!==holder&&!holder.contains(warranty))holder.appendChild(warranty);
  }
  function rowType(row){return text(row&&((row.sheet_type)||(row.data&&row.data.sheetType))||'visit')}
  function typeLabel(type){
    try{if(typeof window.clientWorkspaceTypeLabel==='function')return text(clientWorkspaceTypeLabel(type)||type)}catch(e){}
    var map={analysis:'Analisi visiva',prescription:'Prescrizione',visualexam:'Esame visivo',indications:"Indicazioni d'uso",hearing:'Udito',visit:'Visita completa'};
    return map[type]||type;
  }
  function rowDateValue(row){
    var d=row&&row.data||{};
    return d.examDate||d.savedAt||row.created_at||row.updated_at||'';
  }
  function rowDateLabel(row){
    try{if(typeof window.clientSheetDateOnly==='function')return text(clientSheetDateOnly(row))}catch(e){}
    var v=rowDateValue(row);if(!v)return 'Senza data';
    if(/^\d{2}\/\d{2}\/\d{4}$/.test(text(v)))return text(v);
    try{return new Date(v).toLocaleDateString('it-IT',{day:'2-digit',month:'2-digit',year:'numeric'})}catch(e){return text(v)}
  }
  function rowSortValue(row){
    var v=rowDateValue(row);
    if(/^\d{2}\/\d{2}\/\d{4}$/.test(text(v))){var p=text(v).split('/');return new Date(Number(p[2]),Number(p[1])-1,Number(p[0])).getTime()}
    var n=Date.parse(v);return isNaN(n)?0:n;
  }
  var mainDatesSignature='';
  function renderMainSheetDates(){
    var box=E('clientMainSheetDates'),holder=E('clientMainSheetGroups');if(!box||!holder)return;
    box.classList.toggle('visible',page==='schede');
    if(page!=='schede')return;
    var rows=sheetRows().filter(function(r){var t=rowType(r);return t&&t!=='lac'});
    rows.sort(function(a,b){return rowSortValue(b)-rowSortValue(a)});
    var groups={},order=[];
    for(var i=0;i<rows.length;i++){
      var t=rowType(rows[i]);if(!groups[t]){groups[t]=[];order.push(t)}groups[t].push(rows[i]);
    }
    var sig=order.map(function(t){return t+':'+groups[t].map(function(r){return text(r.id)+'@'+rowDateLabel(r)}).join(',')}).join('|')+'#'+text(window.clientWorkspaceSheetId||'');
    if(sig===mainDatesSignature)return;mainDatesSignature=sig;
    if(!rows.length){holder.innerHTML='<div class="clientMainSheetEmpty">Nessuna scheda salvata per questo cliente.</div>';return}
    holder.innerHTML=order.map(function(t){
      var a=groups[t];
      return '<div class="clientMainSheetGroup"><div class="clientMainSheetType">'+text(typeLabel(t))+' <span class="clientMainSheetTypeCount">'+a.length+'</span></div><div class="clientMainSheetDateList">'+a.map(function(r){
        var active=text(window.clientWorkspaceSheetId||'')===text(r.id);
        return '<button type="button" class="clientMainSheetDateBtn'+(active?' active':'')+'" data-main-sheet-type="'+text(t).replace(/"/g,'&quot;')+'" data-main-sheet-id="'+text(r.id).replace(/"/g,'&quot;')+'">'+text(rowDateLabel(r))+'</button>';
      }).join('')+'</div></div>';
    }).join('');
    Array.prototype.forEach.call(holder.querySelectorAll('[data-main-sheet-id]'),function(b){
      b.onclick=function(){window.optykerOpenClientSheetByDate(b.getAttribute('data-main-sheet-type'),b.getAttribute('data-main-sheet-id'))};
    });
  }
  window.optykerOpenClientSheetByDate=function(type,id){
    if(!selectedClient())return;
    page='schede';
    window.clientWorkspaceSection=type;window.clientWorkspaceSheetId=id;
    nativeOpen(type);
    try{if(typeof window.clientSelectWorkspaceDate==='function')clientSelectWorkspaceDate(id)}catch(e){}
    try{if(typeof window.clientRenderFocusedSheet==='function')clientRenderFocusedSheet()}catch(e){}
    setTimeout(function(){mainDatesSignature='';apply();try{window.scrollTo({top:E('clientSheetsSection')?E('clientSheetsSection').offsetTop-100:0,behavior:'smooth'})}catch(e){}},0);
  };

  function setIntro(){
    var title=E('clientPageIntroTitle'),sub=E('clientPageIntroSub'),act=E('clientPageIntroActions'),intro=E('clientPageIntro');
    if(!title||!sub||!act||!intro)return;
    var data={
      anagrafica:['Anagrafica','Dati personali, contatti e informazioni fiscali del cliente.'],
      schede:['Schede','Prescrizioni, esami e schede cliniche salvate sul cliente.'],
      lac:['Lenti a contatto','Schede LAC, lenti acquistate, garanzie e riordini del cliente.'],
      ordini:['Ordini','Ordini online collegati direttamente a questo cliente.'],
      chat:['Chat','Conversazione diretta con il cliente.'],
      documenti:['Documenti','Informative privacy, consensi e documenti firmati del cliente.']
    }[page]||['Scheda cliente',''];
    title.textContent=data[0];sub.textContent=data[1];act.innerHTML='';
    if(page==='lac'){
      var b=document.createElement('button');b.type='button';b.className='primary';b.textContent='+ Nuova scheda LAC';b.onclick=function(){if(window.clientCreateNewLacSheet)clientCreateNewLacSheet();else if(window.openLacDevice)openLacDevice()};act.appendChild(b);
    }else if(page==='schede'){
      var b2=document.createElement('button');b2.type='button';b2.className='primary';b2.textContent='+ Crea scheda';b2.onclick=function(){if(window.clientToggleNewSheetMenu)clientToggleNewSheetMenu()};act.appendChild(b2);
    }else if(page==='ordini'){
      var b3=document.createElement('button');b3.type='button';b3.className='secondary';b3.textContent='Gestione ordini';b3.onclick=function(){if(window.openOnlineOrders)openOnlineOrders()};act.appendChild(b3);
    }
    intro.classList.add('visible');
  }
  function filterSecondaryTabs(){
    var wrap=E('clientRecordNavWrap'),tabs=E('clientRecordTabs');if(!wrap||!tabs)return;
    wrap.classList.add('clientSecondaryNav');
    var btns=tabs.querySelectorAll('.clientRecordTab');
    Array.prototype.forEach.call(btns,function(b){
      var oc=text(b.getAttribute('onclick')||''),m=oc.match(/clientSelectWorkspaceSection\(['"]([^'"]+)/),t=m&&m[1]||'';
      var hide=true;
      if(page==='schede')hide=!t||['anagrafica','onlineorders','chat','lac'].indexOf(t)>=0;
      else if(page==='lac')hide=t!=='lac';
      b.classList.toggle('clientMacroHidden',hide);
    });
  }
  function updateCounts(){
    var a=E('clientPageCountSheets'),b=E('clientPageCountLac'),c=E('clientPageCountOrders');
    if(a){var n=countType('schede');a.textContent=n||'';a.style.display=n?'inline-flex':'none'}
    if(b){var l=countType('lac');b.textContent=l||'';b.style.display=l?'inline-flex':'none'}
    if(c){var o=countType('ordini');c.textContent=o||'';c.style.display=o?'inline-flex':'none'}
  }
  function apply(){
    ensureNav();ensureLacExtras();
    var ana=E('clientAnagraficaSection'),sheets=E('clientSheetsSection'),info=E('clientInformativeSection'),orders=E('clientOnlineOrdersSection'),chat=E('clientChatSection'),lac=E('clientLacPageExtras'),wrap=E('clientRecordNavWrap'),dock=document.querySelector('.clientNewSheetDock');
    if(ana)ana.style.display=page==='anagrafica'?'block':'none';
    if(sheets){sheets.style.display=(page==='schede'||page==='lac')?'block':'none';sheets.classList.add('clientPageStandalone')}
    if(info){info.style.display=page==='documenti'?'block':'none';info.classList.add('clientPageStandalone')}
    if(orders){orders.style.display=page==='ordini'?'block':'none';orders.classList.add('clientPageStandalone')}
    if(chat){chat.style.display=page==='chat'?'block':'none';chat.classList.add('clientPageStandalone')}
    if(lac)lac.classList.toggle('visible',page==='lac');
    if(wrap)wrap.style.display=(page==='schede'||page==='lac')?'block':'none';
    if(dock)dock.classList.toggle('clientPageDockHidden',page!=='schede');
    filterSecondaryTabs();setIntro();updateCounts();renderMainSheetDates();
    var nav=E('clientPageNav');
    if(nav)Array.prototype.forEach.call(nav.querySelectorAll('[data-client-page]'),function(b){b.classList.toggle('active',b.getAttribute('data-client-page')===page)});
  }
  function nativeOpen(type){
    if(!nativeSelect)return;
    busy=true;
    try{nativeSelect.call(window,type)}finally{busy=false}
  }
  window.optykerClientOpenPage=function(next){
    if(!selectedClient()&&next!=='anagrafica'){alert('Seleziona prima un cliente.');return}
    page=next||'anagrafica';
    if(page==='anagrafica')nativeOpen('anagrafica');
    else if(page==='documenti')nativeOpen('anagrafica');
    else if(page==='ordini')nativeOpen('onlineorders');
    else if(page==='chat')nativeOpen('chat');
    else if(page==='lac')nativeOpen('lac');
    else if(page==='schede')nativeOpen(firstGeneralSheetType());
    if(page==='documenti'&&typeof window.clientRenderInformativeDocs==='function')try{clientRenderInformativeDocs(true)}catch(e){}
    if(page==='lac'&&typeof window.clientRefreshCommerce==='function')try{clientRefreshCommerce()}catch(e){}
    if(page==='chat'&&typeof window.clientClientChatOpen==='function')try{clientClientChatOpen()}catch(e){}
    setTimeout(apply,0);
  };

  if(nativeSelect){
    window.clientSelectWorkspaceSection=function(type){
      var r=nativeSelect.apply(this,arguments);
      if(!busy){page=pageForType(type);setTimeout(apply,0)}
      return r;
    };
  }
  if(typeof window.clientSelect==='function'){
    var oldClientSelect=window.clientSelect;
    window.clientSelect=function(id){
      page='anagrafica';lastClient=text(id||'');mainDatesSignature='';
      var r=oldClientSelect.apply(this,arguments);
      setTimeout(function(){apply();if(selectedClient()&&typeof window.clientRefreshCommerce==='function')try{clientRefreshCommerce()}catch(e){}},40);
      return r;
    };
  }
  if(typeof window.clientNew==='function'){
    var oldClientNew=window.clientNew;
    window.clientNew=function(){page='anagrafica';lastClient='';mainDatesSignature='';var r=oldClientNew.apply(this,arguments);setTimeout(apply,0);return r};
  }

  function tick(){
    var id=selectedClient();
    if(id!==lastClient){lastClient=id;if(id)page='anagrafica'}
    ensureNav();ensureLacExtras();apply();
  }
  function boot(){installed=true;tick();setInterval(tick,1200)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
</script>
'''

pos=s.lower().rfind("</body>")
if pos<0:
    raise SystemExit("Tag </body> finale non trovato")
s=s[:pos]+css+js+s[pos:]

for req in [MARK,"Anagrafica","Schede","Lenti a contatto","Documenti","clientPageNav","clientLacPageExtras"]:
    if req not in s:
        raise SystemExit("Patch pagine cliente incompleta: "+req)

p.write_text(s,encoding="utf-8")
print("Client pages navigation OK")

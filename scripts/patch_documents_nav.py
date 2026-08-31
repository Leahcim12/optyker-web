from pathlib import Path

p=Path("_site/index.html")
s=p.read_text(encoding="utf-8")
MARK="OPTYKER_DOCUMENTS_NAV_V1"
if MARK in s:
    raise SystemExit(0)

css=r'''
<style id="optykerDocumentsCss">
/* OPTYKER_DOCUMENTS_NAV_V1 */
#navDocumentsGroup{order:62!important;display:flex;flex-direction:column;gap:3px;flex:0 0 auto!important}
#navDocuments{min-height:46px!important;height:auto!important;padding-top:10px!important;padding-bottom:10px!important}
#navDocumentsSub{display:none;flex-direction:column;gap:3px;padding:2px 0 5px 13px}
#navDocumentsGroup.open #navDocumentsSub{display:flex}
#navDocumentsSub button{
  min-height:34px;border:0;border-left:2px solid #d9e5ee;border-radius:0 7px 7px 0;background:transparent;
  color:#536b7f;text-align:left;padding:0 10px;font:800 10px/1.2 "Segoe UI",Arial,sans-serif;cursor:pointer
}
#navDocumentsSub button:hover{background:#eef5fa;color:#1769aa;border-left-color:#8bbbdc}
#navDocumentsSub button.active{background:#e8f3fb;color:#1769aa;border-left-color:#1769aa}
body.optykerBillingMode #navDocumentsGroup{display:none!important}

.optykerDocsPanel{display:none;grid-column:2!important;min-width:0;padding:18px;border:1px solid #d8e3eb;border-radius:14px;background:#f8fbfd;box-shadow:0 4px 18px rgba(23,50,74,.04)}
.optykerDocsHead{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;padding-bottom:14px;border-bottom:1px solid #dce5ec;margin-bottom:14px}
.optykerDocsEyebrow{font-size:9px;font-weight:950;letter-spacing:.09em;text-transform:uppercase;color:#1769aa}
.optykerDocsTitle{font-size:24px;font-weight:950;color:#17324a;margin-top:3px}
.optykerDocsSub{font-size:10px;color:#6d8090;margin-top:4px;line-height:1.45}
.optykerDocsToolbar{display:grid;grid-template-columns:minmax(220px,1fr) 130px 150px auto;gap:8px;margin-bottom:12px}
.optykerDocsToolbar input,.optykerDocsToolbar select{
  height:36px;border:1px solid #ccd9e3;border-radius:8px;background:#fff;color:#2b465d;padding:0 9px;font-size:10px;font-weight:750;outline:none
}
.optykerDocsToolbar input:focus,.optykerDocsToolbar select:focus{border-color:#1769aa;box-shadow:0 0 0 2px rgba(23,105,170,.1)}
.optykerDocsToolbar button,.optykerDocsRefresh{
  min-height:36px;border:1px solid #cbd9e3;border-radius:8px;background:#fff;color:#1769aa;padding:0 11px;font-size:9px;font-weight:900;cursor:pointer
}
.optykerDocsToolbar button:hover,.optykerDocsRefresh:hover{background:#eef7fd}
.optykerDocsTableWrap{border:1px solid #dce5ec;border-radius:11px;background:#fff;overflow:auto}
.optykerDocsTable{width:100%;border-collapse:collapse;min-width:800px}
.optykerDocsTable th{background:#f6f9fb;border-bottom:1px solid #dce5ec;padding:9px 10px;text-align:left;font-size:8px;font-weight:950;letter-spacing:.06em;text-transform:uppercase;color:#718494}
.optykerDocsTable td{border-bottom:1px solid #edf2f5;padding:10px;font-size:10px;color:#304b62;vertical-align:top}
.optykerDocsTable tr:last-child td{border-bottom:0}
.optykerDocsMain{font-weight:900;color:#203d55}
.optykerDocsMeta{font-size:8px;color:#7a8c9b;margin-top:2px}
.optykerDocsMoney{font-weight:950;color:#17334b;white-space:nowrap}
.optykerDocsStatus{display:inline-flex;align-items:center;padding:4px 7px;border-radius:999px;background:#eef2f5;color:#586e80;font-size:8px;font-weight:900;text-transform:uppercase}
.optykerDocsStatus.ok{background:#eaf7ee;color:#2d7542}
.optykerDocsStatus.warn{background:#fff6e8;color:#8b5e08}
.optykerDocsStatus.error{background:#fff0f0;color:#a53737}
.optykerDocsEmpty{padding:30px 16px;text-align:center;color:#748797;font-size:10px}
.optykerDocsLoading{padding:30px 16px;text-align:center;color:#1769aa;font-size:10px;font-weight:850}
@media(max-width:900px){.optykerDocsToolbar{grid-template-columns:1fr 1fr}.optykerDocsPanel{grid-column:1!important}}
@media(max-width:620px){.optykerDocsToolbar{grid-template-columns:1fr}.optykerDocsHead{flex-direction:column}}
</style>
'''

js=r'''
<script id="optykerDocumentsJs">
(function(){/* OPTYKER_DOCUMENTS_NAV_V1 */
  if(window.__optykerDocumentsV1)return;window.__optykerDocumentsV1=true;
  var API='https://whgziwaegjzqsgcntesr.supabase.co/functions/v1/optyker-documents-api';
  var S={mode:'',rows:[]};
  function E(id){return document.getElementById(id)}
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
  function creds(){var c=window.OPTYKER_CLOUD||{};return {username:String(c.username||window.OPTYKER_ACTIVE_USER||'').trim(),password:String(c.password||'')}}
  function api(action,payload){var c=creds();if(!c.username||!c.password)return Promise.reject(new Error('Sessione operatore non disponibile.'));return fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:action,username:c.username,password:c.password,payload:payload||{}})}).then(function(r){return r.json().catch(function(){return {}}).then(function(x){if(!r.ok||!x||x.ok===false)throw new Error(x&&x.error||('HTTP '+r.status));return x})})}
  function euro(v,c){try{return new Intl.NumberFormat('it-IT',{style:'currency',currency:c||'EUR'}).format(Number(v||0))}catch(e){return (Number(v||0).toFixed(2)+' €')}}
  function date(v){if(!v)return '—';try{return new Date(String(v).length===10?v+'T12:00:00':v).toLocaleDateString('it-IT')}catch(e){return String(v)}}
  function statusClass(v){v=String(v||'').toLowerCase();if(/error|reject|scart/.test(v))return 'error';if(/deliver|accept|success|sent|issued|emess|consegn/.test(v))return 'ok';if(/draft|pending|unknown|bozza/.test(v))return 'warn';return ''}
  function years(){var y=new Date().getFullYear(),h='<option value="">Tutti gli anni</option>';for(var i=y+1;i>=2018;i--)h+='<option value="'+i+'">'+i+'</option>';return h}
  function months(){var n=['','Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'],h='<option value="">Tutti i mesi</option>';for(var i=1;i<=12;i++)h+='<option value="'+i+'">'+n[i]+'</option>';return h}

  function ensureNav(){
    var lab=E('navLaboratory'),nav=E('moduleNav');if(!nav||E('navDocumentsGroup'))return;
    var g=document.createElement('div');g.id='navDocumentsGroup';
    g.innerHTML='<button id="navDocuments" class="moduleBtn" type="button"><span>Documenti</span><span style="margin-left:auto">⌄</span></button><div id="navDocumentsSub"><button id="navDdt" type="button">Documento di trasporto</button><button id="navCustomerInvoices" type="button">Fatture clienti</button></div>';
    if(lab&&lab.parentNode)lab.parentNode.insertBefore(g,lab.nextSibling);else nav.appendChild(g);
    E('navDocuments').onclick=function(){g.classList.toggle('open')};
    E('navDdt').onclick=function(){openDocs('ddt')};
    E('navCustomerInvoices').onclick=function(){openDocs('invoices')};
  }
  function ensurePanels(){
    if(E('optykerDdtPanel')&&E('optykerCustomerInvoicesPanel'))return;
    var anchor=E('labOrdersPanel')||E('onlineOrdersPanel')||E('clientsPanel'),parent=anchor&&anchor.parentNode?anchor.parentNode:(E('mainApp')||document.body);
    function panel(id,title,sub){
      var p=document.createElement('div');p.id=id;p.className='panel optykerDocsPanel';
      p.innerHTML='<div class="optykerDocsHead"><div><div class="optykerDocsEyebrow">Optyker · Documenti</div><div class="optykerDocsTitle">'+title+'</div><div class="optykerDocsSub">'+sub+'</div></div><button class="optykerDocsRefresh" type="button">Aggiorna</button></div><div class="optykerDocsToolbar"><input class="optykerDocsSearch" type="search" placeholder="Cerca documento, cliente, intestazione…"><select class="optykerDocsYear">'+years()+'</select><select class="optykerDocsMonth">'+months()+'</select><button class="optykerDocsApply" type="button">Applica filtri</button></div><div class="optykerDocsTableWrap"><div class="optykerDocsLoading">Caricamento…</div></div>';
      parent.insertBefore(p,anchor?anchor.nextSibling:null);return p
    }
    var d=panel('optykerDdtPanel','Documento di trasporto','Archivio dei DDT collegati alle vendite e ai clienti.');
    var f=panel('optykerCustomerInvoicesPanel','Fatture clienti','Fatture emesse ai clienti, comprese quelle preparate dalla cassa.');
    [d,f].forEach(function(p){
      p.querySelector('.optykerDocsRefresh').onclick=load;
      p.querySelector('.optykerDocsApply').onclick=load;
      p.querySelector('.optykerDocsSearch').onkeydown=function(ev){if(ev.key==='Enter'){ev.preventDefault();load()}};
    })
  }
  function hideDocumentPanels(){var a=E('optykerDdtPanel'),b=E('optykerCustomerInvoicesPanel');if(a)a.style.display='none';if(b)b.style.display='none'}
  function hideMain(){
    var ids=['dashboardPanel','analysisPanel','prescriptionPanel','visualExamPanel','indicationsPanel','hearingPanel','clientsPanel','lacPanel','onlineOrdersPanel','labOrdersPanel','optykerChatPanel','optykerSettingsPanel','optykerAppointmentsPanel','eyewearPanel','warehousePanel'];
    ids.forEach(function(id){var x=E(id);if(x)x.style.display='none'});
    var r=E('reportSectionTop');if(r)r.style.display='none';var t=E('analysisTabs');if(t)t.style.display='none';
  }
  function setActive(){
    var g=E('navDocumentsGroup');if(g)g.classList.add('open');
    var main=E('navDocuments');if(main)main.className='moduleBtn active';
    var d=E('navDdt'),f=E('navCustomerInvoices');if(d)d.classList.toggle('active',S.mode==='ddt');if(f)f.classList.toggle('active',S.mode==='invoices')
  }
  function openDocs(mode){
    S.mode=mode;ensurePanels();hideMain();hideDocumentPanels();
    if(typeof window.dashboardSetWorkAreaVisible==='function')try{dashboardSetWorkAreaVisible(false)}catch(e){}
    var p=E(mode==='ddt'?'optykerDdtPanel':'optykerCustomerInvoicesPanel');if(p)p.style.display='block';
    setActive();load();try{window.scrollTo(0,0)}catch(e){}
  }
  window.openOptykerDdt=function(){openDocs('ddt')};
  window.openOptykerCustomerInvoices=function(){openDocs('invoices')};

  function filters(){
    var p=E(S.mode==='ddt'?'optykerDdtPanel':'optykerCustomerInvoicesPanel');if(!p)return {};
    return {search:p.querySelector('.optykerDocsSearch').value||'',year:p.querySelector('.optykerDocsYear').value||'',month:p.querySelector('.optykerDocsMonth').value||''}
  }
  function load(){
    if(!S.mode)return;var p=E(S.mode==='ddt'?'optykerDdtPanel':'optykerCustomerInvoicesPanel');if(!p)return;
    var box=p.querySelector('.optykerDocsTableWrap');box.innerHTML='<div class="optykerDocsLoading">Aggiornamento documenti…</div>';
    api(S.mode==='ddt'?'list_ddt':'list_customer_invoices',filters()).then(function(x){S.rows=Array.isArray(x.data)?x.data:[];render(box)}).catch(function(e){box.innerHTML='<div class="optykerDocsEmpty">Errore: '+esc(e.message)+'</div>'})
  }
  function render(box){
    if(!S.rows.length){box.innerHTML='<div class="optykerDocsEmpty">'+(S.mode==='ddt'?'Nessun documento di trasporto registrato.':'Nessuna fattura cliente trovata.')+'</div>';return}
    if(S.mode==='ddt'){
      var h='<table class="optykerDocsTable"><thead><tr><th>Data</th><th>Numero DDT</th><th>Cliente</th><th>Destinazione</th><th>Causale</th><th>Stato</th></tr></thead><tbody>';
      S.rows.forEach(function(r){h+='<tr><td>'+esc(date(r.document_date))+'</td><td><div class="optykerDocsMain">'+esc(r.document_number||'Bozza')+'</div><div class="optykerDocsMeta">'+esc(r.created_by||'')+'</div></td><td><div class="optykerDocsMain">'+esc(r.customer_name||'—')+'</div><div class="optykerDocsMeta">'+esc(r.customer_vat||r.customer_fiscal_code||'')+'</div></td><td>'+esc(r.destination||'—')+'</td><td>'+esc(r.reason||'—')+'</td><td><span class="optykerDocsStatus '+statusClass(r.status)+'">'+esc(r.status||'bozza')+'</span></td></tr>'});
      box.innerHTML=h+'</tbody></table>'
    }else{
      var h2='<table class="optykerDocsTable"><thead><tr><th>Data</th><th>Fattura</th><th>Cliente</th><th>Intestazione</th><th>Totale</th><th>Stato SDI</th></tr></thead><tbody>';
      S.rows.forEach(function(r){h2+='<tr><td>'+esc(date(r.issue_date||r.created_at))+'</td><td><div class="optykerDocsMain">'+esc(r.invoice_number||'Bozza')+'</div><div class="optykerDocsMeta">'+esc(r.sdi_protocol||'')+'</div></td><td><div class="optykerDocsMain">'+esc(r.counterparty_name||'—')+'</div><div class="optykerDocsMeta">'+esc(r.counterparty_vat||r.counterparty_fiscal_code||'')+'</div></td><td>'+esc(r.header||'—')+'</td><td class="optykerDocsMoney">'+esc(euro(r.total,r.currency))+'</td><td><span class="optykerDocsStatus '+statusClass(r.sdi_status)+'">'+esc(r.sdi_status||'—')+'</span></td></tr>'});
      box.innerHTML=h2+'</tbody></table>'
    }
  }

  function outsideNavHide(ev){
    var b=ev.target&&ev.target.closest?ev.target.closest('#moduleNav button'):null;if(!b)return;
    if(b.id==='navDocuments'||b.id==='navDdt'||b.id==='navCustomerInvoices')return;
    hideDocumentPanels();var main=E('navDocuments');if(main)main.classList.remove('active');
    var d=E('navDdt'),f=E('navCustomerInvoices');if(d)d.classList.remove('active');if(f)f.classList.remove('active')
  }
  function install(){ensureNav();ensurePanels()}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
  document.addEventListener('click',outsideNavHide,true);
  setInterval(install,900);
})();
</script>
'''

pos=s.lower().rfind("</body>")
if pos<0:
    raise SystemExit("Tag </body> non trovato")
s=s[:pos]+css+js+s[pos:]
p.write_text(s,encoding="utf-8")

for req in [MARK,'navDocuments','Documento di trasporto','Fatture clienti','optyker-documents-api']:
    if req not in s:
        raise SystemExit("Patch documenti incompleta: "+req)
print("Optyker documents nav OK")

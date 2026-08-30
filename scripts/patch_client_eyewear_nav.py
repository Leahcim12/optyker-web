from pathlib import Path

p=Path("_site/index.html")
s=p.read_text(encoding="utf-8")
MARK="OPTYKER_CLIENT_EYEWEAR_NAV_V1"
if MARK in s:
    raise SystemExit(0)

css=r'''
<style id="optykerClientEyewearNavCss">
/* OPTYKER_CLIENT_EYEWEAR_NAV_V1 */
#clientPageNav [data-client-page="lac"].clientPageHidden,
#clientPageNav [data-client-page="occhiali"].clientPageHidden{display:none!important}
#clientEyewearPage{
  display:none;margin:0 0 16px;padding:14px 15px;border:1px solid #dce5ec;border-radius:12px;background:#f8fbfd
}
#clientEyewearPage.visible{display:block}
.clientEyewearHead{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:12px}
.clientEyewearTitle{font-size:15px;font-weight:950;color:#24465f}
.clientEyewearHint{font-size:9px;color:#738594;margin-top:3px}
.clientEyewearList{display:grid;gap:8px}
.clientEyewearRow{display:grid;grid-template-columns:110px minmax(0,1fr) auto;gap:10px;align-items:center;border:1px solid #dce5ec;border-radius:10px;background:#fff;padding:10px 11px}
.clientEyewearType{font-size:8px;font-weight:950;color:#1769aa;text-transform:uppercase}
.clientEyewearMain{font-size:10px;font-weight:900;color:#2e4b61}
.clientEyewearMeta{font-size:8px;color:#7a8d9b;margin-top:3px}
.clientEyewearTotal{font-size:11px;font-weight:950;color:#17334b;white-space:nowrap}
.clientEyewearEmpty{padding:14px 0;color:#7a8b98;font-size:10px}
@media(max-width:650px){.clientEyewearRow{grid-template-columns:1fr auto}.clientEyewearType{grid-column:1/-1}}
</style>
'''

js=r'''
<script id="optykerClientEyewearNavJs">
(function(){/* OPTYKER_CLIENT_EYEWEAR_NAV_V1 */
  if(window.__optykerClientEyewearNavV1)return;window.__optykerClientEyewearNavV1=true;
  var currentPage='anagrafica';

  function E(id){return document.getElementById(id)}
  function text(v){return String(v==null?'':v)}
  function clientId(){return text(window.clientCurrentId||'')}
  function rows(){
    try{
      var c=window.OPTYKER_CLOUD||{},a=c.sheets&&c.sheets[clientId()];
      return Array.isArray(a)?a:[]
    }catch(e){return []}
  }
  function rowType(r){return text(r&&((r.sheet_type)||(r.data&&r.data.sheetType))||'')}
  function lacRows(){return rows().filter(function(r){return rowType(r)==='lac'})}
  function eyewearRows(){return rows().filter(function(r){var t=rowType(r);return t==='eyewear_quote'||t==='eyewear_job'||t==='eyewear_quote_v1'||t==='eyewear_job_v1'})}
  function money(v){
    try{return new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR'}).format(Number(v||0))}
    catch(e){return Number(v||0).toFixed(2)+' €'}
  }
  function dateLabel(v){
    if(!v)return '—';
    try{return new Date(v).toLocaleDateString('it-IT',{day:'2-digit',month:'2-digit',year:'numeric'})}
    catch(e){return text(v)}
  }
  function ensureTab(){
    var nav=E('clientPageNav');if(!nav)return;
    var lac=nav.querySelector('[data-client-page="lac"]'),eye=nav.querySelector('[data-client-page="occhiali"]');
    if(!eye){
      eye=document.createElement('button');
      eye.className='clientPageNavBtn';
      eye.type='button';
      eye.setAttribute('data-client-page','occhiali');
      eye.innerHTML='Occhiali <span id="clientPageCountEyewear" class="clientPageNavCount"></span>';
      eye.onclick=function(){openEyewearPage()};
      if(lac)lac.insertAdjacentElement('afterend',eye);else nav.appendChild(eye)
    }
  }
  function ensurePage(){
    var intro=E('clientPageIntro');if(!intro||E('clientEyewearPage'))return;
    var p=document.createElement('section');p.id='clientEyewearPage';
    p.innerHTML='<div class="clientEyewearHead"><div><div class="clientEyewearTitle">Schede Occhiali</div><div class="clientEyewearHint">Preventivi e buste occhiali associate a questo cliente.</div></div><button id="clientNewEyewearFromPage" class="primary" type="button">+ Nuova scheda Occhiali</button></div><div id="clientEyewearList" class="clientEyewearList"></div>';
    var dated=E('clientMainSheetDates');if(dated&&dated.parentNode)dated.parentNode.insertBefore(p,dated.nextSibling);else intro.parentNode.insertBefore(p,intro.nextSibling);
    E('clientNewEyewearFromPage').onclick=function(){if(window.openEyewearSheet)openEyewearSheet('quote',clientId())}
  }
  function updateVisibility(){
    ensureTab();ensurePage();
    var nav=E('clientPageNav');if(!nav)return;
    var lac=nav.querySelector('[data-client-page="lac"]'),eye=nav.querySelector('[data-client-page="occhiali"]');
    var lc=lacRows().length,ec=eyewearRows().length;
    if(lac){lac.classList.toggle('clientPageHidden',lc===0);var a=E('clientPageCountLac');if(a){a.textContent=lc||'';a.style.display=lc?'inline-flex':'none'}}
    if(eye){eye.classList.toggle('clientPageHidden',ec===0);var b=E('clientPageCountEyewear');if(b){b.textContent=ec||'';b.style.display=ec?'inline-flex':'none'}}
    if(currentPage==='lac'&&lc===0&&window.optykerClientOpenPage){currentPage='anagrafica';window.optykerClientOpenPage('anagrafica')}
    if(currentPage==='occhiali'&&ec===0&&window.optykerClientOpenPage){currentPage='anagrafica';window.optykerClientOpenPage('anagrafica')}
  }
  function renderEyewear(){
    var box=E('clientEyewearList');if(!box)return;
    var a=eyewearRows().slice().sort(function(x,y){return Date.parse(y.created_at||y.updated_at||0)-Date.parse(x.created_at||x.updated_at||0)});
    if(!a.length){box.innerHTML='<div class="clientEyewearEmpty">Nessuna scheda Occhiali associata.</div>';return}
    box.innerHTML=a.map(function(r){
      var d=r.data||{},p=d.pricing||{},fr=d.frame||{},ln=d.lens||{},typ=(r.document_type||d.documentType||'Scheda');
      return '<div class="clientEyewearRow"><div class="clientEyewearType">'+text(typ)+'</div><div><div class="clientEyewearMain">'+text(r.reference_code||r.title||'Scheda Occhiali')+'</div><div class="clientEyewearMeta">'+text([fr.brand,fr.model,ln.lens_type,dateLabel(r.created_at||r.updated_at)].filter(Boolean).join(' · '))+'</div></div><div class="clientEyewearTotal">'+money(p.total||0)+'</div></div>'
    }).join('')
  }
  function hideNative(){
    var ids=['clientAnagraficaSection','clientSheetsSection','clientInformativeSection','clientOnlineOrdersSection','clientChatSection','clientLacPageExtras','clientMainSheetDates'];
    ids.forEach(function(id){var x=E(id);if(x){x.style.display='none';x.classList.remove('visible')}})
    var wrap=E('clientRecordNavWrap');if(wrap)wrap.style.display='none'
  }
  function openEyewearPage(){
    if(!clientId()){alert('Seleziona prima un cliente.');return}
    currentPage='occhiali';hideNative();ensurePage();var p=E('clientEyewearPage');if(p){p.style.display='block';p.classList.add('visible')}
    var nav=E('clientPageNav');if(nav)Array.prototype.forEach.call(nav.querySelectorAll('[data-client-page]'),function(b){b.classList.toggle('active',b.getAttribute('data-client-page')==='occhiali')});
    var ti=E('clientPageIntroTitle'),su=E('clientPageIntroSub'),ac=E('clientPageIntroActions');
    if(ti)ti.textContent='Occhiali';if(su)su.textContent='Preventivi e buste occhiali salvati sul cliente.';
    if(ac){ac.innerHTML='';var b=document.createElement('button');b.className='primary';b.type='button';b.textContent='+ Nuova scheda Occhiali';b.onclick=function(){if(window.openEyewearSheet)openEyewearSheet('quote',clientId())};ac.appendChild(b)}
    renderEyewear()
  }
  window.optykerClientOpenEyewearPage=openEyewearPage;

  function ensureCreateSheetOption(){
    var act=E('clientPageIntroActions');if(act){var direct=act.querySelector('.clientDirectEyewearBtn');if(direct)direct.remove()}
    var dock=document.querySelector('.clientNewSheetDock');if(!dock)return;
    var existing=E('clientCreateEyewearOption');if(existing&&dock.contains(existing))return;
    var buttons=dock.querySelectorAll('button,a,[role="button"]'),lac=null;
    for(var i=0;i<buttons.length;i++){
      var t=text(buttons[i].textContent).replace(/\s+/g,' ').trim().toLowerCase();
      if(t==='lac'||t.indexOf('lenti a contatto')>=0||t.indexOf('scheda lac')>=0){lac=buttons[i];break}
    }
    var b=lac?lac.cloneNode(true):document.createElement('button');
    b.id='clientCreateEyewearOption';b.type='button';
    if(!lac)b.className='secondary';
    b.removeAttribute('onclick');b.removeAttribute('href');
    b.querySelectorAll('[id]').forEach(function(x){x.removeAttribute('id')});
    var changed=false,nodes=b.querySelectorAll('span,b,strong,div');
    for(i=0;i<nodes.length;i++){
      var s=text(nodes[i].textContent).replace(/\s+/g,' ').trim().toLowerCase();
      if(s==='lac'||s.indexOf('lenti a contatto')>=0||s.indexOf('scheda lac')>=0){nodes[i].textContent='Occhiali';changed=true;break}
    }
    if(!changed)b.textContent='Occhiali';
    b.onclick=function(ev){if(ev){ev.preventDefault();ev.stopPropagation()}if(window.openEyewearSheet)openEyewearSheet('quote',clientId())};
    if(lac&&lac.parentNode)lac.insertAdjacentElement('afterend',b);else dock.appendChild(b)
  }
  function wrapOpenPage(){
    if(typeof window.optykerClientOpenPage!=='function'||window.optykerClientOpenPage.__eyewearWrapped)return;
    var old=window.optykerClientOpenPage;
    var w=function(next){
      currentPage=next||'anagrafica';
      var r=old.apply(this,arguments);
      setTimeout(function(){
        var ep=E('clientEyewearPage');if(ep){ep.style.display='none';ep.classList.remove('visible')}
        updateVisibility();ensureCreateSheetOption()
      },0);
      return r
    };
    w.__eyewearWrapped=true;w.__eyewearOriginal=old;window.optykerClientOpenPage=w
  }
  function tick(){
    ensureTab();ensurePage();wrapOpenPage();updateVisibility();ensureCreateSheetOption();
    if(currentPage==='occhiali'){renderEyewear();var p=E('clientEyewearPage');if(p){p.style.display='block';p.classList.add('visible')}}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setTimeout(tick,100)});else setTimeout(tick,100);
  setInterval(tick,1000);
})();
</script>
'''

pos=s.lower().rfind("</body>")
if pos<0:
    raise SystemExit("Tag </body> non trovato")
s=s[:pos]+css+js+s[pos:]
p.write_text(s,encoding="utf-8")
for req in [MARK,'clientPageCountEyewear','clientEyewearPage','Nuova scheda Occhiali']:
    if req not in s:
        raise SystemExit("Patch cliente Occhiali incompleta: "+req)
print("Client Occhiali navigation OK")

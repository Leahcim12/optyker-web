from pathlib import Path

p=Path("_site/index.html")
s=p.read_text(encoding="utf-8")
MARK="OPTYKER_DASHBOARD_QUICKCARDS_V1"
if MARK in s:
    raise SystemExit(0)

css=r'''
<style id="optykerDashboardQuickcardsCss">
/* OPTYKER_DASHBOARD_QUICKCARDS_V1 */
#optykerDashboardClinicalCards{
  display:grid!important;
  grid-template-columns:repeat(3,minmax(0,1fr))!important;
  gap:20px!important;
  width:100%!important;
  margin:18px 0 22px!important;
  align-items:stretch!important
}
#optykerDashboardClinicalCards .optykerDashboardQuickCard{
  appearance:none!important;
  min-width:0!important;
  width:100%!important;
  min-height:92px!important;
  margin:0!important;
  padding:18px 24px!important;
  border:1px solid #d8e2ea!important;
  border-radius:14px!important;
  background:#fff!important;
  color:#33495d!important;
  box-shadow:0 5px 15px rgba(31,57,78,.06)!important;
  display:flex!important;
  align-items:center!important;
  justify-content:flex-start!important;
  gap:18px!important;
  text-align:left!important;
  font:900 16px/1.2 "Segoe UI",Arial,sans-serif!important;
  cursor:pointer!important;
  transition:transform .14s ease,box-shadow .14s ease,border-color .14s ease!important;
  overflow:hidden!important
}
#optykerDashboardClinicalCards .optykerDashboardQuickCard:hover{
  transform:translateY(-1px)!important;
  border-color:#b7ccdb!important;
  box-shadow:0 8px 22px rgba(31,57,78,.10)!important
}
#optykerDashboardClinicalCards .optykerDashboardQuickCard:focus-visible{
  outline:3px solid rgba(23,105,170,.16)!important;
  outline-offset:2px!important
}
.optykerDashboardQuickCardIcon{
  flex:0 0 48px!important;
  width:48px!important;
  height:48px!important;
  border-radius:50%!important;
  background:#eef3f7!important;
  display:grid!important;
  place-items:center!important;
  color:#53687a!important
}
.optykerDashboardQuickCardIcon svg{
  width:24px!important;
  height:24px!important;
  display:block!important;
  stroke:currentColor!important
}
.optykerDashboardQuickCardText{
  display:flex!important;
  flex-direction:column!important;
  min-width:0!important
}
.optykerDashboardQuickCardTitle{
  display:block!important;
  font-size:17px!important;
  line-height:1.15!important;
  font-weight:900!important;
  color:#34495c!important
}
.optykerDashboardQuickCardSub{
  display:block!important;
  margin-top:4px!important;
  font-size:9px!important;
  line-height:1.3!important;
  font-weight:700!important;
  color:#7c8c99!important
}
@media(max-width:900px){
  #optykerDashboardClinicalCards{grid-template-columns:1fr!important;gap:10px!important}
  #optykerDashboardClinicalCards .optykerDashboardQuickCard{min-height:78px!important}
}
</style>
'''

js=r'''
<script id="optykerDashboardQuickcardsJs">
(function(){/* OPTYKER_DASHBOARD_QUICKCARDS_V1 */
  if(window.__optykerDashboardQuickcardsV1)return;window.__optykerDashboardQuickcardsV1=true;
  function E(id){return document.getElementById(id)}
  function norm(v){return String(v||'').replace(/\s+/g,' ').trim().toLowerCase()}
  function svg(kind){
    if(kind==='anamnesi')return '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="3.5" width="11" height="16" rx="1.8"></rect><path d="M8 7.5h5M8 11h5M8 14.5h3"></path><path d="m14.5 17 4.2-4.2 1.5 1.5-4.2 4.2-2.2.7.7-2.2Z"></path></svg>';
    if(kind==='lac')return '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 12s3.6-5.2 9.5-5.2S21.5 12 21.5 12 17.9 17.2 12 17.2 2.5 12 2.5 12Z"></path><circle cx="12" cy="12" r="2.6"></circle></svg>';
    return '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3.2 10.5h2.2l1.1-1h3.2l1.1 1h2.4l1.1-1h3.2l1.1 1h2.2"></path><path d="M5.4 10.5v2.2a3.1 3.1 0 0 0 6.2 0v-1.5"></path><path d="M12.4 11.2v1.5a3.1 3.1 0 0 0 6.2 0v-2.2"></path></svg>'
  }
  function subtitle(kind){
    if(kind==='anamnesi')return 'Dati iniziali e anamnesi';
    if(kind==='lac')return 'Scheda lenti a contatto';
    return 'Preventivo e busta occhiali'
  }
  function title(kind){return kind==='anamnesi'?'Scheda anamnestica':(kind==='lac'?'LAC':'Occhiali')}
  function kindFor(el){
    var t=norm(el&&el.textContent);
    if(t.indexOf('anamnest')>=0)return'anamnesi';
    if(t==='lac'||t.indexOf('scheda lac')>=0||t.indexOf('lenti a contatto')>=0)return'lac';
    if(t.indexOf('occhiali')>=0)return'occhiali';
    return''
  }
  function candidates(dash){
    var nodes=dash.querySelectorAll('button,a,[role="button"],[onclick],.dashboardCard,.dashboardQuickCard,.dashboardActionCard');
    var out={};
    for(var i=0;i<nodes.length;i++){
      var k=kindFor(nodes[i]);if(k&&!out[k])out[k]=nodes[i]
    }
    return out
  }
  function decorate(el,kind){
    if(!el||el.classList.contains('optykerDashboardQuickCard'))return;
    el.classList.add('optykerDashboardQuickCard');
    el.setAttribute('data-optyker-card',kind);
    var icon=document.createElement('span');icon.className='optykerDashboardQuickCardIcon';icon.setAttribute('aria-hidden','true');icon.innerHTML=svg(kind);
    var txt=document.createElement('span');txt.className='optykerDashboardQuickCardText';
    txt.innerHTML='<span class="optykerDashboardQuickCardTitle">'+title(kind)+'</span><span class="optykerDashboardQuickCardSub">'+subtitle(kind)+'</span>';
    while(el.firstChild)el.removeChild(el.firstChild);
    el.appendChild(icon);el.appendChild(txt)
  }
  function install(){
    if(window.OPTYKER_BILLING_ADMIN)return;
    var dash=E('dashboardPanel');if(!dash)return;
    var c=candidates(dash);
    if(!c.anamnesi||!c.lac||!c.occhiali)return;
    var wrap=E('optykerDashboardClinicalCards');
    if(!wrap){
      wrap=document.createElement('div');wrap.id='optykerDashboardClinicalCards';
      c.anamnesi.parentNode.insertBefore(wrap,c.anamnesi)
    }
    decorate(c.anamnesi,'anamnesi');decorate(c.lac,'lac');decorate(c.occhiali,'occhiali');
    [c.anamnesi,c.lac,c.occhiali].forEach(function(x){if(x.parentNode!==wrap)wrap.appendChild(x)});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setTimeout(install,150)});else setTimeout(install,150);
  setInterval(install,900)
})();
</script>
'''

pos=s.lower().rfind("</body>")
if pos<0:
    raise SystemExit("Tag </body> non trovato")
s=s[:pos]+css+js+s[pos:]
p.write_text(s,encoding="utf-8")
for req in [MARK,'optykerDashboardClinicalCards','Scheda anamnestica','Preventivo e busta occhiali']:
    if req not in s:
        raise SystemExit("Patch dashboard cards incompleta: "+req)
print("Dashboard quick cards OK")

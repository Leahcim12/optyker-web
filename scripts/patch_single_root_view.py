from pathlib import Path

p=Path("_site/index.html")
s=p.read_text(encoding="utf-8")
MARK="OPTYKER_SINGLE_ROOT_VIEW_V1"
if MARK in s:
    raise SystemExit(0)

js=r'''
<script id="optykerSingleRootViewJs">
(function(){/* OPTYKER_SINGLE_ROOT_VIEW_V1 */
  if(window.__optykerSingleRootViewV1)return;window.__optykerSingleRootViewV1=true;
  var IDS=[
    'dashboardPanel','analysisPanel','prescriptionPanel','visualExamPanel','indicationsPanel','hearingPanel',
    'clientsPanel','lacPanel','onlineOrdersPanel','labOrdersPanel','optykerChatPanel','optykerSettingsPanel',
    'optykerAppointmentsPanel','eyewearPanel','warehousePanel','optykerDdtPanel','optykerCustomerInvoicesPanel'
  ];
  var guard=false,current='';
  function E(id){return document.getElementById(id)}
  function visible(el){
    if(!el||el.hidden)return false;
    var cs=window.getComputedStyle?getComputedStyle(el):null;
    return el.style.display!=='none'&&(!cs||cs.display!=='none')
  }
  function only(id){
    if(!id)return;current=id;guard=true;
    try{
      IDS.forEach(function(x){
        var el=E(x);if(!el)return;
        if(x===id)el.style.setProperty('display','block','important');
        else el.style.setProperty('display','none','important')
      });
      var report=E('reportSectionTop');
      if(report){
        var keep=['analysisPanel','prescriptionPanel','visualExamPanel','indicationsPanel','hearingPanel','clientsPanel'].indexOf(id)>=0;
        report.style.setProperty('display',keep?'':'none','important')
      }
      var tabs=E('analysisTabs');
      if(tabs)tabs.style.setProperty('display',id==='analysisPanel'?'flex':'none','important');
    }finally{guard=false}
  }
  window.optykerShowOnlyRootPanel=only;
  function watch(){
    IDS.forEach(function(id){
      var el=E(id);if(!el||el.__optykerRootWatch)return;el.__optykerRootWatch=true;
      new MutationObserver(function(){
        if(guard)return;
        setTimeout(function(){if(!guard&&visible(el))only(id)},0)
      }).observe(el,{attributes:true,attributeFilter:['style','class','hidden']})
    })
  }
  function infer(){
    if(guard)return;
    for(var i=IDS.length-1;i>=0;i--){var el=E(IDS[i]);if(visible(el)){only(IDS[i]);return}}
  }
  function boot(){watch();setTimeout(infer,80)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
  setInterval(watch,800);
})();
</script>
'''

pos=s.lower().rfind("</body>")
if pos<0:
    raise SystemExit("Tag </body> non trovato")
s=s[:pos]+js+s[pos:]
p.write_text(s,encoding="utf-8")
for req in [MARK,'optykerShowOnlyRootPanel','optykerDdtPanel','warehousePanel','eyewearPanel']:
    if req not in s:
        raise SystemExit("Patch single root view incompleta: "+req)
print("Single root view OK")

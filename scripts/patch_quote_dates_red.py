from pathlib import Path

p=Path("_site/index.html")
s=p.read_text(encoding="utf-8")
MARK="OPTYKER_QUOTE_DATES_RED_V1"
if MARK in s:
    raise SystemExit(0)

block=r'''
<style id="optykerQuoteDatesRedCss">
/* OPTYKER_QUOTE_DATES_RED_V1 */
.optykerQuoteMeta .optykerQuoteDateRed{
  color:#c62828!important;
  font-weight:950!important;
}
</style>
<script id="optykerQuoteDatesRedJs">
(function(){/* OPTYKER_QUOTE_DATES_RED_V1 */
  if(window.__optykerQuoteDatesRedV1)return;window.__optykerQuoteDatesRedV1=true;
  function apply(root){
    var scope=root&&root.querySelectorAll?root:document;
    var nodes=[];
    if(root&&root.nodeType===1&&root.matches&&root.matches('.optykerQuoteMeta'))nodes.push(root);
    Array.prototype.push.apply(nodes,scope.querySelectorAll('.optykerQuoteMeta'));
    for(var i=0;i<nodes.length;i++){
      var el=nodes[i];
      if(el.querySelector('.optykerQuoteDateRed'))continue;
      var raw=String(el.textContent||'').trim();
      var m=raw.match(/^(\d{2}\/\d{2}\/\d{4})(.*)$/);
      if(!m)continue;
      while(el.firstChild)el.removeChild(el.firstChild);
      var d=document.createElement('span');d.className='optykerQuoteDateRed';d.textContent=m[1];
      el.appendChild(d);
      if(m[2])el.appendChild(document.createTextNode(m[2]));
    }
  }
  function boot(){apply(document)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
  var mo=new MutationObserver(function(ms){
    for(var i=0;i<ms.length;i++){
      for(var j=0;j<ms[i].addedNodes.length;j++){
        var n=ms[i].addedNodes[j];if(n&&n.nodeType===1)apply(n);
      }
    }
  });
  function watch(){if(document.body)mo.observe(document.body,{childList:true,subtree:true});else setTimeout(watch,50)}
  watch();
})();
</script>
'''

pos=s.lower().rfind("</body>")
if pos<0:
    raise SystemExit("Tag </body> non trovato")
s=s[:pos]+block+s[pos:]
p.write_text(s,encoding="utf-8")

for req in [MARK,'optykerQuoteDateRed','.optykerQuoteMeta']:
    if req not in s:
        raise SystemExit("Patch date preventivi incompleta: "+req)
print("Quote dates red OK")

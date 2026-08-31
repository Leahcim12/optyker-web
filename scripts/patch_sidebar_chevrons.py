from pathlib import Path

p=Path("_site/index.html")
s=p.read_text(encoding="utf-8")
MARK="OPTYKER_SIDEBAR_CHEVRONS_V1"
if MARK in s:
    raise SystemExit(0)

css=r'''
<style id="optykerSidebarChevronsCss">
/* OPTYKER_SIDEBAR_CHEVRONS_V1 */
#moduleNav .optykerNavChevron{
  margin-left:auto!important;
  flex:0 0 18px!important;
  width:18px!important;
  height:18px!important;
  display:inline-flex!important;
  align-items:center!important;
  justify-content:center!important;
  color:currentColor!important;
  line-height:1!important;
}
#moduleNav .optykerNavChevron::before{
  content:""!important;
  width:6px!important;
  height:6px!important;
  border-right:1.8px solid currentColor!important;
  border-bottom:1.8px solid currentColor!important;
  transform:rotate(45deg)!important;
  transform-origin:center!important;
  transition:transform .16s ease!important;
  margin-top:-3px!important;
}
#moduleNav .open > .moduleBtn .optykerNavChevron::before,
#moduleNav .moduleBtn[aria-expanded="true"] .optykerNavChevron::before,
#moduleNav .moduleBtn.optykerChevronOpen .optykerNavChevron::before{
  transform:rotate(225deg)!important;
  margin-top:3px!important;
}
#moduleNav .moduleBtn{
  align-items:center!important;
}
</style>
'''

js=r'''
<script id="optykerSidebarChevronsJs">
(function(){/* OPTYKER_SIDEBAR_CHEVRONS_V1 */
  if(window.__optykerSidebarChevronsV1)return;window.__optykerSidebarChevronsV1=true;
  function hasSub(btn){
    if(!btn)return false;
    var id=btn.id||'';
    if(id==='navDocuments'||id==='navWarehouse'||id==='navSheets')return true;
    var parent=btn.parentElement;
    if(parent&&parent.querySelector(':scope > div, :scope > ul')){
      var kids=parent.children;
      for(var i=0;i<kids.length;i++){
        var k=kids[i];
        if(k!==btn && (k.tagName==='DIV'||k.tagName==='UL') && /sub|menu/i.test((k.id||'')+' '+(k.className||'')))return true;
      }
    }
    return btn.hasAttribute('aria-expanded');
  }
  function cleanArrowText(btn){
    var spans=btn.querySelectorAll('span');
    for(var i=0;i<spans.length;i++){
      var sp=spans[i],t=(sp.textContent||'').trim();
      if(/^[⌄⌃▾▴▼▲›‹⌄⌃∨∧]+$/.test(t)){
        sp.textContent='';
        sp.className='optykerNavChevron';
        sp.removeAttribute('style');
        return sp;
      }
    }
    return null;
  }
  function ensure(btn){
    if(!btn||!hasSub(btn))return;
    var chev=btn.querySelector('.optykerNavChevron')||cleanArrowText(btn);
    if(!chev){
      chev=document.createElement('span');
      chev.className='optykerNavChevron';
      chev.setAttribute('aria-hidden','true');
      btn.appendChild(chev);
    }
    var parent=btn.parentElement;
    var open=!!(parent&&parent.classList.contains('open'))||btn.getAttribute('aria-expanded')==='true';
    btn.classList.toggle('optykerChevronOpen',open);
  }
  function install(){
    var nav=document.getElementById('moduleNav');if(!nav)return;
    var buttons=nav.querySelectorAll('.moduleBtn');
    for(var i=0;i<buttons.length;i++)ensure(buttons[i]);
  }
  function sync(){
    install();
    var nav=document.getElementById('moduleNav');if(!nav)return;
    var bs=nav.querySelectorAll('.moduleBtn');
    for(var i=0;i<bs.length;i++){
      var b=bs[i],p=b.parentElement;
      var open=!!(p&&p.classList.contains('open'))||b.getAttribute('aria-expanded')==='true';
      b.classList.toggle('optykerChevronOpen',open)
    }
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setTimeout(sync,100)});else setTimeout(sync,100);
  document.addEventListener('click',function(){setTimeout(sync,0)},true);
  setInterval(sync,800);
})();
</script>
'''

pos=s.lower().rfind("</body>")
if pos<0:
    raise SystemExit("Tag </body> non trovato")
s=s[:pos]+css+js+s[pos:]
p.write_text(s,encoding="utf-8")
for req in [MARK,'optykerNavChevron','navDocuments','navWarehouse']:
    if req not in s:
        raise SystemExit("Patch frecce incompleta: "+req)
print("Sidebar chevrons OK")

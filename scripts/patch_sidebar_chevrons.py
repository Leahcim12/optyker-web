from pathlib import Path

p=Path("_site/index.html")
s=p.read_text(encoding="utf-8")
MARK="OPTYKER_SIDEBAR_CHEVRONS_V3"
if MARK in s:
    raise SystemExit(0)

css=r'''
<style id="optykerSidebarChevronsCss">
/* OPTYKER_SIDEBAR_CHEVRONS_V3 */
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
#moduleNav .moduleBtn:not(.optykerHasSubmenu)::after{
  content:none!important;
  display:none!important;
}
#moduleNav .moduleBtn:not(.optykerHasSubmenu) > [class*="arrow" i],
#moduleNav .moduleBtn:not(.optykerHasSubmenu) > [class*="chevron" i]{
  display:none!important;
}
</style>
'''

js=r'''
<script id="optykerSidebarChevronsJs">
(function(){/* OPTYKER_SIDEBAR_CHEVRONS_V3 */
  if(window.__optykerSidebarChevronsV1)return;window.__optykerSidebarChevronsV1=true;
  function submenuFor(btn){
    if(!btn)return null;
    var next=btn.nextElementSibling;
    if(next){
      var nm=((next.id||'')+' '+(next.className||'')).toLowerCase();
      if(/sub|menu/.test(nm)&&next.querySelector&&next.querySelector('button,a,[role="button"]'))return next;
    }
    var parent=btn.parentElement;
    if(parent&&parent.id!=='moduleNav'){
      var kids=parent.children;
      for(var i=0;i<kids.length;i++){
        var k=kids[i];if(k===btn)continue;
        var meta=((k.id||'')+' '+(k.className||'')).toLowerCase();
        if(/sub|menu/.test(meta)&&k.querySelector&&k.querySelector('button,a,[role="button"]'))return k;
      }
    }
    var explicit={
      navSheets:'sheetsSubmenu',
      navClients:'clientSidebarSubmenu',
      navDocuments:'navDocumentsSub',
      navWarehouse:'navWarehouseSub'
    };
    var id=explicit[btn.id];
    if(id){
      var el=document.getElementById(id);
      if(el&&el.querySelector&&el.querySelector('button,a,[role="button"]'))return el;
    }
    return null;
  }
  function hasSub(btn){return !!submenuFor(btn)}
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
  function stripArrows(btn){
    var stale=btn.querySelectorAll('.optykerNavChevron,[class*="arrow" i],[class*="chevron" i]');
    for(var z=0;z<stale.length;z++)stale[z].remove();
    var spans=btn.querySelectorAll('span');
    for(var s=0;s<spans.length;s++){
      var t=(spans[s].textContent||'').trim();
      if(/^[⌄⌃▾▴▼▲›‹∨∧]+$/.test(t))spans[s].remove();
    }
    var nodes=Array.prototype.slice.call(btn.childNodes||[]);
    for(var n=0;n<nodes.length;n++){
      if(nodes[n].nodeType===3&&/^[\s⌄⌃▾▴▼▲›‹∨∧]+$/.test(nodes[n].nodeValue||''))nodes[n].remove();
    }
  }
  function ensure(btn){
    if(!btn)return;
    var sub=submenuFor(btn);
    btn.classList.toggle('optykerHasSubmenu',!!sub);
    if(!sub){
      stripArrows(btn);
      btn.classList.remove('optykerChevronOpen');
      btn.removeAttribute('aria-expanded');
      return;
    }
    var chev=btn.querySelector('.optykerNavChevron')||cleanArrowText(btn);
    if(!chev){
      chev=document.createElement('span');
      chev.className='optykerNavChevron';
      chev.setAttribute('aria-hidden','true');
      btn.appendChild(chev);
    }
    var parent=btn.parentElement,sub=submenuFor(btn);
    var open=!!(parent&&parent.classList.contains('open'))||btn.getAttribute('aria-expanded')==='true';
    if(btn.id==='navSheets'){
      var nav=document.getElementById('moduleNav');
      open=!!(nav&&nav.classList.contains('sheetsOpen'));
    }else if(sub&&window.getComputedStyle){
      var cs=getComputedStyle(sub);
      if(cs&&cs.display!=='none')open=true;
    }
    btn.classList.toggle('optykerChevronOpen',open);
    btn.setAttribute('aria-expanded',open?'true':'false');
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
    for(var i=0;i<bs.length;i++)ensure(bs[i]);
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
for req in [MARK,'optykerNavChevron','submenuFor(btn)','optykerHasSubmenu','clientSidebarSubmenu','sheetsSubmenu']:
    if req not in s:
        raise SystemExit("Patch frecce incompleta: "+req)
print("Sidebar chevrons OK")

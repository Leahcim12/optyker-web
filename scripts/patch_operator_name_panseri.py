from pathlib import Path
import re

p=Path("_site/index.html")
s=p.read_text(encoding="utf-8")

MARK="OPTYKER_DIEGO_PANSERI_NAME_FIX_V1"

# Corregge qualsiasi residuo statico nella base HTML pubblicata.
s=re.sub(r"DIEGO\s+PANSIERI", "DIEGO PANSERI", s, flags=re.I)

if MARK not in s:
    mig=r'''<script id="optykerDiegoPanseriFix">/* OPTYKER_DIEGO_PANSERI_NAME_FIX_V1 */
(function(){
  var OLD=/DIEGO\s+PANSIERI/gi, NEW='DIEGO PANSERI';
  function fixStorage(st){
    try{
      for(var i=0;i<st.length;i++){
        var k=st.key(i),v=st.getItem(k);
        if(typeof v==='string' && /DIEGO\s+PANSIERI/i.test(v)){
          st.setItem(k,v.replace(OLD,NEW));
        }
      }
    }catch(e){}
  }
  fixStorage(localStorage);
  fixStorage(sessionStorage);

  function fixNode(root){
    try{
      var w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
      var n;
      while((n=w.nextNode())){
        if(n.nodeValue && /DIEGO\s+PANSIERI/i.test(n.nodeValue)){
          n.nodeValue=n.nodeValue.replace(OLD,NEW);
        }
      }
      if(root.querySelectorAll){
        root.querySelectorAll('option,input,[data-username],[data-user],[data-operator]').forEach(function(el){
          try{
            if(el.value && /DIEGO\s+PANSIERI/i.test(el.value)) el.value=el.value.replace(OLD,NEW);
            ['data-username','data-user','data-operator'].forEach(function(a){
              var v=el.getAttribute(a);
              if(v && /DIEGO\s+PANSIERI/i.test(v)) el.setAttribute(a,v.replace(OLD,NEW));
            });
          }catch(e){}
        });
      }
    }catch(e){}
  }

  document.addEventListener('DOMContentLoaded',function(){
    fixNode(document.body);
    try{
      new MutationObserver(function(ms){
        ms.forEach(function(m){
          m.addedNodes&&m.addedNodes.forEach(function(n){
            if(n.nodeType===1||n.nodeType===3) fixNode(n.nodeType===1?n:n.parentNode);
          });
        });
      }).observe(document.body,{childList:true,subtree:true});
    }catch(e){}
  });
})();
</script>'''
    h=s.lower().find("<head")
    if h<0:
        raise SystemExit("head Optyker non trovato")
    gt=s.find(">",h)
    if gt<0:
        raise SystemExit("head Optyker non valido")
    s=s[:gt+1]+"\n"+mig+s[gt+1:]

# Verifica finale: il vecchio nome non deve più essere presente nel file statico.
if re.search(r"DIEGO\s+PANSIERI",s,re.I):
    raise SystemExit("Residuo DIEGO PANSIERI ancora presente")

p.write_text(s,encoding="utf-8")
print("Nome operatore corretto nel frontend: DIEGO PANSERI")

from pathlib import Path

p=Path('_site/index.html')
s=p.read_text(encoding='utf-8')
MARK='OPTYKER_WHATSAPP_NAV_FINAL_V1'
if MARK in s:
    raise SystemExit(0)
if 'OPTYKER_WHATSAPP_SIMPLE_CONNECT_V1' not in s or 'id="moduleNav"' not in s:
    raise SystemExit('WhatsApp semplice / sidebar non disponibili')

script=r'''
<script id="optykerWhatsappNavFinalJs">(function(){/* OPTYKER_WHATSAPP_NAV_FINAL_V1 */
function E(i){return document.getElementById(i)}
function ensure(){
  var nav=E('moduleNav');if(!nav)return;
  var b=E('navWhatsAppConnect');
  if(!b){
    b=document.createElement('button');
    b.id='navWhatsAppConnect';b.className='moduleBtn';b.type='button';b.setAttribute('data-short','WhatsApp');
    b.innerHTML='<span class="winNavIcon" aria-hidden="true">W</span><span>WhatsApp</span>';
    var settings=E('navSettings');if(settings&&settings.parentNode===nav)nav.insertBefore(b,settings);else nav.appendChild(b)
  }
  b.removeAttribute('disabled');
  b.style.setProperty('pointer-events','auto','important');
  b.onclick=function(ev){if(ev){ev.preventDefault();ev.stopPropagation()}if(window.optykerOpenWhatsAppSimple)window.optykerOpenWhatsAppSimple();return false}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ensure);else ensure();
window.addEventListener('pageshow',ensure);
setTimeout(ensure,100);setTimeout(ensure,800);
new MutationObserver(function(){if(!E('navWhatsAppConnect'))setTimeout(ensure,0)}).observe(document.documentElement,{subtree:true,childList:true});
})();</script>'''

b=s.rfind('</body>')
if b<0: raise SystemExit('body non trovato')
s=s[:b]+script+s[b:]
p.write_text(s,encoding='utf-8')
if MARK not in s: raise SystemExit('Nav WhatsApp finale non inserita')
print('WhatsApp final nav OK')

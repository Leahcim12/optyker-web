from pathlib import Path

p=Path('_site/index.html')
s=p.read_text(encoding='utf-8')
MARK='OPTYKER_HIDE_WHATSAPP_SIDEBAR_V1'
if MARK in s:
    raise SystemExit(0)
if 'id="moduleNav"' not in s:
    raise SystemExit('Sidebar non disponibile')

style=r'''<style id="optykerHideWhatsAppSidebarCss">/* OPTYKER_HIDE_WHATSAPP_SIDEBAR_V1 */
#navWhatsAppConnect{display:none!important}
</style>'''

script=r'''<script id="optykerHideWhatsAppSidebarJs">(function(){/* OPTYKER_HIDE_WHATSAPP_SIDEBAR_V1 */
function hide(){var b=document.getElementById('navWhatsAppConnect');if(b){b.style.setProperty('display','none','important');b.setAttribute('aria-hidden','true');b.tabIndex=-1}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',hide);else hide();
window.addEventListener('pageshow',hide);setTimeout(hide,100);setTimeout(hide,800);
new MutationObserver(hide).observe(document.documentElement,{subtree:true,childList:true});
})();</script>'''

h=s.find('</head>')
if h<0: raise SystemExit('head non trovato')
s=s[:h]+style+s[h:]
b=s.rfind('</body>')
if b<0: raise SystemExit('body non trovato')
s=s[:b]+script+s[b:]
p.write_text(s,encoding='utf-8')
if MARK not in s: raise SystemExit('Hide WhatsApp sidebar non inserito')
print('WhatsApp sidebar hidden')

from pathlib import Path

p=Path('_site/index.html')
s=p.read_text(encoding='utf-8')
MARK='OPTYKER_WHATSAPP_META_BLOCK_HELP_V1'
if MARK in s:
    raise SystemExit(0)
if 'OPTYKER_WHATSAPP_SIMPLE_CONNECT_V1' not in s or 'id="optykerWaQrStart"' not in s:
    raise SystemExit('WhatsApp semplice non disponibile')

style=r'''<style id="optykerWhatsappMetaBlockHelpCss">/* OPTYKER_WHATSAPP_META_BLOCK_HELP_V1 */
#optykerWaQrConnect{display:none!important}
#optykerWaMetaHelp{display:none;margin-top:12px;padding:12px;border:1px solid #ead8a7;border-radius:10px;background:#fffaf0}
#optykerWaMetaHelp.open{display:block}
.optykerWaMetaHelpTitle{font-size:11px;font-weight:900;color:#6d5100}
.optykerWaMetaHelpText{font-size:9px;line-height:1.5;color:#74653c;margin-top:4px}
.optykerWaMetaHelpList{margin:8px 0 0;padding-left:18px;font-size:9px;line-height:1.55;color:#5f5a4a}
.optykerWaMetaHelpActions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
.optykerWaMetaHelpActions a,.optykerWaMetaHelpActions button{height:38px;display:inline-flex;align-items:center;justify-content:center;border-radius:8px;padding:0 12px;font-size:9px;font-weight:900;text-decoration:none;cursor:pointer}
.optykerWaMetaOpen{background:#1877f2;color:#fff;border:1px solid #1877f2}
.optykerWaMetaRetry{background:#fff;color:#4d5f6b;border:1px solid #cbd5dc}
</style>'''

script=r'''<script id="optykerWhatsappMetaBlockHelpJs">(function(){/* OPTYKER_WHATSAPP_META_BLOCK_HELP_V1 */
var timer=0;
function E(i){return document.getElementById(i)}
function ensure(){
  var simple=E('optykerWaSimple');if(!simple||E('optykerWaMetaHelp'))return;
  var h=document.createElement('div');h.id='optykerWaMetaHelp';
  h.innerHTML='<div class="optykerWaMetaHelpTitle">Meta deve abilitare il login dell’app</div><div class="optykerWaMetaHelpText">Se nella finestra Meta compare “Facebook Login non è attualmente disponibile per questa app”, il blocco è nella configurazione Meta e non nel numero WhatsApp.</div><ul class="optykerWaMetaHelpList"><li>App Meta in modalità Live</li><li>Facebook Login for Business configurato</li><li>Login con JavaScript SDK e Web OAuth abilitati</li><li>Dominio consentito: leahcim12.github.io</li><li>Configurazione creata come WhatsApp Embedded Signup</li><li>Accesso avanzato ai permessi WhatsApp Business richiesti</li></ul><div class="optykerWaMetaHelpActions"><a class="optykerWaMetaOpen" href="https://developers.facebook.com/apps/" target="_blank" rel="noopener">CONFIGURA META</a><button id="optykerWaMetaRetry" class="optykerWaMetaRetry" type="button">RIPROVA COLLEGAMENTO</button></div>';
  simple.appendChild(h);
  E('optykerWaMetaRetry').onclick=function(){h.classList.remove('open');var b=E('optykerWaSimpleConnect');if(b)b.click()}
}
function showHelp(){
  ensure();var h=E('optykerWaMetaHelp');if(h)h.classList.add('open');
  var st=E('optykerWaSimpleStatus');if(st){st.textContent='Se Meta mostra “Facebook Login non disponibile”, completa prima la configurazione Meta qui sotto.';st.className='bad'}
}
function arm(){
  clearTimeout(timer);
  timer=setTimeout(function(){
    var connected=E('optykerWaSimpleState')&&/COLLEGATO/.test(E('optykerWaSimpleState').textContent||'');
    var qr=E('optykerWaQrStatus'),qt=String(qr&&qr.textContent||'');
    if(!connected&&!/collegato correttamente|finalizzazione|qr confermato/i.test(qt))showHelp()
  },9000)
}
function bind(){
  ensure();
  var b=E('optykerWaSimpleConnect');if(b&&!b.__metaHelp){b.__metaHelp=true;b.addEventListener('click',arm)}
  var s=E('optykerWaSimpleSaveSetup');if(s&&!s.__metaHelp){s.__metaHelp=true;s.addEventListener('click',arm)}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setTimeout(bind,250)});else setTimeout(bind,250);
window.addEventListener('pageshow',function(){setTimeout(bind,250)});
new MutationObserver(function(){setTimeout(bind,30)}).observe(document.documentElement,{subtree:true,childList:true});
})();</script>'''

h=s.find('</head>')
if h<0: raise SystemExit('head non trovato')
s=s[:h]+style+s[h:]
b=s.rfind('</body>')
if b<0: raise SystemExit('body non trovato')
s=s[:b]+script+s[b:]
p.write_text(s,encoding='utf-8')
for req in [MARK,'CONFIGURA META','developers.facebook.com/apps/','#optykerWaQrConnect{display:none!important}']:
    if req not in s: raise SystemExit('Help Meta incompleto: '+req)
print('WhatsApp Meta block helper OK')

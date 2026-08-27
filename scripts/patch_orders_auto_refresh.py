from pathlib import Path

p=Path('_site/index.html')
s=p.read_text(encoding='utf-8')
MARK='OPTYKER_ORDERS_AUTO_REFRESH_V1'
if MARK in s:
    raise SystemExit(0)
if 'onlineReload=function' not in s or 'onlineOrdersPanel' not in s or 'Apri ordine Shopify' not in s:
    raise SystemExit('Sezione Ordini Shopify non disponibile')

style=r'''<style id="optykerOrdersAutoRefreshCss">/* OPTYKER_ORDERS_AUTO_REFRESH_V1 */
.onlineActions button.optykerHiddenShopifyAction{display:none!important}
</style>'''

script=r'''<script id="optykerOrdersAutoRefreshJs">(function(){/* OPTYKER_ORDERS_AUTO_REFRESH_V1 */
var INTERVAL=60000,lastRefresh=0,timer=null;

function E(i){return document.getElementById(i)}

function ordersVisible(){
  var p=E('onlineOrdersPanel');
  if(!p)return false;
  var cs=window.getComputedStyle?getComputedStyle(p):null;
  return p.style.display!=='none' && (!cs || cs.display!=='none') && !p.hidden;
}

function cleanButtons(){
  document.querySelectorAll('#onlineOrdersPanel .onlineActions button').forEach(function(b){
    var t=String(b.textContent||'').replace(/\s+/g,' ').trim().toLowerCase();
    if(t==='apri ordine shopify' || t==='cliente shopify' || t==='clienti shopify'){
      b.classList.add('optykerHiddenShopifyAction');
      b.remove();
    }
  });
}

function refresh(force){
  if(!force&&!ordersVisible())return;
  if(typeof window.onlineReload!=='function')return;
  var now=Date.now();
  if(!force && now-lastRefresh<45000)return;
  lastRefresh=now;
  try{window.onlineReload()}catch(e){}
  setTimeout(cleanButtons,80);
  setTimeout(cleanButtons,500);
}

function arm(){
  if(timer)clearInterval(timer);
  timer=setInterval(function(){
    if(document.visibilityState==='visible'&&ordersVisible())refresh(false);
  },INTERVAL);
}

function boot(){
  cleanButtons();
  arm();
  setTimeout(function(){if(ordersVisible())refresh(true)},600);
}

document.addEventListener('click',function(){
  setTimeout(function(){
    cleanButtons();
    if(ordersVisible()&&Date.now()-lastRefresh>15000)refresh(false);
  },120);
},true);

document.addEventListener('visibilitychange',function(){
  if(document.visibilityState==='visible'&&ordersVisible()&&Date.now()-lastRefresh>15000)refresh(false);
});

window.addEventListener('focus',function(){
  if(ordersVisible()&&Date.now()-lastRefresh>15000)refresh(false);
});

new MutationObserver(function(){cleanButtons()}).observe(document.documentElement,{subtree:true,childList:true});

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();</script>'''

h=s.find('</head>')
if h<0: raise SystemExit('head non trovato')
s=s[:h]+style+s[h:]
b=s.rfind('</body>')
if b<0: raise SystemExit('body non trovato')
s=s[:b]+script+s[b:]

p.write_text(s,encoding='utf-8')
for req in [MARK,'INTERVAL=60000','apri ordine shopify','clienti shopify','window.onlineReload']:
    if req not in s:
        raise SystemExit('Patch Ordini incompleta: '+req)
print('Orders auto refresh + Shopify button cleanup OK')

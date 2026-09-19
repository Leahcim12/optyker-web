"""Keep the desktop login above stale application overlays and fully clickable."""
from pathlib import Path
import re

SITE = Path('_site')
MARK = 'OPTYKER_LOGIN_INTERACTION_20260919'
BLOCK = r'''<script id="optykerLoginInteraction20260919">/* OPTYKER_LOGIN_INTERACTION_20260919 */
(function(){
'use strict';
if(window.__OPTYKER_LOGIN_INTERACTION_20260919__)return;
window.__OPTYKER_LOGIN_INTERACTION_20260919__='20260919-login-click1';
var queued=false,checks=0;
function visible(el){
  if(!el||!el.getBoundingClientRect)return false;
  var s=getComputedStyle(el),r=el.getBoundingClientRect();
  return s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity||1)>0.01&&r.width>0&&r.height>0;
}
function style(){
  if(document.getElementById('optykerLoginInteraction20260919Css'))return;
  var s=document.createElement('style');s.id='optykerLoginInteraction20260919Css';
  s.textContent='html.optykerLoginActive20260919,html.optykerLoginActive20260919 body{pointer-events:auto!important}'+
   '#optykerLoginScreen.optykerLoginClickable20260919{z-index:2147483646!important;pointer-events:auto!important;touch-action:manipulation!important;isolation:isolate!important}'+
   '#optykerLoginScreen.optykerLoginClickable20260919 .optykerLoginShell,#optykerLoginScreen.optykerLoginClickable20260919 .optykerLoginCard,#optykerLoginScreen.optykerLoginClickable20260919 button,#optykerLoginScreen.optykerLoginClickable20260919 select,#optykerLoginScreen.optykerLoginClickable20260919 input,#optykerLoginScreen.optykerLoginClickable20260919 label{pointer-events:auto!important;touch-action:manipulation!important}'+
   '#optykerLoginScreen.optykerLoginClickable20260919 button,#optykerLoginScreen.optykerLoginClickable20260919 select,#optykerLoginScreen.optykerLoginClickable20260919 input{position:relative!important;z-index:2!important}';
  document.head.appendChild(s);
}
function disableBlockerAt(el,x,y,screen){
  var top=document.elementFromPoint(x,y);if(!top||screen.contains(top))return;
  var blocker=top;
  while(blocker&&blocker.parentElement&&blocker.parentElement!==document.body){
    var ps=getComputedStyle(blocker.parentElement);
    if(ps.position==='fixed')blocker=blocker.parentElement;else break;
  }
  if(!blocker||blocker===document.body||blocker===document.documentElement||screen.contains(blocker))return;
  var cs=getComputedStyle(blocker),r=blocker.getBoundingClientRect();
  if(cs.position==='fixed'&&r.width>=innerWidth*.75&&r.height>=innerHeight*.75){
    blocker.style.setProperty('pointer-events','none','important');
    blocker.setAttribute('data-optyker-login-blocker','disabled');
  }
}
function enforce(){
  queued=false;style();
  var screen=document.getElementById('optykerLoginScreen');
  if(!screen||!visible(screen)||window.optykerAuthenticated===true){
    document.documentElement.classList.remove('optykerLoginActive20260919');return;
  }
  document.documentElement.classList.add('optykerLoginActive20260919');
  document.documentElement.style.setProperty('pointer-events','auto','important');
  if(document.body){document.body.removeAttribute('inert');document.body.style.setProperty('pointer-events','auto','important')}
  screen.removeAttribute('inert');screen.setAttribute('aria-hidden','false');screen.classList.add('optykerLoginClickable20260919');
  screen.style.setProperty('pointer-events','auto','important');screen.style.setProperty('z-index','2147483646','important');
  screen.querySelectorAll('.optykerLoginShell,.optykerLoginCard,button,select,input,label').forEach(function(el){
    el.removeAttribute('inert');el.style.setProperty('pointer-events','auto','important');
  });
  [document.getElementById('optykerLoginOperator'),screen.querySelector('.optykerLoginButton'),screen.querySelector('.optykerAdminEntry')].forEach(function(el){
    if(!el||!visible(el))return;var r=el.getBoundingClientRect();disableBlockerAt(el,r.left+r.width/2,r.top+r.height/2,screen);
  });
}
function schedule(){if(queued)return;queued=true;requestAnimationFrame(enforce)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',enforce,{once:true});else enforce();
window.addEventListener('pageshow',enforce);
document.addEventListener('visibilitychange',function(){if(!document.hidden)enforce()});
new MutationObserver(schedule).observe(document.documentElement,{subtree:true,childList:true});
var timer=setInterval(function(){enforce();if(++checks>=30)clearInterval(timer)},500);
})();
</script>'''

for rel in ('index.html', 'gestionale-v2/index.html', 'gestionale-v3/index.html'):
    path = SITE / rel
    text = path.read_text(encoding='utf-8')
    text = re.sub(
        r'\n?<script id="optykerLoginInteraction20260919">[\s\S]*?</script>\n?',
        '\n',
        text,
        flags=re.I,
    )
    pos = text.lower().rfind('</body>')
    if pos < 0:
        raise SystemExit('Login interaction: closing body missing in ' + rel)
    text = text[:pos] + BLOCK + '\n' + text[pos:]
    path.write_text(text, encoding='utf-8')

main = (SITE / 'index.html').read_text(encoding='utf-8')
for required in (MARK, '2147483646', 'optykerLoginClickable20260919', 'data-optyker-login-blocker'):
    if required not in main:
        raise SystemExit('Login interaction marker missing: ' + required)
print('Login desktop reso cliccabile sopra ogni overlay: 20260919-login-click1')

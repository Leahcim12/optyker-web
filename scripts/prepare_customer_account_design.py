"""Attach the customer design to the existing authenticated renderer; no new login or business API."""
from pathlib import Path
import hashlib,re
p=Path('shopify-warranty/native-account.js');s=p.read_text()
if 'OPTYKER_ACCOUNT_DESIGN' not in s:
 assert hashlib.sha256(p.read_bytes()).hexdigest()=='3f899020d48ed540f259f5893e5edd225dbab91a375a35e228860e95fc3018e0','Concurrent account source change requires review'
 s=s.replace("function select(v){if(window.OPTYKER_SHOP_COVER)","function select(v){if(window.OPTYKER_ACCOUNT_DESIGN)window.OPTYKER_ACCOUNT_DESIGN.onView(root,v);if(window.OPTYKER_SHOP_COVER)",1)
 s=s.replace("setActive(v);if(v==='eyewear')", "setActive(v);if(v==='dashboard'&&window.OPTYKER_ACCOUNT_DESIGN){window.OPTYKER_ACCOUNT_DESIGN.dashboard(panel,{profile:getData,eyewear:function(){return coverRequest('list',{})},select:select,valid:function(){return current==='dashboard'&&root.isConnected},retry:function(){profilePromise=null;select('dashboard')}});return;}if(v==='eyewear')",1)
 helper="""function coverRequest(action,payload){return fetch('https://whgziwaegjzqsgcntesr.supabase.co/functions/v1/optyker-eyewear-cover-site',{method:'POST',cache:'no-store',referrerPolicy:'no-referrer',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:token,action:action,payload:payload||{}}),signal:AbortSignal.timeout(25000)}).then(function(r){return r.json().then(function(x){if(!r.ok||!x.ok)throw new Error(x.error||'Dati non disponibili');return x})});} """
 s=s.replace('function select(v){',helper+'function select(v){',1)
 old="root.querySelectorAll('.ovcANav button').forEach(function(b){b.onclick=function(){select(b.getAttribute('data-view'))}});select('rx')}"
 new="if(window.OPTYKER_ACCOUNT_DESIGN)window.OPTYKER_ACCOUNT_DESIGN.mount(root,select);root.querySelectorAll('.ovcANav button').forEach(function(b){b.onclick=function(){select(b.getAttribute('data-view'))}});select(window.OPTYKER_ACCOUNT_DESIGN?window.OPTYKER_ACCOUNT_DESIGN.initialView():'rx')}"
 assert s.count(old)==1;s=s.replace(old,new)
 s=s.replace("legacy.style.setProperty('display','none','important');if(!token)","if(!token)")
 s=s.replace("root=document.createElement('div');root.className='ovcAShell';", "legacy.style.setProperty('display','none','important');root=document.createElement('div');root.className='ovcAShell';",1)
 p.write_text(s)
# Preserve complete SQL/security tests; navigate the actual collapsible mobile menu.
p=Path('tests/cover-channels.test.mjs');s=p.read_text()
s=s.replace("assert.equal(await page.locator('#ovc-account-native .ovcANav button').count(),8);","assert.equal(await page.locator('#ovc-account-native .ovcANav button').count(),9);")
needle="  try{\n   await page.goto('https://otticavisualcare.it/pages/la-mia-scheda-optyker'"
replacement="  const go=async v=>{const t=page.locator('.ovcDMenuToggle');if(await t.isVisible()&&!(await page.locator('.ovcANav').isVisible()))await t.tap();await page.locator('[data-view='+v+']').tap();};\n  try{\n   await page.goto('https://otticavisualcare.it/pages/la-mia-scheda-optyker'"
assert needle in s;s=s.replace(needle,replacement)
s=re.sub(r"await page\.locator\('\[data-view=(\w+)\]'\)\.tap\(\)",lambda m:"await go('"+m[1]+"')",s)
s=s.replace('eight navigation buttons','nine navigation buttons')
Path('tests/customer-account-warranty-regression.mjs').write_text(s)

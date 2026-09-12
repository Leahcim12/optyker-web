"""Install OVC Card, cart repricing, eyewear-to-laboratory flow and Operations skin.
Runs after existing cart/Esoform patches; never replaces their business rules.
"""
from pathlib import Path
import hashlib,json,os,re,shutil,sys
ROOT=Path(__file__).resolve().parent.parent
SITE=Path(sys.argv[1]) if len(sys.argv)>1 else Path('_site')
VERSION='20260910-ovc2'
# Preserve the current cashier release after earlier catalog/theme patches.
cash_version_match=re.search(r"window\.OPTYKER_CASH_BUILD='([A-Za-z0-9_.-]+)'",(ROOT/'cash-register.js').read_text())
if not cash_version_match:raise SystemExit('Cash source release version missing')
CASH_VERSION=cash_version_match[1]
def one(s,old,new):
 if s.count(old)!=1:raise SystemExit('OVC contract missing/ambiguous: '+old[:110])
 return s.replace(old,new,1)
def in_script(html,id,fn):
 pat=r'(<script\b[^>]*id="'+re.escape(id)+r'"[^>]*>)(.*?)(</script>)'
 m=re.search(pat,html,re.S)
 if not m:raise SystemExit('OVC script not found: '+id)
 return html[:m.start(2)]+fn(m[2])+html[m.end(2):]
page=SITE/'index.html';h=page.read_text()
if 'data-ovc-ui=' not in h:
 h=h.replace('<html ', '<html data-ovc-ui="2" ',1)
 h=h.replace('</head>','<link id="optykerOperationsCss" rel="stylesheet" media="screen" href="/optyker-operations.css?v='+VERSION+'">\n<script id="optykerOperationsJs" defer src="/optyker-operations.js?v='+VERSION+'"></script>\n</head>',1)
 def eye9(s):
  marker='window.optykerEyewearOrderBridge='
  if marker in s:return s
  # Within V9 closure, after the pricing/validation additions.
  pos=s.rfind('})();')
  if pos<0:raise SystemExit('V9 closure end not found')
  return s[:pos]+(ROOT/'eyewear-laboratory-bridge.js').read_text()+'\n'+s[pos:]
 h=in_script(h,'optykerEyewearFlowV9Inline',eye9)
 h=in_script(h,'optykerEyewearJs',lambda s:one(s,'  window.openEyewearSheet=openEyewear;', '  window.optykerEyewearRecentRows=function(){return S.recent.slice(0,15)};\n  window.openEyewearSheet=openEyewear;'))
 def lab(s):
  s=s.replace("'/rest/v1/rpc/optyker_api_legacy_passwordless'","'/rest/v1/rpc/optyker_api'")
  s=s.replace("p_password:''","p_password:String(OPTYKER_CLOUD.password||'')")
  s=one(s,'<span class="labPill">LAC · BUSTA</span>', '<span class="labPill">\'+(o.order_type===\'eyewear_busta\'?\'OCCHIALI · BUSTA\':\'LAC · BUSTA\')+\'</span>')
  s=s.replace('Ordini LAC inviati dalle buste. Lo stato parte da Da fare; quando passa a In preparazione, dopo 24 ore diventa automaticamente Costruzione.','Buste Occhiali e LAC. Da fare → In preparazione → In costruzione → In spedizione. I passaggi automatici rispettano il fine settimana.')
  s=s.replace('Dopo 24 ore passerà automaticamente a Costruzione.','Passaggio automatico a In costruzione: dopo 24 ore da lunedì a giovedì; da venerdì a domenica, lunedì alle 09:00.')
  s=s.replace("costruzione:'Costruzione'","costruzione:'In costruzione'").replace('>Costruzione</option>','>In costruzione</option>')
  anchor="    if(st.odProductName)"
  code="""    if(o.order_type==='eyewear_busta'){
      var fr=snap.frame||{},l=snap.lens||{};
      arr.push('Montatura · '+[fr.type,fr.brand,fr.model,fr.color,fr.barcode].filter(Boolean).join(' · '));
      arr.push('Lente DX · '+[l.lens_type_od,l.lens_od&&l.lens_od.brand,l.lens_od&&l.lens_od.lens_name].filter(Boolean).join(' · '));
      arr.push('Lente SX · '+[l.lens_type_os,l.lens_os&&l.lens_os.brand,l.lens_os&&l.lens_os.lens_name].filter(Boolean).join(' · '));
      arr.push('Trattamenti · '+(Array.isArray(l.treatments)?l.treatments.join(', '):'—'));
      arr.push('Indice / colore / montaggio · '+[l.refractive_index,l.color_mode,l.color,l.mounting].filter(Boolean).join(' · '));
      if(snap.notes)arr.push('Note · '+snap.notes);
      return arr;
    }
"""
  s=one(s,anchor,code+anchor)
  return s
 h=in_script(h,'optykerLaboratoryScript',lab)
 h=re.sub(r'(optyker-vision\.js)\?[^\"\'< >\s]+',lambda m:m[1]+'?v='+VERSION,h)
# Also refresh already assembled pages, without replacing their business scripts.
h=re.sub(r'(cash-register\.js)\?[^\"\'< >\s]+',lambda m:m[1]+'?v='+CASH_VERSION,h)
page.write_text(h)
for alias in ('gestionale-v2','gestionale-v3'):
 t=SITE/alias/'index.html'
 if t.is_file():t.write_text(h)
# Remove the sidebar entry, retaining both existing cash entry points.
p=SITE/'optyker-vision.js';s=p.read_text()
nav="    const cashNav=document.createElement('button');cashNav.type='button';cashNav.className='moduleBtn';cashNav.id='visionNavCash';cashNav.textContent='Cassa';cashNav.onclick=()=>action('cash');nav.append(cashNav);"
if nav in s:s=one(s,nav,'    // Cassa remains in dashboard and customer profile, not in sidebar.')
p.write_text(s)
p=SITE/'cash-register.js';s=p.read_text()
if 'function ovcCartKey' not in s:
 s=one(s,"E('optykerCashClient').onchange=function(){S.clientId=this.value||'';updateInvoiceAvailability();updateTsAvailability()}","E('optykerCashClient').onchange=function(){if(S.busy)return;S.clientId=this.value||'';updateInvoiceAvailability();updateTsAvailability();ovcInvalidate()}")
 s=one(s,"api('products',{search:q,first:70,force:!!force})","api('products',{search:q,first:70,force:!!force,client_id:S.clientId||''})")
 s=one(s,'function add(id){','function add(id){\n  if(S.busy)return;')
 s=one(s,'function qty(id,d){if(!S.cart[id])return;S.cart[id].qty+=d;', 'function qty(id,d){if(S.busy||!S.cart[id])return;S.cart[id].qty=Math.min(99,S.cart[id].qty+d);')
 s=one(s,'function removeLine(id){delete S.cart[id];','function removeLine(id){if(S.busy)return;delete S.cart[id];')
 pos=s.rfind('})();')
 s=s[:pos]+(ROOT/'cash-ovc-pricing.js').read_text()+'\n'+s[pos:]
s=re.sub(r"window.OPTYKER_CASH_BUILD='[^']+'","window.OPTYKER_CASH_BUILD='"+CASH_VERSION+"'",s)
p.write_text(s)
for name in ('optyker-operations.css','optyker-operations.js','ovc-card-logo.png'):
 shutil.copyfile(ROOT/name,SITE/name)
# Earlier public verifiers still describe unchanged releases; refresh changed hashes.
for filename in ('cart-privacy-version.json',):
 p=SITE/filename
 if p.is_file():
  m=json.loads(p.read_text())
  for name in m.get('assets',{}):m['assets'][name]=hashlib.sha256((SITE/name).read_bytes()).hexdigest()
  p.write_text(json.dumps(m,indent=2)+'\n')
release={'version':VERSION,'commit':os.environ.get('VERCEL_GIT_COMMIT_SHA') or os.environ.get('GITHUB_SHA',''),'assets':{n:hashlib.sha256((SITE/n).read_bytes()).hexdigest() for n in ('optyker-operations.css','optyker-operations.js','ovc-card-logo.png','cash-register.js','optyker-vision.js')}}
(SITE/'operations-version.json').write_text(json.dumps(release,indent=2)+'\n')
print('OVC Operations installed; existing clinical calculations and Esoform pricing retained')

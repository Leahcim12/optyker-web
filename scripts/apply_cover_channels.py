"""Publish immutable Shopify page assets without changing the live theme."""
from pathlib import Path
import hashlib,json,os
root=Path(__file__).resolve().parent.parent;site=root/'_site';out=site/'shopify-warranty';out.mkdir(exist_ok=True)
assets={};names={}
for name in ('native-account.css','eyewear-cover.css','eyewear-cover.js','native-account.js','account-design.css','account-design.js'):
 raw=(root/'shopify-warranty'/name).read_bytes();digest=hashlib.sha256(raw).hexdigest();p=Path(name);target=p.stem+'.'+digest[:12]+p.suffix;(out/target).write_bytes(raw);assets['shopify-warranty/'+target]=digest;names[name]=target
base='https://www.optyker.it/shopify-warranty/'
body='<link id="optyker-account-native-v8-style" rel="stylesheet" href="'+base+names['native-account.css']+'">\n'
body+='<link id="optyker-shop-warranty-style" rel="stylesheet" href="'+base+names['eyewear-cover.css']+'">\n'
body+='<script id="optyker-shop-warranty" src="'+base+names['eyewear-cover.js']+'" defer referrerpolicy="no-referrer"></script>\n'
body+='<link id="optyker-account-design-style" rel="stylesheet" href="'+base+names['account-design.css']+'">\n'
body+='<script id="optyker-account-design" src="'+base+names['account-design.js']+'" defer referrerpolicy="no-referrer"></script>\n'
body+='<script id="optyker-account-native-v8" src="'+base+names['native-account.js']+'" defer referrerpolicy="no-referrer"></script>\n'
body+='''<section id="ovc-design-welcome" aria-label="Area personale Ottica Visual Care"><span class="ovcDKicker">OTTICA VISUAL CARE / IL TUO SPAZIO</span><h2>La tua visione,<br>sempre con te.</h2><p>Ordini, prescrizione, occhiali e garanzie.<br>Accedi per ritrovare i tuoi dati e parlare con il centro ottico.</p><div class="ovcDGuestLinks"><a class="ovcDBtn ovcDBtnPrimary" href="https://shopify.com/91742896503/account">Accedi all’account Shopify →</a><a class="ovcDBtn" href="/pages/prenota-il-tuo-appuntamento-a-lallio">Prenota un appuntamento →</a></div></section>\n'''
(site/'shopify-warranty-page-body.html').write_text(body)
meta={'version':'20260912-cover-channels1','commit':os.environ.get('VERCEL_GIT_COMMIT_SHA') or os.environ.get('GITHUB_SHA',''),'assets':assets,'page_body_sha256':hashlib.sha256(body.encode()).hexdigest()}
(site/'warranty-channels-version.json').write_text(json.dumps(meta,indent=2)+'\n')
meta['version']='20260912-account-design1'
(site/'shopify-account-design-version.json').write_text(json.dumps(meta,indent=2)+'\n')
print('Optyker-style customer dashboard and shared eyewear warranty assets built')

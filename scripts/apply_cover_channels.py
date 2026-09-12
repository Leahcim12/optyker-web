"""Publish immutable Shopify page assets without changing the live theme."""
from pathlib import Path
import hashlib,json,os
root=Path(__file__).resolve().parent.parent;site=root/'_site';out=site/'shopify-warranty';out.mkdir(exist_ok=True)
assets={};names={}
for name in ('native-account.css','eyewear-cover.css','eyewear-cover.js','native-account.js'):
 raw=(root/'shopify-warranty'/name).read_bytes();digest=hashlib.sha256(raw).hexdigest();p=Path(name);target=p.stem+'.'+digest[:12]+p.suffix;(out/target).write_bytes(raw);assets['shopify-warranty/'+target]=digest;names[name]=target
base='https://www.optyker.it/shopify-warranty/'
body='<link id="optyker-account-native-v8-style" rel="stylesheet" href="'+base+names['native-account.css']+'">\n'
body+='<link id="optyker-shop-warranty-style" rel="stylesheet" href="'+base+names['eyewear-cover.css']+'">\n'
body+='<script id="optyker-shop-warranty" src="'+base+names['eyewear-cover.js']+'" defer referrerpolicy="no-referrer"></script>\n'
body+='<script id="optyker-account-native-v8" src="'+base+names['native-account.js']+'" defer referrerpolicy="no-referrer"></script>\n'
(site/'shopify-warranty-page-body.html').write_text(body)
(site/'warranty-channels-version.json').write_text(json.dumps({'version':'20260912-cover-channels1','commit':os.environ.get('VERCEL_GIT_COMMIT_SHA') or os.environ.get('GITHUB_SHA',''),'assets':assets,'page_body_sha256':hashlib.sha256(body.encode()).hexdigest()},indent=2)+'\n')
print('Shared Shopify eyewear warranty interface and content-addressed account assets built')

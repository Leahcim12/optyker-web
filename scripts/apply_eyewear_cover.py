"""Install after all prior UI patches. Hashed files defeat mixed cached modules."""
from pathlib import Path
import hashlib,json,os
root=Path(__file__).resolve().parent.parent;site=root/'_site';assets={}
def asset(src):
 raw=(root/src).read_bytes();h=hashlib.sha256(raw).hexdigest();p=Path(src);name=p.stem+'.'+h[:12]+p.suffix;(site/name).write_bytes(raw);assets[name]=h;return name
css=asset('eyewear-cover.css');app=asset('iphone-app-v13/eyewear-cover.js');staff=asset('eyewear-cover-staff.js')
p=site/'iphone-app-v13/index.html';s=p.read_text();assert 'optykerAppCoverJs' not in s
# Classic deferred script sees the app's existing lexical state and render functions.
s=s.replace('</body>','<link id="optykerAppCoverCss" rel="stylesheet" href="../'+css+'"><script id="optykerAppCoverJs" src="../'+app+'"></script></body>');p.write_text(s)
# Embed staff controls after all existing integrations in the actual hashed client detail file.
s=(site/'index.html').read_text();mfile=site/'client-sheets-version.json';m=json.loads(mfile.read_text());old=next(k for k in m['assets'] if k.startswith('client-sheet-actions.') and k.endswith('.js'));j=(site/old).read_text();anchor='window.OPTYKER_EYEWEAR_DELIVERY?.attach(box,s);';assert j.count(anchor)==1
j=j.replace(anchor,anchor+'window.OPTYKER_COVER_STAFF?.attach(box,s);');raw=j.encode();h=hashlib.sha256(raw).hexdigest();new='client-sheet-actions.'+h[:12]+'.js';(site/new).write_bytes(raw);assets[new]=h;s=s.replace(old,new)
for mf in ['client-sheets-version.json','materials-certificate-version.json','eyewear-delivery-version.json']:
 p=site/mf;x=json.loads(p.read_text())
 if old in x['assets']:x['assets'].pop(old);x['assets'][new]=h;p.write_text(json.dumps(x,indent=2))
s=s.replace('</head>','<link id="optykerCoverStaffCss" rel="stylesheet" href="/'+css+'"><script id="optykerCoverStaffJs" defer src="/'+staff+'"></script></head>',1)
for name in ['index.html','gestionale-v2/index.html','gestionale-v3/index.html']:
 p=site/name
 if p.exists():p.write_text(s)
manifest=site/'eyewear-cover-version.json';manifest.write_text(json.dumps({'version':'20260912-eyewear-cover1','commit':os.getenv('VERCEL_GIT_COMMIT_SHA') or os.getenv('GITHUB_SHA',''),'assets':assets},indent=2)+'\n')
print('Eyewear warranty buttons, authenticated claims and staff controls installed')

"""Install after all prior UI patches. Hashed files defeat mixed cached modules."""
from pathlib import Path
import hashlib,json,os,re
root=Path(__file__).resolve().parent.parent;site=root/'_site';assets={}
def asset(src):
 raw=(root/src).read_bytes();h=hashlib.sha256(raw).hexdigest();p=Path(src);name=p.stem+'.'+h[:12]+p.suffix;(site/name).write_bytes(raw);assets[name]=h;return name
css=asset('eyewear-cover.css');app=asset('iphone-app-v13/eyewear-cover.js');staff=asset('eyewear-cover-staff.js')
# Customer app: replace an existing hashed cover tag or insert once.
p=site/'iphone-app-v13/index.html';s=p.read_text();app_css='<link id="optykerAppCoverCss" rel="stylesheet" href="../'+css+'">';app_js='<script id="optykerAppCoverJs" src="../'+app+'"></script>'
if 'optykerAppCoverCss' in s:
 s,n=re.subn(r'<link\b[^>]*id="optykerAppCoverCss"[^>]*>',lambda _m:app_css,s,count=1)
 if n!=1:raise SystemExit('Existing optykerAppCoverCss tag could not be replaced')
else:s=s.replace('</body>',app_css+'</body>',1)
if 'optykerAppCoverJs' in s:
 s,n=re.subn(r'<script\b[^>]*id="optykerAppCoverJs"[^>]*>\s*</script>',lambda _m:app_js,s,count=1,flags=re.S)
 if n!=1:raise SystemExit('Existing optykerAppCoverJs tag could not be replaced')
else:s=s.replace('</body>',app_js+'</body>',1)
p.write_text(s)
# Embed staff controls after all existing integrations in the actual hashed client detail file.
s=(site/'index.html').read_text();mfile=site/'client-sheets-version.json';m=json.loads(mfile.read_text());old=next(k for k in m['assets'] if k.startswith('client-sheet-actions.') and k.endswith('.js'));j=(site/old).read_text();anchor='window.OPTYKER_EYEWEAR_DELIVERY?.attach(box,s);';cover_call='window.OPTYKER_COVER_STAFF?.attach(box,s);'
if cover_call not in j:
 assert j.count(anchor)==1
 j=j.replace(anchor,anchor+cover_call,1)
raw=j.encode();h=hashlib.sha256(raw).hexdigest();new='client-sheet-actions.'+h[:12]+'.js';(site/new).write_bytes(raw);assets[new]=h;s=s.replace(old,new)
for mf in ['client-sheets-version.json','materials-certificate-version.json','eyewear-delivery-version.json']:
 p=site/mf;x=json.loads(p.read_text())
 if old in x['assets']:x['assets'].pop(old);x['assets'][new]=h;p.write_text(json.dumps(x,indent=2))
staff_css='<link id="optykerCoverStaffCss" rel="stylesheet" href="/'+css+'">';staff_js='<script id="optykerCoverStaffJs" defer src="/'+staff+'"></script>'
for tagid,tag,pattern in [
 ('optykerCoverStaffCss',staff_css,r'<link\b[^>]*id="optykerCoverStaffCss"[^>]*>'),
 ('optykerCoverStaffJs',staff_js,r'<script\b[^>]*id="optykerCoverStaffJs"[^>]*>\s*</script>')]:
 if tagid in s:
  s,n=re.subn(pattern,lambda _m,tag=tag:tag,s,count=1,flags=re.S)
  if n!=1:raise SystemExit('Existing '+tagid+' tag could not be replaced')
 else:s=s.replace('</head>',tag+'</head>',1)
for name in ['index.html','gestionale-v2/index.html','gestionale-v3/index.html']:
 p=site/name
 if p.exists():p.write_text(s)
manifest=site/'eyewear-cover-version.json';manifest.write_text(json.dumps({'version':'20260912-eyewear-cover1','commit':os.getenv('VERCEL_GIT_COMMIT_SHA') or os.getenv('GITHUB_SHA',''),'assets':assets},indent=2)+'\n')
print('Eyewear warranty buttons, authenticated claims and staff controls installed')

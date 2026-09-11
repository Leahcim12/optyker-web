"""Add the signed delivery flow to saved buste without replacing any existing module."""
from pathlib import Path
import hashlib,json,os
root=Path(__file__).resolve().parent.parent;site=root/'_site';s=(site/'index.html').read_text()
mfile=site/'client-sheets-version.json';m=json.loads(mfile.read_text());old=next(n for n in m['assets'] if n.endswith('.js'));j=(site/old).read_text()
anchor='window.OPTYKER_MATERIAL_CERTIFICATE?.attach(box,s);'
assert j.count(anchor)==1
j=j.replace(anchor,anchor+'window.OPTYKER_EYEWEAR_DELIVERY?.attach(box,s);')
b=j.encode();digest=hashlib.sha256(b).hexdigest();new='client-sheet-actions.'+digest[:12]+'.js';(site/new).write_bytes(b);s=s.replace(old,new);m['assets'].pop(old);m['assets'][new]=digest;mfile.write_text(json.dumps(m,indent=2))
# Keep the previous module's integrity manifest accurate after integration.
mm=site/'materials-certificate-version.json';mv=json.loads(mm.read_text());mv['assets'].pop(old,None);mv['assets'][new]=digest;mm.write_text(json.dumps(mv,indent=2))
assets={new:digest};schema=(root/'delivery-schema.mjs').read_bytes();sh=hashlib.sha256(schema).hexdigest();sn='delivery-schema.'+sh[:12]+'.mjs';(site/sn).write_bytes(schema);assets[sn]=sh
for filename,tagid in [('eyewear-delivery.mjs','optykerEyewearDeliveryJs'),('eyewear-delivery.css','optykerEyewearDeliveryCss')]:
 b=(root/filename).read_bytes()
 if filename.endswith('.mjs'):b=b.replace(b'./delivery-schema.mjs',('./'+sn).encode())
 dg=hashlib.sha256(b).hexdigest();p=Path(filename);name=p.stem+'.'+dg[:12]+p.suffix;(site/name).write_bytes(b);assets[name]=dg
 tag='<script id="'+tagid+'" type="module" src="/'+name+'"></script>' if name.endswith('.mjs') else '<link id="'+tagid+'" rel="stylesheet" href="/'+name+'">'
 assert tagid not in s;s=s.replace('</head>',tag+'</head>',1)
for n in ['index.html','gestionale-v2/index.html','gestionale-v3/index.html']:
 if (site/n).exists():(site/n).write_text(s)
(site/'eyewear-delivery-version.json').write_text(json.dumps({'version':'20260911-delivery1','commit':os.getenv('VERCEL_GIT_COMMIT_SHA') or os.getenv('GITHUB_SHA',''),'assets':assets},indent=2))
print('Signed delivery, care instructions and exact archived PDF added to Buste Occhiali')

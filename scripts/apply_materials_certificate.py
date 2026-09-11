"""Attach materials certificates to the assembled job detail and editor, not quotes."""
from pathlib import Path
import hashlib,json,os,re
root=Path(__file__).resolve().parent.parent;site=root/'_site';entry=site/'index.html';s=entry.read_text()
manifest=site/'client-sheets-version.json';m=json.loads(manifest.read_text())
old=next(x for x in m['assets'] if x.endswith('.js'))
js=(site/old).read_text()
anchor="feedback(s.converted_order?'Ordine collegato: '"
assert js.count(anchor)==1,'Client detail changed: review integration before release'
js=js.replace(anchor,"window.OPTYKER_MATERIAL_CERTIFICATE?.attach(box,s);\n "+anchor)
raw=js.encode();digest=hashlib.sha256(raw).hexdigest();name='client-sheet-actions.'+digest[:12]+'.js';(site/name).write_bytes(raw)
s=s.replace(old,name);m['assets'].pop(old);m['assets'][name]=digest;manifest.write_text(json.dumps(m,indent=2)+'\n')
assets={name:digest}
for filename,tagid in [('materials-certificate.js','optykerMaterialsCertificateJs'),('materials-certificate.css','optykerMaterialsCertificateCss')]:
 raw=(root/filename).read_bytes();digest=hashlib.sha256(raw).hexdigest();p=Path(filename);name=p.stem+'.'+digest[:12]+p.suffix
 (site/name).write_bytes(raw);assets[name]=digest
 tag=('<script id="'+tagid+'" defer src="/'+name+'"></script>') if name.endswith('.js') else ('<link id="'+tagid+'" rel="stylesheet" href="/'+name+'">')
 assert tagid not in s
 s=s.replace('</head>',tag+'</head>',1)
for name in ('index.html','gestionale-v2/index.html','gestionale-v3/index.html'):
 if (site/name).exists():(site/name).write_text(s)
(site/'materials-certificate-version.json').write_text(json.dumps({'version':'20260911-materials1','commit':os.environ.get('VERCEL_GIT_COMMIT_SHA') or os.environ.get('GITHUB_SHA',''),'assets':assets},indent=2)+'\n')
print('Materials certificate installed on saved Buste Occhiali and client detail')

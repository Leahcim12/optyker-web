"""Package the prescription extension in the actual desktop entry points."""
from pathlib import Path
import hashlib,json,os,re

root=Path(__file__).resolve().parent.parent
site=root/'_site'
assets={}
tags=[]
for name,kind in [('prescription-ophthalmic.js','script'),('prescription-ophthalmic.css','style')]:
    raw=(root/name).read_bytes(); digest=hashlib.sha256(raw).hexdigest()
    p=Path(name); filename=p.stem+'.'+digest[:12]+p.suffix
    (site/filename).write_bytes(raw);assets[filename]=digest
    if kind=='script':tags.append('<script id="optykerOphthalmicJs" defer src="/'+filename+'"></script>')
    else:tags.append('<link id="optykerOphthalmicCss" rel="stylesheet" href="/'+filename+'">')
for name in ['index.html','gestionale-v2/index.html','gestionale-v3/index.html']:
    path=site/name;html=path.read_text()
    html=re.sub(r'<script[^>]*id="optykerOphthalmicJs"[^>]*></script>','',html)
    html=re.sub(r'<link[^>]*id="optykerOphthalmicCss"[^>]*>','',html)
    assert 'id="prescriptionPanel"' in html and '</head>' in html
    html=html.replace('</head>','\n'.join(tags)+'\n</head>',1);path.write_text(html)
(site/'ophthalmic-version.json').write_text(json.dumps({'version':'20260915-ophthalmic1','commit':os.environ.get('VERCEL_GIT_COMMIT_SHA') or os.environ.get('GITHUB_SHA',''),'assets':assets},indent=2)+'\n')
print('Ophthalmic prescriptions and shared oculist selector included in desktop entry points')

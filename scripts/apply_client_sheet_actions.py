"""Add client actions after existing stable release without replacing app modules."""
from pathlib import Path
import hashlib,json,os
root=Path(__file__).resolve().parent.parent;site=root/'_site';p=site/'index.html';s=p.read_text();assets={}
for name in ('client-sheet-actions.js','client-sheet-actions.css'):
 raw=(root/name).read_bytes();digest=hashlib.sha256(raw).hexdigest();path=Path(name);fn=path.stem+'.'+digest[:12]+path.suffix
 (site/fn).write_bytes(raw);assets[fn]=digest
 tag=('<script id="optykerClientSheetActionsJs" defer src="/'+fn+'"></script>') if name.endswith('.js') else ('<link id="optykerClientSheetActionsCss" rel="stylesheet" href="/'+fn+'">')
 if tag not in s:s=s.replace('</head>',tag+'</head>',1)
for name in ('index.html','gestionale-v2/index.html','gestionale-v3/index.html'):
 if (site/name).exists():(site/name).write_text(s)
manifest={'version':'20260911-client-sheets1','commit':os.environ.get('VERCEL_GIT_COMMIT_SHA') or os.environ.get('GITHUB_SHA',''),'assets':assets}
(site/'client-sheets-version.json').write_text(json.dumps(manifest,indent=2)+'\n')
print('Client sheet actions linked to the actual app build')

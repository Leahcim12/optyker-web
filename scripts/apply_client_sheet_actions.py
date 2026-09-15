"""Add client actions after existing stable release without replacing app modules."""
from pathlib import Path
import hashlib,json,os
root=Path(__file__).resolve().parent.parent;site=root/'_site';p=site/'index.html';s=p.read_text();assets={}
for name in ('client-sheet-actions.js','client-sheet-edit.js','client-sheet-actions.css'):
 raw=(root/name).read_bytes();digest=hashlib.sha256(raw).hexdigest();path=Path(name);fn=path.stem+'.'+digest[:12]+path.suffix
 (site/fn).write_bytes(raw);assets[fn]=digest
 if name=='client-sheet-actions.js': tag='<script id="optykerClientSheetActionsJs" defer src="/'+fn+'"></script>'
 elif name=='client-sheet-edit.js': tag='<script id="optykerClientSheetEditJs" defer src="/'+fn+'"></script>'
 else: tag='<link id="optykerClientSheetActionsCss" rel="stylesheet" href="/'+fn+'">'
 if tag not in s:s=s.replace('</head>',tag+'</head>',1)
for name in ('index.html','gestionale-v2/index.html','gestionale-v3/index.html'):
 if (site/name).exists():(site/name).write_text(s)
manifest={'version':'20260915-client-sheets2','commit':os.environ.get('VERCEL_GIT_COMMIT_SHA') or os.environ.get('GITHUB_SHA',''),'assets':assets}
(site/'client-sheets-version.json').write_text(json.dumps(manifest,indent=2)+'\n')
print('Client sheet actions and in-place editing linked to the actual app build')

import runpy
runpy.run_path(str(root/'scripts/apply_materials_certificate.py'))

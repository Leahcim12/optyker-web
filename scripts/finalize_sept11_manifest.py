from pathlib import Path
import json,hashlib,os
site=Path('_site')
for name in ('sept11-version.json','operations-version.json','cart-privacy-version.json'):
 p=site/name
 if not p.exists():continue
 x=json.loads(p.read_text())
 x['commit']=os.environ.get('VERCEL_GIT_COMMIT_SHA') or os.environ.get('GITHUB_SHA','')
 for a in x.get('assets',{}):
  if (site/a).exists():x['assets'][a]=hashlib.sha256((site/a).read_bytes()).hexdigest()
 p.write_text(json.dumps(x,indent=2)+'\n')

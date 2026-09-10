"""Resolve assembled desktop assets at the actual public hosting base.

Vercel serves at /; GitHub Pages serves the repository at /optyker-web/.
Only literal URLs for existing local assets are changed. API endpoints,
authentication and separately maintained mobile bundles are not modified.
"""
import hashlib
import json
import os
from pathlib import Path
import re
import sys

site = Path(sys.argv[1]) if len(sys.argv) > 1 else Path('_site')
base = '/'
if os.environ.get('GITHUB_PAGES', '').lower() == 'true':
    repo = os.environ.get('GITHUB_REPOSITORY', 'Leahcim12/optyker-web').split('/')[-1]
    if not re.fullmatch(r'[A-Za-z0-9_.-]+', repo):
        raise SystemExit('Invalid GitHub Pages repository path')
    base = '/' + repo + '/'

assets = sorted(p.name for p in site.iterdir() if p.is_file() and p.suffix in {'.js', '.css', '.svg', '.webp', '.png', '.jpg', '.ico'})
if not assets:
    raise SystemExit('Public paths: no assembled assets found')
pattern = re.compile(r'(?P<quote>[\"\'])/(?P<asset>' + '|'.join(re.escape(a) for a in assets) + r')(?=[?\"\'])')
entry_points = [site / 'index.html'] + [site / alias / 'index.html' for alias in ('gestionale-v2', 'gestionale-v3')]
changed = 0
for path in entry_points + [site / a for a in assets if a.endswith(('.js', '.css'))]:
    if not path.is_file():
        continue
    source = path.read_text(encoding='utf-8')
    if base != '/':
        source, count = pattern.subn(lambda m: m['quote'] + base + m['asset'], source)
        changed += count
    path.write_text(source, encoding='utf-8')

for path in entry_points:
    if not path.is_file():
        continue
    html = path.read_text(encoding='utf-8')
    for name in ('optyker-aurora.css', 'optyker-vision.css', 'optyker-vision.js'):
        if '"' + base + name + '?' not in html:
            raise SystemExit('Public paths: missing correct asset URL in ' + str(path) + ': ' + name)

release = {
    'design': '20260910-vision1',
    'asset_paths': '20260910-paths2',
    'commit': os.environ.get('VERCEL_GIT_COMMIT_SHA') or os.environ.get('GITHUB_SHA', ''),
    'base_path': base,
    'assets': {name: hashlib.sha256((site / name).read_bytes()).hexdigest()
               for name in ('optyker-aurora.css', 'optyker-vision.css', 'optyker-vision.js', 'optyker-vision-eye.webp')}
}
(site / 'design-version.json').write_text(json.dumps(release, indent=2) + '\n', encoding='utf-8')
print('Public asset paths verified: ' + base + '; literal asset references updated: ' + str(changed))

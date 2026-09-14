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

# Physical POS channel split: a checkout that will print a real RCH receipt must
# be registered only in Optyker POS. It must never create a Shopify order.
# Product lookup, customer lookup, history and online/app channels keep using
# their existing APIs. The replacement is deliberately narrow and idempotent.
cash = site / 'cash-register.js'
if cash.is_file():
    source = cash.read_text(encoding='utf-8')
    legacy = "var API='https://whgziwaegjzqsgcntesr.supabase.co/functions/v1/optyker-cash-register-api';"
    local_decl = "var LOCAL_API='https://whgziwaegjzqsgcntesr.supabase.co/functions/v1/optyker-cash-local-api';"
    if local_decl not in source:
        if legacy not in source:
            raise SystemExit('Cash channel split: legacy API declaration not found')
        source = source.replace(legacy, legacy + '\n' + local_decl, 1)
    old_fetch = "  return fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:action,username:c.username,password:c.password,payload:payload||{}})})"
    new_fetch = "  var endpoint=(action==='checkout'&&payload&&payload.auto_receipt===true)?LOCAL_API:API;\n  return fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:action,username:c.username,password:c.password,payload:payload||{}})})"
    if new_fetch not in source:
        if old_fetch not in source:
            raise SystemExit('Cash channel split: API fetch call not found')
        source = source.replace(old_fetch, new_fetch, 1)
    cash.write_text(source, encoding='utf-8')
    if 'optyker-cash-local-api' not in source or "action==='checkout'&&payload&&payload.auto_receipt===true" not in source:
        raise SystemExit('Cash channel split verification failed')

# Force browsers/iPadOS to fetch the channel-split POS instead of the previously
# cached 20260913 build.
for path in entry_points:
    if not path.is_file():
        continue
    html = path.read_text(encoding='utf-8')
    html = re.sub(r'(cash-register\.js\?v=)[^\"\']+', r'\g<1>20260914-channel2', html)
    path.write_text(html, encoding='utf-8')

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

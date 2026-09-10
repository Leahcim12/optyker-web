"""Install the screen-only Chat, Cassa and Documenti design after Workspace.

Fail closed on template changes. Preserve existing scripts, form controls and
all inline event handlers. Run before patch_public_asset_paths.py.
"""
from pathlib import Path
import hashlib
import json
import os
import re
import shutil
import sys

VERSION = '20260910-services1'
REPO = Path(__file__).resolve().parent.parent
SITE = Path(sys.argv[1]) if len(sys.argv) > 1 else Path('_site')
p = SITE / 'index.html'
s = p.read_text(encoding='utf-8')
for marker in ('id="mainApp"', 'id="optykerChatPanel"', 'id="optykerDocumentsJs"', 'id="optykerCashJs"', 'id="optykerWorkspaceJs"', '</head>'):
    if marker not in s:
        raise SystemExit('Services: expected desktop marker missing: ' + marker)
s = re.sub(r'<link\b[^>]*id="optykerServicesCss"[^>]*>\s*', '', s)
s = re.sub(r'<script\b[^>]*id="optykerServicesJs"[^>]*>.*?</script>\s*', '', s, flags=re.S)
s = re.sub(r'\sdata-optyker-services-release="[^"]*"', '', s, count=1)
s = re.sub(r'\sdata-ops="[^"]*"', '', s, count=1)
script_pattern = r'<script\b[^>]*>.*?</script>'
control_pattern = r'<(?:input|select|textarea|button)\b[^>]*>'
scripts_before = re.findall(script_pattern, s, re.S)
controls_before = re.findall(control_pattern, s, re.S)
s = re.sub(r'(<html\b[^>]*)(>)', lambda m: m[1] + ' data-optyker-services-release="' + VERSION + '" data-ops="services"' + m[2], s, count=1)
tags = ('<link id="optykerServicesCss" rel="stylesheet" media="screen" href="/optyker-services.css?v=' + VERSION + '">\n'
        '<script id="optykerServicesJs" defer src="/optyker-services.js?v=' + VERSION + '"></script>\n')
s = s.replace('</head>', tags + '</head>', 1)
scripts_after = [x for x in re.findall(script_pattern, s, re.S) if 'id="optykerServicesJs"' not in x]
if scripts_before != scripts_after or controls_before != re.findall(control_pattern, s, re.S):
    raise SystemExit('Services: refusing changes to original scripts or controls')
assets = ('optyker-services.css', 'optyker-services.js')
for name in assets:
    source = REPO / name
    if not source.is_file() or source.stat().st_size < 100:
        raise SystemExit('Services: missing design file ' + name)
    shutil.copyfile(source, SITE / name)
p.write_text(s, encoding='utf-8')
for alias in ('gestionale-v2', 'gestionale-v3'):
    target = SITE / alias / 'index.html'
    if target.is_file():
        target.write_text(s, encoding='utf-8')
release = {'version': VERSION, 'commit': os.environ.get('VERCEL_GIT_COMMIT_SHA') or os.environ.get('GITHUB_SHA', ''),
           'sections': ['chat', 'cassa', 'documenti'],
           'assets': {n: hashlib.sha256((SITE / n).read_bytes()).hexdigest() for n in assets}}
(SITE / 'services-version.json').write_text(json.dumps(release, indent=2) + '\n', encoding='utf-8')
print('Optyker Services installed: ' + VERSION + '; original scripts and form controls preserved.')

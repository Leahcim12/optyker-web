"""Add the agenda/anagrafica presentation layer to the assembled management app.

Preserves the original inline scripts, form controls and business handlers.
Runs before patch_public_asset_paths.py so both hosting bases are supported.
"""
from pathlib import Path
import hashlib
import json
import os
import re
import shutil
import sys

VERSION = '20260910-workspace1'
ROOT = Path(__file__).resolve().parent.parent
SITE = Path(sys.argv[1]) if len(sys.argv) > 1 else Path('_site')
page = SITE / 'index.html'
html = page.read_text(encoding='utf-8')
for marker in ('id="mainApp"', 'id="clientsPanel"', 'id="optykerAppointmentsPanel"', 'id="optykerVisionJs"', '</head>'):
    if marker not in html:
        raise SystemExit('Workspace: expected management marker missing: ' + marker)
html = re.sub(r'<link\b[^>]*id="optykerWorkspaceCss"[^>]*>\s*', '', html)
html = re.sub(r'<script\b[^>]*id="optykerWorkspaceJs"[^>]*>.*?</script>\s*', '', html, flags=re.S)
html = re.sub(r'<meta\b[^>]*name="optyker-workspace-version"[^>]*>\s*', '', html)
script_pattern = r'<script\b[^>]*>.*?</script>'
controls_pattern = r'<(?:input|select|textarea|button)\b[^>]*>'
original_scripts = re.findall(script_pattern, html, re.S)
original_controls = re.findall(controls_pattern, html, re.S)
assets = ('optyker-workspace.css', 'optyker-workspace.js')
for name in assets:
    source = ROOT / name
    if not source.is_file() or source.stat().st_size < 100:
        raise SystemExit('Workspace: missing or empty asset: ' + name)
    shutil.copyfile(source, SITE / name)
tags = ('<meta name="optyker-workspace-version" content="' + VERSION + '">\n'
        '<link id="optykerWorkspaceCss" rel="stylesheet" media="screen" href="/optyker-workspace.css?v=' + VERSION + '">\n'
        '<script id="optykerWorkspaceJs" defer src="/optyker-workspace.js?v=' + VERSION + '"></script>\n')
html = html.replace('</head>', tags + '</head>', 1)
remaining = [x for x in re.findall(script_pattern, html, re.S) if 'id="optykerWorkspaceJs"' not in x]
if original_scripts != remaining or original_controls != re.findall(controls_pattern, html, re.S):
    raise SystemExit('Workspace: refusing a change to original scripts or form controls')
page.write_text(html, encoding='utf-8')
for alias in ('gestionale-v2', 'gestionale-v3'):
    target = SITE / alias / 'index.html'
    if target.is_file():
        target.write_text(html, encoding='utf-8')
release = {
    'version': VERSION,
    'commit': os.environ.get('VERCEL_GIT_COMMIT_SHA') or os.environ.get('GITHUB_SHA', ''),
    'sections': ['agenda', 'anagrafica'],
    'assets': {name: hashlib.sha256((SITE / name).read_bytes()).hexdigest() for name in assets},
}
(SITE / 'workspace-version.json').write_text(json.dumps(release, indent=2) + '\n', encoding='utf-8')
print('Optyker Workspace installed: ' + VERSION + '; original scripts and controls preserved.')

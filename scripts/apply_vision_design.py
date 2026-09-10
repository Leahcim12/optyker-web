"""Install the additive reference-matched dashboard, without changing application scripts.

Builds on Aurora. No change to business logic, data writes, auth or printed documents.
Only management entry points are changed; mobile and Shopify bundles are untouched.
"""
from pathlib import Path
import re
import shutil
import sys

VERSION = '20260910-vision1'
REPO = Path(__file__).resolve().parent.parent
SITE = Path(sys.argv[1]) if len(sys.argv) > 1 else Path('_site')
p = SITE / 'index.html'
s = p.read_text(encoding='utf-8')
for marker in ('id="mainApp"', 'id="dashboardPanel"', 'id="moduleNav"', 'id="optykerLoginScreen"'):
    if marker not in s:
        raise SystemExit('Vision: original template missing ' + marker)
s = re.sub(r'<link\b[^>]*id="optykerVisionCss"[^>]*>\s*', '', s)
s = re.sub(r'<script\b[^>]*id="optykerVisionJs"[^>]*>.*?</script>\s*', '', s, flags=re.S)
original_scripts = re.findall(r'<script\b[^>]*>.*?</script>', s, re.S)
css = '<link id="optykerVisionCss" rel="stylesheet" media="screen" href="/optyker-vision.css?v=' + VERSION + '">\n'
js = '<script id="optykerVisionJs" defer src="/optyker-vision.js?v=' + VERSION + '"></script>\n'
# Put both tags last in HEAD so the CSS wins and the deferred script runs after parsing.
s = s.replace('</head>', css + js + '</head>', 1)
remaining_scripts = [x for x in re.findall(r'<script\b[^>]*>.*?</script>', s, re.S) if 'id="optykerVisionJs"' not in x]
if original_scripts != remaining_scripts:
    raise SystemExit('Vision: refusing to change existing scripts')
for name in ('optyker-vision.css', 'optyker-vision.js', 'optyker-vision-eye.webp'):
    shutil.copyfile(REPO / name, SITE / name)
p.write_text(s, encoding='utf-8')
for name in ('gestionale-v2', 'gestionale-v3'):
    alias = SITE / name / 'index.html'
    if alias.is_file():
        alias.write_text(s, encoding='utf-8')
print('Optyker Vision installed: ' + VERSION + '; original scripts preserved.')

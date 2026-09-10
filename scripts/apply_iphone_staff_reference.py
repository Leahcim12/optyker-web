"""Embed the staff presentation in the actual published iPhone HTML, after customer UI.

No rewriting of authentication, permissions, services, inputs or API handlers.
"""
from pathlib import Path
import argparse
import re

ROOT = Path(__file__).resolve().parent.parent
parser = argparse.ArgumentParser()
parser.add_argument('--target', default='_site/iphone-app-v13/index.html')
args = parser.parse_args()
target = Path(args.target)
if not target.is_absolute():
    target = ROOT / target
html = target.read_text(encoding='utf-8')
for kind, id_ in [('style','optykerStaffReferenceCss'), ('script','optykerStaffReferenceJs')]:
    html = re.sub(r'\n?<' + kind + ' id="' + id_ + r'">[\s\S]*?</' + kind + r'>\n?', '\n', html)
required = ['function staffShell(', 'function staffRender(', 'function staffPage(',
            'function staffStatsMarkup(', 'function staffProfileMarkup(',
            'function staffClientDetailMarkup(', 'OPTYKER_IPHONE_REFERENCE_UI_V2',
            'OPTYKER_IPHONE_SHOP_NAV_V2', 'OPTYKER_HERO_PLANT_CONNECTED_V1']
for token in required:
    if token not in html:
        raise SystemExit('iPhone baseline missing: ' + token)
css = (ROOT / 'iphone-app-v13/staff-reference-ui-v1.css').read_text(encoding='utf-8')
js = (ROOT / 'iphone-app-v13/staff-reference-ui-v1.js').read_text(encoding='utf-8')
if '</script' in js.lower() or '</style' in css.lower():
    raise SystemExit('Unsafe inline asset terminator')
assert html.count('</head>') == 1 and html.count('</body>') == 1
result = html.replace('</head>', '<style id="optykerStaffReferenceCss">\n' + css + '\n</style>\n</head>', 1)
result = result.replace('</body>', '<script id="optykerStaffReferenceJs">\n' + js + '\n</script>\n</body>', 1)
# All pre-existing application script bodies must remain byte-for-byte identical.
script_bodies = lambda text: re.findall(r'<script\b[^>]*>([\s\S]*?)</script>', text, re.I)
assert script_bodies(result)[:-1] == script_bodies(html), 'Existing services were modified'
assert result.rfind('id="optykerStaffReferenceJs"') > result.rfind('id="optykerPremiumUiInlineV2"')
target.write_text(result, encoding='utf-8')
print('Staff reference UI embedded; all pre-existing scripts preserved: ' + str(target))

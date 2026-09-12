from pathlib import Path
from shutil import copyfile
import re

root = Path('_site')
version = '20260913-ts1'
for name in ('ts-connection.js', 'ts-connection.css', 'billing-admin.js'):
    copyfile(name, root / name)
path = root / 'index.html'
text = path.read_text()
text = re.sub(r'<script[^>]*id="optykerTsConnectionJs"[^>]*></script>\s*', '', text)
text = re.sub(r'<link[^>]*id="optykerTsConnectionCss"[^>]*>\s*', '', text)
text = re.sub(r'/billing-admin\.js(?:\?[^"\']*)?', '/billing-admin.js?v=' + version, text)
text = text.replace('</head>', f'<link rel="stylesheet" href="/ts-connection.css?v={version}" id="optykerTsConnectionCss">\n</head>', 1)
text = text.replace('</body>', f'<script src="/ts-connection.js?v={version}" id="optykerTsConnectionJs"></script>\n</body>', 1)
path.write_text(text)
for alias in ('gestionale-v2', 'gestionale-v3'):
    (root / alias / 'index.html').write_text(text)
print('TS protected configuration loader applied', version)

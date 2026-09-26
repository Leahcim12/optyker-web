"""Bust cached cashier assets after the mixed payment release."""
from pathlib import Path
import re

root = Path('_site')
version = '20260926-mixed3'
for alias in ('.', 'gestionale-v2', 'gestionale-v3'):
    page = root / alias / 'index.html'
    html = page.read_text(encoding='utf-8')
    for asset in ('cash-register.js', 'cash-register.css', 'cash-pos5.js'):
        html = re.sub(r'(' + re.escape(asset) + r')\?v=[^"\']+',
                      lambda match: match.group(1) + '?v=' + version, html)
    page.write_text(html, encoding='utf-8')
    assert 'cash-register.js?v=' + version in html
    assert 'cash-pos5.js?v=' + version in html
print('Mixed cashier assets published:', version)

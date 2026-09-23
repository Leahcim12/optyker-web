"""Make the tested cashier layers part of Pages too; keep full errors visible.
No database calls, printer commands, fiscal-state changes or payment retries.
"""
from pathlib import Path
import hashlib
import json
import os
import re

ROOT = Path(__file__).resolve().parent.parent
VERSION = '20260923-printdiag1'

def main():
    site = ROOT / '_site'
    asset = 'cash-print-error-details.js'
    source = (ROOT / asset).read_bytes()
    (site / asset).write_bytes(source)
    pattern = r'cash-register\.js(?:\?[^\s\"\'<>]*)?'
    def versioned(match):
        value = re.sub(r'[&?]printfix=[^&\s\"\'<>]+', '', match[0])
        return value + ('&' if '?' in value else '?') + 'printfix=' + VERSION
    tag = '<script id="optykerCashErrorDetailsJs" src="/cash-print-error-details.js?v=' + VERSION + '" defer></script>'
    for folder in (site, site / 'gestionale-v2', site / 'gestionale-v3'):
        page = folder / 'index.html'
        text = re.sub(pattern, versioned, page.read_text(encoding='utf-8'))
        if 'id="optykerCashErrorDetailsJs"' not in text:
            pos = text.lower().rfind('</body>')
            if pos < 0:
                raise ValueError('Closing body missing: ' + str(page))
            text = text[:pos] + tag + '\n' + text[pos:]
        page.write_text(text, encoding='utf-8')
        (folder / asset).write_bytes(source)
    for path in site.glob('*.js'):
        if path.name == 'cash-register.js':
            continue
        before = path.read_text(encoding='utf-8')
        after = re.sub(pattern, versioned, before)
        if after != before:
            path.write_text(after, encoding='utf-8')
    cash = (site / 'cash-register.js').read_bytes()
    if b'OPTYKER_RECORDED_BALANCES_20260921' not in cash:
        raise ValueError('Recorded balances missing from published artifact')
    (site / 'cash-print-recovery-version.json').write_text(json.dumps({
        'version': VERSION,
        'commit': os.environ.get('GITHUB_SHA') or os.environ.get('VERCEL_GIT_COMMIT_SHA', ''),
        'cash_sha256': hashlib.sha256(cash).hexdigest(),
        'error_details_sha256': hashlib.sha256((site / asset).read_bytes()).hexdigest(),
        'financial_data_changed': False,
    }, indent=2) + '\n', encoding='utf-8')
    print('Cashier layers and full error details included:', VERSION)

if __name__ == '__main__':
    main()

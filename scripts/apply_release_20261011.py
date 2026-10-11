"""Release 20261011: payments (bonifico, Alma, PagoDil, PagoLight), automatic REG, Meta details.

Last build step. It only refreshes cache versions of files changed in this release and
verifies that the published assets contain the release; it never contacts a printer.
"""
from pathlib import Path
import re
import shutil

ROOT = Path(__file__).resolve().parent.parent
SITE = ROOT / '_site'
VERSION = '20261011-cassa1'
ASSETS = ('cash-register.js', 'rch-preflight.js', 'unified-fiscal-void.js', 'fiscal-receipts.js',
          'whatsapp-connect.js', 'client-tools.js')
CHECKS = {
    'cash-register.js': ('data-pay="alma"', 'data-pay="pagodil"', 'data-pay="pagolight"',
                         "['cash','card','mixed','bank','alma','pagodil','pagolight']"),
    'rch-preflight.js': ("['bank','alma','pagodil','pagolight']",),
    'unified-fiscal-void.js': ('OPTYKER_RCH_AUTO_REG',),
    'fiscal-receipts.js': ('OPTYKER_RCH_AUTO_REG',),
    'whatsapp-connect.js': ('OPTYKER_WHATSAPP_META_DETAILS_20261011',),
    'client-tools.js': ("pagolight:'PagoLight'",),
}


def bump(text, name):
    pattern = r'(' + re.escape(name) + r')\?v=[^"\'\s<>&]*'
    return re.sub(pattern, lambda m: m.group(1) + '?v=' + VERSION, text)


def main():
    for name, needles in CHECKS.items():
        published = (SITE / name).read_text(encoding='utf-8')
        for needle in needles:
            if needle not in published:
                raise SystemExit('Release 20261011 missing in _site/' + name + ': ' + needle)
    if 'data-pay="pending"' in (SITE / 'cash-register.js').read_text(encoding='utf-8'):
        raise SystemExit('The RATE button must be replaced by Alma, PagoDil and PagoLight')
    pages = [SITE / alias / 'index.html' for alias in ('.', 'gestionale-v2', 'gestionale-v3')]
    aliases_equal = len({page.read_bytes() for page in pages}) == 1
    for page in pages:
        html = page.read_text(encoding='utf-8')
        for name in ASSETS:
            html = bump(html, name)
        page.write_text(html, encoding='utf-8')
        for name in ('cash-register.js', 'whatsapp-connect.js', 'fiscal-receipts.js'):
            if name + '?v=' + VERSION not in html and name in html:
                raise SystemExit('Cache version not refreshed for ' + name + ' in ' + str(page))
    # Dynamic loaders that reference fiscal-receipts.js keep the same cache version.
    for js in SITE.glob('*.js'):
        text = js.read_text(encoding='utf-8')
        patched = bump(text, 'fiscal-receipts.js')
        if patched != text:
            js.write_text(patched, encoding='utf-8')
    for alias in ('gestionale-v2', 'gestionale-v3'):
        for name in ASSETS:
            target = SITE / alias / name
            if target.exists():
                shutil.copyfile(SITE / name, target)
    first = pages[0].read_bytes()
    if aliases_equal and any(page.read_bytes() != first for page in pages[1:]):
        raise SystemExit('Desktop aliases differ after release 20261011')
    print('Release 20261011 published:', VERSION)


if __name__ == '__main__':
    main()

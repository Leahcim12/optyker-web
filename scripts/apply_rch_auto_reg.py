"""Publish the automatic RCH return to REG before receipts (no printer command at build time)."""
from pathlib import Path
import re
import shutil

ROOT = Path(__file__).resolve().parent.parent
SITE = ROOT / '_site'
VERSION = '20261011-autoreg1'
TAG = '<script id="optykerRchAutoRegJs" defer src="/rch-auto-reg.js?v=' + VERSION + '"></script>'


def main():
    source = ROOT / 'rch-auto-reg.js'
    text = source.read_text(encoding='utf-8')
    if 'OPTYKER_RCH_AUTO_REG_20261011' not in text or "queue_aux',{kind:'restore_reg'}" not in text:
        raise SystemExit('rch-auto-reg.js is not the expected release')
    for forbidden in ('daily_closure', '=C10', 'queue_fiscal', 'bridge_claim'):
        if forbidden in text:
            raise SystemExit('rch-auto-reg.js must never request ' + forbidden)
    for alias in ('.', 'gestionale-v2', 'gestionale-v3'):
        folder = SITE / alias
        page = folder / 'index.html'
        if not page.exists():
            raise SystemExit('Missing desktop page ' + str(page))
        shutil.copyfile(source, folder / 'rch-auto-reg.js')
        html = page.read_text(encoding='utf-8')
        html = re.sub(r'<script\b[^>]*id="optykerRchAutoRegJs"[^>]*>\s*</script>\s*', '', html)
        position = html.lower().rfind('</body>')
        if position < 0:
            raise SystemExit('Closing body not found in ' + str(page))
        html = html[:position] + TAG + '\n' + html[position:]
        page.write_text(html, encoding='utf-8')
        if html.count('id="optykerRchAutoRegJs"') != 1:
            raise SystemExit('Auto REG loader must appear exactly once in ' + str(page))
    print('RCH automatic REG before receipts published:', VERSION)


if __name__ == '__main__':
    main()

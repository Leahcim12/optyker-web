"""Report 20261014: voce "Report" per gli account (richiami del mese e giacenze di magazzino).

Passo della build Vercel dopo apply_release_20261013.py. Pubblica optyker-report.js/.css e li
aggiunge alla pagina del gestionale e alle sue copie (gestionale-v2, gestionale-v3), che devono
restare identiche. Fallisce se qualcosa non torna: meglio una build ferma che un sito rotto.
"""
from pathlib import Path
import hashlib
import json
import re
import shutil
import sys

ROOT = Path(__file__).resolve().parent.parent
SITE = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / '_site'
ALIASES = ('gestionale-v2', 'gestionale-v3')
VERSION = '20261014-report1'
ASSETS = ('optyker-report.js', 'optyker-report.css')
TAG_IDS = ('optykerReportCss', 'optykerReportJs')


def base_path():
    manifest = SITE / 'design-version.json'
    if manifest.is_file():
        value = json.loads(manifest.read_text(encoding='utf-8')).get('base_path', '/')
        if re.fullmatch(r'/(?:[A-Za-z0-9_.-]+/)?', value):
            return value
    return '/'


def tags():
    base = base_path()
    return '\n'.join([
        f'<link rel="stylesheet" id="optykerReportCss" href="{base}optyker-report.css?v={VERSION}">',
        f'<script id="optykerReportJs" defer src="{base}optyker-report.js?v={VERSION}"></script>',
    ])


def patch_page(html):
    for tag_id in TAG_IDS:
        html = re.sub(r'<(?:link|script)[^>]*\bid="' + tag_id + r'"[^>]*>(?:</script>)?\n?', '', html)
    end = html.lower().rfind('</body>')
    if end < 0:
        raise SystemExit('Report 20261014: </body> non trovato')
    return html[:end] + tags() + '\n' + html[end:]


def main():
    for name in ASSETS:
        src = ROOT / name
        if not src.is_file():
            raise SystemExit('Report 20261014: manca ' + name)
        shutil.copyfile(src, SITE / name)

    pages = [SITE / 'index.html'] + [SITE / alias / 'index.html' for alias in ALIASES]
    pages = [p for p in pages if p.is_file()]
    if not pages:
        raise SystemExit('Report 20261014: pagina del gestionale non trovata')
    aliases_equal = len({p.read_bytes() for p in pages}) == 1
    for page in pages:
        page.write_text(patch_page(page.read_text(encoding='utf-8')), encoding='utf-8')
    if aliases_equal and len({p.read_bytes() for p in pages}) != 1:
        raise SystemExit('Report 20261014: le pagine gestionale non sono più identiche')

    html = (SITE / 'index.html').read_text(encoding='utf-8')
    for needle in ('id="optykerReportCss"', 'id="optykerReportJs"', 'optyker-report.js?v=' + VERSION):
        if html.count(needle) != 1:
            raise SystemExit('Report 20261014: nella pagina "' + needle + '" compare ' + str(html.count(needle)) + ' volte')
    js = (SITE / 'optyker-report.js').read_text(encoding='utf-8')
    if "VERSION='" + VERSION + "'" not in js or 'optyker_report_api' not in js:
        raise SystemExit('Report 20261014: optyker-report.js non corrisponde alla versione ' + VERSION)

    manifest = {
        'release': '20261014-report',
        'report': VERSION,
        'assets': {name: hashlib.sha256((SITE / name).read_bytes()).hexdigest() for name in ASSETS},
    }
    (SITE / 'report-20261014-version.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
    print('Report 20261014 published: richiami del mese e giacenze di magazzino')


if __name__ == '__main__':
    main()

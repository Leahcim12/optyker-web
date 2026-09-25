"""Add client presentation without changing forms, data or native scripts."""
from pathlib import Path
from shutil import copyfile
import re
from apply_ts_connection import DocumentClosings

VERSION = '20260919-original1'
STYLE_VERSION = '20260919-red1'
DOSSIER_VERSION = '20260925-dossier2'
ASSETS = ('client-workspace-original.js', 'client-workspace-original.css', 'client-dossier.js')


def inject(text):
    for marker in ('id="clientsPanel"', 'id="clientAnagraficaSection"', 'id="clientWorkspaceHero"',
                   'class="clientProfileSections"', 'id="clientDbName"', 'id="clientDbSurname"',
                   'id="optykerClientProfileSaveJs"', 'optykerClientOpenPage'):
        if marker not in text:
            raise ValueError('Original client workspace: missing existing anchor ' + marker)
    text = re.sub(r'<script[^>]*id="optykerClientWorkspaceOriginalJs"[^>]*></script>\s*', '', text)
    text = re.sub(r'<script[^>]*id="optykerClientDossierJs"[^>]*></script>\s*', '', text)
    text = re.sub(r'<link[^>]*id="optykerClientWorkspaceOriginalCss"[^>]*>\s*', '', text)
    ends = DocumentClosings(text).closings
    if set(ends) != {'head', 'body'} or ends['head'] >= ends['body']:
        raise ValueError('Original client workspace: invalid document boundaries')
    tags = {
        'head': f'<link rel="stylesheet" href="/client-workspace-original.css?v={STYLE_VERSION}" id="optykerClientWorkspaceOriginalCss">\n',
        'body': f'<script src="/client-workspace-original.js?v={VERSION}" id="optykerClientWorkspaceOriginalJs"></script>\n'
                f'<script src="/client-dossier.js?v={DOSSIER_VERSION}" id="optykerClientDossierJs"></script>\n',
    }
    for tag in sorted(ends, key=ends.get, reverse=True):
        pos = ends[tag]
        text = text[:pos] + tags[tag] + text[pos:]
    return text


def main():
    root = Path('_site')
    index = root / 'index.html'
    original = index.read_text(encoding='utf-8')
    updated = inject(original)
    if inject(updated) != updated:
        raise ValueError('Original client workspace: injection is not idempotent')
    for asset in ASSETS:
        copyfile(asset, root / asset)
    index.write_text(updated, encoding='utf-8')
    for alias in ('gestionale-v2', 'gestionale-v3'):
        dest = root / alias
        dest.mkdir(exist_ok=True)
        (dest / 'index.html').write_text(updated, encoding='utf-8')
        for asset in ASSETS:
            copyfile(asset, dest / asset)
    print('Original customer workspace applied:', VERSION, 'palette:', STYLE_VERSION, 'dossier:', DOSSIER_VERSION, '(no data migration)')
    # Bound archive/search work before legacy wrappers execute in both deployments.
    from apply_operator_responsiveness import main as apply_responsiveness
    apply_responsiveness(root)


if __name__ == '__main__':
    main()

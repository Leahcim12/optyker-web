from pathlib import Path
from shutil import copyfile
from html.parser import HTMLParser
import re

VERSION = '20260913-ts3'


class DocumentClosings(HTMLParser):
    """Find HTML end tags without matching document strings inside scripts."""
    def __init__(self, text):
        super().__init__(convert_charrefs=False)
        self.offsets = [0]
        for line in text.splitlines(keepends=True):
            self.offsets.append(self.offsets[-1] + len(line))
        self.closings = {}
        self.feed(text)
        self.close()

    def handle_endtag(self, tag):
        if tag in ('head', 'body'):
            line, column = self.getpos()
            self.closings[tag] = self.offsets[line - 1] + column


def inject_assets(text):
    text = re.sub(r'<script[^>]*id="optykerTsConnectionJs"[^>]*></script>\s*', '', text)
    text = re.sub(r'<link[^>]*id="optykerTsConnectionCss"[^>]*>\s*', '', text)
    text = re.sub(r'/billing-admin\.js(?:\?[^"\']*)?', '/billing-admin.js?v=' + VERSION, text)
    closings = DocumentClosings(text).closings
    if set(closings) != {'head', 'body'} or closings['head'] >= closings['body']:
        raise ValueError('TS loader: real document head/body closing tags not found')
    assets = {
        'head': f'<link rel="stylesheet" href="/ts-connection.css?v={VERSION}" id="optykerTsConnectionCss">\n',
        'body': f'<script src="/ts-connection.js?v={VERSION}" id="optykerTsConnectionJs"></script>\n',
    }
    for tag in sorted(closings, key=closings.get, reverse=True):
        pos = closings[tag]
        text = text[:pos] + assets[tag] + text[pos:]
    return text


def main():
    root = Path('_site')
    path = root / 'index.html'
    text = inject_assets(path.read_text())
    for name in ('ts-connection.js', 'ts-connection.css', 'billing-admin.js'):
        copyfile(name, root / name)
    path.write_text(text)
    for alias in ('gestionale-v2', 'gestionale-v3'):
        (root / alias / 'index.html').write_text(text)
    print('TS protected configuration loader applied', VERSION)


if __name__ == '__main__':
    main()

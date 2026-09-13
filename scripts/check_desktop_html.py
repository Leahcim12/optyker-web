"""Validate the final, browser-parsed desktop artifact after all build patches."""
from html.parser import HTMLParser
from pathlib import Path
import json
import re
import subprocess
import sys


class PageScripts(HTMLParser):
    def __init__(self, text):
        super().__init__(convert_charrefs=False)
        self.scripts = []
        self.outside = []
        self.active = None
        self.in_style = False
        self.feed(text)
        self.close()

    def handle_starttag(self, tag, attrs):
        if tag == 'script':
            self.active = {'attrs': dict(attrs), 'code': '', 'line': self.getpos()[0]}
        elif tag == 'style':
            self.in_style = True

    def handle_endtag(self, tag):
        if tag == 'script' and self.active is not None:
            self.scripts.append(self.active)
            self.active = None
        elif tag == 'style':
            self.in_style = False

    def handle_data(self, data):
        if self.active is not None:
            self.active['code'] += data
        elif not self.in_style:
            self.outside.append(data)


def validate(text):
    parsed = PageScripts(text)
    if parsed.active is not None:
        raise ValueError('Unclosed script in desktop page')
    leaks = [part for part in parsed.outside if re.search(r'\bfunction\s+\w+\s*\(|\bvar\s+\w+\s*=', part)]
    if leaks:
        raise ValueError('JavaScript is being rendered as page text')
    loader = [s for s in parsed.scripts if s['attrs'].get('id') == 'optykerTsConnectionJs']
    if len(loader) != 1 or not loader[0]['attrs'].get('src', '').startswith('/ts-connection.js?v='):
        raise ValueError('TS loader missing or duplicated in parsed desktop page')
    inline = [s for s in parsed.scripts if 'src' not in s['attrs'] and
              s['attrs'].get('type', '').lower() in ('', 'text/javascript', 'application/javascript')]
    for script in inline:
        if 'optykerTsConnectionJs' in script['code']:
            raise ValueError('TS loader was inserted inside an inline script')
    # Compile what the HTML parser actually gives the browser, not regex slices
    # from before the last build patch. Compilation never executes application code.
    check = subprocess.run(['node', '-e', '''
const vm = require('node:vm'), fs = require('node:fs');
const scripts = JSON.parse(fs.readFileSync(0, 'utf8'));
for (const s of scripts) {
  try { new vm.Script(s.code, {filename:'desktop-inline-line-'+s.line}); }
  catch (error) { console.error(error.message+' at HTML line '+s.line); process.exit(1); }
}
'''], input=json.dumps(inline), text=True, capture_output=True)
    if check.returncode:
        raise ValueError('Invalid final inline JavaScript: ' + check.stderr.strip())
    return len(inline)


if __name__ == '__main__':
    root = Path(sys.argv[1] if len(sys.argv) > 1 else '_site')
    page = (root / 'index.html').read_text()
    count = validate(page)
    for alias in ('gestionale-v2', 'gestionale-v3'):
        if (root / alias / 'index.html').read_text() != page:
            raise SystemExit('Desktop alias differs: ' + alias)
    print(f'Final desktop HTML verified: {count} valid inline scripts, one TS loader, no visible code')

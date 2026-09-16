from pathlib import Path
import re

p = Path('_site/index.html')
s = p.read_text(encoding='utf-8')

pat = re.compile(r'(<select id=["\']optykerLoginOperator["\'][^>]*>)([\s\S]*?)(</select>)', re.I)
m = pat.search(s)
if not m:
    raise SystemExit('Selettore utenti del login non trovato')

body = m.group(2)
body = re.sub(
    r'<option\b[^>]*value=["\']Ottica Visual Care["\'][^>]*>[\s\S]*?</option>',
    '',
    body,
    count=1,
    flags=re.I
)
admin = '<option value="Ottica Visual Care">Amministratore · Ottica Visual Care</option>'

placeholder = re.search(r'<option\b[^>]*value=["\']["\'][^>]*>[\s\S]*?</option>', body, re.I)
if placeholder:
    i = placeholder.end()
    body = body[:i] + admin + body[i:]
else:
    body = admin + body

s = s[:m.start()] + m.group(1) + body + m.group(3) + s[m.end():]

m2 = pat.search(s)
if not m2 or 'value="Ottica Visual Care"' not in m2.group(2) or 'Amministratore · Ottica Visual Care' not in m2.group(2):
    raise SystemExit('Account amministratore non ripristinato nel login')

p.write_text(s, encoding='utf-8')
print('Login Optyker: account amministratore visibile')

from pathlib import Path
import re

p = Path('_site/index.html')
s = p.read_text(encoding='utf-8')

pat = re.compile(r'(<select id=["\']optykerLoginOperator["\'][^>]*>)([\s\S]*?)(</select>)', re.I)
m = pat.search(s)
if not m:
    raise SystemExit('Selettore utenti del login non trovato')

body = m.group(2)
# L'account amministratore non deve passare dal login operatori normale.
# Rimuovi sia la vecchia voce staff sia eventuali duplicati amministrativi.
body = re.sub(
    r'<option\b[^>]*value=["\']Ottica Visual Care["\'][^>]*>[\s\S]*?</option>',
    '',
    body,
    flags=re.I
)
body = re.sub(
    r'<option\b[^>]*value=["\']__optyker_admin__["\'][^>]*>[\s\S]*?</option>',
    '',
    body,
    flags=re.I
)

admin = '<option value="__optyker_admin__">Amministratore · Ottica Visual Care</option>'
placeholder = re.search(r'<option\b[^>]*value=["\']["\'][^>]*>[\s\S]*?</option>', body, re.I)
if placeholder:
    i = placeholder.end()
    body = body[:i] + admin + body[i:]
else:
    body = admin + body

s = s[:m.start()] + m.group(1) + body + m.group(3) + s[m.end():]

m2 = pat.search(s)
if not m2:
    raise SystemExit('Selettore utenti del login non trovato dopo la modifica')
options = m2.group(2)
if 'value="__optyker_admin__"' not in options or 'Amministratore · Ottica Visual Care' not in options:
    raise SystemExit('Accesso amministratore non collegato al login amministrativo')
if re.search(r'value=["\']Ottica Visual Care["\']', options, re.I):
    raise SystemExit('Account Ottica Visual Care ancora esposto come operatore normale')

p.write_text(s, encoding='utf-8')
print('Login Optyker: Amministratore collegato al portale amministrativo')

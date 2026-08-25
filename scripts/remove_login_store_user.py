from pathlib import Path
import re

p = Path('_site/index.html')
s = p.read_text(encoding='utf-8')

old = '<select id="optykerLoginOperator"><option value="">Seleziona utente</option><option value="Ottica Visual Care">Ottica Visual Care</option>'
new = '<select id="optykerLoginOperator"><option value="">Seleziona utente</option>'

if old in s:
    s = s.replace(old, new, 1)

m = re.search(r'<select id=["\']optykerLoginOperator["\'][^>]*>([\s\S]*?)</select>', s, re.I)
if not m:
    raise SystemExit('Selettore utenti del login non trovato')
if 'Ottica Visual Care' in m.group(1):
    raise SystemExit('Username Ottica Visual Care ancora presente nel login')

p.write_text(s, encoding='utf-8')
print('Login Optyker: username Ottica Visual Care rimosso')

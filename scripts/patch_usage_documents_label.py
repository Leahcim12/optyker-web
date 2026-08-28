from pathlib import Path
import re

p = Path("_site/index.html")
s = p.read_text(encoding="utf-8")

target = "DOCUMENTI DA STAMPARE MANUTENZIONE LAC"
if target not in s:
    pattern = re.compile(r"DOCUMENTI\s+DA\s+STAMPARE(?!\s+MANUTENZIONE\s+LAC)", re.I)
    s, n = pattern.subn(target, s)
    if n == 0:
        raise SystemExit("Etichetta DOCUMENTI DA STAMPARE non trovata")
    p.write_text(s, encoding="utf-8")

# Verifica finale.
check = p.read_text(encoding="utf-8")
if target not in check:
    raise SystemExit("Nuova etichetta manutenzione LAC non applicata")

print("Etichetta aggiornata:", target)

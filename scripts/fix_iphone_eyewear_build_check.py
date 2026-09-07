from pathlib import Path

OLD = "20260903-rxrules2"
NEW = "20260907-eyewear1"

# Ripristina il build-id atteso senza rimuovere la nuova funzione Occhiali.
for name in ["iphone-app-v13/index.html", "iphone-app-v13/sw.js"]:
    p = Path(name)
    s = p.read_text(encoding="utf-8").replace(NEW, OLD)
    p.write_text(s, encoding="utf-8")

# Corregge anche il patcher permanente, così eventuali riesecuzioni future
# non rompono i controlli già presenti nel workflow Pages.
p = Path("scripts/patch_iphone_customer_eyewear_v1.py")
s = p.read_text(encoding="utf-8")
s = s.replace('NEW_BUILD = "20260907-eyewear1"', 'NEW_BUILD = "20260903-rxrules2"')
s = s.replace('s = s.replace("20260903-rxrules2", NEW_BUILD)\np.write_text', 's = s.replace("20260907-eyewear1", NEW_BUILD)\ns = s.replace("20260903-rxrules2", NEW_BUILD)\np.write_text')
s = s.replace('ws = ws.replace("20260903-rxrules2", NEW_BUILD)\nsw.write_text', 'ws = ws.replace("20260907-eyewear1", NEW_BUILD)\nws = ws.replace("20260903-rxrules2", NEW_BUILD)\nsw.write_text')
p.write_text(s, encoding="utf-8")

idx = Path("iphone-app-v13/index.html").read_text(encoding="utf-8")
if "OPTYKER_IPHONE_CUSTOMER_EYEWEAR_V1" not in idx or OLD not in idx:
    raise SystemExit("Correzione build iPhone incompleta")
print("Build iPhone riallineata ai controlli Pages")

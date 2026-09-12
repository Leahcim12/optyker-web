from pathlib import Path
import re
from shutil import copyfile

path=Path("_site/index.html")
text=path.read_text(encoding="utf-8")
version="20260912-rch-confirmed2"
copyfile("rch-preflight.js", "_site/rch-preflight.js")
css=f'<link rel="stylesheet" href="/cash-register.css?v={version}" id="optykerCashCss">'
js=f'<script src="/cash-register.js?v={version}" id="optykerCashJs"></script>'
preflight=f'<script src="/rch-preflight.js?v={version}" id="optykerRchPreflightJs"></script>'
text=re.sub(r'<script[^>]*id="optykerRchPreflightJs"[^>]*></script>\s*', '', text)

if 'id="optykerCashCss"' in text:
    text=re.sub(r'<link[^>]*id="optykerCashCss"[^>]*>', css, text, count=1)
else:
    pos=text.find("</head>")
    text=(text[:pos]+css+"\n"+text[pos:]) if pos>=0 else css+"\n"+text

if 'id="optykerCashJs"' in text:
    text=re.sub(r'<script[^>]*id="optykerCashJs"[^>]*></script>', js, text, count=1)
else:
    pos=text.rfind("</body>")
    text=(text[:pos]+js+"\n"+text[pos:]) if pos>=0 else text+"\n"+js

text=text.replace(js, preflight+'\n'+js, 1)
path.write_text(text,encoding="utf-8")
print("Optyker cash register loader OK", version)

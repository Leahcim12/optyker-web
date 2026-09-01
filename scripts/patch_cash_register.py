from pathlib import Path
import re

path=Path("_site/index.html")
text=path.read_text(encoding="utf-8")
version="20260901-6"
css=f'<link rel="stylesheet" href="/cash-register.css?v={version}" id="optykerCashCss">'
js=f'<script src="/cash-register.js?v={version}" id="optykerCashJs"></script>'

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

path.write_text(text,encoding="utf-8")
print("Optyker cash register loader OK", version)

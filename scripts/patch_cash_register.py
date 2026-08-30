from pathlib import Path

path=Path("_site/index.html")
text=path.read_text(encoding="utf-8")
css='<link rel="stylesheet" href="/cash-register.css?v=20260830-3" id="optykerCashCss">'
js='<script src="/cash-register.js?v=20260830-3" id="optykerCashJs"></script>'

if 'id="optykerCashCss"' not in text:
    pos=text.find("</head>")
    text=(text[:pos]+css+"\n"+text[pos:]) if pos>=0 else css+"\n"+text

if 'id="optykerCashJs"' not in text:
    pos=text.rfind("</body>")
    text=(text[:pos]+js+"\n"+text[pos:]) if pos>=0 else text+"\n"+js

path.write_text(text,encoding="utf-8")
print("Optyker cash register loader OK")

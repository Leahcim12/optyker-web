from pathlib import Path
import re

path=Path("_site/index.html")
text=path.read_text(encoding="utf-8")
version="20260903-live1"
css=f'<link rel="stylesheet" href="/client-tools.css?v={version}" id="optykerClientToolsCss">'
js=f'<script src="/client-tools.js?v={version}" id="optykerClientToolsJs"></script>'

if 'id="optykerClientToolsCss"' in text:
    text=re.sub(r'<link[^>]*id="optykerClientToolsCss"[^>]*>',css,text,count=1)
else:
    pos=text.find("</head>")
    text=(text[:pos]+css+"\n"+text[pos:]) if pos>=0 else css+"\n"+text

if 'id="optykerClientToolsJs"' in text:
    text=re.sub(r'<script[^>]*id="optykerClientToolsJs"[^>]*></script>',js,text,count=1)
else:
    pos=text.rfind("</body>")
    text=(text[:pos]+js+"\n"+text[pos:]) if pos>=0 else text+"\n"+js

path.write_text(text,encoding="utf-8")
print("Optyker client tools loader OK",version)
